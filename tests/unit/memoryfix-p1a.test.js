const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  initMemory,
  addMemory,
  flushMemoryToDisk,
  reembedAllMemories,
} = require("../../lib/memory.js");

/**
 * Each test gets its own temp data dir + initMemory(dir) to keep state isolated
 * between tests (initMemory reloads in-memory state from the new dir, which is
 * empty), then cleans up the dir afterward.
 */
function freshMemory() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-memfix-"));
  initMemory(dir);
  return dir;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("addMemory — topics normalization", () => {
  test("summary normalizes topics to trimmed non-empty strings", () => {
    const dir = freshMemory();
    try {
      const rec = addMemory({
        type: "summary",
        content: "a summary",
        source: "conv-a",
        embedding: [0.1, 0.2],
        embeddingModel: "m",
        confidence: 0.5,
        topics: ["  a ", "", "b", 3],
      });
      assert.deepEqual(rec.topics, ["a", "b"]);
    } finally {
      cleanup(dir);
    }
  });

  test("non-summary type never gets a topics key", () => {
    const dir = freshMemory();
    try {
      const rec = addMemory({
        type: "fact",
        content: "a fact",
        source: null,
        embedding: [0.1, 0.2],
        embeddingModel: "m",
        confidence: 0.7,
        topics: ["a", "b"],
      });
      assert.equal(Object.prototype.hasOwnProperty.call(rec, "topics"), false);
    } finally {
      cleanup(dir);
    }
  });

  test("summary without a topics array gets no topics key", () => {
    const dir = freshMemory();
    try {
      const rec = addMemory({
        type: "summary",
        content: "a summary",
        source: "conv-a",
        embedding: [0.1, 0.2],
        embeddingModel: "m",
        confidence: 0.5,
        // topics omitted (undefined, not an array)
      });
      assert.equal(Object.prototype.hasOwnProperty.call(rec, "topics"), false);
    } finally {
      cleanup(dir);
    }
  });

  test("summary with empty topics array yields an empty topics array", () => {
    const dir = freshMemory();
    try {
      const rec = addMemory({
        type: "summary",
        content: "a summary",
        source: "conv-a",
        embedding: [0.1, 0.2],
        embeddingModel: "m",
        confidence: 0.5,
        topics: [],
      });
      assert.equal(Object.prototype.hasOwnProperty.call(rec, "topics"), true);
      assert.deepEqual(rec.topics, []);
    } finally {
      cleanup(dir);
    }
  });
});

describe("flushMemoryToDisk", () => {
  test("returns true after a successful persist when initialized", () => {
    const dir = freshMemory();
    try {
      addMemory({
        type: "fact",
        content: "persist me",
        source: null,
        embedding: [0.1],
        embeddingModel: "m",
        confidence: 0.7,
      });
      assert.equal(flushMemoryToDisk(), true);
      // The on-disk memories.json should now exist and contain the record.
      const filePath = path.join(dir, "memory", "memories.json");
      assert.equal(fs.existsSync(filePath), true);
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      assert.equal(Array.isArray(parsed), true);
      assert.equal(
        parsed.some((m) => m.content === "persist me"),
        true,
      );
    } finally {
      cleanup(dir);
    }
  });
});

describe("reembedAllMemories — injected embedFn", () => {
  test("non-empty embedding sets embedding/model and counts as reembedded", async () => {
    const dir = freshMemory();
    try {
      const a = addMemory({
        type: "fact",
        content: "fact one",
        source: null,
        embedding: [1, 0, 0],
        embeddingModel: "old-model",
        confidence: 0.7,
      });
      const b = addMemory({
        type: "fact",
        content: "fact two",
        source: null,
        embedding: [0, 1, 0],
        embeddingModel: "old-model",
        confidence: 0.7,
      });
      const beforeA = a.updatedAt;
      const beforeB = b.updatedAt;

      // Ensure a measurable timestamp change.
      await new Promise((r) => setTimeout(r, 5));

      const newVec = [0.1, 0.2, 0.3];
      const fakeEmbed = async (_url, _text, _model, _opts) => newVec;

      const result = await reembedAllMemories(
        "http://unused",
        "new-model",
        {},
        fakeEmbed,
      );

      assert.equal(result.total, 2);
      assert.equal(result.reembedded, 2);
      assert.equal(result.failed, 0);
      assert.equal(result.embeddingModel, "new-model");

      assert.deepEqual(a.embedding, newVec);
      assert.deepEqual(b.embedding, newVec);
      assert.equal(a.embeddingModel, "new-model");
      assert.equal(b.embeddingModel, "new-model");
      assert.notEqual(a.updatedAt, beforeA);
      assert.notEqual(b.updatedAt, beforeB);
    } finally {
      cleanup(dir);
    }
  });

  test("embedFn returning null counts records as failed, not reembedded", async () => {
    const dir = freshMemory();
    try {
      addMemory({
        type: "fact",
        content: "fact one",
        source: null,
        embedding: [1, 0, 0],
        embeddingModel: "old-model",
        confidence: 0.7,
      });
      addMemory({
        type: "fact",
        content: "fact two",
        source: null,
        embedding: [0, 1, 0],
        embeddingModel: "old-model",
        confidence: 0.7,
      });

      const fakeEmbedNull = async () => null;
      const result = await reembedAllMemories(
        "http://unused",
        "new-model",
        {},
        fakeEmbedNull,
      );

      assert.equal(result.total, 2);
      assert.equal(result.reembedded, 0);
      assert.equal(result.failed, 2);
      assert.equal(result.embeddingModel, "new-model");
    } finally {
      cleanup(dir);
    }
  });

  test("embedFn returning an empty array counts records as failed", async () => {
    const dir = freshMemory();
    try {
      addMemory({
        type: "fact",
        content: "fact one",
        source: null,
        embedding: [1, 0, 0],
        embeddingModel: "old-model",
        confidence: 0.7,
      });

      const fakeEmbedEmpty = async () => [];
      const result = await reembedAllMemories(
        "http://unused",
        "new-model",
        {},
        fakeEmbedEmpty,
      );

      assert.equal(result.total, 1);
      assert.equal(result.reembedded, 0);
      assert.equal(result.failed, 1);
      assert.equal(result.embeddingModel, "new-model");
    } finally {
      cleanup(dir);
    }
  });
});
