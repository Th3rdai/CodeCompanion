const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
// Repo-root .env (OLLAMA_API_KEY, etc.) — loaded before config; existing process.env wins
require("dotenv").config({ path: path.join(__dirname, ".env") });
const https = require("https");
const os = require("os");

// ── Lib imports ──────────────────────────────────────
const { createLogger } = require("./lib/logger");
const { initConfig, getConfig, updateConfig } = require("./lib/config");
const { initHistory, listConversations } = require("./lib/history");
const { initMemory } = require("./lib/memory");
const {
  listModels,
  checkConnection,
  chatComplete,
  ollamaAuthOpts,
} = require("./lib/ollama-client");

const { buildFileTree, readProjectFile } = require("./lib/file-browser");
const McpClientManager = require("./lib/mcp-client-manager");
const ToolCallHandler = require("./lib/tool-call-handler");
const { createMcpApiRoutes } = require("./lib/mcp-api-routes");
const {
  checkConnection: checkDocling,
  effectiveDoclingApiKey,
} = require("./lib/docling-client");
const { startDocling, stopDocling } = require("./lib/docling-starter");
const { registerRateLimiters } = require("./lib/rate-limiters-config");
const { mountMcpHttp } = require("./lib/mcp-http");
const createConvertRouter = require("./routes/convert");

const app = express();
// Default localhost-only; set CC_BIND_ALL=1 or HOST=0.0.0.0 for LAN access (see docs/ENVIRONMENT_VARIABLES.md)
const HOST =
  process.env.HOST ||
  (process.env.CC_BIND_ALL === "1" ? "0.0.0.0" : "127.0.0.1");
const DEBUG = process.env.DEBUG === "1" || process.env.DEBUG === "true";

// HTTPS: use cert/server.crt + cert/server.key if present (self-signed or otherwise)
// Set FORCE_HTTP=1 to disable HTTPS (e.g. for rate-limit test or local validation)
const certPath = path.join(__dirname, "cert", "server.crt");
const keyPath = path.join(__dirname, "cert", "server.key");
const useHttps =
  process.env.FORCE_HTTP !== "1" &&
  fs.existsSync(certPath) &&
  fs.existsSync(keyPath);

// ── Initialize modules ───────────────────────────────
const dataRoot = process.env.CC_DATA_DIR || __dirname;
initConfig(dataRoot);
initHistory(dataRoot);
initMemory(dataRoot);
const { log, debug, logDir } = createLogger(dataRoot, { debugEnabled: DEBUG });

const {
  createRequireLocalOrApiKey,
  createCorsOptions,
} = require("./lib/security-helpers");
const requireLocalOrApiKey = createRequireLocalOrApiKey({ log });

// ── Port configuration ───────────────────────────────
// Priority: process.env.PORT > config.preferredPort > 8900
const config = getConfig();
const PORT = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : config.preferredPort || 8900;

// ── Initialize MCP Client Manager ────────────────────
const mcpClientManager = new McpClientManager({ log, debug });
const toolCallHandler = new ToolCallHandler(mcpClientManager, {
  log,
  debug,
  getConfig,
});

// ── Mount MCP API routes ─────────────────────────────
const { router: mcpApiRouter } = createMcpApiRoutes({
  getConfig,
  updateConfig,
  mcpClientManager,
  log,
  debug,
  requireLocalOrApiKey,
});

// Vision chat sends base64 in JSON — 5mb is too small (browser shows "Failed to fetch" when body is rejected).
function jsonBodyLimit(req) {
  if (!["POST", "PUT", "PATCH"].includes(req.method || "")) return "5mb";
  const p = req.path || "";
  if (
    p === "/api/chat" ||
    p === "/api/review" ||
    p === "/api/convert-document" ||
    p.startsWith("/api/pentest")
  )
    return "50mb";
  return "5mb";
}
app.use((req, res, next) => {
  express.json({ limit: jsonBodyLimit(req) })(req, res, next);
});

// Per-request CSP nonce (scripts in index.html must match; no unsafe-inline for script-src)
app.use((_req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
});

// Serve Vite production build (dist/) if available, fallback to legacy public/
const distDir = path.join(__dirname, "dist");
const publicDir = path.join(__dirname, "public");
const staticDir = fs.existsSync(distDir) ? distDir : publicDir;

function injectCspNonceIntoHtml(html, nonce) {
  if (!nonce) return html;
  return html.replace(
    /<script(?![^>]*\snonce=)/gi,
    `<script nonce="${nonce}" `,
  );
}

