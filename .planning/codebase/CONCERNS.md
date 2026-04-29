# Codebase Concerns

**Analysis Date:** 2026-04-25

---

## 1. Known Bugs Documented in Code

**Only one TODO comment found in production code:**

- File: `electron/menu.js:88`
- Comment: `// TODO: Update with actual GitHub repo URL when available`
- Impact: The About/Help menu likely links to a placeholder or missing URL. Low severity.

No FIXME, HACK, BUG, or WORKAROUND comments exist in `src/`, `lib/`, `routes/`, or `electron/` (excluding logger/debug variable names). The codebase is clean in this regard.

---

## 2. Performance Concerns

### App.jsx Monolith — Re-render Risk

**Files:** `src/App.jsx` (2,233 lines)

App.jsx declares **65 hook invocations**:

- ~40 `useState` calls covering mode, input, sidebar, settings, file browser, builder state, GitHub, toast, drag, onboarding, glossary, review, pentest, builder data, build projects/wizard/tutorial, mode palette, update banner, memories panel, image config, terminal output, and more.
- ~14 `useEffect` calls (lines 519–640+)
- 3 `useCallback` + 4 `useMemo`

Every state update that is not wrapped in `useCallback`/`useMemo` risks cascading re-renders through the entire component tree. Components like `ReviewPanel`, `SecurityPanel`, `BuildPanel`, and `FileBrowser` receive many props derived directly from App.jsx state. There is no context-splitting or reducer pattern — all state lives in one component.

**Impact:** Noticeable UI lag on slower hardware when multiple state changes occur (e.g. MCP tool list load + model resolution at chat start).

**Fix approach:** Extract related state slices into custom hooks (`useBuilderState`, `useBuildDashboard`, `useMcpConfig`) or a context/reducer. At minimum, memoize the most-passed props with `useMemo`.

---

### History List — Synchronous I/O on Every Request

**Files:** `lib/history.js:49–96` (`listConversations`), `routes/history.js:22`

`listConversations()` performs synchronous `fs.readdirSync` + `fs.readFileSync` + `fs.statSync` (and conditionally `fs.writeFileSync` + `fs.renameSync` for auto-repair) for **every JSON file** in the history directory on every `GET /api/history` request. Since the route handler is async but `listConversations` is sync, the entire event loop is blocked for the duration.

At 100 conversations this is negligible. At 1,000+ conversations (heavy users, each with large image payloads) this produces measurable latency spikes.

Additionally, `resolveConversationFilePath` (`lib/history.js:26–47`) has a **legacy O(N) scan fallback** — if a file is not found by direct `${id}.json` lookup it reads and parses every JSON file to find a matching `data.id`. This path is triggered whenever the old naming scheme is encountered.

**Fix approach:** Cache the in-memory list after first load; invalidate on write/delete. Replace the `resolveConversationFilePath` legacy scan with a one-time migration that renames mismatched files.

---

### File Tree Walker — Synchronous Recursive I/O

**Files:** `lib/file-browser.js:132–245` (`buildFileTree`), `lib/file-browser.js:321–381` (`readFolderFiles`)

Both `buildFileTree` and `readFolderFiles` use fully synchronous `fs.readdirSync` / `fs.statSync` / `fs.readFileSync` in a recursive walk. Mitigations exist (5,000-node cap at line 133, 1,500ms timeout check at line 135, 2MB total size cap) but the timeout check is a polling pattern — it only fires on the next iteration, not mid-`readdirSync`. A directory with thousands of entries will block the event loop for the full `readdirSync` call on that directory.

**Fix approach:** Use async `fs.promises.readdir` with depth-first async walking. Short term: the existing timeout + node-count caps are sufficient for typical project sizes.

---

### MCP Tool Injection — Unbounded System Prompt Growth

**Files:** `lib/tool-call-handler.js:19`, `lib/tool-call-handler.js:571–580`

`COMPACT_EXTERNAL_SERVER_TOOL_COUNT = 40` means any external MCP server with ≤40 tools emits full descriptions (up to 200 chars each + parameter lists). With 5 connected servers each contributing up to 40 tools = 200 tool lines before compaction kicks in, plus the fixed agent identity preamble (~2,000 chars), safety preamble, and session capability hints.

Current production state (from `whats-next.md`): Archon (17 tools), Google (121 tools), crawl4ai-rag (5), Stitch (12), nano banana (4) = **159 total tools**. Google triggers compaction. The other 4 servers emit full descriptions. Estimated injected token cost: ~3,000–5,000 tokens per request.

For local 7B/14B models with 8K context windows, this leaves ~3,000–5,000 tokens for actual conversation history before context overflow silently truncates earlier messages.

**Fix approach:** Add a hard per-server tool cap (e.g. 20 tools max in full mode). Surface total injected tool token count in the debug log. Allow per-server compaction threshold to be configurable.

