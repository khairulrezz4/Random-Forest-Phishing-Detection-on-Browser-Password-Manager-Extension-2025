// src/components/HomePage.jsx
import React from "react";
import RiskIndicator from "./RiskIndicator";

export default function HomePage({ 
  credentials, 
  autofillEnabled, 
  riskStatus = 'unknown', 
  riskScore = null,
  riskThreshold = 0.5,
  riskChecking = false,
  onNavigateToVault, 
  onNavigateToAdd,
  tamperedCount = 0,
  onClearCorrupted
}) {
  const isPhishing = riskStatus === 'phishing';
  const isLegit = riskStatus === 'legit';
  const addDisabled = !autofillEnabled || isPhishing;

  // Risk banner content
  const getRiskBanner = () => {
    if (riskChecking) {
      return (
        <div className="risk-banner" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <span className="risk-banner-icon checking">🔍</span>
          <div className="risk-banner-text">
            <div className="risk-banner-title" style={{ color: 'var(--text-secondary)' }}>Analyzing Site...</div>
            <div className="risk-banner-subtitle">Checking for phishing indicators</div>
          </div>
        </div>
      );
    }
    
    if (isPhishing) {
      return (
        <div className="risk-banner danger">
          <span className="risk-banner-icon">🚨</span>
          <div className="risk-banner-text">
            <div className="risk-banner-title" style={{ color: 'var(--danger)' }}>Phishing Detected!</div>
            <div className="risk-banner-subtitle">This site may be dangerous</div>
          </div>
          <RiskIndicator score={riskScore} display="label" threshold={riskThreshold} />
        </div>
      );
    }
    
    if (isLegit) {
      return (
        <div className="risk-banner safe">
          <span className="risk-banner-icon">✅</span>
          <div className="risk-banner-text">
            <div className="risk-banner-title" style={{ color: 'var(--success)' }}>Site Verified</div>
            <div className="risk-banner-subtitle">No threats detected</div>
          </div>
          <RiskIndicator score={riskScore} display="label" threshold={riskThreshold} />
        </div>
      );
    }
    
    return (
      <div className="risk-banner" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        <span className="risk-banner-icon">❓</span>
        <div className="risk-banner-text">
          <div className="risk-banner-title" style={{ color: 'var(--text-muted)' }}>Status Unknown</div>
          <div className="risk-banner-subtitle">Unable to verify this site</div>
        </div>
      </div>
    );
  };

  return (
    <div className="home-actions">
      {getRiskBanner()}
      
      {tamperedCount > 0 && (
        <div style={{
          backgroundColor: 'rgba(255, 68, 68, 0.1)',
          border: '2px solid #ff4444',
          color: '#ff4444',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '12px',
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div style={{ fontWeight: '600' }}>Security Alert: {tamperedCount} tampered credential(s) detected and rejected!</div>
          </div>
          <button
            onClick={onClearCorrupted}
            style={{
              backgroundColor: '#ff4444',
              color: 'white',
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
      
      <button className="btn-action" onClick={onNavigateToVault}>
        <span className="btn-icon">🔐</span>
        <span className="btn-main">
          <span className="btn-title">Password Vault</span>
          <span className="btn-subtitle">{credentials.length} password{credentials.length !== 1 ? 's' : ''} saved</span>
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--accent-secondary)', fontSize: '20px' }}>→</span>
      </button>
      
      <button 
        className={`btn-action ${addDisabled ? 'disabled' : ''}`}
        onClick={!addDisabled ? onNavigateToAdd : undefined}
        disabled={addDisabled}
        title={addDisabled 
          ? (isPhishing ? 'Blocked: current site suspected phishing' : 'Turn ON manager to add credentials') 
          : 'Save a new credential'}
      >
        <span className="btn-icon">➕</span>
        <span className="btn-main">
          <span className="btn-title">Add Password</span>
          <span className="btn-subtitle">
            {addDisabled 
              ? (isPhishing ? '🚫 Blocked on phishing site' : '⚠️ Turn on phishing detection to access')
              : 'Save a new credential'}
          </span>
        </span>
        {!addDisabled && <span style={{ marginLeft: 'auto', color: 'var(--accent-secondary)', fontSize: '20px' }}>→</span>}
      </button>
    </div>
  );
}
