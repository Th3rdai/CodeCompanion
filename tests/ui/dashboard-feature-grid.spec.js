/**
 * Dashboard Feature Access Grid — info button opens detail modal with full description.
 */

const { test, expect } = require("@playwright/test");
const browserAppReady = require("../helpers/app-ready.js");
const { reloadAndWaitForModels } = require("../helpers/reload-app-ready.js");

const LONG_DESC = "Bounded hypothesis → change → measure loops";
const EXPERIMENT_LABEL = "Experiment";

async function openDashboard(page) {
  await page.addInitScript(browserAppReady);
  await page.addInitScript(() => {
    localStorage.setItem("cc-show-dashboard", "true");
  });
  await page.goto("/");
  await reloadAndWaitForModels(page);

  await expect(
    page.getByRole("heading", { name: "Feature Access Grid" }),
  ).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("Dashboard feature grid", () => {
  test.describe.configure({ timeout: 60_000 });

  test("info button opens modal with full description without switching mode", async ({
    page,
  }) => {
    await openDashboard(page);

    await page.getByTestId("feature-mode-info-experiment").click();

    const modal = page.getByTestId("feature-mode-detail-modal");
    await expect(modal).toBeVisible();
    await expect(page.getByTestId("feature-mode-detail-desc")).toHaveText(
      LONG_DESC,
    );
    await expect(
      modal.getByRole("heading", { name: EXPERIMENT_LABEL }),
    ).toBeVisible();

    await modal.getByRole("button", { name: "Cancel" }).click();
    await expect(modal).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Feature Access Grid" }),
    ).toBeVisible();
  });

  test("modal Open action switches to the selected mode", async ({ page }) => {
    await openDashboard(page);

    await page.getByTestId("feature-mode-info-experiment").click();
    await expect(page.getByTestId("feature-mode-detail-modal")).toBeVisible();

    await page
      .getByTestId("feature-mode-detail-modal")
      .getByRole("button", { name: `Open ${EXPERIMENT_LABEL}` })
      .click();

    await expect(
      page.getByTestId("feature-mode-detail-modal"),
    ).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Feature Access Grid" }),
    ).not.toBeVisible();
    await expect(page.getByTestId("mode-tab-experiment")).toHaveClass(
      /bg-indigo-600/,
    );
  });
});
