# Phase 6: Desktop App - Context

**Gathered:** 2026-03-14 (updated after fresh discussion)
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform Code Companion from manual terminal-and-browser workflow into a self-contained Electron desktop application. App launches with a native window, automatically starts the Express server on a configurable free port, provides cross-platform IDE launcher buttons, and packages as distributable installers (.dmg, .AppImage, .exe, .zip) with OS-appropriate user data directories and optional portable mode.

</domain>

<decisions>
## Implementation Decisions

### Port Management (Updated 2026-03-14)
- **User configurable port with auto-detection fallback** — Settings UI lets users set preferred port (default: 3000). If port is taken, automatically find next free port and notify user
- **Port change notification** — Toast message shows actual port used if fallback occurred: "Server started on port 3001 (port 3000 was busy)"
- **Port validation** — Validate user input (1024-65535 range), sanitize before binding
- **Environment variable override** — Respects `PORT` env var for advanced users

### IDE Launcher Cross-Platform Support (Updated 2026-03-14)
- **Implement all platforms for all 4 IDEs** — Write Windows and Linux equivalents for Claude Code, Cursor, Windsurf, and OpenCode launchers (currently macOS-only)
- **Platform detection** — Use `process.platform` to execute correct command per OS
- **Graceful degradation** — If IDE not installed, show friendly error: "[IDE] not found. Install it from [URL]"
- **Command mappings:**
  - **macOS:** `open -a "AppName"` or AppleScript for Terminal-based CLIs
  - **Windows:** `start "" "C:\Program Files\AppName\app.exe"` or `cmd /c code` for CLI tools
  - **Linux:** `xdg-open` or direct binary paths like `/usr/bin/cursor`

### Data Storage Location (Updated 2026-03-14)
- **OS user data directory by default** — Use `app.getPath('userData')` for history, config, logs:
  - macOS: `~/Library/Application Support/CodeCompanion`
  - Windows: `%APPDATA%\CodeCompanion`
  - Linux: `~/.config/CodeCompanion`
- **Portable mode toggle** — Settings checkbox: "Portable mode (store data in app folder)". When enabled, writes to `CodeCompanion-Data/` folder next to executable
- **README.txt in portable folder** — Explains what the folder is and not to delete it
- **Migration on first launch** — If old `history/` or `config.json` exists in __dirname, offer to migrate to user data directory
- **Pre-update backup** — Auto-create timestamped ZIP of data folder before each update: `CodeCompanion-Backup-2026-03-14.zip`
- **ZIP export/import** — Settings buttons for manual backup and machine migration
- **Unified storage structure** — Reviews and chats in same history system, single `config.json`

### Window Behavior & UX
- **Maximized on launch** (Updated 2026-03-14) — Window opens maximized initially for immersive experience
- **Remember size/position** — Save window bounds to config on close, restore on next launch. Validate bounds still visible (handle monitor unplugged)
- **Close button quits completely** — No minimize-to-system-tray behavior
- **Native OS title bar** — Not frameless/custom, consistent with platform expectations
- **Show existing 3D splash** — Display SplashScreen.jsx during Express server boot sequence
- **DevTools access** — Keyboard shortcut (Cmd+Alt+I / Ctrl+Shift+I) opens DevTools in development and production
- **Window properties:**
  - Title: "Code Companion — Vibe Coder Edition"
  - Min size: 1024x768
  - Background color: Match Tailwind slate-900 to prevent flash of white
- **Minimal menu bar** — Edit, View, Window, Help (no File menu — app is self-contained)
- **Restore last active mode** — Persist last mode (Chat, Review, etc.) to config, restore on relaunch

### Server Lifecycle (Updated 2026-03-14)
- **Spawned child process** — Main process spawns server.js as child process via `fork()` instead of embedding
- **IPC communication** — Child sends ready message with actual port used; main listens for shutdown signals
- **Graceful shutdown** — On app quit, send SIGTERM to server, wait up to 5 seconds, then force kill if needed
- **Error handling** — If server crashes, show friendly dialog: "The server stopped unexpectedly. Your data is safe. [View Logs] [Restart Server]"
- **Auto-restart option** — Settings checkbox (off by default): "Auto-restart server on crash"
- **Free port detection** — Server child receives `PORT` env var with free port found by main process