function sendSpaIndexHtml(res) {
  const indexPath = path.join(staticDir, "index.html");
  if (!fs.existsSync(indexPath)) return false;
  let html = fs.readFileSync(indexPath, "utf8");
  html = injectCspNonceIntoHtml(html, res.locals.cspNonce);
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.type("html").send(html);
  return true;
}

function isLikelyAssetRequest(reqPath = "") {
  if (!reqPath) return false;
  if (reqPath.startsWith("/assets/")) return true;
  // If path has a file extension, treat it as a file request (not SPA route).
  return /\.[a-zA-Z0-9]+$/.test(reqPath);
}

// ── Security Headers & CORS ─────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: [
          "'self'",
          "http://localhost:*",
          "http://127.0.0.1:*",
          "https://prod.spline.design",
        ],
        imgSrc: ["'self'", "data:", "blob:"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow Spline 3D scenes
  }),
);
app.use(cors(createCorsOptions())); // localhost / 127.0.0.1 by default; CC_CORS_ALLOW_LAN=1 or CC_ALLOWED_ORIGINS for LAN

// When serving HTTP only, clear HSTS so browsers don't upgrade to HTTPS
app.use((_req, res, next) => {
  if (!useHttps && _req.get("x-forwarded-proto") !== "https") {
    res.setHeader("Strict-Transport-Security", "max-age=0");
  }
  next();
});

// HTML shell must include per-request nonces (do not serve raw index.html from static)
app.get(["/", "/index.html"], (req, res, next) => {
  if (sendSpaIndexHtml(res)) return;
  next();
});

app.use(
  express.static(staticDir, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    },
  }),
);

// Asset diagnostics endpoint (local/API-key gated). Helps debug stale-hash or missing-file issues.
app.get("/api/debug/static-asset", requireLocalOrApiKey, (req, res) => {
  const rel = String(req.query.path || "").trim();
  const clean = rel.replace(/^\/+/, "");
  if (!clean) {
    return res.status(400).json({ error: "Missing query param: path" });
  }
  const fullPath = path.join(staticDir, clean);
  const insideStatic = fullPath.startsWith(staticDir + path.sep);
  const exists = insideStatic && fs.existsSync(fullPath);
  let stat = null;
  if (exists) {
    const s = fs.statSync(fullPath);
    stat = { size: s.size, mtime: s.mtime.toISOString() };
  }
  res.json({
    staticDir,
    requested: clean,
    fullPath,
    insideStatic,
    exists,
    stat,
  });
});

