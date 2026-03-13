# External Integrations

**Analysis Date:** 2026-03-13

## APIs & External Services

**Ollama LLM:**
- Ollama REST API - LLM inference for chat, code explanation, bug detection, refactoring
  - SDK/Client: Fetch API (native) to Ollama HTTP endpoints
  - Auth: None (expects local/network access)
  - Base URL: Configurable via `.cc-config.json` (default: http://localhost:11434)
  - Endpoints used:
    - `GET /api/tags` - List available models
    - `POST /api/chat` - Stream chat completions (streaming responses via Server-Sent Events pattern)
  - Implementation: `lib/ollama-client.js` exports `listModels()`, `checkConnection()`, `chatStream()`, `chatComplete()`

**Model Context Protocol (MCP):**
- Connects to external MCP servers (stdio or HTTP transport)
  - SDK: @modelcontextprotocol/sdk 1.27.1
  - Purpose: Tool discovery and execution from external MCP servers
  - Transports:
    - Stdio - Direct subprocess execution (e.g., npx @mcp/server-*)
    - HTTP - Remote MCP servers via StreamableHTTPClientTransport
  - Implementation: `lib/mcp-client-manager.js` manages multiple MCP client connections
  - API Endpoints:
    - `GET /api/mcp/clients` - List connected MCP servers
    - `POST /api/mcp/clients` - Register new MCP server connection
    - `DELETE /api/mcp/clients/:id` - Disconnect MCP server
    - `GET /api/mcp/server/tools` - List all available tools from all MCP servers
    - `GET /api/mcp/server/status` - Server status and connection health
    - `GET /api/mcp/server/stats` - Performance metrics

**GitHub Integration:**
- GitHub REST API - Browse, clone, and manage GitHub repositories
  - SDK/Client: Fetch API (native) + child_process for git operations
  - Auth: Personal Access Token (stored in-memory, status checked via `/api/github/token/status`)
  - Configuration: Token provided via Settings Panel UI
  - Operations:
    - List user repositories
    - Clone public and private repos
    - Browse repository file trees
  - Implementation: `lib/github.js` handles GitHub operations
  - API Endpoints:
    - `GET /api/github/repos` - List user's GitHub repos
    - `POST /api/github/clone` - Clone a repo locally
    - `GET /api/github/browse` - Browse repo file tree
    - `POST /api/github/open` - Open cloned repo in file browser
    - `DELETE /api/github/repos/:name` - Delete local clone
    - `GET /api/github/token/status` - Check if GitHub token is set
    - `POST /api/github/token` - Store GitHub Personal Access Token

**Spline 3D Scenes:**
- Spline Web Platform - 3D scene rendering
  - SDK: @splinetool/react-spline 4.1.0
  - Auth: Scene URLs provided via environment variables
  - Environment variables:
    - `VITE_SPLINE_SPLASH_SCENE` - Splash screen 3D scene
    - `VITE_SPLINE_HEADER_SCENE` - App header 3D scene
    - `VITE_SPLINE_EMPTY_STATE_SCENE` - Empty state 3D scene
  - Components: `src/components/3d/SplashScreen.jsx`, `src/components/3d/HeaderScene.jsx`, `src/components/3d/EmptyStateScene.jsx`
  - Gracefully handles missing scenes with fallback UI

## Data Storage

**Databases:**
- None - No external database required

**File Storage:**
- Local filesystem only
  - Conversation history: `history/` directory (JSON files per conversation)
  - GitHub clones: `github-repos/` directory (temporary storage)
  - Configuration: `.cc-config.json` (root)
  - Project scaffolds: Generated via `lib/icm-scaffolder.js`

**Caching:**
- In-memory only (conversation context, model list, MCP tool cache)
- No persistent cache layer

## Authentication & Identity

**Auth Provider:**
- Custom/None - No centralized auth system
  - GitHub: Personal Access Token (PAT) stored temporarily in server memory
  - MCP: No authentication; assumes trusted local/network servers
  - Ollama: No authentication required (assumes local or network access)

**Token Management:**
- GitHub PAT: User provides via Settings Panel, validated via GitHub API
- Implementation: `lib/github.js` functions `validateToken()` checks token validity

## Monitoring & Observability

**Error Tracking:**
- None - No external error tracking service

**Logs:**
- File-based logging via `lib/logger.js`
  - Log file location: Determined by `logDir` from logger initialization
  - Debug flag: `DEBUG` environment variable (process.env.DEBUG === '1' or 'true')
  - Metrics: Performance tracking in `server.js` (requests, latency, throughput, CPU usage)

## CI/CD & Deployment

**Hosting:**
- Self-hosted Node.js backend on configured port (default: 3000)
- Static frontend served from Vite build output (`dist/`)

**CI Pipeline:**
- Playwright for E2E testing (playwright.config.js)
  - Test dir: `test/e2e/`
  - Base URL: http://127.0.0.1:4173 (preview/production server)
  - Web server: Starts `node server.js` on port 4173

## Environment Configuration

**Required env vars:**
- `PORT` - Express server port (default: 3000)
- `DEBUG` - Enable debug logging ('1' or 'true')
- Spline scene URLs (prefixed with `VITE_*` for frontend):
  - `VITE_SPLINE_SPLASH_SCENE`
  - `VITE_SPLINE_HEADER_SCENE`
  - `VITE_SPLINE_EMPTY_STATE_SCENE`

**Secrets location:**
- `.env` file (git-ignored) - Contains Spline URLs and any sensitive config
- GitHub PAT: Runtime memory only (not persisted; user must re-enter per session)

## Webhooks & Callbacks

**Incoming:**
- None - No webhook endpoints exposed

**Outgoing:**
- None - No outbound webhooks configured

## REST API Endpoints Summary

**Chat & AI:**
- `POST /api/chat` - Stream AI responses (Server-Sent Events format)
- `GET /api/config` - Fetch app configuration
- `POST /api/config` - Update app configuration

**History:**
- `GET /api/history` - List conversations
- `GET /api/history/:id` - Get conversation details
- `POST /api/history/:id` - Save conversation
- `DELETE /api/history/:id` - Delete conversation

**Project Creation:**
- `POST /api/create-project` - Scaffold new ICM project structure

**File Operations:**
- `POST /api/file-tree` - Get project file tree for browsing
- `GET /api/project/:path` - Read file content

**Server-Sent Events:**
- Chat responses stream as JSON lines with `data: ` prefix format:
  - `{ token: "...", eval_count: N, total_duration: Ns }`
  - `{ done: true }`
  - `{ error: "..." }`
  - `[DONE]` message marks end of stream

---

*Integration audit: 2026-03-13*
