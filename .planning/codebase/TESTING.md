# Testing Patterns

**Analysis Date:** 2026-03-13

## Test Framework

**Unit Tests:**
- Framework: Node.js built-in `test` module (`node:test`)
- Assertions: Node.js `assert/strict` module
- Test file location: `test/unit/`
- Example: `test/unit/icm-scaffolder.test.js`

**E2E Tests:**
- Framework: Playwright (`@playwright/test`)
- Test file location: `test/e2e/`
- Config file: `playwright.config.js`
- Example: `test/e2e/create-mode.spec.js`

**Run Commands:**
```bash
node test/unit/icm-scaffolder.test.js    # Run single unit test
npx playwright test                       # Run all E2E tests
npx playwright test --headed              # Run with browser visible
npx playwright test --debug               # Run with Playwright Inspector
```

## Test File Organization

**Location:**
- Unit tests: co-located in `test/unit/` directory (mirrors source structure loosely)
- E2E tests: co-located in `test/e2e/` directory
- Test data/fixtures: generated inline within test functions (no separate fixture files)

**Naming:**
- Unit tests: `.test.js` suffix, e.g., `icm-scaffolder.test.js`
- E2E tests: `.spec.js` suffix, e.g., `create-mode.spec.js`
- Descriptive names based on module/feature under test

**Structure:**
```
test/
├── unit/
│   └── icm-scaffolder.test.js
└── e2e/
    └── create-mode.spec.js
```

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
  testDir: './test/e2e',          // E2E test directory
  timeout: 45_000,                // Test timeout (45 seconds)
  expect: { timeout: 10_000 },    // Assertion timeout
  use: {
    baseURL: 'http://127.0.0.1:4173',  // Test server URL
    headless: true                      // Run without browser UI
  },
  webServer: {
    command: 'PORT=4173 node server.js',  // Start server before tests
    port: 4173,
    reuseExistingServer: true,            // Reuse server across tests
    timeout: 120_000                      // Server startup timeout
  }
});
```

**Key settings:**
- `baseURL`: Must match test server port (4173)
- `headless: true`: Faster, no browser window
- `reuseExistingServer: true`: Faster runs if server already running
- `webServer.command`: Starts Express server with custom port

## Test Coverage

**Current state:** No formal coverage reporting configured or required

**What IS tested:**
- Critical paths: scaffolder project creation, file system operations, API routes
- Error conditions: invalid paths, duplicate projects, API failures
- UI workflows: Create mode wizard end-to-end

**What is NOT tested:**
- Full chat streaming flow (complex Ollama integration)
- All UI components individually (no Jest/Vitest setup)
- Frontend state management edge cases
- GitHub integration (requires token)

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

*Testing analysis: 2026-03-13*
