"""Tarun Tiwari's Machine Learning Pipeline for Phishing URL Classification.

Dataset: Tarun Tiwari's Dataset (tarun_tiwari_dataset.csv)
The CSV is expected to contain at least two columns: a URL column (e.g. `URL` or `url`) and a label column
with values indicating phishing vs benign. Common phishing-positive strings treated as class 1:
  {"bad","phish","phishing","malicious","1","true","yes"}
Common benign strings treated as class 0:
  {"good","legit","legitimate","benign","clean","0","false","no"}

Functionality implemented per user requirements:
  1. Load & clean (remove duplicates, trim whitespace, drop empty, handle missing labels)
  2. Automatic data quality checks & fixes (constant columns, high missing ratio, invalid labels)
  3. Feature engineering (lexical URL features, entropy, keyword flags, structural counts)
  4. Feature selection (high correlation filtering + tree-based importance refinement)
  5. Stratified train/validation/test split
  6. RandomForest training with RandomizedSearchCV hyperparameter tuning
  7. Evaluation: accuracy, precision, recall, F1, ROC-AUC, confusion matrix
  8. Plots: feature importance bar plot, ROC curve
  9. Persist final model as `model.pkl`

Runs without modification. Just execute:
    python ML/pipeline_phishing.py

Outputs:
  - model.pkl (trained RandomForest)
  - feature_importance.png
  - roc_curve.png
  - metrics_report.txt

Note: This script keeps network-independent feature engineering for speed & reproducibility.
"""
from __future__ import annotations

import os
import math
import json
import pickle
import re
import argparse
import time
import hashlib
from pathlib import Path
from typing import List, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold, RandomizedSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    RocCurveDisplay,
)
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier
import matplotlib.pyplot as plt
import seaborn as sns
from tqdm import tqdm


# ---------------------------------------------------------------------------
# Progress Tracking Helpers
# ---------------------------------------------------------------------------
class PipelineProgress:
    """Helper class to track and display pipeline progress."""
    STAGES = [
        ("Loading Dataset", 5),
        ("Quality Checks", 3),
        ("Sampling", 2),
        ("Feature Engineering", 35),
        ("Correlation Filter", 5),
        ("Tree-based Selection", 15),
        ("Splitting Data", 3),
        ("Scaling Features", 2),
        ("Hyperparameter Tuning", 25),
        ("Evaluation & Saving", 5),
    ]
    
    def __init__(self):
        self.total_weight = sum(w for _, w in self.STAGES)
        self.completed_weight = 0
        self.current_stage_idx = 0
    
    def start_stage(self, stage_name: str):
        """Mark a new stage as starting and print its progress."""
        # Find the stage index
        for idx, (name, _) in enumerate(self.STAGES):
            if name == stage_name:
                self.current_stage_idx = idx
                break
        
        pct = int(self.completed_weight / self.total_weight * 100)
        print(f"\n{'='*60}")
        print(f"[{pct:3d}%] Starting: {stage_name}")
        print(f"{'='*60}")
    
    def complete_stage(self, stage_name: str, elapsed_secs: float = None):
        """Mark a stage as complete."""
        for name, weight in self.STAGES:
            if name == stage_name:
                self.completed_weight += weight
                break
        
        pct = int(self.completed_weight / self.total_weight * 100)
        elapsed_str = f" ({elapsed_secs:.1f}s)" if elapsed_secs else ""
        print(f"[{pct:3d}%] Completed: {stage_name}{elapsed_str}")
    
    def final_summary(self, total_time: float):
        """Print final summary."""
        print(f"\n{'='*60}")
        print(f"[100%] PIPELINE COMPLETE! Total time: {total_time:.1f}s")
        print(f"{'='*60}\n")


# ---------------------------------------------------------------------------
# Configuration - Tarun Tiwari's Machine Learning
# ---------------------------------------------------------------------------
DATASET_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "tarun_tiwari_dataset.csv")
RANDOM_STATE = 42
MIN_LABEL_RATIO = 0.01  # Ensure both classes exist with minimal representation
MAX_MISSING_RATIO = 0.5  # Drop columns missing more than this fraction
HIGH_CORRELATION_THRESHOLD = 0.95
N_JOBS = 4  # Default cores (can be overridden via --cores flag)

