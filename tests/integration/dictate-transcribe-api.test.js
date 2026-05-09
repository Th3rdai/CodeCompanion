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

/** Tiny valid mono PCM WAV (44.1kHz, ~100ms silence) — Groq accepts wav. */
function tinyWavBuffer() {
  const sampleRate = 44100;
  const numSamples = 4096;
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

test("POST /api/dictate-transcribe: 503 when Groq not configured", async () => {
  const port = 18440 + Math.floor(Math.random() * 500);
  const baseUrl = `http://127.0.0.1:${port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-dict-"));
  fs.writeFileSync(
    path.join(root, ".cc-config.json"),
    JSON.stringify(
      { memory: { enabled: false, autoExtract: false }, dictateGroqApiKey: "" },
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
      FORCE_HTTP: "1",
      CC_SKIP_MCP_AUTOCONNECT: "1",
      // Prevent repo .env GROQ_* from enabling dictation in this child (dotenv won't override set vars).
      GROQ_API_KEY: "",
      DICTATE_GROQ_API_KEY: "",
    },
    stdio: "ignore",
  });

  try {
    await waitForServer(baseUrl);
    const res = await fetchWithRetry(`${baseUrl}/api/dictate-transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64: Buffer.from("x").toString("base64"),
        mimeType: "audio/wav",
      }),
    });
    assert.equal(res.status, 503);
    const j = await res.json();
    assert.equal(j.code, "DICTATE_NOT_CONFIGURED");
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    try {
      child.kill("SIGKILL");
    } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("POST /api/dictate-transcribe: 400 when audioBase64 missing", async () => {
  const port = 19440 + Math.floor(Math.random() * 500);
  const baseUrl = `http://127.0.0.1:${port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-dict2-"));
  fs.writeFileSync(
    path.join(root, ".cc-config.json"),
    JSON.stringify(
      {
        memory: { enabled: false, autoExtract: false },
        dictateGroqApiKey: "gsk_dummy_so_validation_runs_before_groq_call",
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
      FORCE_HTTP: "1",
      CC_SKIP_MCP_AUTOCONNECT: "1",
      GROQ_API_KEY: "",
      DICTATE_GROQ_API_KEY: "",
    },
    stdio: "ignore",
  });

  try {
    await waitForServer(baseUrl);
    const res = await fetch(`${baseUrl}/api/dictate-transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType: "audio/wav" }),
    });
    assert.equal(res.status, 400);
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    try {
      child.kill("SIGKILL");
    } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("POST /api/dictate-transcribe: reaches Groq when key set (502 on invalid key)", async () => {
  const port = 20440 + Math.floor(Math.random() * 500);
  const baseUrl = `http://127.0.0.1:${port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-dict3-"));
  fs.writeFileSync(
    path.join(root, ".cc-config.json"),
    JSON.stringify(
      {
        memory: { enabled: false, autoExtract: false },
        dictateGroqApiKey: "gsk_invalid_fake_key_for_integration_test",
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
      FORCE_HTTP: "1",
      CC_SKIP_MCP_AUTOCONNECT: "1",
      GROQ_API_KEY: "",
      DICTATE_GROQ_API_KEY: "",
    },
    stdio: "ignore",
  });

  try {
    await waitForServer(baseUrl);
    const wav = tinyWavBuffer();
    const res = await fetchWithRetry(`${baseUrl}/api/dictate-transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64: wav.toString("base64"),
        mimeType: "audio/wav",
      }),
    });
    assert.ok(
      res.status === 502,
      `expected 502 from Groq with invalid key, got ${res.status}`,
    );
    if (res.status === 502) {
      const j = await res.json();
      assert.equal(j.code, "DICTATE_FAILED");
      assert.ok(String(j.error || "").length > 0);
    }
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    try {
      child.kill("SIGKILL");
    } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  }
});
