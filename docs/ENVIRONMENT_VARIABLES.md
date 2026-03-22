# Environment variables

Code Companion reads **environment variables** for the Node server, tests, and tooling. Most day-to-day settings (Ollama URL, project folder, MCP clients) live in **`.cc-config.json`**, not in `.env`.

## Server (`server.js`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `HOST` | *(see below)* | Overrides bind address. If unset: **`127.0.0.1`** unless `CC_BIND_ALL=1`, then **`0.0.0.0`**. |
| `CC_BIND_ALL` | unset | Set to `1` to listen on **all interfaces** (`0.0.0.0`) when `HOST` is not set. Use for LAN access; prefer **localhost-only** when possible. |
| `CC_API_SECRET` | unset | If set, clients may send header **`X-CC-API-Key: <same value>`** to call **sensitive** endpoints from non-loopback IPs (e.g. browser opened as `http://192.168.x.x:PORT`). |
| `VITE_CC_API_KEY` | unset | **Vite build-time** — same value as **`CC_API_SECRET`** so the SPA can send **`X-CC-API-Key`** on **`apiFetch`** requests (embedded in the bundle; use only on trusted networks). |
| `CC_CORS_ALLOW_LAN` | unset | Set to `1` to allow **any** browser `Origin` (legacy wide open). Default CORS allows **`localhost` / `127.0.0.1`** origins and `CC_ALLOWED_ORIGINS`. |
| `CC_ALLOWED_ORIGINS` | unset | Comma-separated extra allowed origins (e.g. `http://192.168.1.10:8900`) when not using `CC_CORS_ALLOW_LAN=1`. |
| `PORT` | from config or `8900` | Overrides `preferredPort` in `.cc-config.json` when set. |
| `FORCE_HTTP` | unset | Set to `1` to **disable HTTPS** even if `cert/server.crt` and `cert/server.key` exist (e.g. Playwright, rate-limit tests). |
| `DEBUG` | unset | Set to `1` or `true` for verbose server logging. |
| `CC_DATA_DIR` | app directory | Data root for config, history, logs (Electron sets this). |

**Sensitive endpoints** (localhost loopback, or `X-CC-API-Key` when `CC_API_SECRET` is set): `POST /api/config`, `POST /api/files/save`, `POST /api/validate/install`, `POST /api/github/token`, `POST /api/github/push`, `GET /api/logs`, all `/api/mcp/*`, and **`POST /mcp`** (HTTP MCP). Use **`http://127.0.0.1:PORT`** or **`http://localhost:PORT`** in the browser when testing from the same machine, or set **`CC_API_SECRET`** for LAN URLs.

## Rate limiting (optional overrides)

All use a window in ms via `RATE_LIMIT_WINDOW_MS` (default `60000`).

| Variable | Default | Applies to |
|----------|---------|------------|
| `RATE_LIMIT_WINDOW_MS` | `60000` | All rate limiters below |
| `RATE_LIMIT_MAX_CHAT` | `30` | `POST /api/chat` |
| `RATE_LIMIT_MAX_CREATE` | `12` | Create/build project endpoints |
| `RATE_LIMIT_MAX_GITHUB_CLONE` | `6` | `POST /api/github/clone` |
| `RATE_LIMIT_MAX_MCP_TEST` | `12` | `POST /api/mcp/clients/test-connection` |
| `RATE_LIMIT_MAX_REVIEW` | `20` | `POST /api/review`, `/api/pentest` |
| `RATE_LIMIT_MAX_SCORE` | `20` | `POST /api/score` |
| `RATE_LIMIT_MAX_MEMORY` | `30` | Memory write/delete routes |
| `RATE_LIMIT_MAX_API_GLOBAL` | `300` | Broad cap per IP for **all** `/api/*` methods (in addition to per-route limits) |

## Agent terminal (`lib/builtin-agent-tools.js`)

| Variable | Purpose |
|----------|---------|
| `CC_ALLOW_AGENT_TERMINAL` | Set to `1` to allow the agent terminal when the server binds to **`0.0.0.0`** / **`::`** (see `CC_BIND_ALL` / `HOST`). Matches `lib/builtin-agent-tools.js` exposure check. |

## Playwright (`playwright.config.js`)

| Variable | Purpose |
|----------|---------|
| `BASE_URL` | Base URL for tests (default `https://127.0.0.1:4173`). Use `http://127.0.0.1:4173` if the test web server uses `FORCE_HTTP=1` (matches `webServer` in config). |

## Docling / Electron

| Variable | Purpose |
|----------|---------|
| `UV_TOOL_BIN_DIR` | Optional path prefix when resolving `docling-serve` (`lib/docling-starter.js`, Electron docling manager). |

## MCP stdio (`mcp-server.js`)

| Variable | Purpose |
|----------|---------|
| `DEBUG` | `1` enables debug logging for the stdio MCP entrypoint. |

## Config file vs env

- **`.cc-config.json`** (or path under `CC_DATA_DIR`): Ollama URL, project folder, review timeouts, MCP client definitions, GitHub token (stored on disk — protect file permissions).
- **`.env`** in the repo root is optional and **not required** for normal runs; use it only if you inject secrets locally without committing them. Prefer UI **Settings** or editing `.cc-config.json` for persistent app configuration.
