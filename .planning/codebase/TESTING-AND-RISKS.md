# Testing & Risk Hotspots

**Analysis Date:** 2025-03-21 (Playwright notes refreshed 2026-03-28)

## Test commands (`package.json`)

| Command | Scope |
|---------|--------|
| `npm test` | Full Playwright (default config) |
| `npm run test:ui` | `tests/ui` — Chromium project |
| `npm run test:e2e` | `tests/e2e` — Chromium project |
| `npm run test:unit` | Node built-in test runner: `tests/unit/*.test.js`, plus `tests/rate-limit.test.js`, `tests/mcp-security.test.js`, `tests/tone-validation.test.js`, `tests/ui-labels.test.js` |

## `tests/unit/`

Focused backend/unit coverage: **pentest** (`pentest-skill.test.js`, `pentest-schema.test.js`, `pentest-orchestration.test.js`), **build** (`build-file-ops.test.js`, `builder-score.test.js`, `icm-scaffolder-template.test.js`), **images** (`image-processor.test.js`), **`lib/spawn-path.js`** (`spawn-path.test.js`).

## `tests/ui/` (Playwright)

Browser tests for **onboarding** (`onboarding.spec.js`, `OnboardingWizard.spec.js`), **Build** UI (`build-simple-view.spec.js`, `build-advanced-view.spec.js`, `build-handoff.spec.js`, `build-ai-ops.spec.js`), **builders** (`builder-prompting.spec.js`), **security mode** (`security-mode.spec.js` — mocks `/api/license`), **glossary**, **privacy banner**, **report card**, **loading**, **input methods**, **labels** (`tests/ui-labels.test.js` is Node, not under `tests/ui`).

## `tests/e2e/`

Broader flows: `review-workflow.spec.js`, `image-upload.spec.js`, `create-mode.spec.js`, and others. **Stability:** specs that `reload()` then wait for `/api/models` must register `waitForResponse` *before* `reload()` (see `.planning/codebase/TESTING.md`).

## Other tests (repo root `tests/`)

- `tests/integration/api-with-images.test.js` — API behavior with images.
- `tests/rate-limit.test.js`, `tests/mcp-security.test.js`, `tests/tone-validation.test.js` — pulled into `test:unit`.

## Complexity & coupling hotspots

| Area | Why it matters | Paths |
|------|----------------|--------|
| **Monolithic server** | Single `server.js` (~3.2k lines) holds most HTTP routes, chat loop, static, MCP HTTP — harder to navigate and test in isolation | `server.js` |
| **Large SPA root** | `src/App.jsx` (~1.9k lines) centralizes state, modes, chat, wizards — high change conflict risk | `src/App.jsx` |
| **Electron vs web** | Branching on `window.electronAPI`, different data paths and updates — features must be verified in both shells | `src/App.jsx`, `electron/main.js`, `electron/preload.js` |
| **Dual chat paths** | Tool-enabled chat uses complete + fake stream; tool-free uses real SSE — regressions easy if only one path tested | `server.js` `/api/chat` |
| **MCP transport matrix** | stdio/http/sse + fallback behavior — integration-heavy | `lib/mcp-client-manager.js` |
| **Security-sensitive agent terminal** | Allowlist/blocklist mistakes have real impact | `lib/builtin-agent-tools.js` |

## Dependency / ops notes

- **`postinstall` → `patch-package`:** Patches must be applied after install; `patches/electron-updater+6.8.3.patch` ties to `electron-updater` version.
- **No `/api/license` in server** — anything depending on that route needs mocks or a future implementation.

---

*Testing & risks: 2025-03-21; E2E stability cross-ref: 2026-03-28*
