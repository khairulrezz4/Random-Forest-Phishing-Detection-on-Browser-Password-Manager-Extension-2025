// public/background.js
// Background service worker: tracks per-tab login state and handles autofill requests

// Track login detection per tab and per frame to avoid false negatives from iframes
// Structure: tabState[tabId] = { frames: Map<frameId, boolean> }
const tabState = {};

// Track phishing risk per tab
const phishingState = {};

// Global switch for detection & autofill; default true
let autofillEnabled = true;

// Initialize from storage
try {
  chrome.storage?.local?.get(['rf_autofill_enabled'], (res) => {
    if (typeof res?.rf_autofill_enabled === 'boolean') {
      autofillEnabled = res.rf_autofill_enabled;
    }
  });
  // Keep in sync with storage changes (in case popup updates it)
  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area === 'local' && changes.rf_autofill_enabled) {
      autofillEnabled = !!changes.rf_autofill_enabled.newValue;
      if (!autofillEnabled) {
        // Clear state and badges when disabled
        for (const k of Object.keys(tabState)) delete tabState[k];
        chrome.tabs?.query?.({}, (tabs) => {
          (tabs || []).forEach(t => setBadge(t.id, false));
        });
      }
    }
  });
} catch (e) {}

function computeTabLogin(tabId) {
  const state = tabState[tabId];
  if (!state) return false;
  for (const v of state.frames.values()) {
    if (v) return true; // any frame reporting true => login page
  }
  return false;
}

