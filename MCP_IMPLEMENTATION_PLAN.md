# Code Companion — MCP Server Implementation Plan

## What This Means (Non-Developer Summary)

Right now, Code Companion is a standalone web app — you open it in a browser, paste code, and chat with a local AI. Adding **MCP** capability does two things:

1. **MCP Server** — Other AI tools (like Claude Desktop, Claude Code, Cursor) can **call Code Companion's features as tools** without opening a browser. For example, Claude Desktop could say: *"Let me use Code Companion to explain this function"* — and it would send the code to your local Ollama, get the PM-friendly explanation back, and show it right in Claude's response.

2. **MCP Client** — Code Companion can **connect to external MCP servers** (like GitHub, Slack, database tools, etc.) and use their capabilities to enrich your conversations. For example, while chatting about a bug, Code Companion could pull the relevant code from GitHub or search Slack for related discussions — all without you switching apps.

**You keep everything you have today** — the web UI still works exactly the same. MCP is an *additional* layer that makes Code Companion both more accessible (as a server) and more powerful (as a client). A full management dashboard in the Settings panel lets you control everything visually.

---

## Architecture Overview

```
  ┌─────────────────────┐     ┌─────────────────────┐
  │  Claude Desktop     │     │  GitHub MCP Server   │
  │  Cursor, etc.       │     │  Slack MCP Server    │
  │  (MCP Clients)      │     │  (External MCP       │
  │                     │     │   Servers)            │
  └────────┬────────────┘     └──────────┬───────────┘
           │ calls tools                  │ provides tools
           ▼                              ▼
┌──────────────────────────────────────────────────────────┐
│                    Code Companion                         │
│                                                           │
│  ┌─────────────┐  ┌───────────────────┐  ┌────────────┐ │
│  │  Express     │  │  MCP Server       │  │ MCP Client │ │
│  │  (Web UI)    │  │                   │  │ Manager    │ │
│  │  port 3000   │  │  HTTP: /mcp       │  │            │ │
│  │              │  │  stdio: CLI mode  │  │ Connects   │ │
│  │  + MCP Mgmt  │  │                   │  │ to external│ │
│  │  Dashboard   │  │  Exposes 11 tools │  │ servers    │ │
│  └──────┬───────┘  └─────────┬─────────┘  └─────┬──────┘ │
│         │                    │                    │        │
│         ▼                    ▼                    ▼        │
│  ┌────────────────────────────────────────────────────┐   │
│  │           Shared Core Services (lib/)               │   │
│  │  • Ollama client (stream + complete modes)          │   │
│  │  • System prompts (all 6 modes + guardrail)         │   │
│  │  • File browser (tree + read)                       │   │
│  │  • Conversation history (CRUD)                      │   │
│  │  • Config manager (load/save/getters)               │   │
│  │  • Logger (file + console, stderr-aware)            │   │
│  │  • MCP client manager (connect/disconnect/call)     │   │
│  └────────────────────────────────────────────────────┘   │
│                         │                                  │
│                         ▼                                  │
│                  ┌──────────────┐                          │
│                  │   Ollama     │                          │
│                  │  (local AI)  │                          │
│                  └──────────────┘                          │
└──────────────────────────────────────────────────────────┘
```

**Key idea**: Code Companion is a **bidirectional MCP node** — it acts as an MCP *server* (exposing its 6 analysis modes as tools for external AI clients) AND an MCP *client* (connecting to external MCP servers like GitHub, Slack, etc. to pull additional context into conversations). The existing Express API routes and the new MCP tools share the same backend logic. No duplication.

---

## MCP Tools to Implement

### 6 Mode Tools (one per mode)

| Tool Name | Mode | What It Does | Annotations |
|-----------|------|-------------|-------------|
| `codecompanion_chat` | Chat | Freeform conversation with context of being a PM assistant | readOnly, idempotent |
| `codecompanion_explain` | Explain | Explains code in plain English for PMs | readOnly, idempotent |
| `codecompanion_find_bugs` | Bug Hunter | Reviews code for bugs, security issues, risks | readOnly, idempotent |
| `codecompanion_refactor` | Refactor | Suggests code improvements with explanations | readOnly, idempotent |
| `codecompanion_tech_to_biz` | Tech → Biz | Translates technical content to business language | readOnly, idempotent |
| `codecompanion_biz_to_tech` | Biz → Tech | Translates business requirements to technical specs | readOnly, idempotent |

