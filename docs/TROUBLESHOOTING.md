# Troubleshooting

Common issues for Code Companion (web + Electron). For env vars and network binding, see **[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)**.

## “Failed to fetch” in chat

The browser shows **Technical detail: Failed to fetch** when **`fetch()` to this app’s server** never completes (no HTTP response). That is **not** the same as “Ollama is down,” which usually returns a normal error body from **`POST /api/chat`**.

**Check:**

1. **Server running** — The page must load from the same Code Companion process that handles **`/api/chat`**. Restart **`./startup.sh`**, **`node server.js`**, or the desktop app.
2. **Same URL** — Use the same scheme, host, and port as in the address bar (e.g. **`https://127.0.0.1:8900`**). A bookmark to another host/port will break API calls.
3. **HTTPS + self-signed cert** — If you use **`https://`**, open the site once and **accept the certificate**; otherwise the browser may block requests.
4. **LAN / API key** — Sensitive routes need loopback **or** **`CC_API_SECRET`** on the server and **`VITE_CC_API_KEY`** in the built SPA (see **ENVIRONMENT_VARIABLES.md**).

## Chat: the model says “413”, “Docling failed”, or “conversion service” errors

The assistant **does not receive HTTP status codes** from your browser. If it mentions **413**, **payload too large**, or a failed **Docling** / **conversion service** without you having pasted an **exact** error message, it may be **hallucinating** — especially when a **PDF** or binary file was attached as **raw bytes** or only a **filename** appears in the message.

**What to do:**

1. **Confirm in `logs/app.log`** — Look for **`POST /api/convert-document`** at the time of the issue. If there is **no** matching line, the app did not run server conversion; the model invented the error.
2. **Project files** — For PDFs **under Settings → Project folder**, the agent is instructed to use **`builtin.generate_office_file`** with **`sourcePath`** (project-relative path) so the server reads the file on disk.
3. **Real failures** — If **`POST /api/convert-document`** returns **413**, the file may exceed the route limit; if Docling is offline, see **`docs/DOCLING-AUTO-START.md`** and **`GET /api/docling/health`**.

## Ollama errors in server logs (`fetch failed`)

If **`logs/app.log`** contains **`Ollama chatComplete failed`** with **`"error":"fetch failed"`**, the **Node server** could not complete an HTTP request **to Ollama** (wrong **`ollamaUrl`**, Ollama stopped, firewall, or timeout on long runs). Confirm **`curl -s http://127.0.0.1:11434/api/tags`** (or your configured URL) from the same machine. Fix **`ollamaUrl`** in **`.cc-config.json`** or Settings if you use a LAN IP.

## Nano Banana image generation: timeout/connection issues

If image generation intermittently fails with **`MCP error -32001: Request timed out`** or **`MCP error -32000: Connection closed`**:

1. **Check MCP call logs first** in `logs/app.log`:
   - `MCP tool call started` includes `callId`, `toolName`, and `timeoutMs`.
   - Match the same `callId` against `MCP tool call succeeded` / `MCP tool call failed`.
2. **Reconnect nano banana** in **Settings → MCP Clients** when transport errors appear (`Connection closed`).
3. **Increase image timeout budget** in `.env` if needed:
   - `MCP_TOOL_TIMEOUT_MS` (all MCP tools, default `120000`)
   - `MCP_IMAGE_TOOL_TIMEOUT_MS` (image calls, default `180000`)
   - For `generate_image`, the app uses the larger of the two values.
4. **Verify provider auth is loaded** for packaged Electron:
   - macOS app data `.env`: `~/Library/Application Support/code-companion/.env`
   - ensure `GEMINI_API_KEY` is set and nano banana is reconnected after key changes.

If the tool call succeeds but the assistant text claims quota issues, check `debug.log` for `MCP tool result` (`partTypes`, `resultKeys`) to confirm the provider payload before trusting model interpretation.

## Generated images: copy/download controls

Generated assistant images now expose inline **Copy** and **Download** actions directly under each image in chat. If buttons are missing:

