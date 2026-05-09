const { test } = require("node:test");
const assert = require("node:assert");
const {
  getHostTimeSnapshot,
  formatHostTimeForPrompt,
} = require("../../lib/host-time.js");

test("getHostTimeSnapshot returns stable shape for fixed Date", () => {
  const fixed = new Date("2026-05-09T15:30:00.000Z");
  const s = getHostTimeSnapshot({ now: fixed });
  assert.strictEqual(s.iso, "2026-05-09T15:30:00.000Z");
  assert.strictEqual(s.unixMs, fixed.getTime());
  assert.strictEqual(typeof s.timezone, "string");
  assert.strictEqual(typeof s.offsetMinutesFromUtc, "number");
  assert.strictEqual(s.offsetMinutesFromUtc, -fixed.getTimezoneOffset());
  assert.strictEqual(typeof s.localeString, "string");
});

test("getHostTimeSnapshot default uses current time", () => {
  const before = Date.now();
  const s = getHostTimeSnapshot();
  const after = Date.now();
  assert.ok(s.unixMs >= before && s.unixMs <= after);
  assert.match(s.iso, /^\d{4}-\d{2}-\d{2}T/);
});

test("formatHostTimeForPrompt includes ISO instant and label", () => {
  const fixed = new Date("2026-05-09T15:30:00.000Z");
  const line = formatHostTimeForPrompt({ now: fixed });
  assert.ok(line.startsWith("CURRENT_HOST_TIME:"));
  assert.ok(line.includes("2026-05-09T15:30:00.000Z"));
  assert.ok(line.includes("UTC calendar date"));
});
