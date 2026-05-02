const { test, expect } = require("@playwright/test");

test.describe("OnboardingWizard component", () => {
  test.describe.configure({ timeout: 120_000, mode: "serial" });

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
    await page.addInitScript(() => {
      sessionStorage.setItem("th3rdai_splash_dismissed", "true");
    });
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.removeItem("th3rdai_onboarding_complete"),
    );
    // Do not use reloadAndWaitForModels — wizard overlay can delay #model-select.
    const url = new URL(page.url());
    url.searchParams.set("_cc_reload", String(Date.now()));
    await page.goto(url.toString(), { waitUntil: "load", timeout: 60_000 });
    await expect(
      page.getByRole("dialog", { name: "Welcome wizard" }),
    ).toBeVisible({ timeout: 45_000 });
  });

  test("UX-01: displays 5 steps with correct vibe-coder content", async ({
    page,
  }) => {
    // Step 1: Welcome (heading — more stable than substring text match under load)
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Welcome to Code Companion",
      }),
    ).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/AI coding tool/i)).toBeVisible({
      timeout: 30_000,
    });

    // Navigate to Step 2: Ollama
    await page.getByRole("button", { name: /Next/i }).click();
    await expect(page.getByText("Connect to Ollama")).toBeVisible();
    await expect(page.getByText(/Troubleshooting/i)).toBeVisible();

    // Navigate to Step 3: Modes
    await page.getByRole("button", { name: /Next/i }).click();
    await expect(page.getByText("Pick Your Mode")).toBeVisible();
    // Verify Lucide icons rendered (not emoji) — 8 SVG icons in the mode grid
    const modeGrid = page.locator(".grid");
    await expect(modeGrid.locator("svg")).toHaveCount(8);

    // Navigate to Step 4: Images
    await page.getByRole("button", { name: /Next/i }).click();
    await expect(page.getByText("Upload Images")).toBeVisible();

    // Navigate to Step 5: Privacy
    await page.getByRole("button", { name: /Next/i }).click();
    await expect(page.getByText("Your Data Stays Here")).toBeVisible();
  });

  test("UX-01: keyboard navigation works (arrow keys, Enter, Escape)", async ({
    page,
  }) => {
    // Verify wizard is showing
    const wizard = page.getByRole("dialog", { name: "Welcome wizard" });
    await expect(wizard).toBeVisible({ timeout: 30_000 });

    // Click overlay so the dialog container (tabIndex=0) receives focus — locator.focus() flakes in CI
    await wizard.click({ position: { x: 24, y: 24 } });

    // ArrowRight advances step (content fades ~200ms between steps)
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Connect to Ollama")).toBeVisible({
      timeout: 10_000,
    });

    // ArrowLeft goes back
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("Welcome to Code Companion")).toBeVisible({
      timeout: 10_000,
    });

    // Escape closes wizard
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Welcome wizard" }),
    ).not.toBeVisible({ timeout: 10_000 });
  });
});
