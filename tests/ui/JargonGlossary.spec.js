import { test, expect } from "@playwright/test";
import { reloadAndWaitForModels } from "../helpers/reload-app-ready.js";

test.describe("JargonGlossary component", () => {
  // beforeEach runs reloadAndWaitForModels (up to 45s) then opens glossary — default 45s test timeout is too tight under parallel load.
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("th3rdai_splash_dismissed", "true");
    });
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.setItem("th3rdai_onboarding_complete", "true"),
    );
    await reloadAndWaitForModels(page);
    // Open glossary panel (requires main shell — splash dismissed above)
    const glossaryBtn = page.getByRole("button", { name: /glossary/i });
    await glossaryBtn.waitFor({ state: "visible", timeout: 30_000 });
    await glossaryBtn.click();
  });

  test("UX-03: displays all terms with search and category filtering", async ({
    page,
  }) => {
    // Verify glossary header
    await expect(page.getByText("Jargon Glossary")).toBeVisible();

    // Verify search input exists
    const searchInput = page.getByPlaceholder(/Search terms/i);
    await expect(searchInput).toBeVisible();

    // Test search filtering
    await searchInput.fill("api");
    await expect(page.getByText("API", { exact: true })).toBeVisible();
  });

  test("UX-03: category filtering works", async ({ page }) => {
    // Scope to glossary dialog — mode tabs also include a Security button
    await page
      .getByRole("dialog", { name: "Jargon Glossary" })
      .getByRole("button", { name: "Security", exact: true })
      .click();

    // Verify Security terms visible
    await expect(page.getByText("SQL Injection")).toBeVisible();
  });
});
