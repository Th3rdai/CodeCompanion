const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

describe("review validate context wiring (review-service)", () => {
  it("loads validate instructions from project folder", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../lib/review-service.js"),
      "utf8",
    );
    assert.ok(
      src.includes("loadValidateReviewContext"),
      "review-service should import validate context loader",
    );
    assert.match(
      src,
      /loadValidateReviewContext\(\s*config\.projectFolder,\s*\{/,
      "review-service should load validate context with search options",
    );
    assert.ok(
      src.includes('searchFrom: filename || ""'),
      "single-file review should search from filename path",
    );
    assert.ok(
      src.includes('searchFrom: folder || ""'),
      "folder review should search from folder path",
    );
  });

  it("passes validateContext into reviewCode and reviewFiles", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../lib/review-service.js"),
      "utf8",
    );
    const matches =
      src.match(/validateContext:\s*validateReviewContext\?\.context/g) || [];
    assert.ok(
      matches.length >= 2,
      "review-service should pass validate context to both single-file and folder review",
    );
  });
});
