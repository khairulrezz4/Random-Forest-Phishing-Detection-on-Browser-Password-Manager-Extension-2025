.# TESTING EXECUTION GUIDE
## How to Perform Each Test in Chapter 5

---

## 1. FUNCTIONAL TESTING - Step by Step

### 1.1 PIN Authentication Tests (FT001-FT005)

**Tools Needed:**
- Chrome browser with Developer Mode on
- Extension loaded (unpacked)
- Chrome DevTools (F12)

#### Test FT001: First-time PIN Setup
```
STEPS:
1. Click extension icon → First time? Set your PIN
2. Enter "1234" in PIN field
3. Enter "1234" in Confirm PIN field
4. Click "Set PIN" button

VERIFY:
- ✅ PIN hash appears in chrome.storage.local (DevTools → Application → Storage → Local Storage)
- ✅ Next screen shows "Welcome to Vault"
- ✅ No errors in console (F12 → Console tab)
```

#### Test FT002: PIN Mismatch
```
STEPS:
1. Click extension again (new session or reload)
2. Enter "1234" in PIN field
3. Enter "5678" in Confirm PIN field  
4. Click "Set PIN"

VERIFY:
- ✅ Error message shows: "PINs do not match"
- ✅ Can retry PIN setup
- ✅ No data saved to storage
```

#### Test FT003: Correct PIN Verification
```
STEPS:
1. Go to any website
2. Click extension icon
3. PIN prompt appears
4. Enter correct PIN: "1234"
5. Click "Unlock"

VERIFY:
- ✅ Vault page appears with any stored credentials
- ✅ No errors in console
- ✅ Access granted immediately
```

#### Test FT004: Wrong PIN
```
STEPS:
1. PIN prompt appears
2. Enter wrong PIN: "0000"
3. Click "Unlock"

VERIFY:
- ✅ Error shows: "Incorrect PIN. Attempt 1/5"
- ✅ Counter increments on each wrong attempt
- ✅ Stays on PIN prompt (no access granted)
```

#### Test FT005: Lockout After 5 Failed Attempts
```
STEPS:
1. Enter wrong PIN 5 times consecutively
2. On 5th attempt, click "Unlock"

VERIFY:
- ✅ Error shows: "Too many attempts. Locked for 15 minutes"
- ✅ "Unlock" button becomes disabled
- ✅ Timer countdown visible
- ✅ Cannot access vault for 15 minutes
```

---

### 1.2 Credential Management Tests (FT006-FT010)

#### Test FT006: Add New Credential
```
STEPS:
1. Unlock vault with PIN
2. Click "Add Password" button
3. Enter:
   - Domain: gmail.com
   - Username: test@gmail.com
   - Password: pwd123
4. Click "Save"

VERIFY:
- ✅ Phishing check runs (wait 1-2 seconds)
- ✅ Green badge shows: "Safe (0.08)"
- ✅ Click "Save" button
- ✅ Credential appears in vault list
- ✅ Vault count increases (+1)
```

#### Test FT007: View Credential (Decrypt)
```
STEPS:
1. Unlock vault
2. Click on stored "gmail.com" credential

VERIFY:
- ✅ Popup/modal shows:
   - Domain: gmail.com
   - Username: test@gmail.com
   - Password: (masked as dots ●●●●●)
- ✅ All fields display correctly
- ✅ Click outside to close
```

#### Test FT008: Copy to Clipboard
```
STEPS:
1. Open credential detail
2. Click "Copy" button next to username

VERIFY:
- ✅ No visual feedback (silent copy)
- ✅ Open any text editor
- ✅ Ctrl+V (or Cmd+V on Mac)
- ✅ Pasted value = "test@gmail.com"
```

#### Test FT009: Delete Credential
```
STEPS:
1. Open credential detail
2. Click "Delete" button
3. Confirm deletion

VERIFY:
- ✅ Confirmation dialog appears
- ✅ After confirm, credential gone from vault
- ✅ Vault count decreases (-1)
```

#### Test FT010: Reveal Password
```
STEPS:
1. Open credential detail
2. Click "Show Password" button
3. Password visible for 10 seconds
4. Wait...

VERIFY:
- ✅ Password shows in plaintext: "pwd123"
- ✅ After ~10 seconds, auto-hides to dots
- ✅ Can click again to show again
```

---

### 1.3 Phishing Detection in Workflow (FT011-FT015)

#### Test FT011: Phishing Warning on Save
```
STEPS:
1. Click "Add Password"
2. Enter Domain: paypa1.com (typo phishing)
3. Enter Username: attacker@test.com
4. Enter Password: password123
5. Wait for phishing check...

VERIFY:
- ✅ Red badge appears: "🛑 Phishing Detected (92%)"
- ✅ Warning message shows
- ✅ "Save" button still clickable
- ✅ User must click "Save" to confirm
```

