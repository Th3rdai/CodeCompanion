import fs from "node:fs";
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

function mockMermaidSseBody() {
  const reply = [
    "Here is your diagram:",
    "",
    "```mermaid",
    "flowchart LR",
    "A[Client] --> B[Gateway]",
    "B --> C[Service]",
    "C --> D[(DB)]",
    "```",
  ].join("\n");
  return [
    `data: ${JSON.stringify({ token: reply })}\n\n`,
    `data: ${JSON.stringify({ done: true, eval_count: 20, total_duration: 1e9 })}\n\n`,
    "data: [DONE]\n\n",
  ].join("");
}

test("Mermaid PNG export downloads a file", async ({ page, context }) => {
  await context.route("**/api/models", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockModels),
    }),
  );

  await context.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream; charset=utf-8",
      body: mockMermaidSseBody(),
    });
  });

  await page.addInitScript(browserAppReady);
  await page.addInitScript(() => {
    // Keep the test deterministic: force download path instead of save picker UI.
    window.showSaveFilePicker = undefined;
  });
  await page.goto("/");
  await reloadAndWaitForModels(page);

  await page.locator("#chat-input").fill("generate a mermaid diagram");
  await page.getByRole("button", { name: /^send$/i }).click();

  const pngButton = page
    .locator('.mermaid-container button[title="PNG"]')
    .first();
  await expect(pngButton).toBeVisible({ timeout: 10000 });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    pngButton.click(),
  ]);

  expect(download.suggestedFilename()).toBe("diagram.png");
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const size = fs.statSync(downloadPath).size;
  expect(size).toBeGreaterThan(100);
});
