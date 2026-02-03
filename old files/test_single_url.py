"""Test a single URL and show detailed feature analysis"""
import requests
import json
import sys

url_to_test = sys.argv[1] if len(sys.argv) > 1 else 'http://dadhichvansh.github.io/netflix-landing-page-clone'
server_url = 'http://127.0.0.1:5000/predict_url'

print(f"Testing URL: {url_to_test}\n")
print("=" * 80)

try:
    resp = requests.post(server_url, json={'url': url_to_test}, timeout=15)
    data = resp.json()
    
    if 'error' in data:
        print(f"Error: {data['error']}")
        print(f"Detail: {data.get('detail', 'N/A')}")
        sys.exit(1)
    
    prob = data.get('probability')
    if prob is not None:
        print(f"Phishing Probability: {prob:.4f} ({prob*100:.2f}%)")
    print(f"Classification: {data['phishing_label'].upper()}")
    print(f"Threshold: {data['threshold']}")
    print(f"Prediction: {data['prediction']} (0=legit, 1=phishing)")
    
    if 'feature_importance' in data and data['feature_importance']:
        print(f"\nTop Feature Importances:")
        print("-" * 80)
        features = data['feature_importance']
        if isinstance(features, dict):
            for i, (feature, importance) in enumerate(features.items(), 1):
                print(f"{i:2}. {feature:35} {importance:8.5f}")
        elif isinstance(features, list):
            for i, (feature, importance) in enumerate(features[:15], 1):
                print(f"{i:2}. {feature:35} {importance:8.5f}")
    
    # Show some extracted features
    if 'features' in data:
        print(f"\nSample Extracted Features:")
        print("-" * 80)
        feat_subset = {k: v for i, (k, v) in enumerate(data['features'].items()) if i < 10}
        for k, v in feat_subset.items():
            print(f"  {k:35} {v}")
    
    print("=" * 80)
    
except requests.exceptions.ConnectionError:
    print("Error: Could not connect to server at http://127.0.0.1:5000")
    print("Make sure to start the server first: python ML/server.py")
except Exception as e:
    print(f"Error: {e}")
