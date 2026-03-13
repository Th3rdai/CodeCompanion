# Testing Patterns

**Analysis Date:** 2026-03-13

## Test Framework

**Runner:**
- Node.js built-in `test` module (Node 18+) for unit tests
- Playwright for E2E testing
- No Jest or Vitest configuration detected

**Assertion Library:**
- Node.js built-in `assert/strict` for unit tests
- Playwright's `expect()` for E2E tests

**Run Commands:**
```bash
node --test                    # Run all unit tests (pattern: test/**/*.test.js)
npx playwright test            # Run E2E tests
npx playwright test --headed   # Run E2E tests with browser visible
npx playwright test --debug    # Run E2E tests with debugger
```

**Scripts in package.json:**
- No explicit test script defined; tests run directly with `node --test` or `npx playwright`

## Test File Organization

**Location:**
- Tests co-located in `test/` directory at project root
- Separate from source code (`src/` for React, `lib/` for Node.js modules)

**Naming:**
- Unit tests: `{module}.test.js` (e.g., `icm-scaffolder.test.js`)
- E2E tests: `{feature}.spec.js` (e.g., `create-mode.spec.js`)
- Pattern: `test/unit/` for unit tests, `test/e2e/` for E2E tests

**Structure:**
```
test/
├── unit/
│   └── icm-scaffolder.test.js
└── e2e/
    └── create-mode.spec.js
```

## Test Structure

**Unit Test Suite Organization:**
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

// Fixtures/helpers
function writeTemplateFixture(templateRoot) {
  // Create test data directories and files
}

// Individual tests
test('slugify normalizes unsafe project names', () => {
  assert.equal(slugify(' Create: Mode / Plan? v2!  '), 'create-mode-plan-v2');
  assert.equal(slugify(''), 'untitled');
});

test('normalizeStages creates deterministic unique stage slugs', () => {
  // Test implementation
});
```

**E2E Test Suite Organization:**
```javascript
const { test, expect } = require('@playwright/test');

// Helpers
async function getAllowedRoot(request) {
  // Helper to fetch config and create directories
}

async function openCreateMode(page) {
  // Helper to navigate and click to Create mode
}

// Individual tests
test('Create mode renders when models endpoint fails', async ({ page }) => {
  // Test implementation
});

