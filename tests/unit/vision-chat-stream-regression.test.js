/**
 * Locks vision-in-chat behavior: chatStream must send images in the JSON body
 * on the correct user message, and the agent-tool streaming fallback must keep
 * the 5-argument chatStream call (never a token callback as 4th arg).
 */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const { chatStream } = require("../../lib/ollama-client.js");

const HANDLER_PATH = path.join(__dirname, "../../lib/chat-post-handler.js");

test("chatStream JSON body includes images on last user message", async () => {
  const original = global.fetch;
  let captured;
  global.fetch = async (_url, init) => {
    captured = JSON.parse(init.body);
    return {
      ok: true,
      body: {
        getReader() {
          return { read: async () => ({ done: true, value: undefined }) };
        },
      },
    };
  };
  try {
    const res = await chatStream(
      "http://127.0.0.1:11434",
      "llava:latest",
      [
        { role: "user", content: "first" },
        { role: "assistant", content: "ok" },
        { role: "user", content: "describe this" },
      ],
      ["imgb64payload"],
      {},
    );
    assert.strictEqual(res.ok, true);
    assert.strictEqual(captured.model, "llava:latest");
    assert.strictEqual(captured.stream, true);
    const msgs = captured.messages;
    assert.strictEqual(msgs.length, 3);
    assert.strictEqual(msgs[0].images, undefined);
    assert.strictEqual(msgs[1].images, undefined);
    assert.deepStrictEqual(msgs[2].images, ["imgb64payload"]);
  } finally {
    global.fetch = original;
  }
});

test("chat-post-handler agent fallback calls chatStream with images as 4th argument", () => {
  const src = fs.readFileSync(HANDLER_PATH, "utf8");
  const re = /await\s+chatStream\s*\(\s*config\.ollamaUrl\s*,\s*model\s*,\s*fallbackMessages\s*,\s*images\s*\|\|\s*\[\]\s*,\s*\{/;
  assert.ok(
    re.test(src),
    "agent streaming fallback must stay chatStream(url, model, fallbackMessages, images||[], {…}) — see lib/ollama-client.js chatStream JSDoc",
  );
});
