# Testing Patterns

**Analysis Date:** 2026-03-14

## Test Framework

**Unit Tests:**
- Framework: Node.js built-in `test` module (`node:test`)
- Assertions: Node.js `assert/strict` or `assert` module
- Test file location: `tests/` (root level) and `tests/test/unit/`
- Examples: `tests/rate-limit.test.js`, `tests/tone-validation.test.js`, `tests/mcp-security.test.js`, `tests/ui-labels.test.js`, `tests/test/unit/icm-scaffolder.test.js`

**UI / E2E Tests:**
- Framework: Playwright (`@playwright/test`)
- Test file locations: `tests/ui/` (UI flows), `tests/e2e/` (workflow E2E)
- Config file: `playwright.config.js` (testDir: `./tests`)
- Examples: `tests/ui/report-card-interactions.spec.js`, `tests/e2e/review-workflow.spec.js`, `tests/test/e2e/create-mode.spec.js`

**Run Commands:**
```bash
node tests/rate-limit.test.js             # Run single unit test (spawns server)
node tests/tone-validation.test.js        # Run tone validation (no server)
npx playwright test                       # Run all Playwright tests
npx playwright test tests/ui              # Run UI tests only (test:ui)
npx playwright test tests/e2e             # Run E2E tests only (test:e2e)
npx playwright test --headed              # Run with browser visible
npx playwright test --debug               # Run with Playwright Inspector
```

## Test File Organization

**Location:**
- Unit tests: `tests/*.test.js` (root) and `tests/test/unit/`
- UI tests: `tests/ui/*.spec.js` — full E2E against server (not component tests)
- E2E tests: `tests/e2e/` and `tests/test/e2e/`
- Test data/fixtures: generated inline; no shared fixture files

**Naming:**
- Unit tests: `.test.js` suffix
- Playwright tests: `.spec.js` suffix
- Descriptive names: `report-card-interactions.spec.js`, `loading-animation.spec.js`

**Structure:**
```
tests/
├── rate-limit.test.js
├── tone-validation.test.js
├── mcp-security.test.js
├── ui-labels.test.js
├── ui/
│   ├── report-card-interactions.spec.js
│   ├── loading-animation.spec.js
│   ├── input-methods.spec.js
│   ├── onboarding.spec.js
│   ├── glossary.spec.js
│   ├── JargonGlossary.spec.js
│   ├── OnboardingWizard.spec.js
│   └── privacy-banner.spec.js
├── e2e/
│   └── review-workflow.spec.js
└── test/
    ├── unit/
    │   └── icm-scaffolder.test.js
    └── e2e/
        └── create-mode.spec.js
```

**Note:** `playwright-ct.config.js` exists for component testing but is not used by default scripts. All UI tests run as full E2E via `playwright.config.js`.

## Unit Test Structure

**Pattern from `test/unit/icm-scaffolder.test.js`:**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Import module under test
const {
  ScaffolderError,
  normalizeStages,
  scaffoldProject,
  slugify
} = require('../../lib/icm-scaffolder');

// Setup helper function
function writeTemplateFixture(templateRoot) {
  // ... create test data
}

// Test case
test('slugify normalizes unsafe project names', () => {
  assert.equal(slugify(' Create: Mode / Plan? v2!  '), 'create-mode-plan-v2');
  assert.equal(slugify(''), 'untitled');
});
```

**Key patterns:**
- Require `node:test` and `node:assert/strict` at top
- Use `test(description, () => { /* assertions */ })` syntax
- Single assertion or grouped related assertions per test
- Descriptive test names in plain English

## E2E Test Structure

**Pattern from `test/e2e/create-mode.spec.js`:**

```javascript
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Helper functions (page interactions, setup)
async function getAllowedRoot(request) {
  const configResponse = await request.get('/api/config');
  expect(configResponse.ok()).toBeTruthy();
  return outputRoot;
}

async function openCreateMode(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Exploring' }).click();
  await page.getByRole('button', { name: '🛠️ Create' }).click();
}

