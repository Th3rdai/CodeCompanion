const { describe, test } = require("node:test");
const assert = require("node:assert/strict");

const {
  buildMultiTurnQuery,
  bm25Scores,
  rrfFuse,
} = require("../../lib/memory.js");

/**
 * MEMORYFIX Phase 2 hybrid-recall helpers. These three functions are PURE
 * (no disk / Ollama), so no initMemory or temp dirs are needed. All assertions
 * are order-independent: where ordering matters we sort/derive it explicitly.
 */

describe("buildMultiTurnQuery", () => {
  test("combines last N user messages newest-last with the most recent repeated (recency weight)", () => {
    const messages = [
      { role: "user", content: "a" },
      { role: "assistant", content: "x" },
      { role: "user", content: "b" },
      { role: "user", content: "c" },
    ];
    // userTexts = [a,b,c]; recent (maxTurns=3) = [a,b,c]; latest = c → "a\nb\nc\nc"
    assert.equal(buildMultiTurnQuery(messages, 3), "a\nb\nc\nc");
  });

  test("ignores assistant and system messages", () => {
    const messages = [
      { role: "system", content: "sys" },
      { role: "user", content: "a" },
      { role: "assistant", content: "x" },
      { role: "user", content: "b" },
      { role: "assistant", content: "y" },
    ];
    // Only user messages a,b survive → "a\nb\nb"
    assert.equal(buildMultiTurnQuery(messages, 3), "a\nb\nb");
  });

  test("respects maxTurns (only the last N user messages)", () => {
    const messages = [
      { role: "user", content: "a" },
      { role: "user", content: "b" },
      { role: "user", content: "c" },
    ];
    // maxTurns=2 → recent = [b,c]; latest = c → "b\nc\nc"
    assert.equal(buildMultiTurnQuery(messages, 2), "b\nc\nc");
  });

  test('returns "" when there are no user messages (assistant-only)', () => {
    const messages = [
      { role: "assistant", content: "x" },
      { role: "system", content: "y" },
    ];
    assert.equal(buildMultiTurnQuery(messages, 3), "");
  });

  test('returns "" for an empty array', () => {
    assert.equal(buildMultiTurnQuery([], 3), "");
  });

  test('returns "" for a non-array argument', () => {
    assert.equal(buildMultiTurnQuery(null, 3), "");
    assert.equal(buildMultiTurnQuery(undefined, 3), "");
  });

  test("ACCEPTANCE: multi-turn query differs from the single most-recent user message (>=2 user messages)", () => {
    const messages = [
      { role: "user", content: "first thing" },
      { role: "assistant", content: "ack" },
      { role: "user", content: "second thing" },
    ];
    const lastUserMsg = "second thing";
    const multi = buildMultiTurnQuery(messages, 3);
    // multi = "first thing\nsecond thing\nsecond thing"
    assert.notEqual(multi, lastUserMsg);
    // And it carries earlier-turn context the single message lacks.
    assert.ok(multi.includes("first thing"));
    assert.ok(multi.includes(lastUserMsg));
  });
});

