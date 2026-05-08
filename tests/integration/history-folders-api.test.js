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

async function fetchWithRetry(url, options, attempts = 4) {
  let lastError = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastError = err;
      await sleep(150 * (i + 1));
    }
  }
  throw lastError || new Error("fetch failed");
}

test("history folders API: CRUD, move, re-home, and route-order safety", async () => {
  const port = 3397;
  const baseUrl = `http://127.0.0.1:${port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-hfapi-"));
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
      DEBUG: "0",
      FORCE_HTTP: "1",
    },
    stdio: "pipe",
  });

  try {
    await waitForServer(baseUrl);

    // Route-order safety: this must hit /history/folders, not /history/:id.
    const initialFoldersRes = await fetchWithRetry(
      `${baseUrl}/api/history/folders`,
    );
    assert.equal(initialFoldersRes.status, 200);
    const initialFolders = await initialFoldersRes.json();
    assert.ok(Array.isArray(initialFolders));
    assert.ok(initialFolders.some((f) => f.id === "inbox"));

    const createFolderRes = await fetchWithRetry(
      `${baseUrl}/api/history/folders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Project A" }),
      },
    );
    assert.equal(createFolderRes.status, 201);
    const createdFolder = await createFolderRes.json();
    assert.equal(createdFolder.id, "project-a");

    // Save default inbox conversation.
    const saveRes = await fetchWithRetry(`${baseUrl}/api/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Folder integration",
        mode: "chat",
        model: "llama3.2",
        messages: [{ role: "user", content: "hello" }],
      }),
    });
    assert.equal(saveRes.status, 200);
    const { id } = await saveRes.json();
    assert.ok(id);

    const moveRes = await fetchWithRetry(
      `${baseUrl}/api/history/${id}/folder`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: createdFolder.id }),
      },
    );
    assert.equal(moveRes.status, 200);

    const historyAfterMove = await fetchWithRetry(`${baseUrl}/api/history`);
    const movedList = await historyAfterMove.json();
    const moved = movedList.find((c) => c.id === id);
    assert.ok(moved);
    assert.equal(moved.folderId, createdFolder.id);

    // Batch move back to inbox.
    const batchMoveRes = await fetchWithRetry(
      `${baseUrl}/api/history/batch-move`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], folderId: "inbox" }),
      },
    );
    assert.equal(batchMoveRes.status, 200);
    const batchBody = await batchMoveRes.json();
    assert.equal(batchBody.ok, 1);

    // Delete folder after chats are moved out.
    const deleteFolderRes = await fetchWithRetry(
      `${baseUrl}/api/history/folders/${createdFolder.id}`,
      {
        method: "DELETE",
      },
    );
    assert.equal(deleteFolderRes.status, 200);
    const deleteFolderBody = await deleteFolderRes.json();
    assert.equal(deleteFolderBody.ok, true);
    assert.equal(deleteFolderBody.movedToFolderId, "inbox");
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
