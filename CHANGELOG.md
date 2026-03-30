# Changelog

All notable changes to Code Companion will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.5.16] — 2026-03-30

### Added

- **CRE8 framework integration** — Create mode now scaffolds CRE8 workflow files: `PRPs/`, `examples/`, `journal/`, PRP templates (`prp_base.md`, `prd_base.md`), 12 CRE8 command files across all 5 IDE paths, and `INITIAL.md` pre-populated with wizard data. New **"Generate Execution Plan"** button on the success screen auto-sends the `generate-prp.md` prompt to chat, producing a full PRP immediately after project creation.
- **`GET /api/cre8/prp-prompt`** — Returns CRE8 `generate-prp.md` content for chat pre-fill.

### Fixed

- **Claude Code launch** — "Open in Claude Code" now runs `claude` CLI in a new Terminal tab via AppleScript instead of just opening Terminal in the folder.

---

## [Unreleased]

### Security

- **npm transitive dependencies** — `npm audit fix` updates **brace-expansion**, **path-to-regexp**, and **picomatch** (via lockfile) to clear Dependabot-reported moderate/high advisories.

### Added

- **Auto model per mode** — Toolbar option **Auto (best per mode)**; server resolves via **`lib/auto-model.js`** + **`autoModelMap`** in **`.cc-config.json`**; Settings → **Auto model map**; SSE **`resolvedModel`** on chat. Applies to review, pentest, score, validate, build APIs, git review, tutorial suggestions, memory extraction.
- **`scripts/clean-artifacts.sh`** — Removes **`release/`**, **`dist/`**, and Playwright output dirs; optional **`--with-gitnexus`** to drop **`.gitnexus/`** before re-indexing. Documented in **[BUILD.md](BUILD.md)**.
- **`npm run test:integration`** — Runs **`tests/integration/api-with-images.test.js`** (spawned server; chat/review/pentest/remediate). Documented in **[docs/TESTING.md](docs/TESTING.md)**.
- **Image lightbox** — Click any image in chat to preview full-size in a modal overlay; `Escape` or click backdrop to close. Images render at minimum 1080px width with pointer cursor and hover feedback (`src/components/MarkdownContent.jsx`, `src/index.css`).
- **Tool parameter schemas in system prompt** — MCP tool descriptions now include required params, types, and enum values so models use correct parameter names (e.g. `aspect_ratio: 1:1` not `width: 1024`). Compact format keeps prompt at ~8.5 KB (was 23.7 KB) (`lib/tool-call-handler.js`).
- **Image revision flow** — `IMAGE_DELIVERED` marker in tool results instructs models to re-call `generate_image` for revisions instead of hallucinating fake image markdown. Historical image placeholders changed to plain text to prevent mimicry.
- **Batch conversation delete** — `POST /api/history/batch-delete` accepts `{ ids: [...] }` for single-request bulk deletion, replacing N individual DELETE calls that hit the global rate limiter (`server.js`, `src/App.jsx`).
- **GitHub clone destination picker** — Clone URL section now includes a **Clone to folder** field defaulting to the current Project Folder. Users can type any path; empty falls back to internal `github-repos/` directory. Server validates the destination exists before cloning (`lib/github.js`, `server.js`, `src/components/GitHubPanel.jsx`).

### Changed

- **Chat latency (server + client)** — **`listModels`** short-TTL cache (**`lib/ollama-client.js`**); parallel **auto-model** + **memory** embedding on **`POST /api/chat`**; cached project file-list snippet for system prompt (**`server.js`**); **`requestAnimationFrame`** batching for streaming tokens (**`src/App.jsx`**).

### Fixed

- **Integration tests (`tests/integration/api-with-images.test.js`)** — Bodies aligned with current API (`model`, `messages`, `mode` for chat; **`/api/pentest/remediate`** uses `code` + `findings`); responses parsed as **JSON or SSE** by `Content-Type` (no `res.json()` on event streams).
- **MCP image generation (Nano Banana)** — Three fixes for tool-call image handling:
  - **Hallucination stripping** — AI models sometimes fabricate fake JSON results after `TOOL_CALL:` patterns; now truncated before feeding back to the message loop (`server.js`).
  - **Base64 context bloat** — Stop embedding full base64 image data (3-7 MB) in AI context for subsequent rounds; images are still streamed to the frontend via SSE `toolImage` events, but the AI only sees `[Image generated successfully]`.
  - **`const` reassignment crash** — `messages` was declared `const` but the base64-stripping `.map()` tried to reassign it; renamed to `cleanedMessages` and wired through `fullMessages` construction.
- **Tool-call system prompt** — Explicitly instructs models to STOP after `TOOL_CALL:` lines and never fabricate results (`lib/tool-call-handler.js`).
- **Tool-call placeholder leak** — `(called tools)` fallback text was parroted back by models; now skips empty assistant messages entirely and instructs model to present results without internal markers.
- **Auto-model vision fallback** — `preferVision` was triggered by **historical** images in conversation, locking all follow-up messages to `llava:7b` (which can't do tool calls). Now only triggers when the **current** message has images.
- **Historical image arrays causing 400 errors** — Conversations with prior image uploads sent `images` arrays to non-vision cloud models (kimi-k2, minimax), causing Ollama 400 errors. Now strips `images` from older messages and adds `[User previously shared an image here]` placeholder.
- **Playwright (UI/E2E)** — Avoid **missing `/api/models` after `reload()`** by registering `waitForResponse` before `reload()`, then waiting for `#model-select`. Applied in privacy banner, onboarding wizard, report-card, create-mode, and image-upload specs. **Onboarding:** focus wizard via dialog click (not `focus()`). **Report card tests:** wait for `mode-tab-chat` before `mode-tab-review`. **Privacy:** stable dismiss via `data-testid="privacy-banner-dismiss"` on `PrivacyBanner`.

### Documentation

- **`docs/TESTING.md`** — **`npm run test:integration`**, **`tests/integration/`** layout, when to run API integration tests.
- **`docs/INSTALL-WINDOWS.md`** / **`docs/INSTALL-MAC.md`** — Aligned with **`package.json`** version **1.5.14** and **`artifactName`** release filenames (`code-companion-${version}-${arch}.*`).
- **`.planning/codebase/TESTING.md`** — New subsection: reload + `/api/models` pattern, report-card tab hydration, onboarding focus, privacy test id.
- **`.planning/codebase/TESTING-AND-RISKS.md`** — E2E stability cross-reference.
- **`.claude/commands/validate-project.md`** — P6 notes: large `GET /api/history` and scoped `folder=` for file tree when validating against huge project folders.

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
