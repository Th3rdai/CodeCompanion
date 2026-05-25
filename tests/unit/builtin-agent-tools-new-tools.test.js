/**
 * Unit tests for the builtin agent tools added to close tool gaps:
 * search_files, find_files, edit_file, move_file, delete_file, fetch_url.
 *
 * Exercised through the public executeBuiltinTool dispatch (so the routing and
 * the per-tool path-boundary checks are both covered). Path security: every
 * write-class tool must stay under config.projectFolder / the File Browser root.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { executeBuiltinTool } = require("../../lib/builtin-agent-tools");

const log = () => {};
const text = (res) => res.result.content[0].text;

function setup() {
  // realpathSync so the configured path matches what fs returns on macOS
  // (/var → /private/var), keeping the lexical boundary checks consistent.
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cc-tools-")));
}
const cfg = (dir) => ({ projectFolder: dir, chatFolder: dir });

test("search_files: finds content matches with file:line", async () => {
  const dir = setup();
  fs.writeFileSync(
    path.join(dir, "a.js"),
    "const x = 1;\n// TODO: fix\nconst y = 2;\n",
  );
  fs.mkdirSync(path.join(dir, "sub"));
  fs.writeFileSync(path.join(dir, "sub", "b.js"), "function TODOthing() {}\n");
  const res = await executeBuiltinTool(
    "search_files",
    { query: "TODO" },
    cfg(dir),
    log,
  );
  assert.equal(res.success, true);
  assert.match(text(res), /a\.js:2:/);
  assert.match(text(res), /sub\/b\.js:1:/);
});

test("search_files: regex + caseSensitive", async () => {
  const dir = setup();
  fs.writeFileSync(path.join(dir, "a.txt"), "Foo\nfoo\nBAR\n");
  const res = await executeBuiltinTool(
    "search_files",
    { query: "^foo$", regex: true, caseSensitive: true },
    cfg(dir),
    log,
  );
  assert.match(text(res), /a\.txt:2:/);
  assert.doesNotMatch(text(res), /a\.txt:1:/);
});

test("search_files: no matches returns success", async () => {
  const dir = setup();
  fs.writeFileSync(path.join(dir, "a.txt"), "nothing here\n");
  const res = await executeBuiltinTool(
    "search_files",
    { query: "zzz" },
    cfg(dir),
    log,
  );
  assert.equal(res.success, true);
  assert.match(text(res), /No matches/);
});

test("find_files: glob matches recursively, excludes non-matches", async () => {
  const dir = setup();
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src", "app.test.js"), "");
  fs.writeFileSync(path.join(dir, "src", "widget.jsx"), "");
  fs.writeFileSync(path.join(dir, "readme.md"), "");
  const r1 = await executeBuiltinTool(
    "find_files",
    { pattern: "**/*.test.js" },
    cfg(dir),
    log,
  );
  assert.match(text(r1), /src\/app\.test\.js/);
  assert.doesNotMatch(text(r1), /widget\.jsx/);
  const r2 = await executeBuiltinTool(
    "find_files",
    { pattern: "*.md" },
    cfg(dir),
    log,
  );
  assert.match(text(r2), /readme\.md/);
});

test("find_files: skips node_modules", async () => {
  const dir = setup();
  fs.mkdirSync(path.join(dir, "node_modules", "pkg"), { recursive: true });
  fs.writeFileSync(path.join(dir, "node_modules", "pkg", "index.js"), "");
  fs.writeFileSync(path.join(dir, "real.js"), "");
  const res = await executeBuiltinTool(
    "find_files",
    { pattern: "**/*.js" },
    cfg(dir),
    log,
  );
  assert.match(text(res), /real\.js/);
  assert.doesNotMatch(text(res), /node_modules/);
});

test("edit_file: replace (unique) creates backup and replaces", async () => {
  const dir = setup();
  const f = path.join(dir, "code.js");
  fs.writeFileSync(f, "let a = 1;\nlet b = 2;\n");
  const res = await executeBuiltinTool(
    "edit_file",
    { path: "code.js", oldText: "let a = 1;", newText: "let a = 42;" },
    cfg(dir),
    log,
  );
  assert.equal(res.success, true, text(res));
  assert.equal(fs.readFileSync(f, "utf8"), "let a = 42;\nlet b = 2;\n");
  assert.ok(fs.existsSync(f + ".backup"));
});

test("edit_file: ambiguous match without replaceAll errors", async () => {
  const dir = setup();
  fs.writeFileSync(path.join(dir, "c.js"), "x\nx\n");
  const res = await executeBuiltinTool(
    "edit_file",
    { path: "c.js", oldText: "x", newText: "y" },
    cfg(dir),
    log,
  );
  assert.equal(res.success, false);
  assert.match(text(res), /matches 2 places/);
});

