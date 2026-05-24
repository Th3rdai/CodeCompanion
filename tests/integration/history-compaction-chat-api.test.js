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

async function startMockOllama() {
  const chatCalls = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "POST" && url.pathname === "/api/chat") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        const payload = JSON.parse(body || "{}");
        chatCalls.push(payload);
        if (payload.stream) {
          res.writeHead(200, { "Content-Type": "application/x-ndjson" });
          res.end(
            `${JSON.stringify({ message: { role: "assistant", content: "ok" }, done: false })}\n${JSON.stringify({ done: true })}\n`,
          );
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            message: {
              role: "assistant",
              content: "Compacted summary from mock.",
            },
            done: true,
          }),
        );
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/tags") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          models: [{ name: "tiny-local:latest", details: { family: "llama" } }],
        }),
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/show") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ model_info: { "llama.context_length": 4096 } }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  return { server, baseUrl, chatCalls };
}

test("POST /api/chat compaction emits summary notice and rebuilds dual-system transcript", async () => {
  const {
    server: ollamaMock,
    baseUrl: ollamaUrl,
    chatCalls,
  } = await startMockOllama();
  const port = 3412;
  const baseUrl = `http://127.0.0.1:${port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-compaction-"));
  fs.writeFileSync(
    path.join(root, ".cc-config.json"),
    JSON.stringify(
      {
        ollamaUrl,
        enableHistoryCompaction: true,
        historyCompactKeepRecent: 3,
        historyCompactMaxSummaryChars: 500,
        numCtx: 256,
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
    const fatTurn = "x".repeat(1000);
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `${i}:${fatTurn}`,
    }));
    history.push({ role: "user", content: "What should we do next?" });

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "tiny-local:latest",
        mode: "chat",
        messages: history,
      }),
    });

    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") || "", /text\/event-stream/);
    const sseText = await res.text();
    assert.match(sseText, /"kind":"compaction_summary"/);
    assert.doesNotMatch(sseText, /"kind":"compaction_fallback"/);
    assert.doesNotMatch(sseText, /"kind":"compaction_skipped"/);

    const summaryCall = chatCalls.find(
      (call) =>
        call.stream === false &&
        Array.isArray(call.messages) &&
        call.messages[0]?.role === "system" &&
        String(call.messages[0]?.content || "").includes(
          "You summarize prior conversation turns for context preservation.",
        ),
    );
    const streamCall = chatCalls.find((call) => call.stream === true);
    const inferenceCall =
      streamCall ||
      chatCalls.find(
        (call) => call !== summaryCall && Array.isArray(call.messages),
      );
    assert.ok(summaryCall, "expected summarizer call");
    assert.ok(inferenceCall, "expected final inference call");

    const sent = inferenceCall.messages || [];
    assert.ok(sent.length >= 3, "expected rebuilt transcript");
    assert.equal(sent[0].role, "system");
    assert.equal(sent[1].role, "system");
    assert.equal(sent[1]._kind, "compaction_summary");
    assert.equal(sent[1].content, "Compacted summary from mock.");
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    if (!child.killed) child.kill("SIGKILL");
    await new Promise((resolve) => ollamaMock.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