---

### Memory `_persistToDisk` — Synchronous Write on Every Add/Update

**Files:** `lib/memory.js:204–209` (`_persistToDisk`)

Every call to `addMemory`, `updateMemory`, `deactivateMemory`, or `extractAndStore` calls `_persistToDisk()` synchronously. With 500 memories and vector embeddings (e.g. 4,096 floats per memory for nomic-embed-text = ~16KB per entry = ~8MB JSON), the `fs.writeFileSync` + `fs.renameSync` on every update will block the event loop.

**Fix approach:** Debounce `_persistToDisk` (e.g. 500ms debounce), or make it async with a write queue. The existing pid-suffixed tmp file pattern (`filePath + ".tmp." + process.pid`) is good for crash safety but does not help with blocking.

---

## 3. Scalability Limits

### History Storage — No Index, No Pagination, Full Scan on List

**Files:** `lib/history.js:49–96`, `routes/history.js:22`

`listConversations()` reads every file in full to build the sidebar list. Each conversation file can be up to 5MB+ (the 5MB warning threshold is in `saveConversation` at `lib/history.js:140`). There is no pagination — the route returns all conversations to the client on every sidebar open.

**No hard limit on conversation count exists.** The only size guard is a `console.warn` at 5MB per file.

**Fix approach:** Store a lightweight index file (`history-index.json`) with only `{id, title, mode, createdAt}` per entry. Update index on save/delete. `listConversations` reads only the index. Full content fetched on demand per conversation.

---

### Config File — Non-Atomic Writes, Dual-Writer Race

**Files:** `lib/config.js:165–167` (`saveConfig`)

`saveConfig` uses `fs.writeFileSync(CONFIG_FILE, ...)` directly — no atomic rename, no locking. Meanwhile `electron/main.js` also reads `.cc-config.json` directly at lines 243, 262, 280, 296, and 947. In Electron's architecture, the main process and the Express server (forked child process) can both call `saveConfig` concurrently. A torn write could corrupt the config file.

Contrast: `saveConversation` (`lib/history.js:146–149`) and `_persistToDisk` (`lib/memory.js:206–208`) both use correct atomic tmp→rename patterns. `saveConfig` does not.

**Fix approach:** Change `saveConfig` to write to a `.tmp` file then `fs.renameSync`. A simple `_writing` boolean guard is sufficient for single-threaded Node if concurrent saves within the server process are possible.

---

### Memory Embeddings — Unbounded File Size Due to Deactivated Entries

**Files:** `lib/memory.js:300` (500 memory cap), `lib/memory.js:423–438` (`_autoPrune`)

The 500-memory cap applies to `active` memories only. `_memories` array includes deactivated entries (`active: false`) which are not pruned — `_autoPrune` only removes `active` entries above the cap. Deactivated memories accumulate indefinitely. With large embedding vectors the `memories.json` file can grow without bound.

Additionally, there is no API to hard-delete deactivated entries. `getStats()` at line 144 returns `totalIncludingDeleted` but provides no cleanup path.

**Fix approach:** Add a `compact()` function that rewrites `_memories` to active-only entries. Expose it as `POST /api/memory/compact`. Alternatively, prune deactivated entries older than 30 days inside `_autoPrune`.

---

## 4. Electron-Specific Risks

### Security Settings — Correctly Configured

`electron/main.js:538–539`: `contextIsolation: true`, `nodeIntegration: false`. Both are correctly set. No `webSecurity: false` or `allowRunningInsecureContent` found. Navigation guard at line 685 prevents the renderer from navigating to external URLs (redirects to system browser). Assessment: no high-risk Electron security misconfigurations.

---

### IPC — `launch-ide` Passes Unvalidated `folder` Path to `exec`

**Files:** `electron/main.js:855–863`, `electron/ide-launcher.js:13–87`

The `launch-ide` IPC handler passes the `folder` argument from the renderer directly to `launchIDE(ide, folder)` without validating it is within the project directory or free of shell-special characters.

`launchIDE` builds shell commands by string interpolation:

- macOS: `` `open -a "Visual Studio Code" "${folder}"` ``
- Windows: `` `cmd /c start "" "code" "${folder}"` ``
- Linux claude-code: `` `x-terminal-emulator -e "cd '${folder}' && claude --dangerously-skip-permissions"` ``

A folder value containing shell metacharacters could execute arbitrary commands on Linux via `x-terminal-emulator`. Since `contextIsolation: true` is set, exploitation requires a compromised renderer, but the lack of sanitization is a defence-in-depth gap.

**Fix approach:** Validate `folder` with `path.resolve` + `isWithinBasePath` check against the configured project root in `electron/main.js:855` before passing to `launchIDE`. In `launchIDE`, quote-escape folder paths or switch from `exec` to `execFile` with array args for the open/cursor/windsurf cases.

