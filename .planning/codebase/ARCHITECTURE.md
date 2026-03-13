# Architecture

**Analysis Date:** 2026-03-13

## Pattern Overview

**Overall:** Monolithic Express backend + React frontend with real-time streaming

**Key Characteristics:**
- Backend-driven request/response for chat operations via Server-Sent Events (SSE)
- Modular backend with separated concerns (Ollama client, file system, GitHub, history)
- React frontend with mode-based UI switching (chat, explain, bugs, refactor, translate, dashboard, create)
- Model Context Protocol (MCP) integration for external tool execution with agentic loops
- JSON-based local file storage for conversation history (no database)
- Optional MCP server for exposing tools over HTTP

## Layers

**Presentation Layer (Frontend):**
- Purpose: Provide mode-specific UI for code analysis and PM communication
- Location: `src/`, `src/components/`, `src/contexts/`
- Contains: React components, hooks, state management, 3D effects
- Depends on: Express REST API at `/api/*`
- Used by: Browser clients

**API Layer (Backend Routes):**
- Purpose: Handle HTTP requests, orchestrate business logic, stream responses
- Location: `server.js` (main router), `lib/mcp-api-routes.js` (MCP routes)
- Contains: Express route handlers for chat, config, history, files, GitHub, create
- Depends on: Business logic modules (ollama-client, history, config, file-browser, tools)
- Used by: Frontend, MCP clients, external services

**Business Logic Layer:**
- Purpose: Implement core domain operations
- Location: `lib/`
- Contains: `ollama-client.js`, `history.js`, `file-browser.js`, `github.js`, `icm-scaffolder.js`
- Depends on: External services (Ollama, GitHub API), filesystem
- Used by: API layer, tool handlers

**Tool Execution Layer:**
- Purpose: Execute MCP tool calls in agentic loops
- Location: `lib/tool-call-handler.js`, `lib/mcp-client-manager.js`
- Contains: TOOL_CALL pattern parsing, MCP client lifecycle management
- Depends on: MCP clients (registered tools), network connections
- Used by: Chat endpoint for external tool execution

**Data Access Layer:**
- Purpose: Persist and retrieve conversations, configurations
- Location: `lib/config.js`, `lib/history.js`
- Contains: JSON file I/O for `.cc-config.json` and `history/*.json`
- Depends on: Filesystem
- Used by: API layer, business logic

**Infrastructure Layer:**
- Purpose: Logging, metrics, process management
- Location: `lib/logger.js`, performance metrics in `server.js`
- Contains: Custom logger, CPU metrics, request tracking
- Depends on: Node.js built-ins (fs, path, os)
- Used by: All layers

## Data Flow

**Chat Request with Tool Calls:**

1. User sends message via frontend → `POST /api/chat` with `{ model, messages, mode }`
2. Backend enriches system prompt with tool descriptions from connected MCP clients
3. If external tools available:
   - **Tool-call loop** (max 5 rounds):
     - Call `chatComplete()` to Ollama with full messages
     - Parse response for `TOOL_CALL: serverId.toolName(args)` patterns
     - If found: execute each tool via MCP, append results to messages, loop
     - If none found: break and return final text
4. Stream final response to frontend via SSE as `data: {chunk}` events
5. Frontend renders streamed chunks in real-time

**Direct Chat (No Tools):**

1. User sends message → `POST /api/chat`
2. Backend calls `chatStream()` to Ollama
3. Response streamed directly via SSE to frontend
4. Frontend appends chunks and renders markdown

**History Persistence:**

1. User saves conversation (explicit action in UI)
2. Frontend calls `POST /api/history` with conversation data
3. Backend generates UUID, writes to `history/{id}.json`
4. Frontend fetches `GET /api/history` to reload list

**File Browsing:**

1. User selects project folder in UI
2. Frontend requests `GET /api/files/tree?folder=...&maxDepth=...`
3. Backend recursively walks directory, filters ignored paths
4. Returns tree structure of text files
5. User can read files via `GET /api/files/read?folder=...&file=...`

**GitHub Integration:**

1. User provides GitHub token via settings
2. Frontend calls `POST /api/github/token` to store token in config
3. User clones repo: `POST /api/github/clone` with repo URL
4. Backend calls `git clone` to `history/` directory
5. File browser then displays cloned repo structure

**Create Mode (ICM Scaffolding):**

