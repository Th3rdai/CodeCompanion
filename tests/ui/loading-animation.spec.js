/**
 * Component tests for LoadingAnimation
 * Tests bouncing animation, rotating messages, accessibility, and filename display
 * Uses a delayed API mock to ensure loading state is visible long enough to test
 */

import { test, expect } from "@playwright/test";
import browserAppReady from "../helpers/app-ready.js";

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
  test.beforeEach(async ({ page, context }) => {
    // Mock models API so the app thinks Ollama is connected
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

    // Mock review API with a 3s delay so loading state stays visible
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
    });
    await page.reload();
    // Wait for model fetch to complete and button to become enabled
    await page.waitForResponse("**/api/models");
    await page.getByTestId("mode-tab-review").click();
  });

  test("displays bouncing dots animation", async ({ page }) => {
    await page
      .getByPlaceholder("Paste your code here...")
      .fill("function test() { return true; }");
    await page.getByRole("button", { name: /run code review/i }).click();

    // Check for bouncing dots (3 animated elements)
    await expect(page.locator(".animate-bounce").first()).toBeVisible();
    const bouncingDots = await page.locator(".animate-bounce").count();
    expect(bouncingDots).toBe(3);
  });

  test("displays rotating encouraging messages", async ({ page }) => {
    await page
      .getByPlaceholder("Paste your code here...")
      .fill("function test() { return true; }");
    await page.getByRole("button", { name: /run code review/i }).click();

    // Wait for loading state
    await expect(
      page.locator('section[aria-label="Review in progress"]'),
    ).toBeVisible();

    // Check that at least one encouraging message is displayed
    const messageText = await page
      .locator('section[aria-label="Review in progress"] p.text-slate-300')
      .first()
      .textContent();

    const encouragingPhrases = [
      "Looking for ways to make your code even better!",
      "Checking for any gotchas...",
      "Making sure everything's ship-shape!",
      "Scanning for those sneaky edge cases...",
    ];

    const containsEncouragingPhrase = encouragingPhrases.some(
      (phrase) =>
        messageText?.includes(phrase) || messageText?.includes("Analyzing"),
    );
    expect(containsEncouragingPhrase).toBeTruthy();
  });

  test("has aria-live region for screen reader accessibility", async ({
    page,
  }) => {
    await page
      .getByPlaceholder("Paste your code here...")
      .fill("function test() { return true; }");
    await page.getByRole("button", { name: /run code review/i }).click();

    // Check for aria-live region
    const ariaLiveRegion = await page.locator('[aria-live="polite"]').count();
    expect(ariaLiveRegion).toBeGreaterThan(0);
  });

  test("displays filename when provided", async ({ page }) => {
    await page.getByPlaceholder(/server\.js/i).fill("test.js");
    await page
      .getByPlaceholder("Paste your code here...")
      .fill("function test() { return true; }");
    await page.getByRole("button", { name: /run code review/i }).click();

    // Check that filename is displayed during loading
    await expect(
      page.locator('section[aria-label="Review in progress"]'),
    ).toBeVisible();
    const content = await page
      .locator('section[aria-label="Review in progress"]')
      .textContent();
    expect(content).toContain("test.js");
  });
});
