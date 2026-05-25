/**
 * Unit tests for dashboard analytics (src/lib/analytics.js).
 *
 * Regression context (2026-05-25): the dashboard was computing analytics from a
 * shape it never receives. The /api/history LIST endpoint returns
 * { id, title, mode, model, createdAt, archived, messageCount } with NO
 * `messages` array — so the original code (which summed `conv.messages.length`
 * and read `msg.model`) always reported 0 messages and an empty model
 * breakdown. These tests pin the list-shape handling plus the full-conversation
 * fallback.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateAnalytics } from "../../src/lib/analytics.js";

test("analytics: empty / non-array history returns a zeroed structure", () => {
  for (const input of [[], null, undefined, "nope"]) {
    const a = calculateAnalytics(input);
    assert.deepEqual(a.totals, {
      conversations: 0,
      active: 0,
      archived: 0,
      messages: 0,
    });
    assert.deepEqual(a.modeCounts, {});
    assert.deepEqual(a.modelCounts, {});
  }
});

test("analytics: list shape — messageCount summed, model family from conv.model", () => {
  const history = [
    {
      mode: "chat",
      model: "qwen3-32k:latest",
      messageCount: 24,
      archived: false,
    },
    {
      mode: "chat",
      model: "kimi-k2:1t-cloud",
      messageCount: 2,
      archived: true,
    },
    {
      mode: "review",
      model: "qwen3-32k:latest",
      messageCount: 10,
      archived: false,
    },
  ];
  const a = calculateAnalytics(history);
  assert.equal(a.totals.conversations, 3);
  assert.equal(a.totals.active, 2);
  assert.equal(a.totals.archived, 1);
  assert.equal(a.totals.messages, 36); // 24 + 2 + 10 — was 0 before the fix
  assert.deepEqual(a.modeCounts, { chat: 2, review: 1 });
  // Model family = base name before ":"
  assert.deepEqual(a.modelCounts, { "qwen3-32k": 2, "kimi-k2": 1 });
});

test("analytics: full-conversation shape — messages array takes precedence", () => {
  const history = [
    {
      mode: "chat",
      model: "qwen3-32k:latest", // should be ignored when messages[] present
      messages: [
        { role: "user" },
        { role: "assistant", model: "llama3.3:70b" },
        { role: "assistant", model: "llama3.3:70b" },
      ],
    },
  ];
  const a = calculateAnalytics(history);
  assert.equal(a.totals.messages, 3);
  assert.deepEqual(a.modelCounts, { "llama3.3": 2 });
});

test("analytics: tolerates rows missing model / messages without throwing", () => {
  const a = calculateAnalytics([
    { mode: "chat" },
    { mode: "diagram", model: "", messageCount: 0 },
  ]);
  assert.equal(a.totals.conversations, 2);
  assert.equal(a.totals.messages, 0);
  assert.deepEqual(a.modelCounts, {});
  assert.deepEqual(a.modeCounts, { chat: 1, diagram: 1 });
});
