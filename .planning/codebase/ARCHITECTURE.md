# Architecture

**Analysis Date:** 2026-03-14

## Pattern Overview

**Overall:** Monolithic Express backend + React frontend + optional Electron shell, with real-time SSE streaming and dual MCP transport (HTTP + stdio)

**Key Characteristics:**
- **Four system boundaries:** Frontend (React), Backend (Express), Electron (optional), MCP (server + client)
- Backend-driven request/response for chat via Server-Sent Events (SSE)
- Mode-based UI switching: 8 chat modes + 3 builder modes (prompting, skillz, agentic)
- Dual MCP: HTTP transport at `/mcp` for in-app clients; stdio transport in `mcp-server.js` for Cursor/Claude Code
- MCP client manager connects to external MCP servers; tool calls parsed from Ollama responses (`TOOL_CALL: serverId.toolName(args)`)
- JSON-based local file storage; persistence path varies by runtime (dev vs Electron)
- Structured outputs: Review mode (report card), Builder modes (score cards) with Zod schemas

## System Boundaries

**Frontend (React):**
- Location: `src/`, `src/components/`, `src/contexts/`
- Entry: `src/main.jsx` → `Effects3DProvider` → `App`
- Serves: Browser or Electron renderer
- Depends on: `/api/*` REST endpoints, `window.electronAPI` when in Electron

**Backend (Express):**
- Location: `server.js`, `lib/`
- Entry: `server.js` (standalone) or spawned by `electron/main.js` as child process
- Serves: Static files (`dist/` or `public/`), API routes, MCP HTTP endpoint
- Depends on: Ollama REST API, filesystem, optional `electron/ide-launcher.js`

**Electron:**
- Location: `electron/main.js`, `electron/preload.js`, `electron/data-manager.js`, `electron/window-state.js`, `electron/menu.js`, `electron/updater.js`, `electron/ollama-setup.js`, `electron/ide-launcher.js`
- Entry: `electron/main.js` (when `npm run electron:dev`)
- Responsibilities: Spawn server child process, manage BrowserWindow, IPC bridge, data directory resolution, window state, auto-updater, Ollama setup wizard, IDE launching
- Data path: `app.getPath('userData')/CodeCompanion-Data` (migrates from legacy `./data`, `./history`, `.cc-config.json`)

**MCP Server (stdio):**
- Location: `mcp-server.js`, `mcp/tools.js`, `mcp/schemas.js`
- Entry: `node mcp-server.js` (used by Cursor, Claude Code)
- Transport: StdioServerTransport
- Tools: 6 mode tools + 5 utility tools (list_models, get_status, browse_files, read_file, list_conversations)

**MCP Server (HTTP):**
- Location: Same `mcp/tools.js`, `mcp/schemas.js`; mounted in `server.js` at `app.all('/mcp')`
- Transport: StreamableHTTPServerTransport
- Factory: `createMcpServer()` per request (stateless, concurrency-safe)

**MCP Client Manager:**
- Location: `lib/mcp-client-manager.js`, `lib/tool-call-handler.js`
- Purpose: Connect to external MCP servers (stdio or HTTP), execute tool calls, inject tool descriptions into chat system prompt
- Used by: `POST /api/chat` when external tools are connected

## Layers

**Presentation Layer (Frontend):**
- Purpose: Mode-specific UI for chat, review, create, builders
- Location: `src/App.jsx`, `src/components/`
- Contains: Mode tabs, ReviewPanel, CreateWizard, PromptingPanel/SkillzPanel/AgenticPanel, MessageBubble, FileBrowser, GitHubPanel, SettingsPanel
- Depends on: Express REST API, `window.electronAPI` (Electron only)
- Key state: `mode`, `messages`, `savedReview`, `savedBuilderData`, `projectFolder`, `selectedModel`

