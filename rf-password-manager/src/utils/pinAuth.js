// src/utils/pinAuth.js

/**
 * Simple hash function for PIN (SHA-256 via Web Crypto API)
 */
export async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify PIN against stored hash
 */
export async function verifyPin(pin, storedHash) {
  const pinHash = await hashPin(pin);
  return pinHash === storedHash;
}

/**
 * Check if PIN is set up
 */
export function isPinSetup(callback) {
  chrome.storage.local.get(['rf_pin_hash'], (res) => {
    callback(!!res.rf_pin_hash);
  });
}

/**
 * Save PIN hash
 */
export async function savePin(pin, callback) {
  const hash = await hashPin(pin);
  chrome.storage.local.set({ rf_pin_hash: hash }, callback);
}

/**
 * Session management - check if unlocked
 */
export function isSessionUnlocked(callback) {
  chrome.storage.local.get(['rf_pin_session'], (res) => {
    if (!res.rf_pin_session) {
      callback(false);
      return;
    }
    
    const { expiry } = res.rf_pin_session;
    const now = Date.now();
    
    if (now > expiry) {
      // Session expired
      chrome.storage.local.remove(['rf_pin_session']);
      callback(false);
    } else {
      callback(true);
    }
  });
}

/**
 * Derive a simple XOR cipher key from extension ID (browser-specific)
 */
function getSessionKey() {
  const extId = chrome.runtime.id;
  let key = 0;
  for (let i = 0; i < extId.length; i++) {
    key ^= extId.charCodeAt(i) * (i + 1);
  }
  return key;
}

/**
 * Simple XOR encryption for session PIN (obfuscation, not strong encryption)
 */
function encryptSessionPin(pin) {
  const key = getSessionKey();
  const bytes = [];
  for (let i = 0; i < pin.length; i++) {
    bytes.push(pin.charCodeAt(i) ^ ((key + i) % 256));
  }
  // Convert bytes array to hex string (safer than base64 for binary data)
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Decrypt session PIN
 */
function decryptSessionPin(encrypted) {
  try {
    const key = getSessionKey();
    // Convert hex string back to bytes
    const bytes = [];
    for (let i = 0; i < encrypted.length; i += 2) {
      bytes.push(parseInt(encrypted.substr(i, 2), 16));
    }
    // XOR decrypt
    let decrypted = '';
    for (let i = 0; i < bytes.length; i++) {
      decrypted += String.fromCharCode(bytes[i] ^ ((key + i) % 256));
    }
    return decrypted;
  } catch (e) {
    return null;
  }
}

/**
 * Create session after successful PIN entry with encrypted PIN.
 * SESSION_DURATION_MINUTES controls how long the session remains valid.
 */
const SESSION_DURATION_MINUTES = 30; // default session duration (minutes)

export function createSession(pin, callback) {
  const expiry = Date.now() + (SESSION_DURATION_MINUTES * 60 * 1000); // minutes -> ms
  const encryptedPin = encryptSessionPin(pin);
  
  // Use chrome.storage.local for persistence across popup close/reopen
  chrome.storage.local.set({ 
    rf_pin_session: { expiry, ep: encryptedPin } 
  }, () => {
    if (chrome.runtime.lastError) {
    }
    if (callback) callback();
  });
}

/**
 * Get decrypted PIN from current session
 */
export function getSessionPin(callback) {
  chrome.storage.local.get(['rf_pin_session'], (res) => {
    if (chrome.runtime.lastError) {
      callback(null);
      return;
    }
    
    if (!res.rf_pin_session) {
      callback(null);
      return;
    }
    
    const { expiry, ep } = res.rf_pin_session;
    const now = Date.now();
    
    if (now > expiry) {
      // Session expired
      chrome.storage.local.remove(['rf_pin_session']);
      callback(null);
    } else {
      if (!ep) {
        callback(null);
        return;
      }
      const pin = decryptSessionPin(ep);
      if (!pin) {
      } else {
      }
      callback(pin);
    }
  });
}

/**
 * Clear session (lock)
 */
export function clearSession(callback) {
  chrome.storage.local.remove(['rf_pin_session'], callback);
}

/**
 * Extend session expiry (reset 5-minute timer)
 */
export function extendSession(callback) {
  getSessionPin((pin) => {
    if (pin) {
      createSession(pin, callback);
    } else {
      callback();
    }
  });
}
