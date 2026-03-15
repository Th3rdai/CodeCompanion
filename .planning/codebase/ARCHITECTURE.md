# Architecture

**Analysis Date:** 2026-03-14

## Pattern Overview

**Overall:** Monolithic Express + React SPA with optional Electron shell

**Key Characteristics:**
- Single Express server serves API + static SPA
- Server-Sent Events (SSE) for streaming AI responses
- MCP server runs in-process (HTTP) or as stdio subprocess
- Electron spawns server as child process, loads app in BrowserWindow
- No database — JSON file storage for config and history

## Layers

**API Layer:**
- Purpose: HTTP endpoints, rate limiting, request validation
- Location: `server.js`
- Contains: Route handlers, rate limiter, MCP HTTP endpoint
- Depends on: lib modules, MCP tools
- Used by: React frontend, MCP clients, external tools

**Business Logic:**
- Purpose: Ollama calls, review/scoring, file browsing, GitHub, scaffolding
- Location: `lib/`
- Contains: `ollama-client.js`, `review.js`, `builder-score.js`, `file-browser.js`, `github.js`, `icm-scaffolder.js`, `history.js`, `config.js`, `mcp-client-manager.js`, `tool-call-handler.js`, `mcp-api-routes.js`
- Depends on: Node built-ins, MCP SDK
- Used by: `server.js`, `mcp-server.js`

**MCP Layer:**
- Purpose: Expose tools to Claude/Cursor; connect to external MCP clients
- Location: `mcp/`, `mcp-server.js`
- Contains: `mcp/tools.js`, `mcp/schemas.js` — tool registration and Zod schemas
- Depends on: lib (config, ollama, history, file-browser)
- Used by: MCP clients (stdio), HTTP `/mcp` endpoint

**Presentation Layer:**
- Purpose: UI for 11 modes, settings, file browser, GitHub, MCP management
- Location: `src/`
- Contains: `App.jsx`, `src/components/`, `src/contexts/`
- Depends on: Fetch API, localStorage, optional `window.electronAPI`
- Used by: End users

**Electron Layer:**
- Purpose: Desktop app shell, server lifecycle, IDE launch, Ollama setup
- Location: `electron/`
- Contains: `main.js`, `preload.js`, `menu.js`, `data-manager.js`, `window-state.js`, `updater.js`, `ollama-setup.js`, `ide-launcher.js`
- Depends on: Node, Electron APIs
- Used by: Desktop users

## Data Flow

**Chat (streaming):**
1. Client POSTs `/api/chat` with model, messages, mode
2. Server enriches system prompt with MCP tool descriptions if clients connected
3. If external tools: `chatComplete` + tool-call loop (max 5 rounds), then stream final text
4. Else: `chatStream` → parse Ollama JSON lines → send SSE `{ token }` events
5. Client appends tokens to message bubble in real time

**Review / Score:**
1. Client POSTs `/api/review` or `/api/score`
2. Server calls `reviewCode` or `scoreContent` (Ollama with JSON schema)
3. On success: return structured JSON (report-card / score-card)
4. On schema failure: fallback to streaming chat response via SSE

**MCP Tool Call (from LLM):**
1. LLM returns text with `<TOOL_CALL>...</TOOL_CALL>` blocks
2. `tool-call-handler.js` parses, `mcp-client-manager` executes
3. Results fed back as user message; loop until no more tool calls or max rounds

**State Management:**
- React `useState` / `useCallback` in `App.jsx` — no Redux/Zustand
- `localStorage` for selected model, onboarding completion
- Electron: `window.electronAPI` for data dir, export/import, last mode, port config

## Key Abstractions

**Mode:**
- Purpose: Chat behavior and system prompt
- Examples: `src/App.jsx` MODES array, `lib/prompts.js` SYSTEM_PROMPTS
- Pattern: Mode id maps to prompt and placeholder

**Builder Mode:**
- Purpose: Config-driven forms with AI scoring
- Examples: `src/components/builders/BaseBuilderPanel.jsx`, `PromptingPanel.jsx`, `SkillzPanel.jsx`, `AgenticPanel.jsx`
- Pattern: Shared BaseBuilderPanel, mode-specific schema from `lib/builder-schemas.js`

**MCP Tool:**
- Purpose: Callable capability for MCP clients
- Examples: `mcp/tools.js` — `codecompanion_chat`, `codecompanion_explain`, `browse_files`, etc.
- Pattern: `server.tool(name, description, schema, handler)`

## Entry Points

**Web:**
- Location: `server.js` → `app.listen(PORT)`
- Triggers: `node server.js` or `npm start`
- Responsibilities: Serve API, static files, MCP HTTP

**MCP stdio:**
- Location: `mcp-server.js`
- Triggers: `node mcp-server.js` (by Claude Desktop, Cursor, etc.)
- Responsibilities: Register tools, handle stdio transport

**Desktop:**
- Location: `electron/main.js`
- Triggers: `electron electron/main.js` or packaged app
- Responsibilities: Spawn server, create window, IPC handlers

**Frontend:**
- Location: `src/main.jsx`
- Triggers: Vite dev server or static load from Express
- Responsibilities: Mount React app with Effects3DProvider

## Error Handling

**Strategy:** Try/catch with logging; return 4xx/5xx or SSE error events

**Patterns:**
- API: `res.status(400|500).json({ error })`
- SSE: `sendEvent({ error })` then `res.write('data: [DONE]\n\n')`
- Ollama offline: 503 with `connected: false`
- MCP: `isError: true` in tool response content

## Cross-Cutting Concerns

**Logging:** `lib/logger.js` — file + optional console, `log('INFO', ...)`, `debug(...)`
**Validation:** Zod in `lib/builder-schemas.js`, `mcp/schemas.js`; manual checks in route handlers
**Authentication:** None for app; GitHub token and MCP env stored in config, masked in responses

---

*Architecture analysis: 2026-03-14*