**Common parameters for all mode tools:**
- `content` (string, required) — The code, text, or question to process
- `model` (string, optional) — Which Ollama model to use (defaults to first model from Ollama's model list)
- `context` (string, optional) — Additional context like "this is from our payments service" to give the AI background

**All mode tools include these MCP annotations:**
```javascript
annotations: {
  readOnlyHint: true,      // These tools don't modify anything
  destructiveHint: false,   // Nothing is deleted or changed
  idempotentHint: true,     // Same input → same type of output
  openWorldHint: false      // Only talks to local Ollama, not the internet
}
```

### Utility Tools

| Tool Name | What It Does | Annotations |
|-----------|-------------|-------------|
| `codecompanion_list_models` | Lists available Ollama models with sizes/families | readOnly, idempotent |
| `codecompanion_get_status` | Returns Ollama connection status + app config | readOnly, idempotent |
| `codecompanion_browse_files` | Lists project file tree (respects ignore list) | readOnly, idempotent |
| `codecompanion_read_file` | Reads a file from the project folder (500KB limit) | readOnly, idempotent |
| `codecompanion_list_conversations` | Lists saved conversation history (read-only) | readOnly, idempotent |

**Total: 11 tools** (6 mode tools + 5 utility tools)

---

## Transport Support

### 1. Streamable HTTP (for remote/web clients)
- Mounted at `/mcp` on the existing Express server (port 3000)
- Handles **all three HTTP methods** required by the MCP protocol:
  - `POST /mcp` — JSON-RPC messages (main interaction)
  - `GET /mcp` — SSE stream (server-to-client notifications)
  - `DELETE /mcp` — session cleanup
- Runs alongside the web UI — no separate server needed
- **Stateless mode** — creates a new transport per request (`sessionIdGenerator: undefined`)
- Returns JSON responses (`enableJsonResponse: true`)
- Used by: web-based MCP clients, remote connections

### 2. stdio (for local/desktop clients)
- Launched via CLI: `node mcp-server.js`
- Communicates over stdin/stdout
- **Critical**: All logging must go to `stderr` (not `stdout`) to avoid corrupting the MCP protocol
- Used by: Claude Desktop, Claude Code, Cursor

### How clients would connect:

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "code-companion": {
      "command": "node",
      "args": ["/path/to/AIApp-CodeCompanion/mcp-server.js"],
      "env": {}
    }
  }
}
```

**Streamable HTTP** (any MCP client):
```
POST http://localhost:3000/mcp
```

---

## File Structure (New Files)

```
AIApp-CodeCompanion/
├── server.js                 # Existing Express server (modified to import from lib/)
├── mcp-server.js             # NEW — MCP stdio entry point
├── lib/                      # NEW — Shared backend logic (NOT in src/ — see note)
│   ├── ollama-client.js      # Extracted: Ollama API calls (stream + complete)
│   ├── prompts.js            # Extracted: System prompts + guardrail constant
│   ├── file-browser.js       # Extracted: File tree + read logic + security
│   ├── history.js            # Extracted: Conversation history CRUD
│   ├── config.js             # Extracted: Config load/save + defaults
│   ├── logger.js             # Extracted: Logging with stderr mode for stdio
│   └── mcp-client-manager.js # NEW — Manages connections to external MCP servers
├── mcp/                      # NEW — MCP-specific code
│   ├── tools.js              # Tool registrations (all 11 tools)
│   └── schemas.js            # Zod input schemas
├── src/                      # Vite/React frontend
│   ├── App.jsx
│   ├── components/
│   │   ├── SettingsPanel.jsx  # MODIFIED — expanded with MCP tabs
│   │   ├── McpServerPanel.jsx # NEW — MCP server status, tools, connected clients
│   │   ├── McpClientPanel.jsx # NEW — External MCP server connections config
│   │   └── ...
│   └── ...
```

**Why `lib/` instead of `src/core/`?** The `src/` directory belongs to Vite — it processes everything in there for the browser build. Putting Node.js server modules (`require('fs')`, `require('path')`, etc.) in `src/` would cause Vite build errors because those modules don't exist in browsers. Using `lib/` keeps the backend cleanly separated from the frontend build pipeline.

**Why `mcp/` at the root instead of `src/mcp/`?** Same reason — MCP code is server-side Node.js, not browser code. Keeping it outside `src/` avoids Vite interference.

---

## Implementation Steps

### Phase 1: Extract Core Services (refactor)

**Goal**: Pull shared logic out of `server.js` into `lib/` modules so both Express routes and MCP tools can use the same code. Zero behavior change — the web UI must work identically after this step.

1. Create `lib/` directory

2. Extract `lib/logger.js`
   - Move `log()` and `debug()` functions
   - Add `stderrMode` option: when true, write to `stderr` instead of `stdout` (for MCP stdio)
   - Accept `appRoot` parameter for log file paths (don't use `__dirname`)
   - Export: `createLogger(appRoot, options)`

3. Extract `lib/config.js`
   - Move `loadConfig()`, `saveConfig()`, defaults
   - Accept `appRoot` parameter for config file path
   - Export config as a **getter/setter pattern** — NOT a plain exported object — so mutations are visible across modules:
     ```javascript
     // lib/config.js
     let config = null;
     function getConfig() { if (!config) config = loadConfig(); return config; }
     function updateConfig(updates) { Object.assign(config, updates); saveConfig(config); }
     module.exports = { getConfig, updateConfig, initConfig };
     ```
   - This solves the mutable-state-sharing problem between server.js and mcp-server.js

4. Extract `lib/prompts.js`
   - Move `MODE_GUARDRAIL` constant and `SYSTEM_PROMPTS` object
   - Export: `{ SYSTEM_PROMPTS, MODE_GUARDRAIL, VALID_MODES }`
   - `VALID_MODES` = `Object.keys(SYSTEM_PROMPTS)` — useful for schema validation

5. Extract `lib/ollama-client.js`
   - `listModels(ollamaUrl)` — fetches models, returns formatted array
   - `chatStream(ollamaUrl, model, messages)` — returns Ollama's streaming response body (for web UI SSE)
   - `chatComplete(ollamaUrl, model, messages, timeoutMs = 120000)` — calls Ollama with `stream: false`, returns the full text (for MCP tools). **Key insight**: Ollama natively supports `"stream": false` which returns the complete response as a single JSON object — no need to buffer a stream ourselves. Includes an `AbortController` timeout (default 120s) as a safety net against runaway requests.
   - `checkConnection(ollamaUrl)` — quick health check, returns boolean
   - All functions accept `ollamaUrl` as a parameter (don't read config internally — that's the caller's job)

6. Extract `lib/file-browser.js`
   - `buildFileTree(folder, maxDepth)` — returns directory tree JSON
   - `readProjectFile(folder, relativePath)` — reads file with path-traversal security check and 500KB limit
   - Move `TEXT_EXTENSIONS`, `IGNORE_DIRS`, `isTextFile()` into this module

7. Extract `lib/history.js`
   - `listConversations(historyDir)` — returns sorted conversation metadata
   - `getConversation(historyDir, id)` — returns full conversation
   - `saveConversation(historyDir, data)` — creates/updates conversation
   - `deleteConversation(historyDir, id)` — removes conversation file
   - Accept `historyDir` parameter (don't use `__dirname`)

8. Update `server.js` imports
   - Replace all inline logic with `require('./lib/...')` calls
   - Wire up the getter/setter config pattern
   - **Run the web UI and verify everything works identically**

### Phase 2: Build MCP Server

1. Install dependencies:
   ```bash
   npm install @modelcontextprotocol/sdk zod
   ```
   **Verified**: The MCP SDK (v1.27.1) ships both CJS and ESM builds. `require('@modelcontextprotocol/sdk/server/mcp.js')` resolves to `dist/cjs/server/mcp.js` which exports `McpServer` as proper CommonJS. No ESM workarounds needed.

2. Create `mcp/schemas.js` — Zod input schemas
   - One schema per tool, using `z.string().describe(...)` for clear parameter docs
   - Shared model selection: `z.string().optional().describe("Ollama model name")`
   - Mode content schema: validates non-empty content string

3. Create `mcp/tools.js` — Tool registrations
   - Create a `registerAllTools(server, deps)` function that takes an `McpServer` instance plus dependencies (config getter, logger, etc.)
   - Each tool registration includes: `title`, `description`, `inputSchema`, `annotations`
   - Tool descriptions follow the MCP best-practice format: what it does, args, returns, examples, error handling
   - Character limit (25,000 chars) on responses to prevent overwhelming clients
   - Graceful error handling when Ollama is not running — return `isError: true` with a helpful message
   - Model default logic: if no model specified, call `listModels()` and use the first one

4. Create `mcp-server.js` — stdio entry point
   ```javascript
   #!/usr/bin/env node
   const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
   const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
   // ... import lib/ modules, register tools, connect transport
   ```
   - Initialize logger in `stderrMode: true` — **all output goes to stderr, nothing to stdout**
   - Load config from app root directory
   - Create McpServer, register tools, connect StdioServerTransport
   - Log startup to stderr: `console.error("Code Companion MCP server running via stdio")`

5. Add `/mcp` routes to `server.js` — streamable HTTP transport
   ```javascript
   // Factory: creates a fresh McpServer per request (required — see concurrency note)
   function createMcpServer() {
     const mcpServer = new McpServer({ name: 'code-companion-mcp', version: '1.0.0' });
     registerAllTools(mcpServer, { getConfig, logger, /* ...deps */ });
     return mcpServer;
   }

   // Handle all MCP protocol methods (POST, GET, DELETE)
   app.all('/mcp', async (req, res) => {
     const mcpServer = createMcpServer();
     const transport = new StreamableHTTPServerTransport({
       sessionIdGenerator: undefined,   // stateless
       enableJsonResponse: true
     });
     res.on('close', () => transport.close());
     await mcpServer.connect(transport);
     await transport.handleRequest(req, res, req.body);
   });
   ```
   - **Must create a new McpServer per request** — the SDK rejects concurrent `connect()` calls on the same server instance with "Already connected to a transport." Creating a server + registering 11 tools takes ~0.4ms (verified by benchmark), so this is negligible overhead.
   - Place this route **after** all `/api/*` routes but **before** the SPA fallback
   - Uses `app.all()` to handle POST, GET, and DELETE as required by the MCP streamable HTTP spec
   - The SPA fallback (`app.get('*')`) won't conflict because `/mcp` is matched first by Express's more-specific route

6. Add `/mcp` to Vite proxy config (`vite.config.js`):
   ```javascript
   proxy: {
     '/api': 'http://localhost:3000',
     '/mcp': 'http://localhost:3000',   // NEW — proxy MCP requests to Express in dev mode
   }
   ```
   Without this, MCP clients connecting to `localhost:5173/mcp` during development would get a 404 from Vite instead of reaching Express.

7. Add scripts to `package.json`:
   ```json
   "mcp": "node mcp-server.js",
   "mcp:inspect": "npx @modelcontextprotocol/inspector node mcp-server.js"
   ```

### Phase 3: Integration & Testing

1. Test stdio transport with MCP Inspector (`npm run mcp:inspect`)
2. Test streamable HTTP via curl:
   ```bash
   # Initialize
   curl -X POST http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

   # List tools
   curl -X POST http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
   ```
3. Test with Claude Desktop config
4. Test error cases: Ollama down, bad model name, empty content, content exceeding 25K response
5. Update `startup.sh` to mention MCP availability in the status report
6. Add MCP section to README

### Phase 4: MCP Management Frontend

**Goal**: Give the user a visual dashboard inside Code Companion's web UI to manage all MCP server and client settings — no editing JSON files or command-line config needed.

#### UI Structure: Tabbed Settings Panel

The existing `SettingsPanel.jsx` currently has two sections (Ollama URL, Project Folder). We'll expand it into a **tabbed layout** with three tabs:

1. **General** (existing) — Ollama URL + Project Folder (unchanged behavior)
2. **MCP Server** — Control how Code Companion exposes itself as an MCP server
3. **MCP Clients** — Configure connections to external MCP servers

#### Tab 2: MCP Server Panel (`McpServerPanel.jsx`)

This panel shows and controls Code Companion's MCP server functionality.

**Server Status section:**
- On/Off toggle for the HTTP transport (enable/disable the `/mcp` endpoint)
- Status indicator: green dot when active, red when disabled
- Endpoint URL display: `http://localhost:3000/mcp` (copyable)
- stdio command display: `node mcp-server.js` (copyable, for Claude Desktop config)
- Auto-generated Claude Desktop config snippet (copyable JSON block)

**Connected Clients section:**
- Table showing any currently-connected MCP clients (HTTP only — stdio is 1:1)
- Columns: Client name, connected since, last request time
- Note: stateless HTTP transport means "connections" are tracked by recent request activity, with a configurable staleness timeout (default 5 minutes)

**Tools Management section:**
- List of all 11 MCP tools with toggle switches to enable/disable individual tools
- Each tool row shows: tool name, description, enabled/disabled toggle
- Disabled tools won't be registered when creating McpServer instances
- Use case: a PM might want to expose only `explain` and `tech_to_biz` tools, not all 11

**Usage Stats section:**
- Simple counters: total tool calls, calls per tool, calls today
- Last tool call timestamp
- Average response time (from Ollama)
- Data stored in memory (resets on server restart) — lightweight, no database needed

**New API routes for MCP Server management:**
```
GET  /api/mcp/server/status     — Returns server on/off, endpoint info, tool list with enabled state
POST /api/mcp/server/toggle     — Enable/disable the HTTP MCP endpoint
POST /api/mcp/server/tools      — Update which tools are enabled/disabled
GET  /api/mcp/server/stats      — Returns usage counters
GET  /api/mcp/server/clients    — Returns list of recently-active clients
```

#### Tab 3: MCP Client Panel (`McpClientPanel.jsx`)

This panel manages Code Companion's outbound connections to external MCP servers.

**Configured Servers section:**
- List of configured external MCP servers
- Each entry shows: server name, transport type (stdio/HTTP), connection status (connected/disconnected/error)
- Add/Edit/Remove buttons for managing server configs
- Connect/Disconnect toggle per server

**Add Server dialog:**
- Server name (user-friendly label, e.g. "GitHub", "Slack")
- Transport type dropdown: `stdio` or `Streamable HTTP`
- For stdio: command field (e.g. `npx -y @modelcontextprotocol/server-github`) + args field + env vars (key/value pairs)
- For HTTP: endpoint URL field (e.g. `http://localhost:8080/mcp`)
- "Test Connection" button — attempts connection and shows available tools

**Server Detail view** (click on a configured server to expand):
- Available tools from that server (populated after connecting via `client.listTools()`)
- Enable/disable individual external tools (controls whether they're offered to Ollama conversations)
- Available resources from that server (via `client.listResources()`)
- Connection log / last error message

**How external tools integrate with conversations:**
When the user is chatting in the web UI and an external MCP server provides relevant tools, Code Companion can mention them in its system prompt context. For example: *"You also have access to these external tools: github_search_repos, slack_send_message..."* — but the actual tool execution goes through Code Companion's MCP client manager, not directly from Ollama. This is because Ollama doesn't speak MCP — Code Companion acts as the middleware.

**New API routes for MCP Client management:**
```
GET    /api/mcp/clients                — List all configured external servers
POST   /api/mcp/clients                — Add a new external server config
PUT    /api/mcp/clients/:id            — Update an external server config
DELETE /api/mcp/clients/:id            — Remove an external server config
POST   /api/mcp/clients/:id/connect    — Connect to an external server
POST   /api/mcp/clients/:id/disconnect — Disconnect from an external server
GET    /api/mcp/clients/:id/tools      — List tools available from a connected server
POST   /api/mcp/clients/:id/test       — Test connection and return available tools
```

#### Config storage

MCP settings are stored in the existing `codecompanion-config.json` file, extending the current schema:

```javascript
{
  // Existing fields
  "ollamaUrl": "http://localhost:11434",
  "projectFolder": "/Users/james/projects/my-app",

  // NEW: MCP server settings
  "mcpServer": {
    "httpEnabled": true,
    "disabledTools": [],              // tool names to exclude, e.g. ["codecompanion_chat"]
  },

  // NEW: MCP client settings (external server connections)
  "mcpClients": [
    {
      "id": "github-1",
      "name": "GitHub",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..." },
      "autoConnect": true,
      "disabledTools": []
    },
    {
      "id": "custom-api",
      "name": "Internal API Docs",
      "transport": "http",
      "url": "http://localhost:8080/mcp",
      "autoConnect": false,
      "disabledTools": []
    }
  ]
}
```

**Security note for env vars**: Environment variables in MCP client configs may contain tokens/keys. The `/api/mcp/clients` GET endpoint should **mask** env var values (e.g. `"ghp_...abc"`) in responses. Full values are only written via POST/PUT and stored in the config file on disk.

#### Phase 4 Implementation Steps

1. Expand `SettingsPanel.jsx` with tab navigation (General, MCP Server, MCP Clients)
2. Create `McpServerPanel.jsx` — server status, tool toggles, stats display, connected clients
3. Create `McpClientPanel.jsx` — external server list, add/edit/remove dialogs, connection controls
4. Add server management API routes to `server.js` (`/api/mcp/server/*`)
5. Add client management API routes to `server.js` (`/api/mcp/clients/*`)
6. Extend `lib/config.js` schema with `mcpServer` and `mcpClients` sections
7. Wire up the MCP server factory to respect `disabledTools` from config
8. Add in-memory usage stats tracking in the MCP tool handler layer
9. Test all management UI flows: toggle server, enable/disable tools, add/remove external servers, connect/disconnect

### Phase 5: MCP Client Capability

**Goal**: Enable Code Companion to connect to external MCP servers (GitHub, Slack, databases, custom APIs, etc.) and make their tools available within conversations. This makes Code Companion a richer analysis hub — not just its own 6 modes, but any tool from any MCP server.

#### How it works

```
User asks question in web UI
          │
          ▼
Code Companion sees external tools are available
          │
          ▼
Ollama generates response, may suggest using an external tool
          │
          ▼
Code Companion calls the external tool via MCP client
          │
          ▼
Result comes back, gets included in the conversation context
          │
          ▼
Ollama generates final response incorporating the external data
```

**Important nuance**: Ollama itself does not "call" MCP tools. Code Companion acts as the middleware — it tells Ollama what tools are available (via the system prompt), interprets Ollama's response to detect tool-call intent, executes the tool via the MCP client, and feeds the result back to Ollama for a final answer.

#### `lib/mcp-client-manager.js`

This module manages the lifecycle of connections to external MCP servers.

```javascript
// lib/mcp-client-manager.js
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

// Verified: All three imports work with require() in CJS — SDK ships dual builds

class McpClientManager {
  constructor(logger) {
    this.connections = new Map();  // id → { client, transport, config, tools, status }
    this.logger = logger;
  }

  // Connect to an external MCP server
  async connect(serverConfig) {
    const { id, transport, command, args, env, url } = serverConfig;
    let clientTransport;

    if (transport === 'stdio') {
      clientTransport = new StdioClientTransport({
        command,
        args: args || [],
        env: { ...process.env, ...(env || {}) }
      });
    } else if (transport === 'http') {
      clientTransport = new StreamableHTTPClientTransport(new URL(url));
    }

    const client = new Client(
      { name: 'code-companion', version: '1.0.0' },
      { capabilities: {} }
    );
    await client.connect(clientTransport);

    // Discover available tools
    const { tools } = await client.listTools();

    this.connections.set(id, {
      client, transport: clientTransport, config: serverConfig,
      tools, status: 'connected', connectedAt: new Date()
    });

    return tools;
  }

  // Disconnect from an external MCP server
  async disconnect(id) { /* close client + transport, remove from map */ }

  // Call a tool on a connected external server
  async callTool(id, toolName, args) {
    const conn = this.connections.get(id);
    if (!conn || conn.status !== 'connected') throw new Error(`Server ${id} not connected`);
    return conn.client.callTool({ name: toolName, arguments: args });
  }

  // Get all available tools across all connected servers (respecting disabledTools)
  getAllTools(disabledToolsMap) { /* returns merged list from all connections */ }

  // Get connection status for all configured servers
  getStatuses() { /* returns array of { id, name, status, toolCount } */ }
}

