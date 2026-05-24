const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  initMemory,
  addMemory,
  updateMemory,
  searchMemories,
  flushMemoryToDisk,
} = require("../../lib/memory.js");

/**
 * Each test gets its own temp data dir + initMemory(dir). initMemory reloads
 * in-memory state from the (empty) new dir AND clears any pending debounced
 * write + dirty flag, so tests are isolated and order-independent.
 */
function freshMemory() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-memfix-p1b-"));
  initMemory(dir);
  return dir;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("searchMemories — stale embeddingModel filter (opt-in)", () => {
  test("filters to only records matching options.embeddingModel", () => {
    const dir = freshMemory();
    try {
      addMemory({
        type: "fact",
        content: "model-a fact",
        source: null,
        embedding: [1, 0, 0],
        embeddingModel: "model-a",
        confidence: 0.9,
      });
      addMemory({
        type: "fact",
        content: "model-b fact",
        source: null,
        embedding: [0, 1, 0],
        embeddingModel: "model-b",
        confidence: 0.9,
      });

      const queryVec = [1, 1, 0];
      const onlyA = searchMemories(queryVec, 5, 0, {
        embeddingModel: "model-a",
      });
      assert.equal(onlyA.length, 1);
      assert.equal(onlyA[0].content, "model-a fact");
      assert.equal(onlyA[0].embeddingModel, "model-a");
    } finally {
      cleanup(dir);
    }
  });

  test("omitting embeddingModel applies NO model filter (backward compatible)", () => {
    const dir = freshMemory();
    try {
      addMemory({
        type: "fact",
        content: "model-a fact",
        source: null,
        embedding: [1, 0, 0],
        embeddingModel: "model-a",
        confidence: 0.9,
      });
      addMemory({
        type: "fact",
        content: "model-b fact",
        source: null,
        embedding: [0, 1, 0],
        embeddingModel: "model-b",
        confidence: 0.9,
      });

      const queryVec = [1, 1, 0];
      const both = searchMemories(queryVec, 5, 0, {});
      assert.equal(both.length, 2);
      const contents = both.map((m) => m.content).sort();
      assert.deepEqual(contents, ["model-a fact", "model-b fact"]);
    } finally {
      cleanup(dir);
    }
  });

  test('records with empty-string embeddingModel are excluded when a model is requested', () => {
    const dir = freshMemory();
    try {
      addMemory({
        type: "fact",
        content: "model-a fact",
        source: null,
        embedding: [1, 0, 0],
        embeddingModel: "model-a",
        confidence: 0.9,
      });
      // No embeddingModel provided → addMemory stores "" (line 130 of memory.js)
      addMemory({
        type: "fact",
        content: "blank-model fact",
        source: null,
        embedding: [0, 1, 0],
        confidence: 0.9,
      });

      const queryVec = [1, 1, 0];
      const onlyA = searchMemories(queryVec, 5, 0, {
        embeddingModel: "model-a",
      });
      assert.equal(onlyA.length, 1);
      assert.equal(onlyA[0].content, "model-a fact");
    } finally {
      cleanup(dir);
    }
  });
});

describe("updateMemory — expanded allowedFields", () => {
  test("permits updating source, projectKey, and topics; bumps updatedAt", async () => {
    const dir = freshMemory();
    try {
      const rec = addMemory({
        type: "fact",
        content: "a fact",
        source: null,
        embedding: [0.1, 0.2],
        embeddingModel: "m",
        confidence: 0.7,
      });
      const beforeUpdatedAt = rec.updatedAt;

      // Ensure a measurable timestamp change.
      await new Promise((r) => setTimeout(r, 5));

      const updated = updateMemory(rec.id, {
        source: "conv-x",
        projectKey: "proj-y",
        topics: ["t1", "t2"],
      });

      assert.ok(updated, "updateMemory should return the record");
      assert.equal(updated.source, "conv-x");
      assert.equal(updated.projectKey, "proj-y");
      assert.deepEqual(updated.topics, ["t1", "t2"]);
      assert.notEqual(updated.updatedAt, beforeUpdatedAt);
    } finally {
      cleanup(dir);
    }
  });

  test("ignores disallowed fields (id cannot be overwritten)", () => {
    const dir = freshMemory();
    try {
      const rec = addMemory({
        type: "fact",
        content: "a fact",
        source: null,
        embedding: [0.1, 0.2],
        embeddingModel: "m",
        confidence: 0.7,
      });
      const originalId = rec.id;

      const updated = updateMemory(rec.id, { id: "hacked" });
      assert.ok(updated, "updateMemory should return the record");
      assert.equal(updated.id, originalId);
      assert.notEqual(updated.id, "hacked");
    } finally {
      cleanup(dir);
    }
  });
});

describe("Debounced persistence — no data loss", () => {
  test("debounced writes don't lose data: all 3 records present after flush", () => {
    const dir = freshMemory();
    try {
      addMemory({
        type: "fact",
        content: "burst one",
        source: null,
        embedding: [1, 0, 0],
        embeddingModel: "m",
        confidence: 0.7,
      });
      addMemory({
        type: "fact",
        content: "burst two",
        source: null,
        embedding: [0, 1, 0],
        embeddingModel: "m",
        confidence: 0.7,
      });
      addMemory({
        type: "fact",
        content: "burst three",
        source: null,
        embedding: [0, 0, 1],
        embeddingModel: "m",
        confidence: 0.7,
      });

      // The burst of adds coalesces into a single pending debounced write.
      const flushed = flushMemoryToDisk();
      assert.equal(flushed, true);

      const filePath = path.join(dir, "memory", "memories.json");
      assert.equal(fs.existsSync(filePath), true);
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      assert.equal(Array.isArray(parsed), true);

      const contents = parsed.map((m) => m.content).sort();
      assert.deepEqual(contents, ["burst one", "burst three", "burst two"]);
    } finally {
      cleanup(dir);
    }
  });

  test("flush is a no-op (returns false) when nothing is pending", () => {
    const dir = freshMemory();
    try {
      addMemory({
        type: "fact",
        content: "only record",
        source: null,
        embedding: [1, 0, 0],
        embeddingModel: "m",
        confidence: 0.7,
      });

      // First flush performs the pending write.
      assert.equal(flushMemoryToDisk(), true);
      // Second flush has nothing pending → false.
      assert.equal(flushMemoryToDisk(), false);
    } finally {
      cleanup(dir);
    }
  });
});
