"""Add simple homepage URLs from top domains to the training dataset"""
import pandas as pd

# Load cleaned dataset
df = pd.read_csv('../phishing_site_urls_clean.csv')
print(f"Original dataset: {len(df)} rows")
print(f"  Good: {len(df[df['Label'] == 'good'])}")
print(f"  Bad:  {len(df[df['Label'] == 'bad'])}")

# Top legitimate domains (Tranco/Alexa top sites)
top_domains = [
    # Search/Tech
    "google.com", "bing.com", "yahoo.com", "duckduckgo.com",
    "microsoft.com", "apple.com", "amazon.com", "netflix.com",
    "github.com", "stackoverflow.com", "gitlab.com",
    
    # Social
    "facebook.com", "twitter.com", "instagram.com", "linkedin.com",
    "reddit.com", "pinterest.com", "tumblr.com", "tiktok.com",
    "whatsapp.com", "telegram.org", "discord.com",
    
    # Video/Media
    "youtube.com", "twitch.tv", "spotify.com", "soundcloud.com",
    "vimeo.com", "dailymotion.com",
    
    # Shopping
    "ebay.com", "walmart.com", "target.com", "bestbuy.com",
    "etsy.com", "shopify.com", "aliexpress.com",
    
    # Finance
    "paypal.com", "chase.com", "bankofamerica.com", "wellsfargo.com",
    "capitalone.com", "americanexpress.com", "visa.com", "mastercard.com",
    
    # News
    "cnn.com", "bbc.com", "nytimes.com", "washingtonpost.com",
    "reuters.com", "theguardian.com", "forbes.com", "bloomberg.com",
    
    # Education
    "wikipedia.org", "khanacademy.org", "coursera.org", "udemy.com",
    "edx.org", "mit.edu", "stanford.edu", "harvard.edu",
    
    # Cloud/Services
    "dropbox.com", "box.com", "icloud.com", "drive.google.com",
    "zoom.us", "slack.com", "notion.so", "trello.com",
    
    # Email
    "gmail.com", "outlook.com", "mail.google.com", "protonmail.com",
    
    # Other popular
    "adobe.com", "wordpress.com", "medium.com", "quora.com",
    "imdb.com", "yelp.com", "tripadvisor.com", "airbnb.com",
    "uber.com", "lyft.com", "doordash.com", "grubhub.com",
]

# Generate variations for each domain
new_urls = []
for domain in top_domains:
    # Basic variations
    variations = [
        domain,
        f"www.{domain}",
        f"https://{domain}",
        f"https://www.{domain}",
        f"http://{domain}",
        f"http://www.{domain}",
        f"https://{domain}/",
        f"https://www.{domain}/",
    ]
    new_urls.extend(variations)

# Create dataframe with new legitimate URLs
new_df = pd.DataFrame({
    'URL': new_urls,
    'Label': 'good'
})

# Remove duplicates from new URLs
new_df = new_df.drop_duplicates(subset=['URL'])
print(f"\nAdding {len(new_df)} new legitimate homepage URLs")

# Combine with original dataset
combined = pd.concat([df, new_df], ignore_index=True)

# Remove any duplicates
combined = combined.drop_duplicates(subset=['URL'])

print(f"\nCombined dataset: {len(combined)} rows")
print(f"  Good: {len(combined[combined['Label'] == 'good'])}")
print(f"  Bad:  {len(combined[combined['Label'] == 'bad'])}")

# Save
combined.to_csv('../tarun_tiwari_dataset.csv', index=False)
print("\nSaved to: tarun_tiwari_dataset.csv (Tarun Tiwari's Dataset)")

# Verify
print("\nSample of new URLs added:")
for url in new_urls[:10]:
    print(f"  {url}")
