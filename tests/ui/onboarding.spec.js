import { test, expect } from "@playwright/test";

test.describe("Onboarding first launch", () => {
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
    // Splash hides the shell; dismiss it so the welcome wizard can appear
    await page.addInitScript(() => {
      sessionStorage.setItem("th3rdai_splash_dismissed", "true");
    });
    // Clear localStorage to simulate first launch
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.removeItem("th3rdai_onboarding_complete"),
    );
    // BFCache-busting navigation — do not wait on #model-select (wizard overlay can
    // delay or obscure it); wait on the wizard itself.
    const url = new URL(page.url());
    url.searchParams.set("_cc_reload", String(Date.now()));
    await page.goto(url.toString(), { waitUntil: "load", timeout: 60_000 });
    await expect(
      page.getByRole("dialog", { name: "Welcome wizard" }),
    ).toBeVisible({ timeout: 60_000 });
  });

  test("UX-01: displays onboarding wizard on first launch", async ({
    page,
  }) => {
    // beforeEach already waited on the wizard dialog — assert welcome content (extra dialog wait can race a closing animation).
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Welcome to Code Companion",
      }),
    ).toBeVisible({ timeout: 60_000 });

    // Verify first step content matches vibe-coder tone
    await expect(page.getByText(/AI coding tool/i)).toBeVisible();
    await expect(page.getByText(/Product Managers/i)).not.toBeVisible(); // Should NOT appear
  });

  test("UX-01: wizard persists completion to localStorage", async ({
    page,
  }) => {
    const wizardDialog = () =>
      page.getByRole("dialog", { name: "Welcome wizard" });
    await expect(wizardDialog()).toBeVisible();
    // Re-resolve dialog each step — inner content remounts on slide transitions
    await wizardDialog().getByRole("button", { name: /Next/i }).click(); // Step 2 — Ollama
    await expect(page.getByText("Connect to Ollama")).toBeVisible({
      timeout: 25_000,
    });
    await wizardDialog().getByRole("button", { name: /Next/i }).click(); // Step 3 — Modes
    await expect(page.getByText("Pick Your Mode")).toBeVisible({
      timeout: 25_000,
    });
    await wizardDialog().getByRole("button", { name: /Next/i }).click(); // Step 4 — Images
    await expect(page.getByText("Upload Images")).toBeVisible({
      timeout: 25_000,
    });
    await wizardDialog().getByRole("button", { name: /Next/i }).click(); // Step 5 — Privacy
    await expect(page.getByText("Your Data Stays Here")).toBeVisible({
      timeout: 25_000,
    });
    await wizardDialog()
      .getByRole("button", { name: /Let's Go!/i })
      .click(); // Finish

    // Verify wizard closed
    await expect(
      page.getByRole("dialog", { name: "Welcome wizard" }),
    ).not.toBeVisible();

    // Reload and verify wizard does not reappear
    await page.reload();
    await expect(
      page.getByRole("dialog", { name: "Welcome wizard" }),
    ).not.toBeVisible();
  });
});
