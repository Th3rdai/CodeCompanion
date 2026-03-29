#!/usr/bin/env bash
# Remove rebuildable artifacts to shrink disk usage and backup size.
# Run from repo root: ./scripts/clean-artifacts.sh [--with-gitnexus]
#
# Removes:
#   release/   — electron-builder output (DMG, EXE, AppImage, unpacked dirs; ~hundreds of MB–GB)
#   dist/      — Vite production bundle
#   test-results/, playwright-report/ — Playwright output if present
#
# Does NOT remove node_modules (run npm install after clone anyway).
#
# Optional --with-gitnexus: runs `npx gitnexus clean --force` (~/.gitnexus index in repo).
#   Re-index later with: npx gitnexus analyze

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WITH_GITNEXUS=0
for arg in "$@"; do
  case "$arg" in
    --with-gitnexus) WITH_GITNEXUS=1 ;;
    -h|--help)
      echo "Usage: $0 [--with-gitnexus]"
      exit 0
      ;;
  esac
done

echo "Code Companion — clean artifacts"
echo "Root: $ROOT"
echo ""

rm_rf() {
  local p="$1"
  if [ -e "$p" ]; then
    du -sh "$p" 2>/dev/null || true
    rm -rf "$p"
    echo "  removed: $p"
  fi
}

echo "--- Removing build / test outputs ---"
rm_rf "release"
rm_rf "dist"
rm_rf "test-results"
rm_rf "playwright-report"

if [ "$WITH_GITNEXUS" -eq 1 ]; then
  echo ""
  echo "--- GitNexus index (optional) ---"
  npx gitnexus clean --force
fi

echo ""
echo "Done. Rebuild: npm run build && npm run electron:build (or ./scripts/build-installers.sh)"
if [ "$WITH_GITNEXUS" -eq 1 ]; then
  echo "Re-index: npx gitnexus analyze"
fi
