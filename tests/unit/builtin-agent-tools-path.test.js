const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  validateProjectFilePath,
  executeBuiltinTool,
} = require("../../lib/builtin-agent-tools.js");

test("run_terminal_cmd splits multi-token command when args are already present", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-term-split-"));
  const noopLog = () => {};
  const res = await executeBuiltinTool(
    "run_terminal_cmd",
    { command: "node -e", args: ["console.log(33)"] },
    {
      projectFolder: root,
      agentTerminal: {
        enabled: true,
        allowlist: ["node"],
        blocklist: [],
        maxTimeoutSec: 15,
        maxOutputKB: 64,
      },
    },
    noopLog,
  );
  assert.strictEqual(res.success, true, res.result?.content?.[0]?.text);
  assert.match(String(res.result?.content?.[0]?.text || ""), /33/);
});
const { canConvertBuiltin } = require("../../lib/builtin-doc-converter.js");

test("canConvertBuiltin is false for legacy .xls (Docling-only)", () => {
  assert.strictEqual(canConvertBuiltin("data.xls"), false);
  assert.strictEqual(canConvertBuiltin("book.xlsx"), true);
});

test("validateProjectFilePath accepts relative file under project", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-proj-"));
  const sub = path.join(root, "sub");
  fs.mkdirSync(sub);
  const f = path.join(sub, "a.txt");
  fs.writeFileSync(f, "hi");
  const r = validateProjectFilePath("sub/a.txt", root);
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.resolved, fs.realpathSync(f));
});

test("validateProjectFilePath rejects path outside project", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-proj-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "cc-out-"));
  const f = path.join(outside, "x.txt");
  fs.writeFileSync(f, "x");
  const r = validateProjectFilePath(f, root);
  assert.strictEqual(r.valid, false);
});

test("validateProjectFilePath rejects directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-proj-"));
  const sub = path.join(root, "dironly");
  fs.mkdirSync(sub);
  const r = validateProjectFilePath("dironly", root);
  assert.strictEqual(r.valid, false);
});

test("write_file rejects path that escapes chatFolder via parent segments", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-wesc-"));
  const sub = path.join(root, "app");
  fs.mkdirSync(sub, { recursive: true });
  const noopLog = () => {};
  const res = await executeBuiltinTool(
    "write_file",
    { path: "../outside.txt", content: "x" },
    { projectFolder: root, chatFolder: sub },
    noopLog,
  );
  assert.strictEqual(res.success, false);
  assert.match(res.result?.content?.[0]?.text || "", /File Browser folder/i);
});

test("write_file uses chatFolder as relative root when set", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-wroot-"));
  const sub = path.join(root, "app");
  fs.mkdirSync(sub, { recursive: true });
  const noopLog = () => {};
  const res = await executeBuiltinTool(
    "write_file",
    { path: "note.txt", content: "hello" },
    { projectFolder: root, chatFolder: sub },
    noopLog,
  );
  assert.strictEqual(res.success, true, res.result?.content?.[0]?.text);
  assert.ok(fs.existsSync(path.join(sub, "note.txt")));
  assert.ok(!fs.existsSync(path.join(root, "note.txt")));
});

test("validateProjectFilePath resolves relative paths from interactionRoot", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-ipath-"));
  const sub = path.join(root, "nested");
  fs.mkdirSync(sub, { recursive: true });
  const f = path.join(sub, "a.txt");
  fs.writeFileSync(f, "hi");
  const r = validateProjectFilePath("a.txt", root, sub);
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.resolved, fs.realpathSync(f));
});

test("generate_office_file with sourcePath csv writes xlsx without Docling", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-proj-"));
  fs.writeFileSync(path.join(root, "sample.csv"), "Name,Val\na,1\n");
  const outPath = path.join(root, "out.xlsx");
  const noopLog = () => {};
  const res = await executeBuiltinTool(
    "generate_office_file",
    {
      sourcePath: "sample.csv",
      filename: "out.xlsx",
      savePath: outPath,
    },
    { projectFolder: root },
    noopLog,
  );
  assert.strictEqual(res.success, true, res.result?.content?.[0]?.text);
  assert.ok(fs.existsSync(outPath));
  assert.ok(fs.statSync(outPath).size > 100);
});
