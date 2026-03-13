# Testing Patterns

**Analysis Date:** 2026-03-13

## Test Framework

**Runner:**
- Node.js built-in `test` module (Node 18+) for unit tests
- Playwright for E2E testing
- No Jest or Vitest configuration

**Assertion Library:**
- Node.js built-in `assert/strict` for unit tests
- Playwright's `expect()` for E2E tests

**Run Commands:**
```bash
node --test                    # Run all unit tests
npx playwright test            # Run E2E tests
npx playwright test --headed   # Run E2E tests with browser visible
npx playwright test --debug    # Run E2E tests with debugger
```

**Configuration Files:**
- `playwright.config.js`: E2E test configuration
- No npm scripts defined for testing (tests run directly)

## Test File Organization

**Location:**
- Unit tests: `test/unit/` directory (co-located at project root, separate from src/)
- E2E tests: `test/e2e/` directory
- Tests NOT co-located with source code

**Naming:**
- Unit tests: `{module}.test.js` (e.g., `icm-scaffolder.test.js`)
- E2E tests: `{feature}.spec.js` (e.g., `create-mode.spec.js`)

**Structure:**
```
test/
├── unit/
│   └── icm-scaffolder.test.js
└── e2e/
    └── create-mode.spec.js
```

## Test Structure

**Unit Test Pattern:**
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Fixture helpers
function writeTemplateFixture(templateRoot) {
  fs.mkdirSync(path.join(templateRoot, '_config'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, 'CLAUDE.md'), 'content');
}

// Test declaration
test('slugify normalizes unsafe project names', () => {
  assert.equal(slugify(' Create: Mode / Plan? v2!  '), 'create-mode-plan-v2');
  assert.equal(slugify(''), 'untitled');
});

// Test with setup/teardown
test('scaffoldProject creates expected project structure', () => {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffolder-unit-'));

  try {
    const result = scaffoldProject({ /* ... */ });
    assert.equal(result.success, true);
    assert.ok(fs.existsSync(path.join(result.projectPath, 'CLAUDE.md')));
  } finally {
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
  }
});
```

**E2E Test Pattern:**
```javascript
const { test, expect } = require('@playwright/test');

// Helper functions
async function openCreateMode(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Exploring' }).click();
  await page.getByRole('button', { name: '🛠️ Create' }).click();
}

// Test with mocking
test('Create mode renders when models endpoint fails', async ({ page }) => {
  await page.route('**/api/models', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Ollama offline' })
  }));

  await openCreateMode(page);
  await expect(page.getByRole('heading', { name: 'Create a New Workspace' })).toBeVisible();
});

// Test with async fixtures
test('wizard creates project and opens in file browser', async ({ page, request }) => {
  const outputRoot = await getAllowedRoot(request);
  const projectName = `E2E Create ${Date.now()}`;

  // Test logic
});
```

**Patterns:**
- Setup: Create fixtures/pre-conditions before test body
- Teardown: Use `finally` blocks to clean up temp files
- Assertions: `assert.equal()`, `assert.throws()` for unit; `await expect()` for E2E
- Async: `async` keyword for functions needing await

## Mocking

**Framework:**
- Node.js built-in (no external mock library)
- Playwright's `page.route()` for HTTP interception

**HTTP Mocking (E2E):**
```javascript
// Mock Ollama offline
await page.route('**/api/models', route => route.fulfill({
  status: 503,
  contentType: 'application/json',
  body: JSON.stringify({ error: 'Ollama offline' })
}));

