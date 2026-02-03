import requests

urls = [
    'https://anyviewer.com/',
    'https://chatgpt.com/',
    'https://login.live.com/',
    'https://web.whatsapp.com/',
    'https://azure.microsoft.com/',
    'https://web.telegram.org/',
    'https://esp32io.com/',
    'https://github.com/',
    'https://google.com/',
    'https://facebook.com/',
]

print("\n" + "="*60)
print("PHISHING DETECTION RESULTS")
print("="*60)

for url in urls:
    try:
        resp = requests.post('http://127.0.0.1:5000/predict_url', json={'url': url})
        data = resp.json()
        prob = data.get('phishing_probability', 0) * 100
        is_phishing = data.get('is_phishing', False)
        status = "🚫 PHISHING" if is_phishing else "✓ LEGIT"
        domain = url.split('/')[2]
        print(f"{domain:30} {prob:6.1f}%  {status}")
    except Exception as e:
        print(f"{url}: ERROR - {e}")

print("="*60)
