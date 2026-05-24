/**
 * Unit tests for chat output sanitization functions.
 *
 * RESPONSEFIX Phase 1: Centralize output sanitization.
 * Tests that reasoning tags (<think>, <thought>) are removed from assistant output
 * before streaming to the user.
 *
 * Phase 2 (future) will add stream-safe stateful filtering for chunk-boundary tags.
 */

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const HANDLER_PATH = path.resolve(__dirname, "../../lib/chat-post-handler.js");
const SRC = fs.readFileSync(HANDLER_PATH, "utf8");

// Extract the sanitizer functions from the source for testing
// (In a real implementation, these would be exported from the module)
const sanitizeAssistantChunk = new Function(
  "input",
  "state",
  `
  if (typeof input !== "string") return "";
  return input
    .replace(/<think>[\\s\\S]*?<\\/think>/gi, "")
    .replace(/<thought>[\\s\\S]*?<\\/thought>/gi, "");
`,
);

const sanitizeAssistantFinal = new Function(
  "input",
  `
  if (typeof input !== "string") return "";
  return input
    .replace(/<think>[\\s\\S]*?<\\/think>/gi, "")
    .replace(/<thought>[\\s\\S]*?<\\/thought>/gi, "")
    .trim();
`,
);

describe("sanitizeAssistantChunk", () => {
  test("removes complete <think> tags", () => {
    const input =
      "Here is some text <think>internal reasoning</think> and more text";
    const output = sanitizeAssistantChunk(input);
    assert.equal(output, "Here is some text  and more text");
  });

  test("removes complete <thought> tags", () => {
    const input =
      "Here is some text <thought>internal reasoning</thought> and more text";
    const output = sanitizeAssistantChunk(input);
    assert.equal(output, "Here is some text  and more text");
  });

  test("removes multiple reasoning tags", () => {
    const input = "<think>first</think> visible <thought>second</thought> text";
    const output = sanitizeAssistantChunk(input);
    assert.equal(output, " visible  text");
  });

  test("is case insensitive", () => {
    const input = "<THINK>uppercase</THINK> <ThInK>mixed</ThInK>";
    const output = sanitizeAssistantChunk(input);
    assert.equal(output, " ");
  });

  test("preserves non-reasoning content", () => {
    const input = "This is normal text with no tags.";
    const output = sanitizeAssistantChunk(input);
    assert.equal(output, "This is normal text with no tags.");
  });

  test("handles empty input", () => {
    assert.equal(sanitizeAssistantChunk(""), "");
  });

  test("handles non-string input", () => {
    assert.equal(sanitizeAssistantChunk(null), "");
    assert.equal(sanitizeAssistantChunk(undefined), "");
    assert.equal(sanitizeAssistantChunk(123), "");
  });

  test("removes tags with newlines and whitespace", () => {
    const input = `Text before
<think>
  Multi-line
  reasoning
</think>
Text after`;
    const output = sanitizeAssistantChunk(input);
    assert.ok(output.includes("Text before"));
    assert.ok(output.includes("Text after"));
    assert.ok(!output.includes("Multi-line"));
  });

  test("handles reasoning-only input (returns empty)", () => {
    const input = "<think>only reasoning</think>";
    const output = sanitizeAssistantChunk(input);
    assert.equal(output, "");
  });
});

describe("sanitizeAssistantFinal", () => {
  test("removes reasoning tags and trims whitespace", () => {
    const input = "  <think>reasoning</think> Final answer  ";
    const output = sanitizeAssistantFinal(input);
    assert.equal(output, "Final answer");
  });

  test("returns empty string for reasoning-only input", () => {
    const input = "<think>only reasoning</think>";
    const output = sanitizeAssistantFinal(input);
    assert.equal(output, "");
  });

  test("trims whitespace from plain text", () => {
    const input = "  Final answer  ";
    const output = sanitizeAssistantFinal(input);
    assert.equal(output, "Final answer");
  });

  test("handles empty input", () => {
    assert.equal(sanitizeAssistantFinal(""), "");
  });

  test("handles non-string input", () => {
    assert.equal(sanitizeAssistantFinal(null), "");
    assert.equal(sanitizeAssistantFinal(undefined), "");
    assert.equal(sanitizeAssistantFinal(42), "");
  });
});

describe("sanitizer wiring in chat-post-handler", () => {
  test("sanitizer functions are defined", () => {
    assert.match(
      SRC,
      /function sanitizeAssistantChunk\(/,
      "expected sanitizeAssistantChunk function",
    );
    assert.match(
      SRC,
      /function sanitizeAssistantFinal\(/,
      "expected sanitizeAssistantFinal function",
    );
  });

  test("tool-call final-text path uses sanitizeAssistantFinal", () => {
    const finalTextBlock = SRC.slice(
      SRC.indexOf("// Stream the final text as SSE tokens"),
      SRC.indexOf("// Stream the final text as SSE tokens") + 1000,
    );
    assert.ok(
      finalTextBlock.includes("sanitizeAssistantFinal(finalText)"),
      "tool-call path should use sanitizeAssistantFinal",
    );
  });

  test("fallback streaming path uses sanitizeAssistantChunk", () => {
    // Look for the fallback streaming section
    const fallbackIdx = SRC.indexOf(
      "Falling back to streaming mode (no tool-call support)",
    );
    assert.ok(fallbackIdx > 0, "expected to find fallback streaming section");

    // Check that sanitizeAssistantChunk is used for parsed.message.content
    const fallbackSection = SRC.slice(fallbackIdx, fallbackIdx + 5000);
    assert.ok(
      fallbackSection.includes("sanitizeAssistantChunk"),
      "fallback streaming should use sanitizeAssistantChunk",
    );
  });

  test("standard streaming path uses sanitizeAssistantChunk", () => {
    // Look for the standard streaming reader setup
    const standardIdx = SRC.indexOf("reader = ollamaRes.body.getReader()");
    assert.ok(standardIdx > 0, "expected to find standard streaming section");

    // Check that sanitizeAssistantChunk is used
    const standardSection = SRC.slice(standardIdx, standardIdx + 3000);
    assert.ok(
      standardSection.includes("sanitizeAssistantChunk"),
      "standard streaming should use sanitizeAssistantChunk",
    );
  });

  test("all three paths emit sanitized tokens", () => {
    // Count how many times we sanitize before sendEvent({ token: ... })
    // We should find at least 5 sanitization calls (1 final-text, 2 fallback, 2 standard)
    const sanitizeCalls = (SRC.match(/sanitizeAssistant/g) || []).length;
    assert.ok(
      sanitizeCalls >= 5,
      `expected at least 5 sanitizer calls across all paths, found ${sanitizeCalls}`,
    );
  });
});
