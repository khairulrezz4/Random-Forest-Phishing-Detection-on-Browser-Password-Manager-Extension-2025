// src/utils/chrome.js
export function getActiveTabUrl(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab) return callback(null);
    callback(tab.url);
  });
}

export function persistCredentials(list, callback) {
  chrome.storage.local.set({ rf_creds: list }, callback);
}

export function loadStorageData(keys, callback) {
  chrome.storage.local.get(keys, callback);
}

export function saveStorageData(data, callback) {
  chrome.storage.local.set(data, callback);
}

export function queryLoginState(tabId, callback) {
  chrome.runtime.sendMessage({ type: 'query-login-state', tabId }, callback);
}

export function setAutofillEnabled(enabled, callback) {
  chrome.runtime.sendMessage({ type: 'set-autofill-enabled', enabled }, callback);
}

export function fillCredential(tabId, credential, callback) {
  chrome.runtime.sendMessage({ action: 'fill_in_tab', tabId, credential }, callback);
}

export function openAndFill(siteUrl, credential) {
  chrome.runtime.sendMessage({ action: 'open_and_fill', siteUrl, credential });
}
