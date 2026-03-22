#!/bin/bash
# ─────────────────────────────────────────────
#  Th3rdAI Code Companion — Quick Rebuild
#  Rebuilds the frontend and restarts the server
# ─────────────────────────────────────────────

APP_NAME="Th3rdAI Code Companion"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8900
LOG_DIR="$APP_DIR/logs"
APP_LOG="$LOG_DIR/app.log"
MAX_WAIT=10

echo ""
echo "  🔄 $APP_NAME — Rebuild"
echo "  ─────────────────────────────────"

cd "$APP_DIR"

# ── Step 1: Stop any running instances ──────

echo ""
echo "  [1/4] Stopping server..."

# Read preferred port from config, kill that port plus HTTPS redirect port (PORT+1)
CFG_PORT=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('.cc-config.json','utf8')).preferredPort||8900)}catch{console.log(8900)}" 2>/dev/null)
PORT=${CFG_PORT:-8900}
REDIRECT_PORT=$((PORT + 1))
PIDS=$(lsof -ti:$PORT -ti:$REDIRECT_PORT 2>/dev/null | sort -u)
if [ -n "$PIDS" ]; then
  echo "$PIDS" | xargs kill 2>/dev/null
  sleep 1
  PIDS=$(lsof -ti:$PORT -ti:$REDIRECT_PORT 2>/dev/null | sort -u)
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null
    sleep 1
  fi
  echo "        ✓ Stopped (port $PORT)"
else
  echo "        ✓ No running instance"
fi

# ── Step 2: Clean and rebuild dist/ ─────────

echo ""
echo "  [2/4] Rebuilding frontend..."

if [ -d "dist" ]; then
  rm -rf dist
  echo "        ✓ Old dist/ removed"
fi

npx vite build 2>&1 | tail -3

if [ -d "dist" ]; then
  echo "        ✓ Frontend built successfully"
else
  echo "        ✗ Build failed!"
  exit 1
fi

# ── Step 3: Restart server ──────────────────

echo ""
echo "  [3/4] Starting server..."

mkdir -p "$LOG_DIR"

node server.js &
SERVER_PID=$!

SECONDS_WAITED=0
SERVER_UP=false

while [ $SECONDS_WAITED -lt $MAX_WAIT ]; do
  sleep 1
  SECONDS_WAITED=$((SECONDS_WAITED + 1))

  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "        ✗ Server crashed on startup"
    cat "$APP_LOG" 2>/dev/null | tail -5
    exit 1
  fi

  if curl -s --max-time 2 "http://localhost:$PORT/api/config" > /dev/null 2>&1; then
    SERVER_UP=true
    break
  fi
done

if [ "$SERVER_UP" = false ]; then
  echo "        ✗ Server didn't respond within ${MAX_WAIT}s"
  exit 1
fi

echo "        ✓ Server running (PID: $SERVER_PID)"

# ── Step 4: Status ──────────────────────────

echo ""
echo "  [4/4] Checking status..."

EXPRESS_OK=false
CONFIG=$(curl -s --max-time 5 "http://localhost:$PORT/api/config" 2>/dev/null)
if [ $? -eq 0 ] && [ -n "$CONFIG" ]; then
  EXPRESS_OK=true
fi

OLLAMA_OK=false
MODEL_COUNT=0
MODELS_RESPONSE=$(curl -s --max-time 5 "http://localhost:$PORT/api/models" 2>/dev/null)
if echo "$MODELS_RESPONSE" | grep -q '"connected":true'; then
  OLLAMA_OK=true
  MODEL_COUNT=$(echo "$MODELS_RESPONSE" | grep -o '"name"' | wc -l | tr -d ' ')
fi

echo ""
echo "  ═════════════════════════════════"
echo "  $APP_NAME — Ready"
echo "  ═════════════════════════════════"
echo ""
echo "  Server:    $([ "$EXPRESS_OK" = true ] && echo '✅ Running' || echo '❌ Down')  http://localhost:$PORT"
echo "  PID:       $SERVER_PID"
echo "  Ollama:    $([ "$OLLAMA_OK" = true ] && echo "✅ Connected ($MODEL_COUNT models)" || echo '❌ Not connected')"
echo ""

if [ "$EXPRESS_OK" = true ] && [ "$OLLAMA_OK" = true ]; then
  echo "  🟢 All good — open http://localhost:$PORT"
elif [ "$EXPRESS_OK" = true ]; then
  echo "  🟡 Server up, but Ollama not reachable."
else
  echo "  🔴 Something went wrong."
fi

echo ""
