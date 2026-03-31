# Environment variables

Code Companion reads **environment variables** for the Node server, tests, and tooling. Most day-to-day settings (Ollama URL, project folder, MCP client definitions) live in **`.cc-config.json`**. **Secrets** should live in **`.env`**: when a variable is set in both places, **`.env` wins** for Ollama (`OLLAMA_API_KEY`), Docling (`DOCLING_API_KEY`), GitHub (`GITHUB_TOKEN` / `GH_TOKEN`), and MCP stdio child env (e.g. `GEMINI_API_KEY` overlapping a client’s `env` block).

**Electron** loads **repo-root** `.env` first, then **`${CC_DATA_DIR}/.env`** if present (**`override: true`**). On macOS packaged builds, **`CC_DATA_DIR`** is **`~/Library/Application Support/code-companion`**, so you can keep **`GEMINI_API_KEY`**, **`STITCH_API_KEY`**, **`GITHUB_TOKEN`**, etc. only in **`~/Library/Application Support/code-companion/.env`**. Dev mode often uses **`./CodeCompanion-Data/.env`** the same way.

**Two stdio MCP servers** that both need `GITHUB_PERSONAL_ACCESS_TOKEN` with **different** values: use **`MCP_{clientId}__SECRETNAME`** where **`clientId`** is the MCP client **`id`** with non-alphanumeric characters replaced by **`_`** (e.g. `github-3rdaai-admin` → **`MCP_github_3rdaai_admin__GITHUB_PERSONAL_ACCESS_TOKEN`**). See **`lib/mcp-client-manager.js`** (`buildStdioMcpEnv`).

## `.cc-config.json` (selected keys)

| Key                                   | Purpose                                                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ollamaUrl`                           | Ollama API base URL (default `http://localhost:11434`).                                                                                                                                           |
| `ollamaApiKey`                        | Optional Bearer token for Ollama Cloud. **`OLLAMA_API_KEY` in `.env` overrides** this when set.                                                                                                   |
| `autoModelMap`                        | Per-mode preferred model names when the UI sends **`model: "auto"`** (toolbar **Auto (best per mode)**). Merged with built-in defaults from **`lib/auto-model.js`**.                              |
| `selectedModel`                       | Optional default model name for server-side fallbacks (e.g. MCP).                                                                                                                                 |
| `reviewTimeoutSec` / `chatTimeoutSec` | AI timeouts (see Settings).                                                                                                                                                                       |
| `mcpClients`                          | Array of external MCP server definitions (Settings → **MCP Clients**). Persisted by the server; see **`docs/TROUBLESHOOTING.md`** if the list is empty (Electron **`CC_DATA_DIR`** vs repo root). |

### Where `.cc-config.json` is loaded from

The server uses **`path.join(dataRoot, '.cc-config.json')`** with **`dataRoot = process.env.CC_DATA_DIR || __dirname`**. So:

- **CLI from the repo:** config is **`./.cc-config.json`** next to **`server.js`**.
- **Electron:** **`CC_DATA_DIR`** points at the app data directory (e.g. **`CodeCompanion-Data/`** in dev); that copy is the one the running server reads.

For empty MCP clients or “wrong” settings in Electron dev, see **`docs/TROUBLESHOOTING.md`**.

## Server (`server.js`)

