# Architecture Overview

**Analysis Date:** 2025-03-21

## Runtime shape

| Layer | Role | Primary paths |
|-------|------|----------------|
| **HTTP + API** | Express app, static SPA, SSE chat, REST | `server.js` |
| **Frontend** | React 19 + Vite, Tailwind 4, mode-driven UI | `src/main.jsx` → `src/App.jsx`, `src/components/` |
| **Desktop** | Electron shell: window, IPC, data dir, optional Ollama/Docling helpers, auto-update | `electron/main.js`, `electron/preload.js`, `electron/*.js` |
| **Libraries** | Ollama, file I/O, MCP, review/pentest/validate/build, office export | `lib/` |

No separate database: JSON files under the app data root (`CC_DATA_DIR` or repo root) for config, history, memory, build registry.

## Entry points

**Server:** `server.js` — loads `lib/config` (`initConfig` with `dataRoot`), history, memory, logger; constructs `McpClientManager` and `ToolCallHandler`; mounts middleware, `/api/*` routes, `app.all('/mcp', …)` for MCP HTTP transport; serves `dist/` or `public/`; SPA fallback `app.get('*', …)` **after** git routes.

**Web UI:** `src/main.jsx` wraps `App` in `Effects3DProvider`; `src/App.jsx` owns mode state, chat streaming, panels, and Electron detection via `window.electronAPI`.

**Electron:** `package.json` `"main": "electron/main.js"`. Main process forks/starts the Node server, opens `BrowserWindow`, wires IPC (`preload.js` exposes safe APIs). Packaged app uses `electron/data-manager.js` for user data paths; web dev uses Vite on port **8902** with proxy to API on **8900** (`vite.config.js`).

## Configuration

| Mechanism | Purpose |
|-----------|---------|
| `lib/config.js` | Loads/merges defaults with `.cc-config.json` at `appRoot`; `getConfig` / `updateConfig` / `saveConfig`. Nested merge for `memory`, `imageSupport`, `docling`, `agentTerminal`. |
| `.cc-config.json` | Persisted settings: Ollama URL, ports, timeouts, MCP client list, GitHub token, project folder, memory, docling, agent terminal allowlist, etc. **Not committed** as a rule; path is `path.join(appRoot, '.cc-config.json')`. |
| Env | `PORT`, `HOST`, `CC_DATA_DIR`, `DEBUG`, `FORCE_HTTP` (disables HTTPS in `server.js`), etc. |

Client-facing config omits secrets (`sanitizeConfigForClient` in `server.js` strips `githubToken`, masks MCP env, strips `license` field).

## Cross-cutting product features

**Chat Stop (abort):** Client `src/App.jsx` uses `chatAbortRef` (`AbortController`) and passes `signal` to `fetch('/api/chat', …)`. Server `server.js` creates `chatAbortController`, aborts on `req.on('close')`, passes `abortSignal` into `lib/ollama-client.js` (`chatStream` / `chatComplete`) and tool loop; stream reader cancelled on disconnect.

**Export / Office:** `src/components/ExportPanel.jsx` drives downloads; server `POST /api/generate-office` and `GET /api/export/formats` use `lib/office-generator.js` (DOCX/XLSX/PPTX/PDF/etc.). Builtin agent **`generate_office_file`** can pass **`sourcePath`** → `lib/builtin-doc-converter.js` → same generator (file→Excel without Docling when built-in supports the type).

**patch-package:** `package.json` `postinstall`: `patch-package`. Patches: `patches/electron-updater+6.8.3.patch` (GitHub release / 406); `patches/officeparser+6.0.4.patch` (**`file-type`** ESM + **`fileTypeFromBuffer`**). Electron updater in `electron/updater.js`.

**stdio MCP PATH:** `lib/mcp-client-manager.js` calls `mergeDevToolPathIntoEnv` from `lib/spawn-path.js` when spawning stdio MCP servers so `npx`/`uvx` resolve in minimal shells (e.g. Electron).

**Docling:** `lib/docling-starter.js` (web), `electron/docling-manager.js` (desktop); conversion via `lib/docling-client.js` + `lib/builtin-doc-converter.js`; `GET /api/docling/health`, `POST /api/convert-document`.

## Electron vs browser

| Concern | Browser | Electron |
|---------|---------|----------|
| API base | Same origin or Vite proxy | Local server URL from main process |
| Data / port | Typical web storage | `electron/data-manager.js`, port config IPC |
| Updates | N/A | `electron/updater.js` + `electron-updater` |
| Ollama / Docling setup | User installs manually | `electron/ollama-setup.js`, `docling-manager.js` optional automation |

---

*Architecture analysis: 2025-03-21*