---

### IPC — `terminal-write` and `terminal-resize` Accept Unvalidated Input

**Files:** `electron/main.js:998–1012`

`terminal-write` at line 1001 passes `data` directly to `pty.write(data)` with no type check or size limit. `terminal-resize` at lines 1008–1009 passes `cols` and `rows` directly to `pty.resize(cols, rows)` without validating they are positive integers within sane bounds (e.g. `cols=0` or `cols=99999` could crash `node-pty`).

**Fix approach:** Add `typeof data === 'string'` check and a max-length guard (e.g. 64KB per write) in `terminal-write`. Clamp `cols` and `rows` to `[1, 500]` in `terminal-resize`.

---

### Terminal CWD — Config Read via Sync `fs.readFileSync` in IPC Handler

**Files:** `electron/main.js:947–954`

`terminal-start` reads `.cc-config.json` from disk synchronously inside the IPC handler on every Terminal mode entry. This introduces a TOCTOU window: if `saveConfig` is executing a non-atomic write (see Section 3 above) at the same moment `terminal-start` fires, the read could get a partial/corrupt JSON.

**Fix approach:** Have the Electron main process request the current config from the Express server via a loopback API call rather than re-reading config from disk.

---

### Electron — `asar: false` Exposes All Server-Side Source

**Files:** `electron-builder.config.js:81`

`asar: false` means all packaged files (`lib/`, `routes/`, `server.js`) are readable as plain text inside the installed `.app` bundle. Proprietary logic (license validation, scoring prompts in `lib/prompts.js`) is trivially readable. This is a known trade-off documented in the config file comment.

**Fix approach:** Medium term — investigate `asarUnpack` for native modules (`node-pty`) with `asar: true` for JS sources. See BUILD.md.

---

## 5. Dependency Risks

### Three Patched Packages Requiring `patch-package`

All three patches are applied via `postinstall` → `patch-package`. If `npm install` runs without `postinstall` (e.g. `npm install --ignore-scripts`) the patches are silently skipped and the app breaks in non-obvious ways.

**`patches/officeparser+6.0.4.patch`:**

- Fixes ESM/CJS interop for `file-type` (switches `require()` → dynamic `import()`).
- Risk: If `officeparser` is upgraded past 6.0.4, the patch fails to apply. Document conversion for PPTX/ODT/RTF formats silently breaks.

**`patches/electron-updater+6.8.3.patch`:**

- Fixes GitHub API 406 error (switches from web URL JSON parse to `api.github.com` REST endpoint with correct `Accept` header).
- Risk: If `electron-updater` is upgraded past 6.8.3, the auto-updater breaks silently on update checks.

**`patches/@_davideast+stitch-mcp+0.5.1.patch`:**

- Comments out `process.exit(0)` to keep the stdio MCP proxy alive.
- Risk: If `stitch-mcp` is updated, the proxy exits after first use, breaking the Stitch MCP integration. The patch targets a line number in compiled `dist/` output.

**Fix approach:** Pin all three packages to their exact patched versions in `package.json`. Add a CI step that verifies `patch-package` applied all patches cleanly (zero rejected hunks).

---

### `uuid` Package Overridden to 14.0.0

**Files:** `package.json:114` (`"overrides": { "uuid": "14.0.0" }`)

No production code directly imports `uuid` — migration to `crypto.randomUUID()` is complete. The override exists only for transitive dependency resolution. `uuid` 14.x is not yet widely adopted; if a transitive dependency breaks with this version the failure may be hard to diagnose.

**Fix approach:** Remove the override once all transitive dependencies are confirmed compatible, or downgrade to `">=9.0.0"` which is the stable baseline.

---

### Electron 41.1.1 — Exact Version Pin

**Files:** `package.json:121` (`"electron": "41.1.1"`)

Exact pin means security patches in 41.x point releases require manual version bumps.

**Fix approach:** Use `~41.1.1` to allow patch updates, or establish a quarterly review cadence.

---

## 6. Gaps Between Docs and Implementation

### CLIPLAN.md — 3-Terminal-Call-Per-Round Cap Not Implemented

**Files:** `CLIPLAN.md:157`, `routes/chat.js`, `lib/builtin-agent-tools.js`

`CLIPLAN.md:157` specifies: "cap at 3 terminal invocations per tool-call round (reject extras with a clear tool error back to the model)." No such cap exists anywhere in `routes/chat.js` or `lib/builtin-agent-tools.js`.

Contrast: `lib/builtin-agent-tools.js:643` implements a max-1-browser-tool-per-round guard for `builtin.browse_url`, but no equivalent for `run_terminal_cmd`.

