const test = require("node:test");
const assert = require("node:assert/strict");

const {
  userRequestedBrowserSnapshot,
  needsSnapshotRetry,
} = require("../../lib/browser-intent");

test("userRequestedBrowserSnapshot detects explicit snapshot phrasing", () => {
  const messages = [
    { role: "user", content: "Open https://example.com and take a snapshot." },
  ];
  assert.equal(userRequestedBrowserSnapshot(messages), true);
});

test("userRequestedBrowserSnapshot detects screenshot phrasing in mixed prompt", () => {
  const messages = [
    {
      role: "user",
      content:
        "Run pwd, then open https://example.com, take a screenshot, and summarize both.",
    },
  ];
  assert.equal(userRequestedBrowserSnapshot(messages), true);
});

test("userRequestedBrowserSnapshot ignores non-snapshot prompt", () => {
  const messages = [
    {
      role: "user",
      content: "Open https://example.com and summarize the page.",
    },
  ];
  assert.equal(userRequestedBrowserSnapshot(messages), false);
});

test("needsSnapshotRetry true when browser call present but no browser_snapshot", () => {
  const toolCalls = [{ serverId: "playwright", toolName: "browser_navigate" }];
  assert.equal(needsSnapshotRetry(toolCalls), true);
});

test("needsSnapshotRetry false when browser_snapshot is included", () => {
  const toolCalls = [
    { serverId: "playwright", toolName: "browser_navigate" },
    { serverId: "playwright", toolName: "browser_snapshot" },
  ];
  assert.equal(needsSnapshotRetry(toolCalls), false);
});

test("needsSnapshotRetry false for non-browser tool calls", () => {
  const toolCalls = [{ serverId: "builtin", toolName: "run_shell_command" }];
  assert.equal(needsSnapshotRetry(toolCalls), false);
});
