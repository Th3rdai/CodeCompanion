/**
 * tests/unit/terminal-audit.test.js
 *
 * Unit tests for lib/terminal-audit.js — append-only JSON-line audit log
 * for the agent terminal builtin tool.
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  auditTerminalEvent,
  resolveLogPath,
  _resetForTests,
} = require("../../lib/terminal-audit");

function freshTmpRoot(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `cc-audit-${label}-`));
  process.env.CC_DATA_DIR = dir;
  _resetForTests();
  return dir;
}

function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.length > 0);
}

// Force a clean stream after the test suite for the next module that uses it
test.after(() => {
  delete process.env.CC_DATA_DIR;
  _resetForTests();
});

test("resolveLogPath honors CC_DATA_DIR", () => {
  const root = freshTmpRoot("resolve");
  assert.strictEqual(
    resolveLogPath(),
    path.join(root, "logs", "terminal-audit.log"),
  );
});

test("auditTerminalEvent creates logs/terminal-audit.log under CC_DATA_DIR", () => {
  const root = freshTmpRoot("create");
  auditTerminalEvent({ event: "executed", command: "node", exitCode: 0 });
  const logFile = path.join(root, "logs", "terminal-audit.log");
  // Allow the writeStream to flush
  return new Promise((resolve) => {
    setTimeout(() => {
      assert.ok(fs.existsSync(logFile), "audit log file should exist");
      const lines = readLines(logFile);
      assert.strictEqual(lines.length, 1);
      const entry = JSON.parse(lines[0]);
      assert.strictEqual(entry.event, "executed");
      assert.strictEqual(entry.command, "node");
      assert.strictEqual(entry.exitCode, 0);
      assert.match(entry.ts, /^\d{4}-\d{2}-\d{2}T/);
      resolve();
    }, 50);
  });
});

test("auditTerminalEvent appends multiple events as separate JSON lines", async () => {
  const root = freshTmpRoot("append");
  auditTerminalEvent({ event: "denied", denyType: "allowlist", command: "rm" });
  auditTerminalEvent({ event: "executed", command: "ls", exitCode: 0 });
  auditTerminalEvent({
    event: "spawn-error",
    command: "nonexistent",
    error: "ENOENT",
  });
  const logFile = path.join(root, "logs", "terminal-audit.log");
  const deadline = Date.now() + 5000;
  let lines = [];
  while (Date.now() < deadline) {
    lines = readLines(logFile);
    if (lines.length >= 3) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.strictEqual(lines.length, 3);
  const events = lines.map((l) => JSON.parse(l).event);
  assert.deepStrictEqual(events, ["denied", "executed", "spawn-error"]);
});

test("auditTerminalEvent never throws on bad input", () => {
  freshTmpRoot("badinput");
  // Circular references would throw on JSON.stringify; the audit must swallow
  const circular = {};
  circular.self = circular;
  assert.doesNotThrow(() => {
    auditTerminalEvent({ event: "executed", payload: circular });
  });
});

test("auditTerminalEvent reopens stream after CC_DATA_DIR rotation", () => {
  const a = freshTmpRoot("rotate-a");
  auditTerminalEvent({ event: "executed", command: "ls" });
  const b = freshTmpRoot("rotate-b");
  auditTerminalEvent({ event: "executed", command: "pwd" });
  return new Promise((resolve) => {
    setTimeout(() => {
      const linesA = readLines(path.join(a, "logs", "terminal-audit.log"));
      const linesB = readLines(path.join(b, "logs", "terminal-audit.log"));
      assert.strictEqual(linesA.length, 1);
      assert.strictEqual(linesB.length, 1);
      assert.strictEqual(JSON.parse(linesA[0]).command, "ls");
      assert.strictEqual(JSON.parse(linesB[0]).command, "pwd");
      resolve();
    }, 50);
  });
});
