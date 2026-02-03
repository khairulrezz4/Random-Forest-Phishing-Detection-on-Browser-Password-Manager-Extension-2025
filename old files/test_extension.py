"""Test extension endpoints with new PhishTank model"""
import requests
import json

print("="*80)
print("TESTING EXTENSION WITH NEW PHISHTANK MODEL")
print("="*80)

test_cases = [
    {
        'name': 'Microsoft OAuth (Legitimate)',
        'url': 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        'expected': 'legitimate'
    },
    {
        'name': 'Google OAuth (Legitimate)',
        'url': 'https://accounts.google.com/o/oauth2/v2/auth',
        'expected': 'legitimate'
    },
    {
        'name': 'Netflix Phishing Clone',
        'url': 'https://netflixpremium.vercel.app/',
        'expected': 'phishing'
    },
    {
        'name': 'Roblox Phishing',
        'url': 'http://hltps-roblox.com/users/362105825/profile',
        'expected': 'phishing'
    },
    {
        'name': 'GitHub (Legitimate)',
        'url': 'https://github.com/login',
        'expected': 'legitimate'
    },
    {
        'name': 'Coinbase Phishing',
        'url': 'http://coinbase-pros-en.framer.ai/',
        'expected': 'phishing'
    }
]

results = {'passed': 0, 'failed': 0}

for i, test in enumerate(test_cases, 1):
    print(f"\n{i}. Testing: {test['name']}")
    print(f"   URL: {test['url'][:60]}...")
    
    try:
        resp = requests.post('http://127.0.0.1:5000/predict_url', 
                            json={'url': test['url']}, 
                            timeout=10)
        data = resp.json()
        
        label = data['phishing_label']
        prob = data['probability']
        threshold = data['threshold']
        
        status = "✓ PASS" if label == test['expected'] else "✗ FAIL"
        results['passed' if label == test['expected'] else 'failed'] += 1
        
        print(f"   Result: {label.upper()} (prob={prob:.4f}, threshold={threshold})")
        print(f"   Expected: {test['expected'].upper()}")
        print(f"   {status}")
        
    except Exception as e:
        print(f"   ✗ ERROR: {e}")
        results['failed'] += 1

print(f"\n{'='*80}")
print(f"RESULTS: {results['passed']}/{len(test_cases)} tests passed")
print(f"{'='*80}")

if results['passed'] == len(test_cases):
    print("✅ ALL TESTS PASSED! Extension is ready to use.")
else:
    print(f"⚠️  {results['failed']} test(s) failed. Check configuration.")
