/**
 * Unit tests for lib/openrouter-client.js (OPNRTR.md).
 *
 * Covers the SSE→NDJSON stream adapter (buffering, [DONE], reasoning-drop,
 * mid-stream error), error mapping with the preserved `Ollama error:` prefix,
 * vision message placement, listModels shape, checkConnection, and the
 * provider-aware user-error copy.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const orc = require("../../lib/openrouter-client");
const { parseOllamaErrMsg } = require("../../lib/ollama-client");

const OPTS = {
  __ccProvider: "openrouter",
  __ccOpenrouterApiKey: "sk-or-test",
  __ccOpenrouterUrl: "https://openrouter.ai/api/v1",
};

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Build a web ReadableStream that emits the given string chunks as bytes. */
function streamFromChunks(chunks) {
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
}

async function drainNdjson(stream) {
  const reader = stream.getReader();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
  }
  return buf
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

function withFetch(stub, fn) {
  const orig = global.fetch;
  global.fetch = stub;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      global.fetch = orig;
    });
}

// ── SSE → NDJSON adapter ─────────────────────────────────────────────────────

test("adapter: buffers a JSON object split across two transform calls", async () => {
  const chunks = [
    'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
    'data: {"choices":[{"delta":{"con', // split mid-object
    'tent":"lo"}}]}\n',
    "data: [DONE]\n",
  ];
  const frames = await drainNdjson(
    streamFromChunks(chunks).pipeThrough(orc.makeSseToNdjsonStream()),
  );
  const tokens = frames.filter((f) => !f.done).map((f) => f.message.content);
  assert.deepEqual(tokens, ["Hel", "lo"]);
  const done = frames.filter((f) => f.done);
  assert.equal(done.length, 1, "exactly one done frame");
  assert.equal(done[0].message.content, "");
});

test("adapter: skips keep-alive comments and drops delta.reasoning", async () => {
  const chunks = [
    ": OPENROUTER PROCESSING\n",
    'data: {"choices":[{"delta":{"reasoning":"thinking..."}}]}\n',
    'data: {"choices":[{"delta":{"content":"hi"}}]}\n',
    "data: [DONE]\n",
  ];
  const frames = await drainNdjson(
    streamFromChunks(chunks).pipeThrough(orc.makeSseToNdjsonStream()),
  );
  const tokens = frames.filter((f) => !f.done).map((f) => f.message.content);
  assert.deepEqual(tokens, ["hi"], "reasoning dropped, comment skipped");
});

test("adapter: terminal done frame emitted on flush when upstream closes without [DONE]", async () => {
  const chunks = ['data: {"choices":[{"delta":{"content":"x"}}]}\n'];
  const frames = await drainNdjson(
    streamFromChunks(chunks).pipeThrough(orc.makeSseToNdjsonStream()),
  );
  assert.equal(frames.filter((f) => f.done).length, 1);
});

test("adapter: mid-stream {error} surfaces a visible error token then a single done frame", async () => {
  const chunks = [
    'data: {"choices":[{"delta":{"content":"partial"}}]}\n',
    'data: {"error":{"message":"upstream blew up"}}\n',
    'data: {"choices":[{"delta":{"content":"never"}}]}\n',
  ];
  const frames = await drainNdjson(
    streamFromChunks(chunks).pipeThrough(orc.makeSseToNdjsonStream()),
  );
  const tokens = frames.filter((f) => !f.done).map((f) => f.message.content);
  // The partial content plus a visible error marker — never silently truncated.
  assert.deepEqual(tokens, [
    "partial",
    "\n\n[OpenRouter error: upstream blew up]",
  ]);
  assert.ok(
    !tokens.some((t) => t.includes("never")),
    "no tokens emitted after the error frame",
  );
  assert.equal(frames.filter((f) => f.done).length, 1);
});

// ── chatStream ───────────────────────────────────────────────────────────────