1. Ensure you are on a build that includes the assistant-image UI update (desktop app rebuild/reinstall may be required).
2. Confirm the message actually contains image payload (`partTypes: ["text","image"]` in `debug.log`).
3. Clicking the image still opens the lightbox, which also includes download controls.

## Assistant says “Generated image” but no image appears

New chat guardrails now block unverified success claims. The assistant message text is sanitized unless a real `toolImage` payload is present in that response.

If this still happens in an older build:

1. Check `logs/app.log` for matching `MCP tool call started` + `MCP tool call succeeded` entries for the same `callId`.
2. If there is no corresponding MCP success entry, treat the claim as unverified model text (not an actual generated image).
3. Upgrade/rebuild to a version that includes `src/lib/chat-image-claims.js` + `useChat` sanitization.

## MCP clients missing in Settings

**External MCP servers** are stored in **`mcpClients`** inside **`.cc-config.json`**, but the file location depends on how you run the app:

**Secrets:** The whole **`.cc-config.json`** file can contain tokens and keys (GitHub, MCP `env`, Ollama Cloud, etc.). It is **gitignored** — see **`docs/CC-CONFIG.md`** before committing or sharing your config.

| How you run                                               | Config file                                                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **`node server.js`** from the repo (no **`CC_DATA_DIR`**) | **`<repo>/.cc-config.json`**                                                                                     |
| **Electron (dev)**                                        | **`<repo>/CodeCompanion-Data/.cc-config.json`** (server gets **`CC_DATA_DIR`**)                                  |
| **Electron (packaged)**                                   | Under the app data directory (e.g. macOS **`~/Library/Application Support/code-companion/`**), not the git clone |

**Unpackaged Electron dev:** On startup, if the data-dir config has **no** MCP clients but the **repo root** `.cc-config.json` does, the app **copies `mcpClients`** into the data-dir config once (so Settings matches the file developers often edit in git). **Restart** the app after editing the repo file so this can run.

**LAN UI:** **`GET /api/mcp/clients`** is a sensitive route — use **`http://127.0.0.1:…`** or matching **`X-CC-API-Key`** (see **ENVIRONMENT_VARIABLES.md**).

**Archon (Docker MCP on :8051):** Example **`mcpClients`** entry and smoke test — **[ARCHON-MCP.md](./ARCHON-MCP.md)**.

## Log files

| Scenario                            | Typical path                                         |
| ----------------------------------- | ---------------------------------------------------- |
| **`node server.js`** from repo root | **`logs/app.log`**, **`logs/debug.log`**             |
| **`CC_DATA_DIR`** set (Electron)    | **`<CC_DATA_DIR>/logs/app.log`**                     |
| Electron startup issues             | **`/tmp/code-companion-startup.log`** (when written) |

**Tip:** Set **`DEBUG=1`** for more verbose **`debug.log`** output.

## macOS: app crashes immediately — **Code Signature Invalid** (`SIGKILL`)

Crash reports may show **`EXC_CRASH (SIGKILL (Code Signature Invalid))`**, **`Termination Reason: CODESIGNING`**, or **`Taskgated Invalid Signature`**. This is **not** an Ollama or React bug — the system is rejecting the **app bundle’s signature**, often after a **failed auto-update** (see **`~/Library/Logs/code-companion/main.log`** for **electron-updater** / ShipIt messages).

**Remediation:** Clear **`~/Library/Caches/com.th3rdai.code-companion.ShipIt`**, remove the broken **`Code Companion.app`**, reinstall from a **fresh DMG** on [GitHub Releases](https://github.com/th3rdai/CodeCompanion/releases). Full steps: **[INSTALL-MAC.md — Crash on launch: Code Signature Invalid](./INSTALL-MAC.md#crash-on-launch-code-signature-invalid-sigkill-taskgated-invalid-signature)**.

## Related

- **[TESTING.md](./TESTING.md)** — Playwright **`BASE_URL`** for HTTPS, **`PW_REUSE_SERVER`**
- **[INSTALL-MAC.md](./INSTALL-MAC.md)** — Gatekeeper, **code signature / ShipIt** crashes, tail log path for packaged macOS app
