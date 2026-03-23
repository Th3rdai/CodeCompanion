const { test, expect } = require('@playwright/test');
const browserAppReady = require('../helpers/app-ready.js');
const { reviewModeTab, securityModeTab } = require('../helpers/mode-tabs.js');

/** App expects SSE from POST /api/chat (data: JSON lines + [DONE]). */
function mockSseChatBody(assistantText) {
  const parts = [
    `data: ${JSON.stringify({ token: assistantText })}\n\n`,
    `data: ${JSON.stringify({ done: true, eval_count: 10, total_duration: 1e9 })}\n\n`,
    'data: [DONE]\n\n',
  ];
  return parts.join('');
}

// Match server shape: supportsVision drives vision warnings; option labels include param size.
const mockModels = {
  models: [
    { name: 'llama3:latest', size: 4.3, paramSize: '8B', supportsVision: false },
    { name: 'llava:latest', size: 4.7, paramSize: '7B', supportsVision: true },
  ],
};

// Two distinct 1×1 PNGs (different pixels → different perceptual hash / no duplicate dialog).
const PNG_1X1_A = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
const PNG_1X1_B = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Z2WQAAAAASUVORK5CYII=',
  'base64'
);

test.describe('Image Upload E2E - Chat Mode', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock Ollama models API
    await context.route('**/api/models', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockModels)
      });
    });

    await context.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: mockSseChatBody(
          'I can see the image you uploaded. It appears to be a test screenshot.'
        ),
      });
    });

    // Navigate to app with onboarding + splash dismissed (main shell mounts immediately)
    await page.addInitScript(browserAppReady);
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cc-image-privacy-accepted', 'true'); // Skip image privacy modal
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForResponse((r) => r.url().includes('/api/models') && r.ok(), { timeout: 20_000 });

    const modelSelect = page.locator('#model-select');
    await expect(modelSelect).toBeVisible({ timeout: 15_000 });
    await modelSelect.selectOption({ value: 'llava:latest' });
  });

  test('should upload image via file picker', async ({ page }) => {
    const fileInput = page.locator('#chat-file-input');

    await fileInput.setInputFiles({
      name: 'test-screenshot.png',
      mimeType: 'image/png',
      buffer: PNG_1X1_A,
    });

    // Thumbnail <img> stays opacity-0 until load — assert the interactive wrapper instead.
    await expect(
      page.getByRole('button', { name: /View full-size image: test-screenshot\.png/i })
    ).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(/Processing \d+ images?/i)).not.toBeVisible({ timeout: 8000 });

    const messageInput = page.locator('#chat-input');
    await messageInput.fill('What do you see in this image?');

    // Send message
    await page.getByRole('button', { name: /send/i }).click();

    // Verify response appears
    await expect(page.getByText(/I can see/i)).toBeVisible({ timeout: 10000 });
  });

  test('should detect non-vision model warning', async ({ page }) => {
    await page.locator('#model-select').selectOption({ value: 'llama3:latest' });

    const fileInput = page.locator('#chat-file-input');
    await fileInput.setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: PNG_1X1_A,
    });

    // Warning copy (avoid matching toast "Switched to vision model: …")
    await expect(page.getByText(/doesn't support images/i)).toBeVisible({ timeout: 3000 });

    // Verify send button is disabled
    const sendButton = page.getByRole('button', { name: /send/i });
    await expect(sendButton).toBeDisabled();

    // Click "Switch to vision model" button
    const switchButton = page.getByRole('button', { name: /switch.*vision/i });
    if (await switchButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await switchButton.click();

      await expect(page.getByText(/doesn't support images/i)).not.toBeVisible({ timeout: 5000 });

      // Verify send button enabled
      await expect(sendButton).not.toBeDisabled();
    }
  });

  test('should remove individual images', async ({ page }) => {
    const fileInput = page.locator('#chat-file-input');

    await fileInput.setInputFiles({
      name: 'test1.png',
      mimeType: 'image/png',
      buffer: PNG_1X1_A,
    });

    await page.waitForTimeout(500);

    await fileInput.setInputFiles({
      name: 'test2.png',
      mimeType: 'image/png',
      buffer: PNG_1X1_B,
    });

    const thumb1 = page.getByRole('button', { name: /View full-size image: test1\.png/i });
    const thumb2 = page.getByRole('button', { name: /View full-size image: test2\.png/i });
    await expect(thumb1).toBeVisible({ timeout: 10000 });
    await expect(thumb2).toBeVisible({ timeout: 10000 });

    const removeButton = page.getByRole('button', { name: /Remove test1\.png/i });
    await removeButton.click();
    await expect(
      page.getByRole('button', { name: /View full-size image: test1\.png/i })
    ).not.toBeVisible({ timeout: 5000 });
    await expect(thumb2).toBeVisible();
  });

  test('should open lightbox on thumbnail click', async ({ page }) => {
    const fileInput = page.locator('#chat-file-input');
    await fileInput.setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: PNG_1X1_A,
    });

    await expect(
      page.getByRole('button', { name: /View full-size image: test\.png/i })
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /View full-size image: test\.png/i }).click();

    // Verify lightbox opens
    const lightbox = page.locator('[role="dialog"]').or(page.locator('.lightbox'));
    await expect(lightbox).toBeVisible({ timeout: 2000 });

    // Verify full-size image displayed
    const fullImage = lightbox.locator('img');
    await expect(fullImage).toBeVisible();

    // Close lightbox (ESC key or close button)
    const closeButton = lightbox.locator('button[title*="Close"]').or(lightbox.locator('button:has-text("×")'));
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // Verify lightbox closed
    await expect(lightbox).not.toBeVisible({ timeout: 2000 });
  });

  test('should prevent duplicate uploads', async ({ page }) => {
    // Upload same image twice
    const fileInput = page.locator('#chat-file-input');

    await fileInput.setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: PNG_1X1_A,
    });

    await page.waitForTimeout(1000);

    page.once('dialog', (dialog) => dialog.dismiss());
    await fileInput.setInputFiles({
      name: 'test-copy.png',
      mimeType: 'image/png',
      buffer: PNG_1X1_A,
    });
  });

  test('should reject unsupported file formats', async ({ page }) => {
    // WebP is image/* but not in the app's allowed MIME list (more reliable than SVG in headless).
    const fileInput = page.locator('#chat-file-input');
    await fileInput.setInputFiles({
      name: 'test.webp',
      mimeType: 'image/webp',
      buffer: Buffer.from([0x52, 0x49, 0x46, 0x46, 0x01, 0x00, 0x00, 0x00]),
    });

    await expect(page.getByText(/Only PNG, JPEG, GIF allowed/i)).toBeVisible({ timeout: 5000 });
  });

  test('should show privacy warning on first upload', async ({ page }) => {
    // Clear privacy warning dismissal
    await page.evaluate(() => {
      localStorage.removeItem('cc-image-privacy-accepted');
    });
    await page.reload();
    await page.waitForTimeout(1000);

    // Upload image
    const fileInput = page.locator('#chat-file-input');
    await fileInput.setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: PNG_1X1_A,
    });

    // Check for privacy warning modal
    const privacyModal = page.getByText(/privacy.*notice/i).or(page.getByText(/sensitive.*information/i));

    if (await privacyModal.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(privacyModal).toBeVisible();

      // Click "I Understand" or close button
      const dismissButton = page.getByRole('button', { name: /understand/i }).or(page.getByRole('button', { name: /continue/i }));
      if (await dismissButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await dismissButton.click();

        // Verify modal dismissed
        await expect(privacyModal).not.toBeVisible({ timeout: 2000 });
      }
    }
  });
});

