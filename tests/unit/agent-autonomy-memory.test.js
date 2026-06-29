/**
 * Pinned agent-autonomy memory seed + recall
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  initMemory,
  ensureAgentAutonomyMemory,
  addMemory,
  getMemories,
  buildMemoryContext,
} = require("../../lib/memory");
const { AGENT_AUTONOMY_MEMORY_CONTENT } = require("../../lib/agent-autonomy");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cc-autonomy-mem-"));
}

const fakeEmb = Array.from({ length: 8 }, (_, i) => Math.sin(i));

test("ensureAgentAutonomyMemory skips when pinned autonomy fact exists", async () => {
  const dir = tempDir();
  initMemory(dir);
  addMemory({
    type: "fact",
    content: AGENT_AUTONOMY_MEMORY_CONTENT,
    source: null,
    embedding: fakeEmb,
    embeddingModel: "nomic-embed-text",
    confidence: 1,
    pinned: true,
  });
  const result = await ensureAgentAutonomyMemory({
    ollamaUrl: "http://127.0.0.1:11434",
  });
  assert.equal(result.created, false);
  assert.equal(result.reason, "exists");
  assert.equal(getMemories({ type: "fact" }).length, 1);
});

test("buildMemoryContext injects pinned global facts without semantic match", async () => {
  const dir = tempDir();
  initMemory(dir);
  addMemory({
    type: "fact",
    content: AGENT_AUTONOMY_MEMORY_CONTENT,
    source: null,
    embedding: fakeEmb,
    embeddingModel: "nomic-embed-text",
    confidence: 1,
    pinned: true,
  });
  const config = {
    ollamaUrl: "http://127.0.0.1:11434",
    memory: { enabled: true, maxContextTokens: 500, recallThreshold: 0.99 },
  };
  const origEmbed = require("../../lib/ollama-client").embed;
  require("../../lib/ollama-client").embed = async () => fakeEmb;
  try {
    const ctx = await buildMemoryContext(
      config.ollamaUrl,
      "nomic-embed-text",
      [{ role: "user", content: "hello" }],
      config,
      "conv-test",
      null,
    );
    assert.match(ctx.prompt, /MEMORY CONTEXT/);
    assert.match(ctx.prompt, /autonomous/i);
  } finally {
    require("../../lib/ollama-client").embed = origEmbed;
  }
});
