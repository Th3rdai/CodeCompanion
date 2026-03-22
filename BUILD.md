# Building Code Companion

## Prerequisites

- Node.js 18+
- npm

## Quick Build

Builds are **local only** (no GitHub publish) unless you pass `--publish` explicitly.

```bash
# Install dependencies
npm install

# Build for current platform (output in release/)
npm run electron:build

# Build all platforms (macOS + Windows + Linux) in one go
./scripts/build-installers.sh
```

## Validation (7-phase / CI-style)

From repo root (HTTP on port 4173 avoids HTTPS vs Playwright mismatch when `cert/` exists):

```bash
npm run build
FORCE_HTTP=1 npm run test:unit
FORCE_HTTP=1 BASE_URL=http://127.0.0.1:4173 npx playwright test tests/ui tests/e2e
```

`playwright.config.js` uses `testMatch: '**/*.spec.js'` (Node unit tests live alongside as `*.test.js`). The dev server is started with `FORCE_HTTP=1` so `BASE_URL=http://127.0.0.1:4173` matches.

## Ollama chat tuning (Settings → persisted config)

These keys live in `.cc-config.json` (via **Settings** UI):

| Key | Purpose |
|-----|---------|
| `chatTimeoutSec` | Max wait for **chat** completion (30–600 seconds; default 120). |
| `numCtx` | Ollama **`num_ctx`** (0 = model default; higher for large pasted docs / PDF text). |
| `autoAdjustContext` | When true, server **raises** effective `num_ctx` and can **extend** timeout for large payloads (chat path; review uses the same flags for sizing). |

**Review** still uses `reviewTimeoutSec` separately. If Ollama returns **500** on huge content, the UI surfaces a hint to shorten input or use a larger-context model.

## External MCP clients (transports)

In **Settings → MCP Clients**, each server can use:

- **stdio** — local command + args (validated; no shell).
- **http** — Streamable HTTP URL; if the server responds with **Method Not Allowed**, the client **retries the same URL with SSE**.
- **sse** — SSE transport when you know the endpoint is SSE-only.

The in-chat **tool loop** runs when **either** (a) at least one MCP client is connected with tools, **or** (b) **builtin agent tools** are enabled — see **Agent terminal** below.

## Agent terminal (builtin `run_terminal_cmd`)

Optional **AI-driven shell commands** from chat, same `TOOL_CALL:` mechanism as MCP (`builtin.run_terminal_cmd`). **Off by default.**

| Topic | Detail |
|-------|--------|
| **Enable** | Settings → **Agent terminal** (writes `agentTerminal` in `.cc-config.json`). Requires a **project folder** set. |
| **Spec** | **`CLIPLAN.md`** (living reference); plan review notes in **`docs/CLIPLAN-plan-review.md`**. |
| **Security** | Allowlist/blocklist, cwd locked to project, env whitelist, intra-request rate limit, optional **`CC_ALLOW_AGENT_TERMINAL=1`** when not running as a purely local server. |
| **Clipboard** | Copy/paste in the app uses **`src/lib/clipboard.js`** so copy works under **self-signed HTTPS** (fallback when `navigator.clipboard` is denied). |

## Platform-Specific Builds

```bash
# macOS (DMG + ZIP; Apple Silicon arm64 when building on M1/M2/M3/M4)
npm run electron:build:mac

# Windows (NSIS installer + ZIP; on Apple Silicon defaults to win-arm64 unless you pass --x64)
npm run electron:build:win

# Linux (AppImage + ZIP; on Apple Silicon defaults to linux-arm64 unless you pass --x64)
npm run electron:build:linux

# Most users need x64 Windows + x64 Linux — one command (after npm run build):
npm run electron:build:win-linux-x64
# Equivalent: npx electron-builder --win --linux --x64 --config electron-builder.config.js --publish never
```

**Artifacts** (version from `package.json`; filenames follow **`artifactName`** in `electron-builder.config.js`: **`${name}-${version}-${arch}.${ext}`** — npm **`name`** is `code-companion`, so no spaces and updater YAML URLs match GitHub assets):

