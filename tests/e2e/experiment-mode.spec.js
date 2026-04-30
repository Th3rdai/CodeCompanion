const { test, expect } = require("@playwright/test");
const browserAppReady = require("../helpers/app-ready.js");
const { openMoreModesMenu } = require("../helpers/mode-tabs.js");

test("Experiment mode panel shows hypothesis UI when enabled (default)", async ({
  page,
}) => {
  await page.addInitScript(browserAppReady);
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
  await expect(page.getByText(/^Hypothesis$/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("button", { name: "Start experiment" }),
  ).toBeVisible();
});
