/**
 * UI test for the global "Working" strip (`ChatSessionProgress`).
 *
 * Wired across 7+ surfaces in v1.6.26 (chat / builders / Review / Security /
 * Experiment / Build / DeepDive — see whats-next.md). This spec asserts the
 * default-id chat-tab instance specifically:
 *  - data-testid="chat-session-progress" appears while a chat round streams
 *  - disappears once the stream ends
 *
 * The chat-mode strip is the only call site that uses the default testId; the
 * other six pass distinct ids (review-, pentest-, builder-, etc.). A regression
 * that breaks `active={streaming}` wiring in App.jsx — or that mis-mounts the
 * component above the rest of the chat shell — fails this spec immediately.
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

/** Server returns SSE: token chunks then [DONE]. Mirrors lib/ollama-client.js shape. */
function mockSseChatBody(assistantText) {
  return [
    `data: ${JSON.stringify({ token: assistantText })}\n\n`,
    `data: ${JSON.stringify({ done: true, eval_count: 10, total_duration: 1e9 })}\n\n`,
    "data: [DONE]\n\n",
  ].join("");
}

test.describe("ChatSessionProgress strip (chat mode)", () => {
  test("appears during /api/chat SSE and disappears after [DONE]", async ({
    page,
    context,
  }) => {
    await context.route("**/api/models", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockModels),
      }),
    );

    // Hold the chat response open long enough for the strip to be observable.
    // Without the delay the SSE resolves in <50ms and the visibility transition
    // is racy. 1.5s gives a generous, deterministic window for `toBeVisible()`.
    await context.route("**/api/chat", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body: mockSseChatBody("Mock reply from Playwright."),
      });
    });

    await page.addInitScript(browserAppReady);
    await page.goto("/");
    await reloadAndWaitForModels(page);

    const strip = page.getByTestId("chat-session-progress");
    // Pre-condition: not rendered before the user sends anything.
    await expect(strip).toHaveCount(0);

    await page.locator("#chat-input").fill("hello");
    await page.getByRole("button", { name: /^send$/i }).click();

    // Strip should appear while the mocked SSE is held open (≤1.5s window).
    await expect(strip).toBeVisible({ timeout: 2000 });
    // role/aria contract — guards a future refactor that drops the polite-live
    // semantics screen readers rely on.
    await expect(strip).toHaveAttribute("role", "status");
    await expect(strip).toHaveAttribute("aria-busy", "true");

    // After [DONE] the strip should unmount (component returns null when !active).
    await expect(strip).toHaveCount(0, { timeout: 5000 });
  });
});
