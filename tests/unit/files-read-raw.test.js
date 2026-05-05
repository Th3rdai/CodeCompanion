/**
 * Tests for GET /api/files/read-raw — folder param handling.
 *
 * Regression: read-raw used to ignore ?folder= and always resolve under
 * config.projectFolder, causing 404s when the user browsed a different folder
 * (e.g. ~/Documents) via the File Browser. The frontend then fed the resulting
 * "Failed to read file" error to the chat as the file body, and the model
 * fabricated content from it.
 *
 * Invariants under test:
 *  1. No ?folder=          → resolves under chatFolder (mirrors /files/read)
 *  2. ?folder=<chatFolder>  → resolves under chatFolder (200)
 *  3. ?folder=<projectFolder> → resolves under projectFolder (200)
 *  4. ?folder=<outsideRoot> → 403 Access denied
 *  5. Path traversal blocked (../../../etc/passwd) → 403
 *  6. Missing file under valid folder → 404
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const express = require("express");

const { initConfig, updateConfig } = require("../../lib/config.js");
const createFilesRouter = require("../../routes/files.js");

function makeTmpDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `cc-readraw-${suffix}-`));
}

function writeFixture(dir, name, contents) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, contents);
  return p;
}

function buildApp() {
  const app = express();
  const router = createFilesRouter({
    log: () => {},
    debug: () => {},
    requireLocalOrApiKey: (_req, _res, next) => next(),
  });
  app.use("/api", router);
  return app;
}

async function startServer(app) {
  return new Promise((resolve) => {
    const srv = app.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      resolve({ srv, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

// Initialize config once with a baseline; each test patches it via updateConfig.
const appRoot = makeTmpDir("appRoot");
fs.writeFileSync(path.join(appRoot, ".cc-config.json"), JSON.stringify({}));
initConfig(appRoot);

test("read-raw: no ?folder= falls back to chatFolder (regression for ~/Documents 404)", async () => {
  const projectFolder = makeTmpDir("proj");
  const chatFolder = makeTmpDir("chat");
  writeFixture(chatFolder, "doc.pdf", "FAKEPDF");
  updateConfig({ projectFolder, chatFolder });

  const { srv, baseUrl } = await startServer(buildApp());
  try {
    const res = await fetch(`${baseUrl}/api/files/read-raw?path=doc.pdf`);
    assert.equal(res.status, 200, "should read file under chatFolder");
    const body = await res.text();
    assert.equal(body, "FAKEPDF");
  } finally {
    srv.close();
  }
});

test("read-raw: ?folder=<chatFolder> resolves under that folder", async () => {
  const projectFolder = makeTmpDir("proj");
  const chatFolder = makeTmpDir("chat");
  writeFixture(chatFolder, "report.pdf", "REPORT");
  updateConfig({ projectFolder, chatFolder });

  const { srv, baseUrl } = await startServer(buildApp());
  try {
    const url = `${baseUrl}/api/files/read-raw?path=report.pdf&folder=${encodeURIComponent(chatFolder)}`;
    const res = await fetch(url);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "REPORT");
  } finally {
    srv.close();
  }
});

test("read-raw: ?folder=<projectFolder> still works", async () => {
  const projectFolder = makeTmpDir("proj");
  const chatFolder = makeTmpDir("chat");
  writeFixture(projectFolder, "code.txt", "CODE");
  updateConfig({ projectFolder, chatFolder });

  const { srv, baseUrl } = await startServer(buildApp());
  try {
    const url = `${baseUrl}/api/files/read-raw?path=code.txt&folder=${encodeURIComponent(projectFolder)}`;
    const res = await fetch(url);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "CODE");
  } finally {
    srv.close();
  }
});

test("read-raw: ?folder= outside allowed roots returns 403", async () => {
  const projectFolder = makeTmpDir("proj");
  const chatFolder = makeTmpDir("chat");
  const outsideFolder = makeTmpDir("outside");
  writeFixture(outsideFolder, "secret.pdf", "SECRET");
  updateConfig({ projectFolder, chatFolder });

  const { srv, baseUrl } = await startServer(buildApp());
  try {
    const url = `${baseUrl}/api/files/read-raw?path=secret.pdf&folder=${encodeURIComponent(outsideFolder)}`;
    const res = await fetch(url);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Access denied/);
  } finally {
    srv.close();
  }
});

test("read-raw: path traversal blocked", async () => {
  const projectFolder = makeTmpDir("proj");
  const chatFolder = makeTmpDir("chat");
  updateConfig({ projectFolder, chatFolder });

  const { srv, baseUrl } = await startServer(buildApp());
  try {
    const res = await fetch(
      `${baseUrl}/api/files/read-raw?path=${encodeURIComponent("../../../etc/passwd")}`,
    );
    assert.equal(res.status, 403);
  } finally {
    srv.close();
  }
});

test("read-raw: missing file returns 404", async () => {
  const projectFolder = makeTmpDir("proj");
  const chatFolder = makeTmpDir("chat");
  updateConfig({ projectFolder, chatFolder });

  const { srv, baseUrl } = await startServer(buildApp());
  try {
    const res = await fetch(`${baseUrl}/api/files/read-raw?path=nope.pdf`);
    assert.equal(res.status, 404);
  } finally {
    srv.close();
  }
});
