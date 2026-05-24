const fs = require("fs");
const path = require("path");

let _auditLogPath = null;

/**
 * Initialize audit log module with application root directory.
 * Creates the audit.log file if it doesn't exist.
 * @param {string} appRoot - Application root directory (same as dataRoot)
 */
function initAuditLog(appRoot) {
  _auditLogPath = path.join(appRoot, "audit.log");
  // Ensure the file exists (touch it if it doesn't)
  if (!fs.existsSync(_auditLogPath)) {
    try {
      fs.writeFileSync(_auditLogPath, "", { encoding: "utf8" });
    } catch (err) {
      console.error(`Failed to create audit log at ${_auditLogPath}:`, err);
    }
  }
}

/**
 * Supported audit event types
 */
const EVENT_TYPES = {
  AUTH_LOGIN: "auth.login",
  AUTH_LOGOUT: "auth.logout",
  AUTH_FAILED: "auth.failed",
  REVIEW_STARTED: "review.started",
  REVIEW_COMPLETED: "review.completed",
  REVIEW_EXPORTED: "review.exported",
  SETTINGS_CHANGED: "settings.changed",
  USER_CREATED: "user.created",
  USER_DELETED: "user.deleted",
};

/**
 * Log an audit event. Appends a JSON-lines entry to audit.log.
 *
 * @param {Object} params - Event parameters
 * @param {string} params.event - Event type (one of EVENT_TYPES)
 * @param {string} [params.userId='anonymous'] - User identifier
 * @param {string} [params.ip='unknown'] - Client IP address
 * @param {Object} [params.meta={}] - Additional event metadata
 * @returns {boolean} - True if logged successfully, false otherwise
 *
 * @example
 * logEvent({
 *   event: EVENT_TYPES.REVIEW_COMPLETED,
 *   userId: 'user-123',
 *   ip: '127.0.0.1',
 *   meta: { grade: 'B+', categories: ['XSS', 'SQLi'] }
 * });
 */
function logEvent({ event, userId = "anonymous", ip = "unknown", meta = {} }) {
  if (!_auditLogPath) {
    console.error(
      "Audit log not initialized. Call initAuditLog(appRoot) first.",
    );
    return false;
  }

  if (!event || typeof event !== "string") {
    console.error("Audit event must be a non-empty string");
    return false;
  }

  // Validate event type (warn but don't block for forward compatibility)
  const validEvents = Object.values(EVENT_TYPES);
  if (!validEvents.includes(event)) {
    console.warn(`Unknown audit event type: ${event}`);
  }

  const entry = {
    ts: new Date().toISOString(),
    event,
    userId: String(userId || "anonymous"),
    ip: String(ip || "unknown"),
    meta: meta || {},
  };

  try {
    // Append as JSON-lines (newline-delimited JSON)
    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(_auditLogPath, line, { encoding: "utf8" });
    return true;
  } catch (err) {
    console.error("Failed to write audit log entry:", err);
    return false;
  }
}

/**
 * Get the current audit log file path (for testing/debugging)
 * @returns {string|null} - Audit log file path or null if not initialized
 */
function getAuditLogPath() {
  return _auditLogPath;
}

module.exports = {
  initAuditLog,
  logEvent,
  getAuditLogPath,
  EVENT_TYPES,
};
