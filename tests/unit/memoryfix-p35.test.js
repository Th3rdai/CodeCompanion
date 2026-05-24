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
  getMemory,
  getMemories,
  compactMemories,
} = require("../../lib/memory.js");

/**
 * Each test gets its own temp data dir + initMemory(dir) to keep state isolated
 * between tests (initMemory reloads in-memory state from the new dir, which is
 * empty), then cleans up the dir afterward. Mirrors memoryfix-p1a.test.js.
 */
function freshMemory() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-memfix-p35-"));
  initMemory(dir);
  return dir;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("addMemory — pinned field (Phase 5)", () => {
  test("pinned:true → record.pinned === true", () => {
    const dir = freshMemory();
    try {
      const rec = addMemory({ type: "fact", content: "x", pinned: true });
      assert.equal(rec.pinned, true);
    } finally {
      cleanup(dir);
    }
  });

  test("pinned omitted → record.pinned === false (field always present, not undefined)", () => {
    const dir = freshMemory();
    try {
      const rec = addMemory({ type: "fact", content: "x" });
      // Source uses `pinned: pinned === true`, so the field is always present.
      assert.equal(Object.prototype.hasOwnProperty.call(rec, "pinned"), true);
      assert.equal(rec.pinned, false);
      assert.notEqual(rec.pinned, undefined);
    } finally {
      cleanup(dir);
    }
  });

  test("a non-boolean / falsy pinned value normalizes to false", () => {
    const dir = freshMemory();
    try {
      const rec = addMemory({ type: "fact", content: "x", pinned: 0 });
      assert.equal(rec.pinned, false);
    } finally {
      cleanup(dir);
    }
  });
});

describe("updateMemory — pinned is an allowed field (Phase 5)", () => {
  test("updateMemory(id, {pinned:true}) sets pinned true", () => {
    const dir = freshMemory();
    try {
      const rec = addMemory({ type: "fact", content: "x" });
      assert.equal(rec.pinned, false);

      const updated = updateMemory(rec.id, { pinned: true });
      assert.notEqual(updated, null);
      assert.equal(updated.pinned, true);
      // Same record reference is mutated and findable.
      assert.equal(getMemory(rec.id).pinned, true);
    } finally {
      cleanup(dir);
    }
  });

  test("updateMemory(id, {pinned:false}) sets pinned back to false", () => {
    const dir = freshMemory();
    try {
      const rec = addMemory({ type: "fact", content: "x", pinned: true });
      assert.equal(rec.pinned, true);

      const updated = updateMemory(rec.id, { pinned: false });
      assert.notEqual(updated, null);
      assert.equal(updated.pinned, false);
      assert.equal(getMemory(rec.id).pinned, false);
    } finally {
      cleanup(dir);
    }
  });
});

describe("deleteMemory — forget (Phase 5)", () => {
  test("deleteMemory(id) returns true and removes the record", () => {
    const dir = freshMemory();
    try {
      const rec = addMemory({ type: "fact", content: "forget me" });
      assert.equal(getMemory(rec.id) !== null, true);

      const result = deleteMemory(rec.id);
      assert.equal(result, true);
      assert.equal(getMemory(rec.id), null);
    } finally {
      cleanup(dir);
    }
  });

  test("deleteMemory(nonexistent) returns false", () => {
    const dir = freshMemory();
    try {
      const result = deleteMemory(
        "nonexistent-uuid-00000000-0000-0000-0000-000000000000",
      );
      assert.equal(result, false);
    } finally {
      cleanup(dir);
    }
  });
});

