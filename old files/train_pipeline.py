"""
Train a new Random Forest pipeline for phishing detection using dataset1.csv.
Saves the complete pipeline (preprocessing + model) as rf_pipeline.pkl.
"""
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
import joblib
import logging
import argparse
from sklearn.metrics import classification_report, confusion_matrix, roc_curve
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def load_and_prepare_data(csv_path='Dataset 1/dataset1.csv', preserve_neg1=False):
    """Load and prepare the dataset for training."""
    # Handle spaces in folder name and allow custom path
    logger.info(f"Loading dataset from {csv_path}")
    
    # Read CSV (skip first column if it's just an index)
    df = pd.read_csv(csv_path, encoding='utf-8')
    if df.columns[0].lower().strip() in ['index', 'unnamed: 0']:
        df = df.iloc[:, 1:]  # Skip index column
    
    # Clean column names (preserve original feature names from dataset)
    df.columns = [col.strip() for col in df.columns]
    
    # Identify target column ('Result' in this dataset)
    target_candidates = ['Result', 'result']
    target_col = next((c for c in target_candidates if c in df.columns), None)
    if not target_col:
        raise ValueError(f"Target column not found; tried {target_candidates}")
    
    # Split features and target
    X = df.drop(columns=[target_col])
    y = df[target_col]

    if preserve_neg1:
        logger.info("Preserving -1 values; assuming downstream extractor supplies the same range at inference time.")
    else:
        # Normalize feature value ranges (convert -1 -> 0 for binary/tri-state columns)
        X = normalize_feature_values(X)
    
    logger.info(f"Dataset loaded: {len(df)} samples, {len(X.columns)} features")
    logger.info(f"Features: {', '.join(X.columns)}")
    logger.info(f"Class distribution:\n{y.value_counts(normalize=True)}")
    
    return X, y

def create_and_train_pipeline(X, y):
    """Create and train the pipeline with preprocessing and model.
    Returns (pipeline, optimal_threshold).
    """
    logger.info("Creating and training pipeline...")
    
    # Create pipeline
    pipeline = Pipeline([
        ('scaler', StandardScaler()),  # Scale numerical features
        ('classifier', RandomForestClassifier(
            n_estimators=200,
            max_depth=None,
            min_samples_split=2,
            min_samples_leaf=1,
            max_features='sqrt',
            random_state=42,
            n_jobs=-1,  # Use all CPU cores
            class_weight='balanced'
        ))
    ])
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Train pipeline
    pipeline.fit(X_train, y_train)
    
    # Evaluate
    train_score = pipeline.score(X_train, y_train)
    test_score = pipeline.score(X_test, y_test)
    logger.info(f"Training accuracy: {train_score:.4f}")
    logger.info(f"Test accuracy: {test_score:.4f}")

    # Detailed classification metrics
    y_pred = pipeline.predict(X_test)
    report = classification_report(y_test, y_pred, digits=4)
    cm = confusion_matrix(y_test, y_pred)
    logger.info("Classification report:\n" + report)
    logger.info("Confusion matrix:\n" + str(cm))

    # Optimal threshold via Youden's J statistic on ROC curve (if proba available)
    optimal_threshold = 0.5
    if hasattr(pipeline.named_steps['classifier'], 'predict_proba'):
        probs = pipeline.predict_proba(X_test)[:, 1]
        fpr, tpr, thresholds = roc_curve(y_test, probs)
        j_scores = tpr - fpr
        if len(j_scores):
            j_idx = j_scores.argmax()
            optimal_threshold = float(thresholds[j_idx])
            logger.info(f"Selected optimal probability threshold (Youden J): {optimal_threshold:.4f}")
        else:
            logger.info("ROC curve empty; using default threshold 0.5")
    else:
        logger.info("Classifier lacks predict_proba; using default threshold 0.5")
    
    # Get feature importances
    if hasattr(pipeline.named_steps['classifier'], 'feature_importances_'):
        importances = pipeline.named_steps['classifier'].feature_importances_
        feature_imp = pd.DataFrame({
            'feature': X.columns,
            'importance': importances
        }).sort_values('importance', ascending=False)
        
        logger.info("\nTop 10 most important features:")
        logger.info(feature_imp.head(10))
        
        # Save feature importances
        feature_imp.to_csv('Dataset 1/feature_importances.csv', index=False)
        logger.info("Saved feature importances to Dataset 1/feature_importances.csv")
    
    return pipeline, optimal_threshold

def save_pipeline(pipeline, output_path='rf_pipeline.pkl'):
    """Save the trained pipeline to disk."""
    logger.info(f"Saving pipeline to {output_path}")
    joblib.dump(pipeline, output_path)
    logger.info("Pipeline saved successfully")

def main():
    try:
        # CLI args
        parser = argparse.ArgumentParser(description='Train phishing detection pipeline')
        parser.add_argument('--csv', dest='csv_path', default='Dataset 1/dataset1.csv', help='Path to training CSV')
        parser.add_argument('--preserve-neg1', action='store_true', help='Keep -1 values instead of converting them to 0')
        parser.add_argument('--output-dir', default='.', help='Directory where rf_pipeline.pkl and model_config.json will be saved')
        args = parser.parse_args()

        # Load and prepare data
        X, y = load_and_prepare_data(args.csv_path, preserve_neg1=args.preserve_neg1)

        # Train pipeline
        pipeline, optimal_threshold = create_and_train_pipeline(X, y)

        # Determine output paths
        import os
        output_dir = args.output_dir
        os.makedirs(output_dir, exist_ok=True)
        pipeline_path = os.path.join(output_dir, 'rf_pipeline.pkl')
        config_path = os.path.join(output_dir, 'model_config.json')

        # Save pipeline
        save_pipeline(pipeline, pipeline_path)

        # Persist threshold to config
        config = {"phishing_threshold": float(optimal_threshold), "generated_at": datetime.now().isoformat()}
        import json
        with open(config_path, 'w', encoding='utf-8') as cf:
            json.dump(config, cf, indent=2)
        logger.info(f"Saved model_config.json with threshold {optimal_threshold:.4f}")

        logger.info("Training completed successfully!")

    except Exception as e:
        logger.error(f"Error during training: {str(e)}")
        raise

if __name__ == "__main__":
    main()

# ---------------- Helper Functions -----------------
def normalize_feature_values(df: pd.DataFrame) -> pd.DataFrame:
    """Convert -1 values to 0 for binary / tri-state features.
    Heuristic: If column unique set ⊆ {-1,0,1} and contains -1, map -1→0.
    Returns a new DataFrame.
    """
    df_norm = df.copy()
    changed = []
    for col in df_norm.columns:
        uniques = set(df_norm[col].dropna().unique().tolist())
        if uniques.issubset({-1,0,1}) and -1 in uniques:
            df_norm[col] = df_norm[col].replace(-1,0)
            changed.append(col)
    if changed:
        logger.info("Normalized -1→0 for: " + ", ".join(changed))
    else:
        logger.info("No -1→0 normalization needed.")
    return df_norm