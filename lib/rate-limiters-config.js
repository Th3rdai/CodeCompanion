/**
 * lib/rate-limiters-config.js
 *
 * Centralized rate-limiter wiring for all /api/* routes. Called once during
 * bootstrap. Extracted from server.js in Phase 24.5-03.
 *
 * Usage:
 *   const { registerRateLimiters } = require("./lib/rate-limiters-config");
 *   registerRateLimiters(app);
 */

const { createRateLimiter } = require("./rate-limiter");

function envNum(key, fallback) {
  return Number(process.env[key] || fallback);
}

function registerRateLimiters(app) {
  const RATE_LIMIT_WINDOW_MS = envNum("RATE_LIMIT_WINDOW_MS", 60000);
  const CHAT_RATE_LIMIT_MAX = envNum("RATE_LIMIT_MAX_CHAT", 30);
  const CREATE_RATE_LIMIT_MAX = envNum("RATE_LIMIT_MAX_CREATE", 12);
  const GITHUB_CLONE_RATE_LIMIT_MAX = envNum("RATE_LIMIT_MAX_GITHUB_CLONE", 6);
  const MCP_TEST_RATE_LIMIT_MAX = envNum("RATE_LIMIT_MAX_MCP_TEST", 12);
  const REVIEW_RATE_LIMIT_MAX = envNum("RATE_LIMIT_MAX_REVIEW", 20);
  const SCORE_RATE_LIMIT_MAX = envNum("RATE_LIMIT_MAX_SCORE", 20);
  const MEMORY_RATE_LIMIT_MAX = envNum("RATE_LIMIT_MAX_MEMORY", 30);
  const API_GLOBAL_RATE_MAX = envNum("RATE_LIMIT_MAX_API_GLOBAL", 300);

  const mount = (path, opts) => app.use(path, createRateLimiter(opts));

  mount("/api/chat", {
    name: "chat",
    max: CHAT_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  });
  mount("/api/experiment", {
    name: "experiment",
    max: CHAT_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  });
  mount("/api/create-project", {
    name: "create-project",
    max: CREATE_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  });
  mount("/api/build-project", {
    name: "build-project",
    max: CREATE_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  });
  mount("/api/build/projects", {
    name: "build-registry",
    max: CREATE_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST", "DELETE"],
  });
  mount("/api/github/clone", {
    name: "github-clone",
    max: GITHUB_CLONE_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  });
  mount("/api/mcp/clients/test-connection", {
    name: "mcp-test-connection",
    max: MCP_TEST_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  });
  mount("/api/review", {
    name: "review",
    max: REVIEW_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  });
  mount("/api/pentest", {
    name: "pentest",
    max: REVIEW_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  });
  mount("/api/score", {
    name: "score",
    max: SCORE_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  });
  mount("/api/tutorial-suggestions", {
    name: "tutorial-suggestions",
    max: 20,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST"],
  });
  mount("/api/memory", {
    name: "memory",
    max: MEMORY_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST", "PUT", "DELETE"],
  });
  mount("/api/build/projects/:id/next-action", {
    name: "build-next-action",
    max: 10,
    windowMs: 60000,
    methods: ["POST"],
  });
  mount("/api/build/projects/:id/research", {
    name: "build-research",
    max: 5,
    windowMs: 60000,
    methods: ["POST"],
  });
  mount("/api/build/projects/:id/plan", {
    name: "build-plan",
    max: 5,
    windowMs: 60000,
    methods: ["POST"],
  });
  mount("/api/generate-office", {
    name: "office-gen",
    max: 30,
    windowMs: 60000,
    methods: ["POST"],
  });
  mount("/api", {
    name: "api-global",
    max: API_GLOBAL_RATE_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });
}

module.exports = { registerRateLimiters };
