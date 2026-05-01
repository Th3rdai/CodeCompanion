const { test, expect } = require("@playwright/test");
const browserAppReady = require("../helpers/app-ready.js");
const { openMoreModesMenu } = require("../helpers/mode-tabs.js");

test("Experiment mode panel shows hypothesis UI when enabled (default)", async ({
  page,
}) => {
  await page.addInitScript(browserAppReady);
  // Hermetic: local .cc-config.json may disable experiment mode; UI label is
  // "Hypothesis" plus a hint span, so exact ^Hypothesis$ never matches.
  await page.route("**/api/experiment/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        enabled: true,
        maxRounds: 8,
        maxDurationSec: 900,
      }),
    });
  });
  await page.goto("/");
  await page.waitForResponse((r) => r.url().includes("/api/models"), {
    timeout: 30_000,
  });
  await page.waitForSelector("#model-select", {
    state: "visible",
    timeout: 30_000,
  });
  await openMoreModesMenu(page);
  await page.getByTestId("mode-tab-experiment").click();
  await expect(page.locator("#exp-hypothesis")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("button", { name: "Start experiment" }),
  ).toBeVisible();
});
