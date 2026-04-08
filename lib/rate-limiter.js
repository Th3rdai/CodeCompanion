/**
 * lib/rate-limiter.js
 *
 * In-memory per-client rate limiter factory used across all Code Companion
 * routes. Extracted from server.js in Phase 24.5-03 to keep server.js lean.
 *
 * Usage:
 *   const { createRateLimiter, getClientAddress } = require("./lib/rate-limiter");
 *   app.use("/api/chat", createRateLimiter({ name: "chat", max: 30, windowMs: 60000, methods: ["POST"] }));
 */

function getClientAddress(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function createRateLimiter({ name, max, windowMs, methods }) {
  const buckets = new Map();
  const allowedMethods = new Set(
    (methods || ["GET", "POST", "PUT", "PATCH", "DELETE"]).map((m) =>
      String(m).toUpperCase(),
    ),
  );
  const safeMax = Math.max(1, Number(max) || 1);
  const safeWindowMs = Math.max(1000, Number(windowMs) || 60000);

  return function rateLimiter(req, res, next) {
    if (!allowedMethods.has(req.method.toUpperCase())) {
      return next();
    }

    const now = Date.now();
    const key = `${name}:${getClientAddress(req)}`;
    const record = buckets.get(key);
    if (!record || now >= record.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + safeWindowMs });
      return next();
    }

    if (record.count >= safeMax) {
      const retryAfter = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res
        .status(429)
        .json({ error: "Too many requests", code: "RATE_LIMITED", retryAfter });
    }

    record.count += 1;
    return next();
  };
}

module.exports = { createRateLimiter, getClientAddress };
