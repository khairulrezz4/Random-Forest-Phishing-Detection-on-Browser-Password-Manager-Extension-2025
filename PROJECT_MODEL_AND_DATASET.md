# Project Model & Dataset Documentation

## Main Model Dataset
- **Default dataset:** `tarun_tiwari_dataset_balanced.csv`
- **Location:** Project root directory
- **Composition:**
  - Combines Tarun Tiwari phishing/benign URLs and PhiUSIIL phishing dataset
  - Size: 604,287 rows (65% benign, 35% phishing)
  - Columns: `URL`, `Label` (values: `good` for benign, `bad` for phishing)

## Model Training Pipeline
- **Script:** `ML/pipeline_phishing.py`
- **Default behavior:** Uses `tarun_tiwari_dataset_balanced.csv` unless overridden with `--dataset`
- **Recommended training command:**
  ```bash
  cd ML
  python pipeline_phishing.py --n-iter 20 --cores 12 --cache-features
  ```
- **Outputs:**
  - `model.pkl` (RandomForestClassifier, scaler, feature list)
  - `metrics_report.txt` (metrics for train/val/test)
  - `feature_importance.png`, `roc_curve.png`, `best_params.json`

## Model Usage in System
- **ML/server.py** loads `model.pkl` and uses the same feature extraction as training
- **rf-password-manager** extension queries the local server for predictions
- **Thresholds and config:** Controlled by `ML/model_config.json`

## Data Sources
- **Tarun Tiwari dataset:** Original phishing/benign URLs
- **PhiUSIIL dataset:** Additional phishing/benign URLs (see `ML/phil/PhiUSIIL_Phishing_URL_Dataset.csv`)
- **Combined in:** `tarun_tiwari_dataset_balanced.csv`

## Reproducibility & Portability
- All code, data, and configs are in the repo
- To retrain or evaluate, use the commands above
- All results in `metrics_report.txt` and plots are from the combined dataset

## For Chat Copilot/AI Assistants
- Always use `tarun_tiwari_dataset_balanced.csv` as the main dataset
- All model training, evaluation, and reporting should reference this file
- If user asks about data, model, or results, default to this combined dataset
- If user wants to switch datasets, use the `--dataset` flag in training commands

---
**Last updated:** 2025-12-16