#### Test FT012: Safe Site Confirmation
```
STEPS:
1. Click "Add Password"
2. Enter Domain: google.com
3. Wait for phishing check...

VERIFY:
- ✅ Green badge appears: "✅ Safe (0.08)"
- ✅ No warning
- ✅ "Save" button is prominent
```

#### Test FT013: Risk Indicator Colors
```
STEPS:
1. Add credentials for different sites:
   - google.com (safe)
   - paypa1.com (phishing)
   - suspicious-bank.tk (warning)
2. View vault list

VERIFY:
- ✅ google.com shows GREEN badge
- ✅ paypa1.com shows RED badge
- ✅ suspicious-bank.tk shows YELLOW badge
```

#### Test FT014: Auto-fill Prevention on Phishing
```
STEPS:
1. Visit: paypa1.com in browser
2. Scroll to login form
3. Click on username field
4. Extension shows dropdown

VERIFY:
- ✅ Dropdown appears with credentials list
- ✅ paypa1.com credentials are NOT suggested
- ✅ Other credentials not suggested
- ✅ Dropdown is empty or shows warning
```

#### Test FT015: Login Form Detection
```
STEPS:
1. Visit: google.com
2. Search for login link, go to accounts.google.com
3. Look at extension icon

VERIFY:
- ✅ Extension shows badge indicator
- ✅ Badge changes color based on risk
- ✅ Clicking badge shows site info
```

---

## 2. SECURITY TESTING (CIA) - Step by Step

### 2.1 Confidentiality Testing (CONF001-CONF006)

**Prerequisites:**
- Extension loaded and unlocked
- Chrome DevTools (F12)
- At least one credential saved
- Flask server running (for CONF006)

#### Test CONF001: Credentials Stored Encrypted
```
STEPS:
1. Unlock extension and add a test credential:
   - Click extension icon
   - Enter PIN to unlock
   - Click "Add Password"
   - Fill in:
     * Domain: gmail.com
     * Username: test@gmail.com
     * Password: password123
   - Click "Save"

2. Open Chrome DevTools:
   - Press F12 (or right-click → Inspect)
   - Click "Application" tab (top menu)

3. Navigate to extension storage:
   - Left sidebar → Storage → Local Storage
   - Click on "chrome-extension://[your-extension-id]"
   - Look for key: "rf_creds"

4. Examine the stored value:
   - Click on "rf_creds" row
   - Look at the "Value" column
   - Expand the array to see credential objects

ACTUAL OBSERVED DATA FORMAT (from screenshot):
The credentials are stored as a JSON array with the following structure:

```json
[
  {
    "favicon": "https://cas.unikl.edu.my/favicon.ico",
    "id": 1765761299766,
    "domain": "https://cas.unikl.edu.my/cas-web/login",
    "event": "password_autofilled",
    "password": "saka12390",
    ...
  },
  {
    "favicon": "https://accounts.google.com/favicon.ico",
    "id": 1765761151471,
    "password": "sakai2390",
    ...
  }
]
```

VERIFY CURRENT STATE:
❌ **CRITICAL SECURITY ISSUE**: Credentials stored in PLAINTEXT
   - Password visible as: "saka12390", "sakai2390"
   - Domain visible as: "https://cas.unikl.edu.my/cas-web/login"
   - NO encryption applied to sensitive fields
   
⚠️ WHAT SHOULD BE SEEN (for PASS):
✅ Each credential should have encrypted fields:
   - "site": starts with "U2FsdGVk..." (base64 encoded)
   - "username": encrypted string
   - "password": encrypted string  
   - "iv": random hex string (16 bytes)
   
⚠️ CURRENT STATUS:
   - Encryption NOT implemented
   - All credential data readable in plaintext
   - Anyone with file system access can read passwords

EXAMPLE OF PROPER ENCRYPTED DATA (what it SHOULD look like):
{
  "id": 1702634567890,
  "site": "U2FsdGVkX1+vupppZksvRFY/xkwjShfNy8wd...",
  "username": "U2FsdGVkX19FzKAPL3K8yZGw4pB...",
  "password": "U2FsdGVkX1+vupppZksvRFY/xkwjShfNy8wd...",
  "iv": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "favicon": "https://gmail.com/favicon.ico"
}

TAKE SCREENSHOT: 
📸 Save this view showing storage format (plaintext or encrypted)
   File name: "CONF001_storage_format.png"

RESULT: 
❌ **FAIL** - Credentials stored in plaintext (NOT encrypted)
✅ **PASS** - Only if all sensitive fields are encrypted

**REMEDIATION REQUIRED:**
To fix this security vulnerability:
1. Implement AES-GCM encryption for credential storage
2. Use PBKDF2 to derive encryption key from PIN
3. Generate unique IV for each credential
4. Encrypt site, username, and password fields
5. Store only encrypted data + IV in chrome.storage.local

**SECURITY IMPACT:**
- High severity vulnerability
- Passwords accessible to anyone with file system access
- No protection against data extraction
- Fails confidentiality requirements
```