| Variable                              | Default               | Purpose                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HOST`                                | _(see below)_         | Overrides bind address. If unset: **`127.0.0.1`** unless `CC_BIND_ALL=1`, then **`0.0.0.0`**.                                                                                                                                                                                                                                            |
| `CC_BIND_ALL`                         | unset                 | Set to `1` to listen on **all interfaces** (`0.0.0.0`) when `HOST` is not set. Use for LAN access; prefer **localhost-only** when possible.                                                                                                                                                                                              |
| `CC_API_SECRET`                       | unset                 | If set, clients may send header **`X-CC-API-Key: <same value>`** to call **sensitive** endpoints from non-loopback IPs (e.g. browser opened as `http://192.168.x.x:PORT`).                                                                                                                                                               |
| `VITE_CC_API_KEY`                     | unset                 | **Vite build-time** — same value as **`CC_API_SECRET`** so the SPA can send **`X-CC-API-Key`** on **`apiFetch`** requests (embedded in the bundle; use only on trusted networks).                                                                                                                                                        |
| `CC_CORS_ALLOW_LAN`                   | unset                 | Set to `1` to allow **any** browser `Origin` (legacy wide open). Default CORS allows **`localhost` / `127.0.0.1`** origins and `CC_ALLOWED_ORIGINS`.                                                                                                                                                                                     |
| `CC_ALLOWED_ORIGINS`                  | unset                 | Comma-separated extra allowed origins (e.g. `http://192.168.1.10:8900`) when not using `CC_CORS_ALLOW_LAN=1`.                                                                                                                                                                                                                            |
| `PORT`                                | from config or `8900` | Overrides `preferredPort` in `.cc-config.json` when set.                                                                                                                                                                                                                                                                                 |
| `FORCE_HTTP`                          | unset                 | Set to `1` to **disable HTTPS** even if `cert/server.crt` and `cert/server.key` exist (e.g. Playwright, rate-limit tests).                                                                                                                                                                                                               |
| `DEBUG`                               | unset                 | Set to `1` or `true` for verbose server logging.                                                                                                                                                                                                                                                                                         |
| `CC_DATA_DIR`                         | app directory         | Data root for config, history, logs (Electron sets this).                                                                                                                                                                                                                                                                                |
| `OLLAMA_API_KEY`                      | unset                 | **Ollama Cloud** — Bearer token for `https://ollama.com` (or any Ollama endpoint that requires auth). **Takes precedence over** **`ollamaApiKey`** in **`.cc-config.json`** when set. **`server.js`** and **`electron/main.js`** load **`.env`** from the app/repo root (via **dotenv**) before the server runs (do not commit secrets). |
| `DOCLING_API_KEY`                     | unset                 | **Docling-serve** — optional `X-Api-Key` header. **Takes precedence over** **`docling.apiKey`** in **`.cc-config.json`** when set.                                                                                                                                                                                                       |
| `GITHUB_TOKEN` / `GH_TOKEN`           | unset                 | **GitHub API / clone** when legacy **`githubToken`** in config is empty.                                                                                                                                                                                                                                                                 |
| `GITHUB_TOKEN_0`, `GITHUB_TOKEN_1`, … | unset                 | **Multi-account PATs** — when **`githubTokens[n].token`** in config is empty, the server uses **`GITHUB_TOKEN_n`** (same order as the array).                                                                                                                                                                                            |
| `MCP_{id}__…`                         | unset                 | **Per–stdio-MCP secrets** — e.g. **`MCP_github_3rdaai_admin__GITHUB_PERSONAL_ACCESS_TOKEN`** so two GitHub MCP clients can use different PATs (see intro above).                                                                                                                                                                         |

**Sensitive endpoints** (localhost loopback, or `X-CC-API-Key` when `CC_API_SECRET` is set): `POST /api/config`, `POST /api/files/save`, `POST /api/validate/install`, `POST /api/github/token`, `POST /api/github/push`, `GET /api/logs`, all `/api/mcp/*`, and **`POST /mcp`** (HTTP MCP). Use **`http://127.0.0.1:PORT`** or **`http://localhost:PORT`** in the browser when testing from the same machine, or set **`CC_API_SECRET`** for LAN URLs.

## Rate limiting (optional overrides)

All use a window in ms via `RATE_LIMIT_WINDOW_MS` (default `60000`).

| Variable                      | Default | Applies to                                                                      |
| ----------------------------- | ------- | ------------------------------------------------------------------------------- |
| `RATE_LIMIT_WINDOW_MS`        | `60000` | All rate limiters below                                                         |
| `RATE_LIMIT_MAX_CHAT`         | `30`    | `POST /api/chat`                                                                |
| `RATE_LIMIT_MAX_CREATE`       | `12`    | Create/build project endpoints                                                  |
| `RATE_LIMIT_MAX_GITHUB_CLONE` | `6`     | `POST /api/github/clone`                                                        |
| `RATE_LIMIT_MAX_MCP_TEST`     | `12`    | `POST /api/mcp/clients/test-connection`                                         |
| `RATE_LIMIT_MAX_REVIEW`       | `20`    | `POST /api/review`, `/api/pentest`                                              |
| `RATE_LIMIT_MAX_SCORE`        | `20`    | `POST /api/score`                                                               |
| `RATE_LIMIT_MAX_MEMORY`       | `30`    | Memory write/delete routes                                                      |
| `RATE_LIMIT_MAX_API_GLOBAL`   | `300`   | Broad cap per IP for **all** `/api/*` methods (in addition to per-route limits) |

## Agent terminal (`lib/builtin-agent-tools.js`)

| Variable                  | Purpose                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CC_ALLOW_AGENT_TERMINAL` | Set to `1` to allow the agent terminal when the server binds to **`0.0.0.0`** / **`::`** (see `CC_BIND_ALL` / `HOST`). Matches `lib/builtin-agent-tools.js` exposure check. |

## Playwright (`playwright.config.js`)

| Variable   | Purpose                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BASE_URL` | Base URL for tests (default **`http://127.0.0.1:4173`**, matches `webServer` + `FORCE_HTTP=1`). If **`server.js`** serves **HTTPS** (certs present, **`FORCE_HTTP` unset**), set **`BASE_URL=https://127.0.0.1:PORT`** and use **`PW_REUSE_SERVER=1`** to attach to an already-running server. Playwright enables **`ignoreHTTPSErrors`** when **`BASE_URL`** starts with **`https://`**. |

