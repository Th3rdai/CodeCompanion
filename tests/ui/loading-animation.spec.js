/**
 * Component tests for LoadingAnimation
 * Uses a delayed /api/review mock so loading state stays visible long enough to assert.
 * One submit, multiple assertions (the report view replaces the paste form after completion).
 */

import { test, expect } from "@playwright/test";
import browserAppReady from "../helpers/app-ready.js";
import { reloadAndWaitForModels } from "../helpers/reload-app-ready.js";

const mockReportCardResponse = {
  type: "report-card",
  data: {
    overallGrade: "A",
    cleanBillOfHealth: true,
    topPriority: { category: "bugs", title: "None", explanation: "All good" },
    categories: {
      bugs: { grade: "A", summary: "Clean", findings: [] },
      security: { grade: "A", summary: "Clean", findings: [] },
      readability: { grade: "A", summary: "Clean", findings: [] },
      completeness: { grade: "A", summary: "Clean", findings: [] },
    },
  },
};

test.describe("LoadingAnimation Component", () => {
  test.describe.configure({ timeout: 90_000 });

  test("Review loading UI — animation, messages, accessibility, filename", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });

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

    await context.route("**/api/review", async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockReportCardResponse),
      });
    });

    await page.addInitScript(browserAppReady);
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("cc-selected-model", "test-model");
      localStorage.setItem("th3rdai_privacy_banner_dismissed", "true");
    });
    await reloadAndWaitForModels(page, { timeout: 75_000 });

    const reviewTab = page.getByTestId("mode-tab-review");
    await reviewTab.waitFor({ state: "visible", timeout: 75_000 });
    await reviewTab.scrollIntoViewIfNeeded();
    await reviewTab.click({ timeout: 30_000, force: true });

    await page.getByPlaceholder(/server\.js/i).fill("test.js");
    await page
      .getByPlaceholder("Paste your code here...")
      .fill("function test() { return true; }");
    await page.getByRole("button", { name: /run code review/i }).click();

    const reviewing = page.locator('section[aria-label="Review in progress"]');
    await expect(reviewing).toBeVisible();

    await expect(page.locator(".animate-bounce").first()).toBeVisible();
    expect(await page.locator(".animate-bounce").count()).toBe(3);

    const messageText = await reviewing
      .locator("p.text-slate-300")
      .first()
      .textContent();
    const encouragingPhrases = [
      "Looking for ways to make your code even better!",
      "Checking for any gotchas...",
      "Making sure everything's ship-shape!",
      "Scanning for those sneaky edge cases...",
    ];
    expect(
      encouragingPhrases.some(
        (phrase) =>
          messageText?.includes(phrase) || messageText?.includes("Analyzing"),
      ),
    ).toBeTruthy();

    expect(await page.locator('[aria-live="polite"]').count()).toBeGreaterThan(
      0,
    );

    const content = await reviewing.textContent();
    expect(content).toContain("test.js");
  });
});
