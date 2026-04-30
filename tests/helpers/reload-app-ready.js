/**
 * Reload the SPA and wait for the model toolbar to be ready.
 *
 * Subscribing to /api/models *before* `page.reload()` can miss the response when
 * the browser restores from BFCache (no network). We force a fresh document load
 * with a cache-busting query param and use Promise.all so the waiter cannot miss
 * the in-flight models request.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ timeout?: number, okOnly?: boolean }} [options]
 */
async function reloadAndWaitForModels(page, options = {}) {
  const timeout = options.timeout ?? 45_000;
  const okOnly = options.okOnly ?? false;

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

  await Promise.all([
    page.waitForResponse(
      (r) =>
        typeof r.url() === "string" &&
        r.url().includes("/api/models") &&
        r.request().method() === "GET" &&
        (!okOnly || r.ok()),
      { timeout },
    ),
    page.goto(target.toString(), { waitUntil: "load", timeout }),
  ]);

  await page.waitForSelector("#model-select", { state: "visible", timeout });
}

module.exports = { reloadAndWaitForModels };
