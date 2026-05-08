/**
 * Folder sourcePath for review_run / pentest_scan (agent builtins).
 * Stubs review/pentest service phases to avoid Ollama in unit tests.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const reviewPath = require.resolve("../../lib/review-service.js");
const pentestPath = require.resolve("../../lib/pentest-service.js");
const skillsPath = require.resolve("../../lib/agent-app-skills.js");

function clearAgentSkillsStack() {
  delete require.cache[skillsPath];
  delete require.cache[reviewPath];
  delete require.cache[pentestPath];
}

function sandboxConfig(root) {
  return {
    projectFolder: root,
    chatFolder: root,
    ollamaUrl: "http://127.0.0.1:11434",
    reviewTimeoutSec: 60,
  };
}

const noopLog = () => {};

test("executeReviewRun: directory sourcePath uses runReviewFolderPhase (not file-only error)", async (t) => {
  clearAgentSkillsStack();
  const reviewService = require(reviewPath);
  const orig = reviewService.runReviewFolderPhase;
  let captured = null;
  reviewService.runReviewFolderPhase = async (p) => {
    captured = p;
    return {
      model: "stub-review",
      result: { type: "report-card", data: { overallGrade: "A" } },
    };
  };
  t.after(() => {
    reviewService.runReviewFolderPhase = orig;
    clearAgentSkillsStack();
  });

  const { executeReviewRun } = require(skillsPath);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-ar-folder-"));
  const pkg = path.join(root, "Sources", "DockLock");
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, "App.swift"), "print(1)\n");

  const res = await executeReviewRun(
    { model: "stub-review", sourcePath: "Sources/DockLock" },
    sandboxConfig(root),
    noopLog,
    undefined,
  );

  assert.equal(res.success, true);
  const env = JSON.parse(res.result.content[0].text);
  assert.equal(env.ok, true);
  assert.equal(env.type, "report-card");
  assert.equal(env.data.overallGrade, "A");
  assert.ok(env.data._reviewMeta);
  assert.ok(env.data._reviewMeta.fileCount >= 1);
  assert.ok(captured && captured.folder && captured.folder.includes("DockLock"));
  assert.ok(Array.isArray(captured.files));
});

test("executeReviewRun: empty text folder returns INVALID_ARGS (no Ollama)", async (t) => {
  clearAgentSkillsStack();
  t.after(() => clearAgentSkillsStack());
  const { executeReviewRun } = require(skillsPath);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-ar-empty-"));
  const empty = path.join(root, "empty");
  fs.mkdirSync(empty, { recursive: true });

  const res = await executeReviewRun(
    { model: "m", sourcePath: "empty" },
    sandboxConfig(root),
    noopLog,
    undefined,
  );
  assert.equal(res.success, false);
  const env = JSON.parse(res.result.content[0].text);
  assert.equal(env.ok, false);
  assert.equal(env.code, "INVALID_ARGS");
  assert.match(env.message, /No reviewable text files/i);
});

test("executeReviewRun: folder rejects images", async (t) => {
  clearAgentSkillsStack();
  t.after(() => clearAgentSkillsStack());
  const { executeReviewRun } = require(skillsPath);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-ar-img-"));
  const dir = path.join(root, "src");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "a.js"), "x");

  const res = await executeReviewRun(
    { model: "m", sourcePath: "src", images: [{ dummy: true }] },
    sandboxConfig(root),
    noopLog,
    undefined,
  );
  assert.equal(res.success, false);
  const env = JSON.parse(res.result.content[0].text);
  assert.equal(env.code, "INVALID_ARGS");
  assert.match(env.message, /Folder review does not support images/i);
});

test("executePentestScan: directory sourcePath uses runPentestFolderPhase", async (t) => {
  clearAgentSkillsStack();
  const pentestService = require(pentestPath);
  const orig = pentestService.runPentestFolderPhase;
  let captured = null;
  pentestService.runPentestFolderPhase = async (p) => {
    captured = p;
    return {
      model: "stub-pt",
      result: {
        type: "security-report",
        data: { overallGrade: "B", categories: {} },
      },
    };
  };
  t.after(() => {
    pentestService.runPentestFolderPhase = orig;
    clearAgentSkillsStack();
  });

  const { executePentestScan } = require(skillsPath);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-pt-folder-"));
  const scan = path.join(root, "api");
  fs.mkdirSync(scan, { recursive: true });
  fs.writeFileSync(path.join(scan, "x.js"), "eval(req.body)\n");

  const res = await executePentestScan(
    { model: "stub-pt", sourcePath: "api" },
    sandboxConfig(root),
    noopLog,
    undefined,
  );

  assert.equal(res.success, true);
  const env = JSON.parse(res.result.content[0].text);
  assert.equal(env.ok, true);
  assert.equal(env.type, "report-card");
  assert.ok(env.data._scanMeta);
  assert.ok(captured && captured.folder.includes("api"));
});

test("executePentestScan: folder rejects images", async (t) => {
  clearAgentSkillsStack();
  t.after(() => clearAgentSkillsStack());
  const { executePentestScan } = require(skillsPath);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-pt-img-"));
  const dir = path.join(root, "src");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "a.js"), "x");

  const res = await executePentestScan(
    { model: "m", sourcePath: "src", images: [{ d: 1 }] },
    sandboxConfig(root),
    noopLog,
    undefined,
  );
  assert.equal(res.success, false);
  const env = JSON.parse(res.result.content[0].text);
  assert.equal(env.code, "INVALID_ARGS");
  assert.match(env.message, /Folder security scan does not support images/i);
});
