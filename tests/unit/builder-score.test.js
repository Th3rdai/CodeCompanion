const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { getTimeoutForModel } = require("../../lib/builder-score");

describe("getTimeoutForModel", () => {
  it("returns 60s for small models (1b, 3b)", () => {
    assert.equal(getTimeoutForModel("phi-3:1b"), 60000);
    assert.equal(getTimeoutForModel("tinyllama:3b"), 60000);
  });

  it("returns 90s for 7-8b models", () => {
    assert.equal(getTimeoutForModel("llama3:8b"), 90000);
    assert.equal(getTimeoutForModel("mistral:7b"), 90000);
  });

  it("returns 120s for 13-14b models", () => {
    assert.equal(getTimeoutForModel("codellama:13b"), 120000);
    assert.equal(getTimeoutForModel("qwen:14b"), 120000);
  });

  it("returns 180s for large models (33b+)", () => {
    assert.equal(getTimeoutForModel("deepseek:33b"), 180000);
    assert.equal(getTimeoutForModel("llama3:70b"), 180000);
    assert.equal(getTimeoutForModel("qwen:110b"), 180000);
  });

  it("returns 120s default for unknown model sizes", () => {
    assert.equal(getTimeoutForModel("custom-model"), 120000);
    assert.equal(getTimeoutForModel(""), 120000);
    assert.equal(getTimeoutForModel(null), 120000);
    assert.equal(getTimeoutForModel(undefined), 120000);
  });

  it("handles model names with size in different positions", () => {
    assert.equal(getTimeoutForModel("some-model-7b-instruct"), 90000);
    assert.equal(getTimeoutForModel("llama-3.1-8b-q4"), 90000);
  });
});

describe("scoreContent", () => {
  // scoreContent requires mocking ollama-client which uses require()
  // These tests verify the module exports and basic contract

  it("exports scoreContent function", () => {
    const { scoreContent } = require("../../lib/builder-score");
    assert.equal(typeof scoreContent, "function");
  });

  it("rejects unknown builder modes", async () => {
    const { scoreContent } = require("../../lib/builder-score");
    await assert.rejects(
      () =>
        scoreContent(
          "http://localhost:11434",
          "test-model",
          "unknown-mode",
          "content",
        ),
      { message: /unknown builder mode/i },
    );
  });
});
