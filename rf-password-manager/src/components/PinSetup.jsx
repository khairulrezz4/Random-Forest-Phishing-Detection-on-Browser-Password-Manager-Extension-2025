// src/components/PinSetup.jsx
import React, { useState } from "react";

export default function PinSetup({ onPinSet }) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (pin.length < 4 || pin.length > 6) {
      setError("PIN must be 4-6 digits");
      return;
    }

    if (!/^\d+$/.test(pin)) {
      setError("PIN must contain only numbers");
      return;
    }

    if (pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }

    onPinSet(pin);
  };

  return (
    <div className="pin-setup-overlay">
      <div className="pin-setup-card">
        <h2 className="pin-setup-title">Set Up Security PIN</h2>
        <p className="pin-setup-subtitle">
          Create a 4-6 digit PIN to protect your passwords
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Enter PIN</label>
            <input
              type="password"
              className="input pin-input"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4-6 digits"
              maxLength={6}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm PIN</label>
            <input
              type="password"
              className="input pin-input"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="Re-enter PIN"
              maxLength={6}
            />
          </div>

          {error && <div className="pin-error">{error}</div>}

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 12 }}>
            Set PIN
          </button>
        </form>
      </div>
    </div>
  );
}
