# Architecture

**Analysis Date:** 2026-03-13

## Pattern Overview

**Overall:** Full-stack client-server with streaming AI integration and pluggable MCP (Model Context Protocol) support

**Key Characteristics:**
- Real-time SSE (Server-Sent Events) streaming for Ollama AI responses
- Dual-transport MCP client (stdio and HTTP) for external tool integration
- Mode-based routing for distinct PM-focused workflows
- Frontend: Single SPA (Single Page App) compiled by Vite
- Backend: Stateless Express.js with file-based persistence (no database)
- Tool-call loop: Recursive AI reasoning with external tool execution

## Layers

**Frontend (React + Vite):**
- Purpose: PM-focused UI with real-time chat, file browsing, GitHub integration
- Location: `src/`
- Contains: React components, contexts, CSS (Tailwind via CDN in dev)
- Depends on: Backend API (`/api/*`), SSE streams, MCP client interface
- Used by: Browser users
- Entry: `src/main.jsx` → `src/App.jsx`

**Backend HTTP Server (Express):**
- Purpose: Request routing, AI orchestration, file operations, GitHub operations
- Location: `server.js`, `lib/mcp-api-routes.js`
- Contains: REST API endpoints, SSE stream handlers, config management
- Depends on: `lib/*` modules, Ollama REST API, file system
- Used by: Frontend, MCP clients
- Responsibilities:
  - Chat endpoint with tool-call loop logic
  - File browser and Git operations
  - MCP server/client management
  - Conversation history persistence

**Ollama AI Client:**
- Purpose: Interface with locally-hosted Ollama LLM
- Location: `lib/ollama-client.js`
- Contains: `listModels()`, `chatStream()`, `chatComplete()`, `checkConnection()`
- Depends on: Fetch API, remote Ollama service
- Used by: `server.js` chat endpoint, MCP client manager
- Note: Non-streaming `chatComplete()` used for tool-call rounds; streaming used for final response

**MCP Integration Layer:**
- Purpose: Manage external AI tool integrations via Model Context Protocol
- Location: `lib/mcp-client-manager.js`, `lib/tool-call-handler.js`, `mcp/tools.js`, `server.js` (/mcp endpoint)
- Contains:
  - Client management (stdio and HTTP transports)
  - Tool registry and execution
  - Tool-call parsing and results feeding
- Depends on: `@modelcontextprotocol/sdk`
- Used by: Chat endpoint, MCP API routes
- Note: Factory pattern for fresh MCP server per request (required for concurrency)

**Storage Layer (File-based):**
- Purpose: Persist configuration, conversation history, logs
- Location: `lib/config.js`, `lib/history.js`, `lib/logger.js`
- Contains: JSON file readers/writers, UUID generation
- Depends on: File system
- Used by: Express app initialization, chat history endpoints
- Locations:
  - Config: `.cc-config.json` (Ollama URL, project folder, GitHub token, MCP config)
  - History: `history/` directory (one JSON file per conversation)
  - Logs: `logs/` directory (app.log, debug.log)

**File & Project Browser:**
- Purpose: Read project files, build directory trees, validate paths
- Location: `lib/file-browser.js`
- Contains: `buildFileTree()`, `readProjectFile()`, path traversal guards
- Depends on: File system, path utilities
- Used by: File browser API, chat file attachments
- Security: Validates paths against traversal attacks

**GitHub Integration:**
- Purpose: Clone repos, list user repos, validate tokens
- Location: `lib/github.js`
- Contains: `cloneRepo()`, `listUserRepos()`, `validateToken()`, repo cleanup
- Depends on: Child process (git CLI), fetch API
- Used by: GitHub panel API endpoints
- Storage: Cloned repos in `github-repos/` directory

**Project Scaffolder:**
- Purpose: Generate ICM (Integrated Content Model) project structures
- Location: `lib/icm-scaffolder.js`
- Contains: `scaffoldProject()` with template generation
- Depends on: File system, directory creation
- Used by: Create Project endpoint

## Data Flow

**Chat Request Flow (with tool calls):**

1. **Frontend** → POST `/api/chat` with `{ model, messages, mode }`
2. **server.js** receives request, enriches system prompt with available tools
3. **Tool-call loop** (max 5 rounds):
   - Call `chatComplete()` (non-streaming) to Ollama with all messages
   - Parse response for TOOL_CALL patterns using regex
   - If no tool calls found → exit loop, use response as final text
   - If tool calls found → execute via MCP client manager
   - Append tool results to message history and continue
4. **Final text** streamed back via SSE as tokens (word-by-word for UX)
5. Response ends with `[DONE]` marker

**Chat Request Flow (without tool calls):**