test('wizard creates project and opens it in file browser', async ({ page, request }) => {
  // Test implementation with cleanup
});
```

**Patterns:**
- Setup: Helper functions create fixtures or pre-conditions
- Teardown: `finally` blocks clean up temporary files (e.g., `fs.rmSync(sandboxRoot, { recursive: true, force: true })`)
- Assertions: Direct `assert.equal()` or `assert.throws()` for unit tests; `await expect()` for E2E

## Mocking

**Framework:**
- Node.js built-in capabilities for unit tests (no external mock library)
- Playwright's `page.route()` for HTTP interception in E2E

**Patterns (E2E):**
```javascript
// HTTP mocking in Playwright
await page.route('**/api/models', route => route.fulfill({
  status: 503,
  contentType: 'application/json',
  body: JSON.stringify({ error: 'Ollama offline' })
}));
```

**Patterns (Unit - Fixture-based):**
```javascript
// Test data fixtures created with actual file system
function writeTemplateFixture(templateRoot) {
  fs.mkdirSync(path.join(templateRoot, '_config'), { recursive: true });
  fs.mkdirSync(path.join(templateRoot, 'shared'), { recursive: true });
  fs.mkdirSync(path.join(templateRoot, 'skills'), { recursive: true });

  fs.writeFileSync(path.join(templateRoot, 'CLAUDE.md'), 'content');
  // ... more files
}
```

**What to Mock:**
- HTTP endpoints (Playwright `page.route()`)
- Ollama API responses (error conditions, offline scenarios)
- External services (GitHub API in E2E)

**What NOT to Mock:**
- File system operations (tests use actual temp directories with cleanup)
- Configuration loading (tests create real config files)
- Scaffolding logic (tests verify actual project structure created)

## Fixtures and Factories

**Test Data:**
- Temporary directory fixtures created with `fs.mkdtempSync(path.join(os.tmpdir(), 'prefix-'))`
- Template directories populated with standard project structure (CLAUDE.md, _config/, shared/, skills/)
- Configuration objects passed as parameters to functions under test

**Example fixture from icm-scaffolder.test.js:**
```javascript
function writeTemplateFixture(templateRoot) {
  fs.mkdirSync(path.join(templateRoot, '_config'), { recursive: true });
  fs.mkdirSync(path.join(templateRoot, 'shared'), { recursive: true });
  fs.mkdirSync(path.join(templateRoot, 'skills'), { recursive: true });

  fs.writeFileSync(path.join(templateRoot, 'CLAUDE.md'), [
    '# [Your Project Name]',
    '[describe the AI\'s purpose in 1-2 sentences]',
    // ...
  ].join('\n'));

  fs.writeFileSync(path.join(templateRoot, '_config/brand-voice.md'), [
    '[Describe your target audience...]',
    // ...
  ].join('\n'));

  fs.writeFileSync(path.join(templateRoot, 'shared/README.md'), 'Shared resources');
  fs.writeFileSync(path.join(templateRoot, 'skills/README.md'), 'Skills resources');
}
```

**Location:**
- Helper functions defined at top of test file (before test declarations)
- Shared utilities not extracted to separate files yet

## Coverage

**Requirements:** Not enforced; no coverage configuration detected

**View Coverage:**
```bash
# No automated coverage tool configured
# Tests are manual verification of functionality
```

## Test Types

**Unit Tests:**
- **Scope:** Individual function/module logic (e.g., string normalization, project scaffolding)
- **Approach:** Direct function calls with assertions, fixture setup in code
- **File:** `test/unit/icm-scaffolder.test.js`
- **Examples:**
  - `slugify()` normalizes project names correctly
  - `normalizeStages()` creates unique stage slugs deterministically
  - `scaffoldProject()` creates expected directory structure
  - `scaffoldProject()` enforces path allowlist security

**Integration Tests:**
- Not explicitly separated; some unit tests verify multi-module interactions (e.g., scaffolding tests call multiple functions)

**E2E Tests:**
- **Scope:** Full user workflows in browser
- **Approach:** Playwright browser automation, UI navigation, API mocking
- **File:** `test/e2e/create-mode.spec.js`
- **Examples:**
  - Create mode renders when Ollama is offline
  - Wizard successfully creates project and opens in file browser

## Common Patterns

**Async Testing:**
```javascript
test('wizard creates project and opens it in file browser', async ({ page, request }) => {
  const outputRoot = await getAllowedRoot(request);
  const projectName = `E2E Create ${Date.now()}`;

  await openCreateMode(page);
  await page.getByLabel('Project name').fill(projectName);
  await page.getByRole('button', { name: 'Next' }).click();

  // Assertions
  await expect(page.locator('...')).toBeVisible();
});
```

**Cleanup with Try-Finally:**
```javascript
test('scaffoldProject creates expected project structure', () => {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffolder-unit-'));
  const allowedRoot = path.join(sandboxRoot, 'allowed-root');
  const templateRoot = path.join(sandboxRoot, 'template');

  fs.mkdirSync(allowedRoot, { recursive: true });
  writeTemplateFixture(templateRoot);

  try {
    const result = scaffoldProject({ /* ... */ });
    assert.equal(result.success, true);
    assert.ok(fs.existsSync(path.join(result.projectPath, 'CLAUDE.md')));
  } finally {
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
  }
});
```

**Error Testing with assert.throws():**
```javascript
test('scaffoldProject blocks output roots outside allowlist', () => {
  // Setup...
  try {
    assert.throws(
      () => {
        scaffoldProject({
          config: { createModeAllowedRoots: [allowedRoot] },
          outputRoot: outsideRoot  // Outside allowlist
        });
      },
      err => err instanceof ScaffolderError && err.code === 'PATH_OUTSIDE_ROOT' && err.status === 403
    );
  } finally {
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
  }
});
```

**Browser Automation in E2E:**
```javascript
async function openCreateMode(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Exploring' }).click();
  await page.getByRole('button', { name: '🛠️ Create' }).click();
}

test('Create mode renders when models endpoint fails', async ({ page }) => {
  await page.route('**/api/models', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Ollama offline' })
  }));

  await openCreateMode(page);
  await expect(page.getByRole('heading', { name: 'Create a New Workspace' })).toBeVisible();
  await expect(page.getByText('This flow works even if Ollama is offline.')).toBeVisible();
});
```

## Test Configuration

**Playwright Config:** `.playwright-mcp/` directory exists but config details not examined. Standard Playwright behavior applies.

**Node Test Runner:** Uses Node.js 18+ built-in, no explicit configuration needed.

## Test Execution Notes

- Unit tests isolated from running application (file-based, no server dependencies)
- E2E tests require running server (`npm run start` or `npm run dev:server`)
- E2E tests require frontend at `http://localhost:5173` (dev) or `http://localhost:3000` (prod)
- Temporary directories created and cleaned up within each test
- No test data committed to repository; fixtures generated in-memory

---

*Testing analysis: 2026-03-13*
