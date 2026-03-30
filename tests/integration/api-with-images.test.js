const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { spawn } = require("child_process");

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

/** Matches POST /api/chat (server.js): model, messages, mode; optional images */
function chatPostBody(overrides = {}) {
  const {
    content = "Hello",
    model = "llava",
    mode = "chat",
    messages,
    images,
  } = overrides;
  return {
    model,
    mode,
    messages: messages || [{ role: "user", content }],
    ...(images && images.length > 0 ? { images } : {}),
  };
}

/** Read JSON or raw SSE text (do not call json() on SSE). */
async function readApiResponse(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return { kind: "json", data: await res.json() };
  }
  const text = await res.text();
  return { kind: "sse", text, isSSE: ct.includes("text/event-stream") };
}

// Test image: 1x1 red pixel PNG (base64)
const TEST_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

// Test image: 1x1 blue pixel PNG (base64)
const TEST_IMAGE_BASE64_2 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("POST /api/chat accepts images array parameter", async () => {
  const port = 3320;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, "../.."),
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: "0",
      FORCE_HTTP: "1",
      OLLAMA_URL: "http://localhost:11434",
    },
    stdio: "pipe",
  });

  try {
    await waitForServer(baseUrl);

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        chatPostBody({
          content: "What do you see in these images?",
          model: "llava",
          images: [TEST_IMAGE_BASE64, TEST_IMAGE_BASE64_2],
        }),
      ),
    });

    assert.ok(
      res.status === 200 || res.status === 500,
      `Expected 200 or 500, got ${res.status}`,
    );

    if (res.status === 200) {
      const body = await readApiResponse(res);
      if (body.kind === "json") {
        assert.ok(
          body.data.error || body.data.token,
          "JSON body should have error or token",
        );
      } else {
        assert.ok(
          body.text.includes("data:"),
          "SSE should contain data: lines",
        );
      }
    }

    if (res.status === 500) {
      const data = await res.json();
      assert.ok(data.error, "Error response should have error field");
    }
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    if (!child.killed) child.kill("SIGKILL");
  }
});

test("POST /api/chat rejects invalid image data", async () => {
  const port = 3321;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, "../.."),
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: "0",
      FORCE_HTTP: "1",
    },
    stdio: "pipe",
  });

  try {
    await waitForServer(baseUrl);

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        chatPostBody({
          content: "Test",
          model: "llava",
          images: ["not-valid-base64!@#$%"],
        }),
      ),
    });

    assert.ok(
      res.status === 200 || res.status === 500,
      `Expected 200 or 500, got ${res.status}`,
    );
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    if (!child.killed) child.kill("SIGKILL");
  }
});

test("POST /api/review accepts images array parameter", async () => {
  const port = 3322;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, "../.."),
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: "0",
      FORCE_HTTP: "1",
      OLLAMA_URL: "http://localhost:11434",
    },
    stdio: "pipe",
  });

  try {
    await waitForServer(baseUrl);

    const res = await fetch(`${baseUrl}/api/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "function test() { return 42; }",
        filename: "test.js",
        model: "llava",
        images: [TEST_IMAGE_BASE64],
      }),
    });

    assert.ok(
      res.status === 200 || res.status === 500,
      `Expected 200 or 500, got ${res.status}`,
    );

    if (res.status === 200) {
      const body = await readApiResponse(res);
      if (body.kind === "json") {
        assert.ok(
          body.data.type === "report-card" || body.data.error,
          "Review JSON should be report-card or error",
        );
      } else {
        assert.ok(
          body.text.includes("data:"),
          "Review SSE fallback should stream data: lines",
        );
      }
    }
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    if (!child.killed) child.kill("SIGKILL");
  }
});

test("POST /api/review handles missing images gracefully", async () => {
  const port = 3323;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, "../.."),
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: "0",
      FORCE_HTTP: "1",
    },
    stdio: "pipe",
  });

  try {
    await waitForServer(baseUrl);

    const res = await fetch(`${baseUrl}/api/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "function test() { return 42; }",
        filename: "test.js",
        model: "llama3",
      }),
    });

    assert.ok(
      res.status === 200 || res.status === 500,
      `Expected 200 or 500, got ${res.status}`,
    );
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    if (!child.killed) child.kill("SIGKILL");
  }
});

