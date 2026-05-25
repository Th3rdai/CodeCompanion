/**
 * Global Playwright setup - runs once before all tests.
 * Pre-warms the web server to eliminate cold-start hydration flakes.
 */

const { chromium } = require("@playwright/test");

module.exports = async (config) => {
  const baseURL = config.use?.baseURL || "http://127.0.0.1:4173";
  const useHTTPS = baseURL.startsWith("https://");

  console.log(`[Global Setup] Pre-warming server at ${baseURL}...`);

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: useHTTPS,
  });

  const page = await context.newPage();

  try {
    // Load the app and wait for full hydration
    await page.goto(baseURL, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });

    // Wait for model select (proves React has hydrated the header)
    await page.waitForSelector("#model-select", {
      state: "visible",
      timeout: 30_000,
    });

    // Wait for at least one mode tab (proves the mode system has initialized)
    await page.waitForSelector('[data-testid^="mode-tab-"]', {
      state: "visible",
      timeout: 30_000,
    });

    // Give React one more second to settle any lazy-loaded components
    await page.waitForTimeout(1000);

    console.log("[Global Setup] ✓ Server is warmed up and ready");
  } catch (error) {
    console.error("[Global Setup] ✗ Failed to warm up server:", error.message);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
};
