const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  initMemory,
  addMemory,
  updateMemory,
  deleteMemory,
  searchMemories,
} = require("../../lib/memory.js");

function freshMemory() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mem-index-"));
  initMemory(dir);
  return dir;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("memory index cache (lazy warm + invalidation)", () => {
  test("falls back to legacy search when cache is disabled", () => {
    const dir = freshMemory();
    try {
      const emb = [1, 0, 0];
      addMemory({
        type: "fact",
        content: "legacy path memory",
        embedding: emb,
        embeddingModel: "m",
      });

      const results = searchMemories(emb, 5, 0, {
        types: ["fact"],
        embeddingModel: "m",
      });
      assert.equal(results.length, 1);
      assert.equal(results[0].content, "legacy path memory");
    } finally {
      cleanup(dir);
    }
  });

  test("cache sees add/update/delete mutations safely after warmup", () => {
    const dir = freshMemory();
    try {
      const emb = [1, 0, 0];

      const first = addMemory({
        type: "fact",
        content: "first fact",
        embedding: emb,
        embeddingModel: "m",
      });

      // Warm lazy index.
      const warm = searchMemories(emb, 10, 0, {
        types: ["fact"],
        embeddingModel: "m",
        indexCacheEnabled: true,
      });
      assert.equal(warm.length, 1);

      const second = addMemory({
        type: "fact",
        content: "second fact",
        source: "conv-a",
        embedding: emb,
        embeddingModel: "m",
      });

      const afterAdd = searchMemories(emb, 10, 0, {
        types: ["fact"],
        embeddingModel: "m",
        indexCacheEnabled: true,
      });
      assert.equal(afterAdd.length, 2);

      updateMemory(second.id, { type: "summary", source: "conv-b" });

      const factsAfterUpdate = searchMemories(emb, 10, 0, {
        types: ["fact"],
        embeddingModel: "m",
        indexCacheEnabled: true,
      });
      assert.equal(factsAfterUpdate.length, 1);
      assert.equal(factsAfterUpdate[0].id, first.id);

      const scopedSummary = searchMemories(emb, 10, 0, {
        conversationId: "conv-b",
        scopeToConversation: true,
        types: ["summary"],
        embeddingModel: "m",
        indexCacheEnabled: true,
      });
      assert.equal(scopedSummary.length, 1);
      assert.equal(scopedSummary[0].id, second.id);

      deleteMemory(first.id);

      const afterDelete = searchMemories(emb, 10, 0, {
        types: ["fact"],
        embeddingModel: "m",
        indexCacheEnabled: true,
      });
      assert.equal(afterDelete.length, 0);
    } finally {
      cleanup(dir);
    }
  });
});