URL_COLUMN_CANDIDATES = ["url", "URL", "Url"]
LABEL_COLUMN_CANDIDATES = [
    "label", "Label", "result", "Result", "target", "Target",
    "is_phishing", "phishing", "class", "Class"
]
POSITIVE_LABELS = {"bad", "phish", "phishing", "malicious", "1", "true", "yes"}
NEGATIVE_LABELS = {"good", "legit", "legitimate", "benign", "clean", "0", "false", "no"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def find_column(df: pd.DataFrame, candidates: List[str]) -> str | None:
    lower_map = {c.lower(): c for c in df.columns}
    for cand in candidates:
        if cand.lower() in lower_map:
            return lower_map[cand.lower()]
    return None


def normalize_label(value) -> int:
    if pd.isna(value):
        return np.nan
    s = str(value).strip().lower()
    if s in POSITIVE_LABELS:
        return 1
    if s in NEGATIVE_LABELS:
        return 0
    # Fallback: try numeric interpretation; >=0.5 => phishing
    try:
        return 1 if float(s) >= 0.5 else 0
    except Exception:
        return np.nan


def shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    freqs = {ch: s.count(ch) for ch in set(s)}
    length = len(s)
    return -sum((cnt / length) * math.log2(cnt / length) for cnt in freqs.values())


SUSPICIOUS_KEYWORDS = [
    "login", "verify", "account", "update", "secure", "webscr", "confirm",
    "bank", "paypal", "signin", "ebay", "alert", "credential", "validation"
]

IP_REGEX = re.compile(r"^(?:\d{1,3}\.){3}\d{1,3}")
HEX_REGEX = re.compile(r"[0-9a-fA-F]{6,}")


def extract_url_features(url: str) -> dict:
    raw = url.strip()
    if not raw.lower().startswith(("http://", "https://")):
        raw = "http://" + raw  # ensure scheme for consistency
    # Basic parts
    no_scheme = re.sub(r"^https?://", "", raw)
    domain_part = no_scheme.split("/")[0]
    path_part = no_scheme[len(domain_part):]
    # Features
    feats = {
        "url_length": len(raw),
        "domain_length": len(domain_part),
        "path_length": len(path_part),
        "count_digits": sum(ch.isdigit() for ch in raw),
        "count_letters": sum(ch.isalpha() for ch in raw),
        "count_dots": raw.count('.'),
        "count_hyphen": raw.count('-'),
        "count_at": raw.count('@'),
        "count_question": raw.count('?'),
        "count_equals": raw.count('='),
        "count_percent": raw.count('%'),
        "count_slash": raw.count('/'),
        "count_colon": raw.count(':'),
        "entropy": shannon_entropy(raw),
        "digit_ratio": (sum(ch.isdigit() for ch in raw) / max(1, len(raw))),
        "letter_ratio": (sum(ch.isalpha() for ch in raw) / max(1, len(raw))),
        "has_ip_domain": int(bool(IP_REGEX.match(domain_part))),
        "hex_sequence": int(bool(HEX_REGEX.search(raw))),
        "suspicious_keyword_count": sum(kw in raw.lower() for kw in SUSPICIOUS_KEYWORDS),
        "long_token_count": sum(1 for token in re.split(r"\W+", raw) if len(token) > 15),
        "subdomain_count": domain_part.count('.') if domain_part else 0,
        "tld_length": len(domain_part.split('.')[-1]) if '.' in domain_part else 0,
        "contains_https_token": int("https" in raw[8:].lower()),  # after scheme
        "contains_login_token": int("login" in raw.lower()),
        "contains_secure_token": int("secure" in raw.lower()),
        "contains_verify_token": int("verify" in raw.lower()),
    }
    return feats


# ---------------------------------------------------------------------------
# Load & Clean
# ---------------------------------------------------------------------------
def load_and_clean(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Dataset path not found: {path}")
    df = pd.read_csv(path, encoding="utf-8")
    if df.empty:
        raise ValueError("Dataset is empty")
    url_col = find_column(df, URL_COLUMN_CANDIDATES)
    label_col = find_column(df, LABEL_COLUMN_CANDIDATES)
    if not url_col:
        raise ValueError(f"Could not detect URL column; looked for {URL_COLUMN_CANDIDATES}")
    if not label_col:
        raise ValueError(f"Could not detect label column; looked for {LABEL_COLUMN_CANDIDATES}")
    # Keep only needed columns first
    df = df[[url_col, label_col]].copy()
    df.columns = ["url", "label"]
    # Trim whitespace
    df["url"] = df["url"].astype(str).str.strip()
    df["label"] = df["label"].astype(str).str.strip()
    # Drop empty URLs
    df = df[df["url"].str.len() > 0]
    # Remove duplicates
    df = df.drop_duplicates(subset=["url"]).reset_index(drop=True)
    # Normalize labels
    df["label"] = df["label"].apply(normalize_label)
    # Drop rows with undefined labels
    df = df.dropna(subset=["label"]).reset_index(drop=True)
    df["label"] = df["label"].astype(int)
    # Verify class balance minimal presence
    class_counts = df["label"].value_counts(normalize=True)
    if class_counts.min() < MIN_LABEL_RATIO:
        raise ValueError(f"One class below minimal ratio {MIN_LABEL_RATIO}; distribution: {class_counts.to_dict()}")
    return df


# ---------------------------------------------------------------------------
# Data Quality Checks & Fixes
# ---------------------------------------------------------------------------
def auto_quality_fix(df: pd.DataFrame) -> pd.DataFrame:
    # Remove columns with too many missing values (none expected here besides label normalization stage)
    for col in list(df.columns):
        if df[col].isna().mean() > MAX_MISSING_RATIO:
            df = df.drop(columns=[col])
    # Remove constant columns
    for col in list(df.columns):
        if df[col].nunique() <= 1 and col != "label":
            df = df.drop(columns=[col])
    return df


# ---------------------------------------------------------------------------
# Feature Engineering
# ---------------------------------------------------------------------------
def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    urls = df["url"].tolist()
    feature_rows = []
    for u in tqdm(urls, desc="Extracting URL features", unit="url", ncols=100):
        feature_rows.append(extract_url_features(u))
    feat_df = pd.DataFrame(feature_rows)
    combined = pd.concat([df[["url", "label"]], feat_df], axis=1)
    return combined


# ---------------------------------------------------------------------------
# Feature Selection
# ---------------------------------------------------------------------------
def correlation_filter(df: pd.DataFrame, label_col: str = "label") -> pd.DataFrame:
    feature_cols = [c for c in df.columns if c not in {label_col, "url"}]
    corr = df[feature_cols].corr().abs()
    upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
    to_drop = [col for col in upper.columns if any(upper[col] > HIGH_CORRELATION_THRESHOLD)]
    filtered = df.drop(columns=to_drop)
    return filtered


def tree_based_selection(df: pd.DataFrame, label_col: str = "label") -> Tuple[pd.DataFrame, List[Tuple[str, float]]]:
    feature_cols = [c for c in df.columns if c not in {label_col, "url"}]
    X = df[feature_cols]
    y = df[label_col]
    rf = RandomForestClassifier(
        n_estimators=200,
        random_state=RANDOM_STATE,
        n_jobs=N_JOBS,
    )
    rf.fit(X, y)
    importances = list(zip(feature_cols, rf.feature_importances_))
    importances.sort(key=lambda x: x[1], reverse=True)
    scores = np.array([imp for _, imp in importances])
    threshold = np.median(scores)  # Keep features with importance >= median
    keep = [name for name, score in importances if score >= threshold]
    selected_df = df[["url", label_col] + keep].copy()
    return selected_df, importances


# ---------------------------------------------------------------------------
# Split Data
# ---------------------------------------------------------------------------
def stratified_split(df: pd.DataFrame, label_col: str = "label"):
    X = df.drop(columns=[label_col, "url"])
    y = df[label_col]
    # First split train+temp vs test
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )
    # Split temp into validation and test
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.5, stratify=y_temp, random_state=RANDOM_STATE
    )
    return X_train, X_val, X_test, y_train, y_val, y_test


