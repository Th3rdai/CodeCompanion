# Google Workspace MCP Timeout - Root Cause Analysis

## Summary

The Google Workspace MCP client consistently times out after exactly 60 seconds during auto-connect. This is caused by **malformed chunked encoding in the Google Workspace MCP server's HTTP response**, not a bug in our client code.

## Timeline of Investigation

### Initial Symptoms

- Error: `MCP error -32001: Request timed out`
- Timeout: Exactly 60 seconds after connection start
- Only affects Google Workspace; 4 other MCP clients connect successfully

### Key Findings

1. **Minimal test proves our setup is correct**
   - Created test script using MCP SDK directly
   - Connects to our own MCP HTTP server in 38-39ms
   - Proves `StreamableHTTPClientTransport` works correctly

2. **curl test reveals the bug**

   ```bash
   curl -X POST \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     http://localhost:8899/mcp
   ```

   **Response**:

   ```
   < HTTP/1.0 200 OK
   < content-type: text/event-stream
   < Transfer-Encoding: chunked
   * Malformed encoding found in chunked-encoding
   curl: (56) Malformed encoding found in chunked-encoding
   data: {"jsonrp
   ```

   The response is cut off at `data: {"jsonrp` - the chunked encoding is malformed.

3. **Transport makes no difference**
   - Tested with `transport: "http"` → 60s timeout
   - Tested with `transport: "sse"` → 60s timeout
   - Both use the same underlying HTTP connection that receives malformed chunks

## Technical Details

### What's Happening

1. Our client initiates connection to `http://localhost:8899/mcp`
2. Google Workspace server responds with `Transfer-Encoding: chunked`
3. The chunking is malformed, causing the SSE stream to be cut off mid-JSON
4. The MCP SDK waits for a properly-formed SSE stream that never arrives
5. After 60 seconds, the SDK times out with `-32001: Request timed out`

### Why Other Clients Work

- **pci-assistant, crawl4ai-rag**: Use SSE transport with client-generated session IDs
- **Stitch, nano banana**: Use stdio transport (no HTTP involved)
- **Google Workspace**: Only client using HTTP to an external server with this bug

## Workarounds

### Option 1: Disable Auto-Connect (Recommended) ✅ APPLIED

**CRITICAL: Always check CC_DATA_DIR environment variable first!**

The config file location depends on the `CC_DATA_DIR` environment variable:

1. **Check which config is being used:**

   ```bash
   echo "CC_DATA_DIR: ${CC_DATA_DIR:-not set}"
   ```

2. **Config file priority (highest to lowest):**
   - `$CC_DATA_DIR/.cc-config.json` (when CC_DATA_DIR is set)
   - `CodeCompanion-Data/.cc-config.json` (Electron dev mode)
   - `.cc-config.json` (repo root)

3. **Applied fix (for CC_DATA_DIR location):**

   ```bash
   # Set autoConnect: false for Google Workspace client
   cat "/Users/james/Library/Application Support/code-companion/.cc-config.json" | \
     jq '.mcpClients |= map(if .id == "google" then .autoConnect = false else . end)' \
     > /tmp/fixed-config.json && \
     mv /tmp/fixed-config.json "/Users/james/Library/Application Support/code-companion/.cc-config.json"
   ```

4. **Verify the change:**
   ```bash
   cat "$CC_DATA_DIR/.cc-config.json" | jq '.mcpClients[] | select(.id == "google") | {id, name, autoConnect}'
   ```

**Result:** Startup time reduced from ~60 seconds to ~1.14 seconds. Google Workspace is now excluded from auto-connect.

### Option 2: Use stdio Transport (If Supported)

Check if the google-workspace package supports stdio transport instead of HTTP.

### Option 3: Report the Bug

This needs to be fixed in the google-workspace MCP server package.

## Implementation Challenges

### Config File Location Discovery

During implementation of the workaround, we encountered difficulty finding the correct config file to edit:

1. **First attempt:** Edited `.cc-config.json` in repo root - no effect
2. **Second attempt:** Edited `CodeCompanion-Data/.cc-config.json` - wrong file
3. **Success:** Discovered `CC_DATA_DIR` environment variable pointing to `/Users/james/Library/Application Support/code-companion`

**Root cause:** The `CC_DATA_DIR` environment variable was set, overriding both the repo root config and the `CodeCompanion-Data` location. This is a common pitfall when debugging config issues.

**Lesson:** Always check `CC_DATA_DIR` environment variable first before attempting to edit config files.

## Files Modified During Investigation

- `lib/mcp-client-manager.js` - Added debug logging for Google Work connection
- `.cc-config.json` - Changed transport from "http" to "sse" (didn't help)
- `/Users/james/Library/Application Support/code-companion/.cc-config.json` - Set `autoConnect: false` for google client ✅

## Conclusion

**This is NOT a bug in our code.** Our HTTP client implementation is correct - proven by the minimal test connecting in ~40ms. The issue is a malformed chunked encoding bug in the Google Workspace MCP server's HTTP response handling.

The fix must be made in the google-workspace MCP server package, not in our client.
