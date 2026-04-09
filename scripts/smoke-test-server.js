#!/usr/bin/env node
/**
 * Startup smoke test: spawn server.js and verify it binds to a port.
 * Catches missing runtime files (e.g. a new directory not added to
 * electron-builder.config.js) before a broken installer ships.
 *
 * Usage: node scripts/smoke-test-server.js   (from repo root)
 * Exit 0 = server started and responded. Exit 1 = crash or timeout.
 */
"use strict";
const { spawn } = require("child_process");
const http = require("http");
const https = require("https");
const path = require("path");
const os = require("os");

const PORT = 19876;
const TIMEOUT_MS = 20_000;
const POLL_MS = 400;
const ROOT = path.resolve(__dirname, "..");

const env = {
  ...process.env,
  PORT: String(PORT),
  HOST: "127.0.0.1",
  // Isolated data dir so the test never touches real user config
  CC_DATA_DIR: path.join(os.tmpdir(), `cc-smoke-${Date.now()}`),
  // Suppress noisy startup output
  LOG_LEVEL: "warn",
};

console.log(`[smoke-test] Spawning server.js on port ${PORT}…`);

const child = spawn(process.execPath, [path.join(ROOT, "server.js")], {
  env,
  cwd: ROOT,
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.on("data", (d) => process.stdout.write(d));
child.stderr.on("data", (d) => process.stderr.write(d));

let exited = false;
let exitCode = null;
child.on("exit", (code) => {
  exited = true;
  exitCode = code;
});

function tryProto(proto) {
  const client = proto === "https" ? https : http;
  return new Promise((resolve) => {
    const req = client.get(
      `${proto}://127.0.0.1:${PORT}/`,
      // Allow self-signed cert (server uses ad-hoc cert locally)
      { timeout: 1000, rejectUnauthorized: false },
      (res) => {
        res.resume();
        resolve(true);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function probe() {
  return (await tryProto("http")) || (await tryProto("https"));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (exited) {
      console.error(
        `[smoke-test] FAIL — server exited with code ${exitCode} before binding`,
      );
      process.exit(1);
    }

    if (await probe()) {
      console.log(`[smoke-test] PASS — server responded on port ${PORT}`);
      child.kill();
      process.exit(0);
    }

    await sleep(POLL_MS);
  }

  console.error(`[smoke-test] FAIL — timed out after ${TIMEOUT_MS}ms`);
  child.kill();
  process.exit(1);
}

run();
