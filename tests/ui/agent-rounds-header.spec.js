import { test, expect } from "@playwright/test";
import browserAppReady from "../helpers/app-ready.js";

test.describe("Header agent rounds selector", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(browserAppReady);
    await page.goto("/");
    await page.reload();
  });

  test("shows #rounds-select in Chat mode", async ({ page }) => {
    await page.getByTestId("mode-tab-chat").click();
    await expect(page.locator("#rounds-select")).toBeVisible();
  });

  test("shows #rounds-select in Explain This (composer modes)", async ({
    page,
  }) => {
    await page.getByTestId("mode-tab-more").click();
    await page.getByTestId("mode-tab-explain").click();
    await expect(page.locator("#rounds-select")).toBeVisible();
  });

  test("hides #rounds-select in Review mode", async ({ page }) => {
    await page.getByTestId("mode-tab-review").click();
    await expect(page.locator("#rounds-select")).toHaveCount(0);
  });

  test("hides #rounds-select in Terminal mode", async ({ page }) => {
    await page.getByTestId("mode-tab-more").click();
    await page.getByTestId("mode-tab-terminal").click();
    await expect(page.locator("#rounds-select")).toHaveCount(0);
  });
});