describe("compactMemories — Phase 4", () => {
  test("no args → removes nothing; removed===0 and before===after===count", () => {
    const dir = freshMemory();
    try {
      addMemory({ type: "fact", content: "f1" });
      addMemory({ type: "summary", content: "s1", source: "conv-A" });
      addMemory({ type: "summary", content: "s2", source: "conv-B" });

      const count = getMemories().length;
      assert.equal(count, 3);

      const res = compactMemories();
      assert.equal(res.removed, 0);
      assert.equal(res.before, count);
      assert.equal(res.after, count);
      assert.equal(res.before, res.after);
      assert.equal(getMemories().length, count);
    } finally {
      cleanup(dir);
    }
  });

  test("validSources removes orphan summaries, keeps valid summaries and non-summary facts", () => {
    const dir = freshMemory();
    try {
      const live = addMemory({
        type: "summary",
        content: "live summary",
        source: "conv-A",
      });
      const dead = addMemory({
        type: "summary",
        content: "dead summary",
        source: "conv-DEAD",
      });
      // A non-summary fact carrying a source — facts are NOT conversation-scoped,
      // so it must survive even when its source isn't in validSources.
      const fact = addMemory({
        type: "fact",
        content: "a fact",
        source: "conv-DEAD",
      });

      const res = compactMemories({ validSources: ["conv-A"] });

      assert.equal(res.before, 3);
      assert.equal(res.after, 2);
      assert.equal(res.removed, 1);

      assert.equal(
        getMemory(dead.id),
        null,
        "orphan summary should be removed",
      );
      assert.notEqual(getMemory(live.id), null, "valid summary should remain");
      assert.notEqual(
        getMemory(fact.id),
        null,
        "non-summary fact should remain",
      );
    } finally {
      cleanup(dir);
    }
  });

  test("pinned orphan summary is preserved", () => {
    const dir = freshMemory();
    try {
      const pinnedDead = addMemory({
        type: "summary",
        content: "pinned dead summary",
        source: "conv-DEAD",
        pinned: true,
      });
      const live = addMemory({
        type: "summary",
        content: "live summary",
        source: "conv-A",
      });

      const res = compactMemories({ validSources: ["conv-A"] });

      assert.equal(res.removed, 0);
      assert.notEqual(
        getMemory(pinnedDead.id),
        null,
        "pinned orphan summary should survive",
      );
      assert.notEqual(getMemory(live.id), null);
    } finally {
      cleanup(dir);
    }
  });

  test("summary with source:null is NOT an orphan (kept)", () => {
    const dir = freshMemory();
    try {
      // source omitted → stored as null (addMemory: source || null).
      const nullSrc = addMemory({
        type: "summary",
        content: "no source summary",
      });
      assert.equal(nullSrc.source, null);
      const live = addMemory({
        type: "summary",
        content: "live summary",
        source: "conv-A",
      });

      const res = compactMemories({ validSources: ["conv-A"] });

      // Source filter is `m.source && !valid.has(m.source)`, so null source is kept.
      assert.equal(res.removed, 0);
      assert.notEqual(
        getMemory(nullSrc.id),
        null,
        "null-source summary should be kept",
      );
      assert.notEqual(getMemory(live.id), null);
    } finally {
      cleanup(dir);
    }
  });

  test("validSources works as an array AND as a Set", () => {
    // Array form
    const dirA = freshMemory();
    try {
      const live = addMemory({
        type: "summary",
        content: "live",
        source: "conv-A",
      });
      const dead = addMemory({
        type: "summary",
        content: "dead",
        source: "conv-DEAD",
      });
      const res = compactMemories({ validSources: ["conv-A"] });
      assert.equal(res.removed, 1);
      assert.notEqual(getMemory(live.id), null);
      assert.equal(getMemory(dead.id), null);
    } finally {
      cleanup(dirA);
    }

    // Set form
    const dirB = freshMemory();
    try {
      const live = addMemory({
        type: "summary",
        content: "live",
        source: "conv-A",
      });
      const dead = addMemory({
        type: "summary",
        content: "dead",
        source: "conv-DEAD",
      });
      const res = compactMemories({ validSources: new Set(["conv-A"]) });
      assert.equal(res.removed, 1);
      assert.notEqual(getMemory(live.id), null);
      assert.equal(getMemory(dead.id), null);
    } finally {
      cleanup(dirB);
    }
  });
});
