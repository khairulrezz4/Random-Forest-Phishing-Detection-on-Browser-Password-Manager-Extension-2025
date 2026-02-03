// src/components/PinPrompt.jsx
import React, { useState } from "react";

export default function PinPrompt({ onUnlock, onCancel }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!pin) {
      setError("Please enter your PIN");
      return;
    }

    onUnlock(pin, (success) => {
      if (success) {
        setPin("");
        setAttempts(0);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setError(`Incorrect PIN (${newAttempts}/3 attempts)`);
        setPin("");
        
        if (newAttempts >= 3) {
          setError("Too many failed attempts. Please try again later.");
          setTimeout(() => {
            onCancel();
          }, 2000);
        }
      }
    });
  };

  return (
    <div className="pin-prompt-overlay">
      <div className="pin-prompt-card">
        <h2 className="pin-prompt-title">🔒 Enter PIN</h2>
        <p className="pin-prompt-subtitle">
          Enter your PIN to turn on the Password Manager
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            className="input pin-input"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN"
            maxLength={6}
            autoFocus
            disabled={attempts >= 3}
          />

          {error && <div className="pin-error">{error}</div>}

          <div className="pin-prompt-actions">
            <button 
              type="button" 
              className="btn-muted small" 
              onClick={onCancel}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary small"
              disabled={attempts >= 3}
            >
              Unlock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