1. User launches Create wizard
2. Provides project name, description, template selection
3. Frontend calls `POST /api/create-project` with scaffolding params
4. Backend calls `scaffoldProject()` from `lib/icm-scaffolder.js`
5. Creates project directory with pre-built files/structure

**State Management:**

- Frontend: React `useState`, local storage for splash screen state
- Backend: In-memory config object, file-based history
- Session: Stored in `sessionStorage` (splash dismissal)
- Persistent: `.cc-config.json`, `history/*.json`

## Key Abstractions

**Conversation:**
- Purpose: Encapsulate message exchange between user and Ollama
- Examples: `lib/history.js` CRUD operations, `src/App.jsx` message state
- Pattern: Each conversation is a JSON object with `id`, `title`, `messages`, `mode`, `model`, `createdAt`, `archived`

**Message:**
- Purpose: Single turn in conversation (user or assistant)
- Examples: `{ role: 'user'|'assistant'|'tool', content: string }`
- Pattern: Sent to Ollama API, accumulated in conversation

**Mode:**
- Purpose: Determine system prompt and UX behavior
- Examples: `chat`, `explain`, `bugs`, `refactor`, `translate-tech`, `translate-biz`, `dashboard`, `create`
- Pattern: Selected in UI, controls `SYSTEM_PROMPTS[mode]` injected into requests

**Tool Call:**
- Purpose: Represent an MCP tool invocation triggered by Ollama
- Examples: Parsed from `TOOL_CALL: serverId.toolName(args)` in response
- Pattern: Executed in agentic loop with results fed back to Ollama

**File Tree:**
- Purpose: Represent project directory structure for browsing
- Examples: Built by `lib/file-browser.js` from filesystem
- Pattern: Nested objects with `{ name, path, children, isDir, lines }`

## Entry Points

**Backend:**
- Location: `server.js` (line 1)
- Triggers: Node.js process, `npm start` or `node server.js`
- Responsibilities: Initialize Express, mount routes, listen on port 3000

**Frontend:**
- Location: `src/main.jsx` (React entry point), `index.html` (HTML entry)
- Triggers: Browser load, `npm run dev` or served by Express static middleware
- Responsibilities: Bootstrap React, mount Effects3DProvider, render App component

**Chat Endpoint:**
- Location: `server.js` line 185 (`app.post('/api/chat')`)
- Triggers: User presses Enter with message in UI
- Responsibilities: Stream Ollama response, execute tool calls, manage agentic loop

**History Loading:**
- Location: `server.js` line 398 (`app.get('/api/history')`)
- Triggers: App mount, conversation list refresh
- Responsibilities: List all conversations from `history/` directory

## Error Handling

**Strategy:** Try-catch with user-facing error messages via toast notifications

**Patterns:**

- **Network errors:** Catch fetch failures, show "Connection failed" toast, set `connected: false`
- **Ollama errors:** Catch chatComplete/chatStream failures, send SSE error event, end stream
- **File system errors:** Catch fs operations, return empty arrays or error codes
- **Tool execution:** Catch tool failures, append error message to tool results, continue loop
- **Validation errors:** Return 400 status with error message (missing model, invalid mode)

**Example (Chat Endpoint):**
```javascript
try {
  responseText = await chatComplete(config.ollamaUrl, model, loopMessages);
} catch (err) {
  log('ERROR', `Ollama chatComplete failed`, { error: err.message });
  sendEvent({ error: `Ollama error: ${err.message}` });
  res.write('data: [DONE]\n\n');
  return res.end();
}
```

## Cross-Cutting Concerns

**Logging:** Custom `lib/logger.js` with timestamp, level (INFO/ERROR/DEBUG), and messages. Debug mode enabled via `DEBUG=1` env var.

**Validation:** System prompts checked for known modes, request payloads checked for required fields (model, messages, mode). File paths sanitized in file-browser.

**Authentication:** GitHub token optional, stored in `.cc-config.json` (user responsibility to manage). No session-based auth for local-only design.

**Rate Limiting:** None enforced. Agentic loop capped at 5 rounds max to prevent infinite recursion.

**Performance:** Streaming via SSE to show user progressive results. Tool-call execution is synchronous (no parallel). Metrics tracked in memory (request count, latency, traffic, CPU).

---

*Architecture analysis: 2026-03-13*
