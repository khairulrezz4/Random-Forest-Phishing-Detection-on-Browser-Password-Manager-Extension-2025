# server.py
# Tarun Tiwari's Machine Learning - Phishing Detection Server
# ============================================================

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import os
import re
import tldextract
import numpy as np
import pandas as pd
from urllib.parse import urlparse
# import whois  # Conditionally imported only when FAST_EXTRACT is off
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import socket
import threading
from collections import OrderedDict
from typing import Dict, Tuple, Any
import logging
import json

# Import the SAME feature extractor used in training (Tarun Tiwari's ML Pipeline)
from pipeline_phishing import extract_url_features as pipeline_extract_features

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Suppress noisy whois library connection errors
logging.getLogger('whois.whois').setLevel(logging.CRITICAL)

# Load model configuration (threshold, etc.) if available (after logger init)
CONFIG_PATH = "model_config.json"
MODEL_CONFIG = {}
PHISHING_THRESHOLD = 0.5
if os.path.exists(CONFIG_PATH):
    try:
        with open(CONFIG_PATH, 'r', encoding='utf-8') as cf:
            MODEL_CONFIG = json.load(cf)
        PHISHING_THRESHOLD = float(MODEL_CONFIG.get('phishing_threshold', 0.5))
        logger.info(f"Loaded model_config.json (threshold={PHISHING_THRESHOLD:.4f})")
    except Exception as e:
        logger.warning(f"Failed to read model_config.json: {e}")
else:
    logger.info("No model_config.json found; using default threshold 0.5")

app = Flask(__name__)
CORS(app)  # Enable CORS for the extension to make requests

# Simple thread-safe LRU cache for recent predictions
class PredictionCache:
    def __init__(self, max_size: int = 1000):
        self.cache: OrderedDict = OrderedDict()
        self.max_size = max_size
        self.lock = threading.Lock()
        self.ttl = timedelta(minutes=30)  # Cache entries expire after 30 minutes
        
    def get(self, url: str) -> Dict[str, Any]:
        with self.lock:
            if url in self.cache:
                timestamp, data = self.cache[url]
                if datetime.now() - timestamp < self.ttl:
                    self.cache.move_to_end(url)
                    return data
                else:
                    del self.cache[url]
            return None
            
    def put(self, url: str, data: Dict[str, Any]) -> None:
        with self.lock:
            if url in self.cache:
                del self.cache[url]
            self.cache[url] = (datetime.now(), data)
            if len(self.cache) > self.max_size:
                self.cache.popitem(last=False)

# Initialize cache
prediction_cache = PredictionCache()

# Try to load new pipeline_phishing.py model format first (preferred)
# Format: pickle dict with keys: 'model', 'scaler', 'features'
MODEL_BUNDLE_CANDIDATES = [
    "model.pkl",
    "model_v1.pkl",
]

# Legacy pipeline/model candidates
PIPELINE_CANDIDATES = [
    "rf_pipeline.pkl",
    "pipeline.pkl",
    "rf_pipeline.joblib",
    "pipeline.joblib",
]

# Primary objects: `pipeline` (full sklearn pipeline) or `model` (estimator)
pipeline = None
model = None
scaler = None  # New: StandardScaler from model bundle
model_features = None  # New: ordered feature list from model bundle

loaded_path = None

# Try new model bundle format first
for p in MODEL_BUNDLE_CANDIDATES:
    if os.path.exists(p):
        try:
            import pickle
            with open(p, 'rb') as f:
                bundle = pickle.load(f)
            if isinstance(bundle, dict) and 'model' in bundle:
                model = bundle['model']
                scaler = bundle.get('scaler')
                model_features = bundle.get('features')
                loaded_path = p
                logger.info(f"✓ Loaded model bundle: {p} (features={len(model_features) if model_features else 'unknown'})")
                break
        except Exception as e:
            logger.warning(f"Failed to load model bundle {p}: {e}")

