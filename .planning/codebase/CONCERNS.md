# Codebase Concerns

**Analysis Date:** 2026-03-14

## Tech Debt

**No Linting/Formatting:**

- Issue: No ESLint or Prettier config; style can drift
- Files: All `src/`, `lib/`, `mcp/`
- Impact: Inconsistent formatting, potential bugs (e.g. unused vars, implicit globals)
- Fix approach: Add `eslint.config.js` (flat config) and `.prettierrc`, run on CI

**Duplicate Test Layout:**

- Issue: `tests/test/unit/` and `tests/test/e2e/` duplicate `tests/unit/` and `tests/e2e/`
- Files: `tests/test/unit/icm-scaffolder.test.js`, `tests/test/e2e/create-mode.spec.js`
- Impact: Confusion about where to add tests; Playwright config uses `tests/` so both are discovered
- Fix approach: Consolidate into `tests/unit/` and `tests/e2e/`; remove `tests/test/`

**No TypeScript:**

- Issue: Pure JavaScript; no static typing
- Files: All source
- Impact: Refactors risk runtime errors; IDE support weaker
- Fix approach: Incremental migration (e.g. `lib/` first) or accept JS for project scope

## Known Bugs

- Not detected (no TODO/FIXME/HACK in src or lib)

## Security Considerations

**GitHub Token Storage:**

- Risk: Token in `.cc-config.json`; if data dir is exposed, token leaks
- Files: `lib/config.js`, `server.js` (sanitizeConfigForClient)
- Current mitigation: Token masked in API responses; config not served to client
- Recommendations: Consider OS keychain for Electron builds; document data dir permissions

**MCP Client Config:**

- Risk: Env vars (tokens, keys) in config; subprocess execution
- Files: `lib/mcp-client-manager.js`, `lib/mcp-api-routes.js`
- Current mitigation: Validation rejects shell chars, inline args; env keys validated
- Recommendations: Audit `validateAndNormalizeConfig` for edge cases; rate limit test-connection

**Path Traversal:**

- Risk: File read endpoints could escape project folder
- Files: `lib/file-browser.js` (isWithinBasePath), `lib/icm-scaffolder.js` (isUnderRoot)
- Current mitigation: `isWithinBasePath`, `isUnderRoot` with realpath checks
- Recommendations: Ensure all file read paths use these guards

## Performance Bottlenecks

**Large App.jsx:**

- Problem: 771 lines; many useState, mode switching, chat logic
- Files: `src/App.jsx`
- Cause: Single component holds most app state
- Improvement path: Extract chat state to custom hook or context; split mode panels into lazy-loaded routes

**Large ReviewPanel / GitHubPanel:**

- Problem: 825 and 811 lines respectively
- Files: `src/components/ReviewPanel.jsx`, `src/components/GitHubPanel.jsx`
- Cause: Feature-rich panels with inline logic
- Improvement path: Extract subcomponents (e.g. FindingCard, RepoList); move handlers to hooks

## Fragile Areas

**Tool-Call Parsing:**

- Files: `lib/tool-call-handler.js`
- Why fragile: Relies on LLM output format (`<TOOL_CALL>...</TOOL_CALL>`); model may deviate
- Safe modification: Add tests for parse edge cases; consider more robust delimiter
- Test coverage: Not directly tested

**Ollama JSON Streaming:**

- Files: `server.js` (chat stream loop), `lib/ollama-client.js`
- Why fragile: Line-by-line JSON parse; buffer handling on chunk boundaries
- Safe modification: Reuse shared stream parser; add error recovery
- Test coverage: No unit tests for stream parsing

**Builder Form Sync:**

- Files: `src/components/builders/BaseBuilderPanel.jsx`
- Why fragile: `formDataRef.current` used for revise flow; ref/state sync can drift
- Safe modification: Ensure all updates go through setFormData; avoid direct ref mutation
- Test coverage: UI tests mock API; no unit tests for form state

## Scaling Limits

**In-Memory Rate Limits:**

- Current capacity: Per-IP buckets in Map; resets on server restart
- Limit: Single process; no distributed rate limiting
- Scaling path: Redis or similar for multi-instance; or accept single-instance for desktop

**History Storage:**

- Current capacity: One JSON file per conversation
- Limit: Large history dir can slow listConversations (reads all files)
- Scaling path: Pagination; index file; or SQLite for history

## Dependencies at Risk

- Not identified; packages use caret ranges; no known deprecated critical deps

## Missing Critical Features

- Not identified for core scope

## Test Coverage Gaps

**Server Routes:**

- What's not tested: Most API endpoints (config, history, files, github, create-project, launch-\*)
- Files: `server.js`
- Risk: Regressions in auth, validation, error paths
- Priority: Medium

**MCP HTTP Endpoint:**

- What's not tested: `/mcp` handler, tool execution via HTTP
- Files: `server.js`
- Risk: MCP integration breaks
- Priority: Medium

**Electron:**

- What's not tested: Main process, IPC, updater, data-manager
- Files: `electron/`
- Risk: Desktop-specific bugs
- Priority: Low (manual testing)

**Ollama Client:**

- What's not tested: chatStream, chatComplete, chatStructured
- Files: `lib/ollama-client.js`
- Risk: Stream parse errors, timeout handling
- Priority: Medium

---

_Concerns audit: 2026-03-14_