1. **Frontend** → POST `/api/chat`
2. **server.js` sets SSE headers and connects to Ollama
3. Ollama response body piped as event stream:
   - Each newline-delimited JSON chunk parsed
   - `message.content` extracted and sent as `{ token: "..." }`
   - When Ollama sends `done: true`, stream ends
4. Frontend accumulates tokens into final response

**Configuration Update Flow:**

1. **Frontend** → POST `/api/config` with `{ ollamaUrl, projectFolder }`
2. **server.js** validates folder exists
3. Writes to `.cc-config.json` via `config.js`
4. Returns new config to frontend
5. Frontend refetches models if Ollama URL changed

**Conversation History Flow:**

1. **Frontend** posts message → sends `POST /api/history` with full conversation data
2. **server.js** calls `saveConversation(data)` from `history.js`
3. UUID generated if needed, JSON file written to `history/{id}.json`
4. Frontend retrieves list via `GET /api/history`

**File Browser Flow:**

1. **Frontend** → `GET /api/files/tree?path=/some/path&depth=3`
2. **server.js** calls `buildFileTree()` with depth limit
3. Returns nested object: `{ type: 'dir', path, children: [...] }`
4. Frontend on file click → `GET /api/files/read?path=/some/file.js`
5. Returns `{ name, size, language, content, lines }`

## State Management

**Frontend:** React hooks (useState, useContext)
- Global context: `Effects3DContext` for 3D effect toggle state
- Local: chat messages, sidebar open/closed, selected mode, attached files
- Persisted: splash screen dismissal (sessionStorage)

**Backend:** In-memory
- MCP client connections (Map)
- Request logging context
- Ephemeral per-request state (no session library)

**Persistent:** File-based
- Conversations (JSON files)
- Configuration (`.cc-config.json`)
- Logs (text files)

## Key Abstractions

**Mode System:**
- Purpose: Encapsulate distinct PM workflows
- Modes: `chat`, `explain`, `bugs`, `refactor`, `translate-tech`, `translate-biz`, `create`
- Implementation: Each mode has a system prompt (SYSTEM_PROMPTS dict in `lib/prompts.js`)
- Mode guardrails: Ensure conversational fallback if no code is provided
- Example: Mode `bugs` uses system prompt that structures response with [Severity], impact, fix suggestions

**MCP Tool Registry:**
- Purpose: Abstract external tools behind standard interface
- Pattern: Each connected MCP server has a set of tools
- Execution: Parse TOOL_CALL markers in AI response, call `toolCallHandler.executeTool(serverId, toolName, args)`
- Results fed back to AI as context for next reasoning round

**Message Bubble Component:**
- Purpose: Unified rendering of user vs. assistant messages
- Pattern: Conditional styling, markdown rendering for AI responses, copy button
- Location: `src/components/MessageBubble.jsx`

**Sidebar Conversation List:**
- Purpose: Manage conversation history
- Pattern: Search, filter (active/archived), context menu (rename, export, delete, archive)
- Location: `src/components/Sidebar.jsx`

## Entry Points

**HTTP Server:**
- Location: `server.js`
- Invocation: `node server.js` (PORT defaults to 3000)
- Initialization: Config → History → Ollama connection check → MCP client setup
- Error handling: Graceful degradation if Ollama unavailable; MCP errors logged but don't crash server

**Frontend Bundle Entry:**
- Location: `src/main.jsx`
- Invocation: `npm run dev` (Vite dev server on 5173) or `npm run build` (produces `dist/`)
- Root element: `#root` in `dist/index.html`
- Provider: `Effects3DProvider` wraps `App` component

**Development Proxy:**
- Frontend (port 5173) proxies `/api/*` and `/mcp` to backend (port 3000) via Vite config
- Production: Static files served from `dist/` by Express; API on same origin

## Error Handling

**Strategy:** Fail gracefully with user feedback

**Patterns:**

- **Ollama Unavailable:**
  - Endpoint returns 503 with `{ error, ollamaUrl, connected: false }`
  - Frontend shows offline banner, disabled model selector
  - File `server.js` lines 92-115

- **Path Traversal Attack:**
  - Blocked in `readProjectFile()` with 403 response
  - File `server.js` lines 406-409

- **Tool Call Failure:**
  - Caught in tool-call loop, results formatted as "Tool X failed: {error}"
  - Loop continues, AI sees failure context and can decide next action
  - File `server.js` lines 202-210

- **Stream Disconnect:**
  - Client close event detected, reader cancelled gracefully
  - File `server.js` lines 318-321

- **MCP Server Error:**
  - Factory pattern isolates per-request errors
  - 500 response with error message, doesn't crash server
  - File `server.js` lines 571-576

## Cross-Cutting Concerns

**Logging:**
- Framework: Custom logger (`lib/logger.js`)
- Pattern: `log(level, message, metadata)` and `debug(message, metadata)`
- Output: `logs/app.log` (info) and `logs/debug.log` (debug)
- Usage: Every major operation logged with timestamps

**Validation:**
- Config: Folder existence checked before save
- Files: Path traversal guard in `readProjectFile()`
- Requests: Model, messages, mode validated before chat endpoint processing
- GitHub: Token validated via API before save

**Authentication:**
- GitHub token stored in config (`.cc-config.json`), never in logs
- No session auth; all state in browser (can be lost on refresh)
- MCP servers authenticated per their own config (env vars, tokens)

---

*Architecture analysis: 2026-03-13*
