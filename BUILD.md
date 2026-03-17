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

## Platform-Specific Builds

```bash
# macOS (DMG + ZIP; Apple Silicon arm64 when building on M1/M2/M3/M4)
npm run electron:build:mac

# Windows (NSIS installer + ZIP; default arch depends on host; requires resources/icon.ico for NSIS)
npm run electron:build:win
# Windows x64 explicitly: npx electron-builder --win --x64 --config electron-builder.config.js --publish never

# Linux (AppImage + ZIP)
npm run electron:build:linux
```

**Note:** User config (e.g. GitHub PAT in Settings) and `.cc-config.json` are excluded from the package so installers never contain your tokens.

## What’s included in the package

The built app (DMG, EXE, AppImage, and portable ZIPs) includes:

- App binary, `dist/`, `server.js`, `mcp-server.js`, and runtime dependencies
- **startup.sh**, **deploy.sh**, **rebuild.sh** (for running or reinstalling from the unpacked app)
- **cert/README.txt** — instructions for enabling HTTPS with a self-signed certificate (add `server.crt` and `server.key` in the `cert/` folder, then restart)

## Output

Built artifacts go to `release/`. All scripts use `--publish never` (local build only).

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

## Hosting

Upload built artifacts to `https://th3rdai.com/downloads/`. The landing page at `landing/index.html` links to these URLs.
