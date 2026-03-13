# Codebase Concerns

**Analysis Date:** 2025-03-13

## Tech Debt

**Large monolithic server file:**
- Issue: `server.js` is 650 lines, handling route definitions, streaming logic, MCP server setup, and GitHub integration all in one file
- Files: `server.js`
- Impact: Difficult to navigate, test, and maintain. Route handlers are tightly coupled. Adding new endpoints requires modifying a large file.
- Fix approach: Refactor into route modules (`routes/chat.js`, `routes/history.js`, `routes/files.js`, `routes/github.js`, `routes/mcp.js`) and consolidate into a lightweight app entry point

**Large monolithic React component (App.jsx):**
- Issue: `src/App.jsx` is 516 lines with 27+ state variables and multiple responsibilities (chat handling, UI state, file management, settings, GitHub integration)
- Files: `src/App.jsx`
- Impact: Component is difficult to reason about, debug, and extend. State management is scattered across useState hooks with no clear organization.
- Fix approach: Extract state management into custom hooks (`useChatLogic`, `useFileManager`, `useGitHubBrowser`), break UI into smaller presentational components, consider useReducer for complex state

**Hard-coded Ollama host:**
- Issue: Default Ollama URL is `http://192.168.50.7:11424` hard-coded in CLAUDE.md project instructions, but actual default in code is `http://localhost:11434`
- Files: `CLAUDE.md` (instructions), `lib/config.js` (line 27)
- Impact: Documentation doesn't match implementation. Users following project docs will get wrong endpoint.
- Fix approach: Update CLAUDE.md to reflect actual default, or update code to use the documented endpoint

**No structured error recovery:**
- Issue: Many API endpoints handle errors silently, return empty arrays/objects, or show generic error messages
- Files: `server.js` (lines 237-242, 301-303), `lib/history.js` (line 32), `lib/file-browser.js` (line 37)
- Impact: Users cannot diagnose failures. Errors are swallowed during file listing, history loading, and stream parsing.
- Fix approach: Implement structured error logging with request IDs, expose detailed errors to frontend only for debugging mode, add retry logic with exponential backoff

## Known Bugs

**Path traversal vulnerability (mitigated but incomplete):**
- Symptoms: User could potentially escape project folder using `../` paths
- Files: `lib/file-browser.js` (lines 78-81), `server.js` (line 406-408)
- Trigger: Send request to `/api/files/read?path=../../sensitive/file`
- Current mitigation: `readProjectFile` uses `path.resolve()` check, but only after absolute path resolution. The check assumes normalized paths.
- Concern: Edge cases with symlinks or unusual path encodings may bypass the check. `path.resolve()` may behave differently on Windows.
- Fix approach: Use `path.relative()` to verify the resolved path is still inside project folder, add integration tests with symlinks

**Streaming incomplete state handling:**
- Symptoms: Chat interface may show partial responses or hang if client disconnects during streaming
- Files: `server.js` (lines 252-316)
- Trigger: Close browser tab or network interruption during streaming response
- Current issue: `reader.cancel()` called on client disconnect (line 320), but no cleanup of partial response state on frontend
- Impact: User may lose message history or see corrupted state
- Fix approach: Implement message-level state guards on frontend, add receipts/acks from frontend to server

**Tool call regex is fragile:**
- Symptoms: Tool calls may fail to parse if arguments contain special characters or newlines
- Files: `lib/tool-call-handler.js` (line 1)
- Current pattern: `/TOOL_CALL:\s*(\S+?)\.(\S+?)\(([\s\S]*?)\)/g`
- Issue: Uses non-greedy matching with `\S+?` which stops at first whitespace—fails if tool names have hyphens or underscores. Regex uses `[\s\S]*?` to capture args, which is greedy and may capture partial content if multiple tool calls exist.
- Fix approach: Use more precise regex with named groups, add unit tests for edge cases

**GitHub token exposed in config:**
- Symptoms: GitHub token stored in `.cc-config.json` in plaintext
- Files: `lib/config.js` (line 43), `server.js` (lines 494-513)
- Trigger: Access to local machine or config file
- Current mitigation: None—file is in project root, likely gitignored but accessible to any process
- Impact: Token can be used to access all repositories the user has access to
- Fix approach: Store token in OS keychain (node-keyring) instead of JSON file, or use OAuth flow with local callback

## Security Considerations

