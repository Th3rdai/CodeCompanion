const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  initExperimentStore,
  createExperiment,
  getExperiment,
  appendStep,
} = require("../../lib/experiment-store");

test("experiment store create, read, append step", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-exp-"));
  initExperimentStore(root);
  const rec = createExperiment({
    hypothesis: "If X then Y",
    maxRounds: 5,
  });
  assert.ok(rec.id);
  assert.equal(rec.hypothesis, "If X then Y");
  assert.equal(rec.maxRounds, 5);

  const loaded = getExperiment(rec.id);
  assert.equal(loaded.hypothesis, "If X then Y");

  appendStep(rec.id, { summary: "Ran step 1", role: "assistant" });
  const after = getExperiment(rec.id);
  assert.equal(after.steps.length, 1);
  assert.match(after.steps[0].summary, /Ran step 1/);

  fs.rmSync(root, { recursive: true, force: true });
});
