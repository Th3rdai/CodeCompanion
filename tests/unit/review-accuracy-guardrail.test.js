const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

describe("review accuracy guardrail wiring", () => {
  it("review.js includes explicit non-hallucination guardrails", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../lib/review.js"),
      "utf8",
    );
    assert.ok(src.includes("ACCURACY GUARDRAILS"), "guardrail block missing");
    assert.ok(
      src.includes("Only report issues you can directly support"),
      "evidence-based instruction missing",
    );
    assert.ok(
      src.includes("If evidence is uncertain, leave the finding out"),
      "uncertainty instruction missing",
    );
  });

  it("review.js appends validate context to structured and fallback requests", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../lib/review.js"),
      "utf8",
    );
    assert.ok(
      src.includes("Project validation instructions (from validate.md)"),
      "validate context label missing",
    );
    assert.ok(
      src.includes("${visionContext}${validateContext}"),
      "validate context must be included with review request content",
    );
  });
});