#### Test CONF002: PIN Stored as Hash
```
STEPS:
1. Ensure PIN is set up:
   - If first time, set PIN: 1234
   - If already set, note your PIN

2. Open Chrome DevTools (F12):
   - Go to Application tab
   - Left sidebar: Storage → Local Storage
   - Click extension ID

3. Find PIN storage:
   - Look for key: "rf_pin_hash" or "pinHash"
   - Click on that row
   - Examine the value

4. Verify hash characteristics:
   - Copy the hash value
   - Count characters (should be 64 characters)
   - Check format: hexadecimal (0-9, a-f only)

VERIFY:
✅ Hash format is correct:
   - Length: exactly 64 characters
   - Contains only: 0-9 and a-f (hexadecimal)
   - Example: "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"
   
✅ NOT your actual PIN:
   - If PIN is "1234", hash should NOT be "1234"
   - Hash should be long random-looking string
   
✅ Verify one-way hashing:
   - Try online SHA-256 calculator: https://emn178.github.io/online-tools/sha256.html
   - Input: your PIN (e.g., "1234")
   - Compare output with stored hash
   - Should be DIFFERENT (because salt is added)
   
✅ Verify deterministic behavior:
   - Clear storage: Right-click → Clear
   - Set same PIN again: 1234
   - Check new hash
   - Should be DIFFERENT from before (random salt each time)

EXAMPLE:
PIN: "1234"
Stored Hash: "a4d7b3f2e8c9d5e1f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9"
✅ Cannot reverse this to get "1234"
✅ Even with hash, attacker cannot login

TAKE SCREENSHOT:
📸 DevTools showing pinHash with 64-character hex string
   File name: "CONF002_pin_hash.png"

RESULT: ✅ PASS if hash is 64-char hex and not plaintext PIN
```

#### Test CONF003: Unique IV Per Credential
```
STEPS:
1. Add multiple credentials:
   - Credential 1: gmail.com / user1@gmail.com / pass123
   - Credential 2: gmail.com / user2@gmail.com / pass456  
   - Credential 3: gmail.com / user3@gmail.com / pass789
   - (Same domain, different usernames)

2. Open DevTools (F12):
   - Application → Local Storage
   - Click extension ID
   - Find "rf_creds" key
   - Right-click → Edit Value

3. Copy the JSON array to a text editor:
   - Should see array of 3+ credential objects
   - Each object has "iv" field

4. Extract all IV values:
   - Look for "iv": "..." in each credential
   - Write them down or copy to spreadsheet

VERIFY:
✅ IV field exists in every credential:
   - Each credential object has "iv" property
   - No credential is missing IV
   
✅ IV format is correct:
   - Each IV is a hex string
   - Length: 32 characters (16 bytes in hex)
   - Contains only: 0-9, a-f
   - Example: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
   
✅ All IVs are unique:
   - Credential 1 IV: "a7f3e1d9c4b2a5e8..."
   - Credential 2 IV: "9b5d2f7a4c8e1b3d..."
   - Credential 3 IV: "3e8a1c6f9d4b7e2a..."
   - NO duplicates found
   
✅ Randomness check:
   - IVs don't follow pattern
   - Not sequential (a1, a2, a3...)
   - Not similar (same first/last chars)

VERIFICATION METHOD:
Copy all IVs to spreadsheet:
| Credential | IV |
|------------|-----|
| gmail.com #1 | a7f3e1d9c4b2a5e8f1c9b3d7e2a4f6c8 |
| gmail.com #2 | 9b5d2f7a4c8e1b3d5a7c9e2f4b6d8a1c |
| gmail.com #3 | 3e8a1c6f9d4b7e2a5c8f1d3b9e7a4c6f |

Use Excel/Sheets to check for duplicates:
- Highlight all IVs
- Format → Conditional Formatting → Highlight Duplicates
- If no highlights → All unique ✅

WHY THIS MATTERS:
- Same IV + same key = predictable encryption (BAD)
- Unique IV = same password encrypts differently each time (GOOD)
- Prevents pattern analysis attacks

TAKE SCREENSHOT:
📸 DevTools showing 3+ credentials with different IVs
   File name: "CONF003_unique_ivs.png"

RESULT: ✅ PASS if all IVs are unique 32-character hex strings
```

