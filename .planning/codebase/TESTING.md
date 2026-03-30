# Testing Patterns

**Analysis Date:** 2026-03-14

## Test Framework

**Runner:**

- Playwright 1.58.2 for E2E/UI
- Node.js built-in `node:test` for unit tests

**Assertion Library:**

- `node:assert/strict` for unit tests
- Playwright `expect` for E2E

**Run Commands:**

```bash
npm test                    # Playwright (all tests)
npm run test:ui             # Playwright UI mode, tests/ui, chromium
npm run test:e2e           # Playwright tests/e2e, chromium
node --test tests/*.test.js # Node unit tests (manual)
```

## Test File Organization

**Location:**

- `tests/` — root for all tests
- `tests/ui/` — UI/E2E specs (Playwright)
- `tests/e2e/` — E2E specs
- `tests/unit/` — Node unit tests
- `tests/test/unit/` — Duplicate unit layout (e.g. `icm-scaffolder.test.js`)
- `tests/test/e2e/` — Duplicate E2E layout (e.g. `create-mode.spec.js`)

**Naming:**

- Playwright: `*.spec.js`
- Node: `*.test.js`

**Structure:**

```
tests/
├── rate-limit.test.js
├── mcp-security.test.js
├── tone-validation.test.js
├── ui-labels.test.js
├── ui/
│   ├── builder-prompting.spec.js
│   ├── onboarding.spec.js
│   ├── report-card-interactions.spec.js
│   └── ...
├── e2e/
│   └── review-workflow.spec.js
├── unit/
│   └── builder-score.test.js
└── test/
    ├── unit/
    │   └── icm-scaffolder.test.js
    └── e2e/
        └── create-mode.spec.js
```

## Test Structure

**Suite Organization (Node):**

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");

test("rate limiting blocks burst traffic", async () => {
  // spawn server, waitForServer, make requests, assert
});
```

**Suite Organization (Playwright):**

```javascript
import { test, expect } from '@playwright/test';

test.describe('Prompting Builder Mode', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.route('**/api/models', ...);
    await context.route('**/api/score', ...);
    await page.goto('/');
    await page.click('button:has-text("Prompting")');
  });

  test('displays prompt builder input fields', async ({ page }) => {
    await expect(page.getByPlaceholder(/write your prompt here/i)).toBeVisible();
  });
});
```

**Patterns:**

- Setup: `beforeEach` for route mocking, localStorage, navigation
- Teardown: Implicit (Playwright), `child.kill()` in rate-limit test
- Assertion: `assert.equal`, `expect(...).toBeVisible()`, `expect(...).toBeDisabled()`

### Playwright: reload + `/api/models` (2026-03-28)

After `page.reload()`, **do not** attach `waitForResponse('**/api/models')` _after_ the reload — the request may finish before the listener runs. **Pattern:** register the waiter **before** `reload()`, then wait for `#model-select` (shell hydrated):

```javascript
async function reloadAndWaitForModels(page) {
  const modelsPromise = page.waitForResponse(
    (r) => r.url().includes("/api/models"),
    { timeout: 30_000 },
  );
  await page.reload();
  await modelsPromise;
  await page.waitForSelector("#model-select", {
    state: "visible",
    timeout: 30_000,
  });
}
```

Used (inlined) in `tests/ui/privacy-banner.spec.js`, `OnboardingWizard.spec.js`, `report-card-interactions.spec.js`, and E2E `create-mode.spec.js`, `image-upload.spec.js` (image flow may pass `{ okOnly: true }` to require `r.ok()`).

**Report card UI tests:** wait for `mode-tab-chat` before `mode-tab-review` so the mode tab strip is hydrated.

**Onboarding keyboard test:** click the dialog overlay to focus the wizard (`tabIndex={0}`) instead of `locator.focus()` — avoids flakes in headless Chromium.

**Privacy banner:** dismiss control exposes `data-testid="privacy-banner-dismiss"` (`PrivacyBanner.jsx`); tests use it instead of ambiguous `role="status"` matches.

## Mocking

**Framework:** Playwright `context.route()` for API mocking

**Patterns:**

```javascript
await context.route("**/api/models", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      models: [{ name: "test-model" }],
      ollamaUrl: "http://localhost:11434",
    }),
  });
});
```

**What to Mock:**

- `/api/models` — avoid Ollama dependency
- `/api/score` — deterministic score-card responses
- `/api/chat` — for chat flow tests (if needed)

**What NOT to Mock:**

- UI components in isolation (no React Testing Library)
- Lib modules in Playwright (use route mocking instead)

## Fixtures and Factories

**Test Data:**

- Inline objects: `mockScoreResponse` in `builder-prompting.spec.js`
- Spawned server with env: `PORT`, `RATE_LIMIT_MAX_CREATE` in `rate-limit.test.js`

**Location:**

- Inline in spec files; no shared `fixtures/` directory

## Coverage

**Requirements:** None enforced

**View Coverage:** Not configured (no `--coverage` in npm scripts)

## Test Types

**Unit Tests:**

- `tests/rate-limit.test.js` — spawns server, hits endpoint
- `tests/mcp-security.test.js` — McpClientManager validation (no server)
- `tests/unit/builder-score.test.js` — getTimeoutForModel, scoreContent contract
- `tests/tone-validation.test.js`, `tests/ui-labels.test.js` — label/validation checks

**Integration Tests:**

- Rate-limit test is integration (real server)
- MCP security is unit (manager only)

**E2E Tests:**

- Playwright `tests/ui/*.spec.js`, `tests/e2e/*.spec.js`
- webServer: `PORT=4173 node server.js`, baseURL `http://127.0.0.1:4173`
- Timeout: 45s per test, 10s expect

## Common Patterns

**Async Testing:**

```javascript
await waitForServer(baseUrl);
const res = await fetch(...);
assert.equal(res.status, 429);
```

**Error Testing:**

```javascript
await assert.rejects(
  () => scoreContent(..., 'unknown-mode', ...),
  { message: /unknown builder mode/i }
);
```

**Route Mocking:**

- Use `context.route` in `beforeEach` to stub API
- Set `localStorage.setItem('th3rdai_onboarding_complete', 'true')` to skip onboarding

---

_Testing analysis: 2026-03-14; Playwright reload/hydration notes: 2026-03-28_
