#!/usr/bin/env bash
# Install development-by-iteration commands into a project.
# Usage: ./INSTALL.sh [PROJECT_PATH]
#   If PROJECT_PATH is omitted, the script will prompt for it.
# Run from the folder containing the command .md files (or set COMMANDS_SOURCE_DIR).

set -e

# ---- 1. Detect OS (before anything else) ----
detect_os() {
  local uname_s
  uname_s=$(uname -s 2>/dev/null || true)
  case "${uname_s}" in
    Darwin)   echo "macos" ;;
    Linux)
      if grep -qi microsoft /proc/version 2>/dev/null; then
        echo "wsl"
      else
        echo "linux"
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *)        echo "unknown" ;;
  esac
}

OS=$(detect_os)
echo "Detected OS: $OS"

# ---- 2. Project path (prompt or argument) ----
PROJECT_PATH="${1:-}"

if [ -z "$PROJECT_PATH" ]; then
  echo ""
  printf "Enter the full path of the project to install commands into: "
  read -r PROJECT_PATH
  [ -n "$PROJECT_PATH" ] || { echo "No path provided. Exiting."; exit 1; }
fi

# Resolve to absolute path (works on macOS, Linux, WSL; Windows may need adjustment)
if [ -d "$PROJECT_PATH" ]; then
  PROJECT_PATH=$(cd "$PROJECT_PATH" && pwd)
elif [ -e "$PROJECT_PATH" ]; then
  echo "Error: Path exists but is not a directory: $PROJECT_PATH"
  exit 1
else
  # Path doesn't exist — resolve parent and use as target
  PARENT=$(dirname "$PROJECT_PATH")
  if [ -d "$PARENT" ]; then
    PROJECT_PATH=$(cd "$PARENT" && pwd)/$(basename "$PROJECT_PATH")
    echo "Path does not exist yet. Will create: $PROJECT_PATH"
  else
    echo "Error: Parent directory does not exist: $PARENT"
    exit 1
  fi
fi

echo "Target project: $PROJECT_PATH"
[ -d "$PROJECT_PATH" ] || mkdir -p "$PROJECT_PATH"

# ---- 3. Commands source directory (script's folder or env) ----
if [ -n "${COMMANDS_SOURCE_DIR:-}" ] && [ -d "$COMMANDS_SOURCE_DIR" ]; then
  SRC="$COMMANDS_SOURCE_DIR"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" && pwd)"
  SRC="$SCRIPT_DIR"
fi

if [ ! -d "$SRC" ] || [ ! -f "$SRC/generate-prp.md" ]; then
  echo "Error: Command files not found in: $SRC (run INSTALL.sh from the commands folder or set COMMANDS_SOURCE_DIR)"
  exit 1
fi

# Files to install (exclude reference/docs)
EXCLUDE="README.md|ADD-TO-PROJECT.md|EFFICIENCY-REVIEW.md"
COMMAND_FILES=""
for f in "$SRC"/*.md; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  echo "$base" | grep -qE "^($EXCLUDE)$" && continue
  COMMAND_FILES="$COMMAND_FILES $f"
done

install_into() {
  local dir="$1"
  local ext="${2:-}"   # e.g. ".prompt.md" for VS Code
  mkdir -p "$dir"
  for f in $COMMAND_FILES; do
    [ -f "$f" ] || continue
    base=$(basename "$f" .md)
    if [ -n "$ext" ]; then
      cp "$f" "$dir/${base}${ext}"
    else
      cp "$f" "$dir/"
    fi
  done
  echo "  Installed into $dir"
}

# ---- 4. Detect installed IDEs (OS-aware) ----
cursor_installed() {
  if command -v cursor &>/dev/null; then return 0; fi
  case "$OS" in
    macos)  [ -d "/Applications/Cursor.app" ]; ;;
    windows) [ -n "$(command -v cursor 2>/dev/null)" ] || [ -d "/c/Users/$USER/AppData/Local/Programs/cursor" ] 2>/dev/null; ;;
    *)      [ -d "$HOME/.local/share/cursor" ] 2>/dev/null; ;;
  esac
}

claude_installed() {
  command -v claude &>/dev/null
}

windsurf_installed() {
  if command -v windsurf &>/dev/null; then return 0; fi
  case "$OS" in
    macos)  [ -d "/Applications/Windsurf.app" ]; ;;
    *)      false; ;;
  esac
}

opencode_installed() {
  command -v opencode &>/dev/null
}

vscode_installed() {
  if command -v code &>/dev/null; then return 0; fi
  case "$OS" in
    macos)  [ -d "/Applications/Visual Studio Code.app" ]; ;;
    windows) [ -n "$(command -v code 2>/dev/null)" ]; ;;
    *)      [ -d "$HOME/.local/share/code" ] 2>/dev/null; ;;
  esac
}

# ---- 5. Install into project for each detected IDE ----
echo ""
echo "Installing commands into project..."

INSTALLED=0

if cursor_installed; then
  echo "[Cursor] detected"
  install_into "$PROJECT_PATH/.cursor/commands"
  INSTALLED=1
fi

if claude_installed; then
  echo "[Claude Code] detected"
  install_into "$PROJECT_PATH/.claude/commands"
  INSTALLED=1
fi

if windsurf_installed; then
  echo "[Windsurf] detected"
  install_into "$PROJECT_PATH/.windsurf/workflows"
  INSTALLED=1
fi

if opencode_installed; then
  echo "[OpenCode] detected"
  install_into "$PROJECT_PATH/.opencode/commands"
  INSTALLED=1
fi

if vscode_installed; then
  echo "[VS Code] detected"
  install_into "$PROJECT_PATH/.github/prompts" ".prompt.md"
  INSTALLED=1
fi

if [ "$INSTALLED" -eq 0 ]; then
  echo "No supported IDE was detected. Install anyway into all known locations? (y/N)"
  read -r yesno
  if [ "$yesno" = "y" ] || [ "$yesno" = "Y" ]; then
    install_into "$PROJECT_PATH/.cursor/commands"
    install_into "$PROJECT_PATH/.claude/commands"
    install_into "$PROJECT_PATH/.windsurf/workflows"
    install_into "$PROJECT_PATH/.opencode/commands"
    install_into "$PROJECT_PATH/.github/prompts" ".prompt.md"
    INSTALLED=1
  fi
fi

# ---- 6. Optional folder structure ----
echo ""
printf "Create workflow folders in project (PRPs, PRDs, journal, examples)? (y/N): "
read -r yesno
if [ "$yesno" = "y" ] || [ "$yesno" = "Y" ]; then
  mkdir -p "$PROJECT_PATH/PRPs/prompts" "$PROJECT_PATH/PRPs/templates" \
           "$PROJECT_PATH/PRDs" "$PROJECT_PATH/examples" "$PROJECT_PATH/journal"
  echo "  Created PRPs/, PRDs/, journal/, examples/"
fi

echo ""
echo "Done. Open the project in your IDE and use the new slash-commands."
echo "  Project: $PROJECT_PATH"
