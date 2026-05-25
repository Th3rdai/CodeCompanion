/**
 * Reload the SPA and wait for the model toolbar to be ready.
 *
 * BFCache can skip network on `reload()`, so we use a cache-busting query param
 * on `goto()` for a fresh document. We wait for networkidle + #model-select +
 * mode tabs to ensure full React hydration before tests proceed.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ timeout?: number, okOnly?: boolean }} [options]
 */
async function reloadAndWaitForModels(page, options = {}) {
  const timeout = options.timeout ?? 45_000;

  let target;
  try {
    target = new URL(page.url());
  } catch {
    await page.reload({ waitUntil: "networkidle", timeout });
    await page.waitForSelector("#model-select", { state: "visible", timeout });
    await page.waitForSelector('[data-testid^="mode-tab-"]', {
      state: "visible",
      timeout: 10_000,
    });
    return;
  }
  target.hash = "";
  target.searchParams.set("_cc_reload", String(Date.now()));

  await page.goto(target.toString(), { waitUntil: "networkidle", timeout });
  await page.waitForSelector("#model-select", { state: "visible", timeout });
  // Wait for mode tabs to prove React mode system has initialized
  await page.waitForSelector('[data-testid^="mode-tab-"]', {
    state: "visible",
    timeout: 10_000,
  });
}

module.exports = { reloadAndWaitForModels };
