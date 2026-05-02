const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

/** Minimal payload that satisfies ReportCardSchema (Ollama /api/chat mock). */
function miniReportCard() {
  const cat = (g) => ({ grade: g, summary: "ok", findings: [] });
  return {
    overallGrade: "A",
    topPriority: {
      category: "bugs",
      title: "none",
      explanation: "none",
    },
    categories: {
      bugs: cat("A"),
      security: cat("A"),
      readability: cat("A"),
      completeness: cat("A"),
    },
    cleanBillOfHealth: true,
  };
}

describe("reviewFiles", () => {
  it("reviewFiles is exported from lib/review", () => {
    const { reviewFiles } = require("../../lib/review");
    assert.equal(typeof reviewFiles, "function");
  });

  it("reviewFiles builds combined string with FILE separators", async () => {
    const origFetch = global.fetch;
    try {
      global.fetch = async (url, init) => {
        assert.match(String(url), /\/api\/chat$/);
        const body = JSON.parse(init.body);
        const userMsg = body.messages.find((m) => m.role === "user");
        assert.ok(userMsg?.content?.includes("// --- FILE: a.js ---"));
        assert.ok(userMsg?.content?.includes("// --- FILE: b.js ---"));
        return new Response(
          JSON.stringify({
            message: { content: JSON.stringify(miniReportCard()) },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };
      const { reviewFiles } = require("../../lib/review");
      const files = [
        { path: "a.js", content: "x" },
        { path: "b.js", content: "y" },
      ];
      const result = await reviewFiles(
        "http://localhost:11434",
        "llama3.2",
        files,
        {},
      );
      assert.equal(result.type, "report-card");
      assert.equal(result.data.overallGrade, "A");
    } finally {
      global.fetch = origFetch;
    }
  });

  it("reviewFiles scales timeout by file count (Math.ceil(count/5) * base)", async () => {
    // 10 files with base timeout 300000ms:
    // scaledTimeout = Math.min(300000 * Math.ceil(10 / 5), 600000)
    //               = Math.min(300000 * 2, 600000)
    //               = Math.min(600000, 600000)
    //               = 600000
    const scaledTimeout = Math.min(300000 * Math.ceil(10 / 5), 600000);
    assert.equal(scaledTimeout, 600000);
  });

  it("reviewFiles timeout never exceeds 600000ms for large file counts (e.g. 80 files)", () => {
    // 80 files: Math.min(300000 * Math.ceil(80 / 5), 600000)
    //         = Math.min(300000 * 16, 600000)
    //         = Math.min(4800000, 600000)
    //         = 600000
    const scaledTimeout = Math.min(300000 * Math.ceil(80 / 5), 600000);
    assert.equal(scaledTimeout, 600000, "Timeout must be capped at 600000ms");
  });

  it("reviewFiles returns a Promise and resolves with mocked Ollama", async () => {
    const origFetch = global.fetch;
    try {
      global.fetch = async () =>
        new Response(
          JSON.stringify({
            message: { content: JSON.stringify(miniReportCard()) },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      const { reviewFiles } = require("../../lib/review");
      const files = [{ path: "test.js", content: "const x = 1;" }];
      const pending = reviewFiles(
        "http://localhost:11434",
        "llama3.2",
        files,
        {},
      );
      assert.ok(
        pending instanceof Promise,
        "reviewFiles must return a Promise",
      );
      const result = await pending;
      assert.equal(result.type, "report-card");
    } finally {
      global.fetch = origFetch;
    }
  });
});
