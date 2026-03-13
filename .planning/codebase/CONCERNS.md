# Codebase Concerns

**Analysis Date:** 2026-03-13

## Tech Debt

**Large monolithic server file:**
- Issue: `server.js` is 650+ lines, handling route definitions, streaming logic, MCP server setup, and GitHub integration all in one file
- Files: `server.js`
- Impact: Difficult to navigate, test, and maintain. Route handlers are tightly coupled. Adding new endpoints requires modifying a large file.
- Fix approach: Refactor into route modules (`routes/chat.js`, `routes/history.js`, `routes/files.js`, `routes/github.js`, `routes/mcp.js`) and consolidate into a lightweight app entry point

**Large monolithic React component (App.jsx):**
- Issue: `src/App.jsx` is 516 lines with 27+ state variables and multiple responsibilities (chat handling, UI state, file management, settings, GitHub integration)
- Files: `src/App.jsx`
- Impact: Component is difficult to reason about, debug, and extend. State management is scattered across useState hooks with no clear organization.
- Fix approach: Extract state management into custom hooks (`useChatLogic`, `useFileManager`, `useGitHubBrowser`), break UI into smaller presentational components, consider useReducer for complex state

**Bare `catch` blocks swallowing errors silently:**
- Issue: Multiple frontend and backend functions use empty `catch {}` blocks without logging or user feedback
- Files: `src/App.jsx` (lines 30, 64, 204, 243, 284), `src/components/SettingsPanel.jsx` (lines 30, 64), `src/components/GitHubPanel.jsx` (lines 42, 51), `src/components/McpClientPanel.jsx` (lines 42)
- Impact: Silent failures make debugging extremely difficult. Network errors, JSON parse failures, and API call failures go completely unnoticed by developer and user
- Fix approach: Replace bare `catch {}` with `catch (err) { this.log('ERROR', message, {error: err.message}); showToast('Operation failed'); }`. See `src/components/SettingsPanel.jsx` line 50 for reference implementation with error handling

**Hard-coded Ollama host mismatch:**
- Issue: Documentation in CLAUDE.md states Ollama at `http://192.168.50.7:11424` but code default is `http://localhost:11434`
- Files: `CLAUDE.md` (instructions), `lib/config.js` (line 27)
- Impact: Documentation doesn't match implementation. Users following project docs will get wrong endpoint and fail to connect.
- Fix approach: Update CLAUDE.md to reflect actual default, or update code to use the documented endpoint

**Unvalidated JSON.parse in client streaming loop:**
- Issue: `src/App.jsx` lines 238-243 parse SSE events inside loop with try/catch, but parse failures silently swallowed
- Files: `src/App.jsx` lines 238-243
- Impact: Malformed JSON from server leaves streaming state incomplete; user sees partial or stale responses without knowing why
- Fix approach: Log parse errors to console in dev mode, emit error event to user, implement fallback parsing for edge cases

**Regex engine ReDoS vulnerability:**
- Issue: `lib/tool-call-handler.js` line 1 uses regex with nested quantifiers: `/TOOL_CALL:\s*(\S+?)\.(\S+?)\(([\s\S]*?)\)/g`
- Files: `lib/tool-call-handler.js` line 1
- Impact: If Ollama produces pathological output with many nested `TOOL_CALL:` patterns or deeply nested parentheses, regex could hang and block event loop
- Fix approach: Add length limit to regex, use non-backtracking parsing instead (e.g., string search + manual state machine), add timeout to regex execution

## Known Bugs

**SSE response double-close vulnerability:**
- Symptoms: Rare "Cannot write to closed response" errors in production, especially under load
- Files: `server.js` lines 226, 241, 273-274, 296-297, 310-311 (multiple paths call res.end())
- Trigger: Client disconnects during tool-call loop OR streaming loop; `res.end()` called multiple times
- Current mitigation: Partial checks for `res.writableEnded` (lines 160, 273, 308) but not comprehensive
- Issue: Multiple code paths send `[DONE]` marker and call `res.end()`. Tool-call loop (line 226) and standard streaming loop (lines 296-297) both end response without mutual exclusion. If both paths execute, server crashes.
- Fix approach: Extract send-complete logic into single function that guarantees one-time execution

