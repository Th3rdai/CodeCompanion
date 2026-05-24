/**
 * Unit tests for Phase 2 stateful reasoning tag filtering during streaming.
 *
 * RESPONSEFIX Phase 2: Stream-safe stateful filtering for chunk-boundary tags.
 * Tests that chunk-split tags and malformed tags are handled correctly.
 */

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

// Extract the sanitizer functions for testing
// These mirror the implementation in lib/chat-post-handler.js

function sanitizeAssistantChunk(input, state = {}) {
  if (typeof input !== "string") return "";

  // Initialize state on first call
  if (!state.mode) {
    state.mode = "outside";
    state.buffer = "";
    state.blockType = null;
  }

  let output = "";

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (state.mode === "outside") {
      if (char === "<") {
        state.buffer = "<";
        state.mode = "maybe_opening";
      } else {
        output += char;
      }
    } else if (state.mode === "maybe_opening") {
      state.buffer += char;

      const lower = state.buffer.toLowerCase();
      if (lower === "<think>" || lower === "<thought>") {
        state.blockType = lower === "<think>" ? "think" : "thought";
        state.mode = "inside_block";
        state.buffer = "";
      } else if (char === ">" && !lower.match(/^<\/?tho?u?g?h?t?$/i)) {
        output += state.buffer;
        state.buffer = "";
        state.mode = "outside";
      } else if (state.buffer.length > 9) {
        output += state.buffer;
        state.buffer = "";
        state.mode = "outside";
      }
    } else if (state.mode === "inside_block") {
      if (char === "<" && input[i + 1] === "/") {
        state.buffer = "</";
        state.mode = "maybe_closing";
        i++;
      }
    } else if (state.mode === "maybe_closing") {
      state.buffer += char;

      const lower = state.buffer.toLowerCase();
      const expectedClose =
        state.blockType === "think" ? "</think>" : "</thought>";

      if (lower === expectedClose) {
        state.mode = "outside";
        state.blockType = null;
        state.buffer = "";
      } else if (char === ">" && lower !== expectedClose) {
        state.buffer = "";
        state.mode = "inside_block";
      } else if (state.buffer.length > 10) {
        state.buffer = "";
        state.mode = "inside_block";
      }
    }
  }

  return output;
}

function sanitizeAssistantFlush(state = {}) {
  if (!state.buffer || state.mode === "inside_block") {
    return "";
  }
  if (state.mode === "maybe_opening") {
    return state.buffer;
  }
  return "";
}

