const { defineConfig } = require('@playwright/test');

// When server runs with HTTPS (cert present), set BASE_URL=https://127.0.0.1:4173 so tests hit the right protocol
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const useHTTPS = baseURL.startsWith('https://');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL,
    headless: true,
    ignoreHTTPSErrors: useHTTPS
  },
  webServer: {
    command: 'PORT=4173 node server.js',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000
  }
});
