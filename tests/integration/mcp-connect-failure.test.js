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

// Regression for 50d0d00 — logMcpConnectFailure was declared at module top-level
// referencing the closure-only `log` symbol, every error path threw a silent
// ReferenceError, Express converted it to HTTP 500. The fix restored 502 with a
// real transport message in the body. Without this test, the same shape of bug
// can re-enter through any future error-handler refactor.
test("MCP connect failure surfaces 502 + real error message (not 500)", async () => {
  const port = 3395;
  const baseUrl = `http://127.0.0.1:${port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mcpconn-"));

  // Configure a single MCP client that points at an unreachable port. autoConnect:false
  // so server startup doesn't pre-fail; the test drives the manual /connect path
  // (which is exactly the surface that was broken in v1.6.32).
  fs.writeFileSync(
    path.join(root, ".cc-config.json"),
    JSON.stringify(
      {
        mcpClients: [
          {
            id: "broken-test-client",
            name: "Broken Test Client",
            transport: "http",
            url: "http://127.0.0.1:1/mcp",
            autoConnect: false,
          },
        ],
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

    const res = await fetch(
      `${baseUrl}/api/mcp/clients/broken-test-client/connect`,
      { method: "POST" },
    );

    // Status: 502 (the explicit catch block ran) — NOT 500 (which would mean
    // the catch itself threw and Express short-circuited).
    assert.equal(
      res.status,
      502,
      `expected 502 from connect-failure catch, got ${res.status} (likely a regression of 50d0d00)`,
    );

    const body = await res.json();
    assert.equal(body.status, "error");
    assert.ok(
      typeof body.error === "string" && body.error.length > 0,
      "error message should be non-empty",
    );
    // Generic Express error pages never contain these — confirms safeMcpConnectMessage()
    // produced something derived from the underlying transport failure.
    assert.notEqual(body.error, "Internal Server Error");
    assert.notEqual(body.error, "Connection failed");
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Regression for the 404 path — getting back a clean Client-not-found response
// (not the same path as the catch above, but lives next to it; if either wiring
// regresses the other often follows).
test("MCP connect on unknown client returns 404", async () => {
  const port = 3396;
  const baseUrl = `http://127.0.0.1:${port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mcpconn404-"));
  fs.writeFileSync(
    path.join(root, ".cc-config.json"),
    JSON.stringify({ mcpClients: [] }, null, 2),
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
    const res = await fetch(`${baseUrl}/api/mcp/clients/nope/connect`, {
      method: "POST",
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, "Client not found");
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
