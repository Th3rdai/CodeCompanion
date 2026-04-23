# Testing

## Commands (from repo root)

| Command                    | What it runs                                                                                                                                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                 | Full Playwright suite (`tests/`, `**/*.spec.js` per `playwright.config.js`)                                                                                                                                                                                                               |
| `npm run test:unit`        | Node [`node:test`](https://nodejs.org/api/test.html) — **148** tests (as of 2026-04): MCP security, tone/UI labels, rate limit, auto-model, image helpers, pentest schema, memory scoping (`memory-scope.test.js`), tool-call preamble (`tool-call-handler.test.js`), builtin tools, etc. |
| `npm run test:integration` | Node **`node:test`** — spawns **`server.js`** on a test port and exercises **`/api/chat`**, **`/api/review`**, **`/api/pentest`**, **`/api/pentest/remediate`** with image payloads (JSON vs SSE handling). See `tests/integration/api-with-images.test.js`.                              |
| `npm run test:ui`          | Playwright tests under `tests/ui/` only                                                                                                                                                                                                                                                   |
| `npm run test:e2e`         | Playwright tests under `tests/e2e/` only                                                                                                                                                                                                                                                  |
| `npm run mcp:test`         | Spawns **stdio** `mcp-server.js` via MCP SDK and lists tools (11 expected)                                                                                                                                                                                                                |

Run unit tests before small backend changes; run Playwright when changing UI or API behavior used by the browser. Run **`test:integration`** after changing chat, review, pentest, or remediate request/response shapes.

## Layout

| Path                      | Role                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/`             | Focused unit tests for `lib/` modules (builders, image processor, pentest schema, **memory scoping**, **tool-call / builtin preamble**, etc.) |
| `tests/ui/`               | Playwright specs for components and flows (onboarding, security mode, builders, glossary, …)                                                  |
| `tests/e2e/`              | End-to-end workflows (image upload, review, **create mode** wizard + API guardrails, **agent terminal** allowlist/audit)                      |
| `tests/integration/`      | API integration tests (spawn server; **`api-with-images.test.js`** — `messages`+`mode` for chat, JSON vs SSE for review/pentest)              |
| `tests/*.test.js`         | Top-level Node tests (rate limit, MCP security, tone validation, UI labels)                                                                   |
| `playwright.config.js`    | Playwright: starts `npm run build && FORCE_HTTP=1 PORT=4173 node server.js`; see **Playwright env** below                                     |
| `tests/helpers/`          | `app-ready.js` (splash + onboarding), `mode-tabs.js` (stable `data-testid` mode tabs)                                                         |
| `playwright-ct.config.js` | Component-test config (experimental CT)                                                                                                       |

Some UI specs use **`test.skip`** placeholders (e.g. build handoff / AI ops) until fully wired — see individual files.

## Playwright base URL

The config defaults to **`http://127.0.0.1:4173`**, matching **webServer** (`FORCE_HTTP=1` on port **4173**). `ignoreHTTPSErrors` is enabled only when `BASE_URL` starts with `https://`.

To test against a **HTTPS** dev server (e.g. self-signed cert on :4173), set:

```bash
BASE_URL=https://127.0.0.1:4173 npm run test:ui
```

## Playwright env (optional)

| Variable            | Effect                                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PW_WORKERS`        | Override parallel workers (default **2** — avoids starving the single `node server.js`).                                                                       |
| `PW_REUSE_SERVER=1` | Reuse an existing process on **:4173** instead of starting **webServer** (faster; risk: **stale `dist/`** if the server was built before your last UI change). |
| `BASE_URL`          | Same as above for HTTPS / alternate host.                                                                                                                      |

The root config sets **`retries: 2`** so occasional hydration / single-server flake can recover without failing the whole run.

## Agent terminal E2E

`tests/e2e/agent-terminal.spec.js` covers `lib/builtin-agent-tools.js` `run_terminal_cmd` per **CLIPLAN.md §8** review checklist. Three scenarios:

1. **Enable/disable** — `agentTerminal.enabled = false` ⇒ `getBuiltinTools()` does **not** advertise `run_terminal_cmd` (LLM never sees it).
2. **Allowlist deny** — command not in `agentTerminal.allowlist` ⇒ executor returns `Command denied`, **does not spawn**, and writes a `denied` event (with `denyType: "allowlist"`) to `logs/terminal-audit.log`.
3. **Happy path** — `node --version` is in the allowlist ⇒ executor spawns it, returns `Exit code: 0` plus version, and writes an `executed` event with `exitCode: 0`, `durationMs`, and `truncated: false` to the audit log.

The spec calls `executeBuiltinTool()` directly via `require()` inside Playwright's Node runner — **no browser, webServer, or live LLM** required. It uses a fresh `CC_DATA_DIR` per scenario so the audit log is isolated.

## CI

`playwright-ct.config.js` sets `forbidOnly` and retries when `CI` is set.

## Full manual validation (`validate-project`)

The **`.claude/commands/validate-project.md`** command runs build, server health, unit tests, Playwright, API smoke, and workflow curls.

**Phase 7 (Ollama + SSE):** use **`npm run validate:p7`** (see `scripts/validate-p7-workflows.sh`) so chat/review/diagram checks **warm the model first** and use **long curl timeouts** (defaults 240s warm, 300s per stream). Set **`VALIDATE_BASE_URL`** to your running server (e.g. `http://127.0.0.1:4173` with `FORCE_HTTP=1`).

**If the server uses HTTPS** (self-signed **`cert/`** files, **`FORCE_HTTP` unset**):

- Use **`https://127.0.0.1:PORT`** and **`curl -skf`** / **`curl -sk`** for API and SSE checks (not plain **`http://`** without TLS).
- For Playwright against that server: **`BASE_URL=https://127.0.0.1:PORT PW_REUSE_SERVER=1`** (see **Playwright base URL** above).
- **`GET /api/history`** can return a **large JSON array** — shell one-liners must **read all stdin** before **`JSON.parse`** (chunked output breaks single-chunk parses).
- **`POST /api/files/save`** requires **`folder`** under the project’s **allowed roots** (e.g. repo root), not arbitrary paths like **`/tmp`** — expect **403** otherwise.

## Related

- **`.claude/commands/validate-project.md`** — full 7-phase manual validation (build, server, unit, Playwright, API smoke, workflows).
- **`docs/TROUBLESHOOTING.md`** — connection issues, log paths, MCP config locations.
