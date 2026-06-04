/**
 * Dispatch-seam guards (OPNRTR.md):
 *  - The Ollama chat path must never leak the `__cc*` provider-sentinel fields
 *    onto the wire (forward-looking regression guard against someone later
 *    spreading restOpts into the request body).
 *  - `embed` is intentionally NOT provider-aware: Memory stays Ollama-bound even
 *    if a provider bag is passed, so embeddings must always hit /api/embed.
 *  - ollamaAuthOpts produces the OpenRouter sentinel bag for an OpenRouter
 *    config and a plain {apiKey}/{} bag for Ollama.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");

const oc = require("../../lib/ollama-client.js");

const enc = new TextEncoder();
function emptyStream() {
  return new ReadableStream({
    start(c) {
      c.enqueue(enc.encode('{"message":{"content":""},"done":true}\n'));
      c.close();
    },
  });
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

test("ollamaAuthOpts: provider-aware sentinel bag", () => {
  assert.deepEqual(oc.ollamaAuthOpts({}), {});
  assert.deepEqual(oc.ollamaAuthOpts({ ollamaApiKey: "k" }), { apiKey: "k" });
  const or = oc.ollamaAuthOpts({
    provider: "openrouter",
    openrouterApiKey: "sk-or",
    openrouterUrl: "https://openrouter.ai/api/v1",
  });
  assert.equal(or.__ccProvider, "openrouter");
  assert.equal(or.__ccOpenrouterApiKey, "sk-or");
});

test("dispatch: Ollama chatStream body never contains __cc* keys", async () => {
  let captured = null;
  let capturedUrl = null;
  await withFetch(
    async (url, init) => {
      capturedUrl = url;
      captured = JSON.parse(init.body);
      return { ok: true, status: 200, body: emptyStream() };
    },
    async () => {
      // A malformed bag with stray __cc* fields but provider !== "openrouter"
      // stays on the Ollama path — those fields must not reach the wire.
      await oc.chatStream(
        "http://127.0.0.1:11434",
        "qwen3-32k",
        [{ role: "user", content: "hi" }],
        [],
        {
          num_ctx: 2048,
          temperature: 0.2,
          __ccProvider: "ollama",
          __ccOpenrouterApiKey: "SHOULD-NOT-LEAK",
          __ccOpenrouterUrl: "https://evil.example",
        },
      );
    },
  );
  assert.match(capturedUrl, /\/api\/chat$/, "stayed on the Ollama endpoint");
  const serialized = JSON.stringify(captured);
  assert.ok(
    !serialized.includes("SHOULD-NOT-LEAK"),
    "OpenRouter key must not leak into the Ollama body",
  );
  assert.ok(!("__ccProvider" in captured));
  assert.ok(!("__ccOpenrouterApiKey" in captured));
  assert.ok(!("__ccOpenrouterUrl" in captured));
  // Sanity: the legitimate options still made it through.
  assert.equal(captured.options.num_ctx, 2048);
  assert.equal(captured.options.temperature, 0.2);
});

test("embed: ignores the provider field and always hits Ollama /api/embed", async () => {
  let capturedUrl = null;
  await withFetch(
    async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({ embeddings: [[1, 2, 3]] }),
      };
    },
    async () => {
      const vec = await oc.embed(
        "http://127.0.0.1:11434",
        "text",
        "nomic-embed-text",
        {
          // Even if a provider bag sneaks in, embeddings stay on Ollama.
          __ccProvider: "openrouter",
          __ccOpenrouterApiKey: "sk-or",
        },
      );
      assert.deepEqual(vec, [1, 2, 3]);
    },
  );
  assert.match(capturedUrl, /\/api\/embed$/, "embeddings must stay on Ollama");
});

test("dispatch: chatStream routes to OpenRouter only when __ccProvider === 'openrouter'", async () => {
  let capturedUrl = null;
  await withFetch(
    async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, body: emptyStream() };
    },
    async () => {
      await oc.chatStream(
        "http://127.0.0.1:11434", // Ollama URL is ignored on the OR path
        "anthropic/claude-3.5-sonnet",
        [{ role: "user", content: "hi" }],
        [],
        {
          __ccProvider: "openrouter",
          __ccOpenrouterApiKey: "sk-or",
          __ccOpenrouterUrl: "https://openrouter.ai/api/v1",
        },
      );
    },
  );
  assert.match(
    capturedUrl,
    /openrouter\.ai\/api\/v1\/chat\/completions$/,
    "must dispatch to the OpenRouter endpoint, not Ollama",
  );
});
