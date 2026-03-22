---
name: release-desktop
description: Checklist for building and shipping Code Companion desktop installers (Electron + electron-builder + GitHub Releases + updater patch).
disable-model-invocation: true
---

# Release desktop (manual checklist)

Use this before tagging a release or uploading installers. **Human** runs these steps; the model should not invoke this skill to “release” without you.

## Preconditions

- `npm install` (applies `patch-package` — verify `electron-updater` patch applies in logs).
- `npm run build` succeeds (`dist/` present).

## Build commands (local artifacts only)

From repo root:

```bash
npm run electron:build:mac      # macOS — DMG + ZIP in release/
# or
./scripts/build-installers.sh # macOS + Windows x64 + Linux x64 (see script)
```

`electron-builder.config.js` uses `publish: { provider: github, owner, repo }` for update metadata; builds use `--publish never` unless you intentionally publish.

## Verify updater

- **Packaged app:** Settings → General → **Software Updates** → **Upgrade** hits GitHub Releases (not the web `releases/latest` JSON bug — patched via `patches/electron-updater+*.patch`).
- **`allowPrerelease`** in `electron/updater.js` — if you ship **stable-only** releases later, test with `allowPrerelease: false`.

## GitHub Release

- Upload `latest.yml` (Windows), `latest-mac.yml` / ZIP, Linux YAML as required by electron-updater for each platform.
- Match tag to `package.json` version when possible.

## Docs

- `BUILD.md` — full matrix of artifacts and updater notes.
