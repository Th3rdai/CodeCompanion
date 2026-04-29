const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { isDirectoryTree } = require("../../lib/review");

describe("isDirectoryTree", () => {
  it("returns false for normal source code", () => {
    const code = `function hello() {\n  console.log("hi");\n}\nmodule.exports = { hello };`;
    assert.equal(isDirectoryTree(code, "index.js"), false);
  });

  it("returns true for classic tree-character listing", () => {
    const code = `project/\n├── src/\n│   ├── index.js\n│   └── utils.js\n└── package.json`;
    assert.equal(isDirectoryTree(code, ""), true);
  });

  it("returns true for listing with 'Project Structure' header", () => {
    const code = `Project Structure\nsrc/\n  index.js\n  utils.js\n`;
    assert.equal(isDirectoryTree(code, ""), true);
  });

  it("returns true when filename contains 'directory'", () => {
    assert.equal(isDirectoryTree("some content", "directory-tree.txt"), true);
  });

  it("returns true when filename contains 'tree'", () => {
    assert.equal(isDirectoryTree("some content", "file-tree"), true);
  });

  it("returns true when filename contains 'structure'", () => {
    assert.equal(isDirectoryTree("some content", "project-structure.md"), true);
  });

  it("returns false when tree chars appear in a code comment", () => {
    // Tree chars in code but no tree lines — should not trigger
    const code = `// │ This is a flowchart comment\nconst x = 1;`;
    assert.equal(isDirectoryTree(code, "utils.js"), false);
  });

  it("returns false for null/empty input", () => {
    assert.equal(isDirectoryTree("", ""), false);
    assert.equal(isDirectoryTree(null, ""), false);
  });

  it("returns true for 'file listing' header variant", () => {
    const code = `File listing:\n  src/index.js\n  lib/review.js`;
    assert.equal(isDirectoryTree(code, ""), true);
  });
});
