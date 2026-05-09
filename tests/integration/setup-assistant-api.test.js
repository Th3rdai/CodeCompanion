"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(baseUrl, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/config`);
      if (res.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error("Server did not become ready");
}

test("POST /api/setup-assistant: 503 when Ollama unreachable", async () => {
  const port = 21440 + Math.floor(Math.random() * 500);
  const baseUrl = `http://127.0.0.1:${port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-setup-a-"));
  fs.writeFileSync(
    path.join(root, ".cc-config.json"),
    JSON.stringify(
      {
        memory: { enabled: false, autoExtract: false },
        ollamaUrl: "http://127.0.0.1:1",
      },
      null,
      2,
    ),
  );

  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, "../.."),
    env: {
      ...process.env,
      PORT: String(port),
      CC_DATA_DIR: root,
      FORCE_HTTP: "1",
      CC_SKIP_MCP_AUTOCONNECT: "1",
      CC_API_SECRET: "",
    },
    stdio: "ignore",
  });

  try {
    await waitForServer(baseUrl);
    const res = await fetch(`${baseUrl}/api/setup-assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Help me set up memory" }],
        isElectron: false,
      }),
    });
    assert.equal(res.status, 503);
    const j = await res.json();
    assert.equal(j.code, "OLLAMA_UNAVAILABLE");
    assert.ok(Array.isArray(j.steps));
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    try {
      child.kill("SIGKILL");
    } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("POST /api/setup-assistant: 400 when messages missing", async () => {
  const port = 22440 + Math.floor(Math.random() * 500);
  const baseUrl = `http://127.0.0.1:${port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-setup-b-"));
  fs.writeFileSync(
    path.join(root, ".cc-config.json"),
    JSON.stringify({ memory: { enabled: false, autoExtract: false } }, null, 2),
  );

  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, "../.."),
    env: {
      ...process.env,
      PORT: String(port),
      CC_DATA_DIR: root,
      FORCE_HTTP: "1",
      CC_SKIP_MCP_AUTOCONNECT: "1",
      CC_API_SECRET: "",
    },
    stdio: "ignore",
  });

  try {
    await waitForServer(baseUrl);
    const res = await fetch(`${baseUrl}/api/setup-assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    try {
      child.kill("SIGKILL");
    } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  }
});
