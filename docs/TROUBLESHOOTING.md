# Troubleshooting

Common issues for Code Companion (web + Electron). For env vars and network binding, see **[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)**.

## “Failed to fetch” in chat

The browser shows **Technical detail: Failed to fetch** when **`fetch()` to this app’s server** never completes (no HTTP response). That is **not** the same as “Ollama is down,” which usually returns a normal error body from **`POST /api/chat`**.

**Check:**

1. **Server running** — The page must load from the same Code Companion process that handles **`/api/chat`**. Restart **`./startup.sh`**, **`node server.js`**, or the desktop app.
2. **Same URL** — Use the same scheme, host, and port as in the address bar (e.g. **`https://127.0.0.1:8900`**). A bookmark to another host/port will break API calls.
3. **HTTPS + self-signed cert** — If you use **`https://`**, open the site once and **accept the certificate**; otherwise the browser may block requests.
4. **LAN / API key** — Sensitive routes need loopback **or** **`CC_API_SECRET`** on the server and **`VITE_CC_API_KEY`** in the built SPA (see **ENVIRONMENT_VARIABLES.md**).

## Context budget banner: token estimation

The **preflight context banner** (CTXFIX Phase 1) appears above chat when the pending message + history approaches the model's context window (80% threshold). The token count shown is an **estimate** based on character length — actual tokenization may differ slightly.

**Banner doesn't appear:**

1. Check **`enablePreflightBanner`** in **`.cc-config.json`** (default **`false`** in v1.7.0; flipped to **`true`** in v1.7.1).
2. Verify the toolbar model selector shows a model (not "Loading...") so the UI can fetch context length via **`GET /api/model-context`**.
3. If using **Auto (best per mode)**, the endpoint resolves the actual model first — may be slower on first use.

**Percentage seems wrong:**

The estimator uses **`Math.ceil(totalChars / 3.5)`** as a conservative approximation. Different models tokenize text differently (especially with code, emojis, or non-Latin scripts), so the banner percentage is **guidance only**. The server auto-boosts **`num_ctx`** when needed (see **`autoAdjustContext`** in **`lib/config.js`**).

**Banner flickers near the threshold:**

The server uses **256-token hysteresis buckets** and **5-minute caching** to reduce API calls and UI flicker. Minor changes near 80% may take a few keystrokes to cross the boundary visibly.

## Chat: the model says "413", "Docling failed", or "conversion service" errors

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

**Crawl4AI RAG (Docker MCP on :8054, SSE):** Separate repo / compose; **`mcpClients`** uses **`transport`: `"sse"`** and **`url`** ending in **`/sse`** — **[CRAWL4AI-RAG-MCP.md](./CRAWL4AI-RAG-MCP.md)**.

## Chat: MCP tools from Settings do not run

The model only receives **tools from MCP servers that are connected** in memory (`McpClientManager`). Saving a row in **Settings → MCP Clients** writes config only; the server must **connect** (green status) so `listTools` runs and tools appear in the chat prompt.

1. In Settings, confirm each server shows **Connected** (or enable **Connect automatically after saving** when adding/editing).
2. After **Edit**, the app reconnects when **Connect automatically** is on; if it is off, click **Connect** manually. If connect fails, the **banner or Add/Edit modal** shows a short error and tells you to open **`logs/app.log`** on the machine running Code Companion.
3. In **`logs/app.log`**, search for **`MCP connect failed`**. Each **`[ERROR]`** line includes JSON with **`phase`** (`after-add`, `after-update`, or `manual`), **`clientId`**, **`transport`**, and for stdio **`command`** / **`args`** or for remote **`url`**, plus the full **`error`** string — use that to fix the command, URL, env, or upstream MCP server.
4. Only entries with **`autoConnect`: true** are connected on **app startup** (unless **`CC_SKIP_MCP_AUTOCONNECT=1`**). Others need a manual **Connect** after each restart.

## Log files

| Scenario                            | Typical path                                                    |
| ----------------------------------- | --------------------------------------------------------------- |
| **`node server.js`** from repo root | **`logs/app.log`**, **`logs/debug.log`**                        |
| **`CC_DATA_DIR`** set (Electron)    | **`<CC_DATA_DIR>/logs/app.log`**                                |
| Packaged app (macOS, default)       | **`~/Library/Application Support/code-companion/logs/app.log`** |
| Electron startup issues             | **`/tmp/code-companion-startup.log`** (when written)            |

**Tip:** Set **`DEBUG=1`** for more verbose **`debug.log`** output.

## macOS: app crashes immediately — **Code Signature Invalid** (`SIGKILL`)

