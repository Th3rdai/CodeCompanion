const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");

let parsePlannerLoaded;
before(async () => {
  ({ parsePlannerLoaded } =
    await import("../../src/lib/planner-parse-loaded.js"));
});

describe("parsePlannerLoaded", () => {
  it("parses UPDATEPLAN-style: H1, preamble Goal:, unknown ## then implementation", () => {
    const md = `# 👑 UPDATEPLANV20: Comprehensive System Specification

Goal: To wrap the core TradingAgents engine in a secure dashboard.

## 💻 Core Architecture

Three-tier stack in docker-compose.

## Implementation Steps

1. Scaffold API
2. Wire Ollama
`;

    const r = parsePlannerLoaded(md);
    assert.equal(
      r.planName,
      "👑 UPDATEPLANV20: Comprehensive System Specification",
    );
    assert.match(r.goal, /wrap the core TradingAgents/);
    assert.match(r.steps, /Three-tier stack/);
    assert.match(r.steps, /Scaffold API/);
    assert.ok(r.steps.indexOf("Three-tier") < r.steps.indexOf("Scaffold"));
  });

  it("does not route Architecture overview into Goal", () => {
    const md = `# Title

## Architecture overview

Not the goal field.

## Goal

Real goal body.
`;
    const r = parsePlannerLoaded(md);
    assert.equal(r.goal, "Real goal body.");
    assert.match(r.steps, /Architecture overview/);
  });

  it("parses YAML title and CRLF frontmatter", () => {
    const md = `---\r\ntitle: "My Plan"\r\ndescription: From YAML\r\n---\r\n\r\n# File H1\r\n\r\n## Scope\r\nIn only\r\n`;
    const r = parsePlannerLoaded(md);
    assert.equal(r.planName, "My Plan");
    assert.equal(r.goal, "From YAML");
    assert.equal(r.scope, "In only");
  });

  it("parses YAML title with single quotes", () => {
    const md = `---
title: 'Plan "B"'
description: 'Goal: win'
---

# Ignored H1

## Scope

S
`;
    const r = parsePlannerLoaded(md);
    assert.equal(r.planName, 'Plan "B"');
    assert.equal(r.goal, "Goal: win");
    assert.equal(r.scope.trim(), "S");
  });

  it("handles file starting with ## (no leading newline)", () => {
    const md = `## Implementation Steps

- one
- two`;
    const r = parsePlannerLoaded(md);
    assert.match(r.steps, /one/);
  });

  it("parses H1 without space after hash", () => {
    const md = `#NoSpaceTitle

Goal: G

## Scope

S
`;
    const r = parsePlannerLoaded(md);
    assert.equal(r.planName, "NoSpaceTitle");
    assert.equal(r.goal, "G");
    assert.equal(r.scope, "S");
  });

  it("returns empty shape for null", () => {
    const r = parsePlannerLoaded(null);
    assert.equal(r.planName, "");
    assert.equal(r.steps, "");
  });
});
