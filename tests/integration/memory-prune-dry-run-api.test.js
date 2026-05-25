const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");

const { initConfig } = require("../../lib/config");
const {
  initMemory,
  addMemory,
  getMemories,
  flushMemoryToDisk,
} = require("../../lib/memory");
const createMemoryRouter = require("../../routes/memory");

function setupTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cc-memory-prune-api-"));
}

async function startServer(app) {
  return new Promise((resolve) => {
    const srv = app.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      resolve({ srv, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

test("POST /api/memory/prune/dry-run returns analysis and performs no writes", async () => {
  const root = setupTempRoot();
  fs.writeFileSync(path.join(root, ".cc-config.json"), JSON.stringify({}));
  initConfig(root);
  initMemory(root);

  addMemory({
    type: "fact",
    content: "Keep review findings short and concrete.",
    confidence: 0.8,
  });
  addMemory({
    type: "fact",
    content: "Keep review findings short and concrete.",
    confidence: 0.79,
  });
  addMemory({
    type: "summary",
    content: "ok",
    confidence: 0.1,
  });

  const beforeIds = getMemories().map((m) => m.id).sort();

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createMemoryRouter({
      log: () => {},
      requireLocalOrApiKey: (_req, _res, next) => next(),
    }),
  );

  const { srv, baseUrl } = await startServer(app);
  try {
    const res = await fetch(`${baseUrl}/api/memory/prune/dry-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sampleSize: 5,
        thresholds: {
          nearDuplicateSimilarity: 0.8,
          lowSignalScoreThreshold: 0.4,
          minContentLength: 12,
          staleDays: 30,
        },
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.readOnly, true);
    assert.equal(body.totalCount, 3);
    assert.ok(body.exactDuplicates.totalGroups >= 1);
    assert.ok(Array.isArray(body.lowSignal.candidates));

    const afterIds = getMemories().map((m) => m.id).sort();
    assert.deepEqual(afterIds, beforeIds);
  } finally {
    srv.close();
    flushMemoryToDisk();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
