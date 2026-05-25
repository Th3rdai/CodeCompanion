const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  initMemory,
  addMemory,
  getMemories,
  analyzeMemoryQualityDryRun,
  startMemoryPruneCheckScheduler,
  flushMemoryToDisk,
} = require("../../lib/memory.js");

function freshMemoryDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mem-prune-"));
  initMemory(dir);
  return dir;
}

function cleanup(dir) {
  flushMemoryToDisk();
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("memory prune dry-run analyzer", () => {
  test("returns quality analysis shape without mutating memory store", () => {
    const dir = freshMemoryDir();
    try {
      addMemory({
        type: "fact",
        content: "Use concise examples in explanations.",
        confidence: 0.82,
      });
      addMemory({
        type: "fact",
        content: "Use concise examples in explanations.",
        confidence: 0.81,
      });
      addMemory({
        type: "fact",
        content: "ok",
        confidence: 0.12,
      });
      addMemory({
        type: "summary",
        content: "Remember to test memory route integration.",
        confidence: 0.58,
      });

      const before = getMemories()
        .map((m) => m.id)
        .sort();
      const analysis = analyzeMemoryQualityDryRun({
        sampleSize: 10,
        nearDuplicateSimilarity: 0.7,
        lowSignalScoreThreshold: 0.2,
        minContentLength: 10,
        staleDays: 1,
      });
      const after = getMemories()
        .map((m) => m.id)
        .sort();

      assert.equal(analysis.readOnly, true);
      assert.equal(analysis.totalCount, before.length);
      assert.ok(analysis.distributions.byType.fact >= 3);
      assert.ok(analysis.exactDuplicates.totalGroups >= 1);
      assert.ok(analysis.exactDuplicates.removableCount >= 1);
      assert.ok(Array.isArray(analysis.nearDuplicates.pairs));
      assert.ok(Array.isArray(analysis.lowSignal.candidates));
      assert.ok(
        typeof analysis.suggestedThresholds.lowSignalScoreThreshold ===
          "number",
      );
      assert.deepEqual(after, before);
    } finally {
      cleanup(dir);
    }
  });

  test("scheduler uses interval config and logs dry-run summary only", () => {
    const dir = freshMemoryDir();
    try {
      addMemory({
        type: "fact",
        content: "Keep route tests deterministic.",
        confidence: 0.6,
      });

      const logs = [];
      const intervals = [];
      const cleared = [];
      const scheduler = startMemoryPruneCheckScheduler({
        getConfig() {
          return {
            memory: {
              pruneCheck: {
                enabled: true,
                intervalDays: 24, // Max safe value (Node.js setInterval limit ~24.8 days)
                sampleSize: 20,
                thresholds: {
                  nearDuplicateSimilarity: 0.86,
                  lowSignalScoreThreshold: 0.55,
                  minContentLength: 20,
                  staleDays: 120,
                },
              },
            },
          };
        },
        log(level, message, fields) {
          logs.push({ level, message, fields });
        },
        setIntervalFn(fn, ms) {
          intervals.push({ fn, ms });
          return { marker: "timer", unref() {} };
        },
        clearIntervalFn(timer) {
          cleared.push(timer);
        },
      });

      assert.equal(scheduler.enabled, true);
      assert.equal(intervals.length, 1);
      assert.equal(intervals[0].ms, 24 * 24 * 60 * 60 * 1000); // 24 days (max safe interval)

      const result = scheduler.runNow("test");
      assert.ok(result);
      assert.equal(result.analysis.readOnly, true);
      assert.ok(logs.some((l) => l.message === "Memory prune dry-run summary"));

      scheduler.stop();
      assert.equal(cleared.length, 1);
      assert.equal(cleared[0].marker, "timer");
    } finally {
      cleanup(dir);
    }
  });
});
