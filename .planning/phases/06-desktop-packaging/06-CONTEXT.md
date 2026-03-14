# Phase 6: Desktop App - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Code Companion runs as a self-contained Electron desktop application on macOS, Linux, and Windows. The Express server starts automatically inside the Electron process on a free port, the app presents a native window, and distributable installers are produced for all three platforms. This phase does NOT add new features — it packages the existing web app as a desktop application.

</domain>

<decisions>
## Implementation Decisions

### Window Behavior & UX
- Start maximized, remember window size/position on quit and restore on next launch
- Close button quits the app completely — no minimize-to-system-tray behavior
- Native OS title bar (not frameless/custom) — consistent with platform expectations
- Show the existing 3D splash screen during Express server boot sequence
- Minimal menu bar: Edit, View, Window, Help — no File menu (app is self-contained, no file open/save)
- Restore last active mode (Chat, Review, etc.) on relaunch — persist to config

### Data Storage Location
- Portable data: `CodeCompanion-Data/` folder next to the executable, visible to user
- Include a `README.txt` inside `CodeCompanion-Data/` explaining what the folder is and not to delete it
- macOS fallback: if portable path is not writable (code signing restrictions), fall back to `~/Library/Application Support/Code Companion`
- Auto-migrate existing `./data/` from dev location on first desktop launch — copy to new location seamlessly
- Data persists across app updates — installers preserve the data directory
- Pre-update backup: auto-create timestamped ZIP of data folder before each update as safety net
- No data size limit — user manages manually via sidebar delete and ZIP export
- Unified storage structure — reviews and chats remain in the same history system (no separation)
- Config stored as single `config.json` in the data directory (matches current approach)
- ZIP export/import in Settings for backup and machine migration

### Installer & Distribution
- All three platforms: macOS (DMG), Windows (NSIS installer), Linux (AppImage)
- DMG: branded background with app name, tagline, and visual styling behind drag-to-install layout
- NSIS: custom install path allowed, default to `C:\Program Files\Code Companion`
- Auto-update via electron-updater, checking on launch, downloading in background, prompting to restart
- Release hosting: GitHub Releases as backend + single-page minimal landing page on GitHub Pages (hero, tagline, screenshot, download buttons, feature list)
- App icon: styled version of existing Code Companion branding, adapted to platform icon requirements (1024x1024 PNG, .icns, .ico)
- Skip code signing for v1 — document Gatekeeper/SmartScreen workarounds in README
- Unsigned app instructions in GitHub README only (not in-app)

### Ollama Connection
- Discovery: check `http://localhost:11434` on launch; if no response, show friendly "Connect to Ollama" screen; Settings always allows URL override
- Offline handling: non-blocking inline banner "Ollama disconnected — AI features unavailable"; UI stays fully usable (browse history, read old reviews, export data); auto-reconnect when Ollama comes back
- Remote Ollama support: configurable URL in Settings (already works in current codebase)
- Model list refresh: on launch + manual refresh button in model dropdown (no polling)
- Auto-install flow: detect OS, download official Ollama installer from ollama.com, launch it, poll localhost:11434 until ready; show progress screen "Installing Ollama..."
- No-models flow: if Ollama running but zero models installed, recommend `qwen3:latest` with "Click to pull" button
- Model pull progress: real progress bar with download percentage and size (intercept Ollama pull progress stream)
- Connection health: subtle green/red status dot near model dropdown — green = connected, red = disconnected

### Claude's Discretion
- Electron main process architecture (single vs. multi-window)
- IPC channel design between main and renderer
- Free port detection implementation
- electron-updater configuration details
- Splash screen timing and transition to main window
- How to intercept Ollama pull progress stream
- Landing page HTML/CSS design

</decisions>

<specifics>
## Specific Ideas

- The splash screen should reuse the existing 3D splash (SplashScreen component) during Express boot — same visual, just shown while server starts instead of on page load
- The "Connect to Ollama" screen should feel like a friendly setup wizard, not an error state — guide the user through getting started
- Auto-install Ollama button: "Install Ollama for me" that handles the entire process
- The pre-update backup ZIP should be named with a timestamp like `CodeCompanion-Backup-2026-03-14.zip`
- Landing page: single HTML page, can live on GitHub Pages, hero with screenshot and three platform download buttons

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server.js` uses `__dirname` for all path resolution — easy to redirect to Electron's app data path via a single base-path variable
- `initConfig(__dirname)` and `initHistory(__dirname)` — both accept a base directory, making data directory redirection straightforward
- `src/components/3d/SplashScreen.jsx` — existing 3D splash component, can be reused during Electron boot
- `lib/config.js` — config management with `initConfig()`, `getConfig()`, `updateConfig()` — extend for last-active-mode persistence
- `lib/ollama-client.js` — `checkConnection()` and `listModels()` already handle Ollama discovery and offline detection
- `PORT = process.env.PORT || 3000` — already environment-configurable, Electron just needs to set this to a free port

### Established Patterns
- All backend paths resolve from `__dirname` — Electron main process sets this before spawning Express
- Server-Sent Events for streaming — works identically inside Electron's BrowserWindow
- JSON file storage for history and config — no database dependency, portable by design
- Vite build produces `dist/` — Electron loads this as static files, same as current Express static serving

### Integration Points
- `server.js` line 23: `const PORT = process.env.PORT || 3000` — Electron detects free port and sets `process.env.PORT`
- `server.js` lines 101-102: `initConfig(__dirname)` and `initHistory(__dirname)` — redirect to portable data directory
- `server.js` line 117-118: `distDir` and `publicDir` — Electron needs these to point to packaged resources
- `src/App.jsx` — needs to persist and restore last active mode
- `src/components/SettingsPanel.jsx` — add ZIP export/import buttons
- New file needed: `electron/main.js` — Electron main process entry point

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-desktop-packaging*
*Context gathered: 2026-03-14*
