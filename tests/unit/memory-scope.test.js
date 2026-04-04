const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  initMemory,
  addMemory,
  searchMemories,
  cosineSimilarity,
} = require("../../lib/memory.js");

test("searchMemories filters by conversationId when provided", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mem-"));
  initMemory(dir);

  const emb = [1, 0, 0];
  const emb2 = [0, 1, 0];

  addMemory({
    type: "fact",
    content: "conv-a fact",
    source: "conv-a",
    embedding: emb,
    embeddingModel: "m",
    confidence: 0.9,
  });
  addMemory({
    type: "fact",
    content: "conv-b fact",
    source: "conv-b",
    embedding: emb2,
    embeddingModel: "m",
    confidence: 0.9,
  });

  const globalSearch = searchMemories(emb, 5, 0, {});
  assert.ok(globalSearch.length >= 1);

  const scopedA = searchMemories(emb, 5, 0, { conversationId: "conv-a" });
  assert.strictEqual(scopedA.length, 1);
  assert.strictEqual(scopedA[0].content, "conv-a fact");

  const scopedB = searchMemories(emb2, 5, 0, { conversationId: "conv-b" });
  assert.strictEqual(scopedB.length, 1);
  assert.strictEqual(scopedB[0].content, "conv-b fact");

  const scopedEmpty = searchMemories(emb, 5, 0, { conversationId: "conv-other" });
  assert.strictEqual(scopedEmpty.length, 0);

  fs.rmSync(dir, { recursive: true, force: true });
  const resetDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mem-reset-"));
  initMemory(resetDir);
  fs.rmSync(resetDir, { recursive: true, force: true });
});

test("cosineSimilarity stable for identical vectors", () => {
  const v = [0.5, 0.5, 0.5];
  assert.ok(Math.abs(cosineSimilarity(v, v) - 1) < 1e-6);
});
