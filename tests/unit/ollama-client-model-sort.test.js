/**
 * Tests for model-list enrichment + context-size sort in lib/ollama-client.js
 * (added for v1.6.41).
 *
 * Behaviour: listModels() now calls /api/show for each model returned by
 * /api/tags, attaches a `contextLength` field, falls back to a name-pattern
 * heuristic for cloud models that don't expose model_info, and sorts the
 * result largest-context-first (alphabetical tie-break).
 *
 * These tests stub global.fetch so we don't hit a real Ollama instance.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");

const ollamaClient = require("../../lib/ollama-client");
const { listModels, invalidateListModelsCache, guessCloudContext } =
  ollamaClient;

// ─── guessCloudContext heuristic ───────────────────────────────────────────

test("guessCloudContext: minimax-m2:cloud → 256K", () => {
  assert.equal(guessCloudContext("minimax-m2:cloud"), 256_000);
});

test("guessCloudContext: kimi-k2.5:cloud → 200K", () => {
  assert.equal(guessCloudContext("kimi-k2.5:cloud"), 200_000);
});

test("guessCloudContext: gemini-1.5-pro → 2M", () => {
  assert.equal(guessCloudContext("gemini-1.5-pro:cloud"), 2_000_000);
});

test("guessCloudContext: claude-sonnet → 200K", () => {
  assert.equal(guessCloudContext("claude-sonnet-4-7:cloud"), 200_000);
});

test("guessCloudContext: gpt-4o → 128K", () => {
  assert.equal(guessCloudContext("gpt-4o:cloud"), 128_000);
});

test("guessCloudContext: qwen3-32k:latest → 32K", () => {
  assert.equal(guessCloudContext("qwen3-32k:latest"), 32_768);
});

test("guessCloudContext: generic :cloud suffix → 128K fallback", () => {
  assert.equal(guessCloudContext("randomthing:cloud"), 128_000);
});

test("guessCloudContext: local non-cloud model → 0", () => {
  assert.equal(guessCloudContext("llama3.2:latest"), 0);
});

// ─── listModels enrichment + sort ──────────────────────────────────────────

function makeFetchStub({ tags, showByModel }) {
  return async function stub(url, init) {
    if (url.endsWith("/api/tags")) {
      return {
        ok: true,
        json: async () => ({ models: tags }),
      };
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

const FAMILY_TAGS = [
  {
    name: "gemma4:latest",
    size: 8_000_000_000,
    modified_at: "2026-05-01",
    details: { family: "gemma4", parameter_size: "8.0B" },
  },
  {
    name: "qwen3:8b",
    size: 5_000_000_000,
    modified_at: "2026-05-01",
    details: { family: "qwen3", parameter_size: "8.0B" },
  },
  {
    name: "llama3.2:latest",
    size: 4_000_000_000,
    modified_at: "2026-05-01",
    details: { family: "llama", parameter_size: "3.0B" },
  },
  // Cloud model: no /api/show data; should fall back to heuristic.
  {
    name: "minimax-m2:cloud",
    size: 0,
    modified_at: "2026-05-01",
    details: { family: "minimaxm2", parameter_size: "" },
  },
];

const SHOW_RESPONSES = {
  "gemma4:latest": {
    model_info: { "gemma4.context_length": 131_072 },
    details: { family: "gemma4" },
  },
  "qwen3:8b": {
    model_info: { "qwen3.context_length": 40_960 },
    details: { family: "qwen3" },
  },
  "llama3.2:latest": {
    model_info: { "llama.context_length": 131_072 },
    details: { family: "llama" },
  },
  // minimax-m2:cloud → no /api/show entry; will hit heuristic 256_000
};

test("listModels: enriches each model with contextLength via /api/show", async () => {
  const original = global.fetch;
  global.fetch = makeFetchStub({
    tags: FAMILY_TAGS,
    showByModel: SHOW_RESPONSES,
  });
  try {
    invalidateListModelsCache();
    const models = await listModels("http://test:11434");
    const byName = Object.fromEntries(models.map((m) => [m.name, m]));
    assert.equal(byName["gemma4:latest"].contextLength, 131_072);
    assert.equal(byName["qwen3:8b"].contextLength, 40_960);
    assert.equal(byName["llama3.2:latest"].contextLength, 131_072);
    // Cloud fallback via guessCloudContext
    assert.equal(byName["minimax-m2:cloud"].contextLength, 256_000);
  } finally {
    global.fetch = original;
    invalidateListModelsCache();
  }
});

test("listModels: sorts largest contextLength first; alphabetical tie-break", async () => {
  const original = global.fetch;
  global.fetch = makeFetchStub({
    tags: FAMILY_TAGS,
    showByModel: SHOW_RESPONSES,
  });
  try {
    invalidateListModelsCache();
    const models = await listModels("http://test:11434");
    const order = models.map((m) => `${m.name}=${m.contextLength}`);
    // Expected order:
    //  minimax-m2:cloud (256_000)
    //  gemma4:latest (131_072)
    //  llama3.2:latest (131_072) — tie with gemma4 → alphabetical: gemma4 first
    //  qwen3:8b (40_960)
    assert.deepEqual(order, [
      "minimax-m2:cloud=256000",
      "gemma4:latest=131072",
      "llama3.2:latest=131072",
      "qwen3:8b=40960",
    ]);
  } finally {
    global.fetch = original;
    invalidateListModelsCache();
  }
});

test("listModels: models with no contextLength sort to the bottom", async () => {
  const original = global.fetch;
  const tags = [
    {
      name: "weird:custom",
      size: 1_000_000_000,
      modified_at: "2026-05-01",
      details: { family: "unknown" },
    },
    ...FAMILY_TAGS.slice(0, 2),
  ];
  global.fetch = makeFetchStub({ tags, showByModel: SHOW_RESPONSES });
  try {
    invalidateListModelsCache();
    const models = await listModels("http://test:11434");
    // Last entry should be the unknown-context model.
    const last = models[models.length - 1];
    assert.equal(last.name, "weird:custom");
    assert.equal(last.contextLength, 0);
  } finally {
    global.fetch = original;
    invalidateListModelsCache();
  }
});

test("listModels: handles /api/show error gracefully (returns 0, sorts to bottom)", async () => {
  const original = global.fetch;
  global.fetch = async (url) => {
    if (url.endsWith("/api/tags")) {
      return {
        ok: true,
        json: async () => ({ models: FAMILY_TAGS.slice(0, 2) }),
      };
    }
    if (url.endsWith("/api/show")) {
      // Simulate a 500 / network failure
      throw new Error("ECONNRESET");
    }
    return { ok: false, json: async () => ({}) };
  };
  try {
    invalidateListModelsCache();
    const models = await listModels("http://test:11434");
    // Both models lose contextLength; cloud-heuristic doesn't apply (no :cloud)
    for (const m of models) {
      assert.equal(m.contextLength, 0);
    }
    // Tie-break is alphabetical, so gemma4 before qwen3
    assert.equal(models[0].name, "gemma4:latest");
    assert.equal(models[1].name, "qwen3:8b");
  } finally {
    global.fetch = original;
    invalidateListModelsCache();
  }
});

test("listModels: empty model list returns empty array", async () => {
  const original = global.fetch;
  global.fetch = makeFetchStub({ tags: [], showByModel: {} });
  try {
    invalidateListModelsCache();
    const models = await listModels("http://test:11434");
    assert.deepEqual(models, []);
  } finally {
    global.fetch = original;
    invalidateListModelsCache();
  }
});
