/**
 * Integration test for Phase 1a — GET /api/model-context.
 *
 * Asserts:
 *   - `gpt-4o:cloud` (synthetic cloud name) → contextLength > 0,
 *      source: "cloud-hint", served by guessCloudContext (no network).
 *   - Obviously-unknown model → contextLength: null, source: "unknown".
 *   - Missing both `name` and `auto=1` → 400.
 *   - Sensitive route is gated by requireLocalOrApiKey (loopback access works).
 *   - Source code uses the shared `getContextLengthForModel` helper rather
 *     than re-implementing isCloudModelName + fetchContextLength inline.
 */

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

test("GET /api/model-context — covers cloud-hint, unknown, and 400 paths", async () => {
  const port = 3401;
  const baseUrl = `http://127.0.0.1:${port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-modelctx-"));
  // Point at a definitely-down Ollama to keep the test deterministic — the
  // unknown-name path goes through fetchContextLength, which fails fast and
  // returns 0 (= "unknown").
  fs.writeFileSync(
    path.join(root, ".cc-config.json"),
    JSON.stringify(
      {
        ollamaUrl: "http://127.0.0.1:65535",
        enablePreflightBanner: false,
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

    // 1) cloud-hint — gpt-4o:cloud matches the `:cloud\b` heuristic in
    //    CLOUD_MODEL_CONTEXT_HINTS → 128_000.
    const cloudRes = await fetch(
      `${baseUrl}/api/model-context?name=${encodeURIComponent("gpt-4o:cloud")}`,
    );
    assert.equal(cloudRes.status, 200);
    const cloud = await cloudRes.json();
    assert.equal(cloud.source, "cloud-hint");
    assert.ok(
      typeof cloud.contextLength === "number" && cloud.contextLength > 0,
      `expected positive contextLength, got ${cloud.contextLength}`,
    );

    // 2) unknown — random local-style name that doesn't exist; Ollama is
    //    pointed at a closed port so fetchContextLength fails → 0 → null.
    const unknownRes = await fetch(
      `${baseUrl}/api/model-context?name=${encodeURIComponent("definitely-not-a-real-model-xyz123:tag")}`,
    );
    assert.equal(unknownRes.status, 200);
    const unknown = await unknownRes.json();
    assert.equal(unknown.contextLength, null);
    assert.equal(unknown.source, "unknown");

    // 3) missing query — 400.
    const badRes = await fetch(`${baseUrl}/api/model-context`);
    assert.equal(badRes.status, 400);
    const bad = await badRes.json();
    assert.match(String(bad.error || ""), /name|auto/i);

    // 4) cache hit — second call for the same name returns equal payload
    //    (5 min TTL is way longer than the test).
    const cloudRes2 = await fetch(
      `${baseUrl}/api/model-context?name=${encodeURIComponent("gpt-4o:cloud")}`,
    );
    const cloud2 = await cloudRes2.json();
    assert.deepEqual(cloud2, cloud);
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("server.js wires GET /api/model-context through getContextLengthForModel (no inline duplication)", () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, "../../server.js"),
    "utf8",
  );
  // Route must exist.
  assert.match(src, /\/api\/model-context/);
  // And it must be served by the shared helper from auto-model.js — not a
  // copy-pasted isCloudModelName + fetchContextLength block in server.js.
  assert.match(src, /getContextLengthForModel/);
  // requireLocalOrApiKey gate is required (sensitive route — leaks model
  // metadata that may include cloud-only models).
  // Find the actual route registration (skip the leading section banner).
  const routeMatch = src.match(
    /app\.get\(\s*["']\/api\/model-context["'][^)]*\)/,
  );
  assert.ok(
    routeMatch,
    "expected app.get('/api/model-context', …) registration",
  );
  assert.match(
    routeMatch[0],
    /requireLocalOrApiKey/,
    "model-context route must be gated by requireLocalOrApiKey",
  );
});
