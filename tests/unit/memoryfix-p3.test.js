const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  initMemory,
  extractionHasNewMessages,
  markExtractionWatermark,
} = require("../../lib/memory.js");

/**
 * Phase 3 (MEMORYFIX) — incremental-extraction watermark helpers.
 *
 * `_extractionWatermark` is a module-level Map shared across all tests and
 * cleared by `initMemory(dir)`. To keep these tests order-independent we both
 * (a) call `initMemory(freshDir)` at the start of each test to reset state, and
 * (b) use a UNIQUE conversationId per test to avoid any cross-test leakage.
 */
function freshMemory() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-memfix-p3-"));
  initMemory(dir);
  return dir;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("extractionHasNewMessages — new conversation (Phase 3)", () => {
  test("never-marked conversation → true (watermark defaults to 0)", () => {
    const dir = freshMemory();
    try {
      assert.equal(extractionHasNewMessages("p3-new-conv", 5), true);
    } finally {
      cleanup(dir);
    }
  });
});

describe("markExtractionWatermark + extractionHasNewMessages (Phase 3)", () => {
  test("after marking at 5: same count false, grown true, shrunk false", () => {
    const dir = freshMemory();
    try {
      const id = "p3-watermark-conv";
      markExtractionWatermark(id, 5);

      // No new messages (equal to watermark) → not strictly greater → false.
      assert.equal(extractionHasNewMessages(id, 5), false);
      // Grew past the watermark → true.
      assert.equal(extractionHasNewMessages(id, 6), true);
      // Below the watermark (shrunk / unchanged-below) → false.
      assert.equal(extractionHasNewMessages(id, 4), false);
    } finally {
      cleanup(dir);
    }
  });
});

describe("falsy conversationId (Phase 3)", () => {
  test("null/empty/undefined conversationId → always true regardless of count", () => {
    const dir = freshMemory();
    try {
      assert.equal(extractionHasNewMessages(null, 5), true);
      assert.equal(extractionHasNewMessages(null, 0), true);
      assert.equal(extractionHasNewMessages("", 5), true);
      assert.equal(extractionHasNewMessages("", 0), true);
      assert.equal(extractionHasNewMessages(undefined, 5), true);
      assert.equal(extractionHasNewMessages(undefined, 0), true);
    } finally {
      cleanup(dir);
    }
  });

  test("markExtractionWatermark(null, 5) is a no-op — does not throw or affect other convs", () => {
    const dir = freshMemory();
    try {
      const id = "p3-noop-conv";
      // Establish a known watermark for a real conversation.
      markExtractionWatermark(id, 3);
      assert.equal(extractionHasNewMessages(id, 3), false);

      // Marking a falsy id must not throw and must not perturb `id`'s watermark.
      assert.doesNotThrow(() => markExtractionWatermark(null, 5));
      assert.doesNotThrow(() => markExtractionWatermark("", 5));
      assert.doesNotThrow(() => markExtractionWatermark(undefined, 5));

      // `id`'s watermark is unchanged: still false at 3, still true at 4.
      assert.equal(extractionHasNewMessages(id, 3), false);
      assert.equal(extractionHasNewMessages(id, 4), true);
    } finally {
      cleanup(dir);
    }
  });
});

describe("initMemory clears watermarks (Phase 3)", () => {
  test("initMemory(newDir) resets the watermark map", () => {
    const dir1 = freshMemory();
    let dir2;
    try {
      const id = "p3-init-clears-conv";
      markExtractionWatermark(id, 5);
      assert.equal(extractionHasNewMessages(id, 5), false);

      // initMemory clears `_extractionWatermark`, so the watermark resets to 0.
      dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "cc-memfix-p3-"));
      initMemory(dir2);

      assert.equal(extractionHasNewMessages(id, 5), true);
    } finally {
      cleanup(dir1);
      if (dir2) cleanup(dir2);
    }
  });
});
