// src/utils/eventLogger.js
// Event logging utility for tracking user actions and security events

const MAX_LOGS = 500; // Maximum number of logs to keep

export const EventTypes = {
  // Password management events
  PASSWORD_SAVED: 'password_saved',
  PASSWORD_DELETED: 'password_deleted',
  PASSWORD_AUTOFILLED: 'password_autofilled',
  PASSWORD_COPIED: 'password_copied',
  PASSWORD_REVEALED: 'password_revealed',
  
  // Security events
  PHISHING_DETECTED: 'phishing_detected',
  SITE_VERIFIED_SAFE: 'site_verified_safe',
  AUTOFILL_BLOCKED: 'autofill_blocked',
  
  // Authentication events
  PIN_CREATED: 'pin_created',
  PIN_VERIFIED: 'pin_verified',
  PIN_FAILED: 'pin_failed',
  SESSION_EXPIRED: 'session_expired',
  
  // System events
  MANAGER_ENABLED: 'manager_enabled',
  MANAGER_DISABLED: 'manager_disabled',
  VAULT_LOCKED: 'vault_locked',
  VAULT_UNLOCKED: 'vault_unlocked'
};

/**
 * Log an event to chrome.storage.local
 * @param {string} eventType - Type of event from EventTypes
 * @param {object} data - Additional event data
 */
export function logEvent(eventType, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp,
    event: eventType,
    ...data
  };

  chrome.storage.local.get(['rf_event_logs'], (result) => {
    let logs = Array.isArray(result.rf_event_logs) ? result.rf_event_logs : [];
    
    // Add new log at the beginning (most recent first)
    logs.unshift(logEntry);
    
    // Trim to max logs
    if (logs.length > MAX_LOGS) {
      logs = logs.slice(0, MAX_LOGS);
    }
    
    chrome.storage.local.set({ rf_event_logs: logs }, () => {
    });
  });
}

/**
 * Get all event logs
 * @param {function} callback - Callback with logs array
 */
export function getEventLogs(callback) {
  chrome.storage.local.get(['rf_event_logs'], (result) => {
    const logs = Array.isArray(result.rf_event_logs) ? result.rf_event_logs : [];
    callback(logs);
  });
}

/**
 * Get logs filtered by event type
 * @param {string|string[]} eventTypes - Event type(s) to filter by
 * @param {function} callback - Callback with filtered logs
 */
export function getLogsByType(eventTypes, callback) {
  const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
  getEventLogs((logs) => {
    const filtered = logs.filter(log => types.includes(log.event));
    callback(filtered);
  });
}

/**
 * Get logs from a specific date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {function} callback - Callback with filtered logs
 */
export function getLogsByDateRange(startDate, endDate, callback) {
  getEventLogs((logs) => {
    const filtered = logs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= startDate && logDate <= endDate;
    });
    callback(filtered);
  });
}

/**
 * Get security-related logs (phishing detections, blocked autofills)
 * @param {function} callback - Callback with security logs
 */
export function getSecurityLogs(callback) {
  const securityEvents = [
    EventTypes.PHISHING_DETECTED,
    EventTypes.AUTOFILL_BLOCKED,
    EventTypes.PIN_FAILED
  ];
  getLogsByType(securityEvents, callback);
}

/**
 * Get log statistics
 * @param {function} callback - Callback with stats object
 */
export function getLogStats(callback) {
  getEventLogs((logs) => {
    const stats = {
      totalLogs: logs.length,
      passwordsSaved: logs.filter(l => l.event === EventTypes.PASSWORD_SAVED).length,
      passwordsDeleted: logs.filter(l => l.event === EventTypes.PASSWORD_DELETED).length,
      autofillsPerformed: logs.filter(l => l.event === EventTypes.PASSWORD_AUTOFILLED).length,
      phishingDetections: logs.filter(l => l.event === EventTypes.PHISHING_DETECTED).length,
      autofillsBlocked: logs.filter(l => l.event === EventTypes.AUTOFILL_BLOCKED).length,
      safeSitesVerified: logs.filter(l => l.event === EventTypes.SITE_VERIFIED_SAFE).length,
      pinFailures: logs.filter(l => l.event === EventTypes.PIN_FAILED).length
    };
    callback(stats);
  });
}

