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

echo "--- Windows (NSIS + ZIP) ---"
npx electron-builder --win --config electron-builder.config.js --publish never
echo ""

echo "--- Linux (AppImage + ZIP) ---"
npx electron-builder --linux --config electron-builder.config.js --publish never
echo ""

echo "=== Done. Artifacts in release/ ==="
ls -la release/*.dmg release/*.exe release/*.AppImage release/*.zip 2>/dev/null || true