test("chatStream: 200 → Response-like with NDJSON body; never sends a tools array", async () => {
  let captured = null;
  await withFetch(
    async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        status: 200,
        body: streamFromChunks([
          'data: {"choices":[{"delta":{"content":"yo"}}]}\n',
          "data: [DONE]\n",
        ]),
      };
    },
    async () => {
      const res = await orc.chatStream(
        "anthropic/claude-3.5-sonnet",
        [{ role: "user", content: "hi" }],
        [],
        { ...OPTS, temperature: 0.5 },
      );
      assert.equal(res.ok, true);
      const frames = await drainNdjson(res.body);
      assert.deepEqual(
        frames.filter((f) => !f.done).map((f) => f.message.content),
        ["yo"],
      );
      // Request hygiene: correct endpoint, stream:true, NO tools/tool_choice.
      assert.match(captured.url, /\/chat\/completions$/);
      const body = JSON.parse(captured.init.body);
      assert.equal(body.stream, true);
      assert.equal(body.temperature, 0.5);
      assert.ok(!("tools" in body), "must not send tools");
      assert.ok(!("tool_choice" in body), "must not send tool_choice");
      assert.ok(!("functions" in body), "must not send functions");
      assert.ok(!("max_tokens" in body), "must not cap max_tokens");
      assert.ok(!("num_ctx" in body), "must not send Ollama num_ctx");
      assert.equal(captured.init.headers.Authorization, "Bearer sk-or-test");
    },
  );
});

test("chatStream: non-200 returns { ok:false, status, text() } and no body", async () => {
  await withFetch(
    async () => ({
      ok: false,
      status: 401,
      text: async () => '{"error":{"message":"No auth credentials found"}}',
    }),
    async () => {
      const res = await orc.chatStream(
        "m",
        [{ role: "user", content: "x" }],
        [],
        OPTS,
      );
      assert.equal(res.ok, false);
      assert.equal(res.status, 401);
      assert.ok(!res.body, "no body on the error path");
      assert.match(await res.text(), /No auth credentials/);
    },
  );
});

// ── chatComplete ─────────────────────────────────────────────────────────────

test("chatComplete: returns assistant content on 200", async () => {
  await withFetch(
    async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "done" } }] }),
    }),
    async () => {
      const out = await orc.chatComplete(
        "m",
        [{ role: "user", content: "x" }],
        60000,
        [],
        OPTS,
      );
      assert.equal(out, "done");
    },
  );
});

test("chatComplete: non-200 throws with the preserved 'Ollama error: NNN' prefix", async () => {
  await withFetch(
    async () => ({
      ok: false,
      status: 402,
      text: async () => '{"error":{"message":"Insufficient credits"}}',
    }),
    async () => {
      await assert.rejects(
        () =>
          orc.chatComplete(
            "m",
            [{ role: "user", content: "x" }],
            60000,
            [],
            OPTS,
          ),
        (err) => {
          // The shared parser must still extract the status from the message.
          const parsed = parseOllamaErrMsg(err.message);
          assert.equal(parsed.status, 402);
          assert.match(err.message, /Ollama error: 402/);
          assert.match(err.message, /Insufficient credits/);
          return true;
        },
      );
    },
  );
});

// ── chatStructured ───────────────────────────────────────────────────────────

test("chatStructured: strips markdown fences and parses JSON", async () => {
  let captured = null;
  await withFetch(
    async (url, init) => {
      captured = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '```json\n{"grade":"A"}\n```' } }],
        }),
      };
    },
    async () => {
      const out = await orc.chatStructured(
        "m",
        [{ role: "user", content: "score" }],
        { type: "object" },
        60000,
        [],
        OPTS,
      );
      assert.deepEqual(out, { grade: "A" });
      // response_format json_object + temperature 0; no tools.
      assert.equal(captured.response_format.type, "json_object");
      assert.equal(captured.temperature, 0);
      assert.ok(!("tools" in captured));
    },
  );
});

// ── toOpenAiMessages ─────────────────────────────────────────────────────────

test("toOpenAiMessages: places images on the last user turn as data-URL parts", () => {
  const msgs = [
    { role: "system", content: "sys" },
    { role: "user", content: "look" },
    { role: "assistant", content: "ok" },
    { role: "user", content: "and this" },
  ];
  const out = orc.toOpenAiMessages(msgs, ["data:image/jpeg;base64,AAAA"]);
  assert.equal(out[3].role, "user");
  assert.ok(Array.isArray(out[3].content));
  assert.equal(out[3].content[0].type, "text");
  assert.equal(out[3].content[1].type, "image_url");
  assert.equal(out[3].content[1].image_url.url, "data:image/jpeg;base64,AAAA");
  // Earlier user turn stays a plain string.
  assert.equal(out[1].content, "look");
});

