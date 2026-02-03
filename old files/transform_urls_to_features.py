"""
Convert a CSV of URLs (plus optional labels) into the feature format expected by
`train_pipeline.py`. Features are generated with the same extractor used by the
Flask server so training and inference stay aligned.

Examples:
  python transform_urls_to_features.py --in "Dataset 1/PhishingData.csv" \
      --out "Dataset 1/phiusiil_features.csv"

  python transform_urls_to_features.py --in "New folder/top_sites.csv" \
      --out "Dataset 1/top_sites_features.csv" --label 0
"""
import argparse
import csv
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional, Tuple

import pandas as pd

# Reuse the server extractor to guarantee identical feature definitions
from server import extract_features_from_url

URL_CANDIDATES = [
    "url", "URL", "link", "href", "domain", "site"
]
LABEL_CANDIDATES = [
    "label", "Label", "target", "Target", "Result", "result",
    "is_phishing", "phishing", "type", "Type"
]


def find_column(df: pd.DataFrame, candidates: list[str]) -> Optional[str]:
    low_map = {c.lower(): c for c in df.columns}
    for cand in candidates:
        if cand.lower() in low_map:
            return low_map[cand.lower()]
    return None


def normalize_label(value) -> int:
    if pd.isna(value):
        return 0
    s = str(value).strip().lower()
    if s in {"1", "true", "yes", "phish", "phishing", "malicious"}:
        return 1
    if s in {"0", "false", "no", "legit", "legitimate", "benign", "clean"}:
        return 0
    try:
        return 1 if float(s) >= 0.5 else 0
    except Exception:
        return 0


def main():
    parser = argparse.ArgumentParser(description="Convert URLs to feature rows")
    parser.add_argument("--in", dest="input_csv", required=True,
                        help="Input CSV containing at least a URL column")
    parser.add_argument("--out", dest="output_csv", required=True,
                        help="Where to write the transformed CSV")
    parser.add_argument("--label", dest="constant_label", type=int, choices=[0, 1],
                        help="Force every row to use this label (skip label column detection)")
    parser.add_argument("--limit", type=int, default=None,
                        help="Maximum number of rows to process (for quick tests)")
    parser.add_argument("--progress-every", type=int, default=200,
                        help="Log progress every N processed rows")
    parser.add_argument("--workers", type=int, default=max(2, (os.cpu_count() or 4) // 2),
                        help="Parallel worker threads for feature extraction (WHOIS/DNS heavy)")
    args = parser.parse_args()

    in_path = args.input_csv
    out_path = args.output_csv

    if not os.path.exists(in_path):
        print(f"[error] Input CSV not found: {in_path}")
        sys.exit(1)

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)

    df = pd.read_csv(in_path, encoding="utf-8")
    if df.empty:
        print("[error] Input CSV is empty")
        sys.exit(1)

    url_col = find_column(df, URL_CANDIDATES)
    if not url_col:
        print(f"[error] Could not detect URL column in {in_path}; looked for {URL_CANDIDATES}")
        sys.exit(1)

    if args.constant_label is None:
        label_col = find_column(df, LABEL_CANDIDATES)
        if not label_col:
            print(f"[error] No label column found and --label not provided; candidates {LABEL_CANDIDATES}")
            sys.exit(1)
    else:
        label_col = None

    url_idx = df.columns.get_loc(url_col)
    label_idx = df.columns.get_loc(label_col) if label_col else None

    jobs: list[Tuple[int, str, int]] = []
    for idx, row_values in enumerate(df.itertuples(index=False, name=None), 1):
        if args.limit is not None and idx > args.limit:
            break

        raw_url = str(row_values[url_idx]).strip()
        if not raw_url:
            continue
        if not raw_url.lower().startswith(("http://", "https://")):
            raw_url = "http://" + raw_url

        label_value = args.constant_label if args.constant_label is not None else normalize_label(row_values[label_idx])
        jobs.append((idx, raw_url, label_value))

    if not jobs:
        print("[error] No rows were queued for processing")
        sys.exit(1)

    total = len(jobs)
    rows: list[Tuple[int, dict]] = []

    def _extract(job: Tuple[int, str, int]) -> Tuple[int, str, Optional[dict], Optional[Exception]]:
        row_idx, raw_url, label_value = job
        try:
            feats_df = extract_features_from_url(raw_url)
            feat = feats_df.iloc[0].to_dict()
            feat["Result"] = label_value
            feat["url_raw"] = raw_url
            return row_idx, raw_url, feat, None
        except Exception as exc:  # pragma: no cover - network heavy
            return row_idx, raw_url, None, exc

    start = time.time()
    processed = 0
    workers = max(1, args.workers)
    print(f"[info] Using {workers} worker thread(s) for extraction")
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(_extract, job) for job in jobs]
        for future in as_completed(futures):
            row_idx, raw_url, feat, error = future.result()
            processed += 1
            if error is not None:
                print(f"[warn] Skipping row {row_idx} ({raw_url}): {error}")
            elif feat is not None:
                rows.append((row_idx, feat))

            if processed % max(1, args.progress_every) == 0 or processed == total:
                rate = processed / max(0.1, (time.time() - start))
                print(f"[info] Processed {processed}/{total} rows (~{rate:.1f} rows/sec)")

    if not rows:
        print("[error] No rows were processed successfully")
        sys.exit(1)

    rows.sort(key=lambda item: item[0])
    out_df = pd.DataFrame([feat for _, feat in rows])
    for col in out_df.columns:
        if col == "url_raw":
            continue
        try:
            out_df[col] = pd.to_numeric(out_df[col])
        except Exception:
            pass

    out_df.to_csv(out_path, index=False, quoting=csv.QUOTE_MINIMAL)
    print(f"[info] Wrote {len(out_df)} rows to {out_path}")
    print(f"Next: python train_pipeline.py --csv \"{out_path}\" --preserve-neg1")


if __name__ == "__main__":
    main()