// ── Request logging middleware ───────────────────────

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    log("INFO", `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ── Rate limiters (see lib/rate-limiters-config.js) ──
registerRateLimiters(app);

// ── MCP Management API routes ────────────────────────
app.use("/api", mcpApiRouter);

// ── Route modules ────────────────────────────────────
const createConfigRouter = require("./routes/config");
const createOfficeRouter = require("./routes/office");
const createLaunchRouter = require("./routes/launch");
const createChatRouter = require("./routes/chat");
const createReviewRouter = require("./routes/review");
const createPentestRouter = require("./routes/pentest");
const createProjectsRouter = require("./routes/projects");
const createBuildRouter = require("./routes/build");
const createGithubRouter = require("./routes/github");
const createGitRouter = require("./routes/git");
const createHistoryRouter = require("./routes/history");
const createMemoryRouter = require("./routes/memory");
const createFilesRouter = require("./routes/files");
const createScoreRouter = require("./routes/score");
const createValidateRouter = require("./routes/validate");

const appContext = {
  config,
  requireLocalOrApiKey,
  log,
  debug,
  dataRoot,
  logDir,
  toolCallHandler,
};

app.use("/api", createConfigRouter(appContext));
app.use("/api", createConvertRouter({ getConfig, log }));
app.use("/api", createOfficeRouter(appContext));
app.use("/api", createLaunchRouter(appContext));
app.use("/api", createHistoryRouter(appContext));
app.use("/api", createMemoryRouter(appContext));
app.use("/api", createFilesRouter(appContext));
app.use("/api", createScoreRouter(appContext));
app.use("/api", createValidateRouter(appContext));
app.use("/api", createProjectsRouter(appContext));
app.use("/api", createBuildRouter(appContext));
app.use("/api", createGithubRouter(appContext));
app.use("/api", createGitRouter(appContext));
app.use("/api", createChatRouter(appContext));
app.use("/api", createReviewRouter(appContext));
app.use("/api", createPentestRouter(appContext));

// ── GET /api/models ──────────────────────────────────

app.get("/api/models", async (req, res) => {
  const config = getConfig();
  const url = `${config.ollamaUrl}/api/tags`;
  debug("Fetching models", { url });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const models = await listModels(config.ollamaUrl, ollamaAuthOpts(config));
    clearTimeout(timeout);

    log("INFO", `Models loaded: ${models.length} found`);
    debug(
      "Model list",
      models.map((m) => m.name),
    );
    res.json({ models, ollamaUrl: config.ollamaUrl, connected: true });
  } catch (err) {
    log("ERROR", `Cannot reach Ollama at ${url}`, {
      error: err.message,
      cause: err.cause?.message,
    });
    res.status(503).json({
      error: "Cannot reach Ollama",
      detail: "Connection failed",
      ollamaUrl: config.ollamaUrl,
      connected: false,
    });
  }
});

// ── Docling health check ─────────────────────────────
app.get("/api/docling/health", async (req, res) => {
  const config = getConfig();
  const url = config.docling?.url || "http://127.0.0.1:5002";
  const apiKey = effectiveDoclingApiKey(config);

  try {
    const result = await checkDocling(url, apiKey);
    if (result.connected) {
      res.json({ connected: true, version: result.version, doclingUrl: url });
    } else {
      log("WARN", "Docling not connected", {
        detail: result.error,
        doclingUrl: url,
      });
      res.status(503).json({
        connected: false,
        detail: "Service unavailable",
        doclingUrl: url,
      });
    }
  } catch (err) {
    log("WARN", "Docling health check failed", {
      error: err.message,
      doclingUrl: url,
    });
    res.status(503).json({
      connected: false,
      detail: "Health check failed",
      doclingUrl: url,
    });
  }
});

// ── Agent Terminal test ──────────────────────────────
app.get("/api/agent-terminal/test", requireLocalOrApiKey, (req, res) => {
  const { spawn } = require("child_process");
  const config = getConfig();
  const terminal = config.agentTerminal || {};

  if (!terminal.enabled) {
    return res.json({
      ok: false,
      error: "Agent terminal is disabled. Enable it in Settings → General.",
    });
  }
  if (!config.projectFolder) {
    return res.json({
      ok: false,
      error: "No project folder configured. Set one in Settings → General.",
    });
  }
  if (!terminal.allowlist || terminal.allowlist.length === 0) {
    return res.json({
      ok: false,
      error: "Allowlist is empty — add commands in Settings → Agent Terminal.",
    });
  }

  const startTime = Date.now();
  const proc = spawn("pwd", [], { cwd: config.projectFolder, shell: false });
  let output = "";
  proc.stdout.on("data", (d) => {
    output += d.toString();
  });
  proc.stderr.on("data", (d) => {
    output += d.toString();
  });

  const timer = setTimeout(() => {
    proc.kill();
    if (!res.headersSent)
      res.json({
        ok: false,
        error: "Test timed out after 5s. Check your project folder path.",
      });
  }, 5000);

  proc.on("error", (err) => {
    clearTimeout(timer);
    if (!res.headersSent)
      res.json({ ok: false, error: `Spawn failed: ${err.message}` });
  });
  proc.on("close", (code) => {
    clearTimeout(timer);
    if (res.headersSent) return;
    if (code !== 0) {
      return res.json({
        ok: false,
        error: `pwd exited with code ${code}: ${output.trim()}`,
      });
    }
    res.json({
      ok: true,
      cwd: output.trim(),
      durationMs: Date.now() - startTime,
    });
  });
});

// ── MCP HTTP Server (see lib/mcp-http.js) ────────────
// Must be AFTER all /api/* routes but BEFORE SPA fallback
mountMcpHttp(app, {
  getConfig,
  log,
  debug,
  requireLocalOrApiKey,
  deps: {
    listModels,
    chatComplete,
    checkConnection,
    buildFileTree,
    readProjectFile,
    listConversations,
  },
});

// ── Graceful shutdown ────────────────────────────────
process.on("SIGINT", async () => {
  log("INFO", "Shutting down — disconnecting MCP clients...");
  await mcpClientManager.disconnectAll();
  stopDocling(log);
  process.exit(0);
});

process.on("SIGTERM", async () => {
  log("INFO", "Shutting down (SIGTERM) — cleaning up...");
  await mcpClientManager.disconnectAll();
  stopDocling(log);
  process.exit(0);
});

// ── SPA Fallback (must be after all API routes) ──────

app.get("*", (req, res) => {
  // Avoid serving index.html for stale/missing asset hashes; return 404 instead.
  if (isLikelyAssetRequest(req.path)) {
    log("WARN", "Asset not found", { path: req.path, staticDir });
    return res.status(404).type("text/plain").send("Asset not found");
  }
  if (sendSpaIndexHtml(res)) return;
  res.status(404).send("Not found");
});

// ── Start ────────────────────────────────────────────

function getLocalNetworkUrl() {
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === "IPv4" && !net.internal)
          return `${useHttps ? "https" : "http"}://${net.address}:${PORT}`;
      }
    }
  } catch (_) {}
  return null;
}

