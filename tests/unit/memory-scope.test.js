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

test("searchMemories defaults to global scope across conversations", () => {
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

  // No options → both memories are searchable regardless of source
  const globalNoOpts = searchMemories(emb, 5, 0, {});
  assert.strictEqual(globalNoOpts.length, 2);

  // Passing conversationId alone is NOT enough to scope — global behavior is
  // the default; scopeToConversation must be set explicitly.
  const stillGlobal = searchMemories(emb, 5, 0, { conversationId: "conv-a" });
  assert.strictEqual(stillGlobal.length, 2);

  fs.rmSync(dir, { recursive: true, force: true });
  const resetDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mem-reset-"));
  initMemory(resetDir);
  fs.rmSync(resetDir, { recursive: true, force: true });
});

test("searchMemories restricts to one conversation when scopeToConversation=true", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mem-scoped-"));
  initMemory(dir);

  const emb = [1, 0, 0];
  const emb2 = [0, 1, 0];

  addMemory({
    type: "summary",
    content: "conv-a summary",
    source: "conv-a",
    embedding: emb,
    embeddingModel: "m",
    confidence: 0.9,
  });
  addMemory({
    type: "summary",
    content: "conv-b summary",
    source: "conv-b",
    embedding: emb2,
    embeddingModel: "m",
    confidence: 0.9,
  });

  const scopedA = searchMemories(emb, 5, 0, {
    conversationId: "conv-a",
    scopeToConversation: true,
  });
  assert.strictEqual(scopedA.length, 1);
  assert.strictEqual(scopedA[0].content, "conv-a summary");

  const scopedB = searchMemories(emb2, 5, 0, {
    conversationId: "conv-b",
    scopeToConversation: true,
  });
  assert.strictEqual(scopedB.length, 1);
  assert.strictEqual(scopedB[0].content, "conv-b summary");

  const scopedEmpty = searchMemories(emb, 5, 0, {
    conversationId: "conv-other",
    scopeToConversation: true,
  });
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
