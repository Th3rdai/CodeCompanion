/**
 * E2E tests for Prompting builder mode
 * Tests navigation, field input, scoring with mocked API, and score card display
 */

import { test, expect } from "@playwright/test";
import browserAppReady from "../helpers/app-ready.js";

const mockScoreResponse = {
  type: "score-card",
  data: {
    overallGrade: "B",
    summary: "Good prompt with room for improvement",
    categories: {
      clarity: {
        grade: "A",
        summary: "Clear and well-articulated",
        suggestions: [],
      },
      specificity: {
        grade: "B",
        summary: "Mostly specific",
        suggestions: ["Add more concrete examples"],
      },
      structure: {
        grade: "C",
        summary: "Could use better organization",
        suggestions: ["Add section headers", "Use numbered steps"],
      },
      effectiveness: {
        grade: "B",
        summary: "Should produce good results",
        suggestions: ["Include output format specification"],
      },
    },
  },
};

test.describe("Prompting Builder Mode", () => {
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

    await context.route("**/api/score", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockScoreResponse),
      });
    });

    await page.addInitScript(browserAppReady);
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("cc-selected-model", "test-model");
    });
    await page.reload();
    await page.waitForResponse("**/api/models");

    // Navigate to Prompting mode (icon + label — scope to main to avoid sidebar matches)
    await page.getByTestId("mode-tab-prompting").click();
  });

  test("displays prompt builder input fields", async ({ page }) => {
    await expect(
      page.getByPlaceholder(/write your prompt here/i),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder(/what should this prompt achieve/i),
    ).toBeVisible();
    await expect(page.getByPlaceholder(/which ai is this for/i)).toBeVisible();
  });

  test("score button is disabled when prompt text is empty", async ({
    page,
  }) => {
    const scoreBtn = page.getByRole("button", { name: /score/i });
    if (await scoreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(scoreBtn).toBeDisabled();
    }
  });

  test("submits prompt for scoring and displays score card", async ({
    page,
  }) => {
    // Fill in the prompt content
    await page
      .getByPlaceholder(/write your prompt here/i)
      .fill(
        "You are a helpful code reviewer. Analyze the following code and provide feedback on bugs, security, and readability.",
      );
    await page
      .getByPlaceholder(/what should this prompt achieve/i)
      .fill("Code review feedback");

    // Click score button
    const scoreBtn = page.getByRole("button", { name: /score/i });
    await scoreBtn.click();

    // Wait for score card to appear
    await expect(page.getByText(/score report/i).first()).toBeVisible({
      timeout: 15000,
    });

    // Verify grade is displayed
    await expect(page.getByText("B").first()).toBeVisible();

    // Verify category labels are present
    await expect(page.getByText(/clarity/i).first()).toBeVisible();
    await expect(page.getByText(/specificity/i).first()).toBeVisible();
    await expect(page.getByText(/structure/i).first()).toBeVisible();
    await expect(page.getByText(/effectiveness/i).first()).toBeVisible();
  });

  test("score card categories are expandable", async ({ page }) => {
    // Fill and score
    await page
      .getByPlaceholder(/write your prompt here/i)
      .fill("Test prompt for scoring");
    await page.getByRole("button", { name: /score/i }).click();
    await expect(page.getByText(/score report/i).first()).toBeVisible({
      timeout: 15000,
    });

    // Click on a category row button to expand suggestions
    const structureBtn = page
      .getByRole("button", { name: /structure/i })
      .first();
    await structureBtn.click();

    // Suggestions should be visible after expanding
    await expect(page.getByText(/add section headers/i)).toBeVisible({
      timeout: 5000,
    });
  });
});