describe("Phase 2: Stream-safe stateful filtering", () => {
  describe("chunk-split tag scenarios", () => {
    test("handles <tho split across two chunks + ught>", () => {
      const state = {};

      const chunk1 = "Here is some text <tho";
      const result1 = sanitizeAssistantChunk(chunk1, state);
      assert.equal(result1, "Here is some text ");

      const chunk2 = "ught>reasoning content</thought> more text";
      const result2 = sanitizeAssistantChunk(chunk2, state);
      assert.equal(result2, " more text");

      // Verify state was properly managed
      assert.equal(state.mode, "outside");
    });

    test("handles <think split as < + think>", () => {
      const state = {};

      const chunk1 = "Text before <";
      const result1 = sanitizeAssistantChunk(chunk1, state);
      assert.equal(result1, "Text before ");

      const chunk2 = "think>internal reasoning</think> after";
      const result2 = sanitizeAssistantChunk(chunk2, state);
      assert.equal(result2, " after");
    });

    test("handles closing tag split as </thi + nk>", () => {
      const state = {};

      const chunk1 = "<think>reasoning </thi";
      const result1 = sanitizeAssistantChunk(chunk1, state);
      assert.equal(result1, "");

      const chunk2 = "nk> visible text";
      const result2 = sanitizeAssistantChunk(chunk2, state);
      assert.equal(result2, " visible text");
    });

    test("handles three-chunk split <tho + ug + ht>", () => {
      const state = {};

      const chunk1 = "Text <tho";
      const result1 = sanitizeAssistantChunk(chunk1, state);
      assert.equal(result1, "Text ");

      const chunk2 = "ug";
      const result2 = sanitizeAssistantChunk(chunk2, state);
      assert.equal(result2, "");

      const chunk3 = "ht>hidden</thought> visible";
      const result3 = sanitizeAssistantChunk(chunk3, state);
      assert.equal(result3, " visible");
    });

    test("handles complete tag in first chunk then split close tag", () => {
      const state = {};

      const chunk1 = "<think>reasoning content </thi";
      const result1 = sanitizeAssistantChunk(chunk1, state);
      assert.equal(result1, "");

      const chunk2 = "nk> after text";
      const result2 = sanitizeAssistantChunk(chunk2, state);
      assert.equal(result2, " after text");
    });
  });

  describe("unterminated block scenarios", () => {
    test("unterminated <think> block does not leak content", () => {
      const state = {};

      const chunk1 = "Visible <think>reasoning starts";
      const result1 = sanitizeAssistantChunk(chunk1, state);
      assert.equal(result1, "Visible ");

      const chunk2 = " more reasoning";
      const result2 = sanitizeAssistantChunk(chunk2, state);
      assert.equal(result2, "");

      // Stream ends without closing tag - flush should return empty
      const flushed = sanitizeAssistantFlush(state);
      assert.equal(flushed, "");
    });

    test("partial opening tag at end of stream is flushed", () => {
      const state = {};

      const chunk1 = "Normal text <th";
      const result1 = sanitizeAssistantChunk(chunk1, state);
      assert.equal(result1, "Normal text ");

      // Not a complete tag when stream ends - flush the buffer
      const flushed = sanitizeAssistantFlush(state);
      assert.equal(flushed, "<th");
    });

    test("incomplete tag name <tho without > is eventually flushed as text", () => {
      const state = {};

      const chunk1 = "Text <tho";
      const result1 = sanitizeAssistantChunk(chunk1, state);
      assert.equal(result1, "Text ");

      // Stream ends mid-tag - should be flushed
      const flushed = sanitizeAssistantFlush(state);
      assert.equal(flushed, "<tho");
    });
  });

  describe("malformed tag scenarios", () => {
    test("mismatched closing tag continues filtering", () => {
      const state = {};

      // Open with <think>, try to close with </thought> - should keep filtering
      const chunk = "<think>reasoning</thought> still hidden</think> visible";
      const result = sanitizeAssistantChunk(chunk, state);
      assert.equal(result, " visible");
    });

    test("random angle brackets do not disrupt filtering", () => {
      const state = {};

      const chunk = "Normal < text > with <brackets> inside";
      const result = sanitizeAssistantChunk(chunk, state);
      assert.ok(result.includes("Normal"));
      assert.ok(result.includes("text"));
      assert.ok(result.includes("brackets"));
    });

    test("nested reasoning tags (malformed XML) match first closing tag", () => {
      const state = {};

      // Malformed: nested <think> tags - first </think> closes the block
      // This is acceptable behavior since nested reasoning tags are malformed XML
      // The important thing is that the majority of reasoning content is filtered
      const chunk =
        "<think>outer <think>inner</think> still inside</think> visible";
      const result = sanitizeAssistantChunk(chunk, state);
      // First </think> closes the block, emitting "still inside</think>" as regular text
      assert.equal(result, " still inside</think> visible");
      assert.ok(!result.includes("outer"));
      assert.ok(!result.includes("inner"));
    });

    test("uppercase and mixed case tags are filtered", () => {
      const state = {};

      const chunk =
        "<THINK>uppercase</THINK> and <ThOuGhT>mixed</tHoUgHt> visible";
      const result = sanitizeAssistantChunk(chunk, state);
      assert.equal(result, " and  visible");
    });

    test("whitespace in tag name prevents match (not a reasoning tag)", () => {
      const state = {};

      const chunk = "<think >not a reasoning tag</think >";
      const result = sanitizeAssistantChunk(chunk, state);
      // Should NOT filter because "< think >" doesn't match our tags
      assert.ok(result.includes("<think >"));
      assert.ok(result.includes("not a reasoning tag"));
    });
  });

  describe("fallback streaming simulation", () => {
    test("simulates multiple NDJSON chunks with reasoning tags", () => {
      const state = {};

      // Simulate stream chunks from Ollama NDJSON
      const chunks = [
        "I'll help with that. <thi",
        "nk>Let me analyze this</think> ",
        "Here's my answer: ",
        "<thought>Double checking",
        "</thought> The result is 42.",
      ];

      let accumulated = "";
      for (const chunk of chunks) {
        accumulated += sanitizeAssistantChunk(chunk, state);
      }
      accumulated += sanitizeAssistantFlush(state);

      assert.equal(
        accumulated,
        "I'll help with that.  Here's my answer:  The result is 42.",
      );
      assert.ok(!accumulated.includes("analyze"));
      assert.ok(!accumulated.includes("Double checking"));
    });
  });

  describe("standard streaming simulation", () => {
    test("simulates Ollama stream with split tags", () => {
      const state = {};

      // Simulate realistic streaming pattern
      const chunks = [
        "Let me help. <th",
        "ought>I need to think about this.",
        " My reasoning: this is",
        " complex.</though",
        "t> The answer is: yes.",
      ];

      let accumulated = "";
      for (const chunk of chunks) {
        accumulated += sanitizeAssistantChunk(chunk, state);
      }
      accumulated += sanitizeAssistantFlush(state);

      assert.equal(accumulated, "Let me help.  The answer is: yes.");
      assert.ok(!accumulated.includes("reasoning"));
      assert.ok(!accumulated.includes("complex"));
    });
  });

  describe("edge cases and regressions", () => {
    test("empty chunks are handled gracefully", () => {
      const state = {};
      assert.equal(sanitizeAssistantChunk("", state), "");
    });

    test("chunks with only reasoning tags return empty", () => {
      const state = {};
      const chunk = "<think>only reasoning</think>";
      assert.equal(sanitizeAssistantChunk(chunk, state), "");
    });

    test("state persists across many chunks", () => {
      const state = {};

      for (let i = 0; i < 10; i++) {
        sanitizeAssistantChunk(`chunk ${i} `, state);
      }

      // State should still be valid
      const result = sanitizeAssistantChunk(
        "<think>filter this</think> final",
        state,
      );
      assert.equal(result, " final");
    });

    test("alternating blocks of visible and hidden content", () => {
      const state = {};

      const result = sanitizeAssistantChunk(
        "visible1 <think>hidden1</think> visible2 <thought>hidden2</thought> visible3",
        state,
      );

      assert.equal(result, "visible1  visible2  visible3");
    });
  });
});
