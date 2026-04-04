const { test } = require("node:test");
const assert = require("node:assert");
const {
  getBuiltinSafetyPreamble,
} = require("../../lib/builtin-agent-tools.js");

test("getBuiltinSafetyPreamble omits terminal block when includeTerminal is false", () => {
  const p = getBuiltinSafetyPreamble({ includeTerminal: false });
  assert.ok(p.includes("BUILTIN TOOL INSTRUCTIONS"), "expected core preamble");
  assert.ok(
    !p.includes("TERMINAL TOOL SAFETY"),
    "must not include terminal section",
  );
});

test("getBuiltinSafetyPreamble omits terminal block when options omitted (default)", () => {
  const p = getBuiltinSafetyPreamble();
  assert.ok(!p.includes("TERMINAL TOOL SAFETY"));
});

test("getBuiltinSafetyPreamble includes terminal block when includeTerminal is true", () => {
  const p = getBuiltinSafetyPreamble({ includeTerminal: true });
  assert.ok(p.includes("TERMINAL TOOL SAFETY (builtin.run_terminal_cmd)"));
  assert.ok(p.includes("Prefer read-only commands first"));
});
