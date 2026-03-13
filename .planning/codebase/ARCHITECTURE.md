# Architecture

**Analysis Date:** 2026-03-13

## Pattern Overview

**Overall:** Multi-tier client-server architecture with mode-based AI interaction patterns. Backend Express.js server acts as orchestrator between frontend React SPA and Ollama LLM service, with pluggable MCP (Model Context Protocol) integration layer.

**Key Characteristics:**
- Streaming-first design using Server-Sent Events (SSE) for real-time token delivery
- Tool-call loop pattern enabling external MCP tools to be integrated into LLM responses
- Conversation-driven workflow with multiple specialized AI "modes" (Chat, Explain, Bug Hunter, Refactor, Translate-Tech, Translate-Biz, Create)
- File-aware architecture with project browser and GitHub integration
- Configuration-driven MCP client/server ecosystem

## Layers

**Presentation Layer (Frontend):**
- Purpose: React-based SPA providing UI for PM workflows, mode selection, conversation history, and settings
- Location: `src/`, `public/`
- Contains: React components (25+ components organized by concern), contexts for global state (Effects3DContext), hooks, styling via Tailwind CSS
- Depends on: Express backend via `/api` endpoints, Ollama connection status
- Used by: Browser, ultimate PM users
- Key entry: `src/main.jsx` → `src/App.jsx` (516 lines, monolithic root component managing all state)

**API/Orchestration Layer (Express Server):**
- Purpose: Central hub managing Ollama communication, conversation persistence, MCP connections, file access, GitHub integration
- Location: `server.js` (651 lines)
- Contains: Express route handlers for `/api/chat`, `/api/config`, `/api/history`, `/api/files/*`, `/api/github/*`, `/mcp` (HTTP transport)
- Depends on: Lib modules (ollama-client, config, history, file-browser, github, mcp-client-manager, tool-call-handler)
- Used by: Frontend via HTTP/SSE, external MCP servers via HTTP transport
- Key routes: POST `/api/chat` (SSE streaming with tool-call loop), GET `/api/models`, GET/POST/DELETE `/api/history/*`

**Service/Business Logic Layer:**
- Purpose: Encapsulates domain-specific operations for AI, file system, version control, and MCP orchestration
- Location: `lib/` directory (11 modules)
- Contains:
  - `ollama-client.js`: Ollama API wrapper (listModels, chatStream, chatComplete)
  - `mcp-client-manager.js`: MCP connection lifecycle (connect, disconnect, callTool, getAllTools)
  - `tool-call-handler.js`: Parses and executes tool calls from LLM responses (TOOL_CALL regex pattern)
  - `history.js`: Conversation persistence (getConversation, saveConversation, listConversations)
  - `config.js`: Application configuration (ollamaUrl, projectFolder, githubToken, mcpClients)
  - `file-browser.js`: Project file system navigation (buildFileTree, readProjectFile, isTextFile)
  - `github.js`: GitHub integration (cloneRepo, listUserRepos, validateToken)
  - `prompts.js`: System prompts for each mode (chat, explain, bugs, refactor, translate-tech, translate-biz, create)
  - `mcp-api-routes.js`: API endpoints for MCP management
  - `logger.js`: Structured logging with debug support
  - `icm-scaffolder.js`: Project template scaffolding (Create mode)
- Depends on: External services (Ollama, GitHub API, MCP servers), filesystem, configuration
- Used by: Server orchestration layer

**Data Persistence Layer:**
- Purpose: Store conversation history and configuration
- Location: `history/` (JSON files), config file (`.cc-config.json`)
- Contains: Conversation records with messages, metadata; application config with Ollama URL, GitHub token, MCP client definitions
- Format: JSON files (no external database; filesystem-based)

**External Integration Layer:**
- Purpose: Connect to external AI and context providers
- Ollama REST API: LLM inference via `http://192.168.50.7:11424/api/chat`, `http://192.168.50.7:11424/api/tags`
- MCP Servers: External tools via stdio (subprocess) or HTTP transport, managed by McpClientManager
- GitHub API: Repository access and authentication validation

## Data Flow

**Chat Message Flow (without external tools):**

1. User sends message in chat mode
2. Frontend calls POST `/api/chat` with `{ model, messages, mode }`
3. Backend:
   - Looks up system prompt for mode from `lib/prompts.js`
   - Prepends system prompt to message array
   - Calls `ollama-client.chatStream()` → fetch to Ollama `/api/chat` with stream=true
4. Ollama streams response as newline-delimited JSON
5. Backend parses each chunk, sends SSE events with tokens to frontend
6. Frontend accumulates tokens into message bubbles, scrolls to bottom

**Chat Message Flow (with external MCP tools):**

1. User sends message, MCP clients connected
2. Backend:
   - Builds tools prompt from connected MCP servers via `tool-call-handler.buildToolsPrompt()`
   - Injects tools list into system prompt as "Available external tools" section
