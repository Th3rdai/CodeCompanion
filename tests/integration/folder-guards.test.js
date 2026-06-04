/**
 * HTTP-level integration tests for path-traversal guards on folder endpoints.
 *
 * Tests that /api/review/folder, /api/review/folder/preview,
 * /api/pentest/folder, and /api/pentest/folder/preview all return 403
 * when the requested folder is outside the configured projectFolder.
 *
 * Spawns a real server instance with a temp projectFolder to activate the guard.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

const APP_ROOT = path.resolve(__dirname, "../..");

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

/**
 * Start a server with a temporary projectFolder in a temp data directory.
 * Returns { child, baseUrl, cleanup }.
 */
async function startServerWithProjectFolder(port, projectFolder) {
  // Create a temp CC_DATA_DIR so we don't pollute the real config
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-guard-test-"));
  const configPath = path.join(dataDir, ".cc-config.json");
  fs.writeFileSync(
    configPath,
    JSON.stringify({ projectFolder }, null, 2),
    "utf8",
  );

  const child = spawn(process.execPath, ["server.js"], {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: "0",
      FORCE_HTTP: "1",
      CC_DATA_DIR: dataDir,
    },
    stdio: "pipe",
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(baseUrl);

  function cleanup() {
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
    }, 500);
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {}
  }

  return { child, baseUrl, cleanup };
}

// ── POST /api/review/folder/preview — path traversal guard ──────────────────

test("POST /api/review/folder/preview — 403 on path traversal", async () => {
  const safeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-safe-"));
  const { baseUrl, cleanup } = await startServerWithProjectFolder(
    3380,
    safeDir,
  );
  try {
    const res = await fetch(`${baseUrl}/api/review/folder/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: "/etc" }),
    });
    assert.equal(res.status, 403, "Should return 403 for out-of-bounds folder");
    const body = await res.json();
    assert.ok(
      body.error && body.error.includes("outside"),
      "Error message should mention 'outside'",
    );
  } finally {
    cleanup();
    try {
      fs.rmSync(safeDir, { recursive: true, force: true });
    } catch {}
  }
});

test("POST /api/review/folder/preview — 403 on traversal with ..", async () => {
  const safeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-safe-"));
  const { baseUrl, cleanup } = await startServerWithProjectFolder(
    3381,
    safeDir,
  );
  try {
    const res = await fetch(`${baseUrl}/api/review/folder/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: `${safeDir}/../etc` }),
    });
    assert.equal(res.status, 403, "Should return 403 for .. traversal");
  } finally {
    cleanup();
    try {
      fs.rmSync(safeDir, { recursive: true, force: true });
    } catch {}
  }
});

test("POST /api/review/folder/preview — 400 when folder param missing", async () => {
  const safeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-safe-"));
  const { baseUrl, cleanup } = await startServerWithProjectFolder(
    3382,
    safeDir,
  );
  try {
    const res = await fetch(`${baseUrl}/api/review/folder/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400, "Should return 400 when folder is missing");
  } finally {
    cleanup();
    try {
      fs.rmSync(safeDir, { recursive: true, force: true });
    } catch {}
  }
});

// ── POST /api/review/folder — path traversal guard ──────────────────────────

test("POST /api/review/folder — 403 on path traversal when projectFolder set", async () => {
  const safeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-safe-"));
  const { baseUrl, cleanup } = await startServerWithProjectFolder(
    3383,
    safeDir,
  );
  try {
    const res = await fetch(`${baseUrl}/api/review/folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama3.2", folder: "/etc" }),
    });
    assert.equal(res.status, 403, "Should return 403 for out-of-bounds folder");
    const body = await res.json();
    assert.ok(
      body.error && body.error.includes("outside"),
      "Error message should mention 'outside'",
    );
  } finally {
    cleanup();
    try {
      fs.rmSync(safeDir, { recursive: true, force: true });
    } catch {}
  }
});

test("POST /api/review/folder — 400 when model missing", async () => {
  const safeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-safe-"));
  const { baseUrl, cleanup } = await startServerWithProjectFolder(
    3384,
    safeDir,
  );
  try {
    const res = await fetch(`${baseUrl}/api/review/folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: safeDir }),
    });
    assert.equal(res.status, 400, "Should return 400 when model is missing");
  } finally {
    cleanup();
    try {
      fs.rmSync(safeDir, { recursive: true, force: true });
    } catch {}
  }
});

// ── POST /api/pentest/folder/preview — path traversal guard ─────────────────

test("POST /api/pentest/folder/preview — 403 on path traversal", async () => {
  const safeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-safe-"));
  const { baseUrl, cleanup } = await startServerWithProjectFolder(
    3385,
    safeDir,
  );
  try {
    const res = await fetch(`${baseUrl}/api/pentest/folder/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: `${safeDir}/../etc` }),
    });
    assert.equal(
      res.status,
      403,
      "Should return 403 for .. traversal on pentest preview",
    );
  } finally {
    cleanup();
    try {
      fs.rmSync(safeDir, { recursive: true, force: true });
    } catch {}
  }
});

test("POST /api/pentest/folder/preview — 400 when folder param missing", async () => {
  const safeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-safe-"));
  const { baseUrl, cleanup } = await startServerWithProjectFolder(
    3386,
    safeDir,
  );
  try {
    const res = await fetch(`${baseUrl}/api/pentest/folder/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400, "Should return 400 when folder is missing");
  } finally {
    cleanup();
    try {
      fs.rmSync(safeDir, { recursive: true, force: true });
    } catch {}
  }
});

// ── POST /api/pentest/folder — path traversal guard ─────────────────────────

test("POST /api/pentest/folder — 403 on path traversal when projectFolder set", async () => {
  const safeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-safe-"));
  const { baseUrl, cleanup } = await startServerWithProjectFolder(
    3387,
    safeDir,
  );
  try {
    const res = await fetch(`${baseUrl}/api/pentest/folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama3.2", folder: "/etc" }),
    });
    assert.equal(
      res.status,
      403,
      "Should return 403 for out-of-bounds folder on pentest",
    );
    const body = await res.json();
    assert.ok(
      body.error && body.error.includes("outside"),
      "Error message should mention 'outside'",
    );
  } finally {
    cleanup();
    try {
      fs.rmSync(safeDir, { recursive: true, force: true });
    } catch {}
  }
});

test("POST /api/pentest/folder — 400 when model missing", async () => {
  const safeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-safe-"));
  const { baseUrl, cleanup } = await startServerWithProjectFolder(
    3388,
    safeDir,
  );
  try {
    const res = await fetch(`${baseUrl}/api/pentest/folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: safeDir }),
    });
    assert.equal(res.status, 400, "Should return 400 when model is missing");
  } finally {
    cleanup();
    try {
      fs.rmSync(safeDir, { recursive: true, force: true });
    } catch {}
  }
});
