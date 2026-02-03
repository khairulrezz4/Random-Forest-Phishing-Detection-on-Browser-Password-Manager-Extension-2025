"""
Clean the PhiUSIIL phishing URL dataset and produce a normalized URL+label CSV
ready for feature extraction and training.

Because the source CSV is large (>50MB), this script streams it with pandas and
performs the following steps:
- Detect URL and label columns (robust header matching)
- Normalize labels to 0 (legit) / 1 (phishing)
- Normalize URLs: ensure http/https scheme, strip fragments, trim whitespace
- Drop invalid rows and duplicates
- Optional: downsample to balance classes
- Save a compact CSV: columns [url,label]

Usage:
  python clean_phiusiil.py \
    --in "PhiUSIIL/PhiUSIIL_Phishing_URL_Dataset.csv" \
    --out "Dataset 2/phiusiil_clean_urls.csv" \
    --limit 100000

Next:
  python transform_urls_to_features.py --in "Dataset 2/phiusiil_clean_urls.csv" --out "Dataset 2/phiusiil_features.csv" --limit 100000
  python train_pipeline.py --csv "Dataset 2/phiusiil_features.csv"
"""
import argparse
import os
import re
from urllib.parse import urlparse
from typing import Optional

import pandas as pd


URL_CANDIDATES = [
    'url', 'URL', 'Url', 'phishing_url', 'phishing-url', 'domain', 'link', 'Link', 'href', 'page'
]
LABEL_CANDIDATES = [
    'label', 'Label', 'target', 'Target', 'result', 'Result', 'class', 'Class',
    'is_phishing', 'phishing', 'Phishing', 'isPhishing', 'Legitimate', 'benign', 'status', 'type'
]


def detect_column(cols: list[str], candidates: list[str]) -> Optional[str]:
    lowmap = {c.lower(): c for c in cols}
    for cand in candidates:
        if cand.lower() in lowmap:
            return lowmap[cand.lower()]
    return None


def normalize_url(u: str) -> Optional[str]:
    if pd.isna(u):
        return None
    s = str(u).strip()
    if not s:
        return None
    if not re.match(r'^https?://', s, re.I):
        s = 'http://' + s
    try:
        p = urlparse(s)
        if not p.scheme or not p.netloc:
            return None
        # Normalize: drop query/fragment to reduce duplicates; keep path
        return f"{p.scheme}://{p.netloc}{p.path}"
    except Exception:
        return None


def normalize_label(v) -> int:
    if pd.isna(v):
        return 0
    s = str(v).strip().lower()
    if s in {'1', 'true', 'yes', 'phishing', 'phish', 'malicious', 'bad'}:
        return 1
    if s in {'0', 'false', 'no', 'legit', 'legitimate', 'benign', 'good', 'clean'}:
        return 0
    try:
        return 1 if float(s) >= 0.5 else 0
    except Exception:
        return 0


def main():
    ap = argparse.ArgumentParser(description='Clean PhiUSIIL phishing URL dataset')
    ap.add_argument('--in', dest='input_csv', default='PhiUSIIL/PhiUSIIL_Phishing_URL_Dataset.csv', help='Input CSV path')
    ap.add_argument('--out', dest='output_csv', default='Dataset 2/phiusiil_clean_urls.csv', help='Output CSV path')
    ap.add_argument('--limit', type=int, default=None, help='Max rows to process (for quick tests)')
    ap.add_argument('--balance', action='store_true', help='Downsample majority class to balance')
    args = ap.parse_args()

    in_path = args.input_csv
    out_path = args.output_csv
    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)

    # Read in chunks for large files
    chunks = []
    chunk_size = 200_000
    row_count = 0
    for chunk in pd.read_csv(in_path, encoding='utf-8', chunksize=chunk_size):
        url_col = detect_column(chunk.columns.tolist(), URL_CANDIDATES)
        label_col = detect_column(chunk.columns.tolist(), LABEL_CANDIDATES)
        if not url_col or not label_col:
            # Try to detect once from the first non-empty chunk
            continue

        df = pd.DataFrame({
            'url': chunk[url_col].apply(normalize_url),
            'label': chunk[label_col].apply(normalize_label)
        })
        df = df.dropna(subset=['url']).drop_duplicates(subset=['url'])
        chunks.append(df)

        row_count += len(chunk)
        if args.limit and row_count >= args.limit:
            break

    if not chunks:
        raise RuntimeError('No valid data found; check the input columns and encoding')

    all_df = pd.concat(chunks, ignore_index=True)

    if args.balance:
        # Downsample majority class
        pos = all_df[all_df.label == 1]
        neg = all_df[all_df.label == 0]
        if len(pos) and len(neg):
            m = min(len(pos), len(neg))
            pos = pos.sample(n=m, random_state=42)
            neg = neg.sample(n=m, random_state=42)
            all_df = pd.concat([pos, neg], ignore_index=True).sample(frac=1.0, random_state=42)

    all_df.to_csv(out_path, index=False)
    print(f"[info] Cleaned URLs written to {out_path} ({len(all_df)} rows)")
    print("Next: convert to features and train:")
    print(f"  python transform_urls_to_features.py --in \"{out_path}\" --out \"Dataset 2/phiusiil_features.csv\"")
    print("  python train_pipeline.py --csv \"Dataset 2/phiusiil_features.csv\"")


if __name__ == '__main__':
    main()
