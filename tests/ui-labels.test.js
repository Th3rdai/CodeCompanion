const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

describe("UI Label Validation", () => {
  let modes = [];

  it("should parse MODES from App.jsx", () => {
    const appContent = fs.readFileSync(
      path.join(__dirname, "../src/App.jsx"),
      "utf-8",
    );
    const modesMatch = appContent.match(/const MODES = \[([\s\S]*?)\];/);
    assert.ok(modesMatch, "MODES array not found in App.jsx");

    // Extract mode objects (Prettier may use single or double quotes; placeholder may break across lines)
    const modesText = modesMatch[1];
    const modeRegex =
      /\{\s*id:\s*['"]([^'"]+)['"],\s*label:\s*['"]([^'"]+)['"],[\s\S]*?placeholder:\s*(?:\n\s*)?["']([^"']*)["']/g;
    let match;
    while ((match = modeRegex.exec(modesText)) !== null) {
      modes.push({ id: match[1], label: match[2], placeholder: match[3] });
    }
    assert.ok(modes.length > 0, "No modes parsed from MODES array");
    console.log(`Parsed ${modes.length} modes from App.jsx`);
  });

  it("should not contain jargon in labels", () => {
    const JARGON_TERMS = ["tech", "biz", "api", "deploy"];
    for (const mode of modes) {
      const lower = mode.label.toLowerCase();
      for (const term of JARGON_TERMS) {
        assert.ok(
          !lower.includes(term),
          `${mode.id} label "${mode.label}" contains jargon: "${term}"`,
        );
      }
    }
  });

  it("should not contain PM language in placeholders", () => {
    const PM_TERMS = ["dev team", "stakeholder", "leadership"];
    for (const mode of modes) {
      const lower = mode.placeholder.toLowerCase();
      for (const term of PM_TERMS) {
        assert.ok(
          !lower.includes(term),
          `${mode.id} placeholder contains PM term: "${term}"`,
        );
      }
    }
  });

  it("should have verb-led or transformation-clear labels", () => {
    // Action verbs commonly used in UI
    const ACTION_VERBS = [
      "chat",
      "explain",
      "check",
      "clean",
      "review",
      "create",
      "diagram",
      "security",
      "validate",
      "prompt",
      "skill",
      "agent",
      "plan",
      "build",
      "terminal",
      "experiment",
      "try",
      "test",
      "run",
    ];

    for (const mode of modes) {
      const label = mode.label.toLowerCase();
      const hasVerb = ACTION_VERBS.some((verb) => label.includes(verb));
      const hasArrow = mode.label.includes("→");

      assert.ok(
        hasVerb || hasArrow,
        `${mode.id} label "${mode.label}" should either start with action verb or show transformation (→)`,
      );
    }
  });

  it("should have vibe-coder appropriate placeholders", () => {
    // Ensure placeholders are friendly and direct, not corporate/PM-speak (modes with copy only)
    for (const mode of modes) {
      const placeholder = mode.placeholder.toLowerCase();
      if (placeholder.trim().length <= 10) continue;

      // Should not contain corporate/formal language
      const CORPORATE_TERMS = [
        "stakeholder",
        "leadership",
        "enterprise",
        "deliverable",
      ];
      for (const term of CORPORATE_TERMS) {
        assert.ok(
          !placeholder.includes(term),
          `${mode.id} placeholder contains corporate term: "${term}"`,
        );
      }

      // Should be reasonably concise (not marketing copy)
      assert.ok(
        placeholder.length > 10,
        `${mode.id} placeholder is too short (empty or placeholder text)`,
      );
    }
  });
});
