/**
 * Integration test for the OpenRouter provider toggle (OPNRTR.md).
 *
 * Spins up a mock OpenRouter server (GET /models, POST /chat/completions SSE)
 * and a Code Companion server configured with provider:"openrouter" pointed at
 * the mock. Asserts:
 *   - GET /api/models → catalog mapped to the app shape, connected, provider.
 *   - POST /api/chat  → OpenAI SSE is adapted and streamed to the client as
 *     token events terminated by [DONE]; the upstream request carries the model
 *     and an Authorization header and NO `tools` array.
 *   - GET /api/model-context?name=… → context length sourced from the OR catalog.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const http = require("node:http");
const { spawn } = require("node:child_process");

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
  throw new Error("Server did not become ready");
}

const OR_CATALOG = [
  {
    id: "anthropic/claude-3.5-sonnet",
    context_length: 200000,
    architecture: { input_modalities: ["text"] },
  },
  {
    id: "openai/gpt-4o",
    context_length: 128000,
    architecture: { input_modalities: ["text", "image"] },
  },
];

async function startMockOpenRouter() {
  const chatCalls = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname.endsWith("/models")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: OR_CATALOG }));
      return;
    }
    if (req.method === "POST" && url.pathname.endsWith("/chat/completions")) {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const payload = JSON.parse(body || "{}");
        chatCalls.push({ payload, auth: req.headers.authorization });
        if (payload.stream) {
          res.writeHead(200, { "Content-Type": "text/event-stream" });
          res.write('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n');
          res.write('data: {"choices":[{"delta":{"content":" world"}}]}\n\n');
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }
        // Non-stream (chatComplete / chatStructured) path returns OpenAI JSON.
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [
              { message: { role: "assistant", content: "Hello world" } },
            ],
          }),
        );
      });
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  return { server, baseUrl: `http://127.0.0.1:${addr.port}`, chatCalls };
}

test("OpenRouter provider: /api/models, /api/chat streaming, /api/model-context", async () => {
  const {
    server: orMock,
    baseUrl: orUrl,
    chatCalls,
  } = await startMockOpenRouter();
  const port = 3414;
  const baseUrl = `http://127.0.0.1:${port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-openrouter-"));
  fs.writeFileSync(
    path.join(root, ".cc-config.json"),
    JSON.stringify(
      {
        provider: "openrouter",
        openrouterUrl: orUrl,
        openrouterApiKey: "sk-or-test-key",
        // Keep Ollama pointed somewhere dead — the OR path must not touch it.
        ollamaUrl: "http://127.0.0.1:65535",
        enablePreflightBanner: false,
        // Disable agent tools so chat takes the standard streaming path (exercises
        // the SSE→NDJSON adapter) rather than the chatComplete tool-loop.
        agentValidate: { enabled: false },
        agentPlanner: { enabled: false },
        agentAppSkills: { enabled: false },
        agentTerminal: { enabled: false },
        agentBrowser: { enabled: false },
        mcpClients: [],
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
      // Ensure no real key bleeds in from the dev environment.
      OPENROUTER_API_KEY: "",
    },
    stdio: "pipe",
  });

  try {
    await waitForServer(baseUrl);

    // 1) GET /api/models — mapped shape + connected + provider.
    const modelsRes = await fetch(`${baseUrl}/api/models`);
    assert.equal(modelsRes.status, 200);
    const modelsData = await modelsRes.json();
    assert.equal(modelsData.connected, true);
    assert.equal(modelsData.provider, "openrouter");
    const sonnet = modelsData.models.find(
      (m) => m.name === "anthropic/claude-3.5-sonnet",
    );
    assert.ok(sonnet, "catalog includes claude sonnet");
    assert.equal(sonnet.contextLength, 200000);
    assert.equal(sonnet.size, 0);
    assert.equal(sonnet.family, "anthropic");
    const gpt4o = modelsData.models.find((m) => m.name === "openai/gpt-4o");
    assert.equal(gpt4o.supportsVision, true);

    // 2) POST /api/chat — SSE adapted + streamed + [DONE]; upstream hygiene.
    const chatRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        mode: "chat",
        messages: [{ role: "user", content: "say hello" }],
      }),
    });
    assert.equal(chatRes.status, 200);
    assert.match(
      chatRes.headers.get("content-type") || "",
      /text\/event-stream/,
    );
    const sseText = await chatRes.text();
    // The chunk sanitizer may re-split token boundaries, so assert the assembled
    // visible text rather than exact per-token frames.
    const tokens = [...sseText.matchAll(/"token":"((?:[^"\\]|\\.)*)"/g)].map(
      (m) => JSON.parse(`"${m[1]}"`),
    );
    assert.equal(
      tokens.join(""),
      "Hello world",
      "OpenRouter SSE streamed through",
    );
    assert.match(sseText, /data: \[DONE\]/);

    // At least one upstream chat request carried the model + auth and NO tools.
    const orChatCall = chatCalls.find(
      (c) => c.payload && c.payload.model === "anthropic/claude-3.5-sonnet",
    );
    assert.ok(orChatCall, "OR received a chat request for the chosen model");
    assert.equal(orChatCall.auth, "Bearer sk-or-test-key");
    assert.ok(!("tools" in orChatCall.payload), "no tools array sent to OR");
    assert.ok(
      !("num_ctx" in orChatCall.payload),
      "no Ollama num_ctx sent to OR",
    );

    // 3) GET /api/model-context — context length from the OR catalog.
    const ctxRes = await fetch(
      `${baseUrl}/api/model-context?name=${encodeURIComponent("anthropic/claude-3.5-sonnet")}`,
    );
    assert.equal(ctxRes.status, 200);
    const ctx = await ctxRes.json();
    assert.equal(ctx.contextLength, 200000);
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    if (!child.killed) child.kill("SIGKILL");
    await new Promise((resolve) => orMock.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
