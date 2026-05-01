const { test } = require("node:test");
const assert = require("node:assert");
const { _migrate } = require("../../lib/experiment-store.js");
const { ExperimentRecordSchema } = require("../../lib/experiment-schema.js");

const NOW = "2025-01-01T00:00:00.000Z";

const baseV1 = {
  id: "abc-123",
  createdAt: NOW,
  updatedAt: NOW,
  hypothesis: "tests fail because deps not installed",
  maxRounds: 8,
  conversationId: null,
  projectFolder: "/tmp/proj",
  steps: [
    { at: NOW, role: "assistant", summary: "raw text 1", metric: null },
    { at: NOW, role: "assistant", summary: "raw text 2", metric: null },
  ],
  messageCountAtStart: 0,
};

const cfgWithAllowlist = {
  agentTerminal: { allowlist: ["python3", "uv", "pytest"] },
};

test("_migrate: v1.6.22 record with status:active", () => {
  const input = { ...baseV1, status: "active" };
  const out = _migrate(input, cfgWithAllowlist);
  assert.equal(out.status, "active");
  assert.deepEqual(out.scope, {
    paths: ["/tmp/proj"],
    commands: ["python3", "uv", "pytest"],
  });
  assert.equal(out.metric, null);
  assert.equal(out.denials, 0);
  assert.equal(out.messageCountAtStart, 0);
  assert.equal(out.finalMetricValue, null);
  assert.equal(out.promptHash, null);
  assert.equal(out.steps.length, 2);
  assert.equal(out.steps[0].did, null);
  assert.equal(out.steps[0].done, false);
  assert.deepEqual(out.steps[0].denials, []);
  assert.doesNotThrow(() => ExperimentRecordSchema.parse(out));
});

test("_migrate: v1.6.22 record with status:timeout and endedAt", () => {
  const input = {
    ...baseV1,
    status: "timeout",
    endedAt: "2025-01-01T00:15:00.000Z",
  };
  const out = _migrate(input, cfgWithAllowlist);
  assert.equal(out.status, "timeout");
  assert.equal(out.endedAt, "2025-01-01T00:15:00.000Z");
  assert.doesNotThrow(() => ExperimentRecordSchema.parse(out));
});

test("_migrate: v1.6.22 record with NO status field", () => {
  const input = { ...baseV1 };
  delete input.status;
  const out = _migrate(input, cfgWithAllowlist);
  assert.equal(out.status, "active");
  assert.equal(out.endedAt, null);
  assert.doesNotThrow(() => ExperimentRecordSchema.parse(out));
});

test("_migrate: NO status, BUT endedAt set → infers timeout", () => {
  const input = { ...baseV1, endedAt: "2025-01-01T00:30:00.000Z" };
  delete input.status;
  const out = _migrate(input, cfgWithAllowlist);
  assert.equal(out.status, "timeout");
});

test("_migrate: missing scope falls back to project folder + global allowlist", () => {
  const input = { ...baseV1, status: "active" };
  delete input.projectFolder;
  const cfg = {
    projectFolder: "/cfg/project",
    agentTerminal: { allowlist: ["bash"] },
  };
  const out = _migrate(input, cfg);
  assert.deepEqual(out.scope, {
    paths: ["/cfg/project"],
    commands: ["bash"],
  });
});

test("_migrate: empty config defaults to empty scope rather than wide-open", () => {
  const input = { ...baseV1, status: "active" };
  delete input.projectFolder;
  const out = _migrate(input, {});
  assert.deepEqual(out.scope.paths, []);
  assert.deepEqual(out.scope.commands, []);
});

test("_migrate: existing scope is preserved", () => {
  const input = {
    ...baseV1,
    status: "active",
    scope: { paths: ["/already/set"], commands: ["custom"] },
  };
  const out = _migrate(input, cfgWithAllowlist);
  assert.deepEqual(out.scope, {
    paths: ["/already/set"],
    commands: ["custom"],
  });
});

test("_migrate: legacy step.metric: null normalized; new fields default", () => {
  const input = {
    ...baseV1,
    status: "active",
    steps: [
      {
        at: NOW,
        role: "assistant",
        summary: "x",
        metric: null,
      },
    ],
  };
  const out = _migrate(input, cfgWithAllowlist);
  assert.equal(out.steps[0].did, null);
  assert.equal(out.steps[0].observed, null);
  assert.equal(out.steps[0].next, null);
  assert.equal(out.steps[0].done, false);
  assert.equal(out.steps[0].decision, null);
  assert.deepEqual(out.steps[0].denials, []);
  assert.equal(out.steps[0].metric, null);
});
