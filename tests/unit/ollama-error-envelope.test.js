/**
 * Tests for Ollama failure parsing + user-facing summaries.
 */

const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  parseOllamaErrMsg,
  formatUserOllamaChatError,
} = require("../../lib/ollama-client.js");

test("parseOllamaErrMsg extracts status and JSON error detail after em-dash", () => {
  const err =
    "Ollama error: 500 — model runner has unexpectedly stopped, CUDA error";
  assert.deepStrictEqual(parseOllamaErrMsg(err), {
    status: 500,
    detail: "model runner has unexpectedly stopped, CUDA error",
  });
});

test("parseOllamaErrMsg parses hyphen delimiter", () => {
  const err = "Ollama error: 400 - unsupported model architecture";
  assert.deepStrictEqual(parseOllamaErrMsg(err), {
    status: 400,
    detail: "unsupported model architecture",
  });
});

test("parseOllamaErrMsg unknown shape returns zeros", () => {
  assert.deepStrictEqual(parseOllamaErrMsg("fetch failed"), {
    status: 0,
    detail: "",
  });
});

test("formatUserOllamaChatError maps GPU-ish detail", () => {
  const s = formatUserOllamaChatError({
    status: 500,
    detail: "CUDA out of memory",
    totalChars: 1000,
  });
  assert.match(s, /GPU memory/i);
});

test("formatUserOllamaChatError large payload hints size", () => {
  const s = formatUserOllamaChatError({
    status: 500,
    detail: "runner terminated",
    totalChars: 50_000,
  });
  assert.match(s, /large/i);
});

test("formatUserOllamaChatError classifies cloud opaque 500 (ref:<uuid>) as cloud-side, not size", () => {
  const s = formatUserOllamaChatError({
    status: 500,
    detail: "Internal Server Error (ref: 086957a4-4e9b-490b-9cec-cc2a8da6014d)",
    totalChars: 42_000,
  });
  assert.match(s, /Ollama Cloud/i);
  assert.match(s, /086957a4-4e9b-490b-9cec-cc2a8da6014d/);
  assert.match(s, /API key|rate limit|cloud outage/i);
  assert.doesNotMatch(s, /context size or GPU memory/i);
});

test("formatUserOllamaChatError ignores ref: for non-500 status", () => {
  const s = formatUserOllamaChatError({
    status: 503,
    detail: "Service Unavailable (ref: abc12345-...)",
    totalChars: 1000,
  });
  assert.doesNotMatch(s, /Ollama Cloud returned an opaque/i);
});

test("parseOllamaErrMsg extracts code and errType from JSON object error tail", () => {
  const err =
    'Ollama error: 503 — {"error":{"code":"overload","type":"transient"}}';
  assert.deepStrictEqual(parseOllamaErrMsg(err), {
    status: 503,
    detail: '{"error":{"code":"overload","type":"transient"}}',
    code: "overload",
    errType: "transient",
  });
});

test("parseOllamaErrMsg malformed nested braces omit code (legacy path)", () => {
  const err = "Ollama error: 500 — prefix text {broken {not valid json at all";
  assert.deepStrictEqual(parseOllamaErrMsg(err), {
    status: 500,
    detail: "prefix text {broken {not valid json at all",
  });
});

function formatWithMatched(opts) {
  let matched = null;
  const log = (level, msg, data) => {
    if (msg === "ollama-chat-error" && data && data.matched != null) {
      matched = data.matched;
    }
  };
  const text = formatUserOllamaChatError({ ...opts, log });
  return { text, matched };
}

test("formatUserOllamaChatError logs matched rule: network-unreachable", () => {
  const { matched } = formatWithMatched({
    status: 0,
    detail: "fetch failed",
    totalChars: 100,
  });
  assert.equal(matched, "network-unreachable");
});

test("formatUserOllamaChatError: cloud model drop is not blamed on local Ollama", () => {
  const cloud = formatUserOllamaChatError({
    status: 0,
    detail: "fetch failed",
    totalChars: 90000,
    model: "minimax-m2:cloud",
  });
  assert.match(cloud, /Ollama Cloud model/i);
  assert.doesNotMatch(cloud, /Check that Ollama is running/i);

  // Local model (or no model) keeps the original "is it running?" guidance.
  const local = formatUserOllamaChatError({
    status: 0,
    detail: "fetch failed",
    totalChars: 100,
    model: "qwen3-32k:latest",
  });
  assert.match(local, /Could not reach Ollama/i);
  const noModel = formatUserOllamaChatError({
    status: 0,
    detail: "fetch failed",
    totalChars: 100,
  });
  assert.match(noModel, /Could not reach Ollama/i);
});

test("formatUserOllamaChatError logs matched rule: context-overflow", () => {
  const { matched } = formatWithMatched({
    status: 500,
    detail: "context window exceeded for n_ctx",
    totalChars: 100,
  });
  assert.equal(matched, "context-overflow");
});

test("formatUserOllamaChatError logs matched rule: model-not-found", () => {
  const { matched } = formatWithMatched({
    status: 404,
    detail: "model 'foo' not found",
    totalChars: 100,
  });
  assert.equal(matched, "model-not-found");
});

test("formatUserOllamaChatError logs matched rule: model-load-failed (four phrases)", () => {
  const phrases = [
    "manifest unknown for digest abc",
    "blob not found in store",
    "failed to load model weights",
    "model not loaded yet",
  ];
  for (const detail of phrases) {
    const { matched, text } = formatWithMatched({
      status: 500,
      detail,
      totalChars: 100,
    });
    assert.equal(matched, "model-load-failed", `phrase: ${detail}`);
    assert.match(text, /model failed to load/i);
  }
});

test("formatUserOllamaChatError logs matched rule: gpu-oom", () => {
  const { matched } = formatWithMatched({
    status: 500,
    detail: "CUDA out of memory",
    totalChars: 1000,
  });
  assert.equal(matched, "gpu-oom");
});

test("formatUserOllamaChatError logs matched rule: cloud-opaque-500", () => {
  const { matched } = formatWithMatched({
    status: 500,
    detail: "Internal Server Error (ref: 086957a4-4e9b-490b-9cec-cc2a8da6014d)",
    totalChars: 42_000,
  });
  assert.equal(matched, "cloud-opaque-500");
});

test("formatUserOllamaChatError logs matched rule: large-payload-500", () => {
  const { matched } = formatWithMatched({
    status: 500,
    detail: "runner terminated",
    totalChars: 50_000,
  });
  assert.equal(matched, "large-payload-500");
});

test("formatUserOllamaChatError logs matched rule: generic", () => {
  const { matched } = formatWithMatched({
    status: 502,
    detail: "some opaque server text without keywords",
    totalChars: 1000,
  });
  assert.equal(matched, "generic");
});
