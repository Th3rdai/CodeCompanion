const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { enforceExperimentScope } = require("../../lib/builtin-agent-tools.js");

// ── write_file: in-scope ───────────────────────────────────

test("write_file: in-scope path returns null (allowed)", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scope-"));
  const scope = { paths: [tmp], commands: [] };
  const result = enforceExperimentScope({
    tool: "write_file",
    args: { path: "subfile.js" },
    scope,
    projectFolder: tmp,
  });
  assert.equal(result, null);
});

test("write_file: out-of-scope path returns denial with ACTION", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scope-"));
  const scope = { paths: [tmp], commands: [] };
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), "elsewhere-"));
  fs.writeFileSync(path.join(elsewhere, "evil.js"), "x");

  const result = enforceExperimentScope({
    tool: "write_file",
    args: { path: path.join(elsewhere, "evil.js") },
    scope,
    projectFolder: tmp,
  });
  assert.ok(result, "should be denied");
  assert.match(result.denied, /Path outside experiment scope/);
  assert.ok(result.action.length > 0, "ACTION must be non-empty");
  assert.match(result.action, /Choose a path under one of:/);
});

test("write_file: empty scope.paths denies with helpful action", () => {
  const result = enforceExperimentScope({
    tool: "write_file",
    args: { path: "x.js" },
    scope: { paths: [], commands: [] },
  });
  assert.ok(result);
  assert.match(result.action, /scope\.paths/);
});

test("write_file: symlink inside scope pointing outside is rejected", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scope-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "outside-"));
  const target = path.join(outside, "target.txt");
  fs.writeFileSync(target, "secret");
  const symlink = path.join(tmp, "escape");
  try {
    fs.symlinkSync(target, symlink);
  } catch (e) {
    // skip on platforms without symlink permission
    return;
  }
  const scope = { paths: [tmp], commands: [] };
  const result = enforceExperimentScope({
    tool: "write_file",
    args: { path: symlink },
    scope,
    projectFolder: tmp,
  });
  assert.ok(result, "symlink escape should be denied");
  assert.match(result.denied, /Path outside experiment scope/);
});

// ── run_terminal_cmd: in-scope ─────────────────────────────

test("run_terminal_cmd: command in scope returns null", () => {
  const result = enforceExperimentScope({
    tool: "run_terminal_cmd",
    args: { command: "python3", args: ["-V"] },
    scope: { paths: [], commands: ["python3", "uv"] },
  });
  assert.equal(result, null);
});

test("run_terminal_cmd: command not in scope denies with ACTION listing allowed", () => {
  const result = enforceExperimentScope({
    tool: "run_terminal_cmd",
    args: { command: "rm", args: ["-rf", "/"] },
    scope: { paths: [], commands: ["python3", "uv"] },
  });
  assert.ok(result);
  assert.match(result.denied, /not in experiment scope/);
  assert.ok(result.action.length > 0, "ACTION must be non-empty");
  assert.match(result.action, /Choose one of: python3, uv/);
});

test("run_terminal_cmd: empty scope.commands denies with helpful action", () => {
  const result = enforceExperimentScope({
    tool: "run_terminal_cmd",
    args: { command: "ls" },
    scope: { paths: [], commands: [] },
  });
  assert.ok(result);
  assert.match(result.action, /scope\.commands/);
});

test("run_terminal_cmd: extracts basename from args.input fallback", () => {
  const result = enforceExperimentScope({
    tool: "run_terminal_cmd",
    args: { input: "pytest -q tests/" },
    scope: { paths: [], commands: ["pytest"] },
  });
  assert.equal(result, null);
});

test("run_terminal_cmd: strips path prefix from command", () => {
  const result = enforceExperimentScope({
    tool: "run_terminal_cmd",
    args: { command: "/usr/bin/python3" },
    scope: { paths: [], commands: ["python3"] },
  });
  assert.equal(result, null);
});

// ── unrecognized tool / null scope ─────────────────────────

test("unrecognized tool returns null (no-op)", () => {
  const result = enforceExperimentScope({
    tool: "view_pdf_pages",
    args: {},
    scope: { paths: ["/tmp"], commands: [] },
  });
  assert.equal(result, null);
});

test("null scope returns null (no enforcement)", () => {
  const result = enforceExperimentScope({
    tool: "write_file",
    args: { path: "/etc/shadow" },
    scope: null,
  });
  assert.equal(result, null);
});
