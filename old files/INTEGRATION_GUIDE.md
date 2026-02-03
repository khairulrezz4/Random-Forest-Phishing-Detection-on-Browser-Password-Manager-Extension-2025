# Extension Integration Guide

## Overview
This guide shows how to integrate the phishing detection model into your password manager extension (`rf-password-manager`).

## Architecture
```
Extension (background.js) → Flask Server (ML/server.py) → Model (model.pkl)
```

## 1. Server Setup

### Start the Flask Server
```powershell
cd ML
python server.py
```
Server runs at `http://127.0.0.1:5000`

### Verify Server Health
```powershell
curl http://127.0.0.1:5000/health
```

Expected response:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_bundle": "model.pkl",
  "has_scaler": true,
  "feature_count": 12,
  "phishing_threshold": 0.5
}
```

## 2. Extension Integration

### Option A: Update background.js (Recommended)

Add phishing check function to `rf-password-manager/public/background.js`:

```javascript
// Phishing detection function
async function checkPhishingRisk(url, tabId) {
  try {
    const response = await fetch('http://127.0.0.1:5000/predict_url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    });
    
    const data = await response.json();
    
    // Store result
    phishingState[tabId] = {
      status: data.phishing_label,
      probability: data.probability,
      timestamp: Date.now()
    };
    
    // Update badge
    setBadge(tabId, computeTabLogin(tabId));
    
    // Optional: warn user if high risk
    if (data.phishing_label === 'phishing' && data.probability > 0.7) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Phishing Warning',
        message: `This site may be a phishing attempt (${(data.probability*100).toFixed(1)}% confidence)`
      });
    }
    
    return data;
  } catch (error) {
    console.error('Phishing check failed:', error);
    return null;
  }
}
```

### Trigger Check on Tab Update

Add to existing `chrome.tabs.onUpdated` listener:

```javascript
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Existing login detection logic...
    
    // Add phishing check
    if (tab.url.startsWith('http')) {
      checkPhishingRisk(tab.url, tabId);
    }
  }
});
```

### Option B: Content Script Integration

Create new file `rf-password-manager/public/phishingCheck.js`:

```javascript
// Injected into pages to check URL before autofill
(async function() {
  const currentUrl = window.location.href;
  
  try {
    const response = await fetch('http://127.0.0.1:5000/predict_url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: currentUrl })
    });
    
    const data = await response.json();
    
    if (data.phishing_label === 'phishing' && data.probability > 0.5) {
      // Send warning to background script
      chrome.runtime.sendMessage({
        type: 'phishing-detected',
        url: currentUrl,
        probability: data.probability
      });
      
      // Show in-page warning
      const warning = document.createElement('div');
      warning.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0;
        background: #dc3545; color: white; padding: 12px;
        text-align: center; z-index: 999999; font-size: 14px;
      `;
      warning.textContent = `⚠️ Warning: This site may be a phishing attempt (${(data.probability*100).toFixed(0)}% confidence)`;
      document.body.prepend(warning);
    }
  } catch (error) {
    console.error('Phishing check error:', error);
  }
})();
```

Update `manifest.json` to inject:

```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["phishingCheck.js"],
      "run_at": "document_idle"
    }
  ]
}
```

## 3. Testing

### Test Single URL
```powershell
python ML/test_single_url.py https://example.com
```

### Test Batch URLs
```powershell
python ML/test_batch.py
```

### Test from Extension Console
Open extension background page console (chrome://extensions → Details → Inspect views: background page):

```javascript
// Test phishing check
checkPhishingRisk('http://paypal-verify-12345.com', chrome.tabs.TAB_ID);
```

## 4. Production Deployment

### Option 1: Local Server (Development)
- Keep Flask server running locally
- Extension connects to `http://127.0.0.1:5000`

### Option 2: Remote Server (Production)
1. Deploy Flask server to cloud (Heroku, AWS, etc.)
2. Update extension URL to `https://your-server.com/predict_url`
3. Enable CORS on server (already configured)

### Option 3: Embedded Model (Advanced)
- Convert model to TensorFlow.js or ONNX
- Run inference directly in extension (no server needed)
- Larger extension bundle size but no network dependency

## 5. Performance Optimization

### Caching
Server already implements 30-minute cache. Extension can add local cache:

```javascript
const phishingCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function getCachedPhishingCheck(url) {
  const cached = phishingCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await checkPhishingRisk(url);
  phishingCache.set(url, { data, timestamp: Date.now() });
  return data;
}
```

### Batch Checking
Check multiple URLs at once:

```javascript
async function checkMultipleUrls(urls) {
  const response = await fetch('http://127.0.0.1:5000/predict_batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls: urls })
  });
  return await response.json();
}
```

## 6. User Privacy

- All processing happens locally (if server is local)
- No URLs sent to third parties
- No logging of user browsing history
- Cache is in-memory only (clears on restart)

## 7. Troubleshooting

### Server not responding
```powershell
# Check if server is running
curl http://127.0.0.1:5000/health

# Restart server
python ML/server.py
```

### CORS errors
Server already has CORS enabled via `flask-cors`. If issues persist:
```python
# In server.py, verify:
from flask_cors import CORS
CORS(app)
```

### Model not loaded
```powershell
# Verify model.pkl exists
ls ML/model.pkl

# Check server logs for load errors
python ML/server.py
```

## 8. Next Steps

- Add confidence threshold slider in extension popup
- Implement whitelist for trusted domains
- Add user reporting for false positives
- Create dashboard showing blocked phishing attempts
- Implement automatic model updates

---
For questions or issues, check server logs and browser console for errors.