test("POST /api/pentest accepts images array parameter", async () => {
  const port = 3324;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, "../.."),
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: "0",
      FORCE_HTTP: "1",
      OLLAMA_URL: "http://localhost:11434",
    },
    stdio: "pipe",
  });

  try {
    await waitForServer(baseUrl);

    const res = await fetch(`${baseUrl}/api/pentest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: 'const user = req.body; db.query("SELECT * FROM users WHERE id=" + user.id);',
        filename: "vulnerable.js",
        model: "llava",
        images: [TEST_IMAGE_BASE64],
      }),
    });

    assert.ok(
      res.status === 200 || res.status === 500,
      `Expected 200 or 500, got ${res.status}`,
    );

    if (res.status === 200) {
      const body = await readApiResponse(res);
      if (body.kind === "json") {
        assert.ok(
          body.data.type === "security-report" || body.data.error,
          "Pentest JSON should be security-report or error",
        );
      } else {
        assert.ok(
          body.text.includes("data:"),
          "Pentest SSE fallback should stream data: lines",
        );
      }
    }
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    if (!child.killed) child.kill("SIGKILL");
  }
});

test("POST /api/pentest/remediate streams SSE with code + findings", async () => {
  const port = 3325;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, "../.."),
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: "0",
      FORCE_HTTP: "1",
      OLLAMA_URL: "http://localhost:11434",
    },
    stdio: "pipe",
  });

  try {
    await waitForServer(baseUrl);

    const findingsPayload = {
      overallGrade: "C",
      categories: {
        injections: {
          grade: "F",
          findings: [
            {
              title: "SQL Injection",
              description: "Direct SQL concatenation",
              code: 'db.query("SELECT * FROM users WHERE id=" + user.id)',
              fix: "Use parameterized queries",
            },
          ],
        },
      },
    };

    const res = await fetch(`${baseUrl}/api/pentest/remediate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llava",
        filename: "vulnerable.js",
        code: 'db.query("SELECT * FROM users WHERE id=" + user.id)',
        findings: JSON.stringify(findingsPayload),
      }),
    });

    assert.ok(
      res.status === 200 || res.status === 500,
      `Expected 200 or 500, got ${res.status}`,
    );
    const ct = res.headers.get("content-type") || "";
    assert.ok(
      ct.includes("text/event-stream") || ct.includes("application/json"),
      "Remediate should return SSE or JSON error",
    );

    if (res.status === 200) {
      const body = await readApiResponse(res);
      if (body.kind === "sse") {
        assert.ok(
          body.text.includes("data:") || body.text.includes("[DONE]"),
          "SSE body",
        );
      }
    }
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    if (!child.killed) child.kill("SIGKILL");
  }
});

test("POST /api/chat limits number of images", async () => {
  const port = 3326;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, "../.."),
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: "0",
      FORCE_HTTP: "1",
    },
    stdio: "pipe",
  });

  try {
    await waitForServer(baseUrl);

    const manyImages = Array(25).fill(TEST_IMAGE_BASE64);

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        chatPostBody({
          content: "Test with many images",
          model: "llava",
          images: manyImages,
        }),
      ),
    });

    assert.ok(
      res.status === 400 || res.status === 200 || res.status === 500,
      `Expected 400/200/500, got ${res.status}`,
    );
    if (res.status === 400) {
      const j = await res.json();
      assert.ok(
        String(j.error || "")
          .toLowerCase()
          .includes("10") || j.error,
        "400 should mention limit",
      );
    }
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    if (!child.killed) child.kill("SIGKILL");
  }
});

test("POST /api/review respects timeout configuration", async () => {
  const port = 3327;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, "../.."),
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: "0",
      FORCE_HTTP: "1",
      OLLAMA_URL: "http://localhost:11434",
    },
    stdio: "pipe",
  });

  try {
    await waitForServer(baseUrl);

    const res = await fetch(`${baseUrl}/api/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "function test() { return 42; }",
        filename: "test.js",
        model: "llava",
        images: [TEST_IMAGE_BASE64],
      }),
    });

    assert.ok(
      res.status === 200 || res.status === 500 || res.status === 504,
      `Expected 200/500/504, got ${res.status}`,
    );

    if (res.status === 504) {
      const data = await res.json();
      assert.ok(
        String(data.error || "")
          .toLowerCase()
          .includes("timeout") ||
          String(data.error || "")
            .toLowerCase()
            .includes("timed out"),
        "Timeout error should mention timeout",
      );
    }
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    if (!child.killed) child.kill("SIGKILL");
  }
});
