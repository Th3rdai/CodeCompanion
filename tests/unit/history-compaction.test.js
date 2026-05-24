const test = require("node:test");
const assert = require("node:assert/strict");
const {
  findCompactionSplitIndex,
  buildCompactionCacheKey,
  capCompactionSummary,
  compactHistory,
} = require("../../lib/history-compaction");

function makeHistory(count) {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `m-${i}`,
  }));
}

test("findCompactionSplitIndex keeps default split for normal history", () => {
  const messages = makeHistory(50);
  assert.equal(findCompactionSplitIndex(messages, 10), 40);
});

test("findCompactionSplitIndex steps back over persisted tool-result boundary", () => {
  const messages = makeHistory(50);
  messages[39] = { role: "assistant", content: "Done running tools." };
  messages[40] = {
    role: "user",
    content: "[Tool: builtin.run_terminal_cmd]\noutput",
  };
  assert.equal(findCompactionSplitIndex(messages, 10), 38);
});

test("findCompactionSplitIndex steps back over live tool-result boundary", () => {
  const messages = makeHistory(50);
  messages[39] = { role: "assistant", content: "Done running tools." };
  messages[40] = { role: "user", content: "Tool results:\noutput" };
  assert.equal(findCompactionSplitIndex(messages, 10), 38);
});

test("findCompactionSplitIndex floor-clamps when boundary walk goes negative", () => {
  const messages = [
    { role: "assistant", content: "A" },
    { role: "user", content: "[Tool: builtin.run_terminal_cmd]\noutput" },
  ];
  assert.equal(findCompactionSplitIndex(messages, 1), 0);
});

test("findCompactionSplitIndex does not shift on genuine user message", () => {
  const messages = makeHistory(50);
  messages[40] = { role: "user", content: "Hi, can you help with X?" };
  assert.equal(findCompactionSplitIndex(messages, 10), 40);
});

test("buildCompactionCacheKey is stable for same prefix", () => {
  const messages = makeHistory(10);
  const keyA = buildCompactionCacheKey(messages, 6);
  const keyB = buildCompactionCacheKey(messages, 6);
  assert.equal(keyA, keyB);
});

test("buildCompactionCacheKey changes when summarized prefix changes", () => {
  const messagesA = makeHistory(10);
  const messagesB = makeHistory(10);
  messagesB[2] = { role: "user", content: "changed-content" };
  const keyA = buildCompactionCacheKey(messagesA, 6);
  const keyB = buildCompactionCacheKey(messagesB, 6);
  assert.notEqual(keyA, keyB);
});

test("capCompactionSummary enforces max length with suffix", () => {
  const text = "x".repeat(80);
  const capped = capCompactionSummary(text, 32);
  assert.equal(capped.length, 32);
  assert.match(capped, /\.\.\.\[truncated\]$/);
});

test("compactHistory returns summary path when summarizer succeeds", async () => {
  const messages = makeHistory(20);
  const system = { role: "system", content: "sys" };
  const result = await compactHistory({
    messages,
    systemMessage: system,
    keepRecent: 5,
    summarize: async () => "summary text",
  });
  assert.equal(result.kind, "summary");
  assert.equal(result.rebuiltMessages[0], system);
  assert.equal(result.rebuiltMessages[1].role, "system");
  assert.equal(result.rebuiltMessages[1]._kind, "compaction_summary");
  assert.equal(result.rebuiltMessages[1].content, "summary text");
});

test("compactHistory falls back when summarizer fails", async () => {
  const messages = makeHistory(20);
  const result = await compactHistory({
    messages,
    keepRecent: 5,
    summarize: async () => {
      throw new Error("boom");
    },
  });
  assert.equal(result.kind, "fallback");
  assert.equal(result.reason, "boom");
  assert.equal(result.rebuiltMessages.length, 5);
});