Crash reports may show **`EXC_CRASH (SIGKILL (Code Signature Invalid))`**, **`Termination Reason: CODESIGNING`**, or **`Taskgated Invalid Signature`**. This is **not** an Ollama or React bug — the system is rejecting the **app bundle’s signature**, often after a **failed auto-update** (see **`~/Library/Logs/code-companion/main.log`** for **electron-updater** / ShipIt messages).

**Remediation:** Clear **`~/Library/Caches/com.th3rdai.code-companion.ShipIt`**, remove the broken **`Code Companion.app`**, reinstall from a **fresh DMG** on [GitHub Releases](https://github.com/th3rdai/CodeCompanion/releases). Full steps: **[INSTALL-MAC.md — Crash on launch: Code Signature Invalid](./INSTALL-MAC.md#crash-on-launch-code-signature-invalid-sigkill-taskgated-invalid-signature)**.

## GitNexus

[GitNexus](https://www.npmjs.com/package/gitnexus) powers **`gitnexus_query`** in Cursor (see **`AGENTS.md`**). This repo keeps a healthy index under **`.gitnexus/`** (see **`.gitnexus/meta.json`**). **Until `npm install` can pin `gitnexus` in the lockfile again**, use the CLI via **`npx -p gitnexus@1.6.5`** (or **`npm run gitnexus -- …`**, which wraps that) — not a local **`node_modules/gitnexus`** install.

### When `npm install` fails (`node.target` is null)

**Symptoms:**

- **`npm install`** in the repo root exits with:
  ```text
  npm error Cannot destructure property 'package' of 'node.target' as it is null.
  ```
- Stack trace points at **`@npmcli/arborist`** **`rebuild`** (often right after **`gitnexus@1.6.5 postinstall`**).

**Cause:** npm **11.x** can crash while reconciling **gitnexus** ( **`file:`** / git optional deps like **`tree-sitter-dart`** ) when the lockfile still pins an older **gitnexus** tree (e.g. **1.6.3**) while **`package.json`** requests **^1.6.5**. This is an **npm arborist** bug ([#7027](https://github.com/npm/cli/issues/7027), [GitNexus #819](https://github.com/abhigyanpatwari/GitNexus/issues/819)) — not a broken Code Companion app.

**Workaround (recommended):** Do **not** add **`gitnexus`** as a **`devDependency`** until the lockfile/npm combo is fixed upstream. Use a pinned **`npx`** runner instead:

```bash
# Re-index (disable GitNexus MCP in Cursor first)
npx -p gitnexus@1.6.5 gitnexus clean --force
GITNEXUS_EMBEDDING_DIMS=768 npx -p gitnexus@1.6.5 gitnexus analyze --force

# Smoke-test keyword search
npx -p gitnexus@1.6.5 gitnexus query "chat handler" --repo CodeCompanion

# Cursor MCP (global CLI on PATH)
npm i -g gitnexus@1.6.5
```

From this repo you can also run **`npm run gitnexus -- <subcommand>`** (same **`npx -p gitnexus@1.6.5`** pin). **`npm install`** in the project should then complete normally (no local **gitnexus** in **`node_modules`**).

**If you still need a local install:** try a clean lock regen in a throwaway folder (`npm init -y && npm i gitnexus@1.6.5`) or **`npm i -g gitnexus@1.6.5`** — avoid upgrading **1.6.3 → 1.6.5** inside a stale **`package-lock.json`** until arborist is fixed.

### `query` empty / “FTS indexes missing”

**`context`** and **`impact`** work without FTS; **`query`** (concept / keyword search) needs full-text indexes on **`.gitnexus/lbug`**.

**Symptoms:**

- MCP or CLI **`gitnexus query`** returns empty **`processes`** with a warning about FTS.
- Logs mention **`Cannot execute write operations in a read-only database`** when ensuring FTS indexes.

**Cause (gitnexus ≤1.6.3):** FTS was deferred to the first **`query`**, but the **MCP server opens the index read-only**, so **`CREATE_FTS_INDEX`** failed. **Fixed upstream in gitnexus ≥1.6.5** ([#1107](https://github.com/abhigyanpatwari/GitNexus/pull/1107)) — **`analyze`** builds FTS while the DB is writable. Use **`gitnexus@1.6.5`** via **`npx -p`** / global install (see above).

**Fix (≥1.6.5):** Re-index with MCP off:

```bash
npx -p gitnexus@1.6.5 gitnexus clean --force
GITNEXUS_EMBEDDING_DIMS=768 npx -p gitnexus@1.6.5 gitnexus analyze --force
```

Confirm **`.gitnexus/meta.json`** shows **`capabilities.fts.status": "available"`**. You should **not** need **`npm run gitnexus:warm-fts`** after a successful analyze.

**Fix (legacy 1.6.3 only):** Disable MCP, then **`npm run gitnexus:warm-fts`**, re-enable MCP.

**Re-index:** After large code changes, run **`npx -p gitnexus@1.6.5 gitnexus analyze`** (or **`--force`**), then **`npm run gitnexus:warm-fts`** again (MCP off). If you see **`Corrupted wal file`**, run **`npx -p gitnexus@1.6.5 gitnexus clean --force`**, then analyze again (do not open **`lbug`** with MCP or Chrome while analyze runs).

**Embeddings (recommended on macOS):** Default **`analyze --embeddings`** uses local ONNX and often **exits 1** or segfaults on Node 24. Use **Ollama HTTP** instead (with MCP off):

```bash
npm run gitnexus:embed
```

This runs **`scripts/gitnexus-analyze-embeddings.mjs`**: **`clean --force`**, then **`analyze --embeddings`** with **`GITNEXUS_EMBEDDING_URL`** (base only, e.g. **`http://127.0.0.1:11434/v1`** — GitNexus appends **`/embeddings`**), **`GITNEXUS_EMBEDDING_MODEL`** (default **`nomic-embed-text`**), and **`GITNEXUS_EMBEDDING_DIMS=768`**. The index must be built with the same **`GITNEXUS_EMBEDDING_DIMS`** as your model output (384 for the built-in snowflake model, 768 for **`nomic-embed-text`**).

**Cursor MCP:** Add the same three env vars under the **`gitnexus`** server in **`~/.cursor/mcp.json`** so **`query`** can embed search strings at runtime. Example:

```json
"env": {
  "GITNEXUS_EMBEDDING_URL": "http://127.0.0.1:11434/v1",
  "GITNEXUS_EMBEDDING_MODEL": "nomic-embed-text",
  "GITNEXUS_EMBEDDING_DIMS": "768"
}
```

**Richer search:** Hybrid **`query`** uses vector embeddings when **`embeddings` > 0** in **`.gitnexus/meta.json`**. Without embeddings, BM25/FTS must work; if FTS warmup fails, **`query`** stays empty — use **`context`** / **`impact`** or fix FTS + embeddings.

**Stale MCP process:** Disabling GitNexus in Cursor does not always exit **`gitnexus mcp`**. Check with **`pgrep -fl "gitnexus mcp"`** and **`lsof .gitnexus/lbug`**; kill the orphan PID before **`warm-fts`** or **`analyze`**.

**Warmup says OK but `query` still empty:** LadybugDB can leave orphan tables like **`2_function_fts_docs`** when **`CREATE_FTS_INDEX`** fails partway; GitNexus treats messages containing **`already exists`** as success. **`npm run gitnexus:warm-fts`** (v2 worker) drops those orphans before create and verifies with **`QUERY_FTS_INDEX`**. If verify still fails or Node **segfaults** during FTS create, use **`context`** / **`impact`** instead, or **`npx gitnexus analyze --embeddings`** for vector-only **`query`** (slow; may fail on some Node/macOS builds).

**macOS / Node 24 — embeddings segfault:** Ollama HTTP embedding (`npm run gitnexus:embed`) usually finishes all nodes then **segfaults** on the vector-index step, which can **corrupt `lbug.wal`**. Recovery: `npx -p gitnexus@1.6.5 gitnexus clean --force` then `npx -p gitnexus@1.6.5 gitnexus analyze` (graph only). If embed completed before the crash, try `npm run gitnexus:embed-meta` to copy the row count into **`meta.json`** (only works when the DB still opens).

**Re-enable MCP:** After the index is healthy, turn **GitNexus** back on in **Cursor → Settings → MCP**. Ensure **`~/.cursor/mcp.json`** includes the **`env`** block from the embeddings section above (base URL **`http://127.0.0.1:11434/v1`**, not `.../v1/embeddings`). **`context`** and **`impact`** work without FTS; **`query`** needs FTS warmup or embeddings — both are fragile on this stack.

**Still broken:** File an issue upstream (GitNexus + LadybugDB) — MCP read-only pool vs lazy FTS, embedding teardown segfaults, and partial FTS create state on disk.

## Related

- **[TESTING.md](./TESTING.md)** — Playwright **`BASE_URL`** for HTTPS, **`PW_REUSE_SERVER`**
- **[INSTALL-MAC.md](./INSTALL-MAC.md)** — Gatekeeper, **code signature / ShipIt** crashes, tail log path for packaged macOS app
