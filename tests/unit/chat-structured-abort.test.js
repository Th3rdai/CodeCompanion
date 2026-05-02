const { test } = require("node:test");
const assert = require("node:assert/strict");

test("chatStructured aborts in-flight fetch when abortSignal fires early", async () => {
  const { chatStructured } = require("../../lib/ollama-client.js");
  const originalFetch = global.fetch;
  const ac = new AbortController();
  try {
    global.fetch = (url, opts) =>
      new Promise((resolve, reject) => {
        const sig = opts.signal;
        const onAbort = () => {
          reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
        };
        if (sig.aborted) {
          onAbort();
          return;
        }
        sig.addEventListener("abort", onAbort, { once: true });
        setTimeout(() => {
          sig.removeEventListener("abort", onAbort);
          resolve(
            new Response(JSON.stringify({ message: { content: "{}" } }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }, 3000);
      });

    setTimeout(() => ac.abort(), 30);

    const started = Date.now();
    await assert.rejects(
      () =>
        chatStructured(
          "http://127.0.0.1:11434",
          "dummy",
          [{ role: "user", content: "x" }],
          {},
          600000,
          [],
          { abortSignal: ac.signal },
        ),
      /AbortError|aborted/i,
    );
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 500, `expected abort within 500ms, took ${elapsed}ms`);
  } finally {
    global.fetch = originalFetch;
  }
});
