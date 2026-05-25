/**
 * Regression test for the 2026-05-25 "Code → Plain English hangs 8–40 min" bug.
 *
 * Root cause: the agentic TOOL_CALL loop (actionable-request detection,
 * corrective retries, auto-continue) ran for EVERY mode that reached
 * handleChatPost whenever agent tools were globally enabled (agent terminal on,
 * or external MCP connected). Pasted code in transform modes (translate-tech,
 * explain, …) trips `userLikelyRequestedActionableToolWork` and the
 * narrated/claimed-completion detectors, spinning the model through retries +
 * up to 10 auto-continue re-prompts over a ~27K-token context.
 *
 * Fix: only `chat` and `experiment` may activate the agent-tool loop. Transform
 * modes use the clean streaming path (no tool injection, no retry machinery).
 * This test pins that allowlist so a future mode isn't silently opted in.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { AGENTIC_TOOL_MODES } = require("../../lib/chat-post-handler");

test("agentic modes: chat and experiment are the only tool-loop modes", () => {
  assert.ok(AGENTIC_TOOL_MODES instanceof Set);
  assert.equal(AGENTIC_TOOL_MODES.has("chat"), true);
  assert.equal(AGENTIC_TOOL_MODES.has("experiment"), true);
  assert.equal(AGENTIC_TOOL_MODES.size, 2);
});

test("agentic modes: transform/assist modes never run the agent-tool loop", () => {
  for (const mode of [
    "explain",
    "bugs",
    "refactor",
    "translate-tech",
    "translate-biz",
    "diagram",
  ]) {
    assert.equal(
      AGENTIC_TOOL_MODES.has(mode),
      false,
      `${mode} must stay on the non-agentic streaming path`,
    );
  }
});
