const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");

let parsePromptingLoaded;
before(async () => {
  ({ parsePromptingLoaded } =
    await import("../../src/lib/prompting-parse-loaded.js"));
});

describe("parsePromptingLoaded", () => {
  it("parses CRLF frontmatter and flexible ## Constraints", () => {
    const md = `---\r\npurpose: "P"\r\ntarget_model: "M"\r\nvariables: ["a", "b"]\r\n---\r\n\r\nMain\r\n\r\n## Constraints\r\nC1\r\n`;
    const r = parsePromptingLoaded(md);
    assert.equal(r.purpose, "P");
    assert.equal(r.targetModel, "M");
    assert.deepEqual(r.variables, ["a", "b"]);
    assert.match(r.content, /Main/);
    assert.match(r.constraints, /C1/);
  });

  it("parses ## Constraints with extra spaces in heading", () => {
    const md = `---
purpose: ""
---
Hello

##  Constraints  

Edge
`;
    const r = parsePromptingLoaded(md);
    assert.match(r.content, /Hello/);
    assert.match(r.constraints, /Edge/);
  });

  it("no frontmatter returns full body as content", () => {
    const r = parsePromptingLoaded("Just body");
    assert.equal(r.content.trim(), "Just body");
  });

  it("splits ## Constraints when there is no YAML frontmatter", () => {
    const md = `Write a haiku.

## Constraints

Under 17 syllables.
`;
    const r = parsePromptingLoaded(md);
    assert.match(r.content, /haiku/);
    assert.match(r.constraints, /syllables/);
  });

  it("parses unquoted purpose and variables without quotes", () => {
    const md = `---
purpose: Summarize docs
target_model: gpt-4
variables: [lang, tone]
---

Go.
`;
    const r = parsePromptingLoaded(md);
    assert.equal(r.purpose, "Summarize docs");
    assert.equal(r.targetModel, "gpt-4");
    assert.deepEqual(r.variables, ["lang", "tone"]);
  });

  it("parses single-quoted purpose", () => {
    const md = `---
purpose: 'Say "hello"'
---

Body`;
    const r = parsePromptingLoaded(md);
    assert.equal(r.purpose, 'Say "hello"');
    assert.equal(r.content.trim(), "Body");
  });
});
