const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, "..", "..", relPath), "utf8");
}

test("useChat buildAssistantMessage sanitizes streamed assistant text", () => {
  const source = read("src/hooks/useChat.js");
  assert.match(
    source,
    /content:\s*sanitizeUnconfirmedImageClaims\(\s*assistantContent,\s*assistantImages\.length\s*>\s*0,\s*\)/s,
  );
});

test("ExperimentPanel buildAssistantMessage sanitizes streamed assistant text", () => {
  const source = read("src/components/ExperimentPanel.jsx");
  assert.match(
    source,
    /content:\s*sanitizeUnconfirmedImageClaims\(\s*assistantContent,\s*assistantImages\.length\s*>\s*0,\s*\)/s,
  );
});

test("DeepDivePanel sanitizes streamed assistant text while tool images accumulate", () => {
  const source = read("src/components/DeepDivePanel.jsx");
  assert.match(
    source,
    /content:\s*sanitizeUnconfirmedImageClaims\(\s*assistant,\s*images\.length\s*>\s*0,\s*\)/s,
  );
});
