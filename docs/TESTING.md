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
| `tests/e2e/` | End-to-end workflows (e.g. review with mocked API) |
| `tests/*.test.js` | Top-level Node tests (rate limit, MCP security, tone validation, UI labels) |
| `playwright.config.js` | Playwright: starts `npm run build && FORCE_HTTP=1 PORT=4173 node server.js`, uses `reuseExistingServer: true` |
| `playwright-ct.config.js` | Component-test config (experimental CT) |

Some UI specs use **`test.skip`** placeholders (e.g. build handoff / AI ops) until fully wired — see individual files.

## Playwright base URL

The config defaults to `BASE_URL` of `https://127.0.0.1:4173` with `ignoreHTTPSErrors` when using HTTPS. The **webServer** command starts the app with **`FORCE_HTTP=1`**, so the server is often **HTTP** on port **4173**. If tests fail with SSL errors, run with:

```bash
BASE_URL=http://127.0.0.1:4173 npm run test:ui
```

## CI

`playwright-ct.config.js` sets `forbidOnly` and retries when `CI` is set.

## Related

- **`.claude/commands/validate-project.md`** — full 7-phase manual validation (build, server, unit, Playwright, API smoke, workflows).
