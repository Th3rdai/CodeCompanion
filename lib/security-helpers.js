/**
 * Shared security helpers: localhost / API-key gate, CORS policy, path allowlists.
 */
const path = require("path");
const os = require("os");
const { getWritableRoots, isUnderRoot } = require("./icm-scaffolder");

const API_KEY_HEADER = "x-cc-api-key";

function normalizeIp(ip) {
  if (!ip) return "";
  return String(ip).replace(/^::ffff:/i, "");
}

function isLocalIp(req) {
  const raw = req.ip || req.socket?.remoteAddress || "";
  const n = normalizeIp(raw);
  return n === "127.0.0.1" || n === "::1" || raw === "::1";
}

function hasValidApiKey(req) {
  const secret = process.env.CC_API_SECRET;
  if (!secret || typeof secret !== "string") return false;
  const key = req.headers[API_KEY_HEADER];
  return key === secret;
}

function createRequireLocalOrApiKey({ log } = {}) {
  return function requireLocalOrApiKey(req, res, next) {
    if (hasValidApiKey(req)) return next();
    if (isLocalIp(req)) return next();
    if (log) {
      log("SECURITY", "Blocked non-local request without API key", {
        path: req.path,
        method: req.method,
        ip: req.ip || req.socket?.remoteAddress,
      });
    }
    return res.status(403).json({
      error:
        "Forbidden: this endpoint is only available from localhost or with header X-CC-API-Key matching CC_API_SECRET.",
      code: "LOCAL_OR_API_KEY_REQUIRED",
    });
  };
}

/** Expand ~ and return absolute path (no findFolderByName). */
function resolveFolderInput(folder) {
  if (!folder || typeof folder !== "string") return null;
  let f = folder.trim();
  if (f.startsWith("~")) f = path.join(os.homedir(), f.slice(1));
  return path.resolve(f);
}

function assertResolvedPathUnderAllowedRoots(folderPath, config) {
  if (!folderPath || typeof folderPath !== "string") {
    return { ok: false, error: "Invalid folder path" };
  }
  const resolved = path.resolve(folderPath);
  const roots = getWritableRoots(config);
  if (!isUnderRoot(resolved, roots)) {
    return { ok: false, error: "Folder is outside allowed directories" };
  }
  return { ok: true, resolved };
}

function assertLocalPathForGitPush(localPath, config) {
  if (!localPath || typeof localPath !== "string") {
    return { ok: false, error: "Missing localPath" };
  }
  const resolved = path.resolve(localPath);
  const roots = getWritableRoots(config);
  if (!isUnderRoot(resolved, roots)) {
    return { ok: false, error: "localPath must be under allowed directories" };
  }
  return { ok: true, resolved };
}

function isAllowedGitHubRemoteUrl(url) {
  if (!url || typeof url !== "string") return false;
  const u = url.trim();
  if (u.startsWith("https://github.com/")) return true;
  if (u.startsWith("git@github.com:")) return true;
  return false;
}

function createCorsOptions() {
  const allowLan = process.env.CC_CORS_ALLOW_LAN === "1";
  const extra = (process.env.CC_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    origin(origin, callback) {
      if (allowLan) return callback(null, true);
      if (!origin) return callback(null, true);
      try {
        const u = new URL(origin);
        if (u.hostname === "localhost" || u.hostname === "127.0.0.1")
          return callback(null, true);
        if (extra.includes(origin)) return callback(null, true);
        return callback(new Error("CORS not allowed"));
      } catch {
        return callback(new Error("CORS invalid origin"));
      }
    },
    credentials: true,
  };
}

module.exports = {
  createRequireLocalOrApiKey,
  createCorsOptions,
  resolveFolderInput,
  assertResolvedPathUnderAllowedRoots,
  assertLocalPathForGitPush,
  isAllowedGitHubRemoteUrl,
  isLocalIp,
  hasValidApiKey,
};