| Platform | Typical files in `release/` |
|----------|-----------------------------|
| macOS arm64 | `code-companion-1.5.x-arm64.dmg`, `code-companion-1.5.x-arm64.zip`, `latest-mac.yml` |
| Windows x64 | `code-companion-1.5.x-x64.exe` (NSIS), `code-companion-1.5.x-x64.zip`, `latest.yml` |
| Linux x64 | `code-companion-1.5.x-x64.AppImage`, `code-companion-1.5.x-x64.zip`, `latest-linux.yml` |
| Windows arm64 / Linux arm64 | Same pattern with **`arm64`** (build `--win --arm64` / `--linux --arm64`) |

Auto-update metadata: `latest.yml` (Windows), `latest-linux.yml` / `latest-linux-arm64.yml` (Linux).

**electron-updater patch:** `patches/electron-updater+6.8.3.patch` (applied via `patch-package` on `npm install`) fixes GitHub’s **406** response when the stock `electron-updater` client requested JSON from the **web** `.../releases/latest` URL. The patch uses **`api.github.com`** with `Accept: application/vnd.github+json` instead. **`electron/updater.js`** sets **`autoUpdater.allowPrerelease = true`** so repos that only publish **prereleases** still resolve updates (GitHub’s `/releases/latest` API returns **404** when there is no stable release). If you later ship **stable-only** releases and want stable users to ignore betas, set `allowPrerelease` to `false` and test.

**Note:** User config (e.g. GitHub PAT in Settings) and `.cc-config.json` are excluded from the package so installers never contain your tokens.

## What’s included in the package

The built app (DMG, EXE, AppImage, and portable ZIPs) includes:

- App binary, `dist/`, `server.js`, `mcp-server.js`, and runtime dependencies
- **startup.sh**, **deploy.sh**, **rebuild.sh** (for running or reinstalling from the unpacked app)
- **cert/README.txt** — instructions for enabling HTTPS with a self-signed certificate (add `server.crt` and `server.key` in the `cert/` folder, then restart)

## Output

Built artifacts go to `release/`. All scripts use `--publish never` (local build only).

### Google Drive mirror (Th3rdAI)

A manual copy of installers may live under **Google Drive → My Drive → `_TH3RDAI.INC/CodeCompanion/`** with **`Mac/`**, **`Windows/`**, and **`Linux/`** subfolders (synced via Google Drive for desktop). After a local build, copy **`release/`** outputs into the matching folder — e.g. **`Mac/`**: `*.dmg`, `*-mac.zip`, `*.blockmap`, **`latest-mac.yml`**. Only copy **`latest.yml`** / **`latest-linux*.yml`** if they were produced in the **same** build as the corresponding `.exe` / `.AppImage` (stale YAML is worse than none). For a full matrix (all platforms), use **`./scripts/build-installers.sh`** or CI, then sync each platform’s artifacts.

### Publishing releases (so in-app **Software Updates** works)

**Maintainer guide:** [docs/RELEASES-AND-UPDATES.md](docs/RELEASES-AND-UPDATES.md) — versioning, CI vs manual publish, checklists, and prerelease behavior.

`electron-updater` loads **`latest-mac.yml`** (and DMG/ZIP URLs) from **GitHub Releases** for `publish.owner` / `publish.repo` in `electron-builder.config.js` (`th3rdai` / `CodeCompanion`). If a release **tag** exists but those files were **never uploaded**, users see **404** on `latest-mac.yml` when using **Check for updates** / **Download update** in Settings.

**Fix (maintainers):**

1. Build mac artifacts: `npm run electron:build:mac` — produces `release/latest-mac.yml`, DMG, ZIP, blockmaps.
2. **Publish** to GitHub, e.g. with a token:  
   `npx electron-builder --mac --config electron-builder.config.js --publish always`  
   Or manually attach **`release/latest-mac.yml`**, **`*.dmg`**, **`*-mac.zip`**, and blockmaps to the matching **GitHub release** for that version.