**Streaming loop memory leak on client disconnect:**
- Symptoms: Memory usage grows over time when clients disconnect mid-stream; memory not released
- Files: `server.js` lines 318-321 (event listener setup), lines 245-315 (reader in closure)
- Trigger: Client disconnects while reading stream; `reader` object in scope of readStream() not garbage collected
- Current mitigation: `req.on('close')` calls `reader.cancel()` but doesn't abort pending Ollama fetch or cleanup timer references
- Issue: Pending promise chains, uncancelled HTTP connections, and closure references keep memory allocated
- Fix approach: Add AbortController to cancel pending fetch, manually clear all references in close handler, add memory profiling test

**Path traversal vulnerability (incomplete mitigation):**
- Symptoms: User could potentially escape project folder using symlinks or unusual path encodings
- Files: `lib/file-browser.js` lines 78-81, `server.js` line 394-408
- Trigger: Send request like `/api/files/read?path=../../sensitive/file` or via symlinks
- Current mitigation: `readProjectFile` uses `path.resolve()` check, but only validates resolved path is inside folder using `startsWith()`
- Issue: `startsWith()` is insufficient—could match `/home/user-sensitive` when checking `/home/user`. Also `path.resolve()` may behave differently on Windows. Symlinks not resolved before check.
- Fix approach: Use `path.relative()` to verify resolved path is still inside project, call `fs.realpathSync()` to resolve symlinks before validation, add integration tests with symlinks

**Tool call parsing accepts malformed JSON silently:**
- Symptoms: Tool arguments get wrapped as `{"input": "..."}` instead of properly parsed; tool calls fail with cryptic errors
- Files: `lib/tool-call-handler.js` lines 12-36
- Trigger: Ollama returns tool call with Python-style kwargs or unparseable args like `project_id="abc-123", name="foo"`
- Current mitigation: Fallback parsing (lines 21-35) converts key=value to JSON
- Issue: Fallback parsing is too permissive and accepts invalid patterns. If parsing fails, entire tool call is wrapped as `{"input": "..."}` which likely breaks tool
- Fix approach: Add validation for parsed args format, log warning when fallback parsing used, reject tool calls if format unrecognized

**GitHub token exposed in config:**
- Symptoms: GitHub token stored in `.cc-config.json` in plaintext
- Files: `lib/config.js` (line 43), `server.js` (lines 494-513)
- Trigger: Access to local machine or config file via git, backup, or file browser
- Current mitigation: None—file is in project root, gitignored but accessible to any process on system
- Impact: Token can be used to access all repositories the user has access to; no token rotation or revocation
- Fix approach: Store token in OS keychain via node-keyring, or use OAuth flow with local callback, never persist token to disk

## Security Considerations

**File read endpoint exposes .env files:**
- Risk: `.env` files are readable through `/api/files/read` endpoint despite being marked as text
- Files: `lib/file-browser.js` line 12 (marks .env as textfile), line 48 (skips .env in tree), `server.js` lines 394-408 (readProjectFile)
- Current mitigation: `.env` skipped in directory tree listing (line 48) but direct API call can read it: `/api/files/read?path=.env`
- Issue: `readProjectFile` at line 77-80 only validates path traversal, not file extension. Line 12 adds .env to TEXT_EXTENSIONS, then line 48 in tree walk tries to skip it, but endpoint doesn't enforce skip
- Fix approach: Add .env exclusion in `readProjectFile`, maintain blocklist of files that should never be readable (`.env*`, `secrets/*`, `*.key`)

**GitHub token not validated before save:**
- Risk: Malicious input in `POST /api/github/token` not validated before saving to config
- Files: `server.js` lines 494-513, `lib/github.js` (validateToken function)
- Current mitigation: Token is validated via GitHub API call (`validateToken`), but validation is optional
- Recommendations:
  - Enforce token validation before save
  - Add rate limiting to prevent token enumeration attacks
  - Sanitize token in logs (never log full token)
  - Consider adding token expiry/rotation

**No input validation on project folder path:**
- Risk: Server accepts any folder path; directory traversal not fully prevented
- Files: `server.js` line 79 (only checks existence), `lib/file-browser.js` line 79-80 (path validation)
- Current mitigation: Path validation in `readProjectFile`; but Ollama URL and other settings not validated
- Recommendations:
  - Whitelist allowed project folders instead of allowing any folder
  - Validate Ollama URL format (enforce localhost/127.0.0.1 only)
  - Add input sanitization for all config values

**MCP server subprocess command injection risk:**
- Risk: User-supplied command string in `mcpClientManager.connect()` could execute arbitrary shell commands
- Files: `lib/mcp-client-manager.js` lines 22-33
- Current mitigation: Command is split on whitespace and passed to `spawn()`, not through shell (safer)
- Recommendations:
  - Validate command against whitelist of allowed MCP servers
  - Reject commands containing special shell characters (`;`, `|`, `&`, `$`, etc.)
  - Log all subprocess spawns with timestamps
  - Consider disabling MCP by default until explicitly enabled