// Test case
test('Create mode renders when models endpoint fails', async ({ page }) => {
  await page.route('**/api/models', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Ollama offline' })
  }));

  await openCreateMode(page);
  await expect(page.getByRole('heading', { name: 'Create a New Workspace' })).toBeVisible();
});
```

**Key patterns:**
- Use `test(description, async ({ page, request }) => { })` syntax
- Helper functions for common interactions (DRY principle)
- Route mocking with `page.route()` to simulate API responses
- Assertions with `expect()` fluent API

## Test Fixtures and Data

**Pattern:**
- Test data generated programmatically within test functions using helpers
- Example from `test/unit/icm-scaffolder.test.js`:
  ```javascript
  function writeTemplateFixture(templateRoot) {
    fs.mkdirSync(path.join(templateRoot, '_config'), { recursive: true });
    fs.writeFileSync(path.join(templateRoot, 'CLAUDE.md'), [...].join('\n'));
    // ... more setup
  }

  test('scaffoldProject creates expected structure', () => {
    const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffolder-unit-'));
    writeTemplateFixture(path.join(sandboxRoot, 'template'));
    // ... test logic
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
  });
  ```

**Cleanup:**
- Unit tests: explicit `fs.rmSync(..., { recursive: true, force: true })` in cleanup
- E2E tests: cleanup in `finally` blocks to ensure deletion even if test fails

## Test Types

**Unit Tests:**
- **Scope:** Individual functions and modules (e.g., `slugify()`, `normalizeStages()`, `scaffoldProject()`)
- **Approach:** Direct function calls with mocked dependencies (file system operations), assertion on outputs
- **Example:** Testing `slugify()` normalizes input correctly, `normalizeStages()` creates deterministic slugs
- **Database/external calls:** Avoided via mocking or sandboxing (temp directories)

**Integration Tests:**
- **Scope:** Cross-module interactions (scaffolder + file system + path validation)
- **Approach:** Real file system operations in sandboxed temp directories
- **Example:** `scaffoldProject()` test creates actual file structure, asserts directories exist
- **Error cases:** Test invalid inputs and error conditions (path traversal, duplicate projects)

**E2E Tests:**
- **Scope:** Full user workflows (UI → API → backend → UI)
- **Approach:** Browser automation with Playwright, route mocking for API responses
- **Example:** Create mode wizard flow: navigate → fill form → submit → verify project created
- **API mocking:** Route mocking to simulate offline Ollama, server errors
- **File system interaction:** Real file operations to verify backend changes

## Mocking

**Framework:**
- Unit tests: No explicit mocking library; use sandboxed file system with `fs.mkdtempSync()`
- E2E tests: Playwright route mocking with `page.route()`

**Patterns:**

**File system mocking (unit tests):**
```javascript
// Sandbox temp directory
const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
// ... operations on sandboxRoot
fs.rmSync(sandboxRoot, { recursive: true, force: true }); // cleanup
```

**API mocking (E2E tests):**
```javascript
await page.route('**/api/models', route => route.fulfill({
  status: 503,
  contentType: 'application/json',
  body: JSON.stringify({ error: 'Ollama offline' })
}));
```

**What to Mock:**
- External API responses (Ollama endpoints) — reduces test flakiness
- Error conditions (5xx, network failures) — tests error handling paths
- Non-deterministic operations (timestamps, random IDs) — for E2E only if needed

**What NOT to Mock:**
- File system operations in unit tests — use real temp directories to validate actual behavior
- Frontend navigation and DOM interactions in E2E — test real page state
- Backend route handlers — test real endpoints unless testing error recovery

## Async Testing

**Unit tests:**
- No explicit async patterns; functions are mostly synchronous
- Helper functions may use fs operations, but not awaited

**E2E tests:**
```javascript
test('wizard creates project', async ({ page, request }) => {
  // All page interactions are async
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Exploring' }).click();

  // Wait for element visibility
  await expect(page.getByRole('heading', { name: 'Create a New Workspace' })).toBeVisible();

  // Await user input and navigation
  await page.getByLabel('Project name').fill(projectName);
  await page.getByRole('button', { name: 'Next' }).click();
});
```

**Assertions for async operations:**
- Use `expect(...).toBeVisible()` — waits for element
- Use `expect(...).toBeTruthy()` — asserts response status
- Use `await Promise.all([...])` for parallel operations

## Error Testing

**Unit tests:**
```javascript
test('scaffoldProject blocks output roots outside allowlist', () => {
  assert.throws(
    () => {
      scaffoldProject({
        config: { createModeAllowedRoots: [allowedRoot] },
        outputRoot: outsideRoot
      });
    },
    err => err instanceof ScaffolderError &&
           err.code === 'PATH_OUTSIDE_ROOT' &&
           err.status === 403
  );
});
```

**E2E tests:**
```javascript
test('API guardrails reject duplicate creates', async ({ request }) => {
  const firstCreate = await request.post('/api/create-project', { data: payload });
  expect(firstCreate.status()).toBe(201);

  const duplicateCreate = await request.post('/api/create-project', { data: payload });
  expect(duplicateCreate.status()).toBe(409);
  const json = await duplicateCreate.json();
  expect(json.code).toBe('PROJECT_EXISTS');
});
```

## Playwright Configuration

**File:** `playwright.config.js`

```javascript
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',             // All tests (ui + e2e + test/*)
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true
  },
  webServer: {
    command: 'PORT=4173 node server.js',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000
  }
});
```

**Key settings:**
- `testDir: './tests'`: Runs all `.spec.js` under tests/ (ui, e2e, test/e2e)
- `baseURL`: Must match test server port (4173)
- `reuseExistingServer: true`: Faster runs if server already running

## Test Coverage

**Current state:** No formal coverage reporting configured or required

**What IS tested:**
- Critical paths: scaffolder project creation, file system operations, API routes
- Error conditions: invalid paths, duplicate projects, API failures, rate limiting, MCP config validation
- UI workflows: Create mode wizard, Review mode (paste/upload/browse), report card progressive disclosure, loading animation, onboarding, glossary, privacy banner
- Tone validation: system prompts (PM terms, analogies, personality archetypes)
- UI labels: MODES array parsing, jargon/PM term checks

**What is NOT tested:**
- Builder modes (Prompting, Skillz, Agentic): `BaseBuilderPanel`, `BuilderScoreCard`, `lib/builder-score.js`, `lib/builder-schemas.js`, `POST /api/score`
- Full chat streaming flow (complex Ollama integration)
- Frontend state management edge cases
- GitHub integration (requires token)

**Mock duplication:** `mockReportCardResponse` is duplicated in three files with slight variations:
- `tests/ui/loading-animation.spec.js`
- `tests/ui/report-card-interactions.spec.js`
- `tests/e2e/review-workflow.spec.js`
Consider extracting to `tests/fixtures/review-mocks.js`.

**Running E2E tests:**
```bash
# Run all tests
npx playwright test

# Run single test file
npx playwright test test/e2e/create-mode.spec.js

# Run in headed mode (see browser)
npx playwright test --headed

# Run with debug inspector
npx playwright test --debug

# Show HTML report after test
npx playwright show-report
```

## Best Practices Observed

1. **Test names are descriptive** — Explain what is being tested, not just "it works"
2. **Tests are isolated** — Each test cleans up its own resources (temp directories)
3. **Setup/teardown in try-finally** — E2E tests ensure cleanup even if test fails
4. **Helpers reduce duplication** — `getAllowedRoot()`, `openCreateMode()` reused across tests
5. **Real file system for integration** — Unit tests use actual temp directories, not mocks
6. **Route mocking for API testing** — E2E tests mock external API responses to control conditions
7. **Clear assertion messages** — Tests fail with clear error messages (e.g., `code === 'PROJECT_EXISTS'`)

---

*Testing analysis: 2026-03-14*
