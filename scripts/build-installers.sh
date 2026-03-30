#!/bin/bash
# Rebuild all OS installers (macOS DMG/ZIP, Windows NSIS/ZIP, Linux AppImage/ZIP).
# Run from project root: ./scripts/build-installers.sh
# Output: release/ (see BUILD.md for artifact names).
#
# This is LOCAL ONLY (--publish never). Public releases and updater feeds must come from
# GitHub Actions (.github/workflows/build.yml) via tag push — not from this script.
#
# Distribution signing (optional, slower than unsigned local builds):
#   macOS: export MAC_DISTRIBUTION_SIGN=1 and MAC_CODESIGN_IDENTITY
#   Windows: export WIN_DISTRIBUTION_SIGN=1 and WIN_CSC_LINK (or CSC_LINK) + WIN_CSC_KEY_PASSWORD / CSC_KEY_PASSWORD
#   Linux AppImage GPG: export LINUX_GPG_SIGN=1 and LINUX_GPG_KEY_ID (requires gpg on PATH)

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Code Companion — building all installers ==="
echo "Project root: $ROOT"
echo ""

echo "--- Production build (Vite) ---"
npm run build
echo ""

echo "--- macOS (DMG + ZIP) ---"
npx electron-builder --mac --config electron-builder.config.js --publish never
echo ""

echo "--- Windows x64 (NSIS + ZIP) — use --arm64 on Apple Silicon hosts if you need Windows on ARM only ---"
npx electron-builder --win --x64 --config electron-builder.config.js --publish never
echo ""

echo "--- Linux x64 (AppImage + ZIP) — add --arm64 for Linux arm64 (e.g. Raspberry Pi 5) ---"
npx electron-builder --linux --x64 --config electron-builder.config.js --publish never
echo ""

echo "=== Done. Artifacts in release/ ==="
ls -la release/*.dmg release/*.exe release/*.AppImage release/*.zip 2>/dev/null || true