test("edit_file: replaceAll replaces every occurrence", async () => {
  const dir = setup();
  const f = path.join(dir, "c.js");
  fs.writeFileSync(f, "x\nx\n");
  const res = await executeBuiltinTool(
    "edit_file",
    { path: "c.js", oldText: "x", newText: "y", replaceAll: true },
    cfg(dir),
    log,
  );
  assert.equal(res.success, true);
  assert.equal(fs.readFileSync(f, "utf8"), "y\ny\n");
});

test("edit_file: replacement is literal (no $-pattern interpretation)", async () => {
  const dir = setup();
  const f = path.join(dir, "c.txt");
  fs.writeFileSync(f, "AAA");
  const res = await executeBuiltinTool(
    "edit_file",
    { path: "c.txt", oldText: "AAA", newText: "$& $1 done" },
    cfg(dir),
    log,
  );
  assert.equal(res.success, true);
  assert.equal(fs.readFileSync(f, "utf8"), "$& $1 done");
});

test("edit_file: missing oldText reports not found", async () => {
  const dir = setup();
  fs.writeFileSync(path.join(dir, "c.txt"), "hello");
  const res = await executeBuiltinTool(
    "edit_file",
    { path: "c.txt", oldText: "nope", newText: "x" },
    cfg(dir),
    log,
  );
  assert.equal(res.success, false);
  assert.match(text(res), /not found/i);
});

test("edit_file: append creates file then appends with a separator newline", async () => {
  const dir = setup();
  const f = path.join(dir, "log.md");
  let res = await executeBuiltinTool(
    "edit_file",
    { path: "log.md", append: "line1" },
    cfg(dir),
    log,
  );
  assert.equal(res.success, true);
  assert.equal(fs.readFileSync(f, "utf8"), "line1");
  res = await executeBuiltinTool(
    "edit_file",
    { path: "log.md", append: "line2" },
    cfg(dir),
    log,
  );
  assert.equal(res.success, true);
  assert.equal(fs.readFileSync(f, "utf8"), "line1\nline2");
  assert.ok(fs.existsSync(f + ".backup"));
});

test("move_file: renames within boundary, creating parent dirs", async () => {
  const dir = setup();
  fs.writeFileSync(path.join(dir, "a.txt"), "A");
  const res = await executeBuiltinTool(
    "move_file",
    { from: "a.txt", to: "sub/b.txt" },
    cfg(dir),
    log,
  );
  assert.equal(res.success, true, text(res));
  assert.ok(!fs.existsSync(path.join(dir, "a.txt")));
  assert.equal(fs.readFileSync(path.join(dir, "sub", "b.txt"), "utf8"), "A");
});

test("delete_file: removes file and keeps .backup", async () => {
  const dir = setup();
  const f = path.join(dir, "junk.txt");
  fs.writeFileSync(f, "bye");
  const res = await executeBuiltinTool(
    "delete_file",
    { path: "junk.txt" },
    cfg(dir),
    log,
  );
  assert.equal(res.success, true);
  assert.ok(!fs.existsSync(f));
  assert.equal(fs.readFileSync(f + ".backup", "utf8"), "bye");
});

test("delete_file: refuses directories", async () => {
  const dir = setup();
  fs.mkdirSync(path.join(dir, "adir"));
  const res = await executeBuiltinTool(
    "delete_file",
    { path: "adir" },
    cfg(dir),
    log,
  );
  assert.equal(res.success, false);
  assert.match(text(res), /only deletes regular files/i);
});

test("write-class tools reject path traversal outside the project", async () => {
  const dir = setup();
  const cases = [
    ["edit_file", { path: "../escape.txt", append: "x" }],
    ["delete_file", { path: "../../etc/passwd" }],
    ["move_file", { from: "../a", to: "b" }],
    ["search_files", { query: "x", path: "../.." }],
    ["find_files", { pattern: "*", path: "../.." }],
  ];
  for (const [tool, args] of cases) {
    const res = await executeBuiltinTool(tool, args, cfg(dir), log);
    assert.equal(res.success, false, `${tool} should reject traversal`);
  }
});

test("fetch_url: gated by agentBrowser and blocks loopback", async () => {
  const dir = setup();
  let res = await executeBuiltinTool(
    "fetch_url",
    { url: "https://example.com" },
    cfg(dir),
    log,
  );
  assert.equal(res.success, false);
  assert.match(text(res), /web access is disabled/i);

  const enabled = { ...cfg(dir), agentBrowser: { enabled: true } };
  res = await executeBuiltinTool(
    "fetch_url",
    { url: "http://localhost:3000" },
    enabled,
    log,
  );
  assert.equal(res.success, false);
  assert.match(text(res), /loopback|localhost|cannot be opened/i);
});