3. **`allowPrerelease`** is `true` in `electron/updater.js` — the updater may follow a **prerelease** (e.g. `v1.0.0-beta.1`). If that tag has **no** mac updater assets, mac updates fail until the release is fixed or a **newer** release with full assets is published.

**Workaround (users):** Download the DMG/ZIP from [Releases](https://github.com/th3rdai/CodeCompanion/releases) and install manually until the release assets are complete.

### CI (tag push)

Pushing a tag **`v*`** whose suffix matches **`package.json`** `version` (e.g. tag `v1.5.3` and `"version": "1.5.3"`) runs [`.github/workflows/build.yml`](.github/workflows/build.yml): it builds macOS, Windows, and Linux, then creates a **GitHub Release** and uploads **all** `release/` outputs (including **`latest-mac.yml`** and blockmaps) into **one** release. **Manual dispatch** only runs the build matrix and uploads **workflow artifacts** — it does **not** create a release.

### Manual publish (one machine)

With `GH_TOKEN` set to a token that can upload release assets:

```bash
npm run electron:publish:mac    # or :win / :linux
```

| Platform | Files |
|----------|-------|
| macOS | `Code Companion-{version}-arm64.dmg`, `Code Companion-{version}-arm64-mac.zip` (Apple Silicon) |
| Windows | `Code Companion Setup {version}.exe` (NSIS), `Code Companion-{version}-win.zip` (x64). For ARM64: `electron-builder --win --arm64 ...` |
| Linux | `Code Companion-{version}-arm64.AppImage`, `code-companion-{version}-arm64.zip` (arch depends on build host) |

## Testing the Build

### macOS

1. Mount the DMG and drag to Applications
2. Right-click the app and select "Open" (required for unsigned apps)
3. Click "Open" in the Gatekeeper warning dialog
4. App should show splash screen, start server, then load UI

### Windows

1. Run the installer EXE
2. Click "More info" then "Run anyway" if SmartScreen warns
3. Launch from Start Menu or Desktop shortcut

### Linux

```bash
chmod +x "Code Companion-"*.AppImage
./"Code Companion-"*.AppImage
```

## Architecture

The Electron app works as follows:

1. `electron/main.js` creates a BrowserWindow with splash screen
2. Finds a free port (default 3000) and spawns `server.js` as a child process via `fork()`
3. Once the Express server sends an IPC "ready" message, navigates the window to `http://localhost:{port}`
4. The Vite-built frontend in `dist/` is served by Express

Key configuration: `asar: false` in `electron-builder.config.js` because `fork()` cannot execute code inside asar archives.

## Code Signing (Future)

Currently builds are unsigned. Users must bypass OS warnings on first launch.

When an Apple Developer account is ready, update `electron-builder.config.js`:

```js
mac: {
  hardenedRuntime: true,
  entitlements: 'resources/entitlements.mac.plist',
  entitlementsInherit: 'resources/entitlements.mac.inherit.plist',
  identity: 'Developer ID Application: Th3rdAI (TEAM_ID)',
  notarize: { teamId: 'TEAM_ID' },
}
```

Set environment variables: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.

For Windows, obtain an EV code signing certificate and configure `win.signingHashAlgorithms`.

## Reverse proxy (optional)

If you put nginx, Caddy, or another proxy in front of Code Companion, **forward `/api/*` and `/mcp`** to the same Node process that serves the app. If `/api/...` is not proxied and the proxy returns `index.html` for unknown paths, the UI may show errors like “Unexpected token '&lt;'” or “Server returned a web page instead of API data” when opening GitHub/VCS or other panels.

Example (conceptual): proxy `location /api/` and `location /mcp` to `http://127.0.0.1:3000` (or your server port), and proxy `/` to the same origin so the SPA and API share one host.

## Hosting

Upload built artifacts to `https://th3rdai.com/downloads/`. The landing page at `landing/index.html` links to these URLs.