# If no bundle found, try legacy pipeline format
if model is None:
    for p in PIPELINE_CANDIDATES:
        if os.path.exists(p):
            try:
                pipeline = joblib.load(p)
                loaded_path = p
                logger.info(f"✓ Loaded pipeline: {p}")
                break
            except Exception as e:
                logger.warning(f"Failed to load pipeline candidate {p}: {e}")

# If no pipeline found, try the old model path
if pipeline is None and model is None:
    MODEL_PATH = "rf_phishing_model.pkl"
    if os.path.exists(MODEL_PATH):
        try:
            model = joblib.load(MODEL_PATH)
            loaded_path = MODEL_PATH
            logger.info(f"✓ Loaded model: {MODEL_PATH}")
        except Exception as e:
            logger.error(f"✗ Failed to load model: {str(e)}")
            model = None
    else:
        logger.info("No pipeline or model file found in ML folder; server will use extractor-only mode.")

# If the model/pipeline provides feature names (sklearn >=1.0), capture them so we can
# ensure our extractor returns the same named columns in the same order.
MODEL_FEATURE_NAMES = None

# Prefer model_features from bundle if available
if model_features is not None:
    MODEL_FEATURE_NAMES = list(model_features)
    logger.info(f"Using model bundle feature names ({len(MODEL_FEATURE_NAMES)}): {MODEL_FEATURE_NAMES[:5]}...")
# If we loaded a pipeline, try to get feature names from final estimator
elif pipeline is not None:
    try:
        # pipeline may be a sklearn Pipeline; try to get feature names from final estimator
        if hasattr(pipeline, 'feature_names_in_'):
            MODEL_FEATURE_NAMES = list(pipeline.feature_names_in_)
        elif hasattr(pipeline, 'steps'):
            final = pipeline.steps[-1][1]
            if hasattr(final, 'feature_names_in_'):
                MODEL_FEATURE_NAMES = list(final.feature_names_in_)
        if MODEL_FEATURE_NAMES:
            logger.info(f"Pipeline feature names loaded ({len(MODEL_FEATURE_NAMES)})")
    except Exception:
        MODEL_FEATURE_NAMES = None

elif model is not None:
    # Try common locations for feature names on a raw model
    if hasattr(model, 'feature_names_in_'):
        try:
            MODEL_FEATURE_NAMES = list(model.feature_names_in_)
            logger.info(f"Model feature names loaded ({len(MODEL_FEATURE_NAMES)}): {MODEL_FEATURE_NAMES[:10]}...")
        except Exception:
            MODEL_FEATURE_NAMES = None
    elif hasattr(model, 'steps'):
        try:
            final = model.steps[-1][1]
            if hasattr(final, 'feature_names_in_'):
                MODEL_FEATURE_NAMES = list(final.feature_names_in_)
                logger.info(f"Pipeline final estimator feature names loaded ({len(MODEL_FEATURE_NAMES)})")
        except Exception:
            MODEL_FEATURE_NAMES = None

if MODEL_FEATURE_NAMES is None:
    logger.info("No explicit model/pipeline feature names found; will rely on extractor's default order.")

# FEATURE EXTRACTOR
# Uses the SAME feature extraction as pipeline_phishing.py for consistency
def extract_features_from_url(url):
    """Extract features using the pipeline's feature extractor.
    Returns a DataFrame with one row.
    """
    try:
        # Use the same extractor that was used during training
        features = pipeline_extract_features(url)
        df = pd.DataFrame([features])
        return df
    except Exception as e:
        logger.error(f"Error extracting features from {url}: {e}")
        return pd.DataFrame([{}])


