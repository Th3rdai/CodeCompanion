const express = require("express");
const fs = require("fs");
const { getAuditLogPath } = require("../lib/audit-log");

/**
 * Parse a JSON-lines audit log file and return entries as an array.
 * @param {string} logPath - Path to audit.log file
 * @returns {Array} - Array of parsed log entries
 */
function readAuditLog(logPath) {
  if (!fs.existsSync(logPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(logPath, "utf8");
    const lines = content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null; // Skip malformed lines
        }
      })
      .filter((entry) => entry !== null);

    return lines;
  } catch (err) {
    console.error("Failed to read audit log:", err);
    return [];
  }
}

/**
 * Filter audit log entries by query parameters.
 * @param {Array} entries - Audit log entries
 * @param {Object} filters - Filter parameters (limit, event, userId)
 * @returns {Array} - Filtered entries
 */
function filterEntries(entries, filters) {
  let filtered = entries;

  // Filter by event type
  if (filters.event) {
    const eventFilter = String(filters.event).toLowerCase();
    filtered = filtered.filter(
      (e) => e.event && e.event.toLowerCase().includes(eventFilter),
    );
  }

  // Filter by userId
  if (filters.userId) {
    const userFilter = String(filters.userId).toLowerCase();
    filtered = filtered.filter(
      (e) => e.userId && e.userId.toLowerCase().includes(userFilter),
    );
  }

  // Return last N entries (most recent last)
  if (filters.limit && Number.isInteger(filters.limit) && filters.limit > 0) {
    filtered = filtered.slice(-filters.limit);
  }

  return filtered;
}

function createAuditRouter(appContext) {
  const router = express.Router();
  const { requireLocalOrApiKey, log } = appContext;

  // ── GET /api/audit ────────────────────────────────────
  // Returns last N audit events with optional filters
  router.get("/audit", requireLocalOrApiKey, (req, res) => {
    const logPath = getAuditLogPath();
    if (!logPath) {
      return res.status(503).json({
        error: "Audit log not initialized",
      });
    }

    const limit = parseInt(req.query.limit) || 200;
    const event = req.query.event || null;
    const userId = req.query.userId || null;

    try {
      const entries = readAuditLog(logPath);
      const filtered = filterEntries(entries, { limit, event, userId });

      log("INFO", `Audit log queried: ${filtered.length} entries returned`, {
        limit,
        event,
        userId,
        totalEntries: entries.length,
      });

      res.json({
        entries: filtered,
        total: entries.length,
        filtered: filtered.length,
      });
    } catch (err) {
      log("ERROR", "Failed to read audit log", { error: err.message });
      res.status(500).json({
        error: "Failed to read audit log",
        message: err.message,
      });
    }
  });

  // ── GET /api/audit/export ─────────────────────────────
  // Streams full audit.log as a downloadable file
  router.get("/audit/export", requireLocalOrApiKey, (req, res) => {
    const logPath = getAuditLogPath();
    if (!logPath) {
      return res.status(503).json({
        error: "Audit log not initialized",
      });
    }

    if (!fs.existsSync(logPath)) {
      return res.status(404).json({
        error: "Audit log file not found",
      });
    }

    try {
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `audit-export-${timestamp}.log`;

      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );

      const stream = fs.createReadStream(logPath, { encoding: "utf8" });
      stream.pipe(res);

      stream.on("error", (err) => {
        log("ERROR", "Failed to stream audit log export", {
          error: err.message,
        });
        if (!res.headersSent) {
          res.status(500).json({
            error: "Failed to export audit log",
            message: err.message,
          });
        }
      });

      log("INFO", "Audit log export requested", { filename });
    } catch (err) {
      log("ERROR", "Failed to initiate audit log export", {
        error: err.message,
      });
      res.status(500).json({
        error: "Failed to export audit log",
        message: err.message,
      });
    }
  });

  return router;
}

module.exports = createAuditRouter;
