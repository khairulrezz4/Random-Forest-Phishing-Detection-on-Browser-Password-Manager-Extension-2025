// src/RFPasswordManagerPopup.jsx
import React, { useState, useEffect } from "react";
import "./index.css";
import { PowerIcon } from "./components/Icons";
import HomePage from "./components/HomePage";
import VaultPage from "./components/VaultPage";
import AddPasswordPage from "./components/AddPasswordPage";
import PinSetup from "./components/PinSetup";
import PinPrompt from "./components/PinPrompt";
import { queryLocalModel } from "./utils/api";
import { 
  loadStorageData, 
  saveStorageData, 
  queryLoginState, 
  setAutofillEnabled as sendAutofillEnabled,
  fillCredential,
  openAndFill
} from "./utils/chrome";
import {
  isPinSetup,
  savePin,
  verifyPin,
  isSessionUnlocked,
  createSession,
  clearSession,
  extendSession,
  getSessionPin
} from "./utils/pinAuth";
import { logEvent, EventTypes, exportLogsAsTxt } from "./utils/eventLogger";
import { encryptCredential, decryptCredential } from "./utils/encryption";

export default function RFPasswordManagerPopup() {
  const [vaultLocked, setVaultLocked] = useState(true);
  const [autofillEnabled, setAutofillEnabled] = useState(true);
  const [page, setPage] = useState("home");
  const [query, setQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [credentials, setCredentials] = useState([]);
  const [canFill, setCanFill] = useState(false);
  const [currentTabUrl, setCurrentTabUrl] = useState("");
  const [form, setForm] = useState({ site: "", username: "", password: "" });
  const [revealedId, setRevealedId] = useState(null);
  const [siteRisk, setSiteRisk] = useState(null); // { score, features, checkedUrl, message }
  const [siteChecking, setSiteChecking] = useState(false);
  const [homeRisk, setHomeRisk] = useState(null); // { status: 'legit'|'phishing'|'unknown'|'error', score, url }
  const [homeChecking, setHomeChecking] = useState(false);
  
  // PIN authentication states
  const [pinSetupRequired, setPinSetupRequired] = useState(false);
  const [pinPromptVisible, setPinPromptVisible] = useState(false);
  const [currentPin, setCurrentPin] = useState(null); // Store PIN in memory only
  const [pendingAction, setPendingAction] = useState(null); // Track action to perform after PIN unlock
  const [loadTrigger, setLoadTrigger] = useState(0); // Force reload trigger
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [tamperedCount, setTamperedCount] = useState(0); // Track tampered credentials detected
  const [validationAlert, setValidationAlert] = useState(null); // { message, type }
  const sessionClearTimer = React.useRef(null);

  // Check if PIN is set up on initial load
  useEffect(() => {
    isPinSetup((hasPin) => {
      if (!hasPin) {
        setPinSetupRequired(true);
        setPinUnlocked(false);
      } else {
        isSessionUnlocked((unlocked) => {
          setPinUnlocked(unlocked);
          if (unlocked) {
            // Trigger credential load if already unlocked
            setLoadTrigger(prev => prev + 1);
          }
        });
      }
    });
  }, []);

  // Load credentials and settings from chrome.storage when vault is unlocked
  useEffect(() => {
    // Only load credentials if vault is unlocked
    if (!pinUnlocked) {
      return;
    }

    loadStorageData(["rf_creds", "rf_autofill_enabled", "rf_vault_locked"], async (res) => {
      let list = Array.isArray(res.rf_creds) ? res.rf_creds : [];
      
      // Get PIN from encrypted session storage (survives popup close/reopen)
      getSessionPin(async (pin) => {
        if (pin) {
          setCurrentPin(pin);
          
          // Decrypt credentials if they are encrypted and PIN is available
          if (list.length > 0) {
            const decryptedList = [];
            let tamperedCredentials = 0;
            for (const cred of list) {
              // Check if credential is encrypted (has iv and salt fields)
              if (cred.iv && cred.salt) {
                try {
                  const decrypted = await decryptCredential(cred, pin);
                  decryptedList.push(decrypted);
                } catch (error) {
                  // This credential is corrupted/tampered - DO NOT include it
                  tamperedCredentials++;
                }
              } else {
                // Legacy plaintext credential
                decryptedList.push(cred);
              }
            }
            list = decryptedList;
            
            // Alert user if tampered credentials were detected
            if (tamperedCredentials > 0) {
              setTamperedCount(tamperedCredentials);
              setStatusMessage(`⚠️ Security Alert: ${tamperedCredentials} tampered credential(s) detected and rejected!`);
              logEvent(EventTypes.SECURITY_THREAT, {
                message: `Tampered credentials detected: ${tamperedCredentials}`,
                action: 'rejected'
              });
            }
          }
        } else {
          // No PIN available but we're marked as unlocked
          // This means session storage might be corrupted or PIN retrieval failed
          // Check if there are encrypted credentials that need decryption
          const hasEncrypted = list.some(cred => cred.iv && cred.salt);
          if (hasEncrypted) {
            // Prompt for PIN to decrypt
            setPinPromptVisible(true);
            setStatusMessage("Please enter your PIN to view credentials.");
            return;
          }
        }
        
          // MIGRATION: Check if there are any plaintext (unencrypted) credentials
        const plaintextCreds = list.filter(cred => !cred.iv && !cred.salt && cred.password);
        if (plaintextCreds.length > 0 && pin) {
          
          // Encrypt all plaintext credentials
          const encryptedMigrated = [];
          for (const plainCred of plaintextCreds) {
            try {
              const encrypted = await encryptCredential(plainCred, pin);
              encryptedMigrated.push(encrypted);
            } catch (e) {
            }
          }
          
          // Replace plaintext with encrypted in storage
          if (encryptedMigrated.length > 0) {
            // Get current storage list (which may have both encrypted and plaintext)
            const currentStorageList = Array.isArray(res.rf_creds) ? res.rf_creds : [];
            
            // Build new list: keep existing encrypted, replace plaintext with encrypted
            const newStorageList = currentStorageList.map(cred => {
              if (!cred.iv && !cred.salt && cred.password) {
                // This is plaintext - find its encrypted version
                const encrypted = encryptedMigrated.find(e => e.id === cred.id);
                return encrypted || cred; // Use encrypted or keep original if encryption failed
              }
              return cred; // Already encrypted
            });
            
            // Save migrated data back to storage
            saveStorageData({ rf_creds: newStorageList }, () => {
              console.log('[Migration] Successfully encrypted and saved', encryptedMigrated.length, 'credentials');
            });
            
            // Update display list with decrypted versions
            list = list.map(cred => {
              if (!cred.iv && !cred.salt && cred.password) {
                // This was plaintext, now it's encrypted in storage but we keep decrypted for display
                return cred;
              }
              return cred;
            });
          }
        }
        
        // Set credentials after decryption/migration completes
        setCredentials(list);

        // Determine stored autofill value; fall back to current state when absent
          const storedAutofill = (typeof res.rf_autofill_enabled === 'boolean') ? res.rf_autofill_enabled : autofillEnabled;
          setAutofillEnabled(storedAutofill);
          // Prefer explicit stored vault lock state if present, otherwise infer from the resolved autofill state
          if (typeof res.rf_vault_locked === 'boolean') {
            setVaultLocked(res.rf_vault_locked);
          } else {
            setVaultLocked(!storedAutofill);
          }
      });
    });
  }, [pinUnlocked, loadTrigger]); // Re-run when pinUnlocked changes OR loadTrigger changes  // Ensure vault lock state always matches autofill state
  useEffect(() => {
    // Vault is unlocked only when autofill is enabled AND PIN session is unlocked
    setVaultLocked(!(autofillEnabled && pinUnlocked));
  }, [autofillEnabled]);

  // Update extension badge icon based on risk status
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) return;
      
      if (!homeRisk) {
        chrome.runtime.sendMessage({
          type: 'update-phishing-status',
          tabId: tab.id,
          status: 'unknown',
          score: null,
          threshold: null
        });
        return;
      }
      
      chrome.runtime.sendMessage({
        type: 'update-phishing-status',
        tabId: tab.id,
        status: homeRisk.status,
        score: homeRisk.score,
        threshold: homeRisk.threshold
      });
    });
  }, [homeRisk]);

  useEffect(() => {
    // Query current active tab and ask background if it's a login page
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab) { 
        setCanFill(false); 
        setCurrentTabUrl("");
        return; 
      }
      
      // Store current tab URL for per-credential matching
      setCurrentTabUrl(tab.url || "");
      
      // When disabled, canFill is false regardless of page
      if (!autofillEnabled) { setCanFill(false); return; }
      
      // Check if current URL matches any saved credentials
      const hasMatchingCredential = checkUrlMatchesCredentials(tab.url, credentials);
      
      queryLoginState(tab.id, (resp) => {
        // Enable fill if: (login page detected) OR (has matching credential)
        setCanFill(!!(resp && resp.login) || hasMatchingCredential);
      });
    });

    // Also perform homepage phishing check for active tab
    checkActiveTabRisk();

    // Listen for tab activation
    const onActivated = (info) => {
      chrome.tabs.get(info.tabId, (tab) => {
        setCurrentTabUrl(tab?.url || "");
        const hasMatchingCredential = checkUrlMatchesCredentials(tab?.url, credentials);
        queryLoginState(info.tabId, (resp) => {
          setCanFill(!!(resp && resp.login) || hasMatchingCredential);
        });
      });
      checkActiveTabRisk();
    };
    chrome.tabs.onActivated && chrome.tabs.onActivated.addListener(onActivated);
    
    // Listen for tab updates (URL changes, reloads)
    const onUpdated = (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
          if (activeTabs[0] && activeTabs[0].id === tabId) {
            checkActiveTabRisk();
          }
        });
      }
    };
    chrome.tabs.onUpdated && chrome.tabs.onUpdated.addListener(onUpdated);
    
    return () => {
      chrome.tabs.onActivated && chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated && chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [autofillEnabled, credentials]);

  // Helper: persist credentials to chrome.storage
  // IMPORTANT: This function expects ENCRYPTED credentials for storage
  // Only use this with encryptedList from storage operations
  const persist = (encryptedList) => {
    saveStorageData({ rf_creds: encryptedList }, () => {
      console.log('[Persist] Saved', encryptedList.length, 'encrypted credentials');
      // Note: Do NOT call setCredentials here - it should hold decrypted data
      // The caller should handle state updates separately
    });
  };

  // Helper: check if current URL matches any saved credentials
  const checkUrlMatchesCredentials = (currentUrl, creds) => {
    if (!currentUrl || !creds || creds.length === 0) return false;
    
    try {
      const current = new URL(currentUrl);
      const currentOrigin = current.origin;
      const currentPath = current.pathname;
      
      return creds.some(cred => {
        try {
          // Handle credentials that might have query parameters or full paths
          let savedSite = cred.site;
          if (!/^https?:\/\//i.test(savedSite)) savedSite = 'https://' + savedSite;
          
          const saved = new URL(savedSite);
          
          // First check: exact origin match required
          if (saved.origin !== currentOrigin) return false;
          
          // Second check: flexible path matching
          // Remove query params and hash from both URLs for comparison
          const savedPath = saved.pathname.split('?')[0].split('#')[0];
          const currPath = currentPath.split('?')[0].split('#')[0];
          
          // Extract base paths for auth URLs (e.g., /v3/signin from /v3/signin/identifier)
          const getBasePath = (path) => {
            const authSegments = ['signin', 'login', 'auth', 'authenticate'];
            const parts = path.split('/').filter(p => p);
            for (let i = 0; i < parts.length; i++) {
              if (authSegments.includes(parts[i].toLowerCase())) {
                return '/' + parts.slice(0, i + 1).join('/');
              }
            }
            return path;
          };
          
          const savedBase = getBasePath(savedPath);
          const currentBase = getBasePath(currPath);
          
          // Match if base paths match or one starts with the other
          return savedBase === currentBase || 
                 currPath.startsWith(savedPath) || 
                 savedPath.startsWith(currPath) ||
                 currPath.startsWith(savedBase) ||
                 savedBase.startsWith(currentBase);
        } catch (e) {
          return false;
        }
      });
    } catch (e) {
      return false;
    }
  };

  const filtered = credentials.filter(
    (c) =>
      c.site.toLowerCase().includes(query.toLowerCase()) ||
      (c.username || "").toLowerCase().includes(query.toLowerCase())
  );

  function toggleAutofill() {
    const next = !autofillEnabled;
    
    // If turning ON and PIN is set up, require authentication
    if (next) {
      isPinSetup((hasPin) => {
        if (hasPin && !pinUnlocked) {
          console.log('[PIN] Turning ON requires PIN authentication');
          setPinPromptVisible(true);
          // Store the intended action
          window.__pendingAction = 'turnOn';
          return;
        }
        
        // Either no PIN set up, or already unlocked - proceed
        performToggleOn();
      });
    } else {
      // Turning OFF - no PIN needed, just lock everything
      performToggleOff();
    }
  }

  function performToggleOn() {
    setAutofillEnabled(true);
    saveStorageData({ rf_autofill_enabled: true });
    
    // Log event
    logEvent(EventTypes.MANAGER_ENABLED);
    logEvent(EventTypes.VAULT_UNLOCKED);
    
    // Notify background immediately
    try {
      sendAutofillEnabled(true);
    } catch (e) {}
    
    // Auto-unlock the vault
    setVaultLocked(false);
    saveStorageData({ rf_vault_locked: false });
    setStatusMessage("Autofill enabled — vault unlocked");

    // If we scheduled a delayed session-clear when user turned OFF recently,
    // cancel it so the session remains available (avoids immediate re-prompt).
    try {
      if (sessionClearTimer.current) {
        clearTimeout(sessionClearTimer.current);
        sessionClearTimer.current = null;
      }
    } catch (e) {}

    // Recompute canFill right away and again shortly after to allow rescans
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab) { setCanFill(false); return; }
        const hasMatchingCredential = checkUrlMatchesCredentials(tab.url, credentials);
        const queryState = () => {
          queryLoginState(tab.id, (resp) => {
            setCanFill(!!(resp && resp.login) || hasMatchingCredential);
          });
        };
        queryState();
        setTimeout(queryState, 400);
        setTimeout(queryState, 1200);
      });
    } catch (e) {}
  }

  function performToggleOff() {
    setAutofillEnabled(false);
    saveStorageData({ rf_autofill_enabled: false });
    
    // Log events
    logEvent(EventTypes.MANAGER_DISABLED);
    logEvent(EventTypes.VAULT_LOCKED);
    
    // Notify background immediately
    try {
      sendAutofillEnabled(false);
    } catch (e) {}
    
    // Auto-lock the vault for privacy
    setVaultLocked(true);
    saveStorageData({ rf_vault_locked: true });
    setStatusMessage("Autofill disabled — vault locked");
    
    setCanFill(false);
    
    // Clear PIN from memory in state and schedule clearing the encrypted
    // session after a short delay. This gives a small grace window where
    // a quick toggle back ON will not force the user to re-enter the PIN.
    setCurrentPin(null);
    setPinUnlocked(false);
    try {
      if (sessionClearTimer.current) {
        clearTimeout(sessionClearTimer.current);
      }
      // schedule clearing session after 30 seconds
      sessionClearTimer.current = setTimeout(() => {
        clearSession(() => {
          sessionClearTimer.current = null;
        });
      }, 30 * 1000);
    } catch (e) {}
  }

  // Prefill the Add form with the current active tab's site/origin
  function startAdd() {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        let siteValue = '';
        if (tab && tab.url) {
          try {
            const u = new URL(tab.url);
            siteValue = `${u.origin}${u.pathname}`;
          } catch (e) {
            siteValue = '';
          }
        }
        setForm((prev) => ({ ...prev, site: siteValue }));
        setSiteRisk(null);
        setPage('add');
      });
    } catch (e) {
      setForm((prev) => ({ ...prev, site: '' }));
      setSiteRisk(null);
      setPage('add');
    }
  }

  // Run phishing check after entering URL (on blur)
  async function onCheckSite(urlRaw) {
    const s = (urlRaw || "").trim();
    if (!s) { setSiteRisk(null); return; }
    if (!autofillEnabled) { setSiteRisk(null); return; }
    let siteUrl = s;
    if (!/^https?:\/\//i.test(siteUrl)) siteUrl = 'https://' + siteUrl;
    try {
      setSiteChecking(true);
      const result = await queryLocalModel(siteUrl);
      const riskScore = result.probability ?? 0;
      const threshold = typeof result.threshold === 'number' ? result.threshold : 0.5;
      const percent = (riskScore * 100).toFixed(1);
      const thresholdPercent = (threshold * 100).toFixed(0);
      const isPhishing = result.phishing_label
        ? result.phishing_label === 'phishing'
        : riskScore >= threshold;

      let message = '';
      if (isPhishing) {
        message = `High-risk site detected (${percent}% ≥ ${thresholdPercent}% threshold)`;
      } else if (riskScore >= Math.max(0.3, threshold - 0.15)) {
        message = `Elevated risk (${percent}%); below block threshold (${thresholdPercent}%)`;
      } else if (riskScore > 0.1) {
        message = `Low risk (${percent}%)`;
      } else {
        message = `Very low risk (${percent}%)`;
      }

      setSiteRisk({
        score: riskScore,
        status: isPhishing ? 'phishing' : 'legit',
        threshold,
        phishingLabel: result.phishing_label || null,
        features: result.feature_importance || {},
        checkedUrl: siteUrl,
        message
      });
      setStatusMessage("");
    } catch (e) {
      console.error('Model check failed:', e);
      // Check if server is offline
      if (e.message === 'SERVER_OFFLINE') {
        setSiteRisk({ 
          score: null, 
          features: {}, 
          checkedUrl: siteUrl, 
          message: '⚠️ Server unavailable - Phishing detection offline. Cannot save credentials without security check.',
          serverOffline: true
        });
        setStatusMessage('⚠️ ML Server is offline. Phishing detection unavailable.');
      } else if (e.message === 'SERVER_TIMEOUT') {
        setSiteRisk({ 
          score: null, 
          features: {}, 
          checkedUrl: siteUrl, 
          message: '⚠️ Server timeout - Detection took too long. Cannot save without security check.',
          serverOffline: true
        });
        setStatusMessage('⚠️ Server timeout.');
      } else {
        setSiteRisk({ 
          score: null, 
          features: {}, 
          checkedUrl: siteUrl, 
          message: '⚠️ Could not verify site safety - Unknown error',
          serverOffline: false
        });
      }
    } finally {
      setSiteChecking(false);
    }
  }

  // Check phishing status of the currently active tab and expose it on Home page
  async function checkActiveTabRisk() {
    try {
      if (!autofillEnabled) { setHomeRisk(null); return; }
      setHomeChecking(true);
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        try {
          const tab = tabs && tabs[0];
          const tabUrl = (tab && tab.url) ? tab.url : '';
          if (!tabUrl) { setHomeRisk({ status: 'unknown', score: null, url: null }); setHomeChecking(false); return; }

          // Only check http/https pages
          if (!/^https?:\/\//i.test(tabUrl)) {
            setHomeRisk({ status: 'unknown', score: null, url: tabUrl });
            setHomeChecking(false);
            return;
          }

          // Normalize
          let siteUrl = tabUrl;
          try {
            const u = new URL(tabUrl);
            siteUrl = `${u.origin}${u.pathname}`;
          } catch (e) {}

          const result = await queryLocalModel(siteUrl);
          const riskScore = result.probability ?? 0;
          // Prefer phishing_label returned by server if available
          let status;
          if (result.phishing_label) {
            status = result.phishing_label === 'phishing' ? 'phishing' : 'legit';
          } else {
            const threshold = typeof result.threshold === 'number' ? result.threshold : 0.5;
            status = riskScore >= threshold ? 'phishing' : 'legit';
          }
          
          // Log phishing detection or safe site verification
          if (status === 'phishing') {
            logEvent(EventTypes.PHISHING_DETECTED, {
              url: siteUrl,
              riskScore: riskScore
            });
          } else if (status === 'legit') {
            logEvent(EventTypes.SITE_VERIFIED_SAFE, {
              url: siteUrl,
              riskScore: riskScore
            });
          }
          
          setHomeRisk({ status, score: riskScore, url: siteUrl, threshold: result.threshold });
        } catch (err) {
          console.error('Home risk check failed:', err);
          setHomeRisk({ status: 'error', score: null, url: null });
        } finally {
          setHomeChecking(false);
        }
      });
    } catch (e) {
      console.error('checkActiveTabRisk outer error:', e);
      setHomeRisk({ status: 'error', score: null, url: null });
      setHomeChecking(false);
    }
  }

  async function onSaveCredential(e) {
    e.preventDefault();
    const s = (form.site || "").trim();
    if (!autofillEnabled) { setStatusMessage("Autofill is disabled — cannot save."); return; }
    if (!s) { setStatusMessage("Please enter the Site URL."); return; }
    // Ensure a password value is provided before saving
    const p = (form.password || "").trim();
    if (!p) { setValidationAlert({ message: "Please enter the password to save.", type: 'error' }); return; }
    // Ensure username is provided too
    const u = (form.username || "").trim();
    if (!u) { setValidationAlert({ message: "Please enter the username/email to save.", type: 'error' }); return; }

    // Enforce complexity: min length, number, special char
    const minLen = 6;
    const hasNumber = /\d/.test(p);
    const hasSpecial = /[^A-Za-z0-9]/.test(p);
    if (p.length < minLen) { setValidationAlert({ message: `Password must be at least ${minLen} characters.`, type: 'error' }); return; }
    if (!hasNumber) { setValidationAlert({ message: 'Password must include at least one number.', type: 'error' }); return; }
    if (!hasSpecial) { setValidationAlert({ message: 'Password must include at least one special character (e.g. !@#$%).', type: 'error' }); return; }
    
    // If site hasn't been checked yet, trigger check now
    if (s && !siteRisk && !siteChecking && autofillEnabled) {
      setStatusMessage("⚠️ Checking site safety...");
      await onCheckSite(s);
      // After check completes, validation will happen on next render
      return;
    }
    
    // Block saving if currently checking
    if (siteChecking) {
      setStatusMessage("⚠️ Please wait for phishing check to complete...");
      return;
    }
    
    // Block saving if server is offline (no phishing check performed)
    if (siteRisk && siteRisk.serverOffline) {
      setStatusMessage("⚠️ Cannot save: ML Server is offline. Phishing detection required.");
      return;
    }
    
    // Block saving if site check failed but no serverOffline flag (error state)
    if (s && !siteRisk && autofillEnabled) {
      setStatusMessage("⚠️ Phishing check required before saving.");
      return;
    }

    // Always try to get PIN from encrypted session storage first
    getSessionPin(async (pin) => {
      if (pin) {
        // PIN retrieved successfully, update state and save
        if (!currentPin) {
          setCurrentPin(pin);
        }
        await performSave(s, pin);
      } else if (currentPin) {
        // Fallback to state if session retrieval fails
        await performSave(s, currentPin);
      } else {
        // No PIN available - this shouldn't happen if user is unlocked
        // Try to recover by checking if still unlocked
        isSessionUnlocked((unlocked) => {
          if (!unlocked) {
            // Session expired, need to re-authenticate
            setPendingAction('saveCredential');
            setPinPromptVisible(true);
            setStatusMessage("Session expired. Please enter your PIN.");
          } else {
            // Session active but PIN missing - error state
            setStatusMessage("Error: Unable to retrieve encryption key. Please reopen extension.");
          }
        });
      }
    });
  }
  
  async function performSave(s, pin) {
    try {
      // Defensive password complexity check in performSave as an extra
      // safeguard for any code path that might call this directly.
      const pwd = (form.password || "").trim();
      const minLen = 6;
      const hasNumber = /\d/.test(pwd);
      const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
      if (!pwd) {
        setStatusMessage("Please enter the password to save.");
        return;
      }
      if (pwd.length < minLen || !hasNumber || !hasSpecial) {
        setStatusMessage("Password must be at least 6 characters and include a number and a special character.");
        return;
      }

      // Do NOT trigger model detection here anymore.
      // We rely on the earlier on-blur check and simply save the credential.
      let siteUrl = s;
      if (!/^https?:\/\//i.test(siteUrl)) siteUrl = 'https://' + siteUrl;

      let favicon = '';
      try {
        const u = new URL(siteUrl);
        favicon = `${u.origin}/favicon.ico`;
      } catch (e) { favicon = ''; }

      let normalizedSite = form.site;
      try {
        const u2 = new URL(siteUrl);
        // Remove query parameters and hash - store only origin + pathname
        // This prevents issues with dynamic query params (e.g., Google sign-in URLs)
        let pathname = u2.pathname;
        // Optionally clean up common auth paths to just base path
        // e.g., /v3/signin/identifier -> /v3/signin
        if (pathname.includes('/signin/') || pathname.includes('/login/')) {
          const parts = pathname.split('/');
          const signinIndex = parts.findIndex(p => p === 'signin' || p === 'login');
          if (signinIndex > -1) {
            pathname = parts.slice(0, signinIndex + 1).join('/');
          }
        }
        normalizedSite = `${u2.origin}${pathname}`;
      } catch (e) {}

      const newCred = {
        id: Date.now(),
        site: normalizedSite,
        username: form.username,
        password: form.password,
        favicon: favicon,
        riskScore: siteRisk && typeof siteRisk.score === 'number' ? siteRisk.score : null,
        riskFactors: (siteRisk && siteRisk.features) || {}
      };

      // ENCRYPT credential before storing
      const encryptedCred = await encryptCredential(newCred, pin);
      console.log('[Save] Encrypted credential:', encryptedCred.id);
      
      // Load ENCRYPTED credentials from storage (not from state which has decrypted)
      loadStorageData(['rf_creds'], async (res) => {
        const storedEncryptedList = Array.isArray(res.rf_creds) ? res.rf_creds : [];
        console.log('[Save] Loaded', storedEncryptedList.length, 'credentials from storage');
        
        // Add new encrypted credential to the beginning
        const finalStorageList = [encryptedCred, ...storedEncryptedList];
        persist(finalStorageList);
        console.log('[Save] Saved', finalStorageList.length, 'credentials to storage');
        
        // NOW: Decrypt ALL credentials for display (including the new one)
        console.log('[Save] Starting decryption with PIN available:', !!pin);
        const decryptedForDisplay = [];
        for (const cred of finalStorageList) {
          if (cred.iv && cred.salt) {
            try {
              console.log('[Save] Decrypting credential:', cred.id);
              const dec = await decryptCredential(cred, pin);
              console.log('[Save] Decrypted successfully:', dec.site);
              decryptedForDisplay.push(dec);
            } catch (e) {
              console.error('[Save] Decryption failed for', cred.id, ':', e);
              decryptedForDisplay.push(cred); // Keep encrypted if fails
            }
          } else {
            decryptedForDisplay.push(cred);
          }
        }
        
        console.log('[Save] Total decrypted:', decryptedForDisplay.length);
        // Update display with ALL decrypted credentials
        setCredentials(decryptedForDisplay);
      });
      
      // Log password saved event
      logEvent(EventTypes.PASSWORD_SAVED, {
        domain: normalizedSite,
        riskScore: newCred.riskScore
      });
      
      setForm({ site: "", username: "", password: "" });
      setSiteRisk(null);
      setPage("home");
      setStatusMessage("Saved ✓ (Encrypted)");
    } catch (error) {
      console.error('[Encryption Error]', error);
      setStatusMessage("Encryption failed. Please try again.");
    }
  }

  function onDelete(id) {
    const deletedCred = credentials.find((c) => c.id === id);
    
    // Load encrypted credentials from storage, filter out the deleted one, save back
    loadStorageData(['rf_creds'], (res) => {
      const encryptedList = Array.isArray(res.rf_creds) ? res.rf_creds : [];
      const filteredEncrypted = encryptedList.filter((c) => c.id !== id);
      
      // Save filtered encrypted list back to storage
      persist(filteredEncrypted);
      
      // Update UI state (decrypted list)
      const filteredDecrypted = credentials.filter((c) => c.id !== id);
      setCredentials(filteredDecrypted);
      
      // Log password deleted event
      if (deletedCred) {
        logEvent(EventTypes.PASSWORD_DELETED, {
          domain: deletedCred.site
        });
      }
      
      setStatusMessage("Deleted");
    });
  }

  async function onClearCorrupted() {
    console.log('[Cleanup] Removing corrupted credentials from storage');
    
    loadStorageData(['rf_creds'], async (res) => {
      const storedList = Array.isArray(res.rf_creds) ? res.rf_creds : [];
      console.log('[Cleanup] Total stored credentials:', storedList.length);
      
      // Get PIN to test decryption
      getSessionPin(async (pin) => {
        if (!pin) {
          setStatusMessage("PIN required to clean up data");
          return;
        }
        
        // Filter out credentials that fail decryption
        const validCredentials = [];
        let removedCount = 0;
        
        for (const cred of storedList) {
          if (cred.iv && cred.salt) {
            try {
              await decryptCredential(cred, pin);
              validCredentials.push(cred); // Keep valid encrypted credentials
              console.log('[Cleanup] Valid credential:', cred.id);
            } catch (error) {
              removedCount++;
              console.log('[Cleanup] Removing corrupted credential:', cred.id);
            }
          } else {
            // Keep plaintext credentials (will be migrated)
            validCredentials.push(cred);
          }
        }
        
        console.log('[Cleanup] Removed', removedCount, 'corrupted credentials');
        console.log('[Cleanup] Keeping', validCredentials.length, 'valid credentials');
        
        // Save cleaned list
        persist(validCredentials);
        
        // Reset tampered count and refresh display
        setTamperedCount(0);
        setStatusMessage(`Cleaned ${removedCount} corrupted credential(s)`);
        
        // Log cleanup event
        logEvent(EventTypes.SECURITY_THREAT, {
          message: `Cleaned ${removedCount} corrupted credentials`,
          action: 'removed'
        });
        
        // Trigger reload
        setLoadTrigger(prev => prev + 1);
      });
    });
  }

  function onReveal(id) {
    // No PIN check here anymore - just toggle reveal
    const isRevealing = revealedId !== id;
    setRevealedId(revealedId === id ? null : id);
    
    // Log password revealed event (only when revealing, not hiding)
    if (isRevealing) {
      const cred = credentials.find((c) => c.id === id);
      if (cred) {
        logEvent(EventTypes.PASSWORD_REVEALED, {
          domain: cred.site
        });
      }
    }
  }

  function onCopy(text, domain = 'unknown') {
    navigator.clipboard.writeText(text).then(() => {
      setStatusMessage("Copied to clipboard");
      setTimeout(() => setStatusMessage(""), 1200);
      
      // Log password copied event
      logEvent(EventTypes.PASSWORD_COPIED, { domain });
    });
  }

  async function onOpenSite(savedSite) {
    let finalUrl = savedSite || '';
    if (!/^\s*https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl.trim();

    try {
      const u = new URL(finalUrl);

      // Known auth hosts: open origin only
      const authHosts = ['accounts.google.com', 'login.microsoftonline.com', 'login.live.com'];
      if (authHosts.some(h => u.hostname.includes(h))) {
        finalUrl = u.origin;
      } else {
        // Keep pathname, drop query string
        finalUrl = `${u.origin}${u.pathname}`;
      }

      // Availability check: try HEAD on the chosen URL and fall back to origin on failure
      try {
        const resp = await fetch(finalUrl, { method: 'HEAD', mode: 'cors' });
        if (!resp.ok) {
          finalUrl = u.origin;
        }
      } catch (e) {
        // network or CORS error — fallback to origin
        finalUrl = u.origin;
      }
    } catch (e) {
      // Invalid URL — open a blank page instead of causing errors
      finalUrl = 'about:blank';
    }

    chrome.tabs.create({ url: finalUrl });
  }

  function onFillCredential(cred) {
    // Log autofill event
    logEvent(EventTypes.PASSWORD_AUTOFILLED, {
      domain: cred.site
    });
    
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        let site = cred.site || "";
        if (!/^https?:\/\//i.test(site)) site = "https://" + site;

        if (tab && tab.id) {
          queryLoginState(tab.id, (resp) => {
            const tabIsLogin = !!(resp && resp.login);
            if (tabIsLogin) {
              fillCredential(tab.id, cred, () => {
                setStatusMessage('Filling current tab...');
              });
              return;
            }

            try {
              const tabUrl = tab.url || '';
              const tabOrigin = new URL(tabUrl).origin;
              const credOrigin = new URL(site).origin;
              if (tabOrigin === credOrigin) {
                fillCredential(tab.id, cred, () => {
                  setStatusMessage('Filling current tab...');
                });
                return;
              }
            } catch (e) {}

            openAndFill(site, cred);
            setStatusMessage('Opening site and filling...');
          });
        } else {
          openAndFill(site, cred);
          setStatusMessage('Opening site and filling...');
        }
      });
    } catch (e) {
      let site = cred.site || "";
      if (!/^https?:\/\//i.test(site)) site = "https://" + site;
      openAndFill(site, cred);
      setStatusMessage('Opening site and filling...');
    }
  }

  // PIN Setup handler
  const handlePinSetup = async (pin) => {
    await savePin(pin, () => {
      // Store PIN in React state
      setCurrentPin(pin);
      
      setPinSetupRequired(false);
      // Create encrypted session with PIN
      createSession(pin, () => {
        setPinUnlocked(true);
        setLoadTrigger(prev => prev + 1); // Force reload credentials
        setStatusMessage("PIN set successfully");
        
        // Log PIN created event
        logEvent(EventTypes.PIN_CREATED);
      });
    });
  };

  // PIN Unlock handler
  const handlePinUnlock = async (pin, callback) => {
    console.log('[PIN] handlePinUnlock called with PIN:', pin ? '****' : 'empty');
    loadStorageData(['rf_pin_hash'], async (res) => {
      console.log('[PIN] Loaded pin hash:', res.rf_pin_hash ? 'exists' : 'missing');
      const isValid = await verifyPin(pin, res.rf_pin_hash);
      
      console.log('[PIN] Verification result:', isValid);
      
      if (isValid) {
        console.log('[PIN] PIN correct, creating session...');
        // Store PIN in React state
        setCurrentPin(pin);
        
        // Log PIN verified event
        logEvent(EventTypes.PIN_VERIFIED);
        
        // Create encrypted session with PIN
        createSession(pin, () => {
          console.log('[PIN] Session created, unlocking...');
          setPinUnlocked(true);
          // Ensure vault is explicitly unlocked and reload credentials immediately
          setVaultLocked(false);
          setPinPromptVisible(false);
          setLoadTrigger(prev => prev + 1); // Force reload credentials after unlock

          // Also proactively load and decrypt credentials immediately to update UI
          try {
            loadStorageData(["rf_creds", "rf_autofill_enabled", "rf_vault_locked"], async (res) => {
              let list = Array.isArray(res.rf_creds) ? res.rf_creds : [];
              // Decrypt if PIN available
              if (list.length > 0) {
                const decryptedList = [];
                for (const cred of list) {
                  if (cred.iv && cred.salt) {
                    try {
                      const d = await decryptCredential(cred, pin);
                      decryptedList.push(d);
                    } catch (e) {
                      // keep original if decryption fails
                      decryptedList.push(cred);
                    }
                  } else {
                    decryptedList.push(cred);
                  }
                }
                setCredentials(decryptedList);
              } else {
                setCredentials([]);
              }

              // If pending turnOn action, DON'T restore old autofill state
              // Otherwise resolve stored autofill, falling back to current state if absent
              if (window.__pendingAction !== 'turnOn') {
                const storedAutofill = (typeof res.rf_autofill_enabled === 'boolean') ? res.rf_autofill_enabled : autofillEnabled;
                setAutofillEnabled(storedAutofill);
                if (typeof res.rf_vault_locked === 'boolean') {
                  setVaultLocked(res.rf_vault_locked);
                } else {
                  setVaultLocked(!storedAutofill);
                }
              }
            });
          } catch (e) {
            console.error('[PIN] Immediate load error', e);
          }
          
          // Execute pending action after state updates
          setTimeout(() => {
            console.log('[PIN] Executing pending action:', window.__pendingAction);
            if (window.__pendingAction === 'turnOn') {
              window.__pendingAction = null;
              console.log('[PIN] Calling performToggleOn()');
              
              // Explicitly set autofill state to ensure UI updates
              setAutofillEnabled(true);
              
              // Then call performToggleOn for side effects (logging, storage, background notify)
              performToggleOn();
              setStatusMessage("Autofill enabled — vault unlocked");
            } else {
              setStatusMessage("Unlocked");
            }
            
            // Execute pending save action if any
            if (pendingAction === 'saveCredential') {
              setPendingAction(null);
              // Re-trigger save now that we have PIN
              document.querySelector('form')?.requestSubmit();
            }
          }, 50);
        });
      } else {
        console.log('[PIN] PIN incorrect');
        // Log PIN failed event
        logEvent(EventTypes.PIN_FAILED);
      }
      
      callback(isValid);
    });
  };

  // Auto-lock on popup close (cleanup)
  useEffect(() => {
    return () => {
      // Clear session when popup closes
      clearSession();
    };
  }, []);

  // Keep session alive while unlocked: extend expiry every minute
  useEffect(() => {
    if (!pinUnlocked) {
      // If not unlocked, ensure no background extender is running
      try {
        if (sessionClearTimer.current) {
          clearInterval(sessionClearTimer.current);
          sessionClearTimer.current = null;
        }
      } catch (e) {}
      return;
    }

    // Immediately extend session once unlocked
    try { extendSession(() => {}); } catch (e) {}

    // Then extend periodically to prevent 5-minute expiry while active
    try {
      const id = setInterval(() => {
        extendSession(() => {});
      }, 60 * 1000); // every 60 seconds
      sessionClearTimer.current = id;
    } catch (e) {}

    // Cleanup when locking or unmounting
    return () => {
      try {
        if (sessionClearTimer.current) {
          clearInterval(sessionClearTimer.current);
          sessionClearTimer.current = null;
        }
      } catch (e) {}
    };
  }, [pinUnlocked]);

  return (
    <div className="popup">
      {validationAlert && (
        <div aria-modal="true" role="alertdialog" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: 420, maxWidth: '94%', background: '#0f1724', borderRadius: 10, padding: 18, boxShadow: '0 8px 30px rgba(0,0,0,0.6)', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: '#b71c1c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                !
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Missing information</div>
            </div>
            <div style={{ marginTop: 10, color: '#e6e6e6', fontSize: 14 }}>{validationAlert.message}</div>
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button className="btn-primary small" onClick={() => setValidationAlert(null)}>OK</button>
            </div>
          </div>
        </div>
      )}
      {/* PIN Setup Modal */}
      {pinSetupRequired && (
        <PinSetup onPinSet={handlePinSetup} />
      )}

      {/* PIN Prompt Modal */}
      {pinPromptVisible && !pinSetupRequired && (
        <PinPrompt 
          onUnlock={handlePinUnlock} 
          onCancel={() => setPinPromptVisible(false)}
        />
      )}

      <header className="popup-header">
        <div className="left">
          <button
            className={`btn-circle ${autofillEnabled ? "on" : "off"}`}
            onClick={toggleAutofill}
            aria-pressed={autofillEnabled}
            title={autofillEnabled ? "Disable detection & autofill" : "Enable detection & autofill"}
          >
            <PowerIcon />
          </button>
          <h1 className="title">Password Manager</h1>
        </div>
      </header>

      <div className="status-row">
        <div className="status-label">Autofill Detection</div>
        <div className="status-value">{autofillEnabled ? "ON" : "OFF"}</div>
      </div>

      {page === "home" && (
        <HomePage
          credentials={credentials}
          autofillEnabled={autofillEnabled}
          riskStatus={homeRisk?.status || 'unknown'}
          riskScore={homeRisk?.score ?? null}
          riskThreshold={homeRisk?.threshold ?? 0.5}
          riskChecking={homeChecking}
          onNavigateToVault={() => setPage("vault")}
          onNavigateToAdd={startAdd}
          tamperedCount={tamperedCount}
          onClearCorrupted={onClearCorrupted}
        />
      )}

      {page === "vault" && (
        <VaultPage
          vaultLocked={vaultLocked}
          credentials={filtered}
          canFill={canFill}
          currentTabUrl={currentTabUrl}
          checkUrlMatch={checkUrlMatchesCredentials}
          revealedId={revealedId}
          onBack={() => setPage("home")}
          onFillCredential={onFillCredential}
          onOpenSite={onOpenSite}
          onReveal={onReveal}
          onCopy={onCopy}
          onDelete={onDelete}
          tamperedCount={tamperedCount}
          onClearCorrupted={onClearCorrupted}
        />
      )}

      {page === "add" && (
        <AddPasswordPage
          form={form}
          onFormChange={setForm}
          onSave={onSaveCredential}
          onCheckSite={onCheckSite}
          siteRisk={siteRisk}
          siteChecking={siteChecking}
          onCancel={() => setPage("home")}
        />
      )}

      <div className="footer">
        {statusMessage && <div className="toast">{statusMessage}</div>}
        <div className="footer-row">
          <div className="version">v0.3</div>
          <button className="link-btn" onClick={() => exportLogsAsTxt(() => setStatusMessage("Logs exported"))}>
            Export Logs
          </button>
        </div>
      </div>
    </div>
  );
}
