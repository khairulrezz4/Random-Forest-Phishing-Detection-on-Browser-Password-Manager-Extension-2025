// src/components/VaultPage.jsx
import React from "react";
import RiskIndicator from "./RiskIndicator";

export default function VaultPage({ 
  vaultLocked, 
  credentials, 
  canFill, 
  currentTabUrl,
  checkUrlMatch,
  revealedId,
  onBack,
  onFillCredential,
  onOpenSite,
  onReveal,
  onCopy,
  onDelete,
  tamperedCount,
  onClearCorrupted
}) {
  return (
    <>
      <div className="page-header">
        <button className="btn btn-back" onClick={onBack}>
          <span>←</span>
          <span>Back</span>
        </button>
        <h2 className="page-title">Password Vault</h2>
      </div>

      {tamperedCount > 0 && (
        <div style={{
          backgroundColor: '#ff4444',
          color: 'white',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '12px',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <div>Security Alert: Data Tampering Detected</div>
              <div style={{ fontSize: '12px', fontWeight: '400', marginTop: '4px', opacity: 0.9 }}>
                {tamperedCount} corrupted credential(s) rejected. Your data may have been tampered with.
              </div>
            </div>
          </div>
          <button
            onClick={onClearCorrupted}
            style={{
              backgroundColor: 'white',
              color: '#ff4444',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            🗑️ Remove Corrupted Data
          </button>
        </div>
      )}

      {vaultLocked ? (
        <div className="empty" style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Vault is locked</div>
          <div className="small-muted">Turn on Autofill Detection to unlock your vault.</div>
        </div>
      ) : (
        <div className="vault-content">
          {credentials.length === 0 ? (
            <div className="empty">No saved credentials</div>
          ) : (
            credentials.map((cred) => {
              // Check if this specific credential matches the current URL
              const credMatches = currentTabUrl && checkUrlMatch && checkUrlMatch(currentTabUrl, [cred]);
              const canFillThisCred = canFill || credMatches;
              
              return (
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
                      <RiskIndicator score={cred.riskScore} display="label" threshold={cred.riskThreshold} />
                    )}
                  </div>
                  <div className="cred-username">{cred.username}</div>
                  <div className="cred-actions">
                    <button
                      className={`btn btn-fill ${canFillThisCred ? '' : 'disabled'}`}
                      onClick={() => onFillCredential(cred)}
                      disabled={!canFillThisCred}
                      title={canFillThisCred ? "Fill on this login page" : "Fill disabled — this site doesn't match current page"}
                    >
                      Fill
                    </button>

                    <button
                      className="btn btn-open"
                      onClick={() => onOpenSite(cred.site)}
                    >
                      Open
                    </button>

                    <button
                      className="btn btn-reveal"
                      onClick={() => onReveal(cred.id)}
                    >
                      {revealedId === cred.id ? "Hide" : "Reveal"}
                    </button>

                    {revealedId === cred.id && (
                      <div className="reveal-row">
                        <div className="password-mono">{cred.password}</div>
                        <button 
                          className="icon-btn copy-btn" 
                          onClick={() => onCopy(cred.password, cred.site)} 
                          title="Copy password"
                        >
                          Copy
                        </button>
                      </div>
                    )}

                    <button 
                      className="icon-btn delete-btn" 
                      title="Delete" 
                      onClick={() => onDelete(cred.id)}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
