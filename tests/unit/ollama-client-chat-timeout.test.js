const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveChatTimeoutMs,
  VISION_CHAT_TIMEOUT_MIN_MS,
} = require("../../lib/ollama-client.js");

test("resolveChatTimeoutMs applies vision floor by default", () => {
  assert.equal(
    resolveChatTimeoutMs(90_000, ["img"]),
    VISION_CHAT_TIMEOUT_MIN_MS,
  );
  assert.equal(resolveChatTimeoutMs(400_000, ["img"]), 400_000);
});

test("resolveChatTimeoutMs honors explicit cap for slow-model self-heal with images", () => {
  assert.equal(
    resolveChatTimeoutMs(90_000, ["img"], { honorExplicitTimeout: true }),
    90_000,
  );
});

test("resolveChatTimeoutMs leaves non-vision timeouts unchanged", () => {
  assert.equal(resolveChatTimeoutMs(90_000, []), 90_000);
  assert.equal(
    resolveChatTimeoutMs(90_000, [], { honorExplicitTimeout: true }),
    90_000,
  );
});