describe("bm25Scores", () => {
  test("a doc containing query terms scores higher; a doc with none scores 0", () => {
    const docs = [
      { id: "a", content: "apple pie apple" },
      { id: "b", content: "banana bread" },
    ];
    const scores = bm25Scores("apple pie", docs);
    const sa = scores.get("a");
    const sb = scores.get("b");
    assert.ok(sa > sb, `expected score(a)=${sa} > score(b)=${sb}`);
    assert.equal(sb, 0);
    assert.ok(sa > 0);
  });

  test("empty query → every doc scores 0", () => {
    const docs = [
      { id: "a", content: "apple pie" },
      { id: "b", content: "banana bread" },
    ];
    const scores = bm25Scores("", docs);
    assert.equal(scores.size, 2);
    assert.equal(scores.get("a"), 0);
    assert.equal(scores.get("b"), 0);
  });

  test("query of only stopwords → every doc scores 0 (tokenizes to no terms)", () => {
    const docs = [
      { id: "a", content: "apple pie" },
      { id: "b", content: "banana bread" },
    ];
    const scores = bm25Scores("the and of", docs);
    assert.equal(scores.get("a"), 0);
    assert.equal(scores.get("b"), 0);
  });

  test("no docs → empty map", () => {
    const empty = bm25Scores("apple pie", []);
    assert.equal(empty instanceof Map, true);
    assert.equal(empty.size, 0);

    const nonArray = bm25Scores("apple pie", null);
    assert.equal(nonArray instanceof Map, true);
    assert.equal(nonArray.size, 0);
  });

  test("IDF: a rarer query term contributes more than a common one", () => {
    // "common" appears in every doc (df high → low IDF);
    // "rare" appears in only one doc (df low → high IDF).
    // Each candidate doc contains exactly one of the two query terms once,
    // and all docs have equal length so length-normalization is identical.
    const docs = [
      { id: "common-hit", content: "common alpha" },
      { id: "rare-hit", content: "rare alpha" },
      { id: "filler1", content: "common beta" },
      { id: "filler2", content: "common gamma" },
    ];
    const scores = bm25Scores("common rare", docs);
    const sCommon = scores.get("common-hit");
    const sRare = scores.get("rare-hit");
    assert.ok(
      sRare > sCommon,
      `expected rare-term doc (${sRare}) to score above common-term doc (${sCommon})`,
    );
  });
});

describe("rrfFuse", () => {
  test("an id ranked highly in BOTH lists beats one ranked high in only one", () => {
    // both: top in A and B. onlyA: top in A only, absent from B.
    const a = ["both", "onlyA", "filler"];
    const b = ["both", "x", "y"];
    const fused = rrfFuse([a, b]);
    assert.ok(
      fused.get("both") > fused.get("onlyA"),
      `expected consensus id 'both' (${fused.get("both")}) > 'onlyA' (${fused.get("onlyA")})`,
    );
  });

  test("ACCEPTANCE: RRF surfaces the consensus item that single-method ranking would not", () => {
    // X: rank 0 in list A, rank 4 in list B.
    // Y: rank 1 in BOTH lists (the consensus item).
    const listA = ["X", "Y", "p", "q", "r"];
    const listB = ["z", "Y", "m", "n", "X"];

    // Single-method (list A alone): X (rank 0) would outrank Y (rank 1).
    assert.ok(listA.indexOf("X") < listA.indexOf("Y"));

    const fused = rrfFuse([listA, listB], 60);
    // X = 1/(60+0+1) + 1/(60+4+1) ; Y = 1/(60+1+1) + 1/(60+1+1)
    const sortedIds = [...fused.entries()]
      .sort((p, qy) => qy[1] - p[1])
      .map(([id]) => id);
    assert.ok(
      fused.get("Y") > fused.get("X"),
      `expected consensus Y (${fused.get("Y")}) to fuse above X (${fused.get("X")})`,
    );
    assert.ok(
      sortedIds.indexOf("Y") < sortedIds.indexOf("X"),
      "RRF ordering should place consensus item Y ahead of single-list winner X",
    );
  });

  test("skips a non-array entry in rankings gracefully", () => {
    const ranking = ["a", "b", "c"];
    const fusedWithGarbage = rrfFuse([ranking, null, undefined, "nope", 42]);
    const fusedClean = rrfFuse([ranking]);
    // The non-array entries contribute nothing; result matches the clean fuse.
    assert.equal(fusedWithGarbage.size, fusedClean.size);
    for (const [id, score] of fusedClean) {
      assert.equal(fusedWithGarbage.get(id), score);
    }
    // And earlier ranks score higher than later ranks.
    assert.ok(fusedWithGarbage.get("a") > fusedWithGarbage.get("b"));
    assert.ok(fusedWithGarbage.get("b") > fusedWithGarbage.get("c"));
  });

  test("empty rankings → empty map", () => {
    const fused = rrfFuse([]);
    assert.equal(fused instanceof Map, true);
    assert.equal(fused.size, 0);
  });
});