**Impact:** An agent that emits 10 `run_terminal_cmd` calls in one response executes all 10 sequentially without rejection.

**Fix approach:** In `routes/chat.js`, count `run_terminal_cmd` calls in the current round before execution; reject extras beyond 3 with a structured tool error.

---

### VOICE-DICTATION-PLAN.md — ValidatePanel and ReviewPanel Missing DictateButton

**Files:** `docs/VOICE-DICTATION-PLAN.md`, `src/components/ValidatePanel.jsx` (no DictateButton import), `src/components/ReviewPanel.jsx` (no DictateButton import)

The voice dictation plan targeted all text fields. `DictateButton` is wired in: `App.jsx` (chat input), `SecurityPanel.jsx`, `BuildWizard.jsx`, `CreateWizard.jsx`, `builders/BaseBuilderPanel.jsx`. Not wired in: `ValidatePanel.jsx` and `ReviewPanel.jsx`. If those panels have free-text input fields, they are missing dictation support.

---

### TERMINALFEATURE.md Testing Checklist — All Items Unchecked

**Files:** `docs/TERMINALFEATURE.md:58–67`

All 8 checklist items remain `- [ ]`. The implementation matches the spec. The unchecked state is a QA process gap, not a code bug, but these checks should be run before each desktop release.

---

### IDE_COMMANDS — Not Listed in electron-builder.config.js

**Files:** `electron-builder.config.js:82–116`, `lib/build-scaffolder.js:494–497`

`build-scaffolder.js:497` resolves `IDE_COMMANDS` as `path.join(__dirname, "..", "IDE_COMMANDS")` (app root). The `electron-builder.config.js` `files` array does not include `"IDE_COMMANDS/**/*"`. The directory exists at the repo root (`IDE_COMMANDS/` with 10+ command files) but is not packaged in the Electron build.

In packaged installs, `build-scaffolder.js` silently falls through to the template path fallback. IDE command files (`.claude/commands/`, `.cursor/commands/`, etc.) are not copied into new Build-mode projects when running from the installed `.app`.

**Impact:** Users of the packaged desktop app who create projects via Build mode do not get IDE command files pre-populated.

**Fix approach:** Add `"IDE_COMMANDS/**/*"` to the `files` array in `electron-builder.config.js`.

---

## 7. Planned but Not Yet Implemented

### Phase 27 — Deferred Indefinitely

**Files:** `.planning/STATE.md:24,28`

Phase 27 is explicitly deferred with no timeline. `.planning/STATE.md:24` notes it under "Phase 27 remains deferred." The specific feature set is not surfaced in accessible planning documents.

---

### MCP Parallel Tool Execution — Gated Off by Default, No UI Toggle

**Files:** `routes/chat.js:761`, `lib/config.js:116–117`

`toolExec.parallel` defaults to `false` (`lib/config.js:117`: `parallel: false, // default off for initial rollout`). The full segmentation and bounded-concurrency execution machinery is implemented and tested (`lib/tool-call-handler.js:702–738`, `routes/chat.js:763–868`) but is unreachable without manually editing `.cc-config.json` to set `toolExec.parallel: true`. There is no UI toggle in SettingsPanel.

**Fix approach:** Add a toggle in SettingsPanel (MCP Clients tab or General tab): "Parallel tool execution (experimental)". Write to `toolExec.parallel` via `PUT /api/config`.

---

## 8. Missing Rate Limiting

### `/api/validate/*` — No Specific Rate Limit

**Files:** `lib/rate-limiters-config.js` (no `/api/validate` entry), `routes/validate.js`

`POST /api/validate/scan` and `POST /api/validate/generate` trigger filesystem scans and AI generation respectively. Neither has a specific rate limit — they fall only under the global `API_GLOBAL_RATE_MAX = 300` requests/minute.

**Fix approach:** Add `mount("/api/validate/scan", { name: "validate-scan", max: 10, ... })` and similarly for `/api/validate/generate` in `lib/rate-limiters-config.js`.

---

## 9. Test Coverage Gaps

### `launch-ide` IPC — No Path Injection Test

**Files:** `electron/main.js:855`, `electron/ide-launcher.js`

No test covers the `launch-ide` IPC handler with a malformed `folder` argument containing shell metacharacters.

---

### History Performance — No Load Test for Large History

**Files:** `lib/history.js`, `tests/unit/` (no history scale test)

No test validates performance of `listConversations` under load (e.g. 500+ files). The legacy O(N) scan path in `resolveConversationFilePath` has no regression test.

---

### `terminal-resize` — No Bounds Test

**Files:** `electron/main.js:1004–1012`, `tests/`

No test verifies that `terminal-resize` handles out-of-range `cols`/`rows` values gracefully without crashing `node-pty`.

---

_Concerns audit: 2026-04-25_
