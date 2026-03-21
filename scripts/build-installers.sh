#!/bin/bash
# Rebuild all OS installers (macOS DMG/ZIP, Windows NSIS/ZIP, Linux AppImage/ZIP).
# Run from project root: ./scripts/build-installers.sh
# Output: release/ (see BUILD.md for artifact names).

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
