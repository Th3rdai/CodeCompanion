# External Integrations

**Analysis Date:** 2026-03-13

## APIs & External Services

**Ollama (Local LLM):**
- Service: Ollama - Local large language model inference engine
  - What it's used for: All AI responses (chat, explain, bug hunting, refactoring, translation, project creation)
  - SDK/Client: Native `fetch()` API calls
  - Endpoints:
    - `GET /api/tags` - List available models
    - `POST /api/chat` - Streaming chat completions
  - Environment: `ollamaUrl` (default: `http://localhost:11434`)
  - Implementation: `lib/ollama-client.js`
    - `listModels()` - Fetch available models
    - `checkConnection()` - Test Ollama availability
    - `chatStream()` - Streaming response endpoint
    - `chatComplete()` - Non-streaming response (used in tool-call loops)

**GitHub API:**
- Service: GitHub REST API v3
  - What it's used for: Repository browsing, cloning (public and private), token validation
  - SDK/Client: Native `https` module
  - Endpoints:
    - `GET /user` - Validate personal access token
    - `GET /user/repos` - List authenticated user's repositories (paginated, 30 per page)
    - Git clone via `git` CLI with token injection
  - Environment: `githubToken` (GitHub Personal Access Token)
  - Implementation: `lib/github.js`
    - `validateToken()` - Verify token and fetch user info
    - `listUserRepos()` - Browse user's repos (requires token)
    - `cloneRepo()` - Clone public or private repos (shallow clone by default)
    - `parseGitHubUrl()` - Parse various GitHub URL formats
    - `buildCloneUrl()` - Build HTTPS clone URL with token injection

**Spline 3D Scenes:**
- Service: Spline (3D design platform)
  - What it's used for: Pre-built 3D scene integration for UI visual effects
  - SDK/Client: `@splinetool/react-spline`
  - Environment variables:
    - `VITE_SPLINE_SPLASH_SCENE` - Splash screen scene URL
    - `VITE_SPLINE_HEADER_SCENE` - Header area scene URL
    - `VITE_SPLINE_EMPTY_STATE_SCENE` - Empty state placeholder scene URL
  - Format: `https://prod.spline.design/[SCENE_ID]/scene.splinecode`
  - Implementation: `src/components/3d/SplineScene.jsx`, `src/components/3d/SplashScreen.jsx`, `src/components/3d/HeaderScene.jsx`, `src/components/3d/EmptyStateScene.jsx`

## Data Storage

**Databases:**
- Not used - this application has no external database
- All persistent data stored as JSON files locally

**File Storage:**
- Local filesystem only
  - Conversation history: `history/` directory
    - Format: `{id}.json` per conversation
    - Contents: Full message history, mode, model, metadata
  - Cloned repos: `github-repos/` directory
    - Format: `{owner}--{repo}/` subdirectories
    - Git metadata preserved for branch/commit info
  - Logs: `logs/` directory
    - `app.log` - Application events
    - `debug.log` - Debug output (when DEBUG=1)

**Caching:**
- Session-based in browser:
  - `sessionStorage` for splash screen dismissal state
- In-memory in backend:
  - Config cached in `lib/config.js` module
  - MCP connections cached in `McpClientManager`

## Authentication & Identity

**Auth Provider:**
- GitHub Personal Access Token (optional, for private repos)
  - Implementation: `lib/github.js`
  - Stored in `.cc-config.json` as `githubToken`
  - Validated via `/api/github/token` endpoint
  - Scopes recommended: `repo` (full control of private repos)
  - No OAuth flow - users provide token directly in Settings

**Internal Config Authentication:**
- No user authentication in the application itself
- All access control happens at the Ollama and GitHub API level
- MCP client connections require proper configuration (command + args or HTTP URL)

## Monitoring & Observability

**Error Tracking:**
- Not integrated (no Sentry, Rollbar, etc.)
- Errors logged to local files only

**Logs:**
- Local file logging via `lib/logger.js`
  - `app.log` - INFO and ERROR level events
  - `debug.log` - Verbose debug output (opt-in with DEBUG=1)
  - Log directory: `./logs/`
  - Request logging: Method, path, status code, duration (ms)
  - Error logging: Ollama connection failures, file read errors, GitHub API errors

**Observability:**
- Endpoints `/api/logs` to fetch recent logs from frontend
- Query params:
  - `type`: `app` or `debug` (default: `app`)
  - `lines`: Number of lines to return (default: 50)

## CI/CD & Deployment

**Hosting:**
- Not specified - self-hosted (local machine or custom deployment)
- Designed to run on same machine or local network
- Express server on port 3000 (configurable via `PORT` env var)
- Frontend dev server on port 5173 (Vite default, configurable in `vite.config.js`)

**CI Pipeline:**
- None integrated (no GitHub Actions, GitLab CI, etc.)

**Build:**
- Frontend build via Vite → `dist/`
- Backend uses Node.js directly (no build step)
- Production uses Express to serve Vite build or fallback to legacy `public/` folder

## Environment Configuration

**Required env vars:**
- `PORT` (optional, default: 3000) - Express server port
- `DEBUG` (optional) - Set to `1` or `true` for debug logging
- `OLLAMA_URL` (not used as env, set via config UI) - But code defaults to `http://localhost:11434`
- Spline scene URLs via `.env`:
  - `VITE_SPLINE_SPLASH_SCENE`
  - `VITE_SPLINE_HEADER_SCENE`
  - `VITE_SPLINE_EMPTY_STATE_SCENE`

**Secrets location:**
- `.env` file (not committed to git)
- `.cc-config.json` (stores GitHub token at runtime, tracked in code)
  - Contains: `ollamaUrl`, `projectFolder`, `githubToken`, `mcpClients`, `mcpServer`
  - User editable via Settings UI

## Webhooks & Callbacks

**Incoming:**
- None - Application does not expose webhook endpoints

**Outgoing:**
- Git webhooks: Not used
- GitHub Webhooks: Not used
- All integration is request-response based (no push notifications)

## External Tool Integration (MCP Clients)

**MCP Client Manager:**
- `lib/mcp-client-manager.js` manages connections to external MCP servers
- Supports two transport types:
  1. **Stdio** - Local process execution
     - Command format: `npx -y @mcp/[tool]` or custom executable
     - Environment variables passed through
  2. **HTTP** - Remote MCP server
     - URL format: `http://localhost:port` or HTTPS
- Connection state tracked per server ID
- Auto-connect feature for configured clients on startup

**MCP Server Modes:**
- **Web mode**: HTTP endpoint at `/mcp` for external clients
  - Configured: `config.mcpServer.httpEnabled`
- **Stdio mode**: CLI invocation via `npm run mcp`
  - For Claude Desktop, Cursor, other IDEs

**Tool Registration:**
- Server-side tools via `mcp/tools.js` and `mcp/schemas.js`
- Tools available to external MCP clients:
  - `codecompanion_chat` - Conversational mode
  - `codecompanion_explain` - Code explanation
  - `codecompanion_bugs` - Bug analysis
  - `codecompanion_refactor` - Refactoring suggestions
  - `codecompanion_translate_tech` - Tech to business translation
  - `codecompanion_translate_biz` - Business to tech translation
  - File browsing and reading tools
  - Model listing and status tools
  - History retrieval tools

**Tool-Call Loop:**
- Ollama responses parsed for `TOOL_CALL` patterns
- Up to 5 rounds of tool execution per request
- Tool results re-injected into LLM context for multi-step reasoning

---

*Integration audit: 2026-03-13*