function setBadge(tabId, login) {
  try {
    // Check if we have phishing status for this tab
    const phishing = phishingState[tabId];
    
    if (phishing && phishing.status === 'phishing') {
      // Phishing detected - red warning badge
      chrome.action.setBadgeText({ text: '⚠', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#dc3545', tabId });
      chrome.action.setTitle({ title: 'WARNING: Phishing site detected!', tabId });
    } else if (phishing && phishing.status === 'legit') {
      // Legitimate site - green check
      chrome.action.setBadgeText({ text: '✓', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#28a745', tabId });
      chrome.action.setTitle({ title: 'Site appears legitimate', tabId });
    } else if (login) {
      // Login page detected but no phishing check
      chrome.action.setBadgeText({ text: 'LOG', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#4f46e5', tabId });
      chrome.action.setTitle({ title: 'Login page detected', tabId });
    } else {
      // Clear badge
      chrome.action.setBadgeText({ text: '', tabId });
      chrome.action.setTitle({ title: 'Password Manager', tabId });
    }
  } catch (e) {}
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  // 0) allow popup to set autofill enabled/disabled immediately
  if (msg.type === 'set-autofill-enabled') {
    autofillEnabled = !!msg.enabled;
    chrome.storage?.local?.set({ rf_autofill_enabled: autofillEnabled });
    if (!autofillEnabled) {
      for (const k of Object.keys(tabState)) delete tabState[k];
      chrome.tabs?.query?.({}, (tabs) => {
        (tabs || []).forEach(t => setBadge(t.id, false));
      });
    } else {
      // Nudge current active tab frames so content scripts rescan immediately
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const tab = tabs && tabs[0];
          if (tab && tab.id) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id, allFrames: true },
              func: () => {
                try { window.dispatchEvent(new Event('focus')); } catch (e) {}
              }
            });
          }
        });
      } catch (e) {}
    }
    sendResponse && sendResponse({ ok: true, enabled: autofillEnabled });
    return true;
  }

  // 1) login detection messages from content script
  if (msg.type === 'login-detection' && sender && sender.tab) {
    const tabId = sender.tab.id;
    const frameId = sender.frameId ?? 0;
    if (!autofillEnabled) {
      // ignore detections when disabled
      if (tabState[tabId]) delete tabState[tabId];
      setBadge(tabId, false);
      return;
    }
    if (!tabState[tabId]) tabState[tabId] = { frames: new Map() };
    tabState[tabId].frames.set(frameId, !!msg.login);

    const login = computeTabLogin(tabId) && autofillEnabled;
    setBadge(tabId, login);
    return;
  }

  // 2) query from popup about a tab's login state
  if (msg.type === 'query-login-state') {
    const tabId = msg.tabId;
    const login = autofillEnabled && computeTabLogin(tabId);
    sendResponse({ login });
    return true;
  }

  // 2b) Update phishing status from popup
  if (msg.type === 'update-phishing-status') {
    const { tabId, status, score, threshold } = msg;
    if (tabId) {
      phishingState[tabId] = { status, score, threshold };
      const login = autofillEnabled && computeTabLogin(tabId);
      setBadge(tabId, login);
    }
    sendResponse && sendResponse({ ok: true });
    return true;
  }

  // 3) inject autofill into existing tab
  if (msg.action === 'fill_in_tab') {
    const { tabId, credential } = msg;
    if (!tabId || !credential) return;
    if (!autofillEnabled) { sendResponse && sendResponse({ ok: false, disabled: true }); return true; }

    chrome.scripting.executeScript(
      {
        target: { tabId, allFrames: true },
        func: (cred) => {
          try {
            function setNativeValue(el, value) {
              const last = el.value;
              el.focus && el.focus();
              const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value')?.set;
              if (setter) setter.call(el, value);
              else el.value = value;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              if (last !== value) el.dispatchEvent(new Event('change', { bubbles: true }));
            }

            function queryAllDeep(selector, root = document) {
              const results = Array.from(root.querySelectorAll(selector));
              const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
              let node;
              while ((node = walker.nextNode())) {
                if (node.shadowRoot) {
                  try { results.push(...queryAllDeep(selector, node.shadowRoot)); } catch (e) {}
                }
              }
              return results;
            }

            function findFields() {
              const passSelectors = ['input[type="password"]','input[name*=pass]','input[id*=pass]','input[placeholder*=pass]'];
              const userSelectors = ['input[type="email"]','input[name*=user]','input[name*=email]','input[id*=user]','input[id*=email]','input[placeholder*=user]','input[placeholder*=email]','input[type="text"]'];
              const pass = passSelectors.flatMap(sel => queryAllDeep(sel)).find(el => el.offsetParent);
              const user = userSelectors.flatMap(sel => queryAllDeep(sel)).find(el => el.offsetParent);
              return { user, pass };
            }

            const { user, pass } = findFields();
            if (!user && !pass) return { ok: false, reason: 'no-fields' };
            if (user) setNativeValue(user, cred.username || '');
            if (pass) setNativeValue(pass, cred.password || '');
            return { ok: true };
          } catch (e) { return { ok: false, error: e && e.message }; }
        },
        args: [credential]
      },
      (results) => {
        if (chrome.runtime.lastError) {
          if (sendResponse) sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        if (sendResponse) sendResponse({ ok: true });
      }
    );

    return true;
  }

  // 4) open a new tab and autofill it
  if (msg.action === 'open_and_fill') {
    const { siteUrl, credential } = msg;
    if (!siteUrl || !credential) return;
    if (!autofillEnabled) { return; }

    chrome.tabs.create({ url: siteUrl }, (tab) => {
      if (!tab || !tab.id) return;
      const tabId = tab.id;

      // wait until the tab finishes loading before injecting
      const onUpdated = (updatedTabId, changeInfo) => {
        if (updatedTabId !== tabId) return;
        if (changeInfo.status && (changeInfo.status === 'complete' || changeInfo.status === 'loading')) {
          // inject autofill and then remove listener
          try {
            chrome.scripting.executeScript({
              target: { tabId, allFrames: true },
              func: (cred) => {
                try {
                  function setNativeValue(el, value) {
                    const last = el.value;
                    el.focus && el.focus();
                    const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value')?.set;
                    if (setter) setter.call(el, value);
                    else el.value = value;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    if (last !== value) el.dispatchEvent(new Event('change', { bubbles: true }));
                  }

                  function queryAllDeep(selector, root = document) {
                    const results = Array.from(root.querySelectorAll(selector));
                    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
                    let node;
                    while ((node = walker.nextNode())) {
                      if (node.shadowRoot) {
                        try { results.push(...queryAllDeep(selector, node.shadowRoot)); } catch (e) {}
                      }
                    }
                    return results;
                  }

                  function findFields() {
                    const passSelectors = ['input[type="password"]','input[name*=pass]','input[id*=pass]','input[placeholder*=pass]'];
                    const userSelectors = ['input[type="email"]','input[name*=user]','input[name*=email]','input[id*=user]','input[id*=email]','input[placeholder*=user]','input[placeholder*=email]','input[type="text"]'];
                    const pass = passSelectors.flatMap(sel => queryAllDeep(sel)).find(el => el.offsetParent);
                    const user = userSelectors.flatMap(sel => queryAllDeep(sel)).find(el => el.offsetParent);
                    return { user, pass };
                  }

                  const { user, pass } = findFields();
                  if (user) setNativeValue(user, cred.username || '');
                  if (pass) setNativeValue(pass, cred.password || '');
                } catch (e) {}
              },
              args: [credential]
            });
          } catch (e) {}
          chrome.tabs.onUpdated.removeListener(onUpdated);
        }
      };

      chrome.tabs.onUpdated.addListener(onUpdated);
    });

    return;
  }
});

// Clear tab state when a tab reloads or is removed to avoid stale frame info
try {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      delete tabState[tabId];
      delete phishingState[tabId];
      setBadge(tabId, false);
    }
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    delete tabState[tabId];
    delete phishingState[tabId];
  });
} catch (e) {}
