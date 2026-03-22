#!/usr/bin/env bash
# PreToolUse (matcher: Edit|Write) — block or escalate edits to secrets/config.
# Requires: jq (brew install jq)
set -euo pipefail

if ! command -v jq &>/dev/null; then
  exit 0
fi

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE" || "$FILE" == "null" ]]; then
  exit 0
fi

# Deny: env files and private keys (AI should not touch these directly)
if [[ "$FILE" =~ (^|/)\.env($|\.) ]] || [[ "$FILE" =~ (^|/)\.env\. ]]; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Blocked: .env files — edit outside Claude or use Settings; do not commit secrets."
    }
  }'
  exit 0
fi

if [[ "$FILE" =~ /cert/[^/]+\.key$ ]] || [[ "$FILE" =~ (^|/)server\.key$ ]]; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Blocked: TLS/private key files — manage manually in cert/."
    }
  }'
  exit 0
fi

# Ask: local app config (may contain tokens)
if [[ "$FILE" =~ (^|/)\.cc-config\.json$ ]]; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: ".cc-config.json may contain GitHub/MCP secrets — confirm before editing."
    }
  }'
  exit 0
fi

exit 0
