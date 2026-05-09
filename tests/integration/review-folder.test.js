const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const { DEFAULT_AUTO_MODEL_MAP } = require("../../lib/auto-model.js");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomTestPort() {
  return 28000 + Math.floor(Math.random() * 4000);
}

/** Wait until OUR sandbox child is listening (avoids fixed-port collisions with other local servers). */
async function waitForSandboxServer(
  baseUrl,
  expectedProjectRoot,
  timeoutMs = 20000,
) {
  const expected = path.resolve(expectedProjectRoot);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/config`);
      if (!res.ok) continue;
      const cfg = await res.json();
      const pf = cfg.projectFolder
        ? path.resolve(String(cfg.projectFolder))
        : "";
      if (pf === expected) return;
    } catch {}
    await sleep(200);
  }
  throw new Error(
    `Sandbox server did not expose projectFolder=${expected} at ${baseUrl} (wrong process on port?)`,
  );
}

/** Model tag for POST /api/review/folder (must exist locally). Defaults to Review-mode auto map (`lib/auto-model.js`). */
function reviewFolderModelTag() {
  return (
    process.env.CC_TEST_REVIEW_FOLDER_MODEL?.trim() ||
    process.env.OLLAMA_MODEL?.trim() ||
    DEFAULT_AUTO_MODEL_MAP.review
  );
}

/**
 * Writes config with projectFolder anchored at `sandboxRoot`, so `/api/review/folder/**`
 * can read folders under it (default `$HOME`-only project boundary would deny `/tmp/...`).
 */
function writeSandboxConfig(sandboxRoot) {
  fs.mkdirSync(sandboxRoot, { recursive: true });
  fs.writeFileSync(
    path.join(sandboxRoot, ".cc-config.json"),
    JSON.stringify(
      {
        projectFolder: sandboxRoot,
        ollamaUrl: "http://127.0.0.1:11434",
        reviewTimeoutSec: 240,
      },
      null,
      2,
    ),
  );
}

function spawnSandboxServer(port, sandboxRoot) {
  return spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, "../.."),
    env: {
      ...process.env,
      PORT: String(port),
      CC_DATA_DIR: sandboxRoot,
      DEBUG: "0",
      FORCE_HTTP: "1",
      CC_SKIP_MCP_AUTOCONNECT: "1",
      // Inherited CC_API_SECRET would not affect /api/review (no gate), but keep child predictable.
      CC_API_SECRET: "",
    },
    stdio: "pipe",
  });
}

// ── /api/review/folder/preview ───────────────────────────────────────────────

test("POST /api/review/folder/preview returns files array, totalSize, skipped", async () => {
  const port = randomTestPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "cc-review-preview-"));
  writeSandboxConfig(sandbox);
  const scanDir = path.join(sandbox, "scan-me");
  fs.mkdirSync(scanDir, { recursive: true });
  fs.writeFileSync(
    path.join(scanDir, "sample.js"),
    "function hello() {\n  return 1;\n}\n",
  );

  const child = spawnSandboxServer(port, sandbox);
  try {
    await waitForSandboxServer(baseUrl, sandbox);
    const res = await fetch(`${baseUrl}/api/review/folder/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: scanDir }),
    });
    assert.ok(res.ok, `Expected 2xx, got ${res.status}`);
    const body = await res.json();
    assert.ok(Array.isArray(body.files), "files must be an array");
    assert.ok(typeof body.totalSize === "number", "totalSize must be a number");
    assert.ok(typeof body.skipped === "number", "skipped must be a number");
    assert.ok(typeof body.folder === "string", "folder must be a string");
    if (body.files.length > 0) {
      assert.ok(typeof body.files[0].path === "string");
      assert.ok(typeof body.files[0].size === "number");
    }
    assert.ok(
      body.files.some(
        (f) => f.path.endsWith("sample.js") || f.path === "sample.js",
      ),
      "expected sample.js in files list",
    );
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    if (!child.killed) child.kill("SIGKILL");
  }
});

test("POST /api/review/folder/preview with missing folder returns 400", async () => {
  const port = randomTestPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "cc-review-prev400-"));
  writeSandboxConfig(sandbox);

  const child = spawnSandboxServer(port, sandbox);
  try {
    await waitForSandboxServer(baseUrl, sandbox);
    const res = await fetch(`${baseUrl}/api/review/folder/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(typeof body.error === "string");
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    if (!child.killed) child.kill("SIGKILL");
  }
});

// ── /api/review/folder ───────────────────────────────────────────────────────

test("POST /api/review/folder returns report-card or streams review fallback", async () => {
  const port = randomTestPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "cc-review-full-"));
  writeSandboxConfig(sandbox);
  const folderDir = path.join(sandbox, "proj");
  fs.mkdirSync(folderDir, { recursive: true });
  fs.writeFileSync(path.join(folderDir, "logic.js"), "export const x = 1;\n");

  const child = spawnSandboxServer(port, sandbox);
  const model = reviewFolderModelTag();

  try {
    await waitForSandboxServer(baseUrl, sandbox);
    const res = await fetch(`${baseUrl}/api/review/folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, folder: folderDir }),
    });

    assert.ok(
      res.status === 200 || res.status === 500,
      `Expected 200 or 500, got ${res.status}`,
    );

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (res.status !== 200) {
      const data = await res.json();
      assert.ok(data.error);
      return;
    }

    if (ct.includes("application/json")) {
      const body = await res.json();
      assert.equal(body.type, "report-card");
      assert.ok(body.data);
      assert.ok(typeof body.data.overallGrade === "string");
      return;
    }

    if (ct.includes("text/event-stream")) {
      const text = await res.text();
      assert.ok(text.includes("data:"));
      assert.ok(
        text.includes('"fallback":true') || text.includes("fallback"),
        "SSE path should advertise fallback metadata",
      );
      return;
    }

    assert.fail(`Unexpected Content-Type for 200 OK: ${ct || "(empty)"}`);
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    if (!child.killed) child.kill("SIGKILL");
  }
});

test("POST /api/review/folder with missing model or folder returns 400", async () => {
  const port = randomTestPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "cc-review-400-"));
  writeSandboxConfig(sandbox);

  const child = spawnSandboxServer(port, sandbox);
  try {
    await waitForSandboxServer(baseUrl, sandbox);
    const res = await fetch(`${baseUrl}/api/review/folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: reviewFolderModelTag() }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(typeof body.error === "string");
    assert.ok(
      body.error.toLowerCase().includes("missing"),
      "error should explain missing folder",
    );
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    if (!child.killed) child.kill("SIGKILL");
  }
});
