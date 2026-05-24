# Google Workspace MCP Timeout - Fix Summary

## Status: ✅ RESOLVED

**Date:** 2026-05-15
**Fix Applied:** Disabled auto-connect for Google Workspace MCP client
**Performance Improvement:** Startup time reduced from ~60s to ~1.14s

## Problem

The Google Workspace MCP client was causing 60-second timeout delays on every server startup due to malformed chunked encoding in the Google Workspace MCP server's HTTP responses. See [GOOGLE-WORKSPACE-TIMEOUT-ROOT-CAUSE.md](GOOGLE-WORKSPACE-TIMEOUT-ROOT-CAUSE.md) for technical details.

## Solution Applied

Set `autoConnect: false` for the Google Workspace client in the correct config file location.

### Critical Discovery: CC_DATA_DIR

The key to successfully applying the fix was discovering that the `CC_DATA_DIR` environment variable was set:

```bash
CC_DATA_DIR=/Users/james/Library/Application Support/code-companion
```

This meant the server was reading from `/Users/james/Library/Application Support/code-companion/.cc-config.json` instead of the repo's `.cc-config.json` or `CodeCompanion-Data/.cc-config.json`.

### Fix Command

```bash
cat "/Users/james/Library/Application Support/code-companion/.cc-config.json" | \
  jq '.mcpClients |= map(if .id == "google" then .autoConnect = false else . end)' \
  > /tmp/fixed-config.json && \
  mv /tmp/fixed-config.json "/Users/james/Library/Application Support/code-companion/.cc-config.json"
```

## Verification Results

**Before Fix:**

- 5 MCP clients attempting auto-connect
- Google Workspace timeout after 60 seconds
- Total startup time: 60+ seconds

**After Fix:**

- 4 MCP clients auto-connecting (Google Workspace excluded)
- No timeout warnings
- Total startup time: ~1.14 seconds
- Successfully connected clients:
  1. crawl4ai-rag (5 tools)
  2. pci-assistant (4 tools)
  3. nano banana (4 tools)
  4. Stitch (14 tools)

## Test Log

Full startup log with the fix applied: `/tmp/final-fix-test.log`

```
[2026-05-15T21:01:05.148Z] [INFO] Web UI: /Users/james/Projects/CodeCompanion/dist (index.html ok)
[2026-05-15T21:01:05.168Z] [INFO] Auto-connecting 4 MCP client(s)...
[2026-05-15T21:01:05.221Z] [INFO] Auto-connected: crawl4ai-rag (5 tools)
[2026-05-15T21:01:05.230Z] [INFO] Auto-connected: pci-assistant (4 tools)
[2026-05-15T21:01:06.160Z] [INFO] Auto-connected: nano banana (4 tools)
[2026-05-15T21:01:06.290Z] [INFO] Auto-connected: Stitch (14 tools)
```

No Google Workspace connection attempts. No timeout warnings.

## Lessons Learned

1. **Always check CC_DATA_DIR first** when debugging config issues
2. **Config file priority:**
   - `$CC_DATA_DIR/.cc-config.json` (highest - when env var is set)
   - `CodeCompanion-Data/.cc-config.json` (Electron dev mode)
   - `.cc-config.json` (repo root - lowest)

3. **Environment variables can override default paths** - verify active config location before editing

## Next Steps

None required. The fix is complete and the server now starts without the 60-second Google Workspace timeout delay.

If Google Workspace access is needed in the future, users can:

1. Manually connect via Settings → MCP Clients
2. Wait for the upstream bug fix in the google-workspace MCP server package
3. Use stdio transport if it becomes available
