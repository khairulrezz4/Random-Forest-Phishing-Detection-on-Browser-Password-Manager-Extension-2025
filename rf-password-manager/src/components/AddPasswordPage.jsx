// src/components/AddPasswordPage.jsx
import React, { useEffect, useRef } from "react";
import RiskIndicator from "./RiskIndicator";

export default function AddPasswordPage({ 
  form, 
  onFormChange, 
  onSave, 
  onCancel,
  onCheckSite,
  siteRisk,
  siteChecking
}) {
  const debounceTimer = useRef(null);

  const username = (form.username || '').trim();
  const password = (form.password || '').trim();
  const passwordMinLen = 6;
  const usernameMissing = username.length === 0;
  const passwordMissing = password.length === 0;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const passwordTooShort = password.length > 0 && password.length < passwordMinLen;
  const passwordMissingNumber = password.length > 0 && !hasNumber;
  const passwordMissingSpecial = password.length > 0 && !hasSpecial;
  const passwordTooWeak = password.length > 0 && (passwordTooShort || passwordMissingNumber || passwordMissingSpecial);
  const canSave = !siteRisk?.serverOffline && !usernameMissing && !passwordMissing && !passwordTooWeak;

  // Auto-check site when URL changes (with debounce)
  useEffect(() => {
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const siteUrl = (form.site || '').trim();
    
    // Only check if there's a URL and it looks valid
    if (siteUrl && siteUrl.length > 3 && onCheckSite) {
      // Wait 1 second after user stops typing before checking
      debounceTimer.current = setTimeout(() => {
        onCheckSite(siteUrl);
      }, 1000);
    }

    // Cleanup on unmount
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [form.site, onCheckSite]);

  return (
    <div className="add-form">
      <div className="form-header">
        <button className="icon-btn" onClick={onCancel} title="Back">
          ←
        </button>
        <div className="form-title">Add Credential</div>
      </div>

      <form onSubmit={onSave}>
        <label className="form-label">Site URL</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="input"
            value={form.site}
            readOnly
            aria-readonly="true"
            title="Captured from current tab; editing disabled"
            placeholder="Captured from current tab"
            style={{ flex: 1, cursor: 'not-allowed' }}
          />
          {siteChecking ? (
            <span style={{ fontSize: 12, color: '#666' }}>checking…</span>
          ) : siteRisk && typeof siteRisk.score === 'number' ? (
            <RiskIndicator 
              score={siteRisk.score} 
              display="label" 
              threshold={siteRisk.threshold ?? 0.5}
            />
          ) : null}
        </div>
        <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
          URL is captured automatically from the active tab and cannot be edited.
        </div>
        {siteRisk && siteRisk.message && (
          <div style={{ 
            fontSize: 12, 
            color: siteRisk.serverOffline ? '#ff9800' : '#666', 
            marginTop: 6,
            padding: siteRisk.serverOffline ? '8px' : '0',
            backgroundColor: siteRisk.serverOffline ? '#fff3e0' : 'transparent',
            borderRadius: siteRisk.serverOffline ? '4px' : '0',
            border: siteRisk.serverOffline ? '1px solid #ffb74d' : 'none'
          }}>
            {siteRisk.message}
          </div>
        )}

        <label className="form-label">Username / Email</label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            className="input"
            value={form.username}
            onChange={(e) => onFormChange({ ...form, username: e.target.value })}
            style={{ flex: 1 }}
          />
        </div>

        <label className="form-label" style={{ marginTop: 12 }}>Password</label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(e) => onFormChange({ ...form, password: e.target.value })}
            style={{ flex: 1 }}
          />
        </div>

        {/* Combined helper box below inputs for compact messages */}
        {(usernameMissing || passwordMissing || passwordTooWeak) && (
          <div style={{ marginTop: 12 }}>
            <div style={{ background: '#1a242f', border: '1px solid #3a444f', padding: 12, borderRadius: 8, color: '#ffd2c2', fontSize: 13 }}>
              {usernameMissing && (
                <div style={{ marginBottom: 8 }}>
                  <strong>Username missing</strong>
                  <div style={{ fontSize: 12, color: '#cbd5e1' }}>Please enter the account username or email.</div>
                </div>
              )}
              {passwordMissing && (
                <div style={{ marginBottom: 8 }}>
                  <strong>Password missing</strong>
                  <div style={{ fontSize: 12, color: '#cbd5e1' }}>Please enter the account password.</div>
                </div>
              )}
              {(!passwordMissing && passwordTooWeak) && (
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6, color: '#fff6d8' }}>Weak password</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#dbeafe' }}>
                    {passwordTooShort && <li>At least {passwordMinLen} characters</li>}
                    {passwordMissingNumber && <li>Include at least one number</li>}
                    {passwordMissingSpecial && <li>Include at least one special character (e.g. !@#$%)</li>}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* (Removed block) validation messages are shown inline beside inputs */}

        <div className="row actions-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn-muted small" onClick={onCancel}>
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn-primary small"
            disabled={!canSave}
            title={!canSave ? (siteRisk?.serverOffline ? 'Server required' : 'Complete required fields') : 'Save credential'}
            style={{
              opacity: (!canSave) ? 0.5 : 1,
              cursor: (!canSave) ? 'not-allowed' : 'pointer'
            }}
          >
            { !canSave ? (siteRisk?.serverOffline ? 'Server Required' : 'Save') : 'Save' }
          </button>
        </div>
      </form>
    </div>
  );
}
