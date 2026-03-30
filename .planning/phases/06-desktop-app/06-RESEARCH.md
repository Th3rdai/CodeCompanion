# Phase 6: Desktop App - Research

**Researched:** 2026-03-14
**Domain:** Electron desktop packaging, auto-update, cross-platform distribution
**Confidence:** HIGH

## Summary

Phase 6 packages the existing Code Companion web app (Express + React/Vite) as a self-contained Electron desktop application. The existing architecture is already well-suited for this: `initConfig(appRoot)` and `initHistory(appRoot)` both accept a base directory, `PORT` is environment-configurable, and the Vite build produces a static `dist/` folder that Express already serves. The core work is: (1) an Electron main process that detects a free port, starts the Express server, and loads the app in a BrowserWindow, (2) portable data directory management with migration, (3) cross-platform IDE launcher commands, (4) Ollama setup wizard with auto-install and model pull progress, and (5) electron-builder configuration for DMG/NSIS/AppImage installers with auto-update via GitHub Releases.

The project uses Node.js with Express (CommonJS), React 19 with Vite 7, and Tailwind CSS 4. Electron 33+ (LTS) is the recommended target since it ships Node 20.x which is compatible with the existing codebase. electron-builder is the recommended packaging tool over Electron Forge because it provides built-in auto-update support via electron-updater, simpler configuration for an existing project, and native NSIS/DMG/AppImage makers without additional plugins.

**Primary recommendation:** Use electron-builder with electron-updater for packaging and auto-update. Embed Express in the main process (not a child process), detect a free port at startup, and redirect all data paths to a portable `CodeCompanion-Data/` directory next to the executable.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- Start maximized, remember window size/position on quit and restore on next launch
- Close button quits the app completely -- no minimize-to-system-tray behavior
- Native OS title bar (not frameless/custom) -- consistent with platform expectations
- Show the existing 3D splash screen during Express server boot sequence
- Minimal menu bar: Edit, View, Window, Help -- no File menu (app is self-contained, no file open/save)
- Restore last active mode (Chat, Review, etc.) on relaunch -- persist to config
- Portable data: `CodeCompanion-Data/` folder next to the executable, visible to user
- Include a `README.txt` inside `CodeCompanion-Data/` explaining what the folder is and not to delete it
- macOS fallback: if portable path is not writable (code signing restrictions), fall back to `~/Library/Application Support/code-companion` (Electron `userData` from package `name`)
- Auto-migrate existing `./data/` from dev location on first desktop launch -- copy to new location seamlessly
- Data persists across app updates -- installers preserve the data directory
- Pre-update backup: auto-create timestamped ZIP of data folder before each update as safety net
- ZIP export/import in Settings for backup and machine migration
- All three platforms: macOS (DMG), Windows (NSIS installer), Linux (AppImage)
- DMG: branded background with app name, tagline, and visual styling behind drag-to-install layout
- NSIS: custom install path allowed, default to `C:\Program Files\Code Companion`
- Auto-update via electron-updater, checking on launch, downloading in background, prompting to restart
- Release hosting: GitHub Releases as backend + single-page minimal landing page on GitHub Pages
- App icon: styled version of existing Code Companion branding, adapted to platform icon requirements (1024x1024 PNG, .icns, .ico)
- Skip code signing for v1 -- document Gatekeeper/SmartScreen workarounds in README
- Unsigned app instructions in GitHub README only (not in-app)
- Discovery: check `http://localhost:11434` on launch; if no response, show friendly "Connect to Ollama" screen
- Offline handling: non-blocking inline banner "Ollama disconnected -- AI features unavailable"; UI stays fully usable
- Auto-install flow: detect OS, download official Ollama installer from ollama.com, launch it, poll localhost:11434 until ready
- No-models flow: if Ollama running but zero models installed, recommend `qwen3:latest` with "Click to pull" button
- Model pull progress: real progress bar with download percentage and size (intercept Ollama pull progress stream)
- Connection health: subtle green/red status dot near model dropdown

### Claude's Discretion

