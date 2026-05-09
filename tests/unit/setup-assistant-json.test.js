"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  extractFirstJsonObject,
  parseSetupAssistantJson,
} = require("../../lib/setup-assistant-json");

test("extractFirstJsonObject handles prose before JSON", () => {
  const s =
    'Here you go:\n{"intents":[{"id":"memory_toggle","action":"enable"}],"summary":"ok"}\nThanks.';
  const j = extractFirstJsonObject(s);
  assert.ok(j);
  const p = JSON.parse(j);
  assert.equal(p.intents[0].id, "memory_toggle");
});

test("parseSetupAssistantJson strips markdown fences", () => {
  const text = '```json\n{"intents":[],"summary":"x"}\n```';
  const p = parseSetupAssistantJson(text);
  assert.deepEqual(p, { intents: [], summary: "x" });
});

test("parseSetupAssistantJson returns null on invalid", () => {
  assert.equal(parseSetupAssistantJson("not json"), null);
});
