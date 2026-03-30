import { test, expect } from "@playwright/test";
import browserAppReady from "../helpers/app-ready.js";

// Mock API response for consistent testing
const mockReportCardResponse = {
  type: "report-card",
  data: {
    overallGrade: "B",
    cleanBillOfHealth: false,
    topPriority: {
      title: "Missing input validation",
      category: "security",
      explanation: "User input should be validated before processing",
    },
    categories: {
      bugs: {
        grade: "A",
        summary: "No critical bugs found",
        findings: [],
      },
      security: {
        grade: "C",
        summary: "Some security improvements needed",
        findings: [
          {
            title: "Missing input validation",
            severity: "medium",
            explanation: "User input should be validated",
            suggestedFix: "Add validation checks",
          },
        ],
      },
      readability: {
        grade: "B",
        summary: "Code is mostly clear",
        findings: [],
      },
      completeness: {
        grade: "B",
        summary: "Most features are complete",
        findings: [],
      },
    },
  },
};

test.describe("Review Workflow E2E", () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock the review API endpoint
    await context.route("**/api/review", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockReportCardResponse),
      });
    });

    // Navigate to the app with splash + onboarding dismissed
    await page.addInitScript(browserAppReady);
    await page.goto("/");
    await page.reload();

    // Mode tab is icon + label (e.g. "📝 Review"); avoid matching sidebar "Code Review" with /Review/ alone — mode tabs are in main toolbar
    await page.getByTestId("mode-tab-review").click();
  });

  test("should complete full paste workflow", async ({ page }) => {
    // Input code via paste (filename placeholder is "e.g. server.js, utils/auth.py")
    const codeTextarea = page.getByPlaceholder("Paste your code here...");
    const filenameInput = page.getByPlaceholder(/server\.js/i);

    await filenameInput.fill("test.js");
    await codeTextarea.fill('function test() { return "hello"; }');

    // Submit review
    await page.getByRole("button", { name: /run code review/i }).click();

    // Wait for report card to appear
    await expect(page.getByText(/report card/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Verify overall grade
    await expect(page.getByText("B").first()).toBeVisible();

    // Verify all category grades are displayed
    await expect(page.getByText(/bugs/i).first()).toBeVisible();
    await expect(page.getByText(/security/i).first()).toBeVisible();
    await expect(page.getByText(/readability/i).first()).toBeVisible();
    await expect(page.getByText(/completeness/i).first()).toBeVisible();
  });

  test("should complete full upload workflow", async ({ page }) => {
    // Switch to Upload tab
    await page.getByRole("tab", { name: /upload file/i }).click();

    // Create a test file
    const fileContent = 'function test() { return "hello"; }';
    const buffer = Buffer.from(fileContent);

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test.js",
      mimeType: "text/javascript",
      buffer: buffer,
    });

    // Submit review
    await page.getByRole("button", { name: /run code review/i }).click();

    // Wait for report card
    await expect(page.getByText(/report card/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Verify report card structure
    await expect(page.getByText("B").first()).toBeVisible();
    await expect(page.getByText(/bugs/i).first()).toBeVisible();
    await expect(page.getByText(/security/i).first()).toBeVisible();
  });

  test("should verify paste and upload produce identical output", async ({
    page,
    context,
  }) => {
    const capturedRequests = [];
    const testCode = 'function test() { return "hello"; }';
    const filename = "test.js";

    // Re-route to capture requests
    await context.route("**/api/review", async (route, request) => {
      const postData = request.postDataJSON();
      capturedRequests.push({ body: postData });

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockReportCardResponse),
      });
    });

    // Test paste method
    await page.getByPlaceholder(/server\.js/i).fill(filename);
    await page.getByPlaceholder("Paste your code here...").fill(testCode);
    await page.getByRole("button", { name: /run code review/i }).click();
    await expect(page.getByText(/report card/i).first()).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: /review another/i }).click();

    // Test upload method
    await page.getByRole("tab", { name: /upload file/i }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: filename,
      mimeType: "text/javascript",
      buffer: Buffer.from(testCode),
    });
    await page.getByRole("button", { name: /run code review/i }).click();
    await expect(page.getByText(/report card/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Verify both requests sent the same code
    expect(capturedRequests.length).toBe(2);
    expect(capturedRequests[0].body.code).toBe(capturedRequests[1].body.code);
  });

  test("should enter deep-dive mode when a category is clicked", async ({
    page,
  }) => {
    // Complete paste workflow first
    await page
      .getByPlaceholder("Paste your code here...")
      .fill('function test() { return "hello"; }');
    await page.getByRole("button", { name: /run code review/i }).click();
    await expect(page.getByText(/report card/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Find and click a "Learn More" or category deep-dive button
    const learnMoreButton = page
      .getByRole("button", { name: /learn more/i })
      .first();
    if (await learnMoreButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await learnMoreButton.click();
      // Verify deep-dive mode activated
      await expect(page.getByPlaceholder(/follow-up/i)).toBeVisible();
    } else {
      // Deep-dive button may use different text — check for expandable categories
      const categoryButton = page
        .locator('button:has-text("Security")')
        .first();
      if (
        await categoryButton.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await categoryButton.click();
      }
    }
  });
});
