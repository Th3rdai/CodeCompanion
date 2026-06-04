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
  isOpenrouterToolCapable,
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

// ─── preferToolCapable: swap a weak LOCAL base to a validated tool-caller ────
// Regression for "auto picks gemma4 (a poor tool-caller) to use tools": the swap
// used to be cloud-base-only, and gemma4 was on the tool-capable allowlist.
const LOCAL_TOOL_TAGS = [
  {
    name: "gemma4:latest",
    size: 5_000_000_000,
    modified_at: "2026-05-01",
    details: { family: "gemma", parameter_size: "4B" },
  },
  {
    name: "qwen3-32k:latest",
    size: 6_000_000_000,
    modified_at: "2026-05-01",
    details: { family: "qwen3", parameter_size: "8B" },
  },
];
const LOCAL_TOOL_SHOW = {
  "gemma4:latest": {
    model_info: { "gemma.context_length": 8192 },
    details: { family: "gemma" },
  },
  "qwen3-32k:latest": {
    model_info: { "qwen3.context_length": 32768 },
    details: { family: "qwen3" },
  },
};

async function runResolveLocal({ chat }) {
  return resolveAutoModel({
    requestedModel: "auto",
    mode: "chat",
    estimatedTokens: 500,
    config: { ollamaUrl: "http://test:11434", autoModelMap: { chat } },
    ollamaUrl: "http://test:11434",
    ollamaOpts: {},
    preferToolCapable: true,
  });
}

test("resolveAutoModel preferToolCapable swaps a weak local base (gemma4) to an installed tool-caller", async () => {
  const original = global.fetch;
  global.fetch = makeFetchStub({
    tags: LOCAL_TOOL_TAGS,
    showByModel: LOCAL_TOOL_SHOW,
  });
  try {
    clearDemotions();
    invalidateListModelsCache();
    const r = await runResolveLocal({ chat: "gemma4" });
    assert.equal(r.resolved, "qwen3-32k:latest"); // swapped away from gemma4
  } finally {
    global.fetch = original;
    invalidateListModelsCache();
    clearDemotions();
  }
});

test("resolveAutoModel preferToolCapable keeps a weak local base when it is the only model", async () => {
  const original = global.fetch;
  global.fetch = makeFetchStub({
    tags: [LOCAL_TOOL_TAGS[0]],
    showByModel: LOCAL_TOOL_SHOW,
  });
  try {
    clearDemotions();
    invalidateListModelsCache();
    const r = await runResolveLocal({ chat: "gemma4" });
    assert.equal(r.resolved, "gemma4:latest"); // only model installed → fallback
  } finally {
    global.fetch = original;
    invalidateListModelsCache();
    clearDemotions();
  }
});

