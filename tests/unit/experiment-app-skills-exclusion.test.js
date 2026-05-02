const { test } = require("node:test");
const assert = require("node:assert/strict");
const ToolCallHandler = require("../../lib/tool-call-handler.js");

const APP_SKILL_BUILTINS = [
  "review_run",
  "pentest_scan",
  "pentest_scan_folder",
  "builder_score",
];

test("EXPERIMENT_ALLOWED_BUILTINS excludes app-skill builtins (§5.4)", () => {
  const allow = ToolCallHandler.EXPERIMENT_ALLOWED_BUILTINS;
  assert.ok(allow instanceof Set);
  for (const name of APP_SKILL_BUILTINS) {
    assert.equal(
      allow.has(name),
      false,
      `${name} must not be in experiment allowlist`,
    );
  }
  assert.equal(allow.has("write_file"), true);
});
