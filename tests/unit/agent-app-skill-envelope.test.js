const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  SKILL_ERROR_CODES,
  buildSuccessEnvelope,
  buildErrorEnvelope,
  mapExceptionToSkillError,
  toolDisabledEnvelope,
} = require("../../lib/agent-app-skill-envelope.js");

test("buildSuccessEnvelope report-card shape", () => {
  const e = buildSuccessEnvelope({
    type: "report-card",
    data: { overallGrade: "B" },
    truncated: false,
    model: "m:latest",
    durationMs: 12,
  });
  assert.equal(e.ok, true);
  assert.equal(e.type, "report-card");
  assert.equal(e.truncated, false);
  assert.equal(e.model, "m:latest");
  assert.equal(e.durationMs, 12);
  assert.deepEqual(e.data, { overallGrade: "B" });
  assert.equal("summary" in e, false);
});

test("buildSuccessEnvelope summary shape", () => {
  const e = buildSuccessEnvelope({
    type: "summary",
    summary: "hello",
    truncated: true,
    model: "m:latest",
    durationMs: 50,
  });
  assert.equal(e.ok, true);
  assert.equal(e.type, "summary");
  assert.equal(e.summary, "hello");
  assert.equal(e.truncated, true);
  assert.equal("data" in e, false);
});

test("buildErrorEnvelope has enumerated code", () => {
  const e = buildErrorEnvelope({
    code: SKILL_ERROR_CODES.INVALID_ARGS,
    message: "bad",
    hint: "fix it",
  });
  assert.equal(e.ok, false);
  assert.equal(e.code, "INVALID_ARGS");
  assert.equal(e.message, "bad");
  assert.equal(e.hint, "fix it");
});

test("mapExceptionToSkillError maps path denial", () => {
  const e = mapExceptionToSkillError(
    new Error("Path is outside the configured project folder."),
    {},
  );
  assert.equal(e.ok, false);
  assert.equal(e.code, "PATH_DENIED");
});

test("toolDisabledEnvelope", () => {
  const e = toolDisabledEnvelope("review_run", "Go to Settings.");
  assert.equal(e.code, "TOOL_DISABLED");
  assert.match(e.message, /review_run/);
  assert.equal(e.hint, "Go to Settings.");
});