- Electron main process architecture (single vs. multi-window)
- IPC channel design between main and renderer
- Free port detection implementation
- electron-updater configuration details
- Splash screen timing and transition to main window
- How to intercept Ollama pull progress stream
- Landing page HTML/CSS design

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                               | Research Support                                                                |
| ------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| DESK-01 | App launches as a native desktop window (no manual terminal commands or browser required) | Electron main process architecture, BrowserWindow config, splash screen pattern |
| DESK-02 | Express server starts automatically on a free port inside the Electron process            | Free port detection via net.createServer port 0, server.js integration pattern  |
| DESK-03 | IDE launcher buttons work on macOS, Linux, and Windows (platform-detected commands)       | Cross-platform child_process.exec patterns per OS                               |
| DESK-04 | Distributable installers produced: .dmg for macOS, .AppImage for Linux, .exe for Windows  | electron-builder configuration, maker targets, auto-update setup                |
| DESK-05 | App data (config, history, logs) stored in OS-appropriate user data directory             | Portable data path with app.setPath(), migration logic, pre-update backup       |

</phase_requirements>

## Standard Stack

### Core

| Library          | Version | Purpose                                            | Why Standard                                                 |
| ---------------- | ------- | -------------------------------------------------- | ------------------------------------------------------------ |
| electron         | ^33.0.0 | Desktop app runtime (Chromium + Node.js)           | LTS line, ships Node 20.x compatible with existing codebase  |
| electron-builder | ^25.0.0 | Package and build installers (DMG, NSIS, AppImage) | Most feature-rich packager with built-in auto-update support |
| electron-updater | ^6.0.0  | Auto-update via GitHub Releases                    | Bundled with electron-builder, supports all three platforms  |

### Supporting

| Library      | Version | Purpose                                          | When to Use                               |
| ------------ | ------- | ------------------------------------------------ | ----------------------------------------- |
| electron-log | ^5.0.0  | Cross-platform logging for Electron main process | Replace console.log in production builds  |
| archiver     | ^7.0.0  | Create ZIP backups of data directory             | Pre-update backup and Settings export     |
| extract-zip  | ^2.0.0  | Extract ZIP imports                              | Settings ZIP import for machine migration |

### Not Needed (Already in Project)

| Library            | Already Available | Use For                     |
| ------------------ | ----------------- | --------------------------- |
| express            | ^4.18.2           | Server embedded in Electron |
| Node.js net module | Built-in          | Free port detection         |
| child_process      | Built-in          | IDE launcher commands       |
| fs/path            | Built-in          | Data directory management   |

### Alternatives Considered

| Instead of       | Could Use                       | Tradeoff                                                                                                                  |
| ---------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| electron-builder | Electron Forge                  | Forge is officially recommended but requires more config for auto-update; builder has simpler setup for existing projects |
| get-port (npm)   | net.createServer(port:0)        | get-port is ESM-only; native net module works fine for this use case and avoids a dependency                              |
| electron-store   | Custom config via lib/config.js | Project already has config management; adding electron-store would duplicate functionality                                |

**Installation:**

```bash
npm install --save-dev electron electron-builder
npm install electron-updater electron-log archiver extract-zip
```

## Architecture Patterns

### Recommended Project Structure

```
electron/
  main.js              # Electron main process entry
  preload.js           # Secure bridge between main and renderer
  menu.js              # Native menu bar (Edit, View, Window, Help)
  updater.js           # Auto-update logic
  data-manager.js      # Portable data directory, migration, backup
  ollama-setup.js      # Ollama detection, auto-install, model pull
  ide-launcher.js      # Cross-platform IDE launch commands
resources/
  icon.png             # 1024x1024 source icon
  icon.icns            # macOS icon (generated from PNG)
  icon.ico             # Windows icon (generated from PNG)
  dmg-background.png   # DMG installer background
  data-readme.txt      # README.txt for CodeCompanion-Data/
landing/
  index.html           # GitHub Pages landing page
```

### Pattern 1: Embedded Express Server (Single Process)

**What:** Start Express server directly in Electron's main process (not a child process)
**When to use:** Always for this project -- the Express server is the entire backend
**Example:**

