const test = require("node:test");
const assert = require("node:assert");
const {
  mergeAutoModelMap,
  isCloudModelName,
  isModelDemoted,
  demoteModel,
  clearDemotions,
  listDemotedModels,
  resolveAutoModel,
  DEFAULT_AUTO_MODEL_MAP,
} = require("../../lib/auto-model");
const { invalidateListModelsCache } = require("../../lib/ollama-client");

function makeFetchStub({ tags, showByModel }) {
  return async function stub(url, init) {
    if (url.endsWith("/api/tags")) {
      return { ok: true, json: async () => ({ models: tags }) };
    }
    if (url.endsWith("/api/show")) {
      const body = JSON.parse((init && init.body) || "{}");
      const modelName = body.model || body.name;
      const resp = showByModel[modelName];
      if (!resp) {
        return { ok: true, json: async () => ({ error: "model not found" }) };
      }
      return { ok: true, json: async () => resp };
    }
    return { ok: false, json: async () => ({}) };
  };
}

test("mergeAutoModelMap fills defaults and applies overrides", () => {
  const m = mergeAutoModelMap({ chat: "my-model:latest" });
  assert.equal(m.chat, "my-model:latest");
  assert.equal(m.review, DEFAULT_AUTO_MODEL_MAP.review);
  assert.ok(
    typeof m.experiment === "string" && m.experiment.length > 0,
    "experiment default present",
  );
});

test("isCloudModelName detects cloud-tagged names", () => {
  assert.equal(isCloudModelName("kimi-k2:1t-cloud"), true);
  assert.equal(isCloudModelName("qwen3-32k"), false);
});

test("demoteModel marks a model as demoted; clearDemotions resets state", () => {
  clearDemotions();
  assert.equal(isModelDemoted("kimi-k2:1t-cloud"), false);
  demoteModel("kimi-k2:1t-cloud", "cloud_opaque_500");
  assert.equal(isModelDemoted("kimi-k2:1t-cloud"), true);
  assert.equal(isModelDemoted("qwen3-32k"), false);
  const list = listDemotedModels();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, "kimi-k2:1t-cloud");
  assert.ok(list[0].remainingMs > 0, "remainingMs is positive");
  clearDemotions();
  assert.equal(isModelDemoted("kimi-k2:1t-cloud"), false);
  assert.equal(listDemotedModels().length, 0);
});

test("demoteModel with empty name is a no-op", () => {
  clearDemotions();
  demoteModel("", "any");
  demoteModel(null, "any");
  demoteModel(undefined, "any");
  assert.equal(listDemotedModels().length, 0);
});

// ─── resolveAutoModel — opaque-500 self-heal foundation ─────────────────────
// These tests pin the building blocks the chat-post-handler retry loop depends
// on: when a cloud model is demoted (or named in excludeModels), the next auto
// resolution must pick a different installed model.

const RETRY_TAGS = [
  {
    name: "kimi-k2:1t-cloud",
    size: 0,
    modified_at: "2026-05-01",
    details: { family: "kimi", parameter_size: "" },
  },
  {
    name: "qwen3-32k",
    size: 5_000_000_000,
    modified_at: "2026-05-01",
    details: { family: "qwen3", parameter_size: "8.0B" },
  },
];

const RETRY_SHOW = {
  "qwen3-32k": {
    model_info: { "qwen3.context_length": 32_768 },
    details: { family: "qwen3" },
  },
  // kimi-k2:1t-cloud → no /api/show entry; falls back to guessCloudContext
};

const RETRY_CONFIG = {
  ollamaUrl: "http://test:11434",
  autoModelMap: { chat: "kimi-k2:1t-cloud" },
};

async function runResolve({ excludeModels = [] } = {}) {
  return resolveAutoModel({
    requestedModel: "auto",
    mode: "chat",
    estimatedTokens: 500,
    config: RETRY_CONFIG,
    ollamaUrl: RETRY_CONFIG.ollamaUrl,
    ollamaOpts: {},
    excludeModels,
  });
}

test("resolveAutoModel picks the mapped cloud model when nothing is demoted", async () => {
  const original = global.fetch;
  global.fetch = makeFetchStub({ tags: RETRY_TAGS, showByModel: RETRY_SHOW });
  try {
    clearDemotions();
    invalidateListModelsCache();
    const r = await runResolve();
    assert.equal(r.resolved, "kimi-k2:1t-cloud");
    assert.equal(r.wasAuto, true);
  } finally {
    global.fetch = original;
    invalidateListModelsCache();
    clearDemotions();
  }
});

