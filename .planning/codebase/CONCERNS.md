# Codebase Concerns

**Analysis Date:** 2026-03-13

## Tech Debt

**Silent error handling throughout frontend:**
- Issue: Widespread use of empty catch blocks (`catch {}`) silently swallows errors, making debugging difficult and hiding failures from users
- Files: `src/App.jsx` (10+ instances), `src/components/GitHubPanel.jsx`, `src/components/FileBrowser.jsx`, `src/components/SettingsPanel.jsx`, `src/contexts/Effects3DContext.jsx`
- Impact: Failed API calls, failed file operations, and failed configuration updates all fail silently. Users have no feedback when things go wrong, and errors don't appear in logs
- Fix approach: Replace empty catches with proper error logging and user-facing toast notifications. Example: `catch (err) { console.error(err); showToast('Failed to load history'); }`

**Large monolithic files:**
- Issue: `server.js` (793 lines) and `src/App.jsx` (664 lines) contain too many concerns in one file
- Files: `/server.js`, `/src/App.jsx`
- Impact: Hard to maintain, test, and understand. Changes ripple across unrelated functionality. Makes code review difficult
- Fix approach: Break server routes into separate modules (chat, history, github, mcp). Break App.jsx into smaller components (ConversationManager, ModelSelector, etc.)

**Regex pattern parsing for tool calls is fragile:**
- Issue: Tool call parsing in `lib/tool-call-handler.js` line 1 uses a complex regex `TOOL_CALL_PATTERN` that relies on exact format from LLM output. Any slight variation in model response breaks tool execution
- Files: `lib/tool-call-handler.js`
- Impact: Tool calls fail silently when model slightly changes format. No fallback for parsing errors. Creates brittle coupling to LLM output format
- Fix approach: Add structured response mode if Ollama supports it. Add fallback parsing with multiple pattern variants. Log failed parse attempts with actual text received

**Unhandled promise rejections in stream handling:**
- Issue: In `server.js` lines 317-380, the async stream reading loop has try-catch but cleanup may not happen properly if stream ends unexpectedly
- Files: `/server.js` (lines 317-381)
- Impact: Resources may leak if client disconnects during stream reading. Reader objects not always cleaned up
- Fix approach: Add finally block to ensure reader.cancel() is called. Use try-finally pattern for guaranteed cleanup

**Global MCP client manager state:**
- Issue: `McpClientManager` in `lib/mcp-client-manager.js` maintains a single Map of connections shared across all requests, but HTTP requests are stateless
- Files: `lib/mcp-client-manager.js`, `server.js` (lines 31-33)
- Impact: Concurrent requests may interfere with each other's tool calls. Connection state could become inconsistent. Auto-reconnection logic not tested
- Fix approach: Review if global state is appropriate for stateless HTTP server. Consider if each request should get fresh connection or if manager properly isolates per-user context

## Known Bugs

**File input accept attribute missing file extensions:**
- Issue: File input element in `src/App.jsx` line 602 specifies file extensions but browser may interpret them incorrectly
- Files: `src/App.jsx` (line 602)
- Trigger: User tries to upload file with custom extension or unusual format
- Workaround: Manual file selection works if you change file type filter to "All Files"

**Empty catch in config loading silently loses configuration errors:**
- Issue: `lib/config.js` lines 35-37 catches all errors loading config file but doesn't log them
- Files: `lib/config.js`
- Trigger: If `.cc-config.json` is corrupted or permissions issue, user gets default config with no warning
- Workaround: Delete `.cc-config.json` and restart to get fresh default config

**Memory metrics may not be accurate under heavy load:**
- Issue: CPU percentage calculation in `server.js` lines 66-82 takes single-point samples and may show spikes rather than smoothed usage
- Files: `/server.js` (lines 66-82)
- Trigger: Burst of requests causes CPU metric to spike disproportionately
- Workaround: Dashboard metrics are informational only, not used for actual scaling decisions

## Security Considerations