# ---------------------------------------------------------------------------
# Model Training with Hyperparameter Tuning
# ---------------------------------------------------------------------------
def tune_and_train(X_train: pd.DataFrame, y_train: pd.Series, n_iter: int = 25, fast_mode: bool = False, search_model: str = "rf") -> RandomForestClassifier:
    """Randomized hyperparameter search. fast_mode reduces grid & caps iterations.
    search_model: 'rf' (RandomForest) or 'extratrees' (ExtraTreesClassifier for faster search).
    """
    if search_model not in {"rf", "extratrees"}:
        raise ValueError("search_model must be 'rf' or 'extratrees'")
    base_cls = RandomForestClassifier if search_model == "rf" else ExtraTreesClassifier
    rf = base_cls(random_state=RANDOM_STATE, n_jobs=N_JOBS)
    if fast_mode:
        param_dist = {
            "n_estimators": [250, 350],
            "max_depth": [15, 25, 35],
            "min_samples_split": [2, 4],
            "min_samples_leaf": [1, 2, 4],
            "max_features": ["sqrt", "log2"],
            "class_weight": ["balanced"],
        }
        n_iter = min(n_iter, 12)
    else:
        param_dist = {
            "n_estimators": [200, 300, 400, 500],
            "max_depth": [None, 10, 20, 30, 40],
            "min_samples_split": [2, 4, 6, 8],
            "min_samples_leaf": [1, 2, 4],
            "max_features": ["sqrt", "log2", None],
            "class_weight": [None, "balanced"],
        }
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    search = RandomizedSearchCV(
        rf,
        param_distributions=param_dist,
        n_iter=n_iter,
        cv=cv,
        scoring="f1",
        random_state=RANDOM_STATE,
        n_jobs=N_JOBS,
        verbose=1,
    )
    search.fit(X_train, y_train)
    best_model: RandomForestClassifier = search.best_estimator_
    return best_model


