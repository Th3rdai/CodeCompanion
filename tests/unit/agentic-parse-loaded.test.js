const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");

let parseAgenticLoaded;
before(async () => {
  ({ parseAgenticLoaded } =
    await import("../../src/lib/agentic-parse-loaded.js"));
});

describe("parseAgenticLoaded", () => {
  it("parses build-style sections and # title without space", () => {
    const md = `#MyAgent

## Purpose

Do things.

## Tools

- **read_file**: Read

## Instructions

Core.

## Workflow

1. Step

## Safety Guardrails

Never X.
`;
    const r = parseAgenticLoaded(md);
    assert.equal(r.agentName, "MyAgent");
    assert.match(r.purpose, /Do things/);
    assert.match(r.tools, /read_file — Read/);
    assert.match(r.instructions, /Core/);
    assert.match(r.workflow, /Step/);
    assert.match(r.guardrails, /Never X/);
  });

  it("merges unknown ## into instructions before explicit Instructions", () => {
    const md = `# A

## Context

Ctx.

## Instructions

Inst.
`;
    const r = parseAgenticLoaded(md);
    assert.ok(r.instructions.includes("Ctx"));
    assert.ok(r.instructions.includes("Inst"));
    assert.ok(r.instructions.indexOf("Ctx") < r.instructions.indexOf("Inst"));
  });

  it("handles leading ## without newline", () => {
    const md = `## Instructions

Only`;
    const r = parseAgenticLoaded(md);
    assert.match(r.instructions, /Only/);
  });

  it("YAML description seeds purpose", () => {
    const md = `---
description: From YAML
---

# T

## Instructions

Body
`;
    const r = parseAgenticLoaded(md);
    assert.equal(r.purpose, "From YAML");
    assert.match(r.instructions, /Body/);
  });

  it("uses YAML name when there is no # title", () => {
    const md = `---
name: yaml-only-agent
description: Why
---

## Instructions

Go.
`;
    const r = parseAgenticLoaded(md);
    assert.equal(r.agentName, "yaml-only-agent");
    assert.equal(r.purpose, "Why");
    assert.match(r.instructions, /Go/);
  });

  it("normalizes plain hyphen tool lines", () => {
    const md = `# A

## Tools

- read_file - Read files
- run_tests — Run all tests

## Instructions

X
`;
    const r = parseAgenticLoaded(md);
    assert.match(r.tools, /read_file — Read files/);
    assert.match(r.tools, /run_tests — Run all tests/);
  });

  it("parses CRLF YAML description", () => {
    const md = `---\r\ndescription: Line one\r\n---\r\n\r\n## Instructions\r\nBody\r\n`;
    const r = parseAgenticLoaded(md);
    assert.equal(r.purpose, "Line one");
    assert.match(r.instructions, /Body/);
  });

  it("## Purpose overrides YAML description", () => {
    const md = `---
description: YAML purpose
---

# A

## Purpose

Section purpose.

## Instructions

I
`;
    const r = parseAgenticLoaded(md);
    assert.match(r.purpose, /Section purpose/);
    assert.ok(!String(r.purpose).includes("YAML purpose"));
  });
});
