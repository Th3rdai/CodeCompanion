/**
 * lib/logger.js — Logging module with stderr mode for MCP stdio transport.
 *
 * Usage:
 *   const { createLogger } = require('./lib/logger');
 *   const { log, debug } = createLogger(__dirname, { stderrMode: false });
 */

const fs = require("fs");
const path = require("path");

function createLogger(appRoot, options = {}) {
  const { stderrMode = false, debugEnabled = false } = options;
  const logDir = path.join(appRoot, "logs");

  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  const logStream = fs.createWriteStream(path.join(logDir, "app.log"), {
    flags: "a",
  });
  const debugStream = fs.createWriteStream(path.join(logDir, "debug.log"), {
    flags: "a",
  });

  function timestamp() {
    return new Date().toISOString();
  }

  function log(level, msg, data) {
    const entry = `[${timestamp()}] [${level}] ${msg}${data ? " " + JSON.stringify(data) : ""}`;
    logStream.write(entry + "\n");
    if (stderrMode) {
      // In stdio MCP mode, ALL console output must go to stderr
      console.error(entry);
    } else {
      if (level === "ERROR") console.error(entry);
      else console.log(entry);
    }
  }

  function debug(msg, data) {
    const entry = `[${timestamp()}] [DEBUG] ${msg}${data ? " " + JSON.stringify(data) : ""}`;
    debugStream.write(entry + "\n");
    if (debugEnabled) {
      if (stderrMode) console.error(entry);
      else console.log(entry);
    }
  }

  return { log, debug, logDir };
}

module.exports = { createLogger };