def train_with_params(X_train: pd.DataFrame, y_train: pd.Series, params: dict) -> RandomForestClassifier:
    """Single direct fit using provided params (skip search). Accepts either RF or ExtraTrees params."""
    algo = params.pop("_algo", "rf")
    cls = RandomForestClassifier if algo == "rf" else ExtraTreesClassifier
    rf = cls(random_state=RANDOM_STATE, n_jobs=N_JOBS, **params)
    rf.fit(X_train, y_train)
    return rf


# ---------------------------------------------------------------------------
# Evaluation & Plots
# ---------------------------------------------------------------------------
def evaluate(model: RandomForestClassifier, X_val, y_val, X_test, y_test, feature_names: List[str]):
    y_pred_val = model.predict(X_val)
    y_pred_test = model.predict(X_test)
    y_prob_test = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy_val": accuracy_score(y_val, y_pred_val),
        "precision_val": precision_score(y_val, y_pred_val),
        "recall_val": recall_score(y_val, y_pred_val),
        "f1_val": f1_score(y_val, y_pred_val),
        "accuracy_test": accuracy_score(y_test, y_pred_test),
        "precision_test": precision_score(y_test, y_pred_test),
        "recall_test": recall_score(y_test, y_pred_test),
        "f1_test": f1_score(y_test, y_pred_test),
        "roc_auc_test": roc_auc_score(y_test, y_prob_test),
        "confusion_matrix_test": confusion_matrix(y_test, y_pred_test).tolist(),
    }

    # Save metrics report
    with open("metrics_report.txt", "w", encoding="utf-8") as f:
        f.write(json.dumps(metrics, indent=2))

    # Feature importance plot
    importances = model.feature_importances_
    fi_df = pd.DataFrame({"feature": feature_names, "importance": importances})
    fi_df = fi_df.sort_values("importance", ascending=False)
    plt.figure(figsize=(10, 6))
    sns.barplot(x="importance", y="feature", data=fi_df.head(25), palette="viridis")
    plt.title("Top Feature Importances (RandomForest)")
    plt.tight_layout()
    plt.savefig("feature_importance.png", dpi=150)
    plt.close()

    # ROC curve
    RocCurveDisplay.from_predictions(y_test, y_prob_test)
    plt.title("ROC Curve (Test Set)")
    plt.tight_layout()
    plt.savefig("roc_curve.png", dpi=150)
    plt.close()
    return metrics


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------
def main():
    global N_JOBS
    parser = argparse.ArgumentParser(description="Phishing URL ML pipeline")
    parser.add_argument("--dataset", type=str, default=DATASET_PATH, help="Path to CSV dataset (default: repo phishing_site_urls.csv)")
    parser.add_argument("--sample-size", type=int, default=None, help="Optional stratified sample size for quick runs")
    parser.add_argument("--n-iter", type=int, default=25, help="RandomizedSearchCV iterations (lower for speed)")
    parser.add_argument("--fast-mode", action="store_true", help="Reduced param grid + auto sample-size (120000) if not set; caps n_iter at 12")
    parser.add_argument("--final-train", type=str, default=None, help="JSON file of best params for single final fit (skips search)")
    parser.add_argument("--search-model", type=str, choices=["rf","extratrees"], default="rf", help="Algorithm for hyperparameter search (rf|extratrees)")
    parser.add_argument("--cache-features", action="store_true", help="Cache engineered features to Parquet and reuse if unchanged")
    parser.add_argument("--cores", type=int, default=N_JOBS, help="Number of CPU cores to use (default: 4, use 2 for low CPU usage)")
    parser.add_argument("--low-priority", action="store_true", help="Run at lower CPU priority (Windows: below normal)")
    args = parser.parse_args()

    # Apply CPU settings
    N_JOBS = args.cores
    if args.low_priority:
        try:
            import psutil
            p = psutil.Process(os.getpid())
            p.nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)  # Windows
            print(f"[info] Running at LOW priority (CPU-friendly mode)")
        except ImportError:
            # Fallback for Windows without psutil
            import subprocess
            subprocess.run(['wmic', 'process', 'where', f'processid={os.getpid()}', 'CALL', 'setpriority', '"below normal"'], 
                          capture_output=True, shell=True)
            print(f"[info] Running at LOW priority (CPU-friendly mode)")
        except Exception as e:
            print(f"[warn] Could not set low priority: {e}")

    # Initialize progress tracker
    progress = PipelineProgress()
    timings = {}
    t_global_start = time.time()
    
    print("\n" + "="*60)
    print("  PHISHING URL CLASSIFICATION PIPELINE")
    print("="*60)

    # -------------------------------------------------------------------------
    # Stage 1: Loading Dataset
    # -------------------------------------------------------------------------
    progress.start_stage("Loading Dataset")
    t0 = time.time()
    df = load_and_clean(args.dataset)
    timings['load_clean_seconds'] = round(time.time() - t0, 3)
    print(f"  → Loaded {len(df):,} rows")
    progress.complete_stage("Loading Dataset", timings['load_clean_seconds'])

    # -------------------------------------------------------------------------
    # Stage 2: Quality Checks
    # -------------------------------------------------------------------------
    progress.start_stage("Quality Checks")
    t0 = time.time()
    df = auto_quality_fix(df)
    timings['quality_fix_seconds'] = round(time.time() - t0, 3)
    print(f"  → Columns after quality fix: {list(df.columns)}")
    progress.complete_stage("Quality Checks", timings['quality_fix_seconds'])

    # -------------------------------------------------------------------------
    # Stage 3: Sampling (optional)
    # -------------------------------------------------------------------------
    progress.start_stage("Sampling")
    t0 = time.time()
    if args.fast_mode and args.sample_size is None:
        args.sample_size = min(120000, len(df))
    if args.sample_size is not None and args.sample_size < len(df):
        from sklearn.model_selection import StratifiedShuffleSplit
        splitter = StratifiedShuffleSplit(n_splits=1, test_size=(len(df) - args.sample_size) / len(df), random_state=RANDOM_STATE)
        for keep_idx, _ in splitter.split(df, df['label']):
            df = df.iloc[keep_idx].reset_index(drop=True)
        print(f"  → Applied stratified sampling → {len(df):,} rows")
    else:
        print(f"  → Using full dataset: {len(df):,} rows")
    timings['sampling_seconds'] = round(time.time() - t0, 3)
    progress.complete_stage("Sampling", timings['sampling_seconds'])

    # -------------------------------------------------------------------------
    # Stage 4: Feature Engineering (slowest step)
    # -------------------------------------------------------------------------
    progress.start_stage("Feature Engineering")
    t0 = time.time()
    cache_used = False
    if args.cache_features:
        key_src = f"{Path(args.dataset).resolve()}|{args.sample_size}|v1"
        key_hash = hashlib.md5(key_src.encode()).hexdigest()[:12]
        cache_dir = Path("feature_cache")
        cache_dir.mkdir(exist_ok=True)
        cache_file = cache_dir / f"features_{key_hash}.parquet"
        if cache_file.exists():
            try:
                df_feat = pd.read_parquet(cache_file)
                cache_used = True
                print(f"  → Reused cached features: {cache_file}")
            except Exception as exc:
                print(f"  → Cache read failed: {exc}; regenerating...")
    if not cache_used:
        print(f"  → Extracting features from {len(df):,} URLs...")
        df_feat = engineer_features(df)
        if args.cache_features:
            try:
                df_feat.to_parquet(cache_file, index=False)
                print(f"  → Cached features → {cache_file}")
            except Exception as exc:
                print(f"  → Cache write failed: {exc}")
    timings['feature_engineering_seconds'] = round(time.time() - t0, 3)
    print(f"  → Feature columns: {len(df_feat.columns) - 2} (cache_used={cache_used})")
    progress.complete_stage("Feature Engineering", timings['feature_engineering_seconds'])

    # -------------------------------------------------------------------------
    # Stage 5: Correlation Filter
    # -------------------------------------------------------------------------
    progress.start_stage("Correlation Filter")
    t0 = time.time()
    df_corr = correlation_filter(df_feat)
    timings['correlation_filter_seconds'] = round(time.time() - t0, 3)
    print(f"  → Columns after correlation filter: {len(df_corr.columns) - 2}")
    progress.complete_stage("Correlation Filter", timings['correlation_filter_seconds'])

    # -------------------------------------------------------------------------
    # Stage 6: Tree-based Selection
    # -------------------------------------------------------------------------
    progress.start_stage("Tree-based Selection")
    t0 = time.time()
    print("  → Training feature importance model...")
    df_sel, importances = tree_based_selection(df_corr)
    timings['tree_selection_seconds'] = round(time.time() - t0, 3)
    print(f"  → Selected features: {len(df_sel.columns) - 2}")
    progress.complete_stage("Tree-based Selection", timings['tree_selection_seconds'])

    # -------------------------------------------------------------------------
    # Stage 7: Splitting Data
    # -------------------------------------------------------------------------
    progress.start_stage("Splitting Data")
    t0 = time.time()
    X_train, X_val, X_test, y_train, y_val, y_test = stratified_split(df_sel)
    timings['split_seconds'] = round(time.time() - t0, 3)
    feature_names = list(X_train.columns)
    print(f"  → Train: {len(X_train):,} | Val: {len(X_val):,} | Test: {len(X_test):,}")
    progress.complete_stage("Splitting Data", timings['split_seconds'])

    # -------------------------------------------------------------------------
    # Stage 8: Scaling Features
    # -------------------------------------------------------------------------
    progress.start_stage("Scaling Features")
    t0 = time.time()
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)
    timings['scaling_seconds'] = round(time.time() - t0, 3)
    print(f"  → Scaled {len(feature_names)} features")
    progress.complete_stage("Scaling Features", timings['scaling_seconds'])

    # -------------------------------------------------------------------------
    # Stage 9: Hyperparameter Tuning / Training
    # -------------------------------------------------------------------------
    progress.start_stage("Hyperparameter Tuning")
    if args.final_train:
        t0 = time.time()
        print(f"  → Using params file: {args.final_train}")
        with open(args.final_train, 'r', encoding='utf-8') as f:
            loaded_params = json.load(f)
        for bad_key in ["n_jobs", "random_state", "verbose", "warm_start"]:
            loaded_params.pop(bad_key, None)
        model = train_with_params(pd.DataFrame(X_train_scaled, columns=feature_names), y_train, loaded_params)
        timings['tuning_seconds'] = round(time.time() - t0, 3)
        print(f"  → Applied params: {loaded_params}")
    else:
        t0 = time.time()
        n_iter_actual = min(args.n_iter, 12) if args.fast_mode else args.n_iter
        total_fits = n_iter_actual * 5  # 5-fold CV
        print(f"  → RandomizedSearchCV: {n_iter_actual} iterations × 5 folds = {total_fits} fits")
        print(f"  → Model: {args.search_model.upper()} | Cores: {N_JOBS}")
        model = tune_and_train(pd.DataFrame(X_train_scaled, columns=feature_names), y_train, n_iter=args.n_iter, fast_mode=args.fast_mode, search_model=args.search_model)
        timings['tuning_seconds'] = round(time.time() - t0, 3)
        # Persist best params
        distilled = {k: v for k, v in model.get_params().items() if k in {
            'n_estimators','max_depth','min_samples_split','min_samples_leaf','max_features','class_weight','criterion','bootstrap'
        }}
        distilled['_algo'] = 'rf' if args.search_model == 'rf' else 'extratrees'
        with open('best_params.json','w',encoding='utf-8') as f:
            json.dump(distilled, f, indent=2)
        print(f"  → Best params saved to best_params.json")
    progress.complete_stage("Hyperparameter Tuning", timings['tuning_seconds'])

    # -------------------------------------------------------------------------
    # Stage 10: Evaluation & Saving
    # -------------------------------------------------------------------------
    progress.start_stage("Evaluation & Saving")
    t0 = time.time()
    metrics = evaluate(
        model,
        pd.DataFrame(X_val_scaled, columns=feature_names), y_val,
        pd.DataFrame(X_test_scaled, columns=feature_names), y_test,
        feature_names,
    )
    timings['evaluation_seconds'] = round(time.time() - t0, 3)
    timings['total_seconds'] = round(time.time() - t_global_start, 3)
    
    print("\n  📊 METRICS SUMMARY:")
    print(f"     Accuracy (test): {metrics['accuracy_test']:.4f}")
    print(f"     Precision (test): {metrics['precision_test']:.4f}")
    print(f"     Recall (test): {metrics['recall_test']:.4f}")
    print(f"     F1 Score (test): {metrics['f1_test']:.4f}")
    print(f"     ROC-AUC (test): {metrics['roc_auc_test']:.4f}")
    print(f"     Confusion Matrix: {metrics['confusion_matrix_test']}")

    print("\n  💾 Saving model...")
    with open("model.pkl", "wb") as f:
        pickle.dump({"model": model, "scaler": scaler, "features": feature_names}, f)
    
    # Save metrics report
    try:
        with open("metrics_report.txt", "r", encoding="utf-8") as f:
            existing = json.load(f)
    except Exception:
        existing = {}
    existing['timings_seconds'] = timings
    existing['summary'] = {
        'rows': len(df),
        'features_final': len(feature_names),
        'fast_mode': args.fast_mode,
        'search_model': args.search_model,
        'cache_used': cache_used,
        'tuning_seconds': timings.get('tuning_seconds'),
        'total_seconds': timings.get('total_seconds')
    }
    with open("metrics_report.txt", "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2)
    
    progress.complete_stage("Evaluation & Saving", timings['evaluation_seconds'])
    
    # Final summary
    progress.final_summary(timings['total_seconds'])
    
    print("  📁 Generated files:")
    print("     → model.pkl")
    print("     → best_params.json") 
    print("     → metrics_report.txt")
    print("     → feature_importance.png")
    print("     → roc_curve.png")


if __name__ == "__main__":
    main()
