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

function startServer(port, root) {
  return spawn(process.execPath, ["server.js"], {
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
}

async function stopServer(child) {
  child.kill("SIGTERM");
  await sleep(300);
  try {
    child.kill("SIGKILL");
  } catch {}
}

test("POST /api/config persists organizationName and GET /api/config reloads it", async () => {
  const port = 22900 + Math.floor(Math.random() * 500);
  const baseUrl = `http://127.0.0.1:${port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-org-name-"));
  const configPath = path.join(root, ".cc-config.json");
  fs.writeFileSync(configPath, JSON.stringify({}, null, 2));

  let child = startServer(port, root);

  try {
    await waitForServer(baseUrl);

    const postedName = "  Acme Security Labs  ";
    const saveRes = await fetch(`${baseUrl}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationName: postedName }),
    });
    assert.equal(saveRes.status, 200);
    const saveBody = await saveRes.json();
    assert.equal(saveBody.organizationName, "Acme Security Labs");

    const onDisk = JSON.parse(fs.readFileSync(configPath, "utf8"));
    assert.equal(onDisk.organizationName, "Acme Security Labs");

    await stopServer(child);
    child = startServer(port, root);
    await waitForServer(baseUrl);

    const getRes = await fetch(`${baseUrl}/api/config`);
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    assert.equal(getBody.organizationName, "Acme Security Labs");
  } finally {
    await stopServer(child);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
