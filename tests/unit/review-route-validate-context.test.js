const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

describe("review route validate context wiring", () => {
  it("loads validate instructions from project folder", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../routes/review.js"),
      "utf8",
    );
    assert.ok(
      src.includes("loadValidateReviewContext"),
      "route should import validate context loader",
    );
    assert.match(
      src,
      /loadValidateReviewContext\(\s*config\.projectFolder,\s*\{/,
      "route should load validate context with search options",
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
      path.join(__dirname, "../../routes/review.js"),
      "utf8",
    );
    const matches =
      src.match(/validateContext:\s*validateReviewContext\?\.context/g) || [];
    assert.ok(
      matches.length >= 2,
      "route should pass validate context to both single-file and folder review",
    );
  });
});
