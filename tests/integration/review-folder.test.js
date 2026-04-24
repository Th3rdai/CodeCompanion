const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { spawn } = require("child_process");

const BASE_PORT = 3325;
const BASE_URL = `http://localhost:${BASE_PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(baseUrl, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/config`);
      if (res.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error("Server did not become ready in time");
}

// ── /api/review/folder/preview ───────────────────────────────────────────────

test.skip("POST /api/review/folder/preview returns files array, totalSize, skipped", async () => {
  // Spawn server, wait for readiness, then test the preview endpoint.
  const serverPath = path.resolve(__dirname, "../../server.js");
  const proc = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(BASE_PORT) },
    stdio: "pipe",
  });
  try {
    await waitForServer(BASE_URL);
    const res = await fetch(`${BASE_URL}/api/review/folder/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: "/tmp" }),
    });
    assert.ok(res.ok, `Expected 2xx, got ${res.status}`);
    const body = await res.json();
    assert.ok(Array.isArray(body.files), "files must be an array");
    assert.ok(typeof body.totalSize === "number", "totalSize must be a number");
    assert.ok(typeof body.skipped === "number", "skipped must be a number");
    assert.ok(typeof body.folder === "string", "folder must be a string");
    // Each file entry has path and size
    if (body.files.length > 0) {
      assert.ok(
        typeof body.files[0].path === "string",
        "file.path must be string",
      );
      assert.ok(
        typeof body.files[0].size === "number",
        "file.size must be number",
      );
    }
  } finally {
    proc.kill();
  }
});

test.skip("POST /api/review/folder/preview with missing folder returns 400", async () => {
  const serverPath = path.resolve(__dirname, "../../server.js");
  const proc = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(BASE_PORT) },
    stdio: "pipe",
  });
  try {
    await waitForServer(BASE_URL);
    const res = await fetch(`${BASE_URL}/api/review/folder/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(typeof body.error === "string", "error must be a string");
  } finally {
    proc.kill();
  }
});

// ── /api/review/folder ───────────────────────────────────────────────────────

test.skip("POST /api/review/folder returns report-card type with overallGrade", async () => {
  const serverPath = path.resolve(__dirname, "../../server.js");
  const proc = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(BASE_PORT) },
    stdio: "pipe",
  });
  try {
    await waitForServer(BASE_URL);
    const res = await fetch(`${BASE_URL}/api/review/folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama3.2", folder: "/tmp/test-project" }),
    });
    assert.ok(res.ok, `Expected 2xx, got ${res.status}`);
    const body = await res.json();
    assert.equal(body.type, "report-card", "type must be 'report-card'");
    assert.ok(body.data, "response must have data field");
    assert.ok(
      typeof body.data.overallGrade === "string",
      "data.overallGrade must be a string",
    );
  } finally {
    proc.kill();
  }
});

test.skip("POST /api/review/folder with missing model or folder returns 400", async () => {
  const serverPath = path.resolve(__dirname, "../../server.js");
  const proc = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(BASE_PORT) },
    stdio: "pipe",
  });
  try {
    await waitForServer(BASE_URL);
    const res = await fetch(`${BASE_URL}/api/review/folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama3.2" }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(typeof body.error === "string", "error must be a string");
  } finally {
    proc.kill();
  }
});
