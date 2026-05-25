/**
 * Regression test for the 2026-05-25 follow-up: a pinned weak/slow local model
 * grinding many rounds in chat before giving up.
 *
 * The slow-model self-heal (per-round soft timeout → switch to a faster
 * tool-capable model) was auto-only, so an EXPLICITLY PINNED model never tripped
 * it. resolvePinnedSlowSwitchTarget() decides whether a pinned model should be
 * switched — gated so a local-only, single-model user is never opted in (which
 * would turn a slow turn into a timeout error rather than a graceful switch).
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  resolvePinnedSlowSwitchTarget,
} = require("../../lib/chat-post-handler");

const base = {
  model: "qwen3-32k:latest",
  wasAutoResolved: false,
  slowModelSwitchSec: 90,
  probeResolved: "kimi-k2:1t-cloud",
  installedNames: ["qwen3-32k:latest", "kimi-k2:1t-cloud", "llama3.1:8b"],
};

test("pinned slow-switch: returns target when a different installed model exists", () => {
  assert.equal(resolvePinnedSlowSwitchTarget(base), "kimi-k2:1t-cloud");
});

test("pinned slow-switch: auto-resolved models are left to the existing auto path", () => {
  assert.equal(
    resolvePinnedSlowSwitchTarget({ ...base, wasAutoResolved: true }),
    null,
  );
});

test("pinned slow-switch: disabled when slowModelSwitchSec is 0", () => {
  assert.equal(
    resolvePinnedSlowSwitchTarget({ ...base, slowModelSwitchSec: 0 }),
    null,
  );
});

test("pinned slow-switch: cloud-pinned models are not switched (already fast)", () => {
  assert.equal(
    resolvePinnedSlowSwitchTarget({ ...base, model: "glm-4.6:cloud" }),
    null,
  );
});

test("pinned slow-switch: no target when probe resolves to the same model", () => {
  assert.equal(
    resolvePinnedSlowSwitchTarget({
      ...base,
      probeResolved: "qwen3-32k:latest",
    }),
    null,
  );
});

test("pinned slow-switch: REGRESSION GUARD — uninstalled candidate yields no switch", () => {
  // The local-only, single-model case: probe falls back to a default cloud name
  // that isn't actually installed. Must NOT switch (else we'd cap the round
  // timeout and error a user who has nowhere to switch to).
  assert.equal(
    resolvePinnedSlowSwitchTarget({
      ...base,
      probeResolved: "kimi-k2:1t-cloud",
      installedNames: ["qwen3-32k:latest"],
    }),
    null,
  );
});

test("pinned slow-switch: no target when probe returned nothing", () => {
  assert.equal(
    resolvePinnedSlowSwitchTarget({ ...base, probeResolved: null }),
    null,
  );
  assert.equal(
    resolvePinnedSlowSwitchTarget({ ...base, installedNames: undefined }),
    null,
  );
});