### Installer & Distribution (Updated 2026-03-14)
- **electron-builder** — Industry-standard packaging tool with simple config
- **All 4 distribution formats:**
  1. `.dmg` (macOS) — Drag-and-drop installer with custom branded background
  2. `.AppImage` (Linux) — Single-file portable executable
  3. `.exe` (Windows) — NSIS installer with custom install path option, default `C:\Program Files\Code Companion`
  4. `.zip` (all platforms) — Portable archives for manual extraction
- **Naming convention:** `CodeCompanion-1.0.0-mac.dmg`, `CodeCompanion-1.0.0-linux.AppImage`, `CodeCompanion-1.0.0-win.exe`, `CodeCompanion-1.0.0-portable-[platform].zip`
- **Auto-update via electron-updater** — Check on launch; Settings → General → **Software Updates** uses **Upgrade** / **Restart to upgrade** against GitHub Releases (unpackaged dev disables Upgrade)
- **Release hosting** — GitHub Releases backend + GitHub Pages landing page (hero, screenshot, download buttons)
- **App icon** — Styled version of existing branding, 1024x1024 PNG source, electron-builder generates .icns/.ico
- **Skip code signing for Phase 6** — Document Gatekeeper/SmartScreen workarounds in GitHub README only (not in-app)
- **Data persists across updates** — Installers preserve data directory location

### Ollama Connection
- **Discovery** — Check `http://localhost:11434` on launch; if no response, show friendly "Connect to Ollama" screen
- **Settings URL override** — Always allow manual Ollama URL configuration
- **Offline handling** — Non-blocking inline banner "Ollama disconnected — AI features unavailable". UI stays usable (browse history, read old reviews, export data). Auto-reconnect when Ollama returns
- **Remote Ollama support** — Configurable URL works for remote instances
- **Model list refresh** — On launch + manual refresh button in model dropdown (no polling)
- **Auto-install flow** — Detect OS, download official Ollama installer from ollama.com, launch it, poll localhost:11434 until ready. Show progress screen "Installing Ollama..."
- **No-models flow** — If Ollama running but zero models, recommend `qwen3:latest` with "Click to pull" button
- **Model pull progress** — Real progress bar with download percentage and size (intercept Ollama pull progress stream)
- **Connection health indicator** — Subtle green/red status dot near model dropdown

### Claude's Discretion
- Electron main.js file structure and organization
- IPC event names and payload schemas for server communication
- Port auto-detection algorithm (sequential vs random)
- Settings UI layout for port configuration and portable mode toggle
- Migration UI for moving old data to user data directory
- Window state persistence implementation (debounce, throttle)
- Installer custom backgrounds and branding details
- Build script organization in package.json
- Pre-build validation checks
- Post-build artifact verification
- electron-updater configuration details
- Splash screen timing and transition to main window
- How to intercept Ollama pull progress stream
- Landing page HTML/CSS design

</decisions>

<specifics>
## Specific Ideas

- **Port notification should feel helpful, not alarming** — "Running on port 3001 because 3000 was busy" not "PORT CONFLICT ERROR"
- **IDE launcher errors should include fix links** — If Cursor not found, suggest download URL in error message
- **Portable mode is for advanced users** — Default to OS user data directory, expose portable mode in advanced settings with clear explanation
- **Server crash dialog should be reassuring** — "The server stopped unexpectedly. Your data is safe. [View Logs] [Restart Server]"
- **Window remembering should work across displays** — Validate saved bounds are still visible (handle monitor unplugged scenarios)
- **Splash screen reuses existing component** — SplashScreen.jsx shown during Express boot, same visual as current page load
- **"Connect to Ollama" screen feels like a setup wizard** — Friendly guide, not an error state
- **Auto-install Ollama button:** "Install Ollama for me" handles entire process
- **Pre-update backup ZIP naming:** `CodeCompanion-Backup-2026-03-14.zip` with timestamp
- **Landing page:** Single HTML on GitHub Pages, hero with screenshot and three platform download buttons
- **Branding assets location:** Th3rdAI branding images available at https://drive.google.com/drive/folders/1T1agtMdgNX0lXUuigGKa7E1fGfvqMgMY — user will provide local copies during execution for app icon, installer backgrounds, and landing page

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **server.js** — Complete Express server ready to spawn as child process
- **server.js uses `__dirname`** — All path resolution via `__dirname`, easy to redirect to Electron app data path
- **initConfig(__dirname) and initHistory(__dirname)** — Both accept base directory, making data redirection straightforward
- **lib/config.js** — Config management with `initConfig()`, `getConfig()`, `updateConfig()` — extend for last-active-mode persistence
- **lib/ollama-client.js** — `checkConnection()` and `listModels()` already handle Ollama discovery and offline detection
- **FileBrowser.jsx** — Has 4 IDE launcher buttons with handlers (lines 48-125), needs cross-platform command mapping
- **4 IDE launcher endpoints** — `/api/launch-claude-code`, `/api/launch-cursor`, `/api/launch-windsurf`, `/api/launch-opencode` (server.js:553-629)
- **src/components/3d/SplashScreen.jsx** — Existing 3D splash component, can be reused during Electron boot
- **Vite production build** — Already configured to output to `dist/`, ready for Electron to serve
- **package.json scripts** — `dev`, `build`, `preview` exist; needs `electron:dev`, `electron:build` added
- **Toast component** — Already shows notifications; use for port change notifications

