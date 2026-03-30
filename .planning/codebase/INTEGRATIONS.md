# External Integrations

**Analysis Date:** 2026-03-14

## APIs & External Services

**Ollama (Local LLM):**

- Purpose: Chat, code review, builder scoring, structured output
- Client: Native `fetch` in `lib/ollama-client.js`
- URL: Configurable via `config.ollamaUrl` (default `http://localhost:11434`)
- Auth: None (local)

**GitHub:**

- Purpose: Clone repos, list user repos, validate token
- Client: Native `https` and `child_process` (git) in `lib/github.js`
- Auth: GitHub Personal Access Token stored in config (`.cc-config.json`), masked in API responses

**MCP (Model Context Protocol):**

- Purpose: Expose Code Companion as MCP server to Claude Desktop, Cursor, etc.; connect to external MCP clients
- SDK: `@modelcontextprotocol/sdk`
- Transports: stdio (`mcp-server.js`), HTTP (`/mcp` in `server.js`)
- Auth: MCP client env vars (tokens, etc.) stored in config, masked in API responses

## Data Storage

**Databases:**

- None (no external DB)

**File Storage:**

- Local filesystem only
- Config: `.cc-config.json` in data root
- History: `history/*.json` per conversation
- Logs: `logs/*.log` (app, error)
- Cloned repos: `github-repos/` subdirectory

**Caching:**

- None (in-memory rate limit buckets only)

## Authentication & Identity

**Auth Provider:**

- Custom / none for app access
- GitHub token for private repo cloning (optional)
- MCP client env vars for external tool auth (optional)

## Monitoring & Observability

**Error Tracking:**

- None (no Sentry, etc.)

**Logs:**

- `lib/logger.js` - Rotating log files in `logs/`
- `electron-log` in desktop builds
- `DEBUG=1` for console debug output

## CI/CD & Deployment

**Hosting:**

- Web: Not specified (Express serves static + API)
- Desktop: electron-builder publishes to GitHub (th3rdai/code-companion)

**CI Pipeline:**

- Playwright tests use `PORT=4173 node server.js` as webServer

## Environment Configuration

**Required env vars:**

- None (all have defaults)

**Optional env vars:**

- `PORT` - Server port
- `CC_DATA_DIR` - Data directory
- `DEBUG` - Verbose logging
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_*` - Rate limit tuning

**Secrets location:**

- `.cc-config.json` (githubToken, mcpServers env) - never committed per .gitignore

## Webhooks & Callbacks

**Incoming:**

- None

**Outgoing:**

- None

---

_Integration audit: 2026-03-14_