test("resolveAutoModel skips a demoted cloud model and falls back to a local one", async () => {
  const original = global.fetch;
  global.fetch = makeFetchStub({ tags: RETRY_TAGS, showByModel: RETRY_SHOW });
  try {
    clearDemotions();
    invalidateListModelsCache();
    demoteModel("kimi-k2:1t-cloud", "cloud_opaque_500");
    const r = await runResolve();
    assert.notEqual(
      r.resolved,
      "kimi-k2:1t-cloud",
      "demoted model must not be picked",
    );
    assert.equal(r.resolved, "qwen3-32k");
  } finally {
    global.fetch = original;
    invalidateListModelsCache();
    clearDemotions();
  }
});

test("resolveAutoModel honors excludeModels even without a demote", async () => {
  const original = global.fetch;
  global.fetch = makeFetchStub({ tags: RETRY_TAGS, showByModel: RETRY_SHOW });
  try {
    clearDemotions();
    invalidateListModelsCache();
    const r = await runResolve({ excludeModels: ["kimi-k2:1t-cloud"] });
    assert.notEqual(r.resolved, "kimi-k2:1t-cloud");
    assert.equal(r.resolved, "qwen3-32k");
  } finally {
    global.fetch = original;
    invalidateListModelsCache();
    clearDemotions();
  }
});

// ─── preferVision + preferToolCapable: skip Moondream (narrates vs TOOL_CALL) ─

const VISION_TOOL_TAGS = [
  {
    name: "moondream:latest",
    size: 2_000_000_000,
    modified_at: "2026-05-09",
    details: { family: "moondream", parameter_size: "1.8B" },
  },
  {
    name: "llava:34b",
    size: 20_000_000_000,
    modified_at: "2026-05-09",
    details: { family: "llava", parameter_size: "34B" },
  },
];

const VISION_TOOL_SHOW = {
  "moondream:latest": {
    model_info: { "moondream.context_length": 8192 },
    details: { family: "moondream" },
  },
  "llava:34b": {
    model_info: { "llava.context_length": 32768 },
    details: { family: "llava" },
  },
};

test("resolveAutoModel preferVision+preferToolCapable skips Moondream when another local vision exists", async () => {
  const original = global.fetch;
  global.fetch = makeFetchStub({
    tags: VISION_TOOL_TAGS,
    showByModel: VISION_TOOL_SHOW,
  });
  try {
    clearDemotions();
    invalidateListModelsCache();
    const r = await resolveAutoModel({
      requestedModel: "auto",
      mode: "chat",
      estimatedTokens: 500,
      config: {
        ollamaUrl: "http://test:11434",
        autoModelMap: { chat: "qwen3-32k" },
      },
      ollamaUrl: "http://test:11434",
      ollamaOpts: {},
      preferVision: true,
      preferToolCapable: true,
    });
    assert.equal(
      r.resolved,
      "llava:34b",
      "must not pick moondream when tools + vision",
    );
    assert.equal(r.wasAuto, true);
  } finally {
    global.fetch = original;
    invalidateListModelsCache();
    clearDemotions();
  }
});

test("resolveAutoModel preferVision+preferToolCapable still uses Moondream if it is the only vision model", async () => {
  const original = global.fetch;
  global.fetch = makeFetchStub({
    tags: [VISION_TOOL_TAGS[0]],
    showByModel: { "moondream:latest": VISION_TOOL_SHOW["moondream:latest"] },
  });
  try {
    clearDemotions();
    invalidateListModelsCache();
    const r = await resolveAutoModel({
      requestedModel: "auto",
      mode: "chat",
      estimatedTokens: 500,
      config: {
        ollamaUrl: "http://test:11434",
        autoModelMap: { chat: "qwen3-32k" },
      },
      ollamaUrl: "http://test:11434",
      ollamaOpts: {},
      preferVision: true,
      preferToolCapable: true,
    });
    assert.equal(r.resolved, "moondream:latest");
  } finally {
    global.fetch = original;
    invalidateListModelsCache();
    clearDemotions();
  }
});