```javascript
// electron/main.js
const { app, BrowserWindow } = require("electron");
const net = require("net");
const path = require("path");

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function startApp() {
  const port = await findFreePort();
  process.env.PORT = port;

  // Redirect data paths before requiring server.js
  const dataDir = resolveDataDirectory();
  process.env.CC_DATA_DIR = dataDir;

  // Start Express (require triggers server.listen)
  require("../server.js");

  // Create window pointing to localhost
  const win = new BrowserWindow({
    show: false, // show after load
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(`http://localhost:${port}`);
  win.once("ready-to-show", () => {
    win.maximize();
    win.show();
  });
}
```

### Pattern 2: IPC for Desktop-Only Features

**What:** Use Electron IPC for features that need native OS access (file dialogs, Ollama install, update restart)
**When to use:** Any feature requiring native capabilities not available via Express API
**Example:**

```javascript
// electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  restartForUpdate: () => ipcRenderer.invoke("restart-for-update"),
  installOllama: () => ipcRenderer.invoke("install-ollama"),
  pullModel: (modelName) => ipcRenderer.invoke("pull-model", modelName),
  onPullProgress: (callback) =>
    ipcRenderer.on("pull-progress", (_, data) => callback(data)),
  onUpdateAvailable: (callback) =>
    ipcRenderer.on("update-available", (_, info) => callback(info)),
  exportData: () => ipcRenderer.invoke("export-data"),
  importData: () => ipcRenderer.invoke("import-data"),
  isElectron: true,
});
```

### Pattern 3: Server.js Integration Without Major Refactoring

**What:** Modify server.js minimally to accept external data directory and port
**When to use:** To avoid rewriting server.js while supporting Electron
**Example:**

```javascript
// Minimal changes to server.js:
// Line ~23: const PORT = process.env.PORT || 3000;  (already works)
// Line ~101: const dataRoot = process.env.CC_DATA_DIR || __dirname;
//            initConfig(dataRoot);
//            initHistory(dataRoot);
```

### Pattern 4: Portable Data Directory with Fallback

**What:** Store data next to executable, fall back to OS standard location
**When to use:** Always in Electron mode
**Example:**

```javascript
function resolveDataDirectory() {
  const portablePath = path.join(
    path.dirname(process.execPath),
    "CodeCompanion-Data",
  );

  // Try portable path first
  try {
    if (!fs.existsSync(portablePath)) {
      fs.mkdirSync(portablePath, { recursive: true });
    }
    // Write test to verify writable
    const testFile = path.join(portablePath, ".write-test");
    fs.writeFileSync(testFile, "test");
    fs.unlinkSync(testFile);
    return portablePath;
  } catch {
    // Fallback to OS standard path (macOS code signing, etc.)
    const fallback = path.join(app.getPath("userData"));
    if (!fs.existsSync(fallback)) {
      fs.mkdirSync(fallback, { recursive: true });
    }
    return fallback;
  }
}
```

### Anti-Patterns to Avoid

- **Running Express as a child process:** Adds unnecessary complexity; the main process runs Node.js already, so just require() server.js directly
- **Using nodeIntegration: true:** Security risk; always use contextIsolation with a preload script
- **Hardcoding port 3000:** Will fail if another app uses that port; always detect a free port
- **Storing data in app.asar:** Data inside the ASAR archive is read-only and gets replaced on updates
- **Using shell.openExternal for IDE launchers:** This opens URLs/files, not IDE applications; use child_process.exec with platform-specific commands

## Don't Hand-Roll

| Problem              | Don't Build                    | Use Instead                                                       | Why                                                             |
| -------------------- | ------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| Desktop installers   | Custom installer scripts       | electron-builder makers (DMG, NSIS, AppImage)                     | Platform-specific signing, code injection, registry entries     |
| Auto-update          | Custom HTTP polling + download | electron-updater with GitHub Releases                             | Delta updates, signature verification, rollback support         |
| ZIP creation         | Manual zip with fs streams     | archiver npm package                                              | Handles streaming, compression levels, cross-platform paths     |
| ZIP extraction       | Manual unzip                   | extract-zip                                                       | Handles nested paths, permissions, symlinks on macOS            |
| Icon generation      | Manual resizing per platform   | electron-icon-builder or electron-builder's built-in icon support | Generates all required sizes and formats from one 1024x1024 PNG |
| macOS DMG background | DMG from scratch               | electron-builder dmg config with background image                 | Handles Retina sizing, window position, icon placement          |

**Key insight:** Electron packaging has massive platform-specific edge cases (code signing, Gatekeeper, SmartScreen, AppImage FUSE requirements, NSIS registry). electron-builder handles all of these via configuration, not code.

## Common Pitfalls

### Pitfall 1: ASAR Archive Breaks \_\_dirname References

**What goes wrong:** After packaging, `__dirname` points inside the ASAR archive which is read-only
**Why it happens:** electron-builder bundles app source into `app.asar` by default
**How to avoid:** All data writes MUST go to the resolved data directory (CC_DATA_DIR), never to `__dirname`. The server.js already uses `__dirname` for data -- redirect via environment variable before requiring it.
**Warning signs:** "EROFS: read-only file system" errors after packaging

### Pitfall 2: Port Conflict on Startup

**What goes wrong:** App fails to start because port 3000 is already in use
**Why it happens:** Other dev servers, other Code Companion instances, or other apps use common ports
**How to avoid:** Always use `net.createServer({port: 0})` to get an OS-assigned free port. Never fall back to a hardcoded port.
**Warning signs:** "EADDRINUSE" errors on startup

### Pitfall 3: Cross-Platform IDE Launch Commands

**What goes wrong:** IDE launchers only work on macOS (current code uses `osascript` and `open -a`)
**Why it happens:** Current server.js has macOS-only commands (osascript for Terminal, `open -a` for Cursor/Windsurf)
**How to avoid:** Platform-switch on `process.platform`:

- macOS: `open -a "Cursor" "${folder}"`
- Windows: `cmd /c start "" "cursor" "${folder}"` or use `where cursor` to find executable
- Linux: `cursor "${folder}"` (assuming CLI is in PATH)
  **Warning signs:** "command not found" or "spawn UNKNOWN" errors on non-macOS

### Pitfall 4: Unsigned App Warnings

**What goes wrong:** macOS Gatekeeper blocks the app; Windows SmartScreen warns about unknown publisher
**Why it happens:** No code signing certificate (intentionally skipped for v1)
**How to avoid:** Document clear workarounds in README:

- macOS: `xattr -cr "/Applications/Code Companion.app"` or right-click > Open
- Windows: Click "More info" > "Run anyway" on SmartScreen dialog
  **Warning signs:** Users report "app is damaged" or "Windows protected your PC"

### Pitfall 5: Electron Version vs Node.js Module Compatibility

**What goes wrong:** Native Node modules compiled for system Node.js don't work in Electron's Node
**Why it happens:** Electron bundles its own Node.js version which may differ from system Node
**How to avoid:** This project has NO native modules (no better-sqlite3, no node-gyp). All deps are pure JS. This pitfall is informational -- no action needed, but verify if any new deps are added.
**Warning signs:** "Module version mismatch" errors

### Pitfall 6: Ollama Auto-Install Platform Differences

**What goes wrong:** Auto-install logic fails on one platform
**Why it happens:** Each OS has different install mechanisms
**How to avoid:** Use platform-specific download URLs from ollama.com:

- macOS: Download .dmg from `https://ollama.com/download/Ollama-darwin.zip`, extract, open .app
- Windows: Download .exe from `https://ollama.com/download/OllamaSetup.exe`, run installer
- Linux: Run `curl -fsSL https://ollama.com/install.sh | sh` in a terminal
  **Warning signs:** 404 errors on download URLs (check current URLs at build time)

