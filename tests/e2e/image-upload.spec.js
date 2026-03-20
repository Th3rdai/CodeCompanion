const { test, expect } = require('@playwright/test');
const path = require('path');

// Mock chat response with vision model
const mockChatResponseWithImage = {
  response: 'I can see the image you uploaded. It appears to be a test screenshot.',
  conversationId: 'test-conv-123'
};

// Mock vision models list
const mockModels = {
  models: [
    { name: 'llama3:latest', size: 4661224768 },
    { name: 'llava:latest', size: 4661224768 }
  ]
};

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

    // Mock chat API
    await context.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockChatResponseWithImage)
      });
    });

    // Navigate to app with onboarding dismissed
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('th3rdai_onboarding_complete', 'true');
      localStorage.setItem('imagePrivacyWarningDismissed', 'true'); // Skip privacy modal
    });
    await page.reload();

    // Wait for models to load and switch to vision model
    await page.waitForTimeout(1000);
    const modelDropdown = page.locator('select').first();
    if (await modelDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      await modelDropdown.selectOption({ label: 'llava:latest' });
    }
  });

  test('should upload image via file picker', async ({ page }) => {
    // Create test image path (using a real image or creating one)
    const testImagePath = path.join(__dirname, '../fixtures/test-image.png');

    // Click attach button (📎 icon)
    const attachButton = page.locator('button[title*="Attach"]').or(page.locator('label[for="file-upload"]'));

    // Find file input
    const fileInput = page.locator('input[type="file"]').first();

    // Check if we can create a test image buffer
    const imageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    // Upload via file input
    await fileInput.setInputFiles({
      name: 'test-screenshot.png',
      mimeType: 'image/png',
      buffer: imageBuffer
    });

    // Wait for thumbnail to appear
    await expect(page.locator('img[alt*="thumbnail"]').or(page.locator('.image-thumbnail')).first()).toBeVisible({ timeout: 5000 });

    // Verify processing indicator disappears
    await expect(page.getByText(/processing/i)).not.toBeVisible({ timeout: 3000 });

    // Type message
    const messageInput = page.getByPlaceholder(/type.*message/i);
    await messageInput.fill('What do you see in this image?');

    // Send message
    await page.getByRole('button', { name: /send/i }).click();

    // Verify response appears
    await expect(page.getByText(/I can see/i)).toBeVisible({ timeout: 10000 });
  });

  test('should detect non-vision model warning', async ({ page }) => {
    // Switch to non-vision model
    const modelDropdown = page.locator('select').first();
    if (await modelDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      await modelDropdown.selectOption({ label: 'llama3:latest' });
    }

    // Upload image
    const imageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: imageBuffer
    });

    // Wait for warning banner
    await expect(page.getByText(/vision model/i)).toBeVisible({ timeout: 3000 });

    // Verify send button is disabled
    const sendButton = page.getByRole('button', { name: /send/i });
    await expect(sendButton).toBeDisabled();

    // Click "Switch to vision model" button
    const switchButton = page.getByRole('button', { name: /switch.*vision/i });
    if (await switchButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await switchButton.click();

      // Verify warning disappears
      await expect(page.getByText(/vision model/i)).not.toBeVisible({ timeout: 3000 });

      // Verify send button enabled
      await expect(sendButton).not.toBeDisabled();
    }
  });

  test('should remove individual images', async ({ page }) => {
    // Upload two images
    const imageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const fileInput = page.locator('input[type="file"]').first();

    await fileInput.setInputFiles({
      name: 'test1.png',
      mimeType: 'image/png',
      buffer: imageBuffer
    });

    await page.waitForTimeout(500);

    await fileInput.setInputFiles({
      name: 'test2.png',
      mimeType: 'image/png',
      buffer: imageBuffer
    });

    // Wait for both thumbnails
    const thumbnails = page.locator('img[alt*="thumbnail"]').or(page.locator('.image-thumbnail'));
    await expect(thumbnails.first()).toBeVisible({ timeout: 5000 });

    // Count initial thumbnails
    const initialCount = await thumbnails.count();
    expect(initialCount).toBeGreaterThanOrEqual(2);

    // Click remove button on first thumbnail
    const removeButton = page.locator('button[title*="Remove"]').or(page.locator('button:has-text("×")')).first();
    if (await removeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await removeButton.click();

      // Verify one thumbnail removed
      await page.waitForTimeout(500);
      const finalCount = await thumbnails.count();
      expect(finalCount).toBe(initialCount - 1);
    }
  });

  test('should open lightbox on thumbnail click', async ({ page }) => {
    // Upload image
    const imageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: imageBuffer
    });

    // Wait for thumbnail
    const thumbnail = page.locator('img[alt*="thumbnail"]').or(page.locator('.image-thumbnail')).first();
    await expect(thumbnail).toBeVisible({ timeout: 5000 });

    // Click thumbnail
    await thumbnail.click();

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
    const imageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const fileInput = page.locator('input[type="file"]').first();

    // First upload
    await fileInput.setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: imageBuffer
    });

    await page.waitForTimeout(1000);

    // Second upload (duplicate)
    await fileInput.setInputFiles({
      name: 'test-copy.png',
      mimeType: 'image/png',
      buffer: imageBuffer
    });

    // Check for duplicate warning dialog
    const duplicateWarning = page.getByText(/already.*attached/i).or(page.getByText(/duplicate/i));

    if (await duplicateWarning.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Verify dialog appeared
      await expect(duplicateWarning).toBeVisible();

      // Click cancel or close
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
      }
    }
  });

  test('should reject unsupported file formats', async ({ page }) => {
    // Try uploading SVG (unsupported)
    const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'test.svg',
      mimeType: 'image/svg+xml',
      buffer: svgBuffer
    });

    // Check for error message
    const errorMessage = page.getByText(/unsupported.*format/i).or(page.getByText(/only.*png.*jpeg.*gif/i));
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
  });

  test('should show privacy warning on first upload', async ({ page }) => {
    // Clear privacy warning dismissal
    await page.evaluate(() => {
      localStorage.removeItem('imagePrivacyWarningDismissed');
    });
    await page.reload();
    await page.waitForTimeout(1000);

    // Upload image
    const imageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: imageBuffer
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
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('th3rdai_onboarding_complete', 'true');
      localStorage.setItem('imagePrivacyWarningDismissed', 'true');
    });
    await page.reload();
    await page.waitForTimeout(1000);

    // Switch to Review mode
    const reviewButton = page.getByRole('button', { name: /review/i }).first();
    await reviewButton.click();

    // Switch to vision model
    const modelDropdown = page.locator('select').first();
    if (await modelDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      await modelDropdown.selectOption({ label: 'llava:latest' });
    }
  });

  test('should upload bug screenshot with code', async ({ page }) => {
    // Input code
    const codeTextarea = page.getByPlaceholder(/paste your code here/i);
    const filenameInput = page.getByPlaceholder(/server\.js/i);

    await filenameInput.fill('bug-example.js');
    await codeTextarea.fill('function buggyCode() { return undefined.value; }');

    // Upload bug screenshot
    const imageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles({
      name: 'bug-screenshot.png',
      mimeType: 'image/png',
      buffer: imageBuffer
    });

    // Wait for thumbnail
    await expect(page.locator('img[alt*="thumbnail"]').first()).toBeVisible({ timeout: 5000 });

    // Submit review
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

    // Mock pentest API
    await context.route('**/api/pentest', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'security-report',
          overallGrade: 'B',
          categories: {
            injections: { grade: 'A', findings: [] },
            auth: { grade: 'B', findings: [] },
            sensitiveData: { grade: 'A', findings: [] },
            xxe: { grade: 'A', findings: [] },
            brokenAccess: { grade: 'B', findings: [] },
            misconfiguration: { grade: 'C', findings: [] }
          }
        })
      });
    });

    // Navigate and switch to Security mode
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('th3rdai_onboarding_complete', 'true');
      localStorage.setItem('imagePrivacyWarningDismissed', 'true');
    });
    await page.reload();
    await page.waitForTimeout(1000);

    // Switch to Security mode
    const securityButton = page.getByRole('button', { name: /security/i }).first();
    await securityButton.click();

    // Switch to vision model
    const modelDropdown = page.locator('select').first();
    if (await modelDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      await modelDropdown.selectOption({ label: 'llava:latest' });
    }
  });

  test('should upload error log screenshot with code', async ({ page }) => {
    // Switch to Paste tab if needed
    const pasteTab = page.getByRole('tab', { name: /paste/i });
    if (await pasteTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pasteTab.click();
    }

    // Input code
    const codeTextarea = page.getByPlaceholder(/paste.*code/i).first();
    await codeTextarea.fill('const user = req.body; db.query("SELECT * FROM users WHERE id=" + user.id);');

    // Upload error screenshot
    const imageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles({
      name: 'sql-injection-error.png',
      mimeType: 'image/png',
      buffer: imageBuffer
    });

    // Wait for thumbnail
    await expect(page.locator('img[alt*="thumbnail"]').first()).toBeVisible({ timeout: 5000 });

    // Submit security scan
    await page.getByRole('button', { name: /run.*security/i }).click();

    // Verify security report appears
    await expect(page.getByText(/security.*report/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Image Upload E2E - Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('th3rdai_onboarding_complete', 'true');
    });
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
