const { test } = require("node:test");
const assert = require("node:assert");
const {
  normalizeMacCodesignIdentity,
} = require("../../lib/mac-codesign-identity.js");

test("normalizeMacCodesignIdentity returns empty for missing/blank", () => {
  assert.strictEqual(normalizeMacCodesignIdentity(), "");
  assert.strictEqual(normalizeMacCodesignIdentity(null), "");
  assert.strictEqual(normalizeMacCodesignIdentity(""), "");
  assert.strictEqual(normalizeMacCodesignIdentity("   "), "");
});

test("normalizeMacCodesignIdentity strips Developer ID Application prefix", () => {
  assert.strictEqual(
    normalizeMacCodesignIdentity(
      "Developer ID Application: Example Corp (TEAMID)",
    ),
    "Example Corp (TEAMID)",
  );
  assert.strictEqual(
    normalizeMacCodesignIdentity(
      "developer id application:   Example Corp (TEAMID)",
    ),
    "Example Corp (TEAMID)",
  );
});

test("normalizeMacCodesignIdentity leaves already-short names unchanged", () => {
  assert.strictEqual(
    normalizeMacCodesignIdentity("Example Corp (TEAMID)"),
    "Example Corp (TEAMID)",
  );
});
