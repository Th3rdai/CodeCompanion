# Changelog

All notable changes to Code Companion will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **Experiment mode** — New **Experiment** app mode (under **More → Analyze**) for bounded hypothesis → change → measure loops: `POST /api/experiment/start`, `POST /api/experiment/:id/step` (SSE, reuses `lib/chat-post-handler.js` with `mode: "experiment"`), `GET /api/experiment/:id`, `GET /api/experiment/:id/events`, `POST /api/experiment/:id/note-step`. Runs are stored under **`${CC_DATA_DIR}/experiments/`** (`lib/experiment-store.js`). **Settings → General** toggles **`experimentMode.enabled`** (default **on**) and caps **`maxRounds` / `maxDurationSec`**. Chat tool policy: when `mode === "experiment"`, MCP tools are hidden/blocked and only builtins `write_file`, `run_terminal_cmd`, `validate_scan_project`, `validate_generate_command`, `view_pdf_pages` execute (`lib/tool-call-handler.js`). **`SYSTEM_PROMPTS.experiment`** in `lib/prompts.js`. Auto-model map includes **`experiment`**. Tests: `tests/unit/experiment-store.test.js`, `tests/unit/prompts-experiment.test.js`, `tests/unit/tool-call-handler-experiment.test.js`, `tests/integration/experiment-api.test.js`, `tests/e2e/experiment-mode.spec.js`.

## [1.6.21] — 2026-04-30

### Fixed

- **Auto-update no longer stuck in "Restart to apply" loop on signature mismatch** — When the auto-updater downloaded a new release whose code-signature designated requirement didn't match the running app's, Squirrel.Mac silently failed to swap the bundle and the app relaunched on the OLD version. The renderer kept showing "Restart to apply" because `lastDownloadedInfo` was never cleared and the same version was found again on next check, looping indefinitely. Three pieces now break the loop: (1) `electron/updater.js` persists `dataDir/.update-attempt.json` before `quitAndInstall()`; on the next launch, if the running version still differs from the recorded target, the loop guard suppresses the restart prompt for that version; (2) the `error` event now traps Squirrel's "code signature ... did not pass validation" / "code requirement(s)" strings via a new `isCodeSignatureError` helper and forwards an `update-error` IPC event with `{ kind: "code-signature", targetVersion, runningVersion, message }`; (3) `SettingsPanel` subscribes to `update-error` and renders the existing `error` state with a clear "install manually from GitHub Releases" message. 10 new unit tests cover the helpers.
- **Agent terminal denials now carry an actionable `ACTION:` line** — Previously the model received `Command denied: <reason>` and often summarized to the user as "undefined error" or kept retrying the same denied shape. `validateCommand` now also returns an `action` string per deny path; the deny payload to the model becomes `Command denied: <reason>\nACTION: <next step>`. Allowlist miss → `Tell the user verbatim "Add 'X' to Settings → Agent Terminal → Allowlist"`. Metacharacter hit → `run_terminal_cmd executes a single binary via spawn() — there is NO shell. Re-run as a single binary; pass cwd as a tool arg`. Blocklist hit → `security policy ... do not retry`. Plus terminal-disabled / no-project-folder / empty-allowlist actions.
- **Agent terminal `&&` and `||` chaining now denied consistently with `;`, `|`, redirects** — `METACHAR_PATTERN` extended to include `&&` and `||`. Previously these slipped past the metacharacter guard, letting `cd path && cmd` partially execute (spawning `cd` with confusing args) while `cmd1; cmd2` and `cmd | grep` were properly denied. Now any shell-feature chaining is denied uniformly with the same actionable hint to use the `cwd` tool argument instead of `cd path && ...`.
- **Agent prompt: never report "undefined" / "unknown" terminal errors** — `BUILTIN_SAFETY_PREAMBLE_TERMINAL` extended with explicit "NEVER report 'undefined error' / 'unknown error' / 'the terminal failed' to the user — every deny starts with literal `Command denied:` followed by the exact reason. Quote it. If allowlist miss, name the command to add."

## [1.6.20] — 2026-04-30

### Fixed

