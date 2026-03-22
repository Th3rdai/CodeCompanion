#!/usr/bin/env bash
# PostToolUse (matcher: Edit|Write) — run unit tests when core server/lib/mcp files change.
# Requires: jq; npm dependencies installed. Non-fatal: exits 0 even if tests fail (stderr shows output).
set -euo pipefail

if ! command -v jq &>/dev/null; then
  exit 0
fi

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE" || "$FILE" == "null" ]]; then
  exit 0
fi

# Only trigger for backend/MCP paths
if [[ ! "$FILE" =~ /lib/ ]] && [[ ! "$FILE" =~ /server\.js$ ]] && [[ ! "$FILE" =~ /mcp/ ]]; then
  exit 0
fi

# Find repo root (directory containing server.js)
DIR=$(dirname "$FILE")
REPO=""
while [[ "$DIR" != "/" ]]; do
  if [[ -f "$DIR/package.json" && -f "$DIR/server.js" ]]; then
    REPO="$DIR"
    break
  fi
  DIR=$(dirname "$DIR")
done

if [[ -z "$REPO" ]]; then
  exit 0
fi

cd "$REPO" || exit 0

echo "[run-unit-tests] Running test:unit after edit to $(basename "$FILE")..." >&2
if ! FORCE_HTTP=1 npm run test:unit >&2; then
  echo "[run-unit-tests] WARNING: unit tests failed — fix before commit." >&2
fi
exit 0
