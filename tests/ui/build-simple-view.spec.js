const { test } = require("@playwright/test");

test.describe("Build Dashboard — Simple View", () => {
  // P2-01: BuildHeader shows project name, status badge, progress bar
  test.skip("shows project name and status badge in header", async ({
    page: _page,
  }) => {});
  test.skip("shows progress bar with percentage", async ({
    page: _page,
  }) => {});

  // P2-02: Simple/Advanced toggle with localStorage persistence
  test.skip("toggles between simple and advanced views", async ({
    page: _page,
  }) => {});
  test.skip("persists view mode in localStorage", async ({
    page: _page,
  }) => {});

  // P2-03: What's Next AI card
  test.skip("shows What's Next AI card", async ({ page: _page }) => {});
  test.skip("shows offline message when Ollama is not connected", async ({
    page: _page,
  }) => {});
});