3. Enters tool-call loop (max 5 rounds):
   - Calls `ollama-client.chatComplete()` (non-streaming) with current message stack
   - Parses response for `TOOL_CALL: serverId.toolName(args)` patterns via regex
   - If no tool calls found, returns response as final text
   - If tool calls found:
     - Executes each via `toolCallHandler.executeTool()` → `mcpClientManager.callTool()`
     - Appends tool results back to message stack: `{ role: 'assistant', content: response }`, then `{ role: 'user', content: 'Tool results:\n...' }`
     - Next round uses enriched message history
4. When no more tool calls, streams final text as SSE tokens (word by word for UX)

**Configuration & Mode Selection Flow:**

1. On startup, `server.js` calls `initConfig()` → loads or creates `.cc-config.json`
2. Frontend calls GET `/api/config` on mount, receives `{ ollamaUrl, projectFolder, githubToken, mcpClients }`
3. Frontend calls GET `/api/models` → backend queries Ollama `/api/tags`, returns available models
4. User selects mode (one of MODES array in App.jsx) → system prompt changes via `lib/prompts.js`
5. User selects model → stored in frontend state
6. Settings panel allows updating ollamaUrl, projectFolder, GitHub token, MCP client list

**Conversation History Flow:**

1. Frontend calls POST `/api/history` with conversation object after send button
2. Backend calls `saveConversation()` → generates UUID, writes JSON file to `history/` directory
3. Frontend polls GET `/api/history` periodically to load conversation list for sidebar
4. User clicks history item → frontend calls GET `/api/history/:id`, receives full conversation, populates chat
5. User deletes → DELETE `/api/history/:id` removes file

**File Browser Flow:**

1. Frontend calls GET `/api/files/tree?path=/some/folder&depth=3`
2. Backend calls `buildFileTree()` → recursively lists directory with max depth, filters ignored patterns
3. Frontend displays tree, user clicks file
4. Frontend calls GET `/api/files/read?path=src/App.jsx`
5. Backend calls `readProjectFile()` → validates path (no traversal), reads file content, returns with line count
6. Frontend displays in code block or attaches to chat

**MCP Management Flow:**

1. User adds MCP client in Settings: `{ id, name, transport, command/url, autoConnect }`
2. Frontend POST `/api/mcp/clients` with config → backend stores in config, broadcasts update
3. If `autoConnect` true, backend calls `mcpClientManager.connect()` immediately and on startup
4. McpClientManager spawns subprocess (stdio) or connects to HTTP server
5. Calls `client.listTools()` → gets available tools, stores in connections map
6. Tools become available in tool-call loop injected into system prompt
7. Settings panel shows status of each MCP connection (connected/error, tool count, connectedAt)

**GitHub Integration Flow:**

1. User enters GitHub token in Settings → POST `/api/github/token` with token
2. Backend calls `validateToken()` → GitHub API request with token header
3. If valid, token stored in config (frontend shows green ✓)
4. User browses repos → GET `/api/github/browse?page=1` → backend calls `listUserRepos()` → GitHub API with pagination
5. Frontend displays paginated repo list
6. User clicks repo → POST `/api/github/clone` with URL
7. Backend calls `cloneRepo()` → spawns `git clone` subprocess, stores in `github-repos/` directory
8. User clicks "Open" → POST `/api/github/open` with dirName → sets projectFolder to cloned repo path

**State Management:**

- Frontend: All state in App.jsx (models, selectedModel, mode, messages, history, config state, UI panels)
- Backend: Config in `.cc-config.json`, Conversation history in JSON files, MCP connections in McpClientManager.connections Map
- No global database; app restarts lose only in-memory MCP connection state (reconnects via autoConnect)

## Key Abstractions

**Mode:**
- Purpose: Encapsulates specialized AI interaction pattern with different system prompt
- Examples: `chat`, `explain`, `bugs`, `refactor`, `translate-tech`, `translate-biz`, `create`
- Pattern: Mode string used as key in `SYSTEM_PROMPTS` object; each mode defines expected input/output structure
- Location: `src/App.jsx` (MODES array), `lib/prompts.js` (SYSTEM_PROMPTS mapping)

**Conversation:**
- Purpose: Encapsulates a sequence of user/assistant messages with metadata
- Examples: `{ id, title, mode, createdAt, messages: [{role, content}] }`
- Pattern: Immutable snapshot saved after each user message; retrieved by ID; displayed in sidebar
- Location: `lib/history.js` (persistence), `src/components/Sidebar.jsx` (display)

**MCP Connection:**
- Purpose: Represents active connection to external tool server (stdio or HTTP)
- Examples: `{ id, name, transport, status, tools, client, error }`
- Pattern: Lifecycle managed by McpClientManager; tools exposed in system prompt for LLM
- Location: `lib/mcp-client-manager.js`

**Tool Call:**
- Purpose: Represents parsed instruction from LLM to invoke external tool
- Examples: `{ serverId: 'github-tools', toolName: 'search-repos', args: {...} }`
- Pattern: Extracted from LLM response via regex (`TOOL_CALL: id.tool(args)`); executed in loop; results fed back
- Location: `lib/tool-call-handler.js`

