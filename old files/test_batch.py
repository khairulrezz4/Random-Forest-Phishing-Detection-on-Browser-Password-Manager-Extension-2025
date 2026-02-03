"""Test batch URL prediction endpoint"""
import requests
import json

# ============================================================================
# LEGITIMATE URLs (should be classified as safe)
# ============================================================================
legit_urls = [
    # Big tech companies
    "https://www.google.com",
    "https://www.microsoft.com",
    "https://www.apple.com",
    "https://www.amazon.com",
    "https://www.facebook.com",
    "https://www.twitter.com",
    "https://www.linkedin.com",
    "https://www.github.com",
    "https://www.netflix.com",
    "https://www.spotify.com",
    
    # Banks & Finance
    "https://www.paypal.com",
    "https://www.chase.com",
    "https://www.bankofamerica.com",
    "https://www.wellsfargo.com",
    
    # Popular services
    "https://www.whatsapp.com",
    "https://www.youtube.com",
    "https://www.instagram.com",
    "https://www.reddit.com",
    "https://www.wikipedia.org",
    "https://www.dropbox.com",
]

# ============================================================================
# PHISHING URLs (should be classified as phishing)
# ============================================================================
phishing_urls = [
    # Fake login pages
    "http://paypal-verify-account-12345.com/login",
    "http://secure-login-update.net/verify",
    "http://microsoft-security-update.xyz/confirm",
    "http://apple-id-verify.tk/account",
    "http://amazon-order-problem.ml/fix",
    
    # Suspicious patterns
    "http://192.168.1.100/wp-admin/login.php",
    "http://login-secure-bank.com/verify.php?id=12345",
    "http://update-your-account-now.net/secure",
    "http://free-iphone-winner.com/claim",
    "http://verify-your-identity-now.tk/submit",
    
    # IP-based URLs
    "http://45.33.32.156/login/paypal",
    "http://104.131.124.203/secure/bank",
    
    # Long suspicious URLs
    "http://accounts-google-com-signin-v2-identifier.suspicious-domain.net/login",
    "http://secure-paypal-com-update.phishing-site.xyz/verify/account",
    "http://www-facebook-com-login.fake-domain.ml/signin",
]

# Combine all URLs
test_urls = legit_urls + phishing_urls

server_url = 'http://127.0.0.1:5000/predict_batch'

print("Testing Batch URL Prediction")
print("=" * 80)

try:
    resp = requests.post(server_url, json={'urls': test_urls}, timeout=120)
    data = resp.json()
    
    if 'error' in data:
        print(f"Error: {data['error']}")
        print(f"Detail: {data.get('detail', 'N/A')}")
    else:
        results = data.get('results', [])
        print(f"Processed {data.get('count', 0)} URLs\n")
        
        # Separate results
        legit_count = len(legit_urls)
        
        print("=" * 80)
        print("LEGITIMATE URLs (Expected: 🟢 LEGIT)")
        print("=" * 80)
        correct_legit = 0
        for i, result in enumerate(results[:legit_count], 1):
            url = result.get('url', 'unknown')
            if 'error' in result:
                print(f"{i}. {url}")
                print(f"   ERROR: {result['error']}\n")
            else:
                label = result.get('phishing_label', 'unknown')
                prob = result.get('probability')
                prob_str = f"{prob:.4f} ({prob*100:.1f}%)" if prob is not None else "N/A"
                
                is_correct = label == "legitimate"
                if is_correct:
                    correct_legit += 1
                indicator = "🟢 LEGIT ✓" if is_correct else "🔴 PHISHING ✗ (FALSE POSITIVE)"
                print(f"{i:2d}. {indicator} | Prob: {prob_str}")
                print(f"    {url}\n")
        
        print("=" * 80)
        print("PHISHING URLs (Expected: 🔴 PHISHING)")
        print("=" * 80)
        correct_phish = 0
        for i, result in enumerate(results[legit_count:], 1):
            url = result.get('url', 'unknown')
            if 'error' in result:
                print(f"{i}. {url}")
                print(f"   ERROR: {result['error']}\n")
            else:
                label = result.get('phishing_label', 'unknown')
                prob = result.get('probability')
                prob_str = f"{prob:.4f} ({prob*100:.1f}%)" if prob is not None else "N/A"
                
                is_correct = label == "phishing"
                if is_correct:
                    correct_phish += 1
                indicator = "🔴 PHISHING ✓" if is_correct else "🟢 LEGIT ✗ (FALSE NEGATIVE)"
                print(f"{i:2d}. {indicator} | Prob: {prob_str}")
                print(f"    {url}\n")
        
        # Summary
        print("=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Legitimate URLs: {correct_legit}/{len(legit_urls)} correct ({correct_legit/len(legit_urls)*100:.1f}%)")
        print(f"Phishing URLs:   {correct_phish}/{len(phishing_urls)} correct ({correct_phish/len(phishing_urls)*100:.1f}%)")
        total_correct = correct_legit + correct_phish
        total = len(test_urls)
        print(f"Overall:         {total_correct}/{total} correct ({total_correct/total*100:.1f}%)")
    
    print("=" * 80)
    
except requests.exceptions.ConnectionError:
    print("Error: Could not connect to server at http://127.0.0.1:5000")
    print("Make sure to start the server first: python ML/server.py")
except Exception as e:
    print(f"Error: {e}")
