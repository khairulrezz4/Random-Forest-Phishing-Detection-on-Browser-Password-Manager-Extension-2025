// src/RFPasswordManagerPopup.jsx
import React, { useState, useEffect } from "react";
import "./index.css";

// Local model query helpers
function getActiveTabUrl(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab) return callback(null);
    callback(tab.url);
  });
}

async function queryLocalModel(url) {
  try {
    const resp = await fetch("http://127.0.0.1:5000/predict_url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    if (!resp.ok) {
      const j = await resp.json().catch(()=>null);
      throw new Error("Model error: " + (j ? JSON.stringify(j) : resp.status));
    }
    return await resp.json();
  } catch (err) {
    throw err;
  }
}

/* Inline icons */
const PowerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
    <path fill="currentColor" d="M13 3h-2v10h2zM12 1a11 11 0 1011 11A11 11 0 0012 1z" />
  </svg>
);
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
    <path fill="currentColor" d="M17 8V7a5 5 0 10-10 0v1H5v14h14V8zM9 7a3 3 0 116 0v1H9z" />
  </svg>
);
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
    <path fill="currentColor" d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2z" />
  </svg>
);

// Risk indicator component
const RiskIndicator = ({ score }) => {
  if (!score && score !== 0) return null;
  
  const percent = (score * 100).toFixed(1);
  let color = '';
  let icon = '';
  
  if (score >= 0.5) {
    color = '#dc3545';  // Red
    icon = '🚫';
  } else if (score >= 0.3) {
    color = '#ffc107';  // Yellow
    icon = '⚠️';
  } else if (score >= 0.1) {
    color = '#17a2b8';  // Info blue
    icon = 'ℹ️';
  } else {
    color = '#28a745';  // Green
    icon = '✓';
  }
  
  return (
    <div className="risk-indicator" 
         title={`Risk Score: ${percent}%${score >= 0.3 ? ' - Exercise caution' : ''}`}
         style={{ 
           display: 'inline-flex',
           alignItems: 'center',
           padding: '0 6px',
           fontSize: '12px',
           color: color,
           gap: '4px'
         }}>
      <span>{icon}</span>
      <span>{percent}%</span>
    </div>
  );
};

