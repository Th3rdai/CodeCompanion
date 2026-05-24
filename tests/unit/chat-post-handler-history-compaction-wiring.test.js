const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const HANDLER_PATH = path.resolve(__dirname, "../../lib/chat-post-handler.js");
const SRC = fs.readFileSync(HANDLER_PATH, "utf8");

test("handler imports compaction helpers and context resolver", () => {
  assert.match(SRC, /compactHistory/);
  assert.match(SRC, /getContextLengthForModel/);
  assert.match(SRC, /listModels/);
});

test("compaction runs before auto-adjust block", () => {
  const compactionIdx = SRC.indexOf("if (config.enableHistoryCompaction)");
  const autoAdjustIdx = SRC.indexOf("if (config.autoAdjustContext");
  assert.ok(compactionIdx > 0, "expected compaction gate");
  assert.ok(autoAdjustIdx > 0, "expected auto-adjust gate");
  assert.ok(
    compactionIdx < autoAdjustIdx,
    "compaction should run before auto-adjust uses estimatedTokens",
  );
});

test("all CTXFIX compaction notice kinds are present", () => {
  assert.match(SRC, /kind:\s*"compaction_summary"/);
  assert.match(SRC, /kind:\s*"compaction_fallback"/);
  assert.match(SRC, /kind:\s*"compaction_skipped"/);
});

test("compaction notices are queued then emitted via SSE", () => {
  const queueIdx = SRC.indexOf("const compactionNotices = []");
  const flushIdx = SRC.indexOf("for (const notice of compactionNotices)");
  const sendIdx = SRC.indexOf("sendEvent({ notice })");
  assert.ok(queueIdx > 0, "expected compaction notice queue");
  assert.ok(flushIdx > 0, "expected compaction notice flush loop");
  assert.ok(sendIdx > 0, "expected SSE notice emission");
  assert.ok(queueIdx < flushIdx, "queue should be declared before flush");
  assert.ok(flushIdx < sendIdx + 100, "flush loop should emit notice events");
});
