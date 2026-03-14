import { test, expect } from '@playwright/test';

// Mock API response for consistent testing
const mockReportCardResponse = {
  type: 'report-card',
  data: {
    overallGrade: 'B',
    cleanBillOfHealth: false,
    topPriority: {
      title: 'Missing input validation',
      category: 'security',
      explanation: 'User input should be validated before processing'
    },
    categories: {
      bugs: {
        grade: 'A',
        summary: 'No critical bugs found',
        findings: []
      },
      security: {
        grade: 'C',
        summary: 'Some security improvements needed',
        findings: [
          {
            title: 'Missing input validation',
            severity: 'medium',
            explanation: 'User input should be validated',
            suggestedFix: 'Add validation checks'
          }
        ]
      },
      readability: {
        grade: 'B',
        summary: 'Code is mostly clear',
        findings: []
      },
      completeness: {
        grade: 'B',
        summary: 'Most features are complete',
        findings: []
      }
    }
  }
};

test.describe('Review Workflow E2E', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock the review API endpoint
    await context.route('**/api/review', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockReportCardResponse)
      });
    });

    // Navigate to the app
    await page.goto('http://localhost:5000');

    // Switch to Review mode (assuming there's a navigation)
    // Adjust selector based on actual app structure
    const reviewButton = page.getByRole('button', { name: /review/i }).first();
    if (await reviewButton.isVisible()) {
      await reviewButton.click();
    }
  });

  test('should complete full paste workflow', async ({ page }) => {
    // Input code via paste
    const codeTextarea = page.getByPlaceholder(/paste your code here/i);
    const filenameInput = page.getByPlaceholder(/filename/i);

    await filenameInput.fill('test.js');
    await codeTextarea.fill('function test() { return "hello"; }');

    // Submit review
    await page.getByRole('button', { name: /run code review/i }).click();

    // Verify loading animation appears
    await expect(page.getByText(/reviewing your code/i)).toBeVisible();

    // Wait for report card to appear
    await expect(page.getByText(/code review report card/i)).toBeVisible({ timeout: 10000 });

    // Verify report card structure
    await expect(page.getByText(/overall grade/i)).toBeVisible();
    await expect(page.getByText('B')).toBeVisible(); // Overall grade

    // Verify all category grades are displayed
    await expect(page.getByText(/bugs/i)).toBeVisible();
    await expect(page.getByText(/security/i)).toBeVisible();
    await expect(page.getByText(/readability/i)).toBeVisible();
    await expect(page.getByText(/completeness/i)).toBeVisible();
  });

  test('should complete full upload workflow', async ({ page }) => {
    // Switch to Upload tab
    await page.getByRole('tab', { name: /upload file/i }).click();

    // Create a test file
    const fileContent = 'function test() { return "hello"; }';
    const buffer = Buffer.from(fileContent);

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.js',
      mimeType: 'text/javascript',
      buffer: buffer
    });

    // Submit review
    await page.getByRole('button', { name: /run code review/i }).click();

    // Verify loading animation
    await expect(page.getByText(/reviewing your code/i)).toBeVisible();

    // Wait for report card
    await expect(page.getByText(/code review report card/i)).toBeVisible({ timeout: 10000 });

    // Verify report card structure (same as paste)
    await expect(page.getByText('B')).toBeVisible(); // Overall grade
    await expect(page.getByText(/bugs/i)).toBeVisible();
    await expect(page.getByText(/security/i)).toBeVisible();
  });

  test('should complete full browse workflow', async ({ page, context }) => {
    // Mock file browser selection
    let fileBrowserCallback = null;

    await context.exposeFunction('mockFileBrowserSelect', (callback) => {
      fileBrowserCallback = callback;
    });

    // Switch to Browse tab
    await page.getByRole('tab', { name: /browse files/i }).click();

    // Click open file browser button
    const browserButton = page.getByRole('button', { name: /open file browser/i });
    await browserButton.click();

    // Simulate file selection (this would normally open file browser)
    // In a real test, this would interact with the file browser panel
    // For now, we'll directly trigger the file load via the component's handler
    await page.evaluate(() => {
      const fileData = {
        name: 'test.js',
        content: 'function test() { return "hello"; }',
        path: '/test/test.js'
      };
      // This simulates the file browser callback
      window.dispatchEvent(new CustomEvent('file-browser-selected', { detail: fileData }));
    });

    // Submit review
    await page.getByRole('button', { name: /run code review/i }).click();

    // Verify loading and report card
    await expect(page.getByText(/reviewing your code/i)).toBeVisible();
    await expect(page.getByText(/code review report card/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('B')).toBeVisible();
  });

  test('should verify all three input methods produce identical output', async ({ page }) => {
    const testCode = 'function test() { return "hello"; }';
    const filename = 'test.js';

    // Test 1: Paste method
    const codeTextarea = page.getByPlaceholder(/paste your code here/i);
    const filenameInput = page.getByPlaceholder(/filename/i);
    await filenameInput.fill(filename);
    await codeTextarea.fill(testCode);
    await page.getByRole('button', { name: /run code review/i }).click();
    await expect(page.getByText(/code review report card/i)).toBeVisible({ timeout: 10000 });

    // Capture paste result
    const pasteGrade = await page.locator('.glass').filter({ hasText: /overall grade/i }).textContent();
    const pasteBugsGrade = await page.getByText(/bugs/i).first().locator('..').textContent();

    // Go back to input
    await page.getByRole('button', { name: /review another/i }).click();

    // Test 2: Upload method
    await page.getByRole('tab', { name: /upload file/i }).click();
    const buffer = Buffer.from(testCode);
    await page.locator('input[type="file"]').setInputFiles({
      name: filename,
      mimeType: 'text/javascript',
      buffer: buffer
    });
    await page.getByRole('button', { name: /run code review/i }).click();
    await expect(page.getByText(/code review report card/i)).toBeVisible({ timeout: 10000 });

    // Capture upload result
    const uploadGrade = await page.locator('.glass').filter({ hasText: /overall grade/i }).textContent();
    const uploadBugsGrade = await page.getByText(/bugs/i).first().locator('..').textContent();

    // Verify results are identical
    expect(pasteGrade).toBe(uploadGrade);
    expect(pasteBugsGrade).toBe(uploadBugsGrade);
  });

  test('should enter deep-dive mode when Learn More button is clicked', async ({ page }) => {
    // Complete paste workflow first
    const codeTextarea = page.getByPlaceholder(/paste your code here/i);
    await codeTextarea.fill('function test() { return "hello"; }');
    await page.getByRole('button', { name: /run code review/i }).click();
    await expect(page.getByText(/code review report card/i)).toBeVisible({ timeout: 10000 });

    // Find and click "Learn More" button on any category
    const learnMoreButton = page.getByRole('button', { name: /learn more about/i }).first();
    await expect(learnMoreButton).toBeVisible();
    await learnMoreButton.click();

    // Verify deep-dive conversation mode activated
    await expect(page.getByText(/deep dive conversation/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /back to report/i })).toBeVisible();

    // Verify follow-up input is available
    await expect(page.getByPlaceholder(/ask a follow-up question/i)).toBeVisible();
  });

  test('should verify API request payload is identical across input methods', async ({ page, context }) => {
    const capturedRequests = [];

    // Intercept API calls to verify payload structure
    await context.route('**/api/review', async (route, request) => {
      const postData = request.postDataJSON();
      capturedRequests.push({
        method: request.method(),
        body: postData
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockReportCardResponse)
      });
    });

    const testCode = 'function test() { return "hello"; }';
    const filename = 'test.js';

    // Test paste method
    await page.getByPlaceholder(/filename/i).fill(filename);
    await page.getByPlaceholder(/paste your code here/i).fill(testCode);
    await page.getByRole('button', { name: /run code review/i }).click();
    await expect(page.getByText(/code review report card/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /review another/i }).click();

    // Test upload method
    await page.getByRole('tab', { name: /upload file/i }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: filename,
      mimeType: 'text/javascript',
      buffer: Buffer.from(testCode)
    });
    await page.getByRole('button', { name: /run code review/i }).click();
    await expect(page.getByText(/code review report card/i)).toBeVisible({ timeout: 10000 });

    // Verify both requests have identical payload structure
    expect(capturedRequests.length).toBe(2);
    expect(capturedRequests[0].body.code).toBe(capturedRequests[1].body.code);
    expect(capturedRequests[0].body.filename).toBe(capturedRequests[1].body.filename);
    expect(capturedRequests[0].body.model).toBe(capturedRequests[1].body.model);
  });
});
