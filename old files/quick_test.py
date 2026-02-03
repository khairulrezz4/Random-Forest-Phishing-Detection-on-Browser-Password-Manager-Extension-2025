import requests
r = requests.post('http://127.0.0.1:5000/predict_url', json={'url': 'https://dadhichvansh.github.io/netflix-landing-page-clone/'})
d = r.json()
print(f"Label: {d['phishing_label']}")
print(f"Probability: {d['probability']}")
print(f"Threshold: {d['threshold']}")