@app.route("/predict_url", methods=["POST"])
def predict_url():
    """Predict whether a URL is phishing or legitimate."""
    try:
        data = request.get_json() or {}
        url = data.get("url") or data.get("u") or ""
        if not url:
            return jsonify({"error": "no_url_provided"}), 400
            
        # Check cache first
        cached = prediction_cache.get(url)
        if cached:
            logger.info(f"Cache hit for {url}")
            return jsonify(cached)
            
        # Normalize URL
        if not url.startswith(('http://', 'https://')):
            url = 'http://' + url
            
        # Extract features
        logger.info(f"Extracting features for {url}")
        X = extract_features_from_url(url)

        # If the model expects specific feature names, align our DataFrame to it
        if MODEL_FEATURE_NAMES is not None:
            # add missing columns with default 0
            missing = [c for c in MODEL_FEATURE_NAMES if c not in X.columns]
            if missing:
                logger.warning(f"Adding missing feature columns before prediction: {missing}")
                for m in missing:
                    X[m] = 0
            # drop any unexpected columns that model doesn't expect
            extra = [c for c in X.columns if c not in MODEL_FEATURE_NAMES]
            if extra:
                logger.warning(f"Dropping unexpected extractor columns before prediction: {extra}")
                X = X.drop(columns=extra)
            # reorder to match model
            X = X[MODEL_FEATURE_NAMES]
        
        # Choose active predictor: prefer pipeline if available, else raw model
        active = pipeline if pipeline is not None else model
        if active is None:
            raise ValueError("No model or pipeline loaded for prediction")

        pred = None
        prob = None

        # Apply scaler if model bundle provided one
        X_input = X
        if scaler is not None:
            try:
                X_scaled = scaler.transform(X)
                X_input = pd.DataFrame(X_scaled, columns=X.columns)
                logger.debug("Applied scaler from model bundle")
            except Exception as e:
                logger.warning(f"Scaler transform failed: {e}; using raw features")

        # Try predicting with the loaded pipeline/model. If pipeline fails, fall back to raw model.
        try:
            # Many pipelines accept a DataFrame of features; attempt that first.
            pred = active.predict(X_input)[0]
            # predict_proba may be on the pipeline or final estimator
            if hasattr(active, "predict_proba"):
                probs = active.predict_proba(X_input)[0]
                prob = probs[1]
            else:
                # try final estimator inside a pipeline
                if hasattr(active, 'steps'):
                    final = active.steps[-1][1]
                    if hasattr(final, 'predict_proba'):
                        probs = final.predict_proba(X_input)[0]
                        prob = probs[1]

        except Exception as e:
            logger.warning(f"Primary predictor failed: {e}")
            # If we tried a pipeline and it failed, but a raw model is available, try it
            if pipeline is not None and model is not None:
                try:
                    pred = model.predict(X_input)[0]
                    if hasattr(model, 'predict_proba'):
                        probs = model.predict_proba(X_input)[0]
                        prob = probs[1]
                except Exception as e2:
                    logger.error(f"Fallback model prediction also failed: {e2}")
                    raise
            else:
                raise

        # Prepare response with feature importance if available
        # Determine label using probability threshold if available
        phishing_label = None
        if prob is not None:
            phishing_label = "phishing" if prob >= PHISHING_THRESHOLD else "legitimate"
        else:
            phishing_label = "phishing" if int(pred) == 1 else "legitimate"

        result = {
            "url": url,
            "prediction": int(pred),  # original model class
            "probability": float(prob) if prob is not None else None,
            "phishing_label": phishing_label,
            "threshold": PHISHING_THRESHOLD,
            "features": X.iloc[0].to_dict(),
            "timestamp": datetime.now().isoformat()
        }

        # Add feature importance if available (try pipeline final estimator then model)
        try:
            final_estimator = None
            if pipeline is not None and hasattr(pipeline, 'steps'):
                final_estimator = pipeline.steps[-1][1]
            elif model is not None:
                final_estimator = model

            if final_estimator is not None and hasattr(final_estimator, 'feature_importances_'):
                importance = dict(zip(X.columns, final_estimator.feature_importances_))
                top_features = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True)[:5])
                result["feature_importance"] = top_features
        except Exception:
            # non-fatal
            pass

        # Cache the result
        prediction_cache.put(url, result)

        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error processing {url if url else 'unknown URL'}: {str(e)}")
        return jsonify({
            "error": "prediction_failed",
            "detail": str(e),
            "url": url if url else None
        }), 500

