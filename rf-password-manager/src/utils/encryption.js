// src/utils/encryption.js
// AES-GCM encryption utilities for credential storage

/**
 * Derives an encryption key from PIN using PBKDF2
 * @param {string} pin - User's PIN
 * @param {Uint8Array} salt - Random salt (16 bytes)
 * @returns {Promise<CryptoKey>} Encryption key
 */
export async function deriveKeyFromPin(pin, salt) {
  const encoder = new TextEncoder();
  const pinBuffer = encoder.encode(pin);
  
  // Import PIN as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  // Derive 256-bit AES-GCM key using PBKDF2 with 100,000 iterations
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,  // Industry standard
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generates a random salt
 * @returns {Uint8Array} 16-byte random salt
 */
export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Generates a random IV (Initialization Vector)
 * @returns {Uint8Array} 12-byte random IV
 */
export function generateIV() {
  return crypto.getRandomValues(new Uint8Array(12));
}

/**
 * Encrypts text using AES-GCM
 * @param {string} text - Plaintext to encrypt
 * @param {CryptoKey} key - Encryption key
 * @param {Uint8Array} iv - Initialization vector
 * @returns {Promise<string>} Base64-encoded ciphertext
 */
export async function encryptText(text, key, iv) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    data
  );
  
  // Convert to base64 for storage
  return arrayBufferToBase64(encryptedBuffer);
}

/**
 * Decrypts text using AES-GCM
 * @param {string} encryptedText - Base64-encoded ciphertext
 * @param {CryptoKey} key - Decryption key
 * @param {Uint8Array} iv - Initialization vector
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decryptText(encryptedText, key, iv) {
  const encryptedBuffer = base64ToArrayBuffer(encryptedText);
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encryptedBuffer
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Encrypts a credential object
 * @param {Object} credential - Credential to encrypt
 * @param {string} pin - User's PIN
 * @returns {Promise<Object>} Encrypted credential with IV
 */
export async function encryptCredential(credential, pin) {
  // Generate unique salt and IV for this credential
  const salt = generateSalt();
  const iv = generateIV();
  
  // Derive encryption key from PIN
  const key = await deriveKeyFromPin(pin, salt);
  
  // Encrypt sensitive fields
  const encryptedSite = await encryptText(credential.site, key, iv);
  const encryptedUsername = await encryptText(credential.username, key, iv);
  const encryptedPassword = await encryptText(credential.password, key, iv);
  
  return {
    id: credential.id,
    site: encryptedSite,
    username: encryptedUsername,
    password: encryptedPassword,
    iv: arrayBufferToHex(iv),
    salt: arrayBufferToHex(salt),
    favicon: credential.favicon, // Not encrypted (public)
    riskScore: credential.riskScore,
    riskFactors: credential.riskFactors
  };
}

/**
 * Decrypts a credential object
 * @param {Object} encryptedCredential - Encrypted credential
 * @param {string} pin - User's PIN
 * @returns {Promise<Object>} Decrypted credential
 */
export async function decryptCredential(encryptedCredential, pin) {
  // Convert hex strings back to Uint8Array
  const iv = hexToUint8Array(encryptedCredential.iv);
  const salt = hexToUint8Array(encryptedCredential.salt);
  
  // Derive decryption key from PIN
  const key = await deriveKeyFromPin(pin, salt);
  
  // Decrypt sensitive fields
  const site = await decryptText(encryptedCredential.site, key, iv);
  const username = await decryptText(encryptedCredential.username, key, iv);
  const password = await decryptText(encryptedCredential.password, key, iv);
  
  return {
    id: encryptedCredential.id,
    site,
    username,
    password,
    favicon: encryptedCredential.favicon,
    riskScore: encryptedCredential.riskScore,
    riskFactors: encryptedCredential.riskFactors
  };
}

// Helper functions for conversion

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToUint8Array(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}
