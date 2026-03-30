# Agent Tools & MCP

**Analysis Date:** 2025-03-21

## Components

| File                         | Responsibility                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/tool-call-handler.js`   | Parses `TOOL_CALL: server_id.tool_name({...})` from model text, executes tools, builds combined tools prompt for chat                                  |
| `lib/builtin-agent-tools.js` | Local tools without MCP (e.g. `run_terminal_cmd`, office generation hooks as used by agent); allowlist/blocklist via `config.agentTerminal`            |
| `lib/mcp-client-manager.js`  | Connects external MCP servers: **stdio** (with `lib/spawn-path.js` env merge), **http** (streamable), **sse**; HTTP→SSE fallback on Method Not Allowed |
| `lib/mcp-api-routes.js`      | REST CRUD for MCP clients + server toggles; `recordToolCall` stats (in-memory)                                                                         |
| `mcp-server.js`              | Stdio entry for **built-in** MCP server (tools registered via `mcp/tools.js`)                                                                          |
| `server.js`                  | Wires `McpClientManager` + `ToolCallHandler`; `/api/chat` tool loop; `app.all('/mcp')` for HTTP MCP                                                    |

## How `/api/chat` uses tools

1. **Prompt assembly:** System prompt = mode prompt + optional brand, project file list, memory context, **`toolCallHandler.buildToolsPrompt()`** (lists MCP tools + builtins), vision hint.
2. **If any tools exist:** `hasAgentTools` is true. Server uses **`chatComplete`** (non-streaming) from `lib/ollama-client.js` in a loop (**max 5 rounds**, same constant as `ToolCallHandler.MAX_ROUNDS` conceptually).
3. **Parse:** `toolCallHandler.parseToolCalls(responseText)` finds tool invocations.
4. **None found:** Treat response as final; split into word chunks and emit SSE `{ token: … }` for UX.
5. **Found:** `executeTool` per call → SSE `toolCallRound` metadata → append assistant message + synthetic user message with tool results → next round.
6. **Builtin:** `serverId === 'builtin'` → `executeBuiltinTool` in `lib/builtin-agent-tools.js` (no MCP network).
7. **External:** `mcpClientManager.callTool(serverId, toolName, args)`.
8. **Abort:** `chatAbortController` aborts `chatComplete` and stops the loop; see `ARCHITECTURE.md`.

If **no** tools are configured, chat uses **`chatStream`** only (true token streaming).

## MCP server (incoming)

Tools for _other_ clients connecting to Code Companion: `server.js` registers MCP SDK `McpServer` + `StreamableHTTPServerTransport` on **`/mcp`** (`registerAllTools` from `mcp/tools.js`). Separate from outbound MCP **client** connections.

## Configuration touchpoints

- `config.mcpClients` — array of client definitions (persisted in `.cc-config.json`).
- `config.mcpServer` — HTTP enable/disable, disabled tools list.
- Reserved id **`builtin`** — cannot be used as an MCP client id (`lib/mcp-api-routes.js`).

## Safety notes

- Builtin terminal: project folder bound, command allowlist, blocklist, metacharacter checks (`lib/builtin-agent-tools.js`).
- Intra-request rate limit for terminal commands uses `toolCallHandler.clientKey` (set from request IP in `server.js`).

---

_Agent/MCP analysis: 2025-03-21_