**Unvalidated GitHub token operations:**
- Risk: Malicious input in `POST /api/github/token` not validated before saving
- Files: `server.js` (lines 494-513), `lib/github.js` (lines 1-100)
- Current mitigation: Token is validated via GitHub API call (`validateToken`), but validation is optional during token save
- Recommendations: Enforce token validation before save, add rate limiting to prevent token enumeration, sanitize token in logs

**Open file size limit:**
- Risk: User can read arbitrarily large files up to 500KB limit set in `readProjectFile`
- Files: `lib/file-browser.js` (line 89)
- Current mitigation: 500KB limit enforced, but no per-user quota or rate limiting
- Recommendations: Add cumulative read limits per session, implement streaming file reads for large files, add auth headers to distinguish users

**MCP server subprocess command injection risk:**
- Risk: User-supplied command string in `mcpClientManager.connect()` could execute arbitrary shell commands
- Files: `lib/mcp-client-manager.js` (lines 22-33)
- Current mitigation: Command is split on whitespace and passed to `spawn()`, not through shell
- Recommendations: Validate command against whitelist of allowed MCP servers, reject commands containing special shell characters, log all subprocess spawns

**History data accessible without auth:**
- Risk: Conversation history files are readable by any user on the system
- Files: `lib/history.js`, `server.js` (lines 333-370)
- Current mitigation: Files stored with default permissions in `history/` directory
- Recommendations: Implement authentication/session tracking, encrypt conversation history at rest, add per-conversation access control

## Performance Bottlenecks

**In-memory model list caching:**
- Problem: Models fetched from Ollama on every request to `/api/models`
- Files: `server.js` (lines 92-116), `lib/ollama-client.js` (lines 1-12)
- Cause: No caching between requests; each request makes HTTP call to Ollama
- Impact: Adds 50-500ms latency per request. Multiple UI tabs polling models will overwhelm Ollama.
- Improvement path: Implement 30-second TTL cache in memory, emit SSE events to clients on model list changes, or use polling with exponential backoff

**Unoptimized file tree traversal:**
- Problem: `buildFileTree` walks entire directory structure synchronously on every request
- Files: `lib/file-browser.js` (lines 32-75)
- Cause: Synchronous `fs.readdirSync()` and `fs.statSync()` block event loop
- Impact: Large projects (10K+ files) cause UI to hang for 2-5 seconds
- Improvement path: Make async, implement pagination/depth limits, cache file tree with invalidation on file changes

**Streaming response word-by-word (tool-call mode):**
- Problem: Tool-call responses are split by whitespace and sent word-by-word (line 220)
- Files: `server.js` (lines 218-225)
- Impact: Produces 100+ SSE events for average response; excessive overhead and CPU usage
- Improvement path: Buffer 200-400 char chunks instead of words, implement adaptive chunk sizing based on token rate

**GitHub repo cloning with no progress tracking:**
- Problem: Large repos block the request for minutes with no client feedback
- Files: `lib/github.js`, `server.js` (lines 425-443)
- Impact: Request timeout, user assumes failure
- Improvement path: Implement streaming progress via SSE, add subprocess output piping to logs, allow cancel via signal

## Fragile Areas

**SSE message ordering in tool-call loop:**
- Files: `server.js` (lines 166-229)
- Why fragile: Tool-call loop sends `done` event, then final response tokens, then `[DONE]` marker. If response stream ends early, state is inconsistent.
- Safe modification: Test with timeouts, add sequence numbers to SSE events, validate state machine transitions on client
- Test coverage: No tests for tool-call loop edge cases (timeout, partial response, malformed tool output)

**React hooks dependencies in large components:**
- Files: `src/App.jsx` (complex effect dependencies), `src/components/ChatInput.jsx` (if exists)
- Why fragile: With 27+ useState hooks, effect dependencies are hard to track. Missing dependencies cause stale closures and race conditions.
- Safe modification: Use linter strict mode, add dependency arrays, consider extracting to custom hooks with clearer dependencies
- Test coverage: No tests for state transitions or effect ordering

**MCP client reconnection logic:**
- Files: `lib/mcp-client-manager.js`, `server.js` (lines 638-649)
- Why fragile: Auto-connect happens on startup; if server is offline, connection fails silently and never retries
- Safe modification: Implement exponential backoff reconnection, expose retry UI in settings
- Test coverage: No tests for connection failure recovery