**GitHub token stored in plaintext in config file:**
- Risk: `.cc-config.json` contains GitHub token in plain JSON. If file is committed or backup is exposed, token is compromised
- Files: `lib/config.js`, `.cc-config.json` (generated at runtime)
- Current mitigation: File is gitignored and never committed by default. Token is validated on save
- Recommendations:
  1. Use OS keychain/credential store instead of JSON file (`keytar` package)
  2. Add warning in Settings UI when token is saved
  3. Add automatic token rotation capability
  4. Never log token values (review logging for sanitization)

**Path traversal protection exists but uses string prefix check:**
- Risk: `lib/file-browser.js` line 80 checks if path starts with folder using string comparison, which could be bypassed with symlinks
- Files: `lib/file-browser.js` (line 80)
- Current mitigation: Basic path validation blocks most attacks
- Recommendations:
  1. Use `path.relative()` and check result doesn't start with `..` (more robust)
  2. Reject all symlinks explicitly with `fs.realpathSync()`
  3. Add unit tests for path traversal attempts

**LLM-injected tool calls are executed without validation:**
- Risk: Model output directly parsed for tool calls in `lib/tool-call-handler.js`. Malicious or jailbroken model could call tools with arbitrary arguments
- Files: `lib/tool-call-handler.js`
- Current mitigation: Tools themselves validate arguments through MCP framework
- Recommendations:
  1. Add tool call whitelist — only allow specific tools per mode
  2. Validate tool arguments against schema before execution
  3. Log all tool calls with arguments for audit trail
  4. Add rate limiting on tool calls per conversation

**Environment variables in MCP client config:**
- Risk: `server.js` line 32 passes environment variables to MCP client subprocess. If config includes untrusted env vars, subprocess receives them
- Files: `server.js` (line 32), `lib/mcp-client-manager.js` (line 32)
- Current mitigation: Config is user-provided through settings
- Recommendations:
  1. Whitelist allowed environment variables for MCP subprocesses
  2. Never pass `PATH`, `HOME`, shell variables directly
  3. Sanitize values for shell injection (though using array args helps)

## Performance Bottlenecks

**Inline markdown rendering without memoization:**
- Problem: `src/components/MarkdownContent.jsx` renders markdown on every message update. Markdown parsing is CPU-intensive
- Files: `src/components/MarkdownContent.jsx`
- Cause: No useMemo wrapping markdown parse calls. Every state change re-parses all messages
- Improvement path: Wrap parsed markdown in useMemo by message ID. Consider virtual scrolling for long conversations

**File tree walk is synchronous and blocks on large projects:**
- Problem: `lib/file-browser.js` line 32-75 recursively walks file tree synchronously. Large projects (node_modules=50k files) cause UI freeze
- Files: `lib/file-browser.js`
- Cause: `fs.readdirSync()` and `fs.statSync()` are blocking I/O
- Improvement path: Use `fs.promises` with Promise.all for parallel directory reads. Implement pagination/lazy loading in UI

**Unbounded message history in memory:**
- Problem: `src/App.jsx` loads all conversations into state on startup (line 109), all messages for active conversation (line 284)
- Files: `src/App.jsx`
- Cause: No pagination or streaming. 1000 conversations × 100 messages each = 100K message objects in RAM
- Improvement path: Implement pagination (load 20 conversations at a time). Lazy-load message history for active conversation

**String-based configuration loaded on every request:**
- Problem: `server.js` calls `getConfig()` on every request (lines 158, 201, 244, etc.) which reads from shared mutable state
- Files: `/server.js`
- Cause: Config is meant to be read-once at startup. Frequent property access doesn't cache
- Improvement path: Cache config in process memory on startup. Only reload on explicit update via API

**Conversation CSV export builds entire array in memory:**
- Problem: `src/App.jsx` lines 205-210 build full CSV as string before download. Large conversation histories could exhaust memory
- Files: `src/App.jsx`
- Cause: No streaming export or chunking
- Improvement path: Stream CSV rows progressively or chunk data before stringifying

## Fragile Areas

