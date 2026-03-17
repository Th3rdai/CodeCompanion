#!/bin/bash
# ─────────────────────────────────────────────
#  Th3rdAI Code Companion — Startup Script
# ─────────────────────────────────────────────

APP_NAME="Th3rdAI Code Companion"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3000
LOG_DIR="$APP_DIR/logs"
APP_LOG="$LOG_DIR/app.log"
DEBUG_LOG="$LOG_DIR/debug.log"
MAX_WAIT=10

# Detect HTTPS: use certs if present, fall back to HTTP
if [ -f "$APP_DIR/cert/server.crt" ] && [ -f "$APP_DIR/cert/server.key" ]; then
  PROTO="https"
  CURL_OPTS="-k"   # -k = allow self-signed cert
else
  PROTO="http"
  CURL_OPTS=""
fi
BASE_URL="$PROTO://localhost:$PORT"

echo ""
echo "  🤖 $APP_NAME Startup"
echo "  ─────────────────────────────────"

# ── Step 1: Stop any running instances ──────

echo ""
echo "  [1/5] Stopping existing instances..."

PIDS=$(lsof -ti:$PORT 2>/dev/null)
if [ -n "$PIDS" ]; then
  echo "$PIDS" | xargs kill 2>/dev/null
  sleep 1
  # Force kill if still running
  PIDS=$(lsof -ti:$PORT 2>/dev/null)
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null
    sleep 1
  fi
  echo "        ✓ Stopped previous processes"
else
  echo "        ✓ No existing instances found"
fi

# ── Step 2: Clean old logs ──────────────────

echo ""
echo "  [2/5] Preparing logs..."

mkdir -p "$LOG_DIR"

# Archive previous logs if they exist
if [ -f "$APP_LOG" ]; then
  mv "$APP_LOG" "$APP_LOG.prev" 2>/dev/null
fi
if [ -f "$DEBUG_LOG" ]; then
  mv "$DEBUG_LOG" "$DEBUG_LOG.prev" 2>/dev/null
fi

echo "        ✓ Log directory ready: $LOG_DIR"

# ── Step 3: Install dependencies if needed ──

echo ""
echo "  [3/6] Checking dependencies..."

cd "$APP_DIR"
if [ ! -d "node_modules" ]; then
  echo "        Installing packages..."
  npm install --silent 2>&1
  echo "        ✓ Dependencies installed"
else
  echo "        ✓ Dependencies ready"
fi

# ── Step 4: Build frontend (Vite) ──────────

echo ""
echo "  [4/6] Building frontend..."

if [ -f "vite.config.js" ]; then
  npx vite build 2>&1 | tail -5
  if [ -d "dist" ]; then
    echo "        ✓ Frontend built (dist/)"
  else
    echo "        ⚠ Vite build may have failed — falling back to public/"
  fi
else
  echo "        ✓ Using legacy frontend (public/)"
fi

# ── Step 5: Start the server ────────────────

echo ""
echo "  [5/6] Starting server..."

node server.js &
SERVER_PID=$!

# Wait for the server to be ready
SECONDS_WAITED=0
SERVER_UP=false

while [ $SECONDS_WAITED -lt $MAX_WAIT ]; do
  sleep 1
  SECONDS_WAITED=$((SECONDS_WAITED + 1))

  # Check if process is still alive
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "        ✗ Server process died unexpectedly"
    echo ""
    echo "  ── App Log ──"
    cat "$APP_LOG" 2>/dev/null || echo "  (no log output)"
    echo ""
    exit 1
  fi

  # Check if the port is responding
  if curl -s $CURL_OPTS --max-time 2 "$BASE_URL/api/config" > /dev/null 2>&1; then
    SERVER_UP=true
    break
  fi
done

if [ "$SERVER_UP" = false ]; then
  echo "        ✗ Server did not respond within ${MAX_WAIT}s"
  echo ""
  echo "  ── App Log ──"
  cat "$APP_LOG" 2>/dev/null || echo "  (no log output)"
  echo ""
  exit 1
fi

echo "        ✓ Server running (PID: $SERVER_PID)"

# ── Step 6: Health check ────────────────────

echo ""
echo "  [6/6] Running health checks..."

# Check Express server
EXPRESS_OK=false
CONFIG=$(curl -s $CURL_OPTS --max-time 5 "$BASE_URL/api/config" 2>/dev/null)
if [ $? -eq 0 ] && [ -n "$CONFIG" ]; then
  EXPRESS_OK=true
  OLLAMA_URL=$(echo "$CONFIG" | grep -o '"ollamaUrl":"[^"]*"' | cut -d'"' -f4)
fi

# Check Ollama connection
OLLAMA_OK=false
MODEL_COUNT=0
MODELS_RESPONSE=$(curl -s $CURL_OPTS --max-time 5 "$BASE_URL/api/models" 2>/dev/null)
if echo "$MODELS_RESPONSE" | grep -q '"connected":true'; then
  OLLAMA_OK=true
  MODEL_COUNT=$(echo "$MODELS_RESPONSE" | grep -o '"name"' | wc -l | tr -d ' ')
fi

# Check MCP HTTP endpoint
MCP_OK=false
MCP_RESPONSE=$(curl -s $CURL_OPTS --max-time 5 -X POST "$BASE_URL/mcp" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"healthcheck","version":"1.0.0"}},"id":1}' 2>/dev/null)
if echo "$MCP_RESPONSE" | grep -q '"result"'; then
  MCP_OK=true
fi

# ── Status Report ───────────────────────────

echo ""
echo "  ═════════════════════════════════"
echo "  $APP_NAME — Status"
echo "  ═════════════════════════════════"
echo ""
echo "  Express Server:  $([ "$EXPRESS_OK" = true ] && echo '✅ Running' || echo '❌ Not responding')"
echo "  URL:             $BASE_URL"
echo "  PID:             $SERVER_PID"
echo "  Ollama URL:      ${OLLAMA_URL:-unknown}"
echo "  Ollama Status:   $([ "$OLLAMA_OK" = true ] && echo "✅ Connected ($MODEL_COUNT models)" || echo '❌ Not connected')"
echo "  MCP Server:      $([ "$MCP_OK" = true ] && echo '✅ Active at /mcp' || echo '⚠️  Not responding')"
echo "  MCP Stdio:       node mcp-server.js"
echo ""
echo "  Logs:"
echo "    App log:       $APP_LOG"
echo "    Debug log:     $DEBUG_LOG"
echo "    View in app:   $BASE_URL/api/logs"
echo "    View debug:    $BASE_URL/api/logs?type=debug"
echo ""

if [ "$EXPRESS_OK" = true ] && [ "$OLLAMA_OK" = true ]; then
  echo "  🟢 All systems go — open $BASE_URL"
elif [ "$EXPRESS_OK" = true ]; then
  echo "  🟡 Server is up but can't reach Ollama."
  echo "     Make sure Ollama is running, then check"
  echo "     the URL in Settings (⚙️) inside the app."
else
  echo "  🔴 Server failed to start."
fi

# ── Show recent app log ─────────────────────

echo ""
echo "  ── Recent App Log ──"
if [ -f "$APP_LOG" ]; then
  tail -10 "$APP_LOG" | while IFS= read -r line; do
    echo "  $line"
  done
else
  echo "  (no log entries yet)"
fi

echo ""
echo "  💡 Tip: run with DEBUG=1 ./startup.sh for verbose output"
echo "     or tail -f $APP_LOG to watch live"
echo ""