## Code Examples

### Cross-Platform IDE Launcher

```javascript
// electron/ide-launcher.js
const { exec } = require("child_process");
const platform = process.platform;

function launchIDE(ideName, folder) {
  const commands = {
    cursor: {
      darwin: `open -a "Cursor" "${folder}"`,
      win32: `cmd /c start "" "cursor" "${folder}"`,
      linux: `cursor "${folder}"`,
    },
    windsurf: {
      darwin: `open -a "Windsurf" "${folder}"`,
      win32: `cmd /c start "" "windsurf" "${folder}"`,
      linux: `windsurf "${folder}"`,
    },
    "claude-code": {
      darwin: `osascript -e 'tell application "Terminal" to do script "cd \\"${folder}\\" && claude"'`,
      win32: `cmd /c start cmd /k "cd /d "${folder}" && claude"`,
      linux: `x-terminal-emulator -e "cd '${folder}' && claude"`,
    },
    opencode: {
      darwin: `osascript -e 'tell application "Terminal" to do script "cd \\"${folder}\\" && opencode"'`,
      win32: `cmd /c start cmd /k "cd /d "${folder}" && opencode"`,
      linux: `x-terminal-emulator -e "cd '${folder}' && opencode"`,
    },
  };

  const cmd = commands[ideName]?.[platform];
  if (!cmd) throw new Error(`Unsupported IDE "${ideName}" on ${platform}`);

  return new Promise((resolve, reject) => {
    exec(cmd, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
```