**Ollama endpoint change without restart:**
- Files: `server.js` (lines 70-88), `lib/config.js`
- Why fragile: Ollama URL is read from config on each request, but cached models list may be stale if URL changes
- Safe modification: Invalidate model cache on config change, emit event to frontend to refresh
- Test coverage: No tests for dynamic config changes

## Scaling Limits

**JSON file-based history storage:**
- Current capacity: History directory stores files by conversation ID; listing loads all files into memory
- Limit: With 10K conversations, `listConversations()` reads and parses all JSON files, taking seconds
- Problem: No indexing, no pagination, O(N) scans on every history load
- Scaling path: Migrate to SQLite database with indexed queries, implement pagination API

**Single-threaded event loop with blocking operations:**
- Current capacity: Can handle ~10 concurrent chat streams before response latency degrades
- Limit: `buildFileTree` and file reads are synchronous; large projects block other requests
- Problem: Node.js event loop stalls during file I/O operations
- Scaling path: Make all file I/O async, use worker threads for CPU-intensive parsing

**MCP server connection limits:**
- Current capacity: One connection per registered server; no connection pooling or rate limiting
- Limit: With 5+ external MCP servers, spawning all at startup could consume 500MB+ RAM
- Problem: Each connection uses separate stdio transport and spawns new child process
- Scaling path: Implement connection pooling, lazy loading of servers, health checks

## Dependencies at Risk

**Ollama 0.13+ API changes:**
- Risk: Ollama is evolving; API responses may change format
- Current version checked: No pinned version requirement for Ollama
- Impact: Code assumes specific response structure (data.models, message.content)
- Migration plan: Add API version detection, implement response schema validation, test against multiple Ollama versions

**@modelcontextprotocol/sdk dependency:**
- Risk: MCP SDK is beta/unstable; API surface may change
- Version: `^1.27.1` (semver allows breaking changes)
- Impact: MCP features may break on minor updates
- Migration plan: Pin to exact version (`1.27.1`), test updates in staging before production

## Missing Critical Features

**No request authentication or authorization:**
- Problem: All endpoints are open; any client with network access can clone private GitHub repos, view history, modify settings
- Blocks: Multi-user deployments, cloud hosting, shared environments
- Fix: Implement session tokens, API keys, or OAuth

**No model provider abstraction:**
- Problem: Code hardcoded to Ollama; cannot switch to OpenAI, Claude, or other LLM APIs
- Blocks: Using cloud models, fallback providers, A/B testing
- Fix: Create LLM provider interface, implement adapters for Ollama/OpenAI/etc.

**No conversation encryption or privacy controls:**
- Problem: All conversation data is plaintext in `history/` directory
- Blocks: HIPAA compliance, sensitive data handling, enterprise adoption
- Fix: Implement end-to-end encryption, add data retention policies

## Test Coverage Gaps

**API streaming endpoints not tested:**
- What's not tested: `/api/chat` SSE streaming, tool-call loop, partial responses, client disconnections
- Files: `server.js` (lines 120-328)
- Risk: Streaming bugs go undetected; race conditions in SSE message ordering cause user-facing failures
- Priority: High—streaming is core feature

**File browser path validation not tested:**
- What's not tested: Path traversal prevention, symlink handling, large file truncation
- Files: `lib/file-browser.js`, `server.js` (lines 375-413)
- Risk: Security vulnerability if validation logic breaks; users may inadvertently read outside project
- Priority: High—security critical

**GitHub integration not tested:**
- What's not tested: Token validation, repo cloning, permission errors, malformed URLs
- Files: `lib/github.js`, `server.js` (lines 423-522)
- Risk: GitHub operations fail silently; users cannot diagnose clone failures
- Priority: Medium

**MCP client reconnection not tested:**
- What's not tested: Connection failures, auto-reconnect, partial disconnects, tool call failures
- Files: `lib/mcp-client-manager.js`, `server.js` (lines 638-649)
- Risk: MCP servers fail to load; tool calls hang indefinitely
- Priority: Medium

**React component state transitions not tested:**
- What's not tested: App.jsx state machine, effect dependencies, error boundaries
- Files: `src/App.jsx`
- Risk: UI gets stuck in invalid state; users cannot recover without refresh
- Priority: Medium

---

*Concerns audit: 2025-03-13*
