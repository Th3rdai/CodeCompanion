#!/bin/bash
# ─────────────────────────────────────────────
#  Th3rdAI Code Companion — Install & run (first-time or from a fresh clone)
# ─────────────────────────────────────────────
#  Installs all npm dependencies, builds the frontend, and starts the app.
#  After that you can use ./startup.sh to start/restart.
#  Prerequisites: Node.js 18+, npm. For AI features: Ollama (https://ollama.com).
# ─────────────────────────────────────────────

APP_NAME="Th3rdAI Code Companion"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo ""
echo "  🤖 $APP_NAME — Install & Run"
echo "  ─────────────────────────────────"

# Check Node.js
if ! command -v node &>/dev/null; then
  echo ""
  echo "  ❌ Node.js is required. Install from https://nodejs.org (18+)."
  echo ""
  exit 1
fi
NODE_VER=$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1)
if [ -n "$NODE_VER" ] && [ "$NODE_VER" -lt 18 ] 2>/dev/null; then
  echo ""
  echo "  ❌ Node.js 18+ required. Current: $(node -v)."
  echo ""
  exit 1
fi
echo "  ✓ Node.js $(node -v)"

# Check npm
if ! command -v npm &>/dev/null; then
  echo ""
  echo "  ❌ npm is required (usually included with Node.js)."
  echo ""
  exit 1
fi
echo "  ✓ npm $(npm -v)"

# Install all dependencies (always run so package.json/lockfile are the source of truth)
echo ""
echo "  [1/4] Installing dependencies (npm install)..."
npm install
if [ $? -ne 0 ]; then
  echo "  ❌ npm install failed."
  exit 1
fi
echo "        ✓ Dependencies installed"

# Build frontend
echo ""
echo "  [2/4] Building frontend (npm run build)..."
npm run build
if [ $? -ne 0 ]; then
  echo "  ❌ Build failed."
  exit 1
fi
if [ ! -d "dist" ]; then
  echo "        ⚠ dist/ missing; startup may fall back to public/"
else
  echo "        ✓ Frontend built (dist/)"
fi

# Ensure logs dir exists (startup.sh will use it)
echo ""
echo "  [3/4] Preparing directories..."
mkdir -p "$APP_DIR/logs"
echo "        ✓ logs/ ready"

# Generate self-signed HTTPS cert if not already present
echo ""
echo "  [3b/4] Setting up HTTPS..."
CERT_DIR="$APP_DIR/cert"
if [ -f "$CERT_DIR/server.crt" ] && [ -f "$CERT_DIR/server.key" ]; then
  echo "        ✓ Certificate already exists (skipping)"
elif command -v openssl &>/dev/null; then
  mkdir -p "$CERT_DIR"
  openssl req -nodes -new -x509 \
    -keyout "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -days 365 \
    -subj "/CN=localhost" \
    2>/dev/null
  if [ $? -eq 0 ]; then
    echo "        ✓ Self-signed certificate generated (cert/)"
    echo "        ℹ App will serve HTTPS — accept the browser warning on first visit"
  else
    echo "        ⚠ Certificate generation failed — app will use HTTP"
  fi
else
  echo "        ⚠ openssl not found — app will use HTTP (install openssl to enable HTTPS)"
fi

# Prompt for project folder (optional — can be set later in Settings)
echo ""
echo "  [3c/4] Project folder setup..."
CONFIG_FILE="$APP_DIR/CodeCompanion-Data/.cc-config.json"
# Check if a valid projectFolder is already saved
EXISTING_FOLDER=""
if [ -f "$CONFIG_FILE" ]; then
  EXISTING_FOLDER=$(node -e "try{const c=require('$CONFIG_FILE');if(c.projectFolder&&require('fs').existsSync(c.projectFolder))console.log(c.projectFolder);}catch(e){}" 2>/dev/null)
fi

if [ -n "$EXISTING_FOLDER" ]; then
  echo "        ✓ Project folder already set: $EXISTING_FOLDER"
else
  echo "        Enter the path to your code project folder."
  echo "        (Leave blank to skip — you can set this later in Settings ⚙️)"
  printf "        Path: "
  read -r PROJECT_FOLDER
  if [ -n "$PROJECT_FOLDER" ]; then
    # Expand ~ if used
    PROJECT_FOLDER="${PROJECT_FOLDER/#\~/$HOME}"
    if [ -d "$PROJECT_FOLDER" ]; then
      # Write projectFolder into config via node
      node -e "
        const fs = require('fs');
        const f = '$CONFIG_FILE';
        let c = {};
        try { c = JSON.parse(fs.readFileSync(f,'utf8')); } catch(e) {}
        c.projectFolder = '$PROJECT_FOLDER';
        fs.mkdirSync(require('path').dirname(f), {recursive:true});
        fs.writeFileSync(f, JSON.stringify(c, null, 2));
      " 2>/dev/null
      echo "        ✓ Project folder set: $PROJECT_FOLDER"
    else
      echo "        ⚠ Path does not exist — skipping (set it later in Settings ⚙️)"
    fi
  else
    echo "        ✓ Skipped — set your project folder in Settings ⚙️ after launch"
  fi
fi

# Start the app
echo ""
echo "  [4/4] Starting app..."
echo "        (For AI features, install Ollama and pull a model: https://ollama.com)"
echo ""
exec ./startup.sh
