"""
Test phishing detection on live OpenPhish URLs using the local server's /predict_batch endpoint.
"""
import requests

OPENPHISH_FEED = "https://openphish.com/feed.txt"
SERVER_URL = "http://127.0.0.1:5000/predict_batch"
BATCH_SIZE = 50  # Number of URLs per request (server default is 100 max)


def fetch_openphish_urls():
    resp = requests.get(OPENPHISH_FEED, timeout=30)
    resp.raise_for_status()
    urls = [line.strip() for line in resp.text.splitlines() if line.strip()]
    return urls

def batch_predict(urls):
    results = []
    for i in range(0, len(urls), BATCH_SIZE):
        batch = urls[i:i+BATCH_SIZE]
        try:
            resp = requests.post(SERVER_URL, json={"urls": batch}, timeout=60)
            data = resp.json()
            if "results" in data:
                results.extend(data["results"])
            else:
                print(f"Batch {i//BATCH_SIZE+1}: Error: {data}")
        except Exception as e:
            print(f"Batch {i//BATCH_SIZE+1}: Exception: {e}")
    return results

def main():
    print("Fetching OpenPhish URLs...")
    urls = fetch_openphish_urls()
    print(f"Fetched {len(urls)} URLs from OpenPhish.")
    if not urls:
        print("No URLs to test.")
        return
    print("Testing URLs against local phishing detection server...")
    results = batch_predict(urls)
    print(f"Tested {len(results)} URLs.")
    # Count how many were detected as phishing
    detected = sum(1 for r in results if r.get("phishing_label") == "phishing")
    print(f"Detected as phishing: {detected}/{len(results)} ({(detected/len(results))*100:.1f}%)")
    # Optionally, print false negatives
    false_negatives = [r["url"] for r in results if r.get("phishing_label") != "phishing"]
    if false_negatives:
        print("False negatives (not detected as phishing):")
        for url in false_negatives[:10]:
            print("  ", url)
        if len(false_negatives) > 10:
            print(f"  ...and {len(false_negatives)-10} more.")

if __name__ == "__main__":
    main()