### Ollama Model Pull with Progress via SSE

```javascript
// Backend: proxy Ollama pull stream to frontend via SSE
// POST /api/ollama/pull { model: "qwen3:latest" }
// Ollama response is NDJSON: { status, digest, total, completed }

async function pullModelWithProgress(ollamaUrl, modelName, onProgress) {
  const response = await fetch(`${ollamaUrl}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: modelName, stream: true }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      const data = JSON.parse(line);
      onProgress(data);
      // data.status = "pulling digestname" | "verifying sha256 digest" | "success"
      // data.total = total bytes, data.completed = bytes downloaded so far
    }
  }
}
```

### electron-builder Configuration

```javascript
// electron-builder.config.js (or in package.json under "build")
module.exports = {
  appId: "com.th3rdai.code-companion",
  productName: "Code Companion",
  directories: {
    output: "release",
  },
  files: [
    "dist/**/*",
    "lib/**/*",
    "mcp/**/*",
    "server.js",
    "mcp-server.js",
    "electron/**/*",
    "resources/**/*",
    "package.json",
    "node_modules/**/*",
    "!node_modules/@playwright/**/*",
    "!node_modules/playwright/**/*",
    "!src/**/*",
    "!test/**/*",
    "!.planning/**/*",
  ],
  mac: {
    target: "dmg",
    icon: "resources/icon.icns",
    category: "public.app-category.developer-tools",
  },
  dmg: {
    background: "resources/dmg-background.png",
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: "link", path: "/Applications" },
    ],
  },
  win: {
    target: "nsis",
    icon: "resources/icon.ico",
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: "resources/icon.ico",
  },
  linux: {
    target: "AppImage",
    icon: "resources/icon.png",
    category: "Development",
  },
  publish: {
    provider: "github",
    owner: "th3rdai",
    repo: "code-companion",
  },
};
```

### Window State Persistence

```javascript
// electron/window-state.js
const fs = require("fs");
const path = require("path");

function loadWindowState(dataDir) {
  const stateFile = path.join(dataDir, "window-state.json");
  const defaults = { width: 1200, height: 800, isMaximized: true };
  try {
    if (fs.existsSync(stateFile)) {
      return { ...defaults, ...JSON.parse(fs.readFileSync(stateFile, "utf8")) };
    }
  } catch {
    /* ignore */
  }
  return defaults;
}

function saveWindowState(win, dataDir) {
  const stateFile = path.join(dataDir, "window-state.json");
  const bounds = win.getBounds();
  const state = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: win.isMaximized(),
  };
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}
```

### Pre-Update Backup

```javascript
// electron/data-manager.js
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");

