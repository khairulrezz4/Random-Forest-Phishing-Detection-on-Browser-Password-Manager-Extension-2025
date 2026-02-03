"""Test openphish URLs against the model server"""
import requests
import json

# OpenPhish phishing URLs (first 30 for quick test)
urls = [
    'http://debabratasahoo21.github.io/my-website',
    'http://hltps-roblox.com/users/362105825/profile',
    'http://ipfs.io/ipfs/bafkreich4a73ormiypbok63qovboubzkqf4vektrjvsbpxyuse7v3cqv7a',
    'https://lnk.ink/www.robIox.com.share.code-a63b3ef3a83a45b47a0b65b8f58type-Server',
    'https://roblox.com.ge/games/16732694052/Fisch',
    'https://evelen.click/giris.php/',
    'http://evelen.click/giris.php',
    'https://correosparcelconnect.anconaresidencial.com/',
    'https://ecommerce-clone-ashy.vercel.app/',
    'https://robloxx.com.es/users/2024661089/profile',
    'http://dappconresolve.pages.dev/walletpage',
    'https://netflixpremium.vercel.app/',
    'http://dadhichvansh.github.io/netflix-landing-page-clone',
    'https://evliye.click/giris.php/',
    'http://mask-sign-inmeta2.godaddysites.com/',
    'http://mxx9090.net/',
    'http://fidelityworkplacegf.click/individual/page.html',
    'http://insta-pro.pk/',
    'https://magazineluisa.shop/',
    'http://acceder-service.webcindario.com/',
    'https://ultimasemanadofeirao.vercel.app/negocia99',
    'https://institutodasfeira.sbs/chat/',
    'https://consultavirtualonline.netlify.app/inicio/',
    'https://go.ly/roblox-com-users-3359394888-profiles',
    'https://www.robiox.com.am/users/3359394888/profile',
    'http://smtptelstrawebmailviewswiftwebmail.framer.website/',
    'https://krkenloin45.godaddysites.com/',
    'https://insta-clone-roan-five.vercel.app/',
    'http://coinbase-pros-en.framer.ai/',
    'https://wbmh22.top/',
]

results = {'phishing_detected': 0, 'false_negatives': 0, 'scores': []}
server_url = 'http://127.0.0.1:5000/predict_url'

print("Testing OpenPhish URLs against Dataset 3 model...\n")

for i, url in enumerate(urls, 1):
    try:
        resp = requests.post(server_url, json={'url': url}, timeout=10)
        data = resp.json()
        prob = data.get('probability', 0)
        label = data.get('phishing_label', 'unknown')
        results['scores'].append((url, prob, label))
        if label == 'phishing':
            results['phishing_detected'] += 1
        else:
            results['false_negatives'] += 1
        
        status = "[CAUGHT]" if label == 'phishing' else "[MISSED]"
        print(f"{i:2d}. {status} {prob:.4f} - {url[:70]}")
        
    except Exception as e:
        print(f"{i:2d}. [ERROR] {url[:70]} - {e}")

print(f'\n{"="*80}')
print(f'=== OPENPHISH URL TEST RESULTS ===')
print(f'{"="*80}')
print(f'Total tested: {len(results["scores"])}')
print(f'Detected as phishing: {results["phishing_detected"]}')
print(f'False negatives (missed): {results["false_negatives"]}')
detection_rate = 100 * results["phishing_detected"] / max(1, len(results["scores"]))
print(f'Detection rate: {results["phishing_detected"]}/{len(results["scores"])} = {detection_rate:.1f}%')
print(f'False negative rate: {100 - detection_rate:.1f}%')
print(f'{"="*80}')
