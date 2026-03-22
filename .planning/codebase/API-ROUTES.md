# API Route Map

**Analysis Date:** 2025-03-21

Express routes live primarily in `server.js`; MCP **management** REST routes are mounted via `app.use('/api', mcpApiRouter)` from `lib/mcp-api-routes.js`. Rate limiters wrap several prefixes (see `server.js` near static middleware).

## Core & config

| Cluster | Routes (representative) | Module / notes |
|---------|-------------------------|----------------|
| **Config** | `GET/POST /api/config` | Read/update; sanitizes secrets for GET |
| **Models / Ollama** | `GET /api/models` | Lists models; connection check helpers in `lib/ollama-client.js` |
| **Logs** | `GET /api/logs` | Server log tail/download pattern |

## Chat & AI

| Cluster | Routes | Notes |
|---------|--------|------|
| **Chat (SSE)** | `POST /api/chat` | Server-Sent Events; tool rounds + streaming; see `AGENT-AND-MCP.md` |
| **Review** | `POST /api/review` | Structured review; `lib/review.js`, timeout from `reviewTimeoutSec` |
| **Scoring** | `POST /api/score` | Builder modes; `lib/builder-score.js` |
| **Tutorial** | `POST /api/tutorial-suggestions` | Ollama suggestions for Create/Build wizards |

## Security & validation

| Cluster | Routes | Notes |
|---------|--------|------|
| **Pentest** | `POST /api/pentest`, `/api/pentest/remediate`, `/api/pentest/folder`, `/api/pentest/folder/preview` | `lib/pentest.js` |
| **Validate** | `POST /api/validate/scan`, `/api/validate/generate`, `/api/validate/install` | `lib/validate.js` |

## Documents & export

| Cluster | Routes | Notes |
|---------|--------|------|
| **Conversion** | `POST /api/convert-document` | Docling first, builtin fallback |
| **Docling** | `GET /api/docling/health` | Reachability |
| **Office export** | `GET /api/export/formats`, `POST /api/generate-office` | `lib/office-generator.js`, rate-limited |

## History & memory

| Cluster | Routes | Notes |
|---------|--------|------|
| **History** | `GET/POST /api/history`, `GET/DELETE /api/history/:id` | `lib/history.js` |
| **Memory** | `GET/POST /api/memory`, `PUT/DELETE /api/memory/:id`, `GET /api/memory/stats`, `/models`, `/search` | Embeddings via Ollama; `lib/memory.js` |

## Project files & scaffolding

| Cluster | Routes | Notes |
|---------|--------|------|
| **File browser** | `GET /api/files/tree`, `/read`, `/read-raw`, `POST /save`, `/upload` | Scoped to `config.projectFolder`; `lib/file-browser.js` |
| **Create / Build scaffold** | `POST /api/create-project`, `/api/build-project` | ICM / build scaffolders |
| **Build registry & GSD** | `GET/POST/DELETE /api/build/projects`, `/register`, `/:id/state`, `/roadmap`, `/progress`, `/phase/:n`, `POST …/next-action`, `/research`, `/plan`, file CRUD under `/:id/files` | `lib/build-registry.js`, `lib/gsd-bridge.js`, etc. |

## GitHub & local git

| Cluster | Routes | Notes |
|---------|--------|------|
| **GitHub remote** | `POST /api/github/clone`, `GET /repos`, `DELETE /repos/:dirName`, `POST /open`, `GET /browse`, `POST /token`, `GET /token/status`, `POST /create`, `/push` | `lib/github.js` |
| **Local repo** | `GET /api/git/status`, `POST /branch`, `GET /diff`, `POST /merge-preview`, `/resolve`, `POST /review` | Uses `config.projectFolder`; must stay before SPA fallback in `server.js` |

## IDE launchers

`POST /api/launch-claude-code`, `/launch-cursor`, `/launch-windsurf`, `/launch-vscode`, `/launch-opencode` — open external tools from server host.

## MCP (HTTP server + client admin)

Mounted under `/api` from `lib/mcp-api-routes.js`:

- **Server:** `GET /mcp/server/status`, `POST /mcp/server/toggle`, `POST /mcp/server/tools`, `GET /mcp/server/stats`, `GET /mcp/server/clients`
- **Clients:** `GET/POST /mcp/clients`, `PUT/DELETE /mcp/clients/:id`, `POST /mcp/clients/test-connection`, `POST …/connect`, `…/disconnect`, `GET …/:id/tools`

**MCP protocol endpoint:** `app.all('/mcp', …)` in `server.js` (Streamable HTTP MCP server), not under `/api`.

## License

There is **no** `GET/POST /api/license` handler in `server.js`. Config may include a `license` field that is stripped for the client. Playwright tests mock `/api/license` (`tests/ui/security-mode.spec.js`) — likely reserved for product/Electron flows not implemented in the open server.

---

*API map: 2025-03-21*
