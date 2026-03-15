# External Integrations

**Analysis Date:** 2026-03-14

## APIs & External Services

**Ollama LLM:**
- Ollama REST API - LLM inference for chat, code explanation, review, scoring, Create wizard
  - Client: Native fetch (no SDK)
  - Auth: None (local/network access)
  - Base URL: `.cc-config.json` → `ollamaUrl` (default: http://localhost:11434)
  - Endpoints: `GET /api/tags`, `POST /api/chat`, `POST /api/pull`
  - Implementation: `lib/ollama-client.js` — `listModels`, `checkConnection`, `chatStream`, `chatComplete`, `chatStructured`

**Model Context Protocol (MCP):**
- **Server (hosted):** HTTP at `/mcp` via StreamableHTTPServerTransport; stdio via `mcp-server.js` (separate process)
  - SDK: @modelcontextprotocol/sdk
  - Config: `mcpServer.httpEnabled`, `mcpServer.disabledTools` in `.cc-config.json`
- **Client (outbound):** Connects to external MCP servers (stdio or HTTP)
  - Implementation: `lib/mcp-client-manager.js`, `lib/tool-call-handler.js`
  - Transports: StdioClientTransport, StreamableHTTPClientTransport

**GitHub:**
- GitHub REST API - Repo browsing, cloning, token validation
  - Client: Native `https` module (`lib/github.js`)
  - Auth: Personal Access Token (in-memory; not persisted)
  - Endpoints: `/user`, `/user/repos`, etc.
  - Git operations: `child_process` for clone, status, branch, diff, merge

**Spline 3D:**
- Spline Web Platform - 3D scene rendering
  - SDK: @splinetool/react-spline
  - Env: `VITE_SPLINE_SPLASH_SCENE`, `VITE_SPLINE_HEADER_SCENE`, `VITE_SPLINE_EMPTY_STATE_SCENE`
  - Components: `src/components/3d/SplashScreen.jsx`, `HeaderScene.jsx`, `EmptyStateScene.jsx`

**Electron Auto-Updates:**
- electron-updater - GitHub Releases
  - Config: `electron-builder.config.js` → `publish.provider: 'github'`, `owner: 'th3rdai'`, `repo: 'code-companion'`
  - Implementation: `electron/updater.js`

## Data Storage

**Databases:** None

**File Storage:**
- Local filesystem only
  - History: `history/` (JSON per conversation) — `lib/history.js`
  - Config: `.cc-config.json` — `lib/config.js`
  - GitHub clones: `github-repos/` — `lib/github.js`
  - Data root: `process.env.CC_DATA_DIR || __dirname`

**Caching:** In-memory (MCP stats, rate-limit buckets)

## Authentication & Identity

**Auth:** Custom/None
- GitHub: PAT via Settings; validated via `validateToken()` in `lib/github.js`
- Ollama, MCP: No auth (trusted local/network)

## Monitoring & Observability

**Error Tracking:** None

**Logs:**
- `lib/logger.js` — File-based; `logDir` from data root
- `DEBUG=1` or `DEBUG=true` for verbose output
- electron-log in Electron main process

## CI/CD & Deployment

**Hosting:** Self-hosted Node.js (default port 3000)

**CI:** Playwright E2E — `tests/` dir, webServer on port 4173

## Environment Configuration

**Required:**
- `PORT` - Server port (default 3000)
- `CC_DATA_DIR` - Data root (default: project root)

**Optional:**
- `DEBUG` - Debug logging
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_CHAT`, `RATE_LIMIT_MAX_CREATE`, `RATE_LIMIT_MAX_GITHUB_CLONE`, `RATE_LIMIT_MAX_MCP_TEST`, `RATE_LIMIT_MAX_REVIEW`, `RATE_LIMIT_MAX_SCORE`
- `VITE_SPLINE_*` - Spline scene URLs

**Secrets:** `.env` (git-ignored); GitHub PAT in memory only

## Webhooks & Callbacks

**Incoming:** None  
**Outgoing:** None

## REST API Endpoints

**Config:** `GET/POST /api/config`  
**Models:** `GET /api/models`  
**Chat:** `POST /api/chat` (SSE streaming)  
**Review:** `POST /api/review` (SSE or JSON)  
**Score:** `POST /api/score` (SSE or JSON)  
**History:** `GET/POST/DELETE /api/history`, `GET/DELETE /api/history/:id`  
**Files:** `GET /api/files/tree`, `GET /api/files/read`, `POST /api/files/upload`  
**Create:** `POST /api/create-project`  
**GitHub:** `GET/POST /api/github/*` (token, repos, clone, browse, open)
**Git (local repo):** `GitHubPanel.jsx` references `/api/git/status`, `/api/git/branch`, `/api/git/diff`, `/api/git/merge-preview`, `/api/git/resolve`, `/api/git/review` — `lib/github.js` exports `getGitStatus`, `createBranch`, `getGitDiff`, etc.; routes not found in `server.js` (may be unimplemented or in separate router)  
**MCP:** `GET/POST /api/mcp/server/*`, `GET/POST/DELETE /api/mcp/clients/*`  
**IDE Launch:** `POST /api/launch-claude-code`, `/api/launch-cursor`, `/api/launch-windsurf`, `/api/launch-opencode`  
**Logs:** `GET /api/logs`  
**MCP HTTP:** `app.all('/mcp')` — StreamableHTTPServerTransport

**Note:** `OllamaSetup.jsx` fetches `/api/health` in browser mode; no `/api/health` route found in `server.js`. May use `/api/models` or require endpoint addition.

---

*Integration audit: 2026-03-14*
