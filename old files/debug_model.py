"""Debug why model flags legitimate URLs as phishing"""
import pickle
import numpy as np
import pandas as pd
import sys
sys.path.insert(0, '.')
from pipeline_phishing import extract_url_features

with open('model.pkl', 'rb') as f:
    bundle = pickle.load(f)

model = bundle['model']
scaler = bundle['scaler']
features = bundle['features']

print("Features used:", features)
print()

# Check what the training data looked like
df = pd.read_csv('../phishing_site_urls_clean.csv')
good_urls = df[df['Label'] == 'good']['URL'].head(20).tolist()

print('='*70)
print('GOOD URLs from training data (what model learned as legitimate):')
print('='*70)
for url in good_urls[:10]:
    feat = extract_url_features(url)
    X = pd.DataFrame([[feat[f] for f in features]], columns=features)
    X_scaled = scaler.transform(X)
    prob = model.predict_proba(X_scaled)[0][1]
    status = 'PHISH!' if prob > 0.5 else 'OK'
    print(f'  [{status:6}] {prob:5.1%} | len={feat["url_length"]:3} | {url[:55]}')

print()
print('='*70)
print('Simple test URLs (what we expect to be legitimate):')
print('='*70)
test = [
    'https://www.google.com',
    'https://www.microsoft.com', 
    'https://www.amazon.com',
    'www.google.com',
    'google.com',
]
for url in test:
    feat = extract_url_features(url)
    X = pd.DataFrame([[feat[f] for f in features]], columns=features)
    X_scaled = scaler.transform(X)
    prob = model.predict_proba(X_scaled)[0][1]
    status = 'PHISH!' if prob > 0.5 else 'OK'
    print(f'  [{status:6}] {prob:5.1%} | len={feat["url_length"]:3} | {url}')

print()
print('='*70)
print('Feature comparison:')
print('='*70)
# Compare features of a training "good" URL vs google.com
train_good = good_urls[0]
test_url = 'https://www.google.com'

feat_train = extract_url_features(train_good)
feat_test = extract_url_features(test_url)

print(f'\nTraining GOOD: {train_good[:60]}')
print(f'Test URL:      {test_url}')
print()
print(f'{"Feature":<25} {"Training":>12} {"Test":>12} {"Diff":>10}')
print('-'*60)
for f in features:
    t_val = feat_train[f]
    test_val = feat_test[f]
    diff = test_val - t_val if isinstance(t_val, (int, float)) else ''
    print(f'{f:<25} {str(t_val):>12} {str(test_val):>12} {str(diff):>10}')