## Electron packager (`electron-builder.config.js`)

| Variable                                    | Purpose                                                                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MAC_DISTRIBUTION_SIGN`                     | Set to `1` for **Developer ID** signing + **hardened runtime**. Requires **`MAC_CODESIGN_IDENTITY`**. Used by `electron:build:mac:release` / `electron:publish:mac:release`.                                             |
| `MAC_CODESIGN_IDENTITY`                     | **Developer ID Application** certificate: full Keychain name or common name only (e.g. `Developer ID Application: Name (TEAMID)` or `Name (TEAMID)`). `electron-builder.config.js` strips the `Developer ID Application:` prefix for electron-builder 26+. Required when `MAC_DISTRIBUTION_SIGN=1`. If **CI** fails while a local mac build succeeds, compare logs: some pipelines fail on stderr from electron-builder even when optional platform deps are missing (see **BUILD.md** Architecture). |
| `MAC_NOTARIZE`                              | Set to `1` to enable **notarization** (slow). Requires **`APPLE_TEAM_ID`**, **`APPLE_ID`**, **`APPLE_APP_SPECIFIC_PASSWORD`** (and distribution signing); see **BUILD.md**.                                              |
| `APPLE_TEAM_ID`                             | 10-character Team ID for `notarize.teamId` when `MAC_NOTARIZE=1`.                                                                                                                                                        |
| `APPLE_ID`                                  | Apple ID email for notarization (not your password).                                                                                                                                                                     |
| `APPLE_APP_SPECIFIC_PASSWORD`               | App-specific password for notarization API.                                                                                                                                                                              |
| `WIN_DISTRIBUTION_SIGN`                     | Set to `1` for **Windows Authenticode** via `.pfx` or certificate store. Requires **`WIN_CSC_LINK`/`CSC_LINK`** or **`CSC_NAME`/`WIN_CSC_NAME`**. Used by `electron:build:win:release` / `electron:publish:win:release`. |
| `WIN_CSC_LINK`                              | Path to **`.pfx`** (optional if `CSC_LINK` set).                                                                                                                                                                         |
| `CSC_LINK`                                  | electron-builder default: path to `.pfx` for Windows (and other) signing.                                                                                                                                                |
| `WIN_CSC_KEY_PASSWORD` / `CSC_KEY_PASSWORD` | Password for the `.pfx`.                                                                                                                                                                                                 |
| `CSC_NAME` / `WIN_CSC_NAME`                 | Sign using a certificate **subject name** in the store (alternative to `.pfx`).                                                                                                                                          |
| `LINUX_GPG_SIGN`                            | Set to `1` to create **detached GPG signatures** (`.asc`) for **`*.AppImage`** after build. Used by `electron:build:linux:release` / `electron:publish:linux:release`.                                                   |
| `LINUX_GPG_KEY_ID`                          | GPG key id or fingerprint for `gpg --local-user` when `LINUX_GPG_SIGN=1`.                                                                                                                                                |

Default **`npm run electron:build:mac`** / **`:win`** / **`:linux`** do **not** set distribution signing flags — fastest local iteration.

### GitHub Actions (`.github/workflows/build.yml`)

These are **repository secrets**, not shell env files. When **`MAC_CERTS`** + **`MAC_CERTS_PASSWORD`** + **`MAC_CODESIGN_IDENTITY`** are set, the macOS job runs a **Developer ID** build; otherwise it stays **ad-hoc**. Optional notarization uses **`APPLE_TEAM_ID`**, **`APPLE_ID`**, **`APPLE_APP_SPECIFIC_PASSWORD`** together with the signing secrets. See **BUILD.md** (GitHub Actions subsection under macOS code signing).

## Docling / Electron

| Variable          | Purpose                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `UV_TOOL_BIN_DIR` | Optional path prefix when resolving `docling-serve` (`lib/docling-starter.js`, Electron docling manager). |

## MCP stdio (`mcp-server.js`)

| Variable | Purpose                                                 |
| -------- | ------------------------------------------------------- |
| `DEBUG`  | `1` enables debug logging for the stdio MCP entrypoint. |

## Config file vs env

- **`.cc-config.json`** (or path under `CC_DATA_DIR`): Ollama URL, optional **`ollamaApiKey`** (Ollama Cloud), project folder, review timeouts, MCP client definitions, GitHub token (stored on disk — protect file permissions).
- **`.env`** in the repo root is optional and **not required** for normal runs; use it only if you inject secrets locally without committing them. Prefer UI **Settings** or editing `.cc-config.json` for persistent app configuration.

## See also

- **`docs/TROUBLESHOOTING.md`** — “Failed to fetch”, MCP clients vs config path, log file locations, Ollama **`fetch failed`** in **`logs/app.log`**.