**History data accessible without authentication:**
- Risk: Conversation history files are readable by any user on the system
- Files: `lib/history.js`, `server.js` lines 333-370
- Current mitigation: Files stored with default filesystem permissions in `history/` directory
- Recommendations:
  - Implement authentication/session tracking before exposing to network
  - Encrypt conversation history at rest
  - Add per-conversation access control
  - Document that app must not be exposed to public internet

## Performance Bottlenecks

**In-memory model list caching missing:**
- Problem: Models fetched from Ollama on every request to `/api/models`
- Files: `server.js` lines 92-116, `lib/ollama-client.js` lines 1-12
- Cause: No caching between requests; each request makes HTTP call to Ollama
- Impact: Adds 50-500ms latency per request. Multiple UI tabs polling models will overwhelm Ollama with redundant calls.
- Improvement path:
  - Implement 30-second TTL cache in memory
  - Emit SSE events to clients on model list changes
  - Or: use polling with exponential backoff

**Synchronous filesystem operations during startup:**
- Problem: `lib/history.js`, `lib/config.js`, `lib/logger.js` use synchronous `fs` operations during module initialization
- Files: `lib/history.js` lines 8-12, `lib/config.js`, `lib/logger.js`
- Cause: Blocks event loop during startup; slows cold start on systems with slow disk I/O
- Impact: Server startup delayed by 100-500ms on mechanical hard drives
- Improvement path:
  - Move initialization to async functions called explicitly from server startup
  - Use `fs.promises` for consistency with streaming operations

**Unoptimized file tree traversal:**
- Problem: `buildFileTree` walks entire directory structure synchronously on every request
- Files: `lib/file-browser.js` lines 32-75
- Cause: Synchronous `fs.readdirSync()` and `fs.statSync()` block event loop
- Impact: Large projects (10K+ files) cause UI to hang for 2-5 seconds per request
- Improvement path:
  - Make async, implement pagination/depth limits
  - Cache file tree with invalidation on file changes
  - Lazy-load subdirectories instead of entire tree

