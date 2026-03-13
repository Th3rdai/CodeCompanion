const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64) || 'new-project';
}

async function getAllowedRoot(request) {
  const configResponse = await request.get('/api/config');
  expect(configResponse.ok()).toBeTruthy();
  const config = await configResponse.json();
  const outputRoot = config.createModeAllowedRoots?.[0] || path.join(os.homedir(), 'AI_Dev');
  fs.mkdirSync(outputRoot, { recursive: true });
  return outputRoot;
}

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

test('wizard creates project and opens it in file browser', async ({ page, request }) => {
  const outputRoot = await getAllowedRoot(request);
  const projectName = `E2E Create ${Date.now()}`;
  const projectSlug = slugify(projectName);
  const projectPath = path.join(outputRoot, projectSlug);

  try {
    await openCreateMode(page);

    await page.getByLabel('Project name').fill(projectName);
    await page.getByLabel('Project description').fill('Create mode end-to-end validation project');
    await page.getByLabel('AI role').fill('A PM-focused project setup assistant');
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByLabel('Target audience').fill('Product managers');
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Output location' }).fill(outputRoot);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Create Project' }).click();

    await expect(page.getByRole('heading', { name: 'Project Created' })).toBeVisible();
    const fileBrowser = page.getByRole('complementary', { name: 'File browser' });
    await expect(fileBrowser).toBeVisible();
    await expect(fileBrowser.getByText(projectPath)).toBeVisible();
    await expect(page.getByRole('treeitem', { name: 'File: CLAUDE.md' })).toBeVisible();
  } finally {
    fs.rmSync(projectPath, { recursive: true, force: true });
  }
});

test('API guardrails reject duplicate and invalid-root creates', async ({ request }) => {
  const outputRoot = await getAllowedRoot(request);
  const projectName = `E2E Duplicate ${Date.now()}`;
  const payload = {
    name: projectName,
    description: 'API guardrail test',
    role: 'Validation assistant',
    audience: 'PM',
    tone: 'Professional',
    stages: [
      { name: 'Research', purpose: 'Gather context' },
      { name: 'Draft', purpose: 'Create draft output' },
      { name: 'Review', purpose: 'Finalize output' }
    ],
    outputRoot,
    overwrite: false
  };

  const projectPath = path.join(outputRoot, slugify(projectName));

  try {
    const firstCreate = await request.post('/api/create-project', { data: payload });
    expect(firstCreate.status()).toBe(201);

    const duplicateCreate = await request.post('/api/create-project', { data: payload });
    expect(duplicateCreate.status()).toBe(409);
    const duplicateJson = await duplicateCreate.json();
    expect(duplicateJson.code).toBe('PROJECT_EXISTS');

    const invalidRootCreate = await request.post('/api/create-project', {
      data: { ...payload, name: `${projectName}-bad-root`, outputRoot: os.tmpdir() }
    });
    expect(invalidRootCreate.status()).toBe(403);
    const invalidRootJson = await invalidRootCreate.json();
    expect(invalidRootJson.code).toBe('PATH_OUTSIDE_ROOT');
  } finally {
    fs.rmSync(projectPath, { recursive: true, force: true });
  }
});
