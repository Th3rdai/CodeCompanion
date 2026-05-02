/**
 * Reload the SPA and wait for the model toolbar to be ready.
 *
 * BFCache can skip network on `reload()`, so we use a cache-busting query param
 * on `goto()` for a fresh document. We wait only on `#model-select` — coupling to
 * `waitForResponse` for `/api/models` was flaky under load (matched wrong response
 * or raced the document swap).
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
    await page.reload({ waitUntil: "load", timeout });
    await page.waitForSelector("#model-select", { state: "visible", timeout });
    return;
  }
  target.hash = "";
  target.searchParams.set("_cc_reload", String(Date.now()));

  await page.goto(target.toString(), { waitUntil: "load", timeout });
  await page.waitForSelector("#model-select", { state: "visible", timeout });
}

module.exports = { reloadAndWaitForModels };
