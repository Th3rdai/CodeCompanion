/**
 * lib/terminal-audit.js
 *
 * Append-only JSON-line audit log for the agent terminal (`run_terminal_cmd`).
 * One file: `${dataRoot}/logs/terminal-audit.log` — separate from `app.log`
 * so security/ops can tail just terminal events.
 *
 * Each line is a JSON object with at least:
 *   { ts, event, command?, args?, cwd?, exitCode?, durationMs?,
 *     truncated?, killed?, reason?, conversationId?, model? }
 *
 * Event types:
 *   - "denied"  — allowlist/blocklist or cwd rejected the command (no spawn)
 *   - "spawn-error" — spawn() failed (binary not found, EACCES, etc.)
 *   - "executed" — process exited normally (success or non-zero)
 *
 * The logger lazily creates the log dir + stream on first write so it works
 * regardless of whether `lib/logger.js` has been initialized yet, and so unit
 * tests can override `CC_DATA_DIR` per-test.
 */

const fs = require("fs");
const path = require("path");

let cachedStream = null;
let cachedPath = null;

function resolveLogPath() {
  const dataRoot = process.env.CC_DATA_DIR || process.cwd();
  return path.join(dataRoot, "logs", "terminal-audit.log");
}

function getStream() {
  const target = resolveLogPath();
  if (cachedStream && cachedPath === target) return cachedStream;
  // Path changed (e.g. tests rotating CC_DATA_DIR) — close old stream
  if (cachedStream) {
    try {
      cachedStream.end();
    } catch (_) {
      /* ignore */
    }
  }
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  cachedStream = fs.createWriteStream(target, { flags: "a" });
  cachedPath = target;
  return cachedStream;
}

/**
 * Append one audit event. Never throws — audit failures must not break the
 * caller (the terminal command itself is the priority).
 *
 * @param {object} event - structured event payload (ts is added automatically)
 */
function auditTerminalEvent(event) {
  try {
    const line =
      JSON.stringify({
        ts: new Date().toISOString(),
        ...event,
      }) + "\n";
    getStream().write(line);
  } catch (_) {
    /* swallow — audit must never break the caller */
  }
}

/**
 * Test/Electron helper: close + reset the cached stream so the next call
 * re-opens against a fresh CC_DATA_DIR.
 */
function _resetForTests() {
  if (cachedStream) {
    try {
      cachedStream.end();
    } catch (_) {
      /* ignore */
    }
  }
  cachedStream = null;
  cachedPath = null;
}

module.exports = { auditTerminalEvent, _resetForTests, resolveLogPath };
