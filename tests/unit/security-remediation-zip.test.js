const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");

let sec;
before(async () => {
  sec = await import("../../src/lib/security-remediation-zip.js");
});

describe("security-remediation-zip", () => {
  it("parseRemediationFileBlocks accepts CRLF after FILE marker", () => {
    const section =
      "---FILE: src/a.js---\r\nfixed\r\n---END_FILE---\r\n---FILE: b.ts---\r\nok\r\n---END_FILE---";
    const r = sec.parseRemediationFileBlocks(section);
    assert.equal(r.length, 2);
    assert.equal(r[0].path, "src/a.js");
    assert.equal(r[0].content, "fixed");
    assert.equal(r[1].path, "b.ts");
    assert.equal(r[1].content, "ok");
  });

  it("parseRemediationFileBlocks accepts LF-only", () => {
    const section = "---FILE: x.js---\nline1\n---END_FILE---";
    const r = sec.parseRemediationFileBlocks(section);
    assert.equal(r.length, 1);
    assert.equal(r[0].content, "line1");
  });

  it("parseMarkdownCodeFences accepts CRLF after fence", () => {
    const md = "Intro\r\n```js\r\nconst x = 1\r\n```\r\n";
    const r = sec.parseMarkdownCodeFences(md);
    assert.equal(r.length, 1);
    assert.match(r[0].content, /const x = 1/);
  });

  it("parseOriginalMultiFileBlocks strips CR from path line", () => {
    const code = "── File: app/foo.js ──\r\nconst y = 2\r\n";
    const r = sec.parseOriginalMultiFileBlocks(code);
    assert.ok(r);
    assert.equal(r[0].path, "app/foo.js");
    assert.match(r[0].content, /const y = 2/);
  });
});
