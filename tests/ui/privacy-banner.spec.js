const { test, expect } = require("@playwright/test");
const browserAppReady = require("../helpers/app-ready.js");
const { reloadAndWaitForModels } = require("../helpers/reload-app-ready.js");

test.describe("Privacy banner", () => {
  test.beforeEach(async ({ page, context }) => {
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
    await page.addInitScript(browserAppReady);
    await page.goto("/");
    // Clear privacy banner dismissal, ensure onboarding is complete
    await page.evaluate(() => {
      localStorage.removeItem("th3rdai_privacy_banner_dismissed");
      localStorage.setItem("th3rdai_onboarding_complete", "true");
    });
    await reloadAndWaitForModels(page);
  });

  test("UX-04: privacy banner visible on first launch", async ({ page }) => {
    await expect(page.getByTestId("privacy-banner-dismiss")).toBeVisible({
      timeout: 45_000,
    });
    await expect(
      page.getByText(/Your code and conversations stay on your machine/i),
    ).toBeVisible();
  });

  test("UX-04: privacy banner dismisses and persists dismissal", async ({
    page,
  }) => {
    const dismiss = page.getByTestId("privacy-banner-dismiss");
    await expect(dismiss).toBeVisible({ timeout: 15_000 });
    await expect(dismiss).toBeEnabled();
    await dismiss.scrollIntoViewIfNeeded();
    await dismiss.click();

    await expect(page.getByTestId("privacy-banner-dismiss")).not.toBeVisible();

    // Reload and verify banner does not reappear
    await reloadAndWaitForModels(page);
    await expect(page.getByTestId("privacy-banner-dismiss")).not.toBeVisible();
  });
});
