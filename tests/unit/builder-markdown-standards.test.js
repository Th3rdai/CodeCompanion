const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");

let standards;
before(async () => {
  standards = await import("../../src/lib/builder-markdown-standards.js");
});

describe("builder-markdown-standards", () => {
  it("stripLeadingBom removes FEFF", () => {
    assert.equal(standards.stripLeadingBom("\uFEFF# Hi").startsWith("#"), true);
  });

  it("splitYamlFrontmatter handles CRLF", () => {
    const r = standards.splitYamlFrontmatter("---\r\nk: v\r\n---\r\n\r\nBody");
    assert.equal(r.hasFrontmatter, true);
    assert.match(r.frontmatter, /k: v/);
    assert.equal(r.body.trim(), "Body");
  });

  it("extractAtxH1Title supports #Title without space", () => {
    assert.equal(standards.extractAtxH1Title("#NoSpace\n\nx"), "NoSpace");
    assert.equal(standards.extractAtxH1Title("## H2\n"), "");
  });

  it("splitMarkdownH2Sections splits CRLF and leading ##", () => {
    const s = standards.splitMarkdownH2Sections("## A\r\n\r\nb");
    assert.equal(s.length, 2);
    assert.equal(s[1].split(/\r?\n/)[0], "A");
  });

  it("parseH2SectionChunk handles header-only chunk", () => {
    const r = standards.parseH2SectionChunk("TitleOnly");
    assert.equal(r.headerRaw, "TitleOnly");
    assert.equal(r.sectionBody, "");
  });

  it("parseYamlScalarField reads quoted and unquoted keys", () => {
    const fm = `name: my-agent\ndescription: 'Say "hi"'\r\ntarget: "x"`;
    assert.equal(standards.parseYamlScalarField(fm, "name"), "my-agent");
    assert.equal(standards.parseYamlScalarField(fm, "description"), 'Say "hi"');
    assert.equal(standards.parseYamlScalarField(fm, "target"), "x");
  });
});
