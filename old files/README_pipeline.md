# Phishing URL ML Pipeline Guide

This document explains recommended workflows for `pipeline_phishing.py`.

## 1. Modes Overview
- Standard Search: Full RandomForest hyperparameter tuning on entire dataset.
- Fast Mode (`--fast-mode`): Reduced param grid + optional auto sample (120k rows) + capped iterations (<=12).
- ExtraTrees Search (`--search-model extratrees`): Faster tree growth for initial tuning; then refit final model with RandomForest.
- Final Train (`--final-train best_params.json`): Single fit using previously saved distilled parameters (skips search) for speed.
- Feature Caching (`--cache-features`): Saves engineered features to `feature_cache/` Parquet; reuses if dataset + sample unchanged.

## 2. Recommended Workflow (Speed vs Quality)
### Fast Iterative Development
```powershell
python ML/pipeline_phishing.py --fast-mode --cache-features --search-model extratrees --n-iter 12
```
Generates `best_params.json` (algorithm marker `_algo` indicates ExtraTrees). Inspect metrics and timings.

### Final Production Model
1. Optionally adjust `best_params.json` changing `_algo` to `rf` (or let script default to RF by editing the file):
```json
{
  "n_estimators": 350,
  "max_depth": 25,
  "min_samples_split": 2,
  "min_samples_leaf": 2,
  "max_features": "sqrt",
  "class_weight": "balanced",
  "criterion": "gini",
  "bootstrap": true,
  "_algo": "rf"
}
```
2. Run final training on full dataset:
```powershell
python ML/pipeline_phishing.py --final-train best_params.json --cache-features
```
Produces `model.pkl` including scaler + feature names.

## 3. Key Flags
| Flag | Purpose |
|------|---------|
| `--sample-size N` | Stratified sample for faster search. |
| `--n-iter K` | RandomizedSearch iterations (higher = better search). |
| `--fast-mode` | Reduced param grid, auto sample if not set. |
| `--search-model extratrees` | Use ExtraTrees for quicker tuning. |
| `--final-train file.json` | Skip search; direct single model fit. |
| `--cache-features` | Reuse feature engineering results. |

## 4. Artifacts
- `model.pkl`: `{model, scaler, features}` dictionary.
- `best_params.json`: Distilled hyperparameters + `_algo`.
- `metrics_report.txt`: Detailed metrics + timings + summary.
- `feature_importance.png`, `roc_curve.png`: Plots from evaluation.
- `feature_cache/*.parquet`: Cached engineered features.

## 5. Performance Tips
- Use ExtraTrees for search then RandomForest for final fit.
- Increase `n_estimators` only in final fit (e.g., 500) while keeping search lower.
- If memory pressure occurs, lower `sample-size` or reduce `n_estimators`.
- Caching features eliminates repeated string parsing (big time saver in iterative runs).

## 6. Extensibility Ideas
- Add WHOIS/DNS enrichment behind a `--network-features` flag (currently omitted for reproducibility & speed).
- Export train/val/test splits to disk for external audit.
- Add `--export-feature-csv` to save final feature matrix.

## 7. Troubleshooting
| Issue | Resolution |
|-------|------------|
| Cache mismatch after code change | Delete `feature_cache/*.parquet` and rerun. |
| Unbalanced classes error | Provide larger sample or full dataset; ensure both classes >1%. |
| Slow tuning | Reduce `--n-iter` or enable `--fast-mode` + ExtraTrees. |
| ROC-AUC lower than expected | Increase `--n-iter`, widen param grid (disable `--fast-mode`). |

## 8. Quick Reference Commands
```powershell
# Fast exploratory tuning
python ML/pipeline_phishing.py --fast-mode --search-model extratrees --cache-features

# Save best params and refit full RF
python ML/pipeline_phishing.py --final-train best_params.json --cache-features

# Standard (higher quality) full search
python ML/pipeline_phishing.py --n-iter 25 --cache-features
```

---
Feel free to request additional automation or feature enrichment.