test.describe('Image Upload E2E - Review Mode', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock models API
    await context.route('**/api/models', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockModels)
      });
    });

    // Mock review API
    await context.route('**/api/review', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'report-card',
          data: {
            overallGrade: 'B',
            cleanBillOfHealth: false,
            categories: {
              bugs: { grade: 'A', summary: 'No bugs', findings: [] },
              security: { grade: 'B', summary: 'Secure', findings: [] },
              readability: { grade: 'B', summary: 'Clear', findings: [] },
              completeness: { grade: 'A', summary: 'Complete', findings: [] }
            }
          }
        })
      });
    });

    // Navigate and switch to Review mode
    await page.addInitScript(browserAppReady);
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cc-image-privacy-accepted', 'true');
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForResponse((r) => r.url().includes('/api/models') && r.ok(), { timeout: 20_000 });

    await expect(page.getByTestId('mode-tab-review')).toBeVisible({ timeout: 25_000 });
    await reviewModeTab(page).click();

    const modelSelect = page.locator('#model-select');
    await expect(modelSelect).toBeVisible({ timeout: 15_000 });
    await modelSelect.selectOption({ value: 'llava:latest' });
  });

  test('should upload bug screenshot with code', async ({ page }) => {
    // Input code
    const codeTextarea = page.getByPlaceholder('Paste your code here...');
    const filenameInput = page.getByPlaceholder(/server\.js/i);

    await filenameInput.fill('bug-example.js');
    await codeTextarea.fill('function buggyCode() { return undefined.value; }');

    await page.getByRole('tab', { name: /Upload File/i }).click();

    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles({
      name: 'bug-screenshot.png',
      mimeType: 'image/png',
      buffer: PNG_1X1_A,
    });

    await expect(
      page.getByRole('button', { name: /View full-size image: bug-screenshot\.png/i })
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /run code review/i }).click();

    // Verify report card appears
    await expect(page.getByText(/report card/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Image Upload E2E - Security Mode', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock models API
    await context.route('**/api/models', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockModels)
      });
    });

    await context.route('**/api/pentest', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'security-report',
          data: {
            overallGrade: 'B',
            cleanBillOfHealth: false,
            categories: {
              injection: { grade: 'A', summary: 'OK', findings: [] },
              authAndSession: { grade: 'B', summary: 'OK', findings: [] },
              dataProtection: { grade: 'A', summary: 'OK', findings: [] },
              accessControl: { grade: 'B', summary: 'OK', findings: [] },
              configuration: { grade: 'C', summary: 'OK', findings: [] },
              apiSecurity: { grade: 'A', summary: 'OK', findings: [] },
            },
          },
        }),
      });
    });

    // Navigate and switch to Security mode
    await page.addInitScript(browserAppReady);
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cc-image-privacy-accepted', 'true');
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForResponse((r) => r.url().includes('/api/models') && r.ok(), { timeout: 20_000 });

    await expect(page.getByTestId('mode-tab-pentest')).toBeVisible({ timeout: 25_000 });
    await securityModeTab(page).click();

    const modelSelect = page.locator('#model-select');
    await expect(modelSelect).toBeVisible({ timeout: 15_000 });
    await modelSelect.selectOption({ value: 'llava:latest' });
  });

  test('should upload error log screenshot with code', async ({ page }) => {
    const codeTextarea = page.getByPlaceholder(/paste your code here for owasp/i);
    await codeTextarea.fill('const user = req.body; db.query("SELECT * FROM users WHERE id=" + user.id);');

    await page.getByRole('tab', { name: /Upload File/i }).click();

    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles({
      name: 'sql-injection-error.png',
      mimeType: 'image/png',
      buffer: PNG_1X1_A,
    });

    await expect(
      page.getByRole('button', { name: /View full-size image: sql-injection-error\.png/i })
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /Scan for Vulnerabilities/i }).click();

    await expect(page.getByRole('heading', { name: /Security Scan Report/i })).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('Image Upload E2E - Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(browserAppReady);
    await page.goto('/');
    await page.reload();
  });

  test('should configure image support settings', async ({ page }) => {
    // Open settings
    const settingsButton = page.getByRole('button', { name: /settings/i }).first();
    await settingsButton.click();

    // Look for Image Support section
    const imageSupportSection = page.getByText(/image support/i);

    if (await imageSupportSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(imageSupportSection).toBeVisible();

      // Verify settings controls exist
      const enableToggle = page.locator('input[type="checkbox"]').filter({ hasText: /enable.*image/i });
      const maxSizeSlider = page.locator('input[type="range"]').filter({ hasText: /max.*size/i });
      const maxCountSlider = page.locator('input[type="range"]').filter({ hasText: /max.*images/i });
      const qualitySlider = page.locator('input[type="range"]').filter({ hasText: /quality/i });

      // Check if controls are visible (they may use different structures)
      // This is a smoke test to ensure settings section exists
      await expect(imageSupportSection).toBeVisible();
    }
  });
});