async function createBackup(dataDir) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const backupPath = path.join(
    dataDir,
    `CodeCompanion-Backup-${timestamp}.zip`,
  );

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(backupPath);
    const archive = archiver("zip", { zlib: { level: 5 } });

    output.on("close", () => resolve(backupPath));
    archive.on("error", reject);

    archive.pipe(output);
    // Add all data files except backups themselves
    archive.glob("**/*", {
      cwd: dataDir,
      ignore: ["CodeCompanion-Backup-*.zip"],
    });
    archive.finalize();
  });
}
```

## State of the Art

| Old Approach                         | Current Approach                                | When Changed        | Impact                                                |
| ------------------------------------ | ----------------------------------------------- | ------------------- | ----------------------------------------------------- |
| electron-packager + separate updater | electron-builder with built-in electron-updater | 2020+               | Single tool for packaging + auto-update               |
| nodeIntegration: true                | contextIsolation + preload scripts              | Electron 12+ (2021) | Security best practice, mandatory for modern Electron |
| Remote module for IPC                | ipcMain.handle / ipcRenderer.invoke             | Electron 14+ (2021) | Promise-based IPC, no remote module needed            |
| Manual DMG creation                  | electron-builder DMG maker with background      | 2019+               | Branded installer with drag-to-install                |
| Custom update server                 | GitHub Releases as update backend               | electron-updater 4+ | Zero infrastructure, just publish releases            |

**Deprecated/outdated:**

- `remote` module: Removed from Electron. Use IPC (ipcMain/ipcRenderer) instead.
- `nodeIntegration: true`: Security risk. Always use `contextIsolation: true` with preload.
- `electron-packager` standalone: Still works but electron-builder is more complete.

## Open Questions

1. **Electron version pinning**
   - What we know: Electron 33 is current LTS with Node 20.x. Project uses Node 24.8.0 locally.
   - What's unclear: Whether any project dependency requires Node 24 features not in Electron's Node 20.
   - Recommendation: Test with Electron's bundled Node version early. The project uses standard Node APIs so this should be fine.

2. **App icon source**
   - What we know: Need 1024x1024 PNG, .icns for macOS, .ico for Windows
   - What's unclear: Whether an existing brand asset exists to adapt
   - Recommendation: Create a simple icon early; electron-builder can auto-generate .icns/.ico from PNG

3. **GitHub repository for releases**
   - What we know: Auto-update needs a public GitHub repo with Releases enabled
   - What's unclear: Whether the repo at th3rdai/code-companion exists or needs creation
   - Recommendation: Create the repo as part of the first plan; auto-update config can reference it

4. **NSIS installer and portable data coexistence**
   - What we know: NSIS installs to Program Files by default; writing data there requires admin
   - What's unclear: Whether `CodeCompanion-Data` next to exe in Program Files will be writable
   - Recommendation: On Windows, the portable path should be `%APPDATA%/CodeCompanion-Data` as primary, not next to the exe (Program Files is read-only for non-admin). Or use the same fallback pattern as macOS.

## Sources

### Primary (HIGH confidence)

- [Electron official docs](https://www.electronjs.org/docs/latest/) - app API, BrowserWindow, IPC, contextIsolation
- [electron-builder docs](https://www.electron.build/) - Configuration, makers, auto-update
- [electron-updater docs](https://www.electron.build/auto-update.html) - GitHub Releases provider, update lifecycle
- [Ollama API docs](https://docs.ollama.com/api/pull) - /api/pull streaming response format with progress

### Secondary (MEDIUM confidence)

- [Ollama download page](https://ollama.com/download) - Platform-specific installer URLs
- [Electron Forge comparison](https://www.electronforge.io/core-concepts/why-electron-forge) - Forge vs Builder tradeoffs

### Tertiary (LOW confidence)

- Cross-platform IDE launch commands (assembled from multiple sources, needs per-platform testing)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - electron-builder is the established tool for this exact use case
- Architecture: HIGH - Express-in-Electron is a well-documented pattern; the codebase is already structured for it
- Pitfalls: HIGH - ASAR, port conflicts, and unsigned app issues are extremely well-documented
- Cross-platform IDE launchers: MEDIUM - macOS commands verified in codebase, Linux/Windows need testing
- Ollama auto-install: MEDIUM - Download URLs verified but installer automation needs per-platform testing

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable domain, Electron releases are predictable)