- **Chat now explains when it stops at the tool-call round limit** — Previously, if the agent exhausted its `agentMaxRounds` budget without producing a final reply (often because the model burned rounds on denied compound shell commands like `cmd | grep`, `a && b`), the finalizer summarized from accumulated tool results into a short, unexplained message. From the user side, the chat just stopped. Now: (1) when the loop exits without final text the route sends a new `notice: { kind: "round_limit", rounds, message }` SSE event, (2) `useChat` renders it as a visible `> ⚠️ ...` blockquote above the partial answer, (3) the finalizer prompt is told to lead with one sentence acknowledging the limit hit and to name a couple of denied calls if any. Default `agentMaxRounds` raised 10 → 15 for headroom (UI slider still ranges to the server's 25 cap).

## [1.6.19] — 2026-04-29

### Fixed

- **File Browser `+AI` quick-attach silently failed for files outside `chatFolder`** — Clicking the per-row `+AI` button (or the "Attach to Chat" preview button) appeared to do nothing when the FileBrowser was navigated to a folder different from your saved `chatFolder` (e.g. `chatFolder` is a Google Drive sync folder but you're browsing a project folder). Three issues combined: (1) `/api/files/read` defaulted its `folder` query to `cfg.chatFolder` when the param was omitted, so reads of files under `cfg.projectFolder` returned 403 "Access denied"; (2) `handleQuickAttach` and `handleFileClick` never sent `folder=tree.root` even though the FileBrowser knows which folder it's displaying; (3) `catch {}` wrapped the fetches and there was no `res.ok` check, so the 403 was silently dropped — no toast, no console error, click looked like a no-op. Now: (1) the FileBrowser sends `folder=tree.root` for `read`, `read-raw`, and convertible-document attach paths; (2) errors are surfaced via `onToast` (`"Access denied"`, `"File not found"`, `"Could not reach server"`); (3) `routes/files.js` adds `cfg.chatFolder` to the explicit-folder allowlist alongside `cfg.projectFolder` and the repo root. Path-traversal protection is unchanged.

## [1.6.18] — 2026-04-29

### Fixed

- **File Browser per-row `+AI` attach button always visible** — The button used `opacity-0 group-hover:opacity-100`, leaving it invisible until you hovered the specific row, with no visual cue that hovering would reveal it. Several users reported the button as "gone." Now `opacity-70 group-hover:opacity-100` so it's always visible and brightens on hover. No behavior change to the click handler — just discoverability.

## [1.6.17] — 2026-04-29

### Changed

- **Chat fetch timeout default raised to 10 min** — `chatTimeoutSec` default in `lib/config.js` and the fallback in `routes/chat.js` raised from 120s → 600s; `chatComplete` and `chatStructured` defaults in `lib/ollama-client.js` raised from 120 000ms → 600 000ms; `.cc-config.json.example` updated to match. Existing user configs still take precedence — only fresh installs see the new default. Fixes the 5-minute `fetch failed` hang seen with large local models (e.g. `qwen3-coder:30b`) under big contexts and tool-call rounds.
- **Terminal CWD follows the active File Browser folder** — When opening Terminal mode, the renderer now passes its current folder (`chatFolder || projectFolder`) into `terminal-start`. The main process validates the path is an existing directory before honoring it; falls back to `cfg.chatFolder` → `cfg.projectFolder` → `$HOME`. Changing the File Browser folder respawns the PTY at the new location. Previously the terminal always read `cfg.projectFolder` from disk and ignored in-app navigation.
- **Build mode `next-action` honors `chatTimeoutSec`** — `routes/build.js` was hardcoding a 30-second timeout on its `chatComplete` call. Local models on CPU/MPS routinely round-tripped past that, surfacing as `next-action failed: This operation was aborted`. Now uses `(config.chatTimeoutSec || 600) * 1000` so the Build flow inherits the same long-form budget the chat path uses.
- **Agent terminal preamble (`BUILTIN_SAFETY_PREAMBLE_TERMINAL`)** — Strengthened with explicit "single binary via spawn — no shell" guidance, "stop after two same-shape denials" rule, macOS/Linux Python guidance (`python3`/`pip3` over `python`/`pip`; multi-statement Python via `write_file` + run, not `python -c`), and instructions to install Python deps before retrying scripts that fail with `ImportError`.

### Fixed

- **Agent terminal blocklist false positive on substring match** — `validateCommand` was using `fullCmd.toLowerCase().includes(blocked)` for blocklist matching. With the default blocklist `["sudo","su","rm -rf","chmod 777","mkfs","dd"]`, this wrongly blocked benign commands like `python3 -c "import sys; print('Import successful')"` because the literal string `"successful"` contains `"su"` as a substring. Switched to a word-boundary regex (`commandContainsBlockedToken`): blocklist tokens only match at start/end of the command line or surrounded by whitespace. Genuine threats (`sudo apt`, `rm -rf /tmp`, `dd if=/dev/zero`) still block; false positives (`successful`, `pseudo`, `add`, `mkdir`, paths containing `Users`) no longer do. 7 new unit tests cover the regression.

- **Sidebar `Invalid Date` history rows** — Conversation timestamps are now normalized end-to-end: `createdAt` is validated in `useChat` before save, malformed history rows are auto-repaired in `lib/history.js`, and sidebar rendering now has a safe date fallback.
- **Playwright/browser tool-call deflection** — Strengthened agent tool prompt + chat capability lead-ins so browser automation requests use MCP `browser_*` tools directly instead of returning advisory “I can’t run this here” responses.
- **Browser-vs-terminal tool precedence** — Added explicit AGENT BROWSER guidance when both terminal and browser tools are available so website navigation/snapshot tasks prefer Playwright tools over terminal-script suggestions.
- **Server-side browser refusal fallback** — Chat tool loop now detects browser-execution refusal patterns (when browser tools are available), injects a corrective instruction, and retries once to recover into actual `TOOL_CALL` execution.
- **Snapshot-call consistency for browser automation** — When the user explicitly asks for a snapshot/screenshot and the model emits browser actions without `browser_snapshot`, the chat route now appends a snapshot call before execution so navigate+snapshot behavior is consistent.
- **Minimax parameter-style tool-call parsing** — Tool-call handler now parses `<minimax:tool_call><invoke ...><parameter ...>` format, fixing mixed prompt rounds that previously failed to execute browser/terminal tools from that output shape.
- **File Browser loading hangs** — Added bounded file-tree scanning guardrails (`max scan ms`, `max nodes`, `max entries/dir`, symlink skip) and frontend request timeouts with a clear timeout error instead of indefinite loading states.
- **Nano Banana image-call reliability** — MCP image generation now uses a dedicated timeout path (`MCP_IMAGE_TOOL_TIMEOUT_MS`, default `180000`) and timeout-aware retry classification/hints; call-start logs now include `timeoutMs` for easier call correlation.
- **Generated image actions in chat** — Restored inline **Copy** and **Download** controls for assistant-generated images by preserving tool-image payloads on assistant messages and rendering per-image action buttons in chat history.
- **False image-success claims in chat** — Assistant text that says an image was generated is now filtered unless a real `toolImage` payload is present, preventing “Generated image…” messages when no image was actually returned.

### Changed

- **Installed desktop app refreshed** — Local `/Applications/Code Companion.app` has been rebuilt/reinstalled with the above fixes so runtime behavior matches current workspace code.

---

## [1.6.5] — 2026-04-09

### Fixed

- **Packaged app startup crash (all v1.6.x installs)** — `routes/` directory was missing from `electron-builder.config.js`. The Phase 24.5 server.js refactor (v1.6.0) extracted 16 Express route modules into `routes/` but the packaging config was never updated. Every packaged install from v1.6.0–v1.6.4 crashed at startup with `code=1, signal=null` when `server.js` tried to `require('./routes/...')`. v1.5.27 and earlier were unaffected (predated the refactor).

### Added

- **CI server smoke test** — New `smoke-test` job in `.github/workflows/build.yml` spawns `node server.js` and verifies it binds to a port before any platform build runs (`needs: smoke-test`). Catches missing runtime directories before a broken installer ships. Also runnable locally: `node scripts/smoke-test-server.js`.
- **Packaging rule documented** — `BUILD.md`, `docs/RELEASES-AND-UPDATES.md`, and `CLAUDE.md` now explicitly warn that new top-level runtime directories must be added to the `files` array in `electron-builder.config.js`.

---

## [1.6.4] — 2026-04-09

### Changed

- **Tool call ordering fixed** — Parallel tool execution now uses order-preserving window segmentation. Previously all safe tools ran first then all risky tools, which could execute a write before a preceding read in mixed-call rounds. Now the original call order is always respected: contiguous safe calls run in parallel, risky calls run in-place as serial checkpoints.

---

## [1.6.3] — 2026-04-09

### Added

- **Intel Mac (x64) installer** — CI now builds a native x64 DMG on `macos-13` for Intel Mac users; ARM64 build remains the primary with the auto-update feed.

### Fixed

- **Startup log includes app version** — The `code-companion-startup.log` emergency file now records the app version at launch, making crash reports immediately identifiable.

---

## [1.6.2] — 2026-04-08

### Fixed

- **Server crash on startup** — Added `tslib` to production dependencies. `pdfkit` → `fontkit` → `@swc/helpers` requires `tslib` as a peer dependency; its absence caused "Cannot find module 'tslib'" on fresh installs.

---

## [1.6.1] — 2026-04-08

### Fixed

- **Download page URL** — "Open download page" in Settings now correctly links to `github.com/Th3rdai/CodeCompanion/releases/latest` (was pointing to the old `3rdAI-admin` org).

---

## [1.6.0] — 2026-04-08

### Added

- **Phase 24.5 Tech Health** — Major structural refactor improving long-term maintainability:
  - **Hook extraction** (`src/hooks/`): `useModels.js`, `useChat.js`, `useImageAttachments.js` extracted from `App.jsx`; App.jsx reduced from 2,954 → 1,873 lines.
  - **Route decomposition**: 15 Express router factory modules created under `routes/`; `server.js` reduced from 5,169 → 507 lines. Router factory pattern: each module exports `createRouter(appContext)`.
  - **ESLint baseline**: `eslint.config.mjs` established at 0 errors / 148 warnings; test consolidation under `tests/unit/`.
- **Streaming terminal SSE** — Agent `run_terminal_cmd` now streams live output during execution. New SSE events: `terminalCmd` (command start), `terminalOutput` (live chunks), `terminalStatus` (exit/timeout). The in-chat terminal indicator shows real-time output with status icons (running/done/error/timeout).
- **Confirm-before-run modal** (`ConfirmRunModal.jsx`) — When `agentTerminal.confirmBeforeRun` is enabled in Settings, the AI agent pauses before executing each command and presents an Allow/Deny modal. Unacknowledged confirmations auto-deny after 60 seconds. New `POST /api/chat/confirm` endpoint handles responses.
- **Agent terminal audit logging** (`lib/terminal-audit.js`) — Append-only JSON-lines log at `${CC_DATA_DIR}/logs/terminal-audit.log`. Records every command invocation (denied/spawn-error/executed) with timestamp, command, args, cwd, exit code, duration, and truncation status.
- **Draggable modals** — `ImagePrivacyWarning`, `JargonGlossary`, `OllamaSetup`, and `RenameModal` all support pointer-drag repositioning with viewport clamping.
- **Mac codesign identity normalizer** (`lib/mac-codesign-identity.js`) — Strips the `"Developer ID Application:"` prefix from `MAC_CODESIGN_IDENTITY` so both bare Team ID and full certificate name forms work with `electron-builder`.

### Fixed

- **Stale-asset caching** — `sendSpaIndexHtml` now sends `Cache-Control: no-cache, no-store, must-revalidate`; SPA fallback returns 404 (not `index.html`) for paths with file extensions or under `/assets/`. Eliminates blank-page on first load after upgrade.
- **`routes/convert.js` mounting** — Route module was created but never mounted; orphaned inline handler removed from `server.js`.
- **Atomic history writes** — `lib/history.js` now uses a tmp-file + rename pattern to prevent partial writes on crash.

### Tests

- 184 unit tests pass (added: `terminal-audit.test.js`, `mac-codesign-identity.test.js`).
- 3 new Playwright E2E scenarios: agent terminal enable/disable, allowlist deny, happy-path execution.

---

## [1.5.27] — 2026-04-05

### Fixed

- **Auto-updater**: `electron-builder.config.js` publish `owner` corrected from `3rdAI-admin` to `Th3rdai` — installed apps were checking the private mirror repo and receiving 404 on `releases.atom`. In-app **Check for updates** now resolves correctly.

---

## [1.5.26] — 2026-04-04

### Added

- **Integrated Terminal mode** — New **Terminal** mode in the sidebar spawns a full interactive PTY shell (`node-pty`) inside the Electron app via IPC. Renders with `xterm.js` (`@xterm/xterm` + `@xterm/addon-fit`). Shell CWD is read from `.cc-config.json` project folder in `electron/main.js` (never from renderer). One PTY per window; killed on window close. Browser users see a "desktop app only" empty state. See [`docs/TERMINALFEATURE.md`](docs/TERMINALFEATURE.md).
- **`docs/TERMINALFEATURE.md`** — Living spec: architecture diagram, security model, Agent terminal comparison table, testing checklist.

### Fixed

- **Electron `loadURL` HTTPS protocol** — All `mainWindow.loadURL()` calls now detect whether the Express server uses HTTPS (same cert-file check as `server.js`) and use the correct protocol. Previously, using `http://` against an HTTPS server caused `ERR_EMPTY_RESPONSE` / blank window.
- **Self-signed cert acceptance** — Added `certificate-error` handler in `electron/main.js` to accept the self-signed localhost cert without a browser warning page.
- **xterm.js UTF-8 encoding** — PTY output (base64-decoded binary string) is now converted to `Uint8Array` before `term.write()` so multi-byte UTF-8 sequences (box-drawing characters, emoji, CJK) render correctly instead of as garbled Latin-1.
- **Mode tabs second row clipped** — Removed `overflow-hidden` from the mode tabs bar; `FloatingGeometry` is already `position: absolute` and self-contained so the clip wasn't needed. Second row of mode buttons now fully visible.
- **Terminal mode layout** — Changed `TerminalPanel` outer container from `h-full` to `flex-1 min-h-0` so it participates correctly in the flex column layout without pushing the mode tabs off-screen.
- **Chat input hidden in Terminal mode** — The chat textarea and toolbar are now hidden when Terminal mode is active (consistent with Create, Build, Review).

---

## [1.5.19] — 2026-03-30

### Added

- **CRE8 framework integration** — Create mode now scaffolds CRE8 workflow files: `PRPs/`, `examples/`, `journal/`, PRP templates (`prp_base.md`, `prd_base.md`), 12 CRE8 command files across all 5 IDE paths, and `INITIAL.md` pre-populated with wizard data. New **"Generate Execution Plan"** button on the success screen auto-sends the `generate-prp.md` prompt to chat, producing a full PRP immediately after project creation.
- **`GET /api/cre8/prp-prompt`** — Returns CRE8 `generate-prp.md` content for chat pre-fill.

### Fixed

- **Claude Code launch** — "Open in Claude Code" now runs `claude` CLI in a new Terminal tab via AppleScript instead of just opening Terminal in the folder.

---

## [1.5.24] — 2026-04-04

### Added

- **Agent Validate builtins (Phase 25)** — Chat agent can now scan any project folder and generate a phased `validate.md` command file directly from chat, using the same `lib/validate.js` pipeline as Validate mode. Two new builtin tools: `validate_scan_project` (discover linters, type checkers, test runners, CI configs) and `validate_generate_command` (scan + AI generation in one step, optional save to project folder). Both are gated by `agentValidate.enabled` (default on) and path-scoped to the configured project folder.
- **Agent Planner scoring (Phase 26)** — Chat agent can score implementation plans with the same AI pipeline as Planner mode. New builtin tool `score_plan` returns letter grades (A–F) for Clarity, Feasibility, Completeness, and Structure, plus an overall grade and improvement suggestions. Accepts pre-built markdown or structured fields (planName, goal, steps, scope, dependencies, testing, risks). Gated by `agentPlanner.enabled` (default on).
- **Agent identity override** — Injected prompt block explicitly forbids teacher-deflection phrases ("you'll need to run this yourself", "you are the one holding the keyboard", etc.) so the model correctly acts as an agent with real execution tools rather than an advisory chatbot.
- **Configurable agent max rounds** — Chat toolbar "Rounds" picker (1/3/5/10/15/20/25, default 10) lets users control how many tool-call iterations the agent can run per message. Server enforces a cap of 25 (min 1). Replaces the previous hardcoded limit of 5, enabling the agent to autonomously write code, run tests, fix failures, and install dependencies in one turn.

### Planning

- **Agent first-party capabilities** — [`docs/AGENT-APP-CAPABILITIES-ROADMAP.md`](docs/AGENT-APP-CAPABILITIES-ROADMAP.md) promoted to [`.planning/ROADMAP.md`](.planning/ROADMAP.md) as **Phases 25–27** (Validate / Planner / optional GSD builtins from chat). Pointers added in README, CLAUDE.md, `whats-next.md`, STATE.

---

## [1.5.21] — 2026-04-04

### Security

- **Electron 41.0.2 → 41.1.1** — Fixes HTTP Response Header Injection in custom protocol handlers (GHSA-4p4r-m79c-wq3v) and use-after-free in offscreen shared texture release callback (GHSA-8x5q-pvf5-64mp).
- **`lodash-es` override `>=4.18.1`** — Forces mermaid → langium → chevrotain dependency chain off vulnerable `<=4.17.23` range; fixes Code Injection via `_.template` (GHSA-r5fr-rjxr-66jc) and Prototype Pollution via `_.unset`/`_.omit` (GHSA-f23m-r3pf-42rh) without downgrading mermaid.
- **`@xmldom/xmldom` → `>=0.8.12`** — Fixes XML injection via unsafe CDATA serialization (GHSA-wh4c-j3r5-mjhp).
- **`lodash` (direct)** — Upgraded via `npm audit fix`; same CVEs as lodash-es above.
- **`npm audit`** — 0 vulnerabilities.

---

## [1.5.20] — 2026-04-04

### Added

- **`builtin.view_pdf_pages` tool** — Renders PDF pages as images via `pdftoppm` (poppler) so the vision model can analyze diagrams, network maps, charts, and screenshots. Tool result images are fed directly into the next Ollama call rather than streamed to the client. Requires `poppler` (`brew install poppler`).
- **Auto model per mode** — Toolbar option **Auto (best per mode)**; server resolves via **`lib/auto-model.js`** + **`autoModelMap`** in **`.cc-config.json`**; Settings → **Auto model map**; SSE **`resolvedModel`** on chat. Applies to review, pentest, score, validate, build APIs, git review, tutorial suggestions, memory extraction.
- **`scripts/clean-artifacts.sh`** — Removes **`release/`**, **`dist/`**, and Playwright output dirs; optional **`--with-gitnexus`** to drop **`.gitnexus/`** before re-indexing. Documented in **[BUILD.md](BUILD.md)**.
- **`npm run test:integration`** — Runs **`tests/integration/api-with-images.test.js`** (spawned server; chat/review/pentest/remediate). Documented in **[docs/TESTING.md](docs/TESTING.md)**.
- **Image lightbox** — Click any image in chat to preview full-size in a modal overlay; `Escape` or click backdrop to close.
- **Tool parameter schemas in system prompt** — MCP tool descriptions now include required params, types, and enum values. Compact format keeps prompt at ~8.5 KB (was 23.7 KB).
- **Image revision flow** — `IMAGE_DELIVERED` marker in tool results instructs models to re-call `generate_image` for revisions instead of hallucinating fake image markdown.
- **Batch conversation delete** — `POST /api/history/batch-delete` for single-request bulk deletion.
- **GitHub clone destination picker** — **Clone to folder** field in the clone URL section.

### Changed

- **Tool context persistence across turns** — After each tool-call round, server emits a `toolContextMessages` SSE event with text-only tool context. Client saves these with `_toolContext: true` into conversation history so the model retains which file/resource it was working on across follow-up queries. Hidden from chat UI and exports.
- **Per-conversation isolation** — `_toolContext` flag preserved in `postBody.messages` so server strips it before Ollama; memory retrieval scoped by `conversationId`; `searchMemories` filters by `source` so unrelated conversations are not mixed.
- **Agent terminal system prompt (TERMINALFIX)** — Builtin safety preamble and **AGENT TERMINAL** line only injected when `builtin.run_terminal_cmd` is advertised for the session (`lib/builtin-agent-tools.js`, `lib/tool-call-handler.js`).
- **Chat latency** — `listModels` short-TTL cache; parallel auto-model + memory embedding on `POST /api/chat`; cached project file-list snippet; `requestAnimationFrame` batching for streaming tokens.
- **`/api/convert-document`** — Added to 50 MB body-limit whitelist (was capped at 5 MB by global middleware, blocking PDFs over ~3.7 MB).

### Fixed

- **`previousSessionPrompt` ReferenceError** — Variable was referenced but never declared in the `clientHasSystem` branch (deep-dive review mode). Removed.
- **npm transitive dependencies** — `npm audit fix` updates **brace-expansion**, **path-to-regexp**, and **picomatch** (via lockfile) to clear Dependabot-reported moderate/high advisories.
- **Playwright E2E** — Duplicate image upload test awaits `dialog` before `dismiss()` so async `confirm()` does not race the test end.
- **MCP image generation** — Hallucination stripping after `TOOL_CALL:` patterns; base64 context bloat prevention; `const` reassignment crash fix.
- **Tool-call system prompt** — Instructs models to STOP after `TOOL_CALL:` lines and never fabricate results.
- **Auto-model vision fallback** — `preferVision` now only triggers when the **current** message has images, not historical ones.
- **Historical image arrays causing 400 errors** — Strips `images` from older messages before sending to non-vision models.

### Documentation

- **`docs/TESTING.md`**, **`docs/INSTALL-MAC.md`**, **`docs/TROUBLESHOOTING.md`**, **`docs/ENVIRONMENT_VARIABLES.md`** — Updated for new features and current version.
- **`TERMINALFIX.md`** / **`docs/TERMINALFIX-plan-review.md`** — Documents terminal prompt alignment design and plan review.

---

## [1.5.14] - 2026-03-27

### Added

- **Desktop release pipeline** — Per-platform CI checks that **`release/`** contains **`latest-mac.yml`** / **`latest.yml`** / Linux feeds before upload; release job verifies **`GITHUB_REPOSITORY`** matches **`electron-builder.config.js`** `publish` (prevents fork-only releases while the app updates from **th3rdai/CodeCompanion**); **`fail_on_unmatched_files`** on **`softprops/action-gh-release`**; scripts **`verify-release-output.js`**, **`verify-ci-repo-matches-publish.js`**.
- **`package.json`** — **`repository`** URL for **`github.com/th3rdai/CodeCompanion`**.
- **Electron — View → Go to app home** (⌥⌘H on macOS, Ctrl+Shift+H on Windows/Linux) reloads the local app URL if navigation ever gets stuck.

### Changed

- **Settings → Software Updates (Electron)** — Plain-language status and error text; always-visible **Open download page** (official releases URL in `src/lib/release-urls.js`); IPC **`open-external-url`** for safe browser handoff. Browser-only section links the same download page instead of dev jargon.
- **`electron-builder.config.js`** — Explicit **`publish.publishAutoUpdate: true`** so updater YAML is always written to **`release/`**.
- **Electron** — **`will-navigate`** keeps the main window on the app (`file://` splash, `http(s)://localhost|127.0.0.1` on the app port); other **`http(s)`** and **`mailto:`** / **`tel:`** open in the system browser. **`setWindowOpenHandler`** continues to send **`target=_blank`** / **`window.open`** to the browser.
- **Chat markdown** — Off-origin **`http(s)`** links open in the default browser (or Electron **`openExternal`**); DOMPurify strips **`iframe`**, **`frame`**, **`object`**, **`embed`**; external links get **`target="_blank"`** / **`rel="noopener noreferrer"`** when appropriate.

### Documentation

- **AGENTS.md** / **CLAUDE.md** — GitNexus index stats refreshed.

---

## [1.5.5] - 2026-03-22

### Fixed

- **Auto-update (404)** — Set **`artifactName`** in **`electron-builder.config.js`** to **`${name}-${version}-${arch}.${ext}`** (uses npm `name`, no spaces) so **`latest-mac.yml`** / **`latest.yml`** URLs match GitHub Release asset filenames. v1.5.4 published **`Code-Companion-…`** in YAML while assets were **`Code.Companion-…`**, causing updater downloads to 404.

---

## [1.5.4] - 2026-03-20

### Changed

- **File Browser** — **Claude Code** is the primary full-width launch control; VS Code, Cursor, Windsurf, and OpenCode are in a compact row above it.

---

## [1.5.3] - 2026-03-24

### Fixed

- **Install & release docs** — macOS app data path documented as **`~/Library/Application Support/code-companion/`** (matches Electron `userData` from package `name`); Windows CLI examples use the default NSIS location **`%LOCALAPPDATA%\Programs\Code Companion\`**; **BUILD.md** / **docs/RELEASES-AND-UPDATES.md** use current Software Updates control names.
- **Software Updates (Electron)** — After an update is found, **Download update** runs `autoUpdater.downloadUpdate()`; **get-update-state** syncs “ready to restart” if Settings opens after a background download (`electron/updater.js`, `electron/preload.js`, `SettingsPanel.jsx`).

### Added

- **Tests** — `tests/unit/build-file-ops.test.js` integration tests for **`/api/build/projects/:id/files/:filename`** (whitelist, traversal, atomic write).
- **Stop / Escape** — In-flight **AbortSignal** for Review, Security, Validate, and builder flows; **Stop** control + global **Escape** runs chat stop + `abortAll()` (`useAbortable`, `useAbortRegistry`, `StopButton`).

---

## [1.5.2] - 2026-03-22

### Security

- **CSP** — Per-request **nonces** for `script-src` (no `unsafe-inline` for scripts); SPA `index.html` served with matching nonces.
- **API errors** — Generic **5xx** / SSE messages via `lib/client-errors.js` (details server-side only).
- **SCA** — CI runs **`npm audit --audit-level=critical`** (`.github/workflows/ci.yml`).
- **GitHub** — **`validateTokenCached`** reduces repeated GitHub `/user` calls from Settings.

### Changed

- **Tags & remotes** — `v1.5.2` aligned with `master` on **origin** and **th3rdai**; installers follow **th3rdai/CodeCompanion** (`electron-builder` publish target).

---

## [1.5.1] - 2026-03-22

### Changed

- **Desktop installers rebuilt** — macOS (DMG/ZIP), Windows x64 (NSIS/ZIP), Linux x64 (AppImage/ZIP) from current `main` (Vite + Electron).

### Added

- **Chat Stop** — abort in-flight `/api/chat` (streaming + agent tool rounds); server aborts Ollama via `AbortSignal`.
- **Toolbar Export** — 11 output formats via `office-generator` + `POST /api/generate-office`.
- **Claude Code automation** — `.claude/` skills, agents, hooks (sensitive-file guard, unit tests on `lib/`/`server.js`/`mcp/` edits); see `docs/CLAUDE-CODE-AUTOMATION.md`.
- **`electron-updater` patch** — GitHub API for `getLatestTagName` + `allowPrerelease` for prerelease-only feeds (`patches/electron-updater+*.patch`).

### Fixed

- GitHub **406** on updater check when using web `releases/latest` JSON URL (patched upstream provider via `patch-package`).

---

## [1.5.0] - 2026-03-17

### Added - Image & Vision Model Support 🖼️

**Major Feature**: Complete image upload and vision model integration across Code Companion.

#### Core Features

- **Image uploads** via drag-and-drop, file picker, or clipboard paste (Cmd+V / Ctrl+V)
- **Vision model support** for llava, bakllava, minicpm-v, and other Ollama vision models
- **Automatic security hardening**:
  - EXIF metadata stripping (GPS coordinates, timestamps, camera info)
  - Embedded script destruction via canvas re-encoding
  - MIME type whitelist (PNG, JPEG, GIF only - SVG rejected)
- **Smart image processing**:
  - Auto-resize to 2048px max dimension (configurable)
  - Multi-step downscaling for quality preservation
  - Thumbnail generation (128x128px)
  - Compression (configurable quality 50%-100%, default 90%)
- **Duplicate detection** via SHA-256 hashing with user confirmation
- **Gallery viewer** with lightbox, zoom, pan, download, navigation
- **Privacy warning** modal on first upload (dismissible, localStorage-persisted)
- **Real-time processing indicator** showing active image count

#### Mode Integration

- **Chat mode**: Upload screenshots, diagrams, error messages alongside text
- **Review mode**: Attach bug screenshots with code for visual evidence
- **Security mode**: Include error logs and configuration screenshots for context

#### Vision Model Detection

- Real-time detection when images attached with non-vision model
- Warning banner with "Switch to vision model" and "Remove images" quick actions
- Send button disabled until conflict resolved
- Vision model badges (👁️) in model dropdown and settings

#### Settings & Configuration

New "Image Support" settings panel:

- Enable/disable image uploads toggle
- Max file size slider (1-50 MB, default 25MB)
- Max images per message (1-20, default 10)
- Compression quality slider (50%-100%, default 90%)
- Available vision models list with installation instructions

#### Error Handling

Categorized, user-friendly error messages:

- **Validation errors**: Unsupported format, file too large, dimensions exceeded
- **Processing errors**: Canvas failure, memory exhaustion, corrupted file
- **Runtime errors**: Timeout with vision models, context window exceeded, Ollama offline
- **Duplicate warnings**: Confirmation dialog before attaching duplicate images

#### Technical Improvements

- **Zero new dependencies** - uses browser Canvas API, crypto.subtle, FileReader
- **Backwards compatible** - existing conversations and features unchanged
- **Optional field** in conversation schema - old conversations load without errors
- **Efficient storage** - images stored as base64 without data URI prefix
- **File size warnings** - alerts when conversation exceeds 5MB

#### Developer Experience

- Comprehensive documentation (3,440+ lines across 11 planning docs)
- Manual testing checklist (150+ test scenarios)
- Build verification (all tests passing)
- Component architecture documented
- Security audit completed

#### Files Added

- `lib/image-processor.js` - Node.js image processing utilities (370 lines)
- `src/lib/image-processor.js` - Browser ES6 image processor (265 lines)
- `src/components/ImageThumbnail.jsx` - Thumbnail display component (120 lines)
- `src/components/ImageLightbox.jsx` - Full-size viewer component (280 lines)
- `src/components/ImagePrivacyWarning.jsx` - Privacy modal component (150 lines)

#### Files Modified

- `src/App.jsx` (+200 lines) - Main chat image support
- `src/components/ReviewPanel.jsx` (+150 lines) - Code review images
- `src/components/SecurityPanel.jsx` (+170 lines) - Security scan images
- `src/components/MessageBubble.jsx` (+20 lines) - Image display in history
- `lib/ollama-client.js` (+40 lines) - Images parameter support
- `server.js` (+60 lines) - API endpoint updates
- `lib/review.js` (+15 lines) - Vision context injection
- `lib/pentest.js` (+20 lines) - Vision context injection
- `lib/config.js` (+25 lines) - Image support config
- `src/components/SettingsPanel.jsx` (+50 lines) - Settings UI
- `lib/history.js` (+15 lines) - File size warnings

**Total**: ~1,820 lines of code across 16 files

#### Known Limitations

- No processing queue (all images process concurrently) - deferred to Phase 7
- No object URL cleanup (minor memory impact) - deferred to Phase 7
- GIF animations analyze first frame only (Ollama limitation)
- Folder scans in Security mode exclude images (intentional - performance)
- FileBrowser has no image preview (deferred - low priority UX)

#### Credits

Implementation completed 2026-03-17 via coordinated parallel development sessions.

---

## [1.0.0] - Previous Release

_Prior changelog entries to be added here as project evolves._

---

## Guidelines for Contributors

When adding entries:

- Group changes by type: Added, Changed, Deprecated, Removed, Fixed, Security
- Use present tense ("Add feature" not "Added feature")
- Reference issue numbers where applicable
- Keep descriptions concise but informative
- Date entries when released (YYYY-MM-DD)
