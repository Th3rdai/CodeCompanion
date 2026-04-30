const { test } = require("node:test");
const assert = require("node:assert/strict");
const { SYSTEM_PROMPTS, VALID_MODES } = require("../../lib/prompts");

test("SYSTEM_PROMPTS includes experiment mode", () => {
  assert.ok(
    typeof SYSTEM_PROMPTS.experiment === "string",
    "experiment prompt missing",
  );
  assert.ok(SYSTEM_PROMPTS.experiment.includes("success metric"));
  assert.ok(VALID_MODES.includes("experiment"));
});
