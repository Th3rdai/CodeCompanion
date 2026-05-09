const { test } = require("node:test");
const assert = require("node:assert");
const {
  normalizeVisionImages,
  messagesWithImagesOnLastUser,
} = require("../../lib/ollama-client.js");

test("normalizeVisionImages strips data URL prefix", () => {
  const raw = "abc123";
  assert.strictEqual(
    normalizeVisionImages([
      "data:image/png;base64,AAA",
      raw,
      "data:image/jpeg;base64,BBB",
    ]).join(","),
    "AAA,abc123,BBB",
  );
});

test("messagesWithImagesOnLastUser targets last user, not assistant", () => {
  const msgs = [
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "user", content: "with pic" },
  ];
  const out = messagesWithImagesOnLastUser(msgs, ["imgb64"]);
  assert.strictEqual(out[2].images[0], "imgb64");
  assert.strictEqual(out[2].content, "with pic");
  assert.strictEqual(out[1].images, undefined);
});

test("messagesWithImagesOnLastUser skips tool recovery stub user", () => {
  const recovery =
    "Recovery mode: this request previously stalled. Output exactly one executable TOOL_CALL";
  const msgs = [
    { role: "user", content: "real question" },
    { role: "assistant", content: "ok" },
    { role: "user", content: recovery },
  ];
  const out = messagesWithImagesOnLastUser(msgs, ["imgb64"]);
  assert.deepStrictEqual(out[0].images, ["imgb64"]);
  assert.strictEqual(out[2].images, undefined);
});
