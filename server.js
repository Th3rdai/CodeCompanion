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
const {
  initHistory,
  listConversations,
} = require("./lib/history");
const { initMemory } = require("./lib/memory");
const {
  listModels,
  checkConnection,
  chatComplete,
  effectiveOllamaApiKey,
} = require("./lib/ollama-client");

function ollamaAuthOpts(cfg) {
  const k = effectiveOllamaApiKey(cfg);
  return k ? { apiKey: k } : {};
}

const {
  buildFileTree,
  readProjectFile,
} = require("./lib/file-browser");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { registerAllTools } = require("./mcp/tools");
const McpClientManager = require("./lib/mcp-client-manager");
const ToolCallHandler = require("./lib/tool-call-handler");
const { createMcpApiRoutes } = require("./lib/mcp-api-routes");
const {
  checkConnection: checkDocling,
  convertDocument: convertDoc,
  effectiveDoclingApiKey,
} = require("./lib/docling-client");
const {
  canConvertBuiltin,
  convertBuiltin,
} = require("./lib/builtin-doc-converter");
const { startDocling, stopDocling } = require("./lib/docling-starter");

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

// ── Initialize modules ───────────────────────────────
const dataRoot = process.env.CC_DATA_DIR || __dirname;
initConfig(dataRoot);
initHistory(dataRoot);
initMemory(dataRoot);
const { log, debug, logDir } = createLogger(dataRoot, { debugEnabled: DEBUG });

