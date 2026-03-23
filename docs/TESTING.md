# Testing

## Commands (from repo root)

| Command | What it runs |
|---------|----------------|
| `npm test` | Full Playwright suite (`tests/`, `**/*.spec.js` per `playwright.config.js`) |
| `npm run test:unit` | Node [`node:test`](https://nodejs.org/api/test.html) — unit, MCP security, tone/UI labels, rate limit, scaffold, image helpers, pentest schema, etc. |
| `npm run test:ui` | Playwright tests under `tests/ui/` only |
| `npm run test:e2e` | Playwright tests under `tests/e2e/` only |
| `npm run mcp:test` | Spawns **stdio** `mcp-server.js` via MCP SDK and lists tools (11 expected) |

Run unit tests before small backend changes; run Playwright when changing UI or API behavior used by the browser.

## Layout

| Path | Role |
|------|------|
| `tests/unit/` | Focused unit tests for `lib/` modules (builders, image processor, pentest schema, etc.) |
| `tests/ui/` | Playwright specs for components and flows (onboarding, security mode, builders, glossary, …) |
| `tests/e2e/` | End-to-end workflows (image upload, review, **create mode** wizard + API guardrails) |
| `tests/*.test.js` | Top-level Node tests (rate limit, MCP security, tone validation, UI labels) |
| `playwright.config.js` | Playwright: starts `npm run build && FORCE_HTTP=1 PORT=4173 node server.js`; see **Playwright env** below |
| `tests/helpers/` | `app-ready.js` (splash + onboarding), `mode-tabs.js` (stable `data-testid` mode tabs) |
| `playwright-ct.config.js` | Component-test config (experimental CT) |

Some UI specs use **`test.skip`** placeholders (e.g. build handoff / AI ops) until fully wired — see individual files.

## Playwright base URL

The config defaults to **`http://127.0.0.1:4173`**, matching **webServer** (`FORCE_HTTP=1` on port **4173**). `ignoreHTTPSErrors` is enabled only when `BASE_URL` starts with `https://`.

To test against a **HTTPS** dev server (e.g. self-signed cert on :4173), set:

```bash
BASE_URL=https://127.0.0.1:4173 npm run test:ui
```

## Playwright env (optional)

| Variable | Effect |
|----------|--------|
| `PW_WORKERS` | Override parallel workers (default **2** — avoids starving the single `node server.js`). |
| `PW_REUSE_SERVER=1` | Reuse an existing process on **:4173** instead of starting **webServer** (faster; risk: **stale `dist/`** if the server was built before your last UI change). |
| `BASE_URL` | Same as above for HTTPS / alternate host. |

The root config sets **`retries: 2`** so occasional hydration / single-server flake can recover without failing the whole run.

## CI

`playwright-ct.config.js` sets `forbidOnly` and retries when `CI` is set.

## Related

- **`.claude/commands/validate-project.md`** — full 7-phase manual validation (build, server, unit, Playwright, API smoke, workflows).
