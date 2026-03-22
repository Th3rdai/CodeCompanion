const { defineConfig, devices } = require('@playwright/test');

// Must match webServer below (FORCE_HTTP=1). Override with BASE_URL for HTTPS preview (e.g. self-signed :4173).
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const useHTTPS = baseURL.startsWith('https://');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL,
    headless: true,
    ignoreHTTPSErrors: useHTTPS
  },
  // Named project so `npm run test:ui` / `--project=chromium` work (see package.json).
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Build so E2E matches current src (server serves dist/).
    command: 'npm run build && FORCE_HTTP=1 PORT=4173 node server.js',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000
  }
});