@app.route("/predict_batch", methods=["POST"])
def predict_batch():
    """Predict multiple URLs in one request.
    Request body: {"urls": ["url1", "url2", ...]}
    Returns: {"results": [{prediction data}, ...]}
    """
    try:
        data = request.get_json() or {}
        urls = data.get("urls") or []
        if not urls or not isinstance(urls, list):
            return jsonify({"error": "urls array required"}), 400
        
        results = []
        for url in urls[:100]:  # Limit to 100 URLs per batch
            try:
                # Check cache
                cached = prediction_cache.get(url)
                if cached:
                    results.append(cached)
                    continue
                
                # Normalize
                if not url.startswith(('http://', 'https://')):
                    url = 'http://' + url
                
                # Extract features
                X = extract_features_from_url(url)
                
                # Align to model features
                if MODEL_FEATURE_NAMES is not None:
                    missing = [c for c in MODEL_FEATURE_NAMES if c not in X.columns]
                    for m in missing:
                        X[m] = 0
                    extra = [c for c in X.columns if c not in MODEL_FEATURE_NAMES]
                    if extra:
                        X = X.drop(columns=extra)
                    X = X[MODEL_FEATURE_NAMES]
                
                # Apply scaler
                X_input = X
                if scaler is not None:
                    try:
                        X_scaled = scaler.transform(X)
                        X_input = pd.DataFrame(X_scaled, columns=X.columns)
                    except Exception:
                        pass
                
                # Predict
                active = pipeline if pipeline is not None else model
                pred = active.predict(X_input)[0]
                prob = None
                if hasattr(active, "predict_proba"):
                    probs = active.predict_proba(X_input)[0]
                    prob = probs[1]
                
                phishing_label = "phishing" if (prob >= PHISHING_THRESHOLD if prob is not None else pred == 1) else "legitimate"
                
                result = {
                    "url": url,
                    "prediction": int(pred),
                    "probability": float(prob) if prob is not None else None,
                    "phishing_label": phishing_label,
                    "threshold": PHISHING_THRESHOLD
                }
                
                # Cache
                prediction_cache.put(url, result)
                results.append(result)
                
            except Exception as e:
                results.append({
                    "url": url,
                    "error": str(e)
                })
        
        return jsonify({"results": results, "count": len(results)})
        
    except Exception as e:
        logger.error(f"Batch prediction error: {str(e)}")
        return jsonify({"error": "batch_prediction_failed", "detail": str(e)}), 500

@app.route("/health")
def health_check():
    """Health check endpoint to verify model and server status."""
    active_predictor = pipeline if pipeline is not None else model
    feature_count = None
    
    if active_predictor is not None:
        if hasattr(active_predictor, 'n_features_in_'):
            feature_count = active_predictor.n_features_in_
        elif hasattr(active_predictor, 'steps') and hasattr(active_predictor.steps[-1][1], 'n_features_in_'):
            feature_count = active_predictor.steps[-1][1].n_features_in_
            
    status = {
        "status": "healthy" if active_predictor is not None else "degraded",
        "model_type": "pipeline" if pipeline is not None else "model" if model is not None else None,
        "model_loaded": active_predictor is not None,
        "model_bundle": loaded_path if (scaler is not None or model_features is not None) else None,
        "has_scaler": scaler is not None,
        "feature_count": feature_count,
        "feature_names": MODEL_FEATURE_NAMES[:10] if MODEL_FEATURE_NAMES else None,  # First 10 for brevity
        "cache_size": len(prediction_cache.cache),
        "cache_hits": sum(1 for _, (ts, _) in prediction_cache.cache.items() 
                         if datetime.now() - ts < prediction_cache.ttl),
        "phishing_threshold": PHISHING_THRESHOLD,
        "timestamp": datetime.now().isoformat()
    }
    return jsonify(status)

if __name__ == "__main__":
    # Add some startup logging
    logger.info("Starting phishing detection server...")
    logger.info(f"Cache size: {prediction_cache.max_size}")
    logger.info("Server ready at http://127.0.0.1:5000")
    
    app.run(host="127.0.0.1", port=5000, debug=False)
