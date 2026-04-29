const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  extractValidationCommands,
  buildValidateReviewContext,
  resolveValidateSearchRoots,
  loadValidateReviewContext,
} = require("../../lib/review-validate-context");

const SAMPLE_VALIDATE = `---
description: Project-specific validation
---

## Phase 1: Linting
\`npm run lint\`

## Phase 2: Type Checking
\`npm run typecheck\`

## Summary
\`\`\`bash
# Canonical local validation command (all phases in one line)
npm run lint && npm run typecheck
\`\`\`
`;

describe("review validate context parsing", () => {
  it("extracts phase commands and canonical command", () => {
    const parsed = extractValidationCommands(SAMPLE_VALIDATE);
    assert.equal(parsed.phaseCommands.length, 2);
    assert.equal(parsed.phaseCommands[0].command, "npm run lint");
    assert.equal(parsed.phaseCommands[1].command, "npm run typecheck");
    assert.equal(parsed.canonicalCommand, "npm run lint && npm run typecheck");
  });

  it("builds compact review context text from validate markdown", () => {
    const context = buildValidateReviewContext(
      SAMPLE_VALIDATE,
      ".cursor/prompts/validate.md",
    );
    assert.ok(context.includes("Validation policy source"));
    assert.ok(context.includes("Phase 1"));
    assert.ok(context.includes("npm run lint"));
    assert.ok(context.includes("Canonical all-phases command"));
  });
});

describe("loadValidateReviewContext", () => {
  it("loads first available validate.md candidate under project folder", () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "cc-validate-"));
    fs.mkdirSync(path.join(project, ".cursor", "prompts"), { recursive: true });
    fs.writeFileSync(
      path.join(project, ".cursor", "prompts", "validate.md"),
      SAMPLE_VALIDATE,
      "utf8",
    );

    const loaded = loadValidateReviewContext(project);
    assert.ok(loaded);
    assert.equal(loaded.sourcePath, ".cursor/prompts/validate.md");
    assert.ok(loaded.context.includes("npm run lint"));

    fs.rmSync(project, { recursive: true, force: true });
  });

  it("returns null when validate files are unavailable", () => {
    const project = fs.mkdtempSync(
      path.join(os.tmpdir(), "cc-validate-empty-"),
    );
    const loaded = loadValidateReviewContext(project);
    assert.equal(loaded, null);
    fs.rmSync(project, { recursive: true, force: true });
  });

  it("prefers nearest ancestor validate.md from reviewed path", () => {
    const project = fs.mkdtempSync(
      path.join(os.tmpdir(), "cc-validate-nearest-"),
    );
    fs.mkdirSync(path.join(project, "apps", "web"), { recursive: true });
    fs.writeFileSync(
      path.join(project, "apps", "web", "validate.md"),
      SAMPLE_VALIDATE,
      "utf8",
    );
    fs.writeFileSync(
      path.join(project, "validate.md"),
      SAMPLE_VALIDATE,
      "utf8",
    );

    const loaded = loadValidateReviewContext(project, {
      searchFrom: path.join(project, "apps", "web", "src", "index.js"),
    });
    assert.ok(loaded);
    assert.equal(loaded.sourcePath, "apps/web/validate.md");

    fs.rmSync(project, { recursive: true, force: true });
  });
});

describe("resolveValidateSearchRoots", () => {
  it("builds descending search roots from reviewed path back to project root", () => {
    const project = path.join(os.tmpdir(), "cc-review-root");
    const roots = resolveValidateSearchRoots(
      project,
      path.join(project, "apps", "api", "src", "service.js"),
    );
    assert.equal(
      roots[0],
      path.join(project, "apps", "api", "src"),
      "nearest directory should be first",
    );
    assert.equal(roots[roots.length - 1], path.resolve(project));
  });

  it("ignores searchFrom paths outside the project boundary", () => {
    const project = path.join(os.tmpdir(), "cc-review-root-2");
    const roots = resolveValidateSearchRoots(project, "/etc/passwd");
    assert.equal(roots.length, 1);
    assert.equal(roots[0], path.resolve(project));
  });
});