const {
  createRequireLocalOrApiKey,
  createCorsOptions,
  assertResolvedPathUnderAllowedRoots,
  resolveFolderInput,
  assertLocalPathForGitPush,
  isAllowedGitHubRemoteUrl,
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
const {
  CLIENT_INTERNAL_ERROR,
  STREAM_INTERNAL_ERROR,
} = require("./lib/client-errors");
const { router: mcpApiRouter, recordToolCall } = createMcpApiRoutes({
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
  res.type("html").send(html);
  return true;
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

// ── Request logging middleware ───────────────────────

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    log("INFO", `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const CHAT_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_CHAT || 30);
const CREATE_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_CREATE || 12);
const GITHUB_CLONE_RATE_LIMIT_MAX = Number(
  process.env.RATE_LIMIT_MAX_GITHUB_CLONE || 6,
);
const MCP_TEST_RATE_LIMIT_MAX = Number(
  process.env.RATE_LIMIT_MAX_MCP_TEST || 12,
);
const REVIEW_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_REVIEW || 20);
const SCORE_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_SCORE || 20);
const MEMORY_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_MEMORY || 30);

app.use(
  "/api/chat",
  createRateLimiter({
    name: "chat",
    max: CHAT_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  }),
);
app.use(
  "/api/create-project",
  createRateLimiter({
    name: "create-project",
    max: CREATE_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  }),
);
app.use(
  "/api/build-project",
  createRateLimiter({
    name: "build-project",
    max: CREATE_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  }),
);
app.use(
  "/api/build/projects",
  createRateLimiter({
    name: "build-registry",
    max: CREATE_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST", "DELETE"],
  }),
);
app.use(
  "/api/github/clone",
  createRateLimiter({
    name: "github-clone",
    max: GITHUB_CLONE_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  }),
);
app.use(
  "/api/mcp/clients/test-connection",
  createRateLimiter({
    name: "mcp-test-connection",
    max: MCP_TEST_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  }),
);
app.use(
  "/api/review",
  createRateLimiter({
    name: "review",
    max: REVIEW_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  }),
);
app.use(
  "/api/pentest",
  createRateLimiter({
    name: "pentest",
    max: REVIEW_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  }),
);
app.use(
  "/api/score",
  createRateLimiter({
    name: "score",
    max: SCORE_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  }),
);
app.use(
  "/api/tutorial-suggestions",
  createRateLimiter({
    name: "tutorial-suggestions",
    max: 20,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  }),
);
app.use(
  "/api/memory",
  createRateLimiter({
    name: "memory",
    max: MEMORY_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST", "PUT", "DELETE"],
  }),
);

app.use(
  "/api/build/projects/:id/next-action",
  createRateLimiter({
    name: "build-next-action",
    max: 10,
    windowMs: 60000,
    methods: ["POST"],
  }),
);
app.use(
  "/api/build/projects/:id/research",
  createRateLimiter({
    name: "build-research",
    max: 5,
    windowMs: 60000,
    methods: ["POST"],
  }),
);
app.use(
  "/api/build/projects/:id/plan",
  createRateLimiter({
    name: "build-plan",
    max: 5,
    windowMs: 60000,
    methods: ["POST"],
  }),
);

const API_GLOBAL_RATE_MAX = Number(
  process.env.RATE_LIMIT_MAX_API_GLOBAL || 300,
);
app.use(
  "/api",
  createRateLimiter({
    name: "api-global",
    max: API_GLOBAL_RATE_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);

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

app.use(
  "/api/generate-office",
  createRateLimiter({
    name: "office-gen",
    max: 30,
    windowMs: 60000,
    methods: ["POST"],
  }),
);

app.use("/api", createConfigRouter(appContext));
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

// ── Document conversion (Docling → built-in fallback) ─
app.post(
  "/api/convert-document",
  express.json({ limit: "50mb" }),
  createRateLimiter({
    name: "convert",
    max: 10,
    windowMs: 60000,
    methods: ["POST"],
  }),
  async (req, res) => {
    const config = getConfig();
    const { content, filename } = req.body;

    if (!content || !filename) {
      return res.status(400).json({ error: "Missing content or filename" });
    }

    const ext = path.extname(filename).toLowerCase();
    const ALLOWED = new Set([
      ".pdf",
      ".pptx",
      ".docx",
      ".xlsx",
      ".xls",
      ".csv",
      ".doc",
      ".ppt",
      ".odt",
      ".ods",
      ".odp",
      ".rtf",
      ".latex",
      ".tex",
      ".epub",
    ]);
    if (!ALLOWED.has(ext)) {
      return res.status(400).json({ error: `Unsupported file type: ${ext}` });
    }

    let buffer;
    try {
      buffer = Buffer.from(content, "base64");
    } catch {
      return res.status(400).json({ error: "Invalid base64 content" });
    }

    const maxBytes = (config.docling?.maxFileSizeMB || 50) * 1024 * 1024;
    if (buffer.length > maxBytes) {
      return res.status(413).json({
        error: `File too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB (max ${config.docling?.maxFileSizeMB || 50}MB)`,
      });
    }

    log(
      "INFO",
      `Converting document: ${filename} (${(buffer.length / 1024).toFixed(1)}KB)`,
    );

    const mkResponse = (result, converter) => ({
      markdown: result.markdown,
      filename,
      originalSize: buffer.length,
      markdownSize: result.markdown.length,
      truncated: result.truncated || false,
      status: result.status,
      processingTime: result.processingTime,
      errors: result.errors,
      converter,
    });

    // ── Try Docling first if enabled ──
    if (config.docling?.enabled) {
      try {
        const result = await convertDoc(
          config.docling.url,
          effectiveDoclingApiKey(config),
          buffer,
          filename,
          {
            outputFormat: config.docling.outputFormat || "md",
            ocr: config.docling.ocr !== false,
            ocrEngine: config.docling.ocrEngine || "easyocr",
            timeoutSec: config.docling.timeoutSec || 120,
          },
        );
        return res.json(mkResponse(result, "docling"));
      } catch (err) {
        const isConn =
          err.message?.includes("ECONNREFUSED") ||
          err.message?.includes("fetch failed");
        log(
          "WARN",
          `Docling ${isConn ? "unreachable" : "error"} for ${filename}: ${err.message}`,
        );
        // Fall through to built-in for supported formats
        if (!canConvertBuiltin(filename)) {
          if (isConn) {
            return res.status(503).json({
              error: `${ext.slice(1).toUpperCase()} files require Docling for conversion`,
              detail: `Cannot reach Docling at ${config.docling.url}. Built-in conversion supports PDF, DOCX, and XLSX only.`,
              setupHint:
                'pip install "docling-serve[ui]" && docling-serve run --host 127.0.0.1 --port 5002',
            });
          }
          return res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
        }
        log("INFO", `Falling back to built-in converter for ${filename}`);
      }
    }

    // ── Built-in fallback ──
    if (canConvertBuiltin(filename)) {
      try {
        const result = await convertBuiltin(buffer, filename);
        return res.json(mkResponse(result, "builtin"));
      } catch (err) {
        log("ERROR", `Built-in conversion failed: ${filename}`, {
          error: err.message,
        });
        return res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
      }
    }

    // ── Unsupported format without Docling ──
    const reason = !config.docling?.enabled
      ? "Document conversion (Docling) is disabled in Settings"
      : "Cannot reach the Docling server";
    return res.status(503).json({
      error: `${ext.slice(1).toUpperCase()} files require Docling for conversion`,
      detail: `${reason}. Built-in conversion supports PDF, DOCX, and XLSX only.`,
      setupHint:
        'pip install "docling-serve[ui]" && docling-serve run --host 127.0.0.1 --port 5002',
    });
  },
);

// ── MCP HTTP Server (Factory pattern) ─────────────────

// Factory: fresh McpServer per request (required for concurrency)
function createMcpServer() {
  const config = getConfig();
  const disabledTools = config.mcpServer?.disabledTools || [];
  const mcpServer = new McpServer({
    name: "code-companion-mcp",
    version: "1.0.0",
  });
  registerAllTools(
    mcpServer,
    {
      getConfig,
      log,
      debug,
      listModels,
      chatComplete,
      checkConnection,
      buildFileTree,
      readProjectFile,
      listConversations,
    },
    disabledTools,
  );
  return mcpServer;
}

// Place AFTER all /api/* routes but BEFORE SPA fallback
app.all("/mcp", requireLocalOrApiKey, async (req, res) => {
  try {
    const config = getConfig();
    if (config.mcpServer?.httpEnabled === false) {
      return res.status(503).json({ error: "MCP server is disabled" });
    }
    const mcpServer = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    log("ERROR", "MCP request failed", { error: err.message });
    if (!res.headersSent) {
      res.status(500).json({ error: "MCP server error" });
    }
  }
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
  const doclingResult = await startDocling(config, log);
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