/**
 * Clear all event logs
 * @param {function} callback - Callback when done
 */
export function clearEventLogs(callback) {
  chrome.storage.local.set({ rf_event_logs: [] }, () => {
    if (callback) callback();
  });
}

/**
 * Export logs as readable TXT file (for developers)
 * @param {function} callback - Callback when download is triggered
 */
export function exportLogsAsTxt(callback) {
  getEventLogs((logs) => {
    getLogStats((stats) => {
      let txt = '='.repeat(60) + '\n';
      txt += 'RezzaRF Password Manager - Event Logs\n';
      txt += '='.repeat(60) + '\n';
      txt += `Exported: ${new Date().toLocaleString()}\n`;
      txt += `Total Events: ${logs.length}\n`;
      txt += '\n';
      
      // Stats summary
      txt += '-'.repeat(40) + '\n';
      txt += 'STATISTICS SUMMARY\n';
      txt += '-'.repeat(40) + '\n';
      txt += `Passwords Saved:     ${stats.passwordsSaved}\n`;
      txt += `Passwords Deleted:   ${stats.passwordsDeleted}\n`;
      txt += `Autofills Performed: ${stats.autofillsPerformed}\n`;
      txt += `Phishing Detected:   ${stats.phishingDetections}\n`;
      txt += `Autofills Blocked:   ${stats.autofillsBlocked}\n`;
      txt += `Safe Sites Verified: ${stats.safeSitesVerified}\n`;
      txt += `PIN Failures:        ${stats.pinFailures}\n`;
      txt += '\n';
      
      // Event details
      txt += '-'.repeat(40) + '\n';
      txt += 'EVENT DETAILS\n';
      txt += '-'.repeat(40) + '\n\n';
      
      if (logs.length === 0) {
        txt += 'No events recorded.\n';
      } else {
        logs.forEach((log, index) => {
          const date = new Date(log.timestamp);
          const formattedDate = date.toLocaleString();
          
          txt += `[${index + 1}] ${formattedDate}\n`;
          txt += `    Event: ${formatEventName(log.event)}\n`;
          
          if (log.domain) {
            txt += `    Domain: ${log.domain}\n`;
          }
          if (log.url) {
            txt += `    URL: ${log.url}\n`;
          }
          if (typeof log.riskScore === 'number') {
            txt += `    Risk Score: ${(log.riskScore * 100).toFixed(1)}%\n`;
          }
          txt += '\n';
        });
      }
      
      txt += '='.repeat(60) + '\n';
      txt += 'END OF LOG FILE\n';
      txt += '='.repeat(60) + '\n';
      
      // Trigger download
      const blob = new Blob([txt], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rezzarf-password-manager-logs-${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      
      if (callback) callback();
    });
  });
}

/**
 * Format event type to readable name
 */
function formatEventName(eventType) {
  const names = {
    'password_saved': 'Password Saved',
    'password_deleted': 'Password Deleted',
    'password_autofilled': 'Password Auto-filled',
    'password_copied': 'Password Copied',
    'password_revealed': 'Password Revealed',
    'phishing_detected': 'PHISHING DETECTED',
    'site_verified_safe': 'Site Verified Safe',
    'autofill_blocked': 'Autofill Blocked',
    'pin_created': 'PIN Created',
    'pin_verified': 'PIN Verified',
    'pin_failed': 'PIN Failed',
    'session_expired': 'Session Expired',
    'manager_enabled': 'Manager Enabled',
    'manager_disabled': 'Manager Disabled',
    'vault_locked': 'Vault Locked',
    'vault_unlocked': 'Vault Unlocked'
  };
  return names[eventType] || eventType;
}
