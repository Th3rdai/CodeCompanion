const { defineConfig } = require('@playwright/test');

// Server runs with HTTPS by default (self-signed cert). Use BASE_URL env var to override if needed.
const baseURL = process.env.BASE_URL || 'https://127.0.0.1:4173';
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
