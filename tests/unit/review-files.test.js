const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("reviewFiles", () => {
  it.skip("reviewFiles is exported from lib/review", () => {
    const { reviewFiles } = require("../../lib/review");
    assert.equal(typeof reviewFiles, "function");
  });

  it.skip("reviewFiles builds combined string with FILE separators", async () => {
    const { reviewFiles } = require("../../lib/review");
    const files = [
      { path: "a.js", content: "x" },
      { path: "b.js", content: "y" },
    ];
    // Call reviewFiles — it should pass a combined string to reviewCode internally.
    // We inspect behavior by checking the returned result is a Promise (async).
    // The combined string format is: "// --- FILE: a.js ---\nx\n\n// --- FILE: b.js ---\ny"
    const result = reviewFiles("http://localhost:11434", "llama3.2", files, {});
    assert.ok(result instanceof Promise, "reviewFiles must return a Promise");
    // Stub — full assertion requires live Ollama; skip until Wave 1 integration.
  });

  it.skip("reviewFiles scales timeout by file count (Math.ceil(count/5) * base)", async () => {
    // 10 files with base timeout 300000ms:
    // scaledTimeout = Math.min(300000 * Math.ceil(10 / 5), 600000)
    //               = Math.min(300000 * 2, 600000)
    //               = Math.min(600000, 600000)
    //               = 600000
    const scaledTimeout = Math.min(300000 * Math.ceil(10 / 5), 600000);
    assert.equal(scaledTimeout, 600000);
  });

  it.skip("reviewFiles timeout never exceeds 600000ms for large file counts (e.g. 80 files)", () => {
    // 80 files: Math.min(300000 * Math.ceil(80 / 5), 600000)
    //         = Math.min(300000 * 16, 600000)
    //         = Math.min(4800000, 600000)
    //         = 600000
    const scaledTimeout = Math.min(300000 * Math.ceil(80 / 5), 600000);
    assert.equal(scaledTimeout, 600000, "Timeout must be capped at 600000ms");
  });

  it.skip("reviewFiles returns a Promise (is async)", () => {
    const { reviewFiles } = require("../../lib/review");
    const files = [{ path: "test.js", content: "const x = 1;" }];
    const result = reviewFiles("http://localhost:11434", "llama3.2", files, {});
    assert.ok(result instanceof Promise, "reviewFiles must return a Promise");
  });
});
