# Changelog

All notable changes to Code Companion will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Desktop release pipeline** — Per-platform CI checks that **`release/`** contains **`latest-mac.yml`** / **`latest.yml`** / Linux feeds before upload; release job verifies **`GITHUB_REPOSITORY`** matches **`electron-builder.config.js`** `publish` (prevents fork-only releases while the app updates from **th3rdai/CodeCompanion**); **`fail_on_unmatched_files`** on **`softprops/action-gh-release`**; scripts **`verify-release-output.js`**, **`verify-ci-repo-matches-publish.js`**.
- **`package.json`** — **`repository`** URL for **`github.com/th3rdai/CodeCompanion`**.

### Changed
- **`electron-builder.config.js`** — Explicit **`publish.publishAutoUpdate: true`** so updater YAML is always written to **`release/`**.

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
