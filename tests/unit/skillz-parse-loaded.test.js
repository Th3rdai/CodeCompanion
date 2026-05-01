const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");

let parseSkillzLoaded;
before(async () => {
  ({ parseSkillzLoaded } =
    await import("../../src/lib/skillz-parse-loaded.js"));
});

describe("parseSkillzLoaded", () => {
  it("reads YAML name/description via scalar parser (single quotes)", () => {
    const md = `---
name: 'my-skill'
description: 'One line'
---

## Instructions

Body
`;
    const r = parseSkillzLoaded(md);
    assert.equal(r.skillName, "my-skill");
    assert.equal(r.description, "One line");
    assert.match(r.instructions, /Body/);
  });

  it("reads YAML name/description with CRLF and ## Instructions", () => {
    const md = `---\r\nname: my-skill\r\ndescription: From YAML\r\n---\r\n\r\n# Display Name\r\n\r\n## Instructions\r\nDo the thing.\r\n`;
    const r = parseSkillzLoaded(md);
    assert.equal(r.skillName, "my-skill");
    assert.equal(r.description, "From YAML");
    assert.equal(r.instructions, "Do the thing.");
  });

  it("uses preamble as description when ## Instructions follows", () => {
    const md = `# Cool Skill

One-line summary.

## Instructions

Step one.
`;
    const r = parseSkillzLoaded(md);
    assert.equal(r.skillName, "Cool Skill");
    assert.equal(r.description.trim(), "One-line summary.");
    assert.match(r.instructions, /Step one/);
  });

  it("parses # title without space after hash", () => {
    const md = `#NoSpace

## Instructions

Body
`;
    const r = parseSkillzLoaded(md);
    assert.equal(r.skillName, "NoSpace");
    assert.equal(r.instructions.trim(), "Body");
  });

  it("handles body starting with ## (no leading newline)", () => {
    const md = `## Instructions

Only section
`;
    const r = parseSkillzLoaded(md);
    assert.equal(r.instructions.trim(), "Only section");
  });

  it("routes Input Pattern / Output Format / Example before loose instruction match", () => {
    const md = `# S

## Input Pattern

IP

## Output Format

OF

## Example Usage

EX

## Instructions

IN
`;
    const r = parseSkillzLoaded(md);
    assert.equal(r.inputPattern.trim(), "IP");
    assert.equal(r.outputFormat.trim(), "OF");
    assert.equal(r.exampleUsage.trim(), "EX");
    assert.equal(r.instructions.trim(), "IN");
  });

  it("merges unknown ## sections into instructions with explicit Instructions last", () => {
    const md = `# X

Tagline here.

## When to use

When debugging.

## Instructions

Core steps.
`;
    const r = parseSkillzLoaded(md);
    assert.match(r.description, /Tagline here/);
    assert.ok(r.instructions.includes("When debugging"));
    assert.match(r.instructions, /Core steps/);
    assert.ok(
      r.instructions.indexOf("When debugging") <
        r.instructions.indexOf("Core steps"),
    );
  });

  it("single-chunk doc: one preamble block becomes description (no ##)", () => {
    const md = `# S

Only intro text with no section headings.
`;
    const r = parseSkillzLoaded(md);
    assert.match(r.description, /Only intro/);
  });

  it("returns empty shape for null", () => {
    const r = parseSkillzLoaded(null);
    assert.equal(r.skillName, "");
    assert.equal(r.instructions, "");
  });
});