test("resolveAutoModel preferToolCapable keeps a strong local base (qwen3-32k) as-is", async () => {
  const original = global.fetch;
  global.fetch = makeFetchStub({
    tags: LOCAL_TOOL_TAGS,
    showByModel: LOCAL_TOOL_SHOW,
  });
  try {
    clearDemotions();
    invalidateListModelsCache();
    const r = await runResolveLocal({ chat: "qwen3-32k" });
    assert.equal(r.resolved, "qwen3-32k:latest");
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

// ─── preferCloud: slow-model self-heal targets a faster cloud tool-caller ────
// When a slow LOCAL model is demoted/excluded and preferCloud is set, auto-mode
// should swap to a cloud tool-capable model rather than another local one.
const CLOUD_PREF_TAGS = [
  {
    name: "qwen3-coder:30b",
    size: 18_000_000_000,
    modified_at: "2026-05-01",
    details: { family: "qwen3", parameter_size: "30B" },
  },
  {
    name: "qwen3-32k:latest",
    size: 6_000_000_000,
    modified_at: "2026-05-01",
    details: { family: "qwen3", parameter_size: "8B" },
  },
  {
    name: "kimi-k2:1t-cloud",
    size: 0,
    modified_at: "2026-05-01",
    details: { family: "kimi", parameter_size: "" },
  },
];
const CLOUD_PREF_SHOW = {
  "qwen3-coder:30b": {
    model_info: { "qwen3.context_length": 32768 },
    details: { family: "qwen3" },
  },
  "qwen3-32k:latest": {
    model_info: { "qwen3.context_length": 32768 },
    details: { family: "qwen3" },
  },
};

async function runResolveCloudPref(preferCloud) {
  return resolveAutoModel({
    requestedModel: "auto",
    mode: "chat",
    estimatedTokens: 500,
    config: {
      ollamaUrl: "http://test:11434",
      autoModelMap: { chat: "qwen3-32k" },
    },
    ollamaUrl: "http://test:11434",
    ollamaOpts: {},
    preferToolCapable: true,
    preferCloud,
    // mirror the slow-switch call: exclude the (slow) base local model
    excludeModels: ["qwen3-32k:latest", "qwen3-32k"],
  });
}

test("resolveAutoModel preferCloud=false keeps a local tool-caller after excluding the base", async () => {
  const original = global.fetch;
  global.fetch = makeFetchStub({
    tags: CLOUD_PREF_TAGS,
    showByModel: CLOUD_PREF_SHOW,
  });
  try {
    clearDemotions();
    invalidateListModelsCache();
    const r = await runResolveCloudPref(false);
    assert.equal(r.resolved, "qwen3-coder:30b"); // local tool pick first
  } finally {
    global.fetch = original;
    invalidateListModelsCache();
    clearDemotions();
  }
});

test("resolveAutoModel preferCloud=true swaps a slow local base for a cloud tool-caller", async () => {
  const original = global.fetch;
  global.fetch = makeFetchStub({
    tags: CLOUD_PREF_TAGS,
    showByModel: CLOUD_PREF_SHOW,
  });
  try {
    clearDemotions();
    invalidateListModelsCache();
    const r = await runResolveCloudPref(true);
    assert.equal(r.resolved, "kimi-k2:1t-cloud"); // cloud preferred
  } finally {
    global.fetch = original;
    invalidateListModelsCache();
    clearDemotions();
  }
});

// ── OpenRouter provider-aware resolution (OPNRTR.md) ─────────────────────────

const { getContextLengthForModel } = require("../../lib/auto-model");

const OR_OPTS = {
  __ccProvider: "openrouter",
  __ccOpenrouterApiKey: "sk-or-test",
  __ccOpenrouterUrl: "https://openrouter.ai/api/v1",
};

const OR_MODELS = [
  {
    id: "anthropic/claude-sonnet-4.5",
    context_length: 200000,
    architecture: { input_modalities: ["text"] },
  },
  {
    id: "openai/gpt-4o-mini",
    context_length: 128000,
    architecture: { input_modalities: ["text"] },
  },
  {
    id: "openai/gpt-4o",
    context_length: 128000,
    architecture: { input_modalities: ["text", "image"] },
  },
  {
    id: "google/gemini-pro-1.5",
    context_length: 2000000,
    architecture: { input_modalities: ["text", "image"] },
  },
  {
    id: "cohere/command-r",
    context_length: 128000,
    architecture: { input_modalities: ["text"] },
  },
];

function makeOrFetchStub(models = OR_MODELS) {
  return async function stub(url) {
    if (String(url).endsWith("/models")) {
      return { ok: true, status: 200, json: async () => ({ data: models }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

async function withOrFetch(fn) {
  const original = global.fetch;
  global.fetch = makeOrFetchStub();
  invalidateListModelsCache();
  try {
    return await fn();
  } finally {
    global.fetch = original;
    invalidateListModelsCache();
  }
}

test("mergeAutoModelMap(saved, 'openrouter') uses the OpenRouter base map", () => {
  const m = mergeAutoModelMap(null, "openrouter");
  assert.equal(m.chat, "anthropic/claude-sonnet-4.5");
  assert.equal(m.review, "openai/gpt-4o-mini");
  assert.equal(
    Object.keys(m).length,
    Object.keys(DEFAULT_AUTO_MODEL_MAP).length,
  );
});

// Invariants the chat-post-handler OpenRouter explicit-model guard relies on:
// `openrouter/auto` (the OR router) must read as NOT tool-capable so an agentic
// turn swaps it out, and the swap target (the OR per-mode default) MUST be
// tool-capable — otherwise the guard would either no-op or swap to another
// non-capable model.
test("isOpenrouterToolCapable: openrouter/auto is not tool-capable", () => {
  assert.equal(isOpenrouterToolCapable("openrouter/auto"), false);
});

test("isOpenrouterToolCapable: prefix allowlist + small-Llama exclusion", () => {
  assert.equal(isOpenrouterToolCapable("anthropic/claude-sonnet-4.5"), true);
  assert.equal(isOpenrouterToolCapable("openai/gpt-4o-mini"), true);
  assert.equal(isOpenrouterToolCapable("meta-llama/llama-4-scout"), true);
  // Sub-8B Llamas narrate instead of emitting TOOL_CALL: — excluded.
  assert.equal(isOpenrouterToolCapable("meta-llama/llama-3.2-3b-instruct"), false);
});

test("OpenRouter guard swap targets are all tool-capable", () => {
  const m = mergeAutoModelMap(null, "openrouter");
  for (const [mode, id] of Object.entries(m)) {
    assert.equal(
      isOpenrouterToolCapable(id),
      true,
      `OpenRouter default for mode "${mode}" (${id}) must be tool-capable so the agentic swap is valid`,
    );
  }
});

test("resolveAutoModel (OpenRouter): per-mode default map resolves against the catalog", async () => {
  await withOrFetch(async () => {
    const r = await resolveAutoModel({
      requestedModel: "auto",
      mode: "review",
      config: { provider: "openrouter", autoModelMap: {} },
      ollamaUrl: "http://unused",
      ollamaOpts: OR_OPTS,
    });
    assert.equal(r.resolved, "openai/gpt-4o-mini");
    assert.equal(r.wasAuto, true);
  });
});

test("resolveAutoModel (OpenRouter): preferVision picks the largest-context vision model", async () => {
  await withOrFetch(async () => {
    const r = await resolveAutoModel({
      requestedModel: "auto",
      mode: "chat",
      preferVision: true,
      config: { provider: "openrouter", autoModelMap: {} },
      ollamaUrl: "http://unused",
      ollamaOpts: OR_OPTS,
    });
    // gemini-pro-1.5 (2M, vision) beats gpt-4o (128K, vision).
    assert.equal(r.resolved, "google/gemini-pro-1.5");
  });
});

test("resolveAutoModel (OpenRouter): preferToolCapable keeps an allowlisted base", async () => {
  await withOrFetch(async () => {
    const r = await resolveAutoModel({
      requestedModel: "auto",
      mode: "chat", // default base anthropic/claude-sonnet-4.5 (tool-capable)
      preferToolCapable: true,
      config: { provider: "openrouter", autoModelMap: {} },
      ollamaUrl: "http://unused",
      ollamaOpts: OR_OPTS,
    });
    assert.equal(r.resolved, "anthropic/claude-sonnet-4.5");
  });
});

test("resolveAutoModel (OpenRouter): preferToolCapable swaps a non-allowlisted base", async () => {
  await withOrFetch(async () => {
    const r = await resolveAutoModel({
      requestedModel: "auto",
      mode: "chat",
      preferToolCapable: true,
      // Force a non-tool-capable base; resolver must swap to an allowlisted one.
      config: {
        provider: "openrouter",
        autoModelMap: { chat: "cohere/command-r" },
      },
      ollamaUrl: "http://unused",
      ollamaOpts: OR_OPTS,
    });
    // First allowlisted in largest-context order is google/gemini-pro-1.5.
    assert.equal(r.resolved, "google/gemini-pro-1.5");
  });
});

test("getContextLengthForModel (OpenRouter): reads context length from the catalog", async () => {
  await withOrFetch(async () => {
    const ctx = await getContextLengthForModel(
      "anthropic/claude-sonnet-4.5",
      "http://unused",
      OR_OPTS,
    );
    assert.equal(ctx, 200000);
    const unknown = await getContextLengthForModel(
      "nope/not-real",
      "http://unused",
      OR_OPTS,
    );
    assert.equal(unknown, 0);
  });
});