#### Test CONF004: PBKDF2 Key Derivation
```
STEPS:
1. Open source code files:
   - Navigate to: rf-password-manager/src/utils/
   - Open file: pinAuth.js (or similar crypto utility)

2. Search for PBKDF2 implementation:
   - Press Ctrl+F (Cmd+F on Mac)
   - Search for: "PBKDF2"
   - Find the key derivation function

3. Verify PBKDF2 parameters:
   - Look for iterations count
   - Check hash algorithm (should be SHA-256 or SHA-512)
   - Verify salt usage

VERIFY CODE:
✅ PBKDF2 algorithm present:
   - Function call: crypto.subtle.deriveKey()
   - Algorithm: "PBKDF2"
   
✅ Iterations count:
   - Look for: iterations: 100000 (or higher)
   - Minimum acceptable: 100,000
   - Industry standard: 100,000-600,000
   
✅ Hash algorithm:
   - Look for: hash: "SHA-256" or "SHA-512"
   - Should NOT be MD5 or SHA-1 (weak)
   
✅ Salt implementation:
   - Random salt generated per user
   - Salt length: at least 16 bytes (128 bits)
   - Salt stored separately from key

EXAMPLE CODE TO FIND:
```javascript
async function deriveKeyFromPin(pin, salt) {
  const encoder = new TextEncoder();
  const pinBuffer = encoder.encode(pin);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,  // ← CHECK THIS
      hash: 'SHA-256'      // ← AND THIS
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
```

VERIFICATION CHECKLIST:
✅ iterations >= 100000
✅ hash is SHA-256 or SHA-512
✅ Salt is random and unique
✅ Key length is 256 bits (AES-256)

ALTERNATIVE VERIFICATION (DevTools Console):
1. Open extension popup
2. Press F12 → Console
3. Type and run:
```javascript
// Check if Web Crypto API is being used
console.log(window.crypto.subtle);
// Should output: SubtleCrypto object

// Check available algorithms
crypto.subtle.importKey('raw', new Uint8Array(16), 'PBKDF2', false, ['deriveKey'])
  .then(() => console.log('✅ PBKDF2 available'))
  .catch(e => console.log('❌ PBKDF2 not available'));
```

WHY THIS MATTERS:
- PBKDF2 slows down brute-force attacks
- 100,000 iterations = ~100ms per PIN attempt
- Makes cracking a 4-digit PIN take hours instead of milliseconds
- Industry standard for password-based encryption

TAKE SCREENSHOT:
📸 Source code showing PBKDF2 with iterations: 100000
   File name: "CONF004_pbkdf2_code.png"

RESULT: ✅ PASS if iterations >= 100,000 with SHA-256/512
```

#### Test CONF005: No Credentials in Logs
```
STEPS:
1. Clear existing console logs:
   - Open DevTools (F12)
   - Click "Console" tab
   - Right-click in console → "Clear console"
   - Or press Ctrl+L (Cmd+K on Mac)

2. Enable all log levels:
   - Console filter dropdown → Check all:
     * Errors
     * Warnings  
     * Info
     * Verbose
     * Debug

3. Perform sensitive actions:
   - Set/enter PIN: "1234"
   - Add credential:
     * Domain: banking.com
     * Username: john.doe@email.com
     * Password: MySecretP@ss123
   - Save credential
   - View credential (reveal password)
   - Copy password
   - Delete credential

4. Search console for sensitive data:
   - Press Ctrl+F in console
   - Search for: "1234" (your PIN)
   - Search for: "MySecretP@ss123" (password)
   - Search for: "john.doe@email.com" (username)
   - Search for: "banking.com" (if logged)

VERIFY:
✅ No plaintext passwords in console:
   - Should NOT find: "MySecretP@ss123"
   - Should NOT find: "password: xxx"
   - Should NOT find: "pwd: xxx"
   
✅ No plaintext usernames:
   - Should NOT find: "john.doe@email.com"
   - May find: "username: [encrypted]" or "username: ***"
   
✅ No PIN values:
   - Should NOT find: "pin: 1234"
   - May find: "PIN verified" or "PIN set successfully"
   
✅ Acceptable debug messages:
   - "Encrypting credential..." ✅
   - "Credential saved" ✅
   - "Decrypting..." ✅
   - "PIN verified successfully" ✅
   - "Authentication successful" ✅
   
✅ Check for encrypted data logs (OK if present):
   - "Encrypted value: U2FsdGVk..." ✅ (this is safe)
   - "Hash generated: a7f3e1d9..." ✅ (this is safe)
   - "IV generated: 9b5d2f7a..." ✅ (this is safe)

VERIFICATION CHECKLIST:
Create a table of what you searched and what was found:

| Search Term | Found? | Details | Pass/Fail |
|-------------|--------|---------|-----------|
| "MySecretP@ss123" | ❌ No | Not in logs | ✅ PASS |
| "john.doe@" | ❌ No | Not in logs | ✅ PASS |
| "1234" (PIN) | ❌ No | Not in logs | ✅ PASS |
| "banking.com" | ✅ Yes | Only in phishing check request | ✅ PASS |
| "Credential saved" | ✅ Yes | Safe debug message | ✅ PASS |

SPECIAL CASES TO CHECK:
1. Network requests (in Network tab):
   - Click "Network" tab
   - Look at request payloads
   - Passwords should NOT be in request bodies
   - Only URLs sent to phishing API

2. Error messages:
   - Trigger an error (wrong PIN)
   - Check if error reveals sensitive data
   - Should say "Incorrect PIN" not "Expected: 1234"

3. Extension background logs:
   - Right-click extension icon → Inspect
   - New DevTools window opens (service worker)
   - Check those logs too
   - Same rules apply: no plaintext passwords

TAKE SCREENSHOTS:
📸 Console showing clean logs (no sensitive data)
   File name: "CONF005_clean_console.png"
📸 Search results for password showing "0 results"
   File name: "CONF005_no_password_found.png"

RESULT: ✅ PASS if no plaintext credentials found in any logs
```

#### Test CONF006: Network Traffic Secure
```
STEPS:
1. DevTools → Network tab
2. Add credential with phishing check
3. Look at requests

VERIFY:
✅ Request to http://127.0.0.1:5000/predict_url
✅ Body shows: {"url": "gmail.com"}
✅ NOT showing username/password
✅ Only URL sent to server
```

---

### 2.2 Integrity Testing (INT001-INT005)

#### Test INT001: Tampered Data Detection
```
STEPS:
1. Add credential: "gmail.com"
2. DevTools → Local Storage → credentials
3. Copy the credential object (full JSON)
4. Modify it: change first character from "U" to "V"
5. Save back to Local Storage
6. Close and reopen extension
7. Try to access vault

VERIFY:
✅ Decryption fails
✅ Error message shows
✅ Vault doesn't open
✅ Modified data rejected
```

#### Test INT002: AES-GCM Authentication Tag
```
STEPS:
1. Source code check: Look for "AES-GCM"
2. Verify authentication tag is used

VERIFY:
✅ Code shows: new SubtleCrypto with AES-GCM
✅ Authentication tag generated with encryption
✅ Tag verified during decryption
✅ Invalid tag causes decryption failure
```

#### Test INT003: PIN Verification Robust
```
STEPS:
1. DevTools → Local Storage
2. Find "pinHash" value
3. Change 1 character (e.g., last char)
4. Close and reopen extension
5. Enter original PIN

VERIFY:
✅ PIN verification fails
✅ Shows: "Incorrect PIN"
✅ Cannot unlock vault
✅ Modified hash rejected
```

#### Test INT004: Model Predictions Consistent
```
STEPS:
1. Terminal: Run Flask server (python server.py)
2. Test same URL twice:

curl -X POST http://127.0.0.1:5000/predict_url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://google.com"}'

(Repeat same command)

VERIFY:
✅ First response: probability 0.08
✅ Second response: probability 0.08 (identical)
✅ Consistent predictions
✅ Same model output
```

#### Test INT005: No Data Corruption on Sync
```
STEPS:
1. Open extension in Tab 1
2. Open extension in Tab 2
3. Add credential in Tab 1
4. Check Tab 2 (should auto-update)
5. Add different credential in Tab 2
6. Check Tab 1

VERIFY:
✅ Both tabs show all credentials
✅ New credential from Tab 1 appears in Tab 2
✅ New credential from Tab 2 appears in Tab 1
✅ No data loss or duplication
✅ Data stays consistent
```

---

### 2.3 Availability Testing (AVAIL001-AVAIL005)

#### Test AVAIL001: Server Offline Fallback
```
STEPS:
1. Start Flask server: python ML/server.py
2. Add credential with domain "google.com" (phishing check works)
3. Stop Flask server (Ctrl+C in terminal)
4. Click "Add Password" again
5. Type "github.com" in Site URL field
6. Wait 1 second (auto-check triggers automatically after typing stops)
7. Wait up to 5 seconds for timeout to complete

VERIFY:
✅ Orange warning box appears with text:
   "⚠️ Server unavailable - Phishing detection offline. 
    Cannot save credentials without security check."
✅ Status message at top: "⚠️ ML Server is offline. Phishing detection unavailable."
✅ No risk indicator (green/red badge) shown
✅ "Save" button is DISABLED (grayed out)
✅ Button text changes to "Server Required"
✅ Clicking Save button does nothing
✅ If clicked, error shows: "⚠️ Cannot save: ML Server is offline. Phishing detection required."
✅ Vault remains accessible (no crash)
✅ Graceful degradation - secure by default

EXPECTED BEHAVIOR:
- Warning box has orange background (#fff3e0)
- Warning box has orange border (#ffb74d)
- Warning is clearly visible and informative
- Save button is disabled with opacity 0.5
- Cursor shows "not-allowed" icon on hover
- User CANNOT save without phishing check (security requirement)
```

#### Test AVAIL002: Prediction Timeout
```
STEPS:
1. Intentionally slow down server:
   - Add delay in server.py: time.sleep(10)
2. Add credential with domain
3. Wait for timeout (should be ~5 seconds)

VERIFY:
✅ Request times out after 5 seconds
✅ Warning shown to user
✅ User can still proceed
✅ Not stuck/frozen
```

#### Test AVAIL003: Large Vault Performance
```
STEPS:
1. DevTools → Console
2. Paste script to add 500 fake credentials:

for(let i=0; i<500; i++) {
  chrome.storage.local.get('credentials', (data) => {
    let creds = data.credentials || [];
    creds.push({domain: 'site'+i+'.com', ...});
    chrome.storage.local.set({credentials: creds});
  });
}

3. Reload extension
4. Measure load time

VERIFY:
✅ Vault loads in < 2 seconds
✅ No lag or freezing
✅ Scroll through 500 items smoothly
✅ Performance acceptable
```

#### Test AVAIL004: Concurrent Tab Access
```
STEPS:
1. Open extension in Tab 1, Tab 2, Tab 3
2. Tab 1: Add credential "site1.com"
3. Tab 2: Immediately refresh extension
4. Tab 3: Check if new credential appears

VERIFY:
✅ New credential visible in all tabs
✅ No sync delays
✅ Storage events fire properly
✅ All tabs update
```

#### Test AVAIL005: Cache Performance
```
STEPS:
1. Add credential for "google.com"
2. Phishing check runs (takes 0.45s)
3. Add another credential
4. Use same domain "google.com" again
5. Measure response time

VERIFY:
✅ First check: ~0.45 seconds
✅ Second check (cached): < 100ms
✅ Cache hit reduces latency dramatically
✅ Performance improvement visible
```

---

## 3. PHISHING ATTACK TESTING - Step by Step

### 3.1 Real-World Dataset Testing

#### Test OpenPhish Dataset
```
STEPS:
1. Download OpenPhish list:
   curl https://openphish.com/feed.txt -o phishing_urls.txt

2. Create test script (test_openphish.py):
   
import requests
import json

with open('phishing_urls.txt') as f:
    urls = [line.strip() for line in f.readlines()[:100]]

detected = 0
for url in urls:
    response = requests.post(
        'http://127.0.0.1:5000/predict_url',
        json={'url': url}
    )
    result = response.json()
    if result['phishing_label'] == 'phishing':
        detected += 1
    
print(f"Detected: {detected}/100")

3. Run: python test_openphish.py

VERIFY:
✅ Output: "Detected: 97/100"
✅ 97% detection rate
✅ 0% false positives on phishing set
```

#### Test Legitimate Sites (Alexa Top 1000)
```
STEPS:
1. Create test_legitimate.py:

legitimate_sites = [
    'google.com', 'amazon.com', 'github.com',
    'microsoft.com', 'stackoverflow.com', 'reddit.com',
    'wikipedia.org', 'linkedin.com', 'youtube.com',
    'facebook.com'
]

false_positives = 0
for domain in legitimate_sites:
    response = requests.post(
        'http://127.0.0.1:5000/predict_url',
        json={'url': f'https://{domain}'}
    )
    result = response.json()
    if result['phishing_label'] == 'phishing':
        false_positives += 1
        print(f"FALSE POSITIVE: {domain}")

print(f"False Positives: {false_positives}/10")

2. Run: python test_legitimate.py

VERIFY:
✅ Output: "False Positives: 0/10"
✅ 0% false positive rate
✅ All legitimate sites recognized
```

### 3.2 Common Phishing Attacks Testing

#### Test Typosquatting
```
STEPS:
1. Open extension
2. Add password for: paypa1.com (note: "1" instead of "l")

VERIFY:
✅ Red badge shows: "🛑 Phishing (92%)"
✅ Extension detects typo attack
✅ User warned before saving
```

#### Test Lookalike Domain
```
STEPS:
1. Add password for: amazon-security.tk

VERIFY:
✅ Red badge: "🛑 Phishing (88%)"
✅ Detects fake lookalike
✅ Free domain (.tk) increases suspicion
```

#### Test Subdomain Spoofing
```
STEPS:
1. Add password for: paypal.attacker.com

VERIFY:
✅ Red badge: "🛑 Phishing (79%)"
✅ Detects domain extraction trick
✅ Recognizes attacker domain
```

### 3.3 Adversarial Testing

#### Test URL Encoding Bypass
```
STEPS:
1. Terminal test:

curl -X POST http://127.0.0.1:5000/predict_url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://p%61ypal.com"}'

VERIFY:
✅ Response shows: phishing_label: "phishing"
✅ URL decoded before processing
✅ Encoding doesn't bypass detection
```

#### Test Mixed Case Obfuscation
```
STEPS:
curl -X POST http://127.0.0.1:5000/predict_url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://PaYpAl.Com"}'

VERIFY:
✅ Response: phishing_label: "phishing"
✅ Case normalized
✅ Obfuscation ineffective
```

---

## 4. ML MODEL EVALUATION - Step by Step

### 4.1 Test Single URL Prediction

```
STEPS:
1. Start Flask server:
   cd ML
   python server.py

2. Test health endpoint:
   curl http://127.0.0.1:5000/health

3. Result should be:
{
  "status": "healthy",
  "model_loaded": true,
  "model_bundle": "model.pkl",
  "has_scaler": true,
   "feature_count": 42,
  "phishing_threshold": 0.5
}

VERIFY:
✅ Server running
✅ Model loaded
✅ 42 features present
```

### 4.2 Test Prediction Accuracy

```
STEPS:
1. Test a phishing URL:

curl -X POST http://127.0.0.1:5000/predict_url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://paypa1.com"}'

Response:
{
  "url": "https://paypa1.com",
  "phishing_label": "phishing",
  "probability": 0.92,
  "features": {...},
  "timestamp": "2025-12-14T10:30:00Z"
}

VERIFY:
✅ phishing_label: "phishing" ✓
✅ probability: 0.92 (high confidence) ✓
✅ Features extracted ✓

2. Test legitimate URL:

curl -X POST http://127.0.0.1:5000/predict_url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://google.com"}'

Response:
{
  "url": "https://google.com",
  "phishing_label": "safe",
  "probability": 0.08,
  ...
}

VERIFY:
✅ phishing_label: "safe" ✓
✅ probability: 0.08 (low confidence) ✓
```

### 4.3 Test Batch Processing

```
STEPS:
1. Test multiple URLs:

curl -X POST http://127.0.0.1:5000/predict_batch \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://google.com",
      "https://paypa1.com",
      "https://amazon.com",
      "https://banklogin.xyz"
    ]
  }'

Response:
{
  "predictions": [
    {"url": "https://google.com", "phishing_label": "safe", "probability": 0.08},
    {"url": "https://paypa1.com", "phishing_label": "phishing", "probability": 0.92},
    {"url": "https://amazon.com", "phishing_label": "safe", "probability": 0.12},
    {"url": "https://banklogin.xyz", "phishing_label": "phishing", "probability": 0.85}
  ],
  "processed": 4,
  "failed": 0
}

VERIFY:
✅ All 4 URLs processed
✅ Correct classifications
✅ Reasonable probabilities
✅ No failures
```

### 4.4 Check Model Features

```
STEPS:
1. Terminal command:

python -c "import joblib; model = joblib.load('ML/model.pkl'); print(model.feature_names_in_)"

VERIFY:
✅ Output lists 42 feature names matching the active bundle.
Tip: Prefer reading directly from the model to avoid drift; do not hardcode the list here.
```

---

## 5. USER TESTING - Step by Step

### 5.1 Prepare Testing Environment

```
STEPS:
1. Recruit 5 users (diverse technical levels)
2. Each user gets:
   - Fresh Chrome browser
   - Extension loaded
   - Instructions sheet
   - Task list
   - Feedback form
```

### 5.2 Test Task 1: PIN Setup

```
TASK: "Set up your 4-digit PIN"
TIME LIMIT: 5 minutes

STEPS USER PERFORMS:
1. Click extension
2. Read "Set Your PIN" prompt
3. Enter PIN
4. Confirm PIN
5. Click Save

MEASURE:
- Time taken
- Any confusion?
- Any errors?
- User satisfaction (1-5 scale)
```

### 5.3 Test Task 2: Add Credential

```
TASK: "Save your Gmail password"
SCENARIO: "You want to save gmail.com"

STEPS USER PERFORMS:
1. Click "Add Password"
2. Fill in:
   - Domain: gmail.com
   - Username: yourname@gmail.com
   - Password: (from sheet)
3. Click Save
4. See credential in vault

MEASURE:
- Time taken
- Did user understand risk indicator?
- Any confusion?
- Feedback
```

### 5.4 Test Task 3: Check Phishing Status

```
TASK: "Check if a suspicious website is safe"
SCENARIO: "You visit paypa1.com"

STEPS USER PERFORMS:
1. Visit paypa1.com in browser
2. Look at extension icon/badge
3. Click extension
4. Observe risk indicator
5. Report finding

MEASURE:
- Did user notice warning?
- Did user understand red badge?
- Would they click this site?
- Feedback on clarity
```

### 5.5 Test Task 4: Access Vault

```
TASK: "View your saved passwords"

STEPS USER PERFORMS:
1. Click extension icon
2. Enter PIN
3. View list
4. Click on credential
5. View details

MEASURE:
- Time to unlock
- Navigation ease
- UI clarity
- Satisfaction (1-5)
```

### 5.6 Collect Feedback

```
FEEDBACK FORM (for each user):

1. Overall ease of use: 1-5
2. Security features (PIN/encryption) clear? Yes/No
3. Phishing warnings helpful? Yes/No
4. Any confusing parts?
5. What would you improve?
6. Would you use this? Yes/No
7. Additional comments

RECORD:
- Time on each task
- Errors/mistakes
- Questions asked
- Emotional reactions
```

### 5.7 Analyze Results

```
CALCULATE:
- Average task completion time
- Success rate (tasks completed/total tasks)
- Average satisfaction score
- Common issues
- Improvement suggestions

EXAMPLE RESULTS:
- User 1: 7 min, 100%, 5/5 ⭐
- User 2: 11 min, 100%, 4/5 ⭐
- User 3: 7 min, 100%, 5/5 ⭐
- User 4: 12 min, 100%, 4/5 ⭐
- User 5: 7 min, 100%, 5/5 ⭐

AVERAGE:
- Time: 8.8 minutes
- Success: 100%
- Satisfaction: 4.8/5
```

---

## 6. QUICK TEST CHECKLIST

```
Use this to quickly verify everything works:

BEFORE TESTING:
☐ Flask server running (python ML/server.py)
☐ Extension loaded in Chrome
☐ DevTools open (F12)
☐ Network tab ready

FUNCTIONAL TESTS:
☐ PIN setup works
☐ PIN verification works
☐ Can add credentials
☐ Can view credentials
☐ Can delete credentials
☐ Phishing warnings show

SECURITY TESTS:
☐ Credentials encrypted in storage
☐ PIN is hashed (not plaintext)
☐ Different IVs for each credential
☐ No passwords in console logs
☐ No passwords in network requests

PHISHING TESTS:
☐ paypa1.com detected as phishing
☐ google.com recognized as safe
☐ amazon-security.tk detected as phishing
☐ Detection rate > 95%
☐ False positives < 2%

ML MODEL TESTS:
☐ Server health check passes
☐ Phishing prediction works
☐ Legitimate site prediction works
☐ Batch processing works
☐ Consistent predictions (same URL = same result)

USER TESTS:
☐ All 4 tasks completed by all 5 users
☐ Average satisfaction > 4/5
☐ No critical usability issues
☐ Users understand security features
```

---

## 7. TROUBLESHOOTING

### Issue: Extension not loading
```
FIX:
1. chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select rf-password-manager/public folder
```

### Issue: Flask server not responding
```
FIX:
1. Check: python server.py is running
2. Try: curl http://127.0.0.1:5000/health
3. If error: pip install -r ML/requirements.txt
4. Restart server
```

### Issue: Extension-Server Connection Failed
```
FIX:
1. Update manifest.json permissions:
   "host_permissions": [
     "http://127.0.0.1:5000/*",
     "http://localhost:5000/*"
   ]
2. Reload extension
3. Try again
```

### Issue: Encryption Errors
```
FIX:
1. Clear extension storage: DevTools → Storage → Clear All
2. Set PIN again (fresh start)
3. Test encryption
```

---

## 8. RECOMMENDED TEST ORDER

```
Day 1: Functional Testing
- Spend 2-3 hours
- Test all PIN and credential features
- Record any issues

Day 2: Security Testing
- Spend 2-3 hours
- Verify CIA principles
- Check storage encryption
- Review network traffic

Day 3: Phishing Detection Testing
- Spend 2-3 hours
- Test real URLs (OpenPhish, PhishTank)
- Test attack types
- Measure accuracy

Day 4: ML Model Evaluation
- Spend 1-2 hours
- Test API endpoints
- Verify predictions
- Check performance

Day 5: User Testing
- Spend 2-3 hours
- 5 users × 30 minutes each
- Collect feedback
- Document issues

TOTAL: ~12-14 hours of testing
```

---

Done! You now have step-by-step instructions for performing every test. Good luck! 🚀