test("toOpenAiMessages: bare base64 gets a data: prefix", () => {
  const out = orc.toOpenAiMessages([{ role: "user", content: "x" }], ["BBBB"]);
  assert.match(
    out[0].content[1].image_url.url,
    /^data:image\/png;base64,BBBB$/,
  );
});

// ── listModels ───────────────────────────────────────────────────────────────

test("listModels: maps catalog shape (no /api/show), sorts largest-context first", async () => {
  orc.invalidateListModelsCache();
  await withFetch(
    async (url) => {
      assert.match(url, /\/models$/);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: "openai/gpt-4o-mini",
              context_length: 128000,
              architecture: { input_modalities: ["text"] },
            },
            {
              id: "anthropic/claude-3.5-sonnet",
              context_length: 200000,
              architecture: { input_modalities: ["text", "image"] },
            },
          ],
        }),
      };
    },
    async () => {
      const models = await orc.listModels(OPTS);
      assert.equal(models[0].name, "anthropic/claude-3.5-sonnet");
      assert.equal(models[0].family, "anthropic");
      assert.equal(models[0].supportsVision, true);
      assert.equal(models[0].contextLength, 200000);
      assert.equal(models[0].size, 0);
      assert.equal(models[0].paramSize, "200K ctx");
      assert.equal(models[1].supportsVision, false);
    },
  );
  orc.invalidateListModelsCache();
});

test("listModels: throws on non-200 (so /api/models reports connected:false)", async () => {
  orc.invalidateListModelsCache();
  await withFetch(
    async () => ({ ok: false, status: 401, text: async () => "Unauthorized" }),
    async () => {
      await assert.rejects(() => orc.listModels(OPTS), /401/);
    },
  );
  orc.invalidateListModelsCache();
});

test("checkConnection: connected + modelCount on 200; false on error", async () => {
  await withFetch(
    async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{}, {}, {}] }),
    }),
    async () => {
      assert.deepEqual(await orc.checkConnection(OPTS), {
        connected: true,
        modelCount: 3,
      });
    },
  );
  await withFetch(
    async () => ({ ok: false, status: 500, json: async () => ({}) }),
    async () => {
      assert.deepEqual(await orc.checkConnection(OPTS), {
        connected: false,
        modelCount: 0,
      });
    },
  );
});

// ── formatUserOpenrouterChatError ────────────────────────────────────────────

test("formatUserOpenrouterChatError: maps 401/402/429/404/context/generic", () => {
  assert.match(
    orc.formatUserOpenrouterChatError({ status: 401, detail: "no key" }),
    /401|API key/i,
  );
  assert.match(
    orc.formatUserOpenrouterChatError({ status: 402, detail: "" }),
    /credit/i,
  );
  assert.match(
    orc.formatUserOpenrouterChatError({ status: 429, detail: "" }),
    /rate limit/i,
  );
  assert.match(
    orc.formatUserOpenrouterChatError({ status: 404, detail: "" }),
    /model/i,
  );
  assert.match(
    orc.formatUserOpenrouterChatError({
      status: 400,
      detail: "maximum context length exceeded",
    }),
    /context/i,
  );
  // Generic falls back to the detail text.
  assert.match(
    orc.formatUserOpenrouterChatError({ status: 500, detail: "weird thing" }),
    /weird thing/,
  );
});

// ── timeout vs abort (real hanging server) ───────────────────────────────────

function startHangingServer() {
  const server = http.createServer(() => {});
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(server)),
  );
}

test("chatComplete: own timeout throws TimeoutError, not AbortError", async () => {
  const server = await startHangingServer();
  const { port } = server.address();
  try {
    await assert.rejects(
      () =>
        orc.chatComplete("m", [{ role: "user", content: "hi" }], 200, [], {
          ...OPTS,
          __ccOpenrouterUrl: `http://127.0.0.1:${port}`,
        }),
      (err) => {
        assert.notEqual(err.name, "AbortError");
        assert.match(err.message, /timed out/i);
        return true;
      },
    );
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});

test("chatComplete: external abortSignal stays an AbortError (real Stop)", async () => {
  const server = await startHangingServer();
  const { port } = server.address();
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 100);
  try {
    await assert.rejects(
      () =>
        orc.chatComplete("m", [{ role: "user", content: "hi" }], 60000, [], {
          ...OPTS,
          __ccOpenrouterUrl: `http://127.0.0.1:${port}`,
          abortSignal: ac.signal,
        }),
      (err) => {
        assert.equal(err.name, "AbortError");
        return true;
      },
    );
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});