module.exports = McpClientManager;
```

#### How external tools appear in conversations

When external MCP servers are connected and have tools enabled, Code Companion enhances the system prompt sent to Ollama:

```
[normal mode system prompt]

---
You also have access to the following external tools. If the user's question
would benefit from using one of these tools, describe which tool you'd use
and what arguments you'd pass. Format tool calls as:

TOOL_CALL: server_id.tool_name({ arg1: "value", arg2: "value" })

Available external tools:
- github.search_repos: Search GitHub repositories by query
- github.get_file_contents: Read a file from a GitHub repository
- slack.search_messages: Search Slack messages
```

Code Companion then parses the Ollama response for `TOOL_CALL:` patterns, executes them through the MCP client manager, and sends a follow-up message to Ollama with the results. This "tool-calling loop" continues until Ollama produces a final answer with no tool calls.

**Note**: This is a best-effort approach since Ollama models vary in their ability to follow structured tool-calling formats. More capable models (like llama3.1, codellama) handle this well. Smaller models may not. The UI should show the user what's happening (e.g., "Searching GitHub for..." status messages) so it's transparent.

#### Auto-connect on startup

Servers with `"autoConnect": true` in their config will be connected automatically when `server.js` starts. Connection failures are logged but don't block startup — the UI will show the failed status and the user can retry manually.

#### Phase 5 Implementation Steps

1. Create `lib/mcp-client-manager.js` with connect/disconnect/callTool/getAllTools methods
2. Wire up auto-connect on server startup (iterate `mcpClients` where `autoConnect: true`)
3. Enhance `lib/ollama-client.js` — `chatComplete()` and `chatStream()` gain an optional `externalTools` parameter that appends the tool-list section to the system prompt
4. Build the tool-call detection + execution loop in a new `lib/tool-call-handler.js`:
   - Parse Ollama response for `TOOL_CALL:` patterns
   - Execute tool calls via McpClientManager
   - Feed results back to Ollama
   - Cap at 5 tool-call rounds to prevent infinite loops
5. Update Express chat route (`POST /api/chat`) to pass external tools context when available
6. Update MCP server tools (`codecompanion_chat`, etc.) to also include external tool context — so Claude Desktop users also benefit from external MCP connections
7. Test with a real external MCP server (e.g., `@modelcontextprotocol/server-filesystem`)
8. Handle edge cases: external server disconnects mid-conversation, tool call returns error, model doesn't follow tool-call format

---

## Key Design Decisions

### Why `lib/` instead of `src/core/`?
The `src/` directory is Vite's domain — it processes everything in there for the browser build. Putting Node.js server modules (`require('fs')`, `require('path')`, etc.) in `src/` would cause Vite build failures. `lib/` is a standard Node.js convention for shared library code and keeps the backend completely separate from the frontend build pipeline.

### CommonJS — confirmed compatible
The project uses CommonJS (`require`/`module.exports`) with no `"type": "module"` in package.json. **Verified by testing**: the MCP SDK v1.27.1 ships dual CJS/ESM builds. All three key imports work with `require()`:
- `require('@modelcontextprotocol/sdk/server/mcp.js')` → `McpServer`
- `require('@modelcontextprotocol/sdk/server/stdio.js')` → `StdioServerTransport`
- `require('@modelcontextprotocol/sdk/server/streamableHttp.js')` → `StreamableHTTPServerTransport`
- `require('zod')` → `z`

No dynamic `import()` or `.mjs` workarounds needed.

### Why JavaScript instead of TypeScript?
The existing project is plain JavaScript. Adding TypeScript just for MCP would mean a separate build process, tsconfig, etc. The MCP SDK works fine with plain JS. JSDoc comments can provide type hints for editors.

### Mutable config sharing pattern
The current `server.js` has a module-level `let config = loadConfig()` that gets mutated by `POST /api/config`. When extracted to `lib/config.js`, this must be exported as **getter/setter functions** (not a plain object export) so that both `server.js` and `mcp-server.js` see the same state. Plain object exports would create separate copies.

### __dirname handling
Several paths in `server.js` depend on `__dirname` (history dir, config file, log dir, dist/public dirs). When extracting to `lib/`, those modules can't use their own `__dirname` — they'd point to `lib/` instead of the project root. Solution: each `lib/` module accepts an `appRoot` parameter, and the entry points (`server.js`, `mcp-server.js`) pass `__dirname` when initializing.

### Why extract to core modules?
Right now `server.js` is one big file with Ollama calls, file reading, and history all mixed together. Extracting them means:
- MCP tools and Express routes share the exact same logic
- No risk of the two getting out of sync
- Easier to test each piece independently

### Why not a separate MCP server process?
Running MCP as part of the existing Express server (for HTTP transport) means one `startup.sh` command starts everything. For stdio, we need a separate entry point (`mcp-server.js`) because stdio servers can't share stdout with Express logging — all MCP stdio communication happens over stdout, so any `console.log()` output would corrupt the protocol.

### Ollama non-streaming mode (chatComplete)
Ollama natively supports `"stream": false` in its `/api/chat` endpoint, which returns the complete response as a single JSON object. This means `chatComplete()` is a simple `fetch` call — no need to buffer streaming chunks. This is much simpler and more reliable than the original plan's vague "collect full response" approach.

### Streaming vs. Non-streaming for MCP tools
The MCP tools use `chatComplete()` (non-streaming) because MCP tool responses are atomic — the calling client expects a complete result. The web UI continues to use `chatStream()` for the real-time typing effect.

### Conversation history from MCP calls
MCP tool calls will **not** save to conversation history by default. MCP clients (like Claude Desktop) manage their own conversation context. Saving MCP interactions to Code Companion's history would create confusing duplicates. The `codecompanion_list_conversations` tool gives MCP clients read-only access to web UI conversations.

### Response size limits
All MCP tool responses are capped at **25,000 characters** to prevent overwhelming the calling client. If a response exceeds this, it's truncated with a note explaining the limit.

### Concurrency: new McpServer per HTTP request (factory pattern)
**Verified by testing**: `McpServer.connect()` rejects with "Already connected to a transport" if the server is already connected. This means a single shared McpServer instance breaks when two HTTP requests arrive simultaneously. The fix is a factory function that creates a fresh `McpServer` + registers all 11 tools for each request. Benchmarked at **0.44ms per creation** — completely negligible even under high load.

For the **stdio** entry point, this isn't an issue — stdio handles one connection from one client (e.g., Claude Desktop), so a single McpServer instance is fine.

### The `/mcp` route uses `app.all()` not just `app.post()`
The MCP streamable HTTP spec requires the server to handle POST (messages), GET (SSE stream), and DELETE (session close). Even though our stateless setup primarily uses POST, using `app.all('/mcp', ...)` ensures the SDK's transport can properly handle (or reject) any method a client sends, rather than Express returning a confusing 404.

### Vite proxy must include `/mcp`
The Vite dev server (port 5173) currently only proxies `/api` requests to Express (port 3000). Without adding `/mcp` to the proxy config, MCP clients hitting the Vite dev server would get a 404. This is a one-line fix in `vite.config.js`.

### MCP Management Frontend — why tabs in SettingsPanel?
Rather than creating a completely separate "MCP Dashboard" page with its own route, we extend the existing SettingsPanel modal into a tabbed layout. This keeps all configuration in one familiar place and avoids the complexity of adding a new React Router route + navigation. The user already knows where to find settings — we just add more tabs to it.

### MCP Client — why middleware instead of direct Ollama tool calling?
Ollama does not natively speak MCP (it's a local inference engine, not an MCP client). So Code Companion acts as middleware: it tells Ollama about available external tools via the system prompt, parses the model's response for tool-call intent, executes the actual MCP calls, and feeds results back. This "tool-call loop" approach works with any Ollama model — though more capable models produce better-structured tool calls.

### MCP Client — CJS compatibility verified
The MCP SDK's Client class works identically to the Server class in CommonJS:
- `require('@modelcontextprotocol/sdk/client/index.js')` → `Client`
- `require('@modelcontextprotocol/sdk/client/stdio.js')` → `StdioClientTransport`
- `require('@modelcontextprotocol/sdk/client/streamableHttp.js')` → `StreamableHTTPClientTransport`

No additional imports or ESM workarounds needed.

### MCP Client — security for stored credentials
External MCP server configs may include API tokens (e.g., GitHub PAT, Slack token) in their `env` field. These are stored in the config file on disk (same as the existing Ollama URL). The API endpoint that returns client configs masks these values in responses. A future improvement could use OS keychain integration, but for this iteration, file-based storage with API masking is sufficient.

### Tool-call loop cap (5 rounds)
When Ollama uses external tools, the response gets sent back for another inference round. To prevent infinite loops (model keeps calling tools endlessly), we cap this at 5 rounds. In practice, most useful interactions complete in 1-2 rounds.

### Timeout considerations
Ollama can take 30-60+ seconds to generate responses, especially with larger models or long code inputs. MCP clients have their own timeouts (Claude Desktop defaults to ~60s). If a tool call times out on the client side, the Ollama generation still runs to completion on the server — it just won't be returned. This is a known limitation. The `chatComplete()` function should set a 120-second `AbortController` timeout as a safety net to prevent runaway requests.

---

## Example Tool Usage

A Claude Desktop user asks: *"Can you explain what this React hook does?"*

Claude sees the `codecompanion_explain` tool is available and calls it:

```json
{
  "tool": "codecompanion_explain",
  "arguments": {
    "content": "const [count, setCount] = useState(0);\nuseEffect(() => {\n  document.title = `Clicked ${count} times`;\n}, [count]);",
    "model": "llama3.2:latest"
  }
}
```

Code Companion sends this to Ollama with the "explain" system prompt and `stream: false`, waits for the complete response, and returns a PM-friendly explanation — all without the user ever opening a browser.

### Error Handling Example

If Ollama isn't running:
```json
{
  "isError": true,
  "content": [{
    "type": "text",
    "text": "Error: Cannot reach Ollama at http://localhost:11434. Make sure Ollama is running (try: ollama serve)."
  }]
}
```

---

## New Dependencies

| Package | Version | Purpose | Size |
|---------|---------|---------|------|
| `@modelcontextprotocol/sdk` | ^1.27.1 | MCP server AND client SDK (CJS + ESM) | ~450KB |
| `zod` | ^3.23.8 | Runtime input schema validation | ~60KB |

Both are lightweight, have no native compilation requirements, and are already verified working with the project's Node 22 + CommonJS setup. The MCP SDK includes both server and client classes — no additional packages needed for the bidirectional MCP capability.

---

## Estimated Effort

| Phase | What | Complexity |
|-------|------|-----------|
| Phase 1 | Extract core services to `lib/` | Medium — careful refactoring, must not break web UI |
| Phase 2 | Build MCP server + tools | Medium — new code, but following clear SDK patterns |
| Phase 3 | Integration & testing | Light — connecting the pieces, testing edge cases |
| Phase 4 | MCP Management Frontend | Medium — new React components, new API routes, config schema expansion |
| Phase 5 | MCP Client capability | Medium-High — new module, tool-call parsing loop, external server lifecycle management |

**Total**: Phases 1-3 are a solid afternoon-to-day of work. Phases 4-5 add roughly another day. The hardest parts are Phase 1 (the refactoring) and Phase 5 (the tool-call loop and external connection management). Phases are designed to be implemented sequentially — each builds on the previous one — but Phases 4 and 5 are independent of each other and could be done in either order.

---

## Review Checklist (before calling it done)

**Phase 1-3 (MCP Server core):**
- [ ] Web UI works identically after Phase 1 refactor
- [ ] All 11 MCP tools respond correctly via MCP Inspector
- [ ] Ollama-down error handling returns clear MCP error responses
- [ ] stdio mode produces zero stdout noise (only stderr)
- [ ] `app.all('/mcp')` handles POST, GET, DELETE alongside existing Express routes
- [ ] Concurrent HTTP requests to `/mcp` don't fail (factory pattern creating new McpServer per request)
- [ ] SPA fallback still works (not intercepting /mcp requests)
- [ ] Vite dev proxy includes `/mcp` → Express
- [ ] Response size stays under 25,000 characters
- [ ] `chatComplete()` has 120s timeout safety net
- [ ] Config changes via web UI are visible to MCP tools (shared config state)
- [ ] `lib/` modules use `appRoot` param, not their own `__dirname`
- [ ] `startup.sh` and README updated with MCP instructions
- [ ] `package.json` has `mcp` and `mcp:inspect` scripts

**Phase 4 (MCP Management Frontend):**
- [ ] Settings panel tab navigation works (General, MCP Server, MCP Clients)
- [ ] MCP Server toggle enables/disables the `/mcp` endpoint
- [ ] Individual tool enable/disable toggles persist across server restart
- [ ] Disabled tools are not registered in factory-created McpServer instances
- [ ] Usage stats display and update after tool calls
- [ ] Connected clients list shows recent HTTP request activity
- [ ] Endpoint URL and Claude Desktop config snippet are copyable
- [ ] MCP Client panel can add/edit/remove external server configs
- [ ] "Test Connection" for external servers works and shows discovered tools
- [ ] Env var values are masked in API responses (not exposed to frontend)
- [ ] Config file saves correctly with new `mcpServer` and `mcpClients` sections

**Phase 5 (MCP Client):**
- [ ] `lib/mcp-client-manager.js` can connect to stdio-based external servers
- [ ] `lib/mcp-client-manager.js` can connect to HTTP-based external servers
- [ ] `client.listTools()` correctly discovers available tools
- [ ] `client.callTool()` executes tools and returns results
- [ ] Auto-connect on startup works for configured servers
- [ ] Auto-connect failures are logged but don't block server startup
- [ ] External tools appear in Ollama system prompt context
- [ ] Tool-call detection parses `TOOL_CALL:` patterns from Ollama responses
- [ ] Tool-call loop executes and feeds results back to Ollama
- [ ] Tool-call loop respects 5-round cap
- [ ] Disconnect handles cleanup properly (no zombie processes for stdio servers)
- [ ] External tool context works for both web UI chat AND MCP server tools
