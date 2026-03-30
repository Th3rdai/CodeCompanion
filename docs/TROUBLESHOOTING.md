# Troubleshooting

Common issues for Code Companion (web + Electron). For env vars and network binding, see **[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)**.

## “Failed to fetch” in chat

The browser shows **Technical detail: Failed to fetch** when **`fetch()` to this app’s server** never completes (no HTTP response). That is **not** the same as “Ollama is down,” which usually returns a normal error body from **`POST /api/chat`**.

**Check:**

1. **Server running** — The page must load from the same Code Companion process that handles **`/api/chat`**. Restart **`./startup.sh`**, **`node server.js`**, or the desktop app.
2. **Same URL** — Use the same scheme, host, and port as in the address bar (e.g. **`https://127.0.0.1:8900`**). A bookmark to another host/port will break API calls.
3. **HTTPS + self-signed cert** — If you use **`https://`**, open the site once and **accept the certificate**; otherwise the browser may block requests.
4. **LAN / API key** — Sensitive routes need loopback **or** **`CC_API_SECRET`** on the server and **`VITE_CC_API_KEY`** in the built SPA (see **ENVIRONMENT_VARIABLES.md**).

## Ollama errors in server logs (`fetch failed`)

If **`logs/app.log`** contains **`Ollama chatComplete failed`** with **`"error":"fetch failed"`**, the **Node server** could not complete an HTTP request **to Ollama** (wrong **`ollamaUrl`**, Ollama stopped, firewall, or timeout on long runs). Confirm **`curl -s http://127.0.0.1:11434/api/tags`** (or your configured URL) from the same machine. Fix **`ollamaUrl`** in **`.cc-config.json`** or Settings if you use a LAN IP.

## MCP clients missing in Settings

**External MCP servers** are stored in **`mcpClients`** inside **`.cc-config.json`**, but the file location depends on how you run the app:

| How you run                                               | Config file                                                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **`node server.js`** from the repo (no **`CC_DATA_DIR`**) | **`<repo>/.cc-config.json`**                                                                                     |
| **Electron (dev)**                                        | **`<repo>/CodeCompanion-Data/.cc-config.json`** (server gets **`CC_DATA_DIR`**)                                  |
| **Electron (packaged)**                                   | Under the app data directory (e.g. macOS **`~/Library/Application Support/code-companion/`**), not the git clone |

**Unpackaged Electron dev:** On startup, if the data-dir config has **no** MCP clients but the **repo root** `.cc-config.json` does, the app **copies `mcpClients`** into the data-dir config once (so Settings matches the file developers often edit in git). **Restart** the app after editing the repo file so this can run.

**LAN UI:** **`GET /api/mcp/clients`** is a sensitive route — use **`http://127.0.0.1:…`** or matching **`X-CC-API-Key`** (see **ENVIRONMENT_VARIABLES.md**).

## Log files

| Scenario                            | Typical path                                         |
| ----------------------------------- | ---------------------------------------------------- |
| **`node server.js`** from repo root | **`logs/app.log`**, **`logs/debug.log`**             |
| **`CC_DATA_DIR`** set (Electron)    | **`<CC_DATA_DIR>/logs/app.log`**                     |
| Electron startup issues             | **`/tmp/code-companion-startup.log`** (when written) |

**Tip:** Set **`DEBUG=1`** for more verbose **`debug.log`** output.

## Related

- **[TESTING.md](./TESTING.md)** — Playwright **`BASE_URL`** for HTTPS, **`PW_REUSE_SERVER`**
- **[INSTALL-MAC.md](./INSTALL-MAC.md)** — tail log path for packaged macOS app