const proto = useHttps ? "https" : "http";
const http = require("http");

// ── Start docling-serve if enabled ───────────────────
(async () => {
  const config = getConfig();
  const doclingResult = await startDocling(config, (msg) => log("INFO", msg));
  if (doclingResult.managed) {
    log(
      "INFO",
      `Docling server managed by Code Companion at ${doclingResult.url}`,
    );
  } else if (doclingResult.reason === "already-running") {
    log("INFO", `Docling server already running at ${doclingResult.url}`);
  } else if (doclingResult.reason === "not-installed") {
    // Already logged by startDocling
  } else if (doclingResult.reason === "disabled") {
    // User disabled it — silent
  }
})();

let serverInstance;

if (useHttps) {
  serverInstance = https.createServer(
    { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) },
    app,
  );

  // Also start an HTTP server on PORT+1 that redirects to HTTPS on PORT.
  // Users with old http://localhost:PORT bookmarks can update to the new URL.
  const HTTP_REDIRECT_PORT = PORT + 1;
  http
    .createServer((req, res) => {
      const host = (req.headers.host || `localhost:${PORT}`).split(":")[0];
      res.writeHead(301, { Location: `https://${host}:${PORT}${req.url}` });
      res.end();
    })
    .listen(HTTP_REDIRECT_PORT, HOST, () => {
      log("INFO", `HTTP→HTTPS redirect on port ${HTTP_REDIRECT_PORT}`);
    });
} else {
  serverInstance = http.createServer(app);
}

const server = serverInstance.listen(PORT, HOST, () => {
  const config = getConfig();
  const localUrl = `${proto}://localhost:${PORT}`;
  const remoteUrl = HOST === "0.0.0.0" ? getLocalNetworkUrl() : null;
  log(
    "INFO",
    `Th3rdAI Code Companion started on ${localUrl}${useHttps ? " (HTTPS)" : ""}`,
  );
  if (remoteUrl) log("INFO", `Remote access: ${remoteUrl}`);
  log("INFO", `Ollama endpoint: ${config.ollamaUrl}`);
  log("INFO", `History dir: ${path.join(dataRoot, "history")}`);
  log("INFO", `Log dir: ${logDir}`);
  log("INFO", `MCP HTTP server: enabled at /mcp`);
  log(
    "INFO",
    `Debug mode: ${DEBUG ? "ON" : "OFF (set DEBUG=1 to enable console debug output)"}`,
  );
  console.log(
    `\n  Th3rdAI Code Companion running at ${localUrl}${useHttps ? " (HTTPS — accept the self-signed cert warning in your browser)" : ""}`,
  );
  if (remoteUrl) console.log(`  Remote access: ${remoteUrl}`);
  console.log(`  Ollama endpoint: ${config.ollamaUrl}`);
  console.log(`  MCP HTTP server: /mcp`);
  console.log(`  Logs: ${logDir}`);
  console.log(`  Tip: run with DEBUG=1 for verbose console output`);
  if (!useHttps)
    console.log(`  Tip: add cert/server.crt + cert/server.key to enable HTTPS`);
  if (useHttps)
    console.log(
      `  SSL issues? Clear HSTS for localhost at chrome://net-internals/#hsts`,
    );
  console.log();

  // Notify Electron parent process that server is ready
  if (process.send) {
    process.send({ type: "server-ready", port: PORT });
  }

  // Auto-connect configured MCP clients
  const autoClients = (config.mcpClients || []).filter((c) => c.autoConnect);
  if (autoClients.length > 0) {
    log("INFO", `Auto-connecting ${autoClients.length} MCP client(s)...`);
    for (const clientConfig of autoClients) {
      mcpClientManager
        .connect(clientConfig)
        .then((tools) => {
          log(
            "INFO",
            `Auto-connected: ${clientConfig.name} (${tools.length} tools)`,
          );
        })
        .catch((err) => {
          log(
            "ERROR",
            `Auto-connect failed for ${clientConfig.name}: ${err.message}`,
          );
        });
    }
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\n  Port ${PORT} is already in use. Stop the process using it, or use a different port:\n`,
    );
    console.error(`    PORT=8903 node server.js\n`);
    console.error(
      `  To stop whatever is on port ${PORT}:  lsof -ti:${PORT} | xargs kill\n`,
    );
  } else {
    console.error("Server error:", err);
  }
  log("ERROR", `Server failed: ${err.message}`);
  process.exit(1);
});

// Export app for potential programmatic use
module.exports = app;