**ICM Project scaffolding with external template dependency:**
- Files: `lib/icm-scaffolder.js`
- Why fragile: Scaffolder requires external template path (defaults to `~/AI_Dev/ICM_FW/ICM-Framework-Template`). If template doesn't exist, scaffold fails with generic error. No fallback or bundled template
- Safe modification:
  1. Always validate template exists before attempting scaffold
  2. Add built-in minimal template for bootstrap
  3. Add detailed error messages mentioning where template should be
- Test coverage: Unit tests in `test/unit/icm-scaffolder.test.js` cover happy path and path traversal, but no tests for missing template case

**MCP Server HTTP endpoint with no authentication:**
- Files: `server.js` (lines 665-685)
- Why fragile: `/mcp` endpoint accepts raw MCP protocol messages with no authentication. Anyone with access to server can invoke any MCP tool
- Safe modification:
  1. Add authentication check (require API key or session)
  2. Log all MCP requests with caller info
  3. Add rate limiting per client
- Test coverage: No tests for MCP HTTP endpoint. E2E tests in `test/e2e/create-mode.spec.js` exist but don't cover MCP paths

**Ollama model list relies on exact format of API response:**
- Files: `lib/ollama-client.js` (lines 1-13)
- Why fragile: `listModels()` assumes `data.models` exists and `model.details?.family` structure. If Ollama response format changes, parsing fails
- Safe modification:
  1. Add defensive checks: `const models = data?.models || []; if (!Array.isArray(models)) models = []`
  2. Add fallback for missing fields: `family: m.details?.family || m.base || 'unknown'`
  3. Version lock Ollama API version in docs
- Test coverage: No unit tests for ollama-client. Only tested through integration

**Streaming response handling with manual buffer management:**
- Files: `server.js` (lines 310-380)
- Why fragile: Manual TextDecoder and line-by-line parsing is error-prone. Incomplete JSON lines may corrupt parsing. No recovery mechanism
- Safe modification:
  1. Use a proper streaming JSON parser library (`ndjson` or `JSONStream`)
  2. Add line validation before JSON.parse attempt
  3. Add comprehensive error logging with context
- Test coverage: E2E tests exist but manual streaming is hard to test comprehensively

## Scaling Limits

**Single-threaded Node.js processing for CPU-intensive operations:**
- Current capacity: Can handle ~10 concurrent chat streams before CPU becomes bottleneck
- Limit: At ~15 concurrent requests, Ollama integration becomes slow because Node event loop is blocked
- Scaling path:
  1. Use Worker Threads for markdown parsing (intensive)
  2. Use clustering for multi-core usage
  3. Consider moving to stateless architecture where each request is independent

**FileTree walk has O(n) complexity per folder:**
- Current capacity: Projects with <10k files work smoothly. >50k files causes multi-second delay
- Limit: Very large monorepos (>100k files) will cause browser timeout
- Scaling path:
  1. Implement server-side pagination with cursor
  2. Add search/filter to avoid loading full tree
  3. Cache tree results with invalidation on file change

**In-memory conversation history grows unbounded:**
- Current capacity: ~1000 conversations with 100 messages each = acceptable RAM
- Limit: At ~10k conversations or very long message histories (1000+ messages), React state updates slow down
- Scaling path:
  1. Implement conversation pagination (20 per page)
  2. Implement message windowing (show last 50 messages, lazy-load earlier)
  3. Archive old conversations to separate storage tier

**Hardcoded Ollama URL limits to single instance:**
- Current capacity: One Ollama server per Code Companion instance
- Limit: Can't load-balance across multiple Ollama instances or use different models on different servers
- Scaling path:
  1. Support multiple Ollama endpoints with load balancing
  2. Allow per-mode model/endpoint selection
  3. Add model affinity (prefer faster models for quick tasks)

## Dependencies at Risk

**Express 4.18.2 is stable but outdated:**
- Risk: Latest Express 4.x is 4.21.x. Security patches may have been released
- Impact: Potential unpatched vulnerabilities in request parsing, middleware, or routing
- Migration plan: Update to latest 4.x patch. Plan Express 5.0 migration (breaking changes) for future major version

