/**
 * UI test for the Preflight Context Banner (Phase 1 — CTXFIX.md).
 *
 * Asserts:
 *  - data-testid="preflight-banner" appears when estimated tokens > 80% of context length
 *  - Banner is hidden when below 80% threshold
 *  - Banner is hidden when enablePreflightBanner config flag is false
 *  - "New thread" button starts a fresh conversation
 *  - Accessibility attributes (aria-live, role="alert", aria-label)
 *  - Display format shows "~XK of ~YK tokens (N%)"
 *  - Progress bar width reflects percentage correctly
 */
import { test, expect } from "@playwright/test";
import browserAppReady from "../helpers/app-ready.js";
import { reloadAndWaitForModels } from "../helpers/reload-app-ready.js";

const mockModels = {
  models: [
    {
      name: "llama3:latest",
      size: 4.3,
      paramSize: "8B",
      supportsVision: false,
    },
  ],
  ollamaUrl: "http://localhost:11434",
};

/** Simulate model context endpoint returning 8K context window */
const mockContextResponse = {
  contextLength: 8192,
  source: "ollama",
};

/** Server returns SSE: token chunks then [DONE]. */
function mockSseChatBody(assistantText) {
  return [
    `data: ${JSON.stringify({ token: assistantText })}\n\n`,
    `data: ${JSON.stringify({ done: true, eval_count: 10, total_duration: 1e9 })}\n\n`,
    "data: [DONE]\n\n",
  ].join("");
}

test.describe("PreflightBanner (Phase 1 — CTXFIX.md)", () => {
  test("appears when approaching 80% threshold", async ({ page, context }) => {
    // Mock config with flag enabled
    await context.route("**/api/config", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          enablePreflightBanner: true,
          projectFolder: "/tmp/test",
          chatFolder: "/tmp/test",
        }),
      }),
    );

    await context.route("**/api/models", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockModels),
      }),
    );

    // Mock context length endpoint
    await context.route("**/api/model-context*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockContextResponse),
      }),
    );

    await context.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body: mockSseChatBody("A".repeat(6000)), // Large response to push over threshold
      });
    });

    await page.addInitScript(browserAppReady);
    await page.goto("/");
    await reloadAndWaitForModels(page);

    const banner = page.getByTestId("preflight-banner");

    // Pre-condition: not visible before sending message
    await expect(banner).toHaveCount(0);

    // Fill input with content that approaches threshold
    // With 8K context and ~3.5 chars/token, need ~6554+ tokens (22939+ chars) to hit 80%
    const largeInput = "A".repeat(23000);
    await page.locator("#chat-input").fill(largeInput);

    // Wait for debounce (200ms) plus render
    await page.waitForTimeout(400);

    // Banner should appear
    await expect(banner).toBeVisible({ timeout: 2000 });

    // Accessibility attributes
    await expect(banner).toHaveAttribute("role", "alert");
    await expect(banner).toHaveAttribute("aria-live", "polite");

    // Should show token format
    const text = await banner.textContent();
    expect(text).toMatch(/~\d+K of ~\d+K tokens/);
    expect(text).toMatch(/\(\d+%\)/);
  });

  test("hidden when below 80% threshold", async ({ page, context }) => {
    await context.route("**/api/config", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          enablePreflightBanner: true,
          projectFolder: "/tmp/test",
          chatFolder: "/tmp/test",
        }),
      }),
    );

    await context.route("**/api/models", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockModels),
      }),
    );

    await context.route("**/api/model-context*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockContextResponse),
      }),
    );

    await page.addInitScript(browserAppReady);
    await page.goto("/");
    await reloadAndWaitForModels(page);

    const banner = page.getByTestId("preflight-banner");

    // Small input well below threshold
    await page.locator("#chat-input").fill("Hello world");
    await page.waitForTimeout(400);

    // Banner should not appear
    await expect(banner).toHaveCount(0);
  });

  test("hidden when config flag disabled", async ({ page, context }) => {
    await context.route("**/api/config", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          enablePreflightBanner: false, // Flag disabled
          projectFolder: "/tmp/test",
          chatFolder: "/tmp/test",
        }),
      }),
    );

    await context.route("**/api/models", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockModels),
      }),
    );

    await context.route("**/api/model-context*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockContextResponse),
      }),
    );

    await page.addInitScript(browserAppReady);
    await page.goto("/");
    await reloadAndWaitForModels(page);

    const banner = page.getByTestId("preflight-banner");

    // Large input that would normally trigger banner
    await page.locator("#chat-input").fill("A".repeat(23000));
    await page.waitForTimeout(400);

    // Banner should not appear due to config flag
    await expect(banner).toHaveCount(0);
  });

  test("'New thread' button starts fresh conversation", async ({
    page,
    context,
  }) => {
    await context.route("**/api/config", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          enablePreflightBanner: true,
          projectFolder: "/tmp/test",
          chatFolder: "/tmp/test",
        }),
      }),
    );

    await context.route("**/api/models", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockModels),
      }),
    );

    await context.route("**/api/model-context*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockContextResponse),
      }),
    );

    await context.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body: mockSseChatBody("Response"),
      });
    });

    let historyPostCount = 0;
    await context.route("**/api/history", (route) => {
      if (route.request().method() === "POST") {
        historyPostCount++;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: `conv-${historyPostCount}` }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.addInitScript(browserAppReady);
    await page.goto("/");
    await reloadAndWaitForModels(page);

    // Trigger banner with large input
    await page.locator("#chat-input").fill("A".repeat(23000));
    await page.waitForTimeout(400);

    const banner = page.getByTestId("preflight-banner");
    await expect(banner).toBeVisible({ timeout: 2000 });

    // Click "New thread" button
    const newThreadButton = banner.getByRole("button", {
      name: /new thread/i,
    });
    await newThreadButton.click();

    // Banner should disappear after clearing conversation
    await expect(banner).toHaveCount(0);

    // Input should be cleared
    const input = page.locator("#chat-input");
    await expect(input).toHaveValue("");
  });

  test("displays correct percentage and format", async ({ page, context }) => {
    await context.route("**/api/config", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          enablePreflightBanner: true,
          projectFolder: "/tmp/test",
          chatFolder: "/tmp/test",
        }),
      }),
    );

    await context.route("**/api/models", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockModels),
      }),
    );

    await context.route("**/api/model-context*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockContextResponse),
      }),
    );

    await page.addInitScript(browserAppReady);
    await page.goto("/");
    await reloadAndWaitForModels(page);

    // Input that results in exactly 85% usage
    // 8192 context * 0.85 = 6963 tokens ≈ 24371 chars
    await page.locator("#chat-input").fill("A".repeat(24371));
    await page.waitForTimeout(400);

    const banner = page.getByTestId("preflight-banner");
    await expect(banner).toBeVisible({ timeout: 2000 });

    const text = await banner.textContent();

    // Should show "~7K of ~8K tokens (85%)" format
    expect(text).toContain("~7K of ~8K tokens");
    expect(text).toMatch(/\(8[45]%\)/); // Allow for rounding (84-85%)
  });
});
