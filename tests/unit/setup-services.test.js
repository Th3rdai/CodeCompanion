"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeIntents,
  mapIntentsToConfigBody,
  buildAcquireList,
  getAllowedServiceIds,
} = require("../../lib/setup-services");

test("normalizeIntents drops unknown ids and actions", () => {
  const n = normalizeIntents(
    [
      { id: "memory_toggle", action: "enable" },
      { id: "bogus", action: "enable" },
      { id: "docling_toggle", action: "nope" },
    ],
    { isElectron: false },
  );
  assert.equal(n.length, 1);
  assert.equal(n[0].id, "memory_toggle");
});

test("mapIntentsToConfigBody merges docling and memory", () => {
  const body = mapIntentsToConfigBody(
    [
      { id: "docling_toggle", action: "disable" },
      { id: "memory_toggle", action: "enable" },
    ],
    { isElectron: false },
  );
  assert.equal(body.docling.enabled, false);
  assert.equal(body.memory.enabled, true);
});

test("agent_safety_bundle includes terminal only on Electron", () => {
  const web = mapIntentsToConfigBody(
    [{ id: "agent_safety_bundle", action: "enable" }],
    { isElectron: false },
  );
  assert.equal(web.chatRequireExplicitFileWrites, true);
  assert.equal(web.agentTerminal, undefined);

  const desk = mapIntentsToConfigBody(
    [{ id: "agent_safety_bundle", action: "enable" }],
    { isElectron: true },
  );
  assert.equal(desk.agentTerminal.enabled, false);
  assert.equal(desk.agentTerminal.confirmBeforeRun, true);
});

test("buildAcquireList only for enable and dedupes", () => {
  const acq = buildAcquireList(
    [
      { id: "memory_toggle", action: "enable" },
      { id: "memory_toggle", action: "enable" },
      { id: "memory_toggle", action: "disable" },
    ],
    { isElectron: false },
  );
  assert.equal(acq.length, 1);
  assert.equal(acq[0].id, "memory_toggle");
});

test("getAllowedServiceIds lists catalog for web", () => {
  const ids = getAllowedServiceIds(false);
  assert.ok(ids.includes("mcp_clients"));
  assert.ok(ids.includes("ollama_basics"));
});
