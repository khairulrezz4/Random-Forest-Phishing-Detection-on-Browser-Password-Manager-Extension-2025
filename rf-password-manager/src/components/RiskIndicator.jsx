// src/components/RiskIndicator.jsx
import React from "react";

// display: 'percent' (default) | 'label'
export default function RiskIndicator({ score, display = 'percent', threshold = 0.5 }) {
  if (score === null || typeof score === 'undefined') return null;

  const percent = (score * 100).toFixed(1);
  const isPhishing = score >= threshold;

  let color = '';
  let icon = '';
  let label = '';

  if (isPhishing) {
    color = '#dc3545';  // Red
    icon = '🚫';
    label = 'Phishing';
  } else {
    // For label mode, all non-phishing is treated as Legitimate
    // For percent mode, keep nuanced colors
    if (display === 'percent') {
      if (score >= 0.3) {
        color = '#ffc107'; icon = '⚠️';
      } else if (score >= 0.1) {
        color = '#17a2b8'; icon = 'ℹ️';
      } else {
        color = '#28a745'; icon = '✓';
      }
    } else {
      color = '#28a745'; icon = '✓';
    }
    label = 'Legitimate';
  }

  const title = display === 'percent'
    ? `Risk Score: ${percent}%${score >= 0.3 ? ' - Exercise caution' : ''}`
    : label;

  return (
    <div
      className="risk-indicator"
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 6px',
        fontSize: '12px',
        color: color,
        gap: '6px',
        borderRadius: 6,
      }}
    >
      <span>{icon}</span>
      <span>{display === 'percent' ? `${percent}%` : label}</span>
    </div>
  );
}