**API Layer (Backend Routes):**
- Purpose: HTTP handlers, orchestration, SSE streaming
- Location: `server.js` (main router), `lib/mcp-api-routes.js` (MCP CRUD)
- Key routes: `/api/chat`, `/api/review`, `/api/score`, `/api/config`, `/api/history`, `/api/files/*`, `/api/github/*`, `/api/create-project`, `/api/launch-*`, `/mcp`
- Depends on: lib modules, ToolCallHandler, McpClientManager

**Business Logic Layer:**
- Purpose: Domain operations
- Location: `lib/ollama-client.js`, `lib/review.js`, `lib/builder-score.js`, `lib/file-browser.js`, `lib/github.js`, `lib/icm-scaffolder.js`
- Depends on: Ollama API, filesystem, GitHub API
- Shared schemas: `lib/review-schema.js`, `lib/builder-schemas.js`

**Tool Execution Layer:**
- Purpose: Parse and execute MCP tool calls in agentic loop
- Location: `lib/tool-call-handler.js`, `lib/mcp-client-manager.js`
- Pattern: `TOOL_CALL: serverId.toolName(args)` → `mcpClientManager.callTool(serverId, toolName, args)`
- Used by: `/api/chat` when `buildToolsPrompt()` returns non-empty string

**Data Access Layer:**
- Purpose: Config and history persistence
- Location: `lib/config.js`, `lib/history.js`
- Config path: `{dataRoot}/.cc-config.json` (dataRoot = `CC_DATA_DIR` or `__dirname`)
- History path: `{dataRoot}/history/*.json`
- Electron: dataRoot = `app.getPath('userData')/CodeCompanion-Data`

## Data Flow

**Chat Request (no external tools):**
1. User sends message → `POST /api/chat` with `{ model, messages, mode }`
2. Backend selects `SYSTEM_PROMPTS[mode]` from `lib/prompts.js`
3. `chatStream()` to Ollama, stream response via SSE
4. Frontend appends tokens, renders markdown

**Chat Request (with MCP clients connected):**
1. `POST /api/chat` → `toolCallHandler.buildToolsPrompt()` appends tool list to system prompt
2. Tool-call loop (max 5 rounds): `chatComplete()` → parse `TOOL_CALL:` patterns → `toolCallHandler.executeTool()` → append results to messages → repeat
3. When no tool calls found, stream final text as SSE tokens
4. Frontend receives `{ token }`, `{ done }`, `{ error }` events

**Review Mode:**
1. User submits code in ReviewPanel → `POST /api/review` with `{ model, code, filename }`
2. `lib/review.js` calls `chatStructured()` with `reportCardJsonSchema` from `lib/review-schema.js`
3. On success: return `{ type: 'report-card', data }` (Zod-validated)
4. On failure: fallback to `chatStream()`, stream via SSE with `{ fallback: true }`
5. ReviewPanel renders ReportCard with categories (bugs, security, readability, completeness)

**Builder Modes (prompting, skillz, agentic):**
1. User submits content in PromptingPanel/SkillzPanel/AgenticPanel → `POST /api/score` with `{ model, mode, content, metadata }`
2. `lib/builder-score.js` uses `SCORE_SCHEMAS[mode]` from `lib/builder-schemas.js`
3. On success: return `{ type: 'score-card', data }`
4. On failure: fallback to chat stream
5. Builder panels render BuilderScoreCard

**Mode Routing (Frontend):**
- `src/App.jsx` MODES array: chat, explain, bugs, refactor, translate-tech, translate-biz, review, create, prompting, skillz, agentic
- BUILDER_MODES: prompting, skillz, agentic
- Conditional render: `mode === 'review'` → ReviewPanel; `BUILDER_MODES.includes(mode)` → builder panels; `mode === 'create'` → CreateWizard; else → chat + EmptyStateScene