**Marked 17.0.4 has known security considerations:**
- Risk: Markdown parser can execute arbitrary JavaScript if untrusted content is rendered with `dangerously_inline`
- Impact: If user markdown contains malicious code, it could execute. See recent Marked security advisories
- Migration plan:
  1. Audit how Marked is used in `MarkdownContent.jsx`
  2. Ensure sanitization is applied: use `DOMPurify` + marked together
  3. Document that user-provided markdown should be treated as trusted (users own their data)

**Node.js stream API changes between versions:**
- Risk: Streaming code in `server.js` uses old-style callback streams. Future Node versions may deprecate
- Impact: Code may break on Node 20+
- Migration plan: Migrate to async iterators and `ReadableStream` API (more modern)

**React 19.2.4 is very recent with limited production battle-testing:**
- Risk: Version is from 2024 with fewer production deployments than 18.x. Edge cases may not be discovered
- Impact: Unexpected behavior in specific scenarios. Browser compatibility issues
- Migration plan: Monitor for issues in production. Have fallback to React 18 if needed

## Missing Critical Features

**No conversation search functionality:**
- Problem: Users with hundreds of conversations can't find old discussions. Sidebar only shows chronological list
- Blocks: PM workflows of "find that conversation where we discussed X"
- Priority: Medium

**No API authentication:**
- Problem: Anyone who can access the server port can use all features. No multi-user isolation
- Blocks: Sharing server instance across team members safely. Using as shared team resource
- Priority: High (if server is exposed beyond localhost)

**No conversation/model export with metadata:**
- Problem: Dashboard exports CSV/JSON but exports don't include conversation metadata (who created, when, which mode)
- Blocks: Reporting and analytics workflows
- Priority: Low (workaround: access raw history files)

**No undo/revision history for conversations:**
- Problem: Once user deletes message, it's gone. No way to recover
- Blocks: Safety net for accidental deletions
- Priority: Low (users manage deletion via archive feature)

## Test Coverage Gaps

**Untested areas:**

**Frontend API integration tests:**
- What's not tested: Real fetch() calls to backend endpoints. How component handles 500 errors, timeouts, malformed responses
- Files: `src/App.jsx`, `src/components/` (all)
- Risk: Silent failures go unnoticed in CI/CD. Breaking API changes caught late
- Priority: High

**MCP tool calling integration:**
- What's not tested: End-to-end tool call parsing, execution, and response handling. Error cases when MCP server times out or returns invalid format
- Files: `lib/tool-call-handler.js`, `server.js` (lines 233-295)
- Risk: Tool features silently break. Users blame Code Companion instead of MCP server
- Priority: High

**Ollama connection failures:**
- What's not tested: Behavior when Ollama is slow, returns malformed JSON, or is completely down. Timeout handling
- Files: `lib/ollama-client.js`
- Risk: Confusing error messages. User doesn't know if it's their Ollama or the app
- Priority: Medium

**GitHub token validation and security:**
- What's not tested: Invalid token handling, token expiration, rate limit behavior
- Files: `lib/github.js`
- Risk: Tokens silently fail. Sensitive errors may leak information
- Priority: Medium

**File browser security against path traversal:**
- What's not tested: Symlink attacks, relative path attacks, edge cases like `//` or `.` in paths
- Files: `lib/file-browser.js`
- Risk: Security regression goes unnoticed. Users could accidentally read sensitive files
- Priority: High

**Create mode with unusual characters in project name:**
- What's not tested: Unicode characters, very long names, special filesystem characters
- Files: `lib/icm-scaffolder.js`
- Risk: Scaffold fails with unclear error. Partial project directory created
- Priority: Medium (unit tests exist for happy path but not edge cases)

**Dashboard analytics calculation:**
- What's not tested: Behavior with empty history, malformed history objects, dates in wrong format
- Files: `src/App.jsx` (lines 140-187)
- Risk: Dashboard shows incorrect metrics or crashes with invalid data
- Priority: Medium

**Streaming JSON parsing with incomplete messages:**
- What's not tested: What happens when buffer splits in middle of JSON object? Multi-frame messages? Very large tokens?
- Files: `server.js` (lines 310-380)
- Risk: Parsing errors cause loss of response. No error recovery
- Priority: High (critical path for chat)

---

*Concerns audit: 2026-03-13*