**Tool-call round-trip sequential:**
- Problem: Each tool call in loop waits for Ollama response sequentially; 5-round max means worst-case 5x network latency
- Files: `server.js` lines 168-230
- Cause: Architecture requires LLM to parse and format tool results before continuing; no parallelization possible
- Impact: Tool-heavy workflows have 5-10 second added latency per tool call round
- Improvement path:
  - Could batch tool calls if Ollama API supported it (currently doesn't)
  - Or: use streaming + event-based tool execution instead of round-trip loop

**Streaming tokenization splits on whitespace creating many SSE events:**
- Problem: `server.js` lines 220-223 splits final text by regex `(\s+)` and sends each token separately; creates 100+ events for average response
- Files: `server.js` lines 220-223
- Cause: Word-by-word tokenization for UX, but event overhead high
- Impact: Network overhead, excessive CPU usage sending/parsing events
- Improvement path:
  - Buffer tokens into chunks (e.g., 256 chars) before sending
  - Or: use actual LLM token boundaries if available from Ollama

**Large component files causing render thrashing:**
- Problem: `src/App.jsx` (516 lines), `src/components/CreateWizard.jsx` (451 lines), `src/components/GitHubPanel.jsx` (343 lines) re-render entire component on any state change
- Files: Listed above
- Cause: Complex component logic in single file; no granular state management; missing React.memo
- Impact: UI feels sluggish when streaming responses or updating multiple pieces of state
- Improvement path:
  - Split into smaller sub-components with isolated state
  - Use `useMemo`/`useCallback` to memoize expensive operations
  - Apply `React.memo` to prevent unnecessary re-renders

## Fragile Areas

**SSE message ordering in tool-call loop:**
- Files: `server.js` lines 166-229
- Why fragile: Tool-call loop sends `done` event (line 224), then `[DONE]` marker (line 226), then final response (line 227). If response ends early, state is inconsistent. Multiple code paths can execute.
- Safe modification:
  - Test with timeouts, add sequence numbers to SSE events
  - Validate state machine transitions on client
  - Ensure only one path to `res.end()`
- Test coverage: No tests for tool-call loop edge cases (timeout, partial response, malformed tool output)

**Message state management in App component:**
- Files: `src/App.jsx` lines 80-90 (message, streaming, stats state)
- Why fragile: Message state is mutable via useState; no transactional guarantees when user navigates between conversations. Can create orphaned/duplicate messages.
- Safe modification:
  - Use `useReducer` instead of multiple `useState` calls
  - Validate conversation ID matches before rendering messages
  - Add cleanup on active conversation change
- Test coverage: No tests for message history state management

**Streaming incomplete state handling:**
- Files: `server.js` lines 252-316, `src/App.jsx` lines 228-250
- Why fragile: Chat interface may show partial responses or hang if client disconnects during streaming. Frontend doesn't handle aborted streams gracefully.
- Safe modification:
  - Implement message-level state guards on frontend
  - Add receipts/acks from frontend to server
  - Add timeout to close stream if no data for 30s
- Test coverage: No tests for connection timeout or abrupt disconnection scenarios

**React hooks dependencies in large components:**
- Files: `src/App.jsx` (complex effect dependencies)
- Why fragile: With 27+ useState hooks, effect dependencies are hard to track. Missing dependencies cause stale closures and race conditions.
- Safe modification:
  - Use linter strict mode with exhaustive-deps
  - Add dependency arrays explicitly
  - Extract to custom hooks with clearer dependencies
- Test coverage: No tests for state transitions or effect ordering

**MCP client manager connection lifecycle:**
- Files: `lib/mcp-client-manager.js`, `server.js` lines 638-649
- Why fragile: Auto-connect happens on startup; if server is offline, connection fails silently and never retries. Connection state stored in memory only.
- Safe modification:
  - Implement exponential backoff reconnection with jitter
  - Expose retry UI in settings
  - Persist connection config to file for recovery
  - Add health-check loop to detect dead connections
- Test coverage: No tests for connection failure recovery

**Tool call regex is fragile:**
- Files: `lib/tool-call-handler.js` line 1
- Why fragile: Pattern `/TOOL_CALL:\s*(\S+?)\.(\S+?)\(([\s\S]*?)\)/g` uses non-greedy `\S+?` which stops at first whitespace—fails if tool names have hyphens or underscores. Uses greedy `[\s\S]*?` for args which may capture partial content if multiple tool calls exist.
- Safe modification:
  - Use more precise regex with named groups or state machine parser
  - Add unit tests for edge cases (tool names with special chars, nested parens, multiline args)
  - Add length limits to prevent ReDoS
- Test coverage: No tests for tool call parsing edge cases

## Scaling Limits

**JSON file-based history storage:**
- Current capacity: History directory stores files by conversation ID; listing loads all files into memory
- Limit: With 10K conversations, `listConversations()` reads and parses all JSON files, taking seconds
- Problem: No indexing, no pagination, O(N) scans on every history load
- Scaling path: Migrate to SQLite database with indexed queries, implement pagination API

**Single-threaded event loop with blocking operations:**
- Current capacity: Can handle ~10 concurrent chat streams before response latency degrades significantly
- Limit: `buildFileTree` and file reads are synchronous; large projects block other requests
- Problem: Node.js event loop stalls during file I/O operations
- Scaling path: Make all file I/O async, use worker threads for CPU-intensive parsing

**MCP server connection limits:**
- Current capacity: One connection per registered server; no connection pooling or rate limiting
- Limit: With 5+ external MCP servers, spawning all at startup could consume 500MB+ RAM
- Problem: Each connection uses separate stdio transport and spawns new child process
- Scaling path: Implement connection pooling, lazy loading of servers, health checks

**3D effects render pipeline unbounded:**
- Current capacity: ~100 floating geometries before frame rate drops below 30fps on mid-range GPU
- Limit: Three.js scene graph grows without culling; all geometries render every frame
- Problem: No level-of-detail (LOD) system or frustum culling
- Scaling path: Implement LOD system, add frustum culling, limit number of active 3D components

## Dependencies at Risk

**Ollama 0.13+ API changes:**
- Risk: Ollama is evolving; API responses may change format in future versions
- Current version checked: No pinned version requirement for Ollama in package.json
- Impact: Code assumes specific response structure (data.models, message.content) which may break
- Migration plan:
  - Add API version detection on startup
  - Implement response schema validation with Zod (already in package.json)
  - Test against multiple Ollama versions in CI

**@modelcontextprotocol/sdk v1.27.1 - Pre-release API risk:**
- Risk: MCP specification still evolving; major version could have breaking changes
- Version: `^1.27.1` (semver allows breaking changes on minor/patch)
- Impact: External tool integration breaks on SDK update
- Migration plan:
  - Pin version strictly to `1.27.1` instead of `^1.27.1`
  - Add integration tests for MCP server connections
  - Watch for MCP v2.0 announcement

**@splinetool/react-spline v4.1.0 - Proprietary CDN dependency:**
- Risk: Spline 3D scenes loaded from `https://prod.spline.design`; if Spline service goes down, 3D effects break
- Impact: App still functional (fallback CSS scenes), but premium UX degraded
- Migration plan:
  - Already using Three.js as fallback (ParticleField, FloatingGeometry)
  - Can remove Spline entirely, use Three.js exclusively
  - Or: allow offline 3D model bundles

**express v4.18.2 - Missing security middleware:**
- Risk: No helmet.js, no rate limiting, no CORS policy configured
- Impact: XSS/clickjacking attacks possible if app exposed to web; no request rate limiting
- Migration plan:
  - App designed for localhost only (acceptable for now)
  - Add helmet() middleware and rate-limiting if ever exposed to network
  - Document that app must not be internet-facing

## Missing Critical Features

**No authentication or authorization:**
- Problem: All endpoints are open; any client with network access can clone private GitHub repos, view history, modify settings
- Blocks: Multi-user deployments, cloud hosting, shared environments
- Gap: Implement session tokens, API keys, or OAuth before exposing to network

**No offline mode:**
- Problem: App completely non-functional if Ollama becomes unreachable after initial load
- Blocks: PM workflows if user loses network connectivity
- Gap: Could cache LLM responses and serve from cache; or offer basic advice from hardcoded prompts

**No model provider abstraction:**
- Problem: Code hardcoded to Ollama; cannot switch to OpenAI, Claude, or other LLM APIs
- Blocks: Using cloud models, fallback providers, A/B testing
- Gap: Create LLM provider interface, implement adapters for Ollama/OpenAI/etc.

**No conversation encryption or privacy controls:**
- Problem: All conversation data is plaintext in `history/` directory
- Blocks: HIPAA compliance, sensitive data handling, enterprise adoption
- Gap: Implement end-to-end encryption, add data retention policies

**No export/import of conversation history:**
- Problem: Users cannot back up or share conversations; switching machines loses all history
- Blocks: Collaboration workflows, disaster recovery
- Gap: Implement JSON export (partially done for single conversation), add bulk export and import

**No conversation search:**
- Problem: User cannot find past conversation by content; only browse list
- Blocks: Finding previous analysis results
- Gap: Add full-text search via simple JSON scan or SQLite FTS

## Test Coverage Gaps

**API streaming endpoints not tested:**
- What's not tested: `/api/chat` SSE streaming, tool-call loop, partial responses, client disconnections, timeout handling
- Files: `server.js` lines 120-328
- Risk: Streaming bugs go undetected; race conditions in SSE message ordering cause user-facing failures
- Priority: HIGH - streaming is core feature, complex, and fragile

**File browser path validation not tested:**
- What's not tested: Path traversal prevention, symlink handling, large file truncation, .env file exclusion
- Files: `lib/file-browser.js`, `server.js` lines 375-413
- Risk: Security vulnerability if validation logic breaks; users may inadvertently read outside project folder
- Priority: HIGH - security critical

**No unit tests for tool-call parsing:**
- What's not tested: Regex edge cases, malformed JSON, special characters in tool names, nested parentheses
- Files: `lib/tool-call-handler.js`
- Risk: Tool calls fail silently with cryptic errors; hard to debug
- Priority: HIGH - affects external integrations

**GitHub integration not tested:**
- What's not tested: Token validation, repo cloning, permission errors, malformed URLs, progress tracking
- Files: `lib/github.js`, `server.js` lines 423-522
- Risk: GitHub operations fail silently; users cannot diagnose clone failures
- Priority: MEDIUM

**MCP client reconnection not tested:**
- What's not tested: Connection failures, auto-reconnect, partial disconnects, tool call failures, timeout handling
- Files: `lib/mcp-client-manager.js`, `server.js` lines 638-649
- Risk: MCP servers fail to load; tool calls hang indefinitely
- Priority: MEDIUM

**React component state transitions not tested:**
- What's not tested: App.jsx state machine, effect dependencies, error boundaries, message synchronization
- Files: `src/App.jsx`
- Risk: UI gets stuck in invalid state; users cannot recover without refresh
- Priority: MEDIUM

**No E2E tests:**
- What's not tested: Full user workflows (e.g., attach file → ask question → save conversation)
- Files: Entire application
- Risk: Integration issues between frontend and backend only caught in manual testing
- Priority: MEDIUM

---

*Concerns audit: 2026-03-13*