**Persistence Paths:**
- Dev: `CC_DATA_DIR` or `__dirname` → `./.cc-config.json`, `./history/`
- Electron: `app.getPath('userData')/CodeCompanion-Data` → `.cc-config.json`, `history/`, `logs/`
- Migration: `electron/data-manager.js` migrates legacy `./data`, `./history`, `./.cc-config.json` on first run

**Electron IPC Bridge:**
- `electron/preload.js` exposes `window.electronAPI`: getAppVersion, getDataDir, exportData, importData, getLastMode, setLastMode, getPortConfig, setPortConfig, getActualPort, onPortFallback, checkForUpdates, restartForUpdate, launchIDE, checkOllama, installOllama, pullModel, onPullProgress

## Key Abstractions

**Conversation:**
- Schema: `{ id, title, mode, model, messages, createdAt, archived, reviewData?, builderData? }`
- reviewData: `{ reportData, filename, deepDiveMessages }`
- builderData: `{ modeId, name, scoreData, ... }`
- Stored: `lib/history.js` → `{dataRoot}/history/{id}.json`

**Mode:**
- Frontend: `MODES` in `src/App.jsx` (id, label, icon, desc, placeholder)
- Backend: `SYSTEM_PROMPTS` keys in `lib/prompts.js` (chat, explain, bugs, refactor, translate-tech, translate-biz, review, review-fallback, create)
- MCP tools: mode keys map to `codecompanion_chat`, `codecompanion_explain`, etc. in `mcp/tools.js`

**Report Card (Review):**
- Schema: `lib/review-schema.js` — overallGrade, topPriority, categories (bugs, security, readability, completeness), cleanBillOfHealth
- Each category: grade, summary, findings (title, severity, explanation, suggestedFix)

**Score Card (Builders):**
- Schemas: `lib/builder-schemas.js` — PromptScoreSchema, SkillScoreSchema, AgentScoreSchema
- Categories vary by mode (e.g., prompting: clarity, specificity, structure, effectiveness)

## Entry Points

**Backend (standalone):**
- `server.js` — `node server.js` or `npm start`
- Initializes: initConfig(dataRoot), initHistory(dataRoot), McpClientManager, ToolCallHandler
- Listens on PORT (default 3000)

**Backend (Electron):**
- `electron/main.js` forks `server.js` with `CC_DATA_DIR=dataDir`, `PORT=actualPort`
- Server sends `process.send({ type: 'server-ready', port })` when ready
- Main loads `http://localhost:{port}` in BrowserWindow

**Frontend:**
- `src/main.jsx` — ReactDOM.createRoot, Effects3DProvider, App
- Vite dev: port 5173, proxy `/api` and `/mcp` to 3000
- Production: Express serves `dist/` or `public/`

**MCP stdio:**
- `mcp-server.js` — `node mcp-server.js`
- Uses `__dirname` as appRoot for config/history
- Registers same tools as HTTP MCP via `registerAllTools()`

## Error Handling

**Strategy:** Try-catch with user-facing toasts and SSE error events

**Patterns:**
- Ollama errors: send `{ error }` SSE event, write `data: [DONE]\n\n`, end stream
- Tool execution: append error to tool results, continue loop
- Validation: 400 with message (missing model, invalid mode)
- File path traversal: 403 from `lib/file-browser.js` via `readProjectFile`
- Rate limiting: 429 with Retry-After header (chat, review, score, create-project, github/clone, mcp test-connection)

## Cross-Cutting Concerns

**Logging:** `lib/logger.js` — createLogger(dataRoot), writes to `logs/app.log`, `logs/debug.log`; DEBUG=1 enables console debug

**Rate Limiting:** In-memory per-IP buckets in `server.js`; env vars: RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_CHAT, etc.

**Config Sanitization:** `sanitizeConfigForClient()` masks githubToken, MCP env vars before sending to frontend

**IDE Launcher:** Conditionally required in server.js when `CC_DATA_DIR` or `process.versions.electron`; fallback to macOS-only osascript/execSync in dev

---

*Architecture analysis: 2026-03-14*
