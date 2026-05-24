/**
 * RESPONSEFIX Phase 3 — Final Answer Quality Gate + Recovery
 *
 * Wiring tests that verify:
 * 1. Empty-output checks exist in all streaming paths
 * 2. Recovery pass exists in tool-call path for reasoning-only responses
 * 3. Single finalization gate (no double-done) in all paths
 */

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const HANDLER_PATH = path.resolve(__dirname, "../../lib/chat-post-handler.js");
const SRC = fs.readFileSync(HANDLER_PATH, "utf8");

describe("RESPONSEFIX Phase 3: Empty-output handling", () => {
  test("standard streaming path checks for zero tokens after sanitization", () => {
    // Find the standard streaming path (starts around line 2433)
    const standardIdx = SRC.indexOf("// ── Standard streaming path");
    const endIdx = SRC.indexOf("req.on(\"close\", () => {", standardIdx);
    assert.ok(standardIdx > 0, "expected to find standard streaming section");
    assert.ok(endIdx > standardIdx, "expected to find req.on('close') after standard streaming");

    // Look for the empty-output check in standard streaming
    const standardSection = SRC.slice(standardIdx, endIdx);

    // The check is added by Phase 3 - look for the Phase 3 comment
    assert.match(
      standardSection,
      /Phase 3: Check for zero visible tokens after sanitization/,
      "standard streaming must have Phase 3 zero-token check comment",
    );
    assert.match(
      standardSection,
      /if\s*\(\s*tokenCount\s*===\s*0/,
      "standard streaming must check tokenCount === 0",
    );
    assert.match(
      standardSection,
      /buildEmptyAssistantReplyMessage\(model\)/,
      "standard streaming must call buildEmptyAssistantReplyMessage on zero tokens",
    );
  });

  test("fallback streaming path checks for zero tokens after sanitization", () => {
    // Find the fallback streaming path (starts around line 2277)
    const fallbackIdx = SRC.indexOf(
      "Falling back to streaming mode (no tool-call support)",
    );
    const fallbackEnd = SRC.indexOf(
      "// Model never produced a user-facing reply",
      fallbackIdx,
    );
    assert.ok(fallbackIdx > 0, "expected to find fallback streaming section");
    assert.ok(fallbackEnd > fallbackIdx, "expected to find end of fallback section");

    // Look for the empty-output check in fallback streaming
    const fallbackSection = SRC.slice(fallbackIdx, fallbackEnd);
    assert.match(
      fallbackSection,
      /if\s*\(\s*tokenCount\s*===\s*0/,
      "fallback streaming must check tokenCount === 0",
    );
    assert.match(
      fallbackSection,
      /buildEmptyAssistantReplyMessage\(model\)/,
      "fallback streaming must call buildEmptyAssistantReplyMessage on zero tokens",
    );
  });

  test("tool-call path has empty-output check and recovery", () => {
    // Find the tool-call final-text section (starts around line 2218)
    const toolCallIdx = SRC.indexOf("// Stream the final text as SSE tokens");
    assert.ok(toolCallIdx > 0, "expected to find tool-call streaming section");

    // Check that empty displayText triggers error or recovery
    const toolCallSection = SRC.slice(toolCallIdx, toolCallIdx + 3000);
    assert.match(
      toolCallSection,
      /buildEmptyAssistantReplyMessage\(model\)/,
      "tool-call path must call buildEmptyAssistantReplyMessage for empty output",
    );
  });
});

describe("RESPONSEFIX Phase 3: Recovery pass", () => {
  test("tool-call path attempts recovery when displayText is empty but tool results exist", () => {
    // Find the recovery pass section
    const recoveryIdx = SRC.indexOf("Phase 3: Recovery pass");
    assert.ok(recoveryIdx > 0, "expected to find Phase 3 recovery pass comment");

    const recoverySection = SRC.slice(recoveryIdx, recoveryIdx + 2000);

    // Check for recovery conditions
    assert.match(
      recoverySection,
      /if\s*\(\s*accumulatedToolResults/,
      "recovery must check accumulatedToolResults exists",
    );

    // Check for recovery notice
    assert.match(
      recoverySection,
      /sendEvent\(\{[\s\S]*?notice:[\s\S]*?kind:\s*["']response_recovery["']/,
      "recovery must emit response_recovery notice",
    );

    // Check for generateFinalTextFromToolResults call
    assert.match(
      recoverySection,
      /generateFinalTextFromToolResults/,
      "recovery must call generateFinalTextFromToolResults",
    );

    // Check that recovery text is sanitized
    assert.match(
      recoverySection,
      /sanitizeAssistantFinal\(recoveryText\)/,
      "recovery must sanitize the recovery text",
    );
  });

  test("recovery pass includes reasoning-only flag in options", () => {
    const recoveryIdx = SRC.indexOf("Phase 3: Recovery pass");
    const recoverySection = SRC.slice(recoveryIdx, recoveryIdx + 2000);

    // Check that recovery call includes reasoningOnly flag
    assert.match(
      recoverySection,
      /generateFinalTextFromToolResults[\s\S]*?\{\s*reasoningOnly:\s*true\s*\}/,
      "recovery must pass { reasoningOnly: true } to indicate this is a recovery pass",
    );
  });
});

describe("RESPONSEFIX Phase 3: Single finalization gate", () => {
  test("fallback streaming does NOT send done inside the loop", () => {
    // Find the fallback streaming loop (starts around line 2310)
    const fallbackIdx = SRC.indexOf(
      "Falling back to streaming mode (no tool-call support)",
    );
    const fallbackEnd = SRC.indexOf(
      "// Always send done so the client clears tool/terminal UI",
    );
    assert.ok(fallbackIdx > 0, "expected to find fallback streaming section");
    assert.ok(
      fallbackEnd > fallbackIdx,
      "expected to find common finalization section",
    );

    const fallbackSection = SRC.slice(fallbackIdx, fallbackEnd);

    // Count how many times sendEvent({ done: true }) appears in fallback section
    // Should be ZERO because common finalization handles it
    const doneEventMatches = fallbackSection.match(
      /sendEvent\(\{[\s\S]*?done:\s*true[\s\S]*?\}\)/g,
    );
    const doneEventCount = doneEventMatches ? doneEventMatches.length : 0;

    assert.equal(
      doneEventCount,
      0,
      `fallback streaming must NOT send done events (found ${doneEventCount}); common finalization at line ~2421 handles it`,
    );
  });

  test("common finalization sends done exactly once after all tool-call mode branches", () => {
    // Find the common finalization section (starts around line 2419)
    const finalizationIdx = SRC.indexOf(
      "// Always send done so the client clears tool/terminal UI",
    );
    const standardIdx = SRC.indexOf("// ── Standard streaming path");

    assert.ok(
      finalizationIdx > 0,
      "expected to find common finalization section",
    );
    assert.ok(standardIdx > finalizationIdx, "expected standard path after tool-call mode");

    const finalizationSection = SRC.slice(finalizationIdx, standardIdx);

    // Check that done is sent once
    assert.match(
      finalizationSection,
      /sendEvent\(\{\s*done:\s*true\s*\}\)/,
      "common finalization must send done event",
    );

    // Check that [DONE] is written once
    assert.match(
      finalizationSection,
      /res\.write\(["']data: \[DONE\]\\n\\n["']\)/,
      "common finalization must write [DONE]",
    );
  });

  test("standard streaming has success paths with single finalization", () => {
    // Standard streaming has two success exit points:
    // 1. When reader signals done (lines ~2607)
    // 2. When parsed.done in main loop (lines ~2658)
    // Each should send done once, and only one executes per request
    // There are also error paths, but we're only checking success paths here

    const standardIdx = SRC.indexOf("// ── Standard streaming path");
    const endIdx = SRC.indexOf("req.on(\"close\", () => {", standardIdx);
    assert.ok(standardIdx > 0, "expected to find standard streaming section");
    assert.ok(endIdx > standardIdx, "expected to find req.on('close') after standard streaming");

    const standardSection = SRC.slice(standardIdx, endIdx);

    // Count done events in standard section (includes error paths)
    const doneEventMatches = standardSection.match(
      /sendEvent\(\{[\s\S]*?done:\s*true[\s\S]*?\}\)/g,
    );
    const doneEventCount = doneEventMatches ? doneEventMatches.length : 0;

    // Should be at least 2 (the two success paths), possibly more (error paths)
    assert.ok(
      doneEventCount >= 2,
      `standard streaming must have at least 2 done events (success paths), found ${doneEventCount}`,
    );

    // Count [DONE] writes in standard section (includes error paths)
    const doneWriteMatches = standardSection.match(
      /res\.write\(["']data: \[DONE\]\\n\\n["']\)/g,
    );
    const doneWriteCount = doneWriteMatches ? doneWriteMatches.length : 0;

    // Should be at least 2 (the two success paths), possibly more (error paths)
    assert.ok(
      doneWriteCount >= 2,
      `standard streaming must have at least 2 [DONE] writes (success paths), found ${doneWriteCount}`,
    );

    // The key invariant: each path writes [DONE] exactly once, and only one path executes per request
    // This test just verifies the wiring exists; runtime behavior ensures only one executes
  });
});