export default function RFPasswordManagerPopup() {
  const [vaultLocked, setVaultLocked] = useState(true);
  const [autofillEnabled, setAutofillEnabled] = useState(true);
  const [page, setPage] = useState("home"); // 'home' or 'add' or 'vault'
  const [query, setQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [credentials, setCredentials] = useState([]);
  const [canFill, setCanFill] = useState(false);
  const [form, setForm] = useState({ site: "", username: "", password: "" });
  const [revealedId, setRevealedId] = useState(null);

  // load credentials and settings from chrome.storage when popup opens
  useEffect(() => {
    chrome.storage.local.get(["rf_creds","rf_autofill_enabled","rf_vault_locked"], (res) => {
      const list = Array.isArray(res.rf_creds) ? res.rf_creds : [];
      setCredentials(list);
      if (typeof res.rf_autofill_enabled === 'boolean') {
        setAutofillEnabled(res.rf_autofill_enabled);
      }
      if (typeof res.rf_vault_locked === 'boolean') {
        setVaultLocked(res.rf_vault_locked);
      }
    });
  }, []);

  useEffect(() => {
    // when popup opens, query current active tab and ask background if it's a login page
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab) { setCanFill(false); return; }
      // When disabled, canFill is false regardless of page
      if (!autofillEnabled) { setCanFill(false); return; }
      chrome.runtime.sendMessage({ type: 'query-login-state', tabId: tab.id }, (resp) => {
        setCanFill(!!(resp && resp.login));
      });
    });

    // optional: listen for tab activation (if you keep popup open while switching tabs)
    const onActivated = (info) => {
      chrome.runtime.sendMessage({ type: 'query-login-state', tabId: info.tabId }, (resp) => {
        setCanFill(!!(resp && resp.login));
      });
    };
    chrome.tabs.onActivated && chrome.tabs.onActivated.addListener(onActivated);
    return () => {
      chrome.tabs.onActivated && chrome.tabs.onActivated.removeListener(onActivated);
    };
  }, []);

  // helper: persist to chrome.storage
  const persist = (list) => {
    chrome.storage.local.set({ rf_creds: list }, () => {
      setCredentials(list);
    });
  };

  const filtered = credentials.filter(
    (c) =>
      c.site.toLowerCase().includes(query.toLowerCase()) ||
      (c.username || "").toLowerCase().includes(query.toLowerCase())
  );

  function toggleAutofill() {
    const next = !autofillEnabled;
    setAutofillEnabled(next);
    chrome.storage?.local?.set({ rf_autofill_enabled: next });
    // notify background immediately
    try {
      chrome.runtime.sendMessage({ type: 'set-autofill-enabled', enabled: next });
    } catch (e) {}
    // Couple the vault lock with the toggle for immediate visible change in the Vault view
    if (next) {
      // Turning ON -> auto-unlock the vault
      setVaultLocked(false);
      chrome.storage?.local?.set({ rf_vault_locked: false });
      setStatusMessage("Autofill enabled — vault unlocked");
    } else {
      // Turning OFF -> auto-lock the vault for privacy
      setVaultLocked(true);
      chrome.storage?.local?.set({ rf_vault_locked: true });
      setStatusMessage("Autofill disabled — vault locked");
    }

    if (!next) {
      setCanFill(false);
    } else {
      // Recompute canFill right away and again shortly after to allow rescans
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const tab = tabs && tabs[0];
          if (!tab) { setCanFill(false); return; }
          const queryState = () => {
            chrome.runtime.sendMessage({ type: 'query-login-state', tabId: tab.id }, (resp) => {
              setCanFill(!!(resp && resp.login));
            });
          };
          queryState();
          setTimeout(queryState, 400);
          setTimeout(queryState, 1200);
        });
      } catch (e) {}
    }
  }

  // Prefill the Add form with the current active tab's site/origin
  function startAdd() {
    // query the active tab in the current window
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        let siteValue = '';
        if (tab && tab.url) {
          try {
            // Try to parse the URL and use origin (scheme + host) for clarity
            const u = new URL(tab.url);
            // Prefer the exact login route: origin + pathname (omit query/fragment)
            // Example: https://secure.lemonde.fr/sfuser/connexion
            siteValue = `${u.origin}${u.pathname}`;
          } catch (e) {
            // url could be something like 'chrome://...' - leave siteValue empty
            siteValue = '';
          }
        }
        // set the form and open the Add page
        setForm((prev) => ({ ...prev, site: siteValue }));
        setPage('add');
      });
    } catch (e) {
      // In case chrome.* APIs aren't available (e.g. in dev preview), just open add page
      setForm((prev) => ({ ...prev, site: '' }));
      setPage('add');
    }
  }

  function onSaveCredential(e) {
    e.preventDefault();
    setStatusMessage("Checking site...");

    // First, query the model for the site
    const checkSite = async () => {
      const s = (form.site || "").toLowerCase();
      if (!autofillEnabled) {
        setStatusMessage("Autofill is disabled — cannot save.");
        return;
      }
      if (!s) {
        setStatusMessage("Please enter the Site URL.");
        return;
      }

      // Normalize URL for model check
      let siteUrl = s;
      if (!/^https?:\/\//i.test(siteUrl)) {
        siteUrl = 'https://' + siteUrl;
      }

      try {
        const result = await queryLocalModel(siteUrl);

        const riskScore = result.probability || 0;
        const riskPercent = (riskScore * 100).toFixed(1);
        
        // Get the top suspicious features if any
        const topFeatures = result.feature_importance || {};
        const suspiciousFeatures = Object.entries(topFeatures)
          .filter(([_, score]) => score > 0.1)
          .map(([feature]) => feature.replace(/_/g, ' '))
          .slice(0, 3);

        // Risk level handling
        if (riskScore >= 0.5) {  // High risk: 50%+ -> block
          setStatusMessage(
            `🚫 High-risk site detected (${riskPercent}% risk score)
             Suspicious patterns: ${suspiciousFeatures.join(', ') || 'multiple factors'}
             Save blocked for your security`
          );
          return;
        }
        
        if (riskScore >= 0.3) {  // Medium risk: 30-49% -> warn but allow
          const details = suspiciousFeatures.length 
            ? `\nSuspicious patterns: ${suspiciousFeatures.join(', ')}`
            : '';
            
          if (!confirm(
            `⚠️ Warning: This site has some suspicious characteristics ` +
            `(${riskPercent}% risk score)${details}\n\n` +
            `Are you sure you want to save credentials?`
          )) {
            setStatusMessage("Save cancelled");
            return;
          }
          // User confirmed - continue with save but note the risk
          setStatusMessage(`Saved (with ${riskPercent}% risk noted)`);
        }
        
        if (riskScore > 0.1) {  // Low risk: 10-29% -> info only
          setStatusMessage(`ℹ️ Site verified (${riskPercent}% risk score - considered low risk)`);
        }

        // Site passed the model check, compute favicon and save
        let favicon = '';
        try {
          const u = new URL(siteUrl);
          favicon = `${u.origin}/favicon.ico`;
        } catch (e) { favicon = ''; }

        // Normalize and store the exact login URL (origin + pathname)
        let normalizedSite = form.site;
        try {
          const u2 = new URL(siteUrl);
          normalizedSite = `${u2.origin}${u2.pathname}`;
        } catch (e) {}

        const newCred = {
          id: Date.now(),
          site: normalizedSite,
          username: form.username,
          password: form.password,
          favicon: favicon,
          riskScore: result.probability || 0,  // Store the risk score with the credential
          riskFactors: result.feature_importance || {}  // Store top risk factors
        };
        const list = [newCred, ...credentials];
        persist(list);
        setForm({ site: "", username: "", password: "" });
        setPage("home");
        setStatusMessage("Site verified & saved ✓");
      } catch (e) {
        setStatusMessage("Could not verify site safety — model error");
      }
    };
    checkSite();
  }

  function onDelete(id) {
    const list = credentials.filter((c) => c.id !== id);
    persist(list);
    setStatusMessage("Deleted");
  }

  function onReveal(id) {
    setRevealedId(revealedId === id ? null : id);
  }

  function onCopy(text) {
    // copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
      setStatusMessage("Copied to clipboard");
      setTimeout(() => setStatusMessage(""), 1200);
    });
  }

  function onOpenSite(savedSite) {
    // savedSite is already normalized (origin+pathname). Ensure scheme is present.
    let finalUrl = savedSite;
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
    try {
      const u = new URL(finalUrl);
      // Strip potential trailing slashes duplication
      finalUrl = `${u.origin}${u.pathname}`;
    } catch (e) {}
    chrome.tabs.create({ url: finalUrl });
  }

  function onFillCredential(cred) {
    // Prefer filling the active tab when possible. If the active tab is a detected
    // login page (or shares the same origin as the credential site) send
    // 'fill_in_tab'. Otherwise fall back to opening a new tab and filling it
    // with 'open_and_fill'.
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        let site = cred.site || "";
        if (!/^https?:\/\//i.test(site)) site = "https://" + site;

        if (tab && tab.id) {
          // Ask background whether this tab was detected as a login page
          chrome.runtime.sendMessage({ type: 'query-login-state', tabId: tab.id }, (resp) => {
            const tabIsLogin = !!(resp && resp.login);
            // If the background thinks it's a login page, fill in-place
            if (tabIsLogin) {
              chrome.runtime.sendMessage({ action: 'fill_in_tab', tabId: tab.id, credential: cred }, (r) => {
                setStatusMessage('Filling current tab...');
              });
              return;
            }

            // Otherwise, as a secondary heuristic, compare origins and fill in-place
            try {
              const tabUrl = tab.url || '';
              const tabOrigin = new URL(tabUrl).origin;
              const credOrigin = new URL(site).origin;
              if (tabOrigin === credOrigin) {
                chrome.runtime.sendMessage({ action: 'fill_in_tab', tabId: tab.id, credential: cred }, (r) => {
                  setStatusMessage('Filling current tab...');
                });
                return;
              }
            } catch (e) {
              // ignore URL parse errors and fall back to opening
            }

            // Fallback: open a new tab and fill
            chrome.runtime.sendMessage({ action: 'open_and_fill', siteUrl: site, credential: cred });
            setStatusMessage('Opening site and filling...');
          });
        } else {
          // No active tab available — open a new one
          chrome.runtime.sendMessage({ action: 'open_and_fill', siteUrl: site, credential: cred });
          setStatusMessage('Opening site and filling...');
        }
      });
    } catch (e) {
      // If chrome.* isn't available for some reason, fall back
      let site = cred.site || "";
      if (!/^https?:\/\//i.test(site)) site = "https://" + site;
      chrome.runtime.sendMessage({ action: 'open_and_fill', siteUrl: site, credential: cred });
      setStatusMessage('Opening site and filling...');
    }
  }

  return (
    <div className="popup">
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
          <h1 className="title">RF Password</h1>
        </div>
      </header>

      <div className="status-row">
        <div className="status-label">AI Autofill Detection</div>
        <div className="status-value">{autofillEnabled ? "ON" : "OFF"}</div>
      </div>

      {page === "home" && (
        <div className="home-actions">
          <button className="btn-action" onClick={() => setPage("vault")}>
            <span className="btn-icon">🔐</span>
            <span className="btn-main">
              <span className="btn-title">Password Vault</span>
              <span className="btn-subtitle">{credentials.length} passwords saved</span>
            </span>
          </button>
          
          <button className="btn-action" onClick={startAdd}>
            <span className="btn-icon">➕</span>
            <span className="btn-main">
              <span className="btn-title">Add Password</span>
              <span className="btn-subtitle">Save a new credential</span>
            </span>
          </button>
        </div>
      )}

      {page === "vault" && (
        <>
          <div className="page-header">
            <button className="btn btn-back" onClick={() => setPage("home")}>
              <span>←</span>
              <span>Back</span>
            </button>
            <h2 className="page-title">Password Vault</h2>
          </div>

          {vaultLocked ? (
            <div className="empty" style={{ textAlign:'left' }}>
              <div style={{fontWeight:600, marginBottom:6}}>Vault is locked</div>
              <div className="small-muted">Click the lock icon in the top-right to unlock your vault.</div>
            </div>
          ) : (
          <div className="vault-content">
            {filtered.length === 0 ? (
              <div className="empty">No saved credentials</div>
            ) : (
              filtered.map((cred) => (
                <div className="cred-item" key={cred.id}>
                  <div className="avatar">
                    {cred.favicon ? (
                      <img
                        src={cred.favicon}
                        alt={cred.site}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : null}
                    <div className="initial">{(cred.site || "U")[0].toUpperCase()}</div>
                  </div>
                  <div className="cred-main">
                    <div className="cred-site-row">
                      <div className="cred-site">{cred.site}</div>
                      {typeof cred.riskScore !== 'undefined' && (
                        <RiskIndicator score={cred.riskScore} />
                      )}
                    </div>
                    <div className="cred-username">{cred.username}</div>
                    <div className="cred-actions">
                      <button
                        className={`btn btn-fill ${canFill ? '' : 'disabled'}`}
                        onClick={() => onFillCredential(cred)}
                        disabled={!canFill}
                        title={canFill ? "Fill on this login page" : "Fill disabled — this tab doesn't look like a login page"}
                      >
                        Fill
                      </button>

                      <button
                        className="btn btn-open"
                        onClick={() => {
                          onOpenSite(cred.site);
                        }}
                      >
                        Open
                      </button>

                      <button
                        className="btn btn-reveal"
                        onClick={() => {
                          onReveal(cred.id);
                        }}
                      >
                        {revealedId === cred.id ? "Hide" : "Reveal"}
                      </button>

                      {revealedId === cred.id && (
                        <div className="reveal-row">
                          <div className="password-mono">{cred.password}</div>
                          <button className="icon-btn copy-btn" onClick={() => onCopy(cred.password)} title="Copy password">
                            Copy
                          </button>
                        </div>
                      )}

                      <button className="icon-btn delete-btn" title="Delete" onClick={() => onDelete(cred.id)}>
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          )}
        </>
      )}

      {page === "add" && (
        <div className="add-form">
          <div className="form-header">
            <button className="icon-btn" onClick={() => setPage("home")} title="Back">
              ←
            </button>
            <div className="form-title">Add Credential</div>
          </div>

          <form onSubmit={onSaveCredential}>
            <label className="form-label">Site URL</label>
            <input
              className="input"
              value={form.site}
              onChange={(e) => setForm({ ...form, site: e.target.value })}
              placeholder="example.com or https://example.com"
            />

            <label className="form-label">Username / Email</label>
            <input
              className="input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />

            <label className="form-label">Password</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />

            <div className="row actions-row" style={{ marginTop: 12 }}>
              <button type="button" className="btn-muted small" onClick={() => setPage("home")}>
                Cancel
              </button>
              <button type="submit" className="btn-primary small">
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="footer">
        {statusMessage && <div className="toast">{statusMessage}</div>}
        <div className="footer-row">
          <div className="version">v0.1</div>
          <button className="link-btn" onClick={() => alert("Open settings (implement)")}>
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}
