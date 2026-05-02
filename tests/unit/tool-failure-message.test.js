const test = require("node:test");
const assert = require("node:assert/strict");
const { formatToolFailureMessage } = require("../../lib/chat-post-handler");

test("formatToolFailureMessage prefers result.error when set", () => {
  assert.equal(
    formatToolFailureMessage({ success: false, error: "boom" }),
    "boom",
  );
});

test("formatToolFailureMessage uses result.content text when error missing", () => {
  assert.equal(
    formatToolFailureMessage({
      success: false,
      result: {
        content: [{ type: "text", text: "Command denied: pytest not allowed" }],
      },
    }),
    "Command denied: pytest not allowed",
  );
});

test("formatToolFailureMessage avoids undefined when both missing", () => {
  const s = formatToolFailureMessage({ success: false });
  assert.equal(s, "(no error details)");
  assert.ok(!s.includes("undefined"));
});
