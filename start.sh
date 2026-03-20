#!/bin/bash
# ─────────────────────────────────────────────
#  Quick Start Script for Code Companion
#  Starts docling-serve and the web server
# ─────────────────────────────────────────────

set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo ""
echo "🚀 Starting Code Companion..."
echo ""

# ── Start docling-serve ──────────────────────

DOCLING_BIN=""
if command -v docling-serve &> /dev/null; then
  DOCLING_BIN=$(command -v docling-serve)
elif [ -f "$HOME/.local/bin/docling-serve" ]; then
  DOCLING_BIN="$HOME/.local/bin/docling-serve"
fi

if [ -n "$DOCLING_BIN" ]; then
  # Check if already running
  if ! curl -s --max-time 2 http://127.0.0.1:5002/health > /dev/null 2>&1; then
    echo "📄 Starting docling-serve..."
    nohup "$DOCLING_BIN" run --host 127.0.0.1 --port 5002 > /tmp/docling-serve.log 2>&1 &
    sleep 2
    if curl -s --max-time 2 http://127.0.0.1:5002/health > /dev/null 2>&1; then
      echo "✓ Docling-serve running on http://127.0.0.1:5002"
    else
      echo "⚠ Docling-serve starting (models loading in background)"
    fi
  else
    echo "✓ Docling-serve already running on http://127.0.0.1:5002"
  fi
else
  echo "⚠ docling-serve not found"
  echo "  Install: uv tool install \"docling-serve[ui]\""
fi

echo ""

# ── Start the server ─────────────────────────

echo "🌐 Starting web server..."
echo ""

# Check if we need to build
if [ ! -d "dist" ] && [ -f "vite.config.js" ]; then
  echo "Building frontend..."
  npm run build
  echo ""
fi

# Start server
node server.js

# Note: The server.js will also attempt to start docling-serve
# if it's not already running, so this script provides redundancy