**File Project:**
- Purpose: Represents a folder containing files to be analyzed or understood
- Examples: GitHub-cloned repo, local project folder
- Pattern: Path stored in config; browsed via file-browser API; files read on demand
- Location: `lib/file-browser.js`, `lib/github.js`

**Config:**
- Purpose: Application-wide settings persisting across sessions
- Examples: `ollamaUrl`, `projectFolder`, `githubToken`, `mcpClients`, `effects3dEnabled`
- Pattern: Single JSON file, read on startup, updated via POST `/api/config`
- Location: `lib/config.js`, `.cc-config.json`

## Entry Points

**Server Entry:**
- Location: `server.js` (main backend entry point)
- Triggers: Node.js process start `node server.js` or `npm start`
- Responsibilities:
  - Initialize logger, config, history, MCP client manager
  - Mount Express middleware (JSON parsing, static serving, request logging)
  - Register all API routes (`/api/*`, `/mcp`)
  - Auto-connect configured MCP clients
  - Listen on port 3000 (configurable via PORT env var)
  - Graceful shutdown on SIGINT (disconnect MCP clients)

**Frontend Entry:**
- Location: `src/main.jsx` → `src/App.jsx`
- Triggers: Browser load of `http://localhost:3000`
- Responsibilities:
  - Mount React app to `#root` DOM element
  - Provide Effects3DContext for 3D visual toggles
  - Render App component with all state and event handlers
  - Initialize splash screen, fetch config/models on mount
  - Manage UI interactions: mode selection, chat send, history navigation, settings

**MCP HTTP Entry:**
- Location: `server.js` route `app.all('/mcp')`
- Triggers: External tool server POST/GET `/mcp` endpoint
- Responsibilities:
  - Create fresh McpServer instance (factory pattern for concurrency)
  - Register all available tools via `registerAllTools()`
  - Negotiate MCP protocol via StreamableHTTPServerTransport
  - Route tool calls to appropriate handlers

**MCP Tool Entry:**
- Location: `mcp/tools.js` → `registerAllTools()` function
- Triggers: Ollama requests external tool via tool-call loop
- Responsibilities:
  - Expose Code Companion's built-in tools (list models, chat, read files, history, etc.)
  - Each tool maps to server.js API endpoint or lib function
  - Return results in MCP-compliant format (content array with text resources)

## Error Handling

**Strategy:** Layered error handling with fallback-to-safe-state. Frontend shows toasts for user-visible errors; backend logs to console and files; Ollama connection failures gracefully degrade.

**Patterns:**

**Ollama Connection Errors:**
- Wrap chatStream/chatComplete in try-catch
- Return SSE event `{ error: '...' }` to frontend
- Frontend displays toast notification
- If Ollama unreachable on startup, models list is empty but UI doesn't crash
- GET `/api/models` returns 503 with `{ connected: false }` state

**MCP Connection Errors:**
- McpClientManager.connect() catches and stores `{ status: 'error', error: err.message }`
- Settings panel shows red X with error message
- Backend logs but doesn't crash; other MCP clients continue
- Tool calls to disconnected servers fail gracefully with `{ success: false, error: '...' }`

**File Access Errors:**
- readProjectFile() checks path traversal via normalized path logic
- Returns 403 Forbidden if attempted
- Returns 404 if file not found
- Returns 500 with error message for other I/O errors

**Validation Errors:**
- POST `/api/chat` returns 400 if missing model, messages, or mode
- POST `/api/github/token` validates token before storing
- POST `/api/create-project` validates required fields and stages array

**Tool Call Parse Errors:**
- Malformed tool call in LLM response is skipped (caught in regex loop)
- Flexible args parsing: tries JSON, then key=value patterns, then wraps as "input" string
- Tool execution errors logged and returned as tool result string "Tool X failed: ..."

## Cross-Cutting Concerns

**Logging:**
- Framework: `lib/logger.js` using file-based logging
- Approach: Creates `logs/app.log` and `logs/debug.log` with timestamped entries
- Pattern: `log('INFO', message, { contextData })` or `debug(message, { contextData })`
- Controlled by DEBUG env var (DEBUG=1 enables console output)
- All major operations logged: model fetch, chat send, file read, MCP connect, GitHub clone, config update

**Validation:**
- Request body validation: Manual checks in route handlers (if (!field) return 400)
- Schema validation: `mcp/schemas.js` contains Zod schemas for MCP config (unused in current code but available)
- Path traversal prevention: `file-browser.js` normalizes and validates file paths
- Token validation: GitHub token tested via API before storing

**Authentication:**
- GitHub token stored in config, passed with GitHub API requests
- No internal authentication required; server assumes single PM user (development/local environment)
- MCP servers authenticated via env vars (e.g., API keys passed to stdio subprocess)

---

*Architecture analysis: 2026-03-13*