// Mock successful response
await page.route('**/api/config', route => route.fulfill({
  status: 200,
  body: JSON.stringify({ ollamaUrl: 'http://localhost:11434', projectFolder: '/path/to/project' })
}));
```

**Fixture-Based Testing (Unit):**
```javascript
// Create real temp directories for file system testing
function writeTemplateFixture(templateRoot) {
  fs.mkdirSync(path.join(templateRoot, '_config'), { recursive: true });
  fs.mkdirSync(path.join(templateRoot, 'shared'), { recursive: true });

  fs.writeFileSync(path.join(templateRoot, 'CLAUDE.md'), 'Project documentation');
  fs.writeFileSync(path.join(templateRoot, '_config/brand-voice.md'), 'Brand guidelines');
}
```

**What to Mock:**
- HTTP endpoints (especially error conditions)
- External services (GitHub API responses)
- Ollama API (offline scenarios)

**What NOT to Mock:**
- File system operations (use actual temp directories with cleanup)
- Configuration loading (create real config files)
- Core logic being tested (scaffolding, normalization)

## Fixtures and Factories

**Test Data Creation:**
- Temporary directories: `fs.mkdtempSync(path.join(os.tmpdir(), 'prefix-'))`
- Template fixtures: Create directory structure with standard project layout
- Config objects: Pass as parameters to functions

**Fixture from icm-scaffolder.test.js:**
```javascript
function writeTemplateFixture(templateRoot) {
  fs.mkdirSync(path.join(templateRoot, '_config'), { recursive: true });
  fs.mkdirSync(path.join(templateRoot, 'shared'), { recursive: true });
  fs.mkdirSync(path.join(templateRoot, 'skills'), { recursive: true });

  fs.writeFileSync(path.join(templateRoot, 'CLAUDE.md'), [
    '# [Your Project Name]',
    '[describe the AI\'s purpose in 1-2 sentences]'
  ].join('\n'));

  fs.writeFileSync(path.join(templateRoot, '_config/brand-voice.md'), [
    '[Describe your target audience...]',
    '[Describe the tone...]'
  ].join('\n'));

  fs.writeFileSync(path.join(templateRoot, 'shared/README.md'), 'Shared resources');
  fs.writeFileSync(path.join(templateRoot, 'skills/README.md'), 'Skills resources');
}
```

**Location:** Helper functions defined at top of test file before test declarations

## Coverage

**Requirements:** Not enforced; no coverage configuration

**View Coverage:** No automated coverage tool configured

## Test Types

**Unit Tests:**
- **Scope:** Individual function/module logic
- **File:** `test/unit/icm-scaffolder.test.js`
- **Examples tested:**
  - `slugify()`: Normalizes unsafe project names correctly
  - `normalizeStages()`: Creates unique stage slugs deterministically
  - `scaffoldProject()`: Creates expected directory structure
  - `scaffoldProject()`: Enforces path allowlist security

**E2E Tests:**
- **Scope:** Full user workflows in browser
- **File:** `test/e2e/create-mode.spec.js`
- **Framework:** Playwright
- **Examples tested:**
  - Create mode renders when Ollama is offline
  - Wizard creates project and opens in file browser

**Integration Tests:**
- Not explicitly separated; unit tests verify multi-module interactions

## Common Patterns

**Async Testing:**
```javascript
test('wizard creates project and opens in file browser', async ({ page, request }) => {
  const outputRoot = await getAllowedRoot(request);
  const projectName = `E2E Create ${Date.now()}`;
  const projectSlug = slugify(projectName);

  await openCreateMode(page);
  await page.getByLabel('Project name').fill(projectName);
  await page.getByRole('button', { name: 'Next' }).click();

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
    const result = scaffoldProject({
      name: 'Unit Test Workspace',
      description: 'Workspace scaffold test',
      role: 'Test assistant',
      audience: 'Product managers',
      tone: 'Professional',
      stages: [
        { name: 'Research', purpose: 'Collect references' },
        { name: 'Draft', purpose: 'Create draft outputs' }
      ],
      outputRoot: allowedRoot
    });

    assert.equal(result.success, true);
    assert.equal(result.projectSlug, 'unit-test-workspace');
    assert.ok(fs.existsSync(path.join(result.projectPath, 'CLAUDE.md')));
  } finally {
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
  }
});
```

**Error Testing:**
```javascript
test('scaffoldProject blocks output roots outside allowlist', () => {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffolder-unit-'));
  const allowedRoot = path.join(sandboxRoot, 'allowed-root');
  const outsideRoot = path.join(sandboxRoot, 'outside-root');

  fs.mkdirSync(allowedRoot, { recursive: true });
  fs.mkdirSync(outsideRoot, { recursive: true });
  writeTemplateFixture(templateRoot);

  try {
    assert.throws(
      () => {
        scaffoldProject({
          name: 'Outside Root Workspace',
          outputRoot: outsideRoot  // Outside allowlist
        });
      },
      err => err instanceof ScaffolderError &&
             err.code === 'PATH_OUTSIDE_ROOT' &&
             err.status === 403
    );
  } finally {
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
  }
});
```

**Browser Automation:**
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

## Playwright Configuration

**File:** `playwright.config.js`

```javascript
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/e2e',
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
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
- Test directory: `./test/e2e`
- Test timeout: 45 seconds
- Base URL: localhost on port 4173
- Server startup: `node server.js` on port 4173
- Headless mode: enabled by default

## Test Execution Notes

**Unit Tests:**
- Isolated from running application
- File-based, no server dependencies
- Run with: `node --test`

**E2E Tests:**
- Require running server on port 4173
- Run with: `npx playwright test`
- Automatically starts server via `webServer` config
- Re-uses existing server if available

**Dependencies:**
- Unit tests need: Node 18+, file system access
- E2E tests need: Node 18+, Playwright, running server

---

*Testing analysis: 2026-03-13*
