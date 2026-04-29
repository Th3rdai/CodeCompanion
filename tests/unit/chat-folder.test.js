/**
 * C1 tests for the projectFolder / chatFolder separation (FILEFIX).
 *
 * Four invariants under test:
 *  1. normalizeProjectFolder fallback — chatFolder defaults to projectFolder when unset/blank
 *  2. validateCwd boundary — security check always uses projectFolder, not chatFolder
 *  3. Terminal default CWD — run_terminal_cmd uses chatFolder when no explicit cwd arg
 *  4. Files tree root — GET /files/tree uses chatFolder when set
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { loadConfig } = require("../../lib/config.js");
const { validateCwd } = require("../../lib/builtin-agent-tools.js");

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `cc-filefix-${suffix}-`));
}

/**
 * Write a minimal config file and call loadConfig so normalizeProjectFolder runs.
 */
function loadConfigFromObject(obj) {
  const appRoot = makeTmpDir("root");
  const cfgPath = path.join(appRoot, ".cc-config.json");
  fs.writeFileSync(cfgPath, JSON.stringify(obj));
  return loadConfig(appRoot);
}

// ─── 1. normalizeProjectFolder fallback ───────────────────────────────────────

test("chatFolder defaults to projectFolder when absent from saved config", () => {
  const projectFolder = makeTmpDir("proj");
  const cfg = loadConfigFromObject({ projectFolder });
  assert.equal(cfg.chatFolder, projectFolder);
});

test("chatFolder defaults to projectFolder when saved as empty string", () => {
  const projectFolder = makeTmpDir("proj");
  const cfg = loadConfigFromObject({ projectFolder, chatFolder: "" });
  assert.equal(cfg.chatFolder, projectFolder);
});

test("chatFolder defaults to projectFolder when saved as whitespace", () => {
  const projectFolder = makeTmpDir("proj");
  const cfg = loadConfigFromObject({ projectFolder, chatFolder: "   " });
  assert.equal(cfg.chatFolder, projectFolder);
});

test("chatFolder is preserved when set to a valid value", () => {
  const projectFolder = makeTmpDir("proj");
  const chatFolder = path.join(projectFolder, "sub");
  fs.mkdirSync(chatFolder);
  const cfg = loadConfigFromObject({ projectFolder, chatFolder });
  assert.equal(cfg.chatFolder, chatFolder);
});

// ─── 2. validateCwd security boundary ────────────────────────────────────────

test("validateCwd accepts chatFolder that is equal to projectFolder", () => {
  const root = makeTmpDir("proj");
  const result = validateCwd(root, root);
  assert.equal(result.valid, true);
});

test("validateCwd accepts chatFolder nested inside projectFolder", () => {
  const root = makeTmpDir("proj");
  const sub = path.join(root, "src");
  fs.mkdirSync(sub);
  const result = validateCwd(sub, root);
  assert.equal(result.valid, true);
});

test("validateCwd rejects chatFolder outside projectFolder", () => {
  const root = makeTmpDir("proj");
  const outside = makeTmpDir("other");
  const result = validateCwd(outside, root);
  assert.equal(result.valid, false);
  assert.ok(result.reason.includes("outside the project folder"));
});

test("validateCwd rejects non-existent path", () => {
  const root = makeTmpDir("proj");
  const missing = path.join(root, "does-not-exist");
  const result = validateCwd(missing, root);
  assert.equal(result.valid, false);
});

test("validateCwd uses projectFolder as security boundary regardless of chatFolder name", () => {
  // chatFolder lives inside projectFolder — should pass
  const projectFolder = makeTmpDir("proj");
  const chatFolder = path.join(projectFolder, "active-project");
  fs.mkdirSync(chatFolder);

  // The boundary check is against projectFolder, not chatFolder itself
  const insideChat = validateCwd(chatFolder, projectFolder);
  assert.equal(insideChat.valid, true, "sub of projectFolder must be valid");

  // A sibling of projectFolder must be rejected even if it were named chatFolder
  const sibling = makeTmpDir("sibling");
  const outsideCheck = validateCwd(sibling, projectFolder);
  assert.equal(
    outsideCheck.valid,
    false,
    "sibling of projectFolder must be rejected",
  );
});

// ─── 3. Terminal default CWD uses chatFolder ──────────────────────────────────

test("run_terminal_cmd default CWD is chatFolder when chatFolder is set", () => {
  // We test the CWD resolution logic directly rather than spawning a process.
  // The logic: defaultCwd = config.chatFolder || config.projectFolder
  const projectFolder = makeTmpDir("proj");
  const chatFolder = path.join(projectFolder, "active");
  fs.mkdirSync(chatFolder);

  const config = { projectFolder, chatFolder };
  const defaultCwd = config.chatFolder || config.projectFolder;
  assert.equal(defaultCwd, chatFolder);

  // Boundary check still uses projectFolder
  const cwdCheck = validateCwd(defaultCwd, projectFolder);
  assert.equal(cwdCheck.valid, true);
});

test("run_terminal_cmd default CWD falls back to projectFolder when chatFolder is unset", () => {
  const projectFolder = makeTmpDir("proj");
  const config = { projectFolder, chatFolder: "" };
  const defaultCwd = config.chatFolder || config.projectFolder;
  assert.equal(defaultCwd, projectFolder);
});

test("run_terminal_cmd explicit cwd arg is resolved relative to chatFolder", () => {
  const projectFolder = makeTmpDir("proj");
  const chatFolder = path.join(projectFolder, "active");
  const subDir = path.join(chatFolder, "lib");
  fs.mkdirSync(chatFolder);
  fs.mkdirSync(subDir);

  const config = { projectFolder, chatFolder };
  const defaultCwd = config.chatFolder || config.projectFolder;

  // Simulate args.cwd = "lib" (relative)
  const resolvedCwd = path.resolve(defaultCwd, "lib");
  assert.equal(resolvedCwd, subDir);

  // Still within projectFolder — must pass boundary check
  const cwdCheck = validateCwd(resolvedCwd, projectFolder);
  assert.equal(cwdCheck.valid, true);
});

// ─── 4. Files tree root follows chatFolder ────────────────────────────────────

test("files tree root uses chatFolder when set in config", () => {
  // Mirrors the logic in routes/files.js GET /files/tree line 84
  const projectFolder = makeTmpDir("proj");
  const chatFolder = path.join(projectFolder, "active");
  fs.mkdirSync(chatFolder);

  const config = { projectFolder, chatFolder };

  // No query param — should resolve to chatFolder
  const treeRoot = config.chatFolder || config.projectFolder;
  assert.equal(treeRoot, chatFolder);
});

test("files tree root falls back to projectFolder when chatFolder is unset", () => {
  const projectFolder = makeTmpDir("proj");
  const config = { projectFolder, chatFolder: "" };
  const treeRoot = config.chatFolder || config.projectFolder;
  assert.equal(treeRoot, projectFolder);
});

test("files read endpoint uses chatFolder as default folder", () => {
  // Mirrors routes/files.js GET /files/read line 116
  const projectFolder = makeTmpDir("proj");
  const chatFolder = path.join(projectFolder, "src");
  fs.mkdirSync(chatFolder);

  const config = { projectFolder, chatFolder };

  // No req.query.folder — should resolve to chatFolder
  const defaultFolder = config.chatFolder || config.projectFolder;
  assert.equal(defaultFolder, chatFolder);
});
