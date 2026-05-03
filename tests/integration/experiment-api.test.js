const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
  throw new Error("Server did not become ready");
}

test("experiment API: disabled by default; start 403", async () => {
  const port = 3391;
  const baseUrl = `http://127.0.0.1:${port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-expapi-"));
  fs.writeFileSync(
    path.join(root, ".cc-config.json"),
    JSON.stringify({ experimentMode: { enabled: false } }, null, 2),
  );

  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, "../.."),
    env: {
      ...process.env,
      PORT: String(port),
      CC_DATA_DIR: root,
      DEBUG: "0",
      FORCE_HTTP: "1",
    },
    stdio: "pipe",
  });

  try {
    await waitForServer(baseUrl);
    const st = await fetch(`${baseUrl}/api/experiment/status`);
    assert.equal(st.status, 200);
    const j = await st.json();
    assert.equal(j.enabled, false);

    const start = await fetch(`${baseUrl}/api/experiment/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hypothesis: "test", maxRounds: 4 }),
    });
    assert.equal(start.status, 403);
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("experiment API: when enabled, start returns id", async () => {
  const port = 3392;
  const baseUrl = `http://127.0.0.1:${port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-expapi2-"));
  fs.writeFileSync(
    path.join(root, ".cc-config.json"),
    JSON.stringify(
      {
        experimentMode: { enabled: true, maxRounds: 6, maxDurationSec: 600 },
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
      DEBUG: "0",
      FORCE_HTTP: "1",
    },
    stdio: "pipe",
  });

  try {
    await waitForServer(baseUrl);
    const st = await fetch(`${baseUrl}/api/experiment/status`);
    const sj = await st.json();
    assert.equal(sj.enabled, true);

    const start = await fetch(`${baseUrl}/api/experiment/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hypothesis: "Cache headers speed TTFB",
        maxRounds: 4,
      }),
    });
    assert.equal(start.status, 200);
    const body = await start.json();
    assert.ok(body.id);
    assert.equal(body.record.hypothesis, "Cache headers speed TTFB");

    const g = await fetch(
      `${baseUrl}/api/experiment/${encodeURIComponent(body.id)}`,
    );
    assert.equal(g.status, 200);
    const exp = await g.json();
    assert.equal(exp.id, body.id);
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("experiment API: link-conversation back-fills conversationId", async () => {
  const port = 3393;
  const baseUrl = `http://127.0.0.1:${port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-expapi3-"));
  fs.writeFileSync(
    path.join(root, ".cc-config.json"),
    JSON.stringify(
      { experimentMode: { enabled: true, maxRounds: 4, maxDurationSec: 600 } },
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
      DEBUG: "0",
      FORCE_HTTP: "1",
    },
    stdio: "pipe",
  });

  try {
    await waitForServer(baseUrl);

    // Start an experiment — conversationId begins as null per ExperimentPanel's
    // order of operations (start mints the id BEFORE saveHistory writes the chat).
    const start = await fetch(`${baseUrl}/api/experiment/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hypothesis: "Link back-pointer", maxRounds: 4 }),
    });
    assert.equal(start.status, 200);
    const { id, record } = await start.json();
    assert.equal(record.conversationId, null);

    const linkUrl = `${baseUrl}/api/experiment/${encodeURIComponent(id)}/link-conversation`;

    // First link: null -> conv-abc, returns status:linked.
    const link1 = await fetch(linkUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: "conv-abc" }),
    });
    assert.equal(link1.status, 200);
    assert.deepEqual(await link1.json(), { ok: true, status: "linked" });

    // Round-trip: GET should now show the back-pointer set.
    const after = await fetch(
      `${baseUrl}/api/experiment/${encodeURIComponent(id)}`,
    );
    const afterBody = await after.json();
    assert.equal(afterBody.conversationId, "conv-abc");

    // Idempotent: re-linking the same conv returns already-linked, no write.
    const link2 = await fetch(linkUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: "conv-abc" }),
    });
    assert.equal(link2.status, 200);
    assert.deepEqual(await link2.json(), {
      ok: true,
      status: "already-linked",
    });

    // 400 on missing/empty conversationId.
    const bad = await fetch(linkUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(bad.status, 400);

    // 404 on unknown experiment id.
    const unknown = await fetch(
      `${baseUrl}/api/experiment/does-not-exist/link-conversation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: "conv-abc" }),
      },
    );
    assert.equal(unknown.status, 404);
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("experiment API: link-conversation 403 when experiment mode disabled", async () => {
  const port = 3394;
  const baseUrl = `http://127.0.0.1:${port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-expapi4-"));
  fs.writeFileSync(
    path.join(root, ".cc-config.json"),
    JSON.stringify({ experimentMode: { enabled: false } }, null, 2),
  );

  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, "../.."),
    env: {
      ...process.env,
      PORT: String(port),
      CC_DATA_DIR: root,
      DEBUG: "0",
      FORCE_HTTP: "1",
    },
    stdio: "pipe",
  });

  try {
    await waitForServer(baseUrl);
    const res = await fetch(`${baseUrl}/api/experiment/any/link-conversation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: "conv-abc" }),
    });
    assert.equal(res.status, 403);
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
