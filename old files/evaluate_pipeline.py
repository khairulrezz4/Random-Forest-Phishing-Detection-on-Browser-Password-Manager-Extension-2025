"""Evaluate an existing rf_pipeline.pkl against the dataset using the same normalization.
Outputs classification report and confusion matrix.
Run: python evaluate_pipeline.py
"""
import argparse
import joblib
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix
from train_pipeline import normalize_feature_values

def load_data(csv_path='Dataset 1/dataset1.csv', preserve_neg1=False):
    df = pd.read_csv(csv_path, encoding='utf-8')
    if df.columns[0].lower().strip() in ['index', 'unnamed: 0']:
        df = df.iloc[:, 1:]
    df.columns = [c.strip() for c in df.columns]
    target_candidates = ['Result', 'result']
    target_col = next((c for c in target_candidates if c in df.columns), None)
    if not target_col:
        raise ValueError('Target column not found')
    X = df.drop(columns=[target_col])
    y = df[target_col]
    if preserve_neg1:
        print("[info] Preserving -1 values to match precomputed feature set")
    else:
        X = normalize_feature_values(X)
    return X, y

def main():
    parser = argparse.ArgumentParser(description='Evaluate a trained phishing pipeline')
    parser.add_argument('--csv', default='Dataset 1/dataset1.csv', help='Dataset CSV to evaluate against')
    parser.add_argument('--model', default='rf_pipeline.pkl', help='Path to trained pipeline file')
    parser.add_argument('--preserve-neg1', action='store_true', help='Keep -1 feature values instead of normalizing them to 0')
    args = parser.parse_args()

    X, y = load_data(args.csv, preserve_neg1=args.preserve_neg1)
    pipeline = joblib.load(args.model)
    y_pred = pipeline.predict(X)
    print('Classification report:\n', classification_report(y, y_pred, digits=4))
    print('Confusion matrix:\n', confusion_matrix(y, y_pred))

if __name__ == '__main__':
    main()
