# Changelog

All notable changes to Code Companion will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
