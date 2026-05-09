const { test } = require("node:test");
const assert = require("node:assert");
const {
  createMcpJsonSchemaValidator,
} = require("../../lib/mcp-client-manager");

test("createMcpJsonSchemaValidator stubs missing $defs for dangling $ref", () => {
  const warnings = [];
  const v = createMcpJsonSchemaValidator((level, msg, data) => {
    if (level === "WARN") warnings.push({ msg, data });
  });
  const badSchema = {
    type: "object",
    properties: {
      screen: { $ref: "#/$defs/ScreenInstance" },
    },
  };
  const validate = v.getValidator(badSchema);
  assert.equal(typeof validate, "function");
  assert.equal(warnings.length, 0, "should compile after stubbing ScreenInstance");
  const ok = validate({ screen: { any: "value" } });
  assert.equal(ok.valid, true);
});

test("createMcpJsonSchemaValidator still passthrough when schema is unsalvageable", () => {
  const warnings = [];
  const v = createMcpJsonSchemaValidator((level, msg, data) => {
    if (level === "WARN") warnings.push({ msg, data });
  });
  const validate = v.getValidator({ type: "object", required: 42 });
  assert.equal(typeof validate, "function");
  assert.ok(warnings.length >= 1);
  const ok = validate({ x: 1 });
  assert.equal(ok.valid, true);
});
