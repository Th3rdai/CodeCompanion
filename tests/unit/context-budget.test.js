/**
 * Tests for src/lib/context-budget.js — the chars-to-tokens estimate
 * shared by the client preflight banner (Phase 1b) and the server-side
 * num_ctx auto-adjust + history compaction (Phases 1a / 2).
 *
 * The behavior must remain numerically identical to the inline formula
 * it replaced (Math.ceil(totalChars / 3.5)) so existing chat flows
 * stay byte-for-byte equivalent.
 */

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  estimateTokens,
  estimateMessageTokens,
  CONTEXT_BUDGET_CHARS_PER_TOKEN,
} = require("../../src/lib/context-budget.js");

test("CONTEXT_BUDGET_CHARS_PER_TOKEN is the documented 3.5", () => {
  assert.equal(CONTEXT_BUDGET_CHARS_PER_TOKEN, 3.5);
});

test("estimateTokens returns 0 for empty / non-string input", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens(null), 0);
  assert.equal(estimateTokens(undefined), 0);
  assert.equal(estimateTokens(0), 0);
  assert.equal(estimateTokens({}), 0);
});

test("estimateTokens parity with inline Math.ceil(totalChars / 3.5)", () => {
  for (const fixture of [
    "",
    "hi",
    "hello world",
    "a".repeat(100),
    "a".repeat(7000),
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit." +
      " Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  ]) {
    const oldVal = Math.ceil(fixture.length / 3.5);
    assert.equal(
      estimateTokens(fixture),
      oldVal,
      `fixture (len=${fixture.length})`,
    );
  }
});

test("estimateMessageTokens parity with old chat-post-handler reduce + ceil", () => {
  const messages = [
    { role: "system", content: "You are a careful assistant." },
    { role: "user", content: "Explain the quicksort partition step." },
    { role: "assistant", content: "Sure — pick a pivot…" },
    { role: "user", content: "Walk me through the recursion." },
  ];
  const totalChars = messages.reduce(
    (sum, m) => sum + (m.content?.length || 0),
    0,
  );
  const oldFormula = Math.ceil(totalChars / 3.5);
  assert.equal(estimateMessageTokens(messages), oldFormula);
});

test("estimateMessageTokens parity with old review.js formula (incl. +2048 at call site)", () => {
  // Call-site addend stays at the call site (not in the helper) — the
  // helper itself must match the bare floor.
  const messages = [
    { role: "system", content: "Review this code carefully." },
    { role: "user", content: "function foo(){ return 42; }" },
  ];
  const totalChars = messages.reduce(
    (sum, m) => sum + (m.content?.length || 0),
    0,
  );
  const oldHelperPart = Math.ceil(totalChars / 3.5);
  assert.equal(estimateMessageTokens(messages), oldHelperPart);
  // call site adds + 2048
  assert.equal(
    estimateMessageTokens(messages) + 2048,
    Math.ceil(totalChars / 3.5) + 2048,
  );
});

test("estimateMessageTokens tolerates non-string content fields", () => {
  // Real chat flows attach images via a separate field, but defensive
  // code shouldn't blow up on unusual shapes.
  const messages = [
    { role: "user", content: "first" },
    { role: "user" }, // missing content
    { role: "user", content: null },
    { role: "user", content: 12345 },
    { role: "user", content: "second" },
    null,
    undefined,
    "not an object",
  ];
  // Only "first" (5) + "second" (6) = 11 chars
  assert.equal(estimateMessageTokens(messages), Math.ceil(11 / 3.5));
});

test("estimateMessageTokens returns 0 for empty / non-array input", () => {
  assert.equal(estimateMessageTokens([]), 0);
  assert.equal(estimateMessageTokens(null), 0);
  assert.equal(estimateMessageTokens(undefined), 0);
  assert.equal(estimateMessageTokens("not an array"), 0);
});

test("estimateMessageTokens — large mixed conversation parity", () => {
  // 5-fixture parity check the spec calls out specifically: chat-post
  // handler used `messages.reduce + Math.ceil(/3.5)` previously.
  const fixtures = [
    [], // empty
    [{ role: "u", content: "x" }], // single char
    [{ role: "u", content: "a".repeat(3500) }], // exact 1000 tokens
    [
      { role: "s", content: "S".repeat(500) },
      { role: "u", content: "U".repeat(2000) },
      { role: "a", content: "A".repeat(1000) },
    ],
    [
      { role: "u", content: "" },
      { role: "u", content: "non-empty" },
      { role: "u", content: "x".repeat(100000) },
    ],
  ];
  for (const messages of fixtures) {
    const totalChars = messages.reduce(
      (sum, m) => sum + (m.content?.length || 0),
      0,
    );
    assert.equal(
      estimateMessageTokens(messages),
      Math.ceil(totalChars / 3.5),
      `parity for fixture with totalChars=${totalChars}`,
    );
  }
});