### Current macOS-Only Launcher Commands
```javascript
// Claude Code & OpenCode: AppleScript + Terminal
execSync(`osascript -e 'tell application "Terminal" ...`)

// Cursor & Windsurf: macOS open command
execSync(`open -a "Cursor" "${folder}"`)
execSync(`open -a "Windsurf" "${folder}"`)
```

### Established Patterns
- **Port 3000 hardcoded** — `const PORT = process.env.PORT || 3000` (server.js:23) — Electron sets PORT env var
- **Static file serving** — Serves `dist/` if exists, fallback to `public/` (server.js:117-120)
- **Data directories use __dirname** — History, config, logs all relative to app directory — redirect to user data path
- **Server-Sent Events for streaming** — Works identically inside Electron's BrowserWindow
- **JSON file storage** — No database dependency, portable by design
- **Vite build produces dist/** — Electron loads this as static files

### Integration Points
- **server.js line 23:** `const PORT = process.env.PORT || 3000` — Electron sets to free port
- **server.js lines 101-102:** `initConfig(__dirname)` and `initHistory(__dirname)` — Redirect to user data or portable directory
- **server.js lines 117-118:** `distDir` and `publicDir` — Electron points to packaged resources
- **server.js lines 553-629:** IDE launcher endpoints need cross-platform command logic
- **src/App.jsx** — Persist and restore last active mode
- **src/components/SettingsPanel.jsx** — Add port config, portable mode toggle, ZIP export/import buttons
- **New file: electron/main.js** — Electron main process entry point
- **New file: lib/electron-utils.js** — Platform detection, IDE command mapping, free port detection

</code_context>

<prior_context>
## Prior Phase Decisions Affecting This Phase

### From Phase 2 (Tone Unification)
- Vibe-coder audience framing ("AI coding tool" not "dev team") — applies to Electron error dialogs
- Friendly-teacher tone for error messages — server crash dialog, Ollama connection errors

### From Phase 3 (Report Card UI)
- Lucide React icons preferred — use for settings, dialogs if needed
- Toast notifications for feedback — port change notifications, update prompts

### From Phase 4 (Actionable Guidance)
- Friendly action-oriented messaging — "Server restarted successfully", not "SIGTERM sent"

### From Phase 5 (Onboarding and Help)
- Zero jargon explanations — Settings must explain "portable mode" in plain English
- Privacy messaging — "Your code stays on your machine" messaging applies to data directory choice

</prior_context>

<deferred>
## Deferred Ideas

- **Custom window chrome** — Frameless window with custom title bar deferred to v2
- **Menu bar app mode** — Background mode with menu bar icon deferred to v2
- **Multiple windows** — Single window only for Phase 6; multi-window deferred
- **Code signing** — Production signing deferred to release process
- **Minimize to tray** — System tray icon and background mode deferred to v2

</deferred>

---

*Phase: 06-desktop-app*
*Context gathered: 2026-03-14 (merged from fresh discussion + prior decisions)*
*Decisions: 7 gray areas resolved (user-configurable port + auto-detect, all-platform IDE launchers, electron-builder, user data + portable mode, maximized window + remember, all 4 installers, spawned server child process)*
*Additional preserved: Ollama auto-install, electron-updater, menu bar design, splash screen reuse*
