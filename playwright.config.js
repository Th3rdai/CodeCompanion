const { defineConfig, devices } = require("@playwright/test");

if (process.env.FORCE_COLOR && process.env.NO_COLOR) {
  delete process.env.NO_COLOR;
}

// Must match webServer below (FORCE_HTTP=1). Override with BASE_URL for HTTPS preview (e.g. self-signed :4173).
const baseURL = process.env.BASE_URL || "http://127.0.0.1:4173";
const useHTTPS = baseURL.startsWith("https://");

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  // Default OS parallelism can starve the single webServer; use 1 worker for stable first-pass UI runs.
  // Speed up locally with PW_WORKERS=2 (expect occasional flakes without retries).
  workers: process.env.PW_WORKERS ? parseInt(process.env.PW_WORKERS, 10) : 1,
  // One Node server + many UI tests; report-card / hydration can flake without a second attempt.
  retries: 2,
  timeout: 45_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    headless: true,
    ignoreHTTPSErrors: useHTTPS,
  },
  // Named project so `npm run test:ui` / `--project=chromium` work (see package.json).
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Build so E2E matches current src (server serves dist/).
    command:
      "npm run build && FORCE_HTTP=1 CC_SKIP_MCP_AUTOCONNECT=1 PORT=4173 node server.js",
    port: 4173,
    // If true, an old process on :4173 can serve stale dist/ (selectors drift) — opt in: PW_REUSE_SERVER=1
    reuseExistingServer: process.env.PW_REUSE_SERVER === "1",
    timeout: 120_000,
  },
});
