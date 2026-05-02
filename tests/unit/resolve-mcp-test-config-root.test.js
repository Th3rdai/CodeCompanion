"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  resolveMcpTestConfigRoot,
  macPackagedConfigDir,
} = require("../../lib/resolve-mcp-test-config-root");

test("macPackagedConfigDir: null when not darwin", () => {
  assert.equal(macPackagedConfigDir("/tmp/x", "linux"), null);
});

test("macPackagedConfigDir: null when file missing", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mcp-home-"));
  try {
    assert.equal(macPackagedConfigDir(home, "darwin"), null);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("macPackagedConfigDir: returns dir when config exists", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mcp-home-"));
  try {
    const dir = path.join(
      home,
      "Library",
      "Application Support",
      "code-companion",
    );
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, ".cc-config.json"), "{}");
    assert.equal(macPackagedConfigDir(home, "darwin"), dir);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("resolveMcpTestConfigRoot: CC_DATA_DIR wins when file exists", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mcp-"));
  const other = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mcp-"));
  try {
    fs.writeFileSync(path.join(tmp, ".cc-config.json"), "{}");
    fs.writeFileSync(path.join(other, ".cc-config.json"), "{}");
    const got = resolveMcpTestConfigRoot(other, {
      env: { CC_DATA_DIR: tmp },
      homedir: "/nope",
      platform: "linux",
    });
    assert.equal(got, tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(other, { recursive: true, force: true });
  }
});

test("resolveMcpTestConfigRoot: picks newer mtime between repo and mac packaged path", () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mcp-repo-"));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mcp-home-"));
  try {
    const macDir = path.join(
      home,
      "Library",
      "Application Support",
      "code-companion",
    );
    fs.mkdirSync(macDir, { recursive: true });
    const repoCfg = path.join(repoRoot, ".cc-config.json");
    const macCfg = path.join(macDir, ".cc-config.json");
    fs.writeFileSync(repoCfg, "{}");
    fs.writeFileSync(macCfg, "{}");

    const old = new Date("2020-01-01");
    const newer = new Date("2025-06-01");
    fs.utimesSync(repoCfg, old, old);
    fs.utimesSync(macCfg, newer, newer);

    const got = resolveMcpTestConfigRoot(repoRoot, {
      homedir: home,
      platform: "darwin",
      env: {},
    });
    assert.equal(got, macDir);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("resolveMcpTestConfigRoot: CodeCompanion-Data wins when newest", () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mcp-repo-"));
  const devData = path.join(repoRoot, "CodeCompanion-Data");
  try {
    fs.mkdirSync(devData, { recursive: true });
    const repoCfg = path.join(repoRoot, ".cc-config.json");
    const devCfg = path.join(devData, ".cc-config.json");
    fs.writeFileSync(repoCfg, "{}");
    fs.writeFileSync(devCfg, "{}");
    fs.utimesSync(repoCfg, new Date("2020-01-01"), new Date("2020-01-01"));
    fs.utimesSync(devCfg, new Date("2026-01-01"), new Date("2026-01-01"));

    const got = resolveMcpTestConfigRoot(repoRoot, {
      homedir: "/no-mac",
      platform: "linux",
      env: {},
    });
    assert.equal(got, devData);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("resolveMcpTestConfigRoot: picks repo when newer than mac path", () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mcp-repo-"));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mcp-home-"));
  try {
    const macDir = path.join(
      home,
      "Library",
      "Application Support",
      "code-companion",
    );
    fs.mkdirSync(macDir, { recursive: true });
    const repoCfg = path.join(repoRoot, ".cc-config.json");
    const macCfg = path.join(macDir, ".cc-config.json");
    fs.writeFileSync(repoCfg, "{}");
    fs.writeFileSync(macCfg, "{}");

    const old = new Date("2020-01-01");
    const newer = new Date("2025-06-01");
    fs.utimesSync(macCfg, old, old);
    fs.utimesSync(repoCfg, newer, newer);

    const got = resolveMcpTestConfigRoot(repoRoot, {
      homedir: home,
      platform: "darwin",
      env: {},
    });
    assert.equal(got, repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});
