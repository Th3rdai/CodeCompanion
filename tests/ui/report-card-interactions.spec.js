/**
 * Component tests for ReportCard progressive disclosure
 * Tests color-coded grades, minimal default view, and "Show all findings" toggle
 */

const { test, expect } = require("@playwright/test");
const browserAppReady = require("../helpers/app-ready.js");
const { reloadAndWaitForModels } = require("../helpers/reload-app-ready.js");

const MODE_TIMEOUT = 20_000;
const PALETTE_SHORTCUT = process.platform === "darwin" ? "Meta+K" : "Control+K";

async function dismissTransientOverlays(page) {
  const splashDismiss = page.getByRole("button", {
    name: /click or press enter to start/i,
  });
  if (await splashDismiss.isVisible({ timeout: 1000 }).catch(() => false)) {
    await splashDismiss.click();
  }

  const onboardingSkip = page.getByRole("button", { name: /skip tour/i });
  if (await onboardingSkip.isVisible({ timeout: 1000 }).catch(() => false)) {
    await onboardingSkip.first().click();
  }
}

async function enterReviewMode(page) {
  const reviewTab = page.getByTestId("mode-tab-review").first();
  if (await reviewTab.isVisible({ timeout: 2500 }).catch(() => false)) {
    await reviewTab.click({ timeout: MODE_TIMEOUT });
    return;
  }

  const moreButton = page.getByTestId("mode-tab-more").first();
  if (await moreButton.isVisible({ timeout: 2500 }).catch(() => false)) {
    await moreButton.click({ timeout: MODE_TIMEOUT });
    if (await reviewTab.isVisible({ timeout: 2500 }).catch(() => false)) {
      await reviewTab.click({ timeout: MODE_TIMEOUT });
      return;
    }
  }

  const paletteButton = page.getByTestId("mode-tab-palette-open").first();
  if (await paletteButton.isVisible({ timeout: 2500 }).catch(() => false)) {
    await paletteButton.click({ timeout: MODE_TIMEOUT });
  } else {
    await page.keyboard.press(PALETTE_SHORTCUT);
  }

  const paletteList = page.locator("#mode-palette-list");
  if (!(await paletteList.isVisible({ timeout: 2500 }).catch(() => false))) {
    await page.keyboard.press(PALETTE_SHORTCUT);
  }

  await expect(paletteList).toBeVisible({ timeout: MODE_TIMEOUT });
  const reviewOption = page.getByRole("option", { name: /^review$/i }).first();
  await expect(reviewOption).toBeVisible({ timeout: MODE_TIMEOUT });
  await reviewOption.click({ timeout: MODE_TIMEOUT });
}

const mockReportCardResponse = {
  type: "report-card",
  data: {
    overallGrade: "B",
    cleanBillOfHealth: false,
    topPriority: {
      category: "security",
      title: "Missing input validation",
      explanation:
        "The code accepts user input without validation, which could lead to security issues.",
    },
    categories: {
      bugs: {
        grade: "A",
        summary: "No logic errors found",
        findings: [],
      },
      security: {
        grade: "C",
        summary: "Some security concerns need attention",
        findings: [
          {
            severity: "high",
            title: "Missing input validation",
            explanation: "User input is not validated before processing.",
            suggestedFix:
              'Add input validation: if (!input) throw new Error("Invalid input");',
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
        summary: "Most edge cases covered",
        findings: [],
      },
    },
  },
};

test.describe("ReportCard Progressive Disclosure", () => {
  test.describe.configure({ mode: "serial" });
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page, context }) => {
    await page.setViewportSize({ width: 1600, height: 900 });

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

    // Mock the review API so we get a predictable report card
    await context.route("**/api/review", async (route) => {
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
    await expect(page.getByTestId("mode-tab-palette-open").first()).toBeVisible(
      {
        timeout: MODE_TIMEOUT,
      },
    );

    await dismissTransientOverlays(page);
    await enterReviewMode(page);
    await expect(
      page.getByRole("button", { name: /run code review/i }).first(),
    ).toBeVisible({
      timeout: MODE_TIMEOUT,
    });
    await page
      .getByPlaceholder("Paste your code here...")
      .fill("function test() { return true; }");
    const reviewResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/review") && response.status() === 200,
      { timeout: 30_000 },
    );
    await page.getByRole("button", { name: /run code review/i }).click();
    await reviewResponse;

    // Wait for report card shell to appear before assertion-heavy tests.
    await expect(
      page.getByLabel("Code review report card").first(),
    ).toBeVisible({
      timeout: 30_000,
    });
  });

  test("renders grades, shows top priority, and toggles detailed findings", async ({
    page,
  }) => {
    await expect(page.getByText(/bugs/i).first()).toBeVisible();
    await expect(page.getByText(/security/i).first()).toBeVisible();
    await expect(page.getByText(/readability/i).first()).toBeVisible();
    await expect(page.getByText(/completeness/i).first()).toBeVisible();
    await expect(page.getByText("B").first()).toBeVisible();

    await expect(
      page.getByText(/Missing input validation/i).first(),
    ).toBeVisible();

    const showAllButton = page
      .getByRole("button", { name: /show all findings/i })
      .first();
    await expect(showAllButton).toBeVisible({ timeout: 15_000 });
    await showAllButton.click();

    const hideButton = page.getByRole("button", { name: /hide/i }).first();
    await expect(hideButton).toBeVisible({ timeout: 15_000 });
    await hideButton.click();

    await expect(
      page.getByRole("button", { name: /show all findings/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
