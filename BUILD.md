# Building Code Companion

## Prerequisites

- Node.js 18+
- npm

## Quick Build

```bash
# Install dependencies
npm install

# Build for current platform
npm run electron:build
```

## Platform-Specific Builds

```bash
# macOS (DMG + ZIP)
npm run electron:build:mac

# Windows (NSIS installer + ZIP)
npm run electron:build:win

# Linux (AppImage + ZIP)
npm run electron:build:linux
```

## Output

Built artifacts go to `release/`:

| Platform | Files |
|----------|-------|
| macOS | `Code Companion-{version}-arm64.dmg`, `Code Companion-{version}-arm64-mac.zip` |
| Windows | `Code Companion Setup {version}.exe`, `Code Companion-{version}-win.zip` |
| Linux | `Code-Companion-{version}.AppImage`, `Code-Companion-{version}.zip` |

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
chmod +x Code-Companion-*.AppImage
./Code-Companion-*.AppImage
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
