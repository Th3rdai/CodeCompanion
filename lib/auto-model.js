/**
 * Resolve "auto" model selection per mode + optional content-size routing.
 * @module lib/auto-model
 */

const { listModels } = require("./ollama-client");

/** Default map: mode id → preferred Ollama model name (must exist on your machine / cloud). */
const DEFAULT_AUTO_MODEL_MAP = {
  chat: "kimi-k2:1t-cloud",
  explain: "kimi-k2:1t-cloud",
  bugs: "kimi-k2:1t-cloud",
  refactor: "kimi-k2:1t-cloud",
  "translate-tech": "kimi-k2:1t-cloud",
  "translate-biz": "kimi-k2:1t-cloud",
  diagram: "qwen3-32k",
  pentest: "qwen3-32k",
  validate: "kimi-k2:1t-cloud",
  review: "qwen3-32k",
  prompting: "qwen3-32k",
  skillz: "qwen3-32k",
  agentic: "qwen3-32k",
  planner: "qwen3-32k",
  create: "kimi-k2:1t-cloud",
  build: "kimi-k2:1t-cloud",
  experiment: "qwen3-32k",
};

/** Display order for Settings (matches App MODES). */
const MODE_ORDER = [
  "chat",
  "explain",
  "bugs",
  "refactor",
  "translate-tech",
  "translate-biz",
  "diagram",
  "pentest",
  "validate",
  "review",
  "prompting",
  "skillz",
  "agentic",
  "planner",
  "create",
  "build",
  "experiment",
];

const MODE_LABELS = {
  chat: "Chat",
  explain: "Explain This",
  bugs: "Safety Check",
  refactor: "Clean Up",
  "translate-tech": "Code → Plain English",
  "translate-biz": "Idea → Code Spec",
  diagram: "Diagram",
  pentest: "Security",
  validate: "Validate",
  review: "Review",
  prompting: "Prompting",
  skillz: "Skillz",
  agentic: "Agentic",
  planner: "Planner",
  create: "Create",
  build: "Build",
  experiment: "Experiment",
};

const CLOUD_FALLBACKS = [
  "kimi-k2:1t-cloud",
  "minimax-m2:cloud",
  "glm-4.6:cloud",
];
const LOCAL_FALLBACKS = ["qwen3-32k", "qwen3:8b", "llama3.2:8b", "llama3.1:8b"];

/**
 * Models known to support the TOOL_CALL: pattern used by Code Companion's agent tools.
 * Cloud-proxied models (name includes "cloud") generally do NOT support this format,
 * EXCEPT for the ones listed in TOOL_CALL_CAPABLE_CLOUD below — those have been
 * empirically validated to emit clean TOOL_CALL: responses via the Ollama Cloud proxy.
 * Order: preferred first (largest/best that reliably emit TOOL_CALL:).
 */
const TOOL_CALL_CAPABLE = [
  "qwen3-coder:30b",
  "qwen3-32k",
  "gemma4",
  "qwen3:8b",
  "devstral-small-2",
  "llama3.2",
  "llama3.1:8b",
  "bazobehram/qwen3-14b-claude-4.5-opus-high-reasoning",
  "incept5/llama3.1-claude",
];

const TOOL_CALL_CAPABLE_CLOUD = [
  "kimi-k2:1t-cloud",
  "kimi-k2.5:cloud",
  "minimax-m2:cloud",
  "glm-4.6:cloud",
];

function isCloudModelName(name) {
  if (!name || typeof name !== "string") return false;
  const n = name.toLowerCase();
  return n.includes("cloud");
}

/**
 * Session-level demotions: when a model has been swapped away from for failing
 * to emit TOOL_CALL: blocks, mark it so subsequent auto-resolutions in the same
 * session skip it without paying the corrective-retry cost again. Decays after
 * `DEMOTION_TTL_MS` of last hit (sliding window — touched on every demote check).
 */
const DEMOTION_TTL_MS = 60 * 60 * 1000; // 1 hour
const _demotedModels = new Map(); // name → expires-at timestamp

function isModelDemoted(name) {
  if (!name) return false;
  const expires = _demotedModels.get(name);
  if (!expires) return false;
  if (Date.now() > expires) {
    _demotedModels.delete(name);
    return false;
  }
  return true;
}

function demoteModel(name, reason = "unknown") {
  if (!name) return;
  _demotedModels.set(name, Date.now() + DEMOTION_TTL_MS);
  return { name, reason, ttlMs: DEMOTION_TTL_MS };
}

function clearDemotions() {
  _demotedModels.clear();
}

function listDemotedModels() {
  const now = Date.now();
  const out = [];
  for (const [name, expires] of _demotedModels.entries()) {
    if (expires <= now) {
      _demotedModels.delete(name);
      continue;
    }
    out.push({ name, expiresAt: expires, remainingMs: expires - now });
  }
  return out;
}

function mergeAutoModelMap(saved) {
  const out = { ...DEFAULT_AUTO_MODEL_MAP };
  if (saved && typeof saved === "object") {
    for (const k of Object.keys(DEFAULT_AUTO_MODEL_MAP)) {
      if (typeof saved[k] === "string" && saved[k].trim())
        out[k] = saved[k].trim();
    }
  }
  return out;
}

function matchAvailable(name, availableSet) {
  if (!name) return null;
  if (availableSet.has(name)) return name;
  // Try with :latest suffix (Ollama reports "qwen3-32k:latest" but config stores "qwen3-32k")
  if (availableSet.has(name + ":latest")) return name + ":latest";
  // Try without :latest suffix
  if (name.endsWith(":latest") && availableSet.has(name.replace(":latest", "")))
    return name.replace(":latest", "");
  return null;
}

function pickFirstAvailable(preferredChain, availableSet, fallbackName) {
  for (const name of preferredChain) {
    const m = matchAvailable(name, availableSet);
    if (m) return m;
  }
  const fb = matchAvailable(fallbackName, availableSet);
  if (fb) return fb;
  return null;
}

/**
 * @param {object} opts
 * @param {string} opts.requestedModel
 * @param {string} opts.mode
 * @param {number} [opts.estimatedTokens]
 * @param {object} opts.config
 * @param {string} opts.ollamaUrl
 * @param {object} opts.ollamaOpts
 * @param {boolean} [opts.preferVision] — prefer first vision-capable model (e.g. chat + images)
 * @param {boolean} [opts.preferToolCapable] — prefer a model known to support TOOL_CALL: patterns (Experiment, Agent terminal, or **connected external MCP** — see chat-post-handler)
 * @param {string[]} [opts.excludeModels] — names to skip (used by chat-post-handler tool-call fallback to avoid re-resolving the failing model)
 * @param {number} [opts.minContextTokens] — only pick models whose advertised contextLength fits this many tokens (with a 20% safety margin). Used to auto-bump when content overflows the per-mode default.
 * @returns {Promise<{ resolved: string, wasAuto: boolean, basis: string, contextOverflow?: boolean }>}
 */
async function resolveAutoModel(opts) {
  const {
    requestedModel,
    mode,
    estimatedTokens = 0,
    config,
    ollamaUrl,
    ollamaOpts,
    preferVision = false,
    preferToolCapable = false,
    excludeModels = [],
    minContextTokens = 0,
  } = opts;

  if (requestedModel !== "auto") {
    return { resolved: requestedModel, wasAuto: false, basis: requestedModel };
  }

  const excludeSet = new Set(excludeModels.filter(Boolean));
  const map = mergeAutoModelMap(config.autoModelMap);
  const base = map[mode] || map.chat || "qwen3-32k";

  const models = await listModels(ollamaUrl, ollamaOpts);
  // 20% safety headroom so num_ctx auto-bump doesn't sit at the absolute ceiling.
  const requiredCtx = minContextTokens > 0 ? Math.ceil(minContextTokens * 1.2) : 0;
  const fitsRequiredCtx = (modelName) => {
    if (!requiredCtx) return true;
    const m = models.find((x) => x.name === modelName);
    if (!m || !m.contextLength) return true; // unknown — don't reject
    return m.contextLength >= requiredCtx;
  };
  const names = models
    .map((m) => m.name)
    .filter(
      (n) => !excludeSet.has(n) && !isModelDemoted(n) && fitsRequiredCtx(n),
    );
  const availableSet = new Set(names);

  if (names.length === 0) {
    // Either no models installed, or every model failed the requiredCtx/exclude
    // filter. Fall back to the configured base anyway (better than nothing) but
    // surface contextOverflow so callers can warn the user.
    return {
      resolved: base,
      wasAuto: true,
      basis: base,
      contextOverflow: requiredCtx > 0,
    };
  }

  if (preferVision) {
    // Cloud models report vision support but can't handle image uploads via Ollama — prefer local vision models
    // Prefer mid-size vision models (7-12B) for best speed/quality balance; avoid 34B+ which may OOM
    const localVision = models.filter(
      (m) => m.supportsVision && !isCloudModelName(m.name),
    );
    if (localVision.length > 0) {
      // Sort by size, prefer models under 15GB (fits in most GPUs)
      // Note: m.size is in GB (e.g. 18.8), not bytes
      const preferred = localVision.filter((m) => (m.size || 0) < 15);
      const pick =
        preferred.length > 0
          ? preferred.sort((a, b) => (b.size || 0) - (a.size || 0))[0] // largest under 15GB
          : localVision.sort((a, b) => (a.size || 0) - (b.size || 0))[0]; // smallest available
      return { resolved: pick.name, wasAuto: true, basis: base };
    }
    // No local vision model — fall through to normal resolution (cloud will fail on images)
  }

  // When agent tools are active, prefer a model that supports TOOL_CALL: patterns.
  // Most cloud-proxied models don't support this format — but a curated set
  // (TOOL_CALL_CAPABLE_CLOUD) has been validated to work. If the user's per-mode
  // mapping points at one of those, respect it instead of overriding to a local model.
  if (preferToolCapable && isCloudModelName(base)) {
    if (TOOL_CALL_CAPABLE_CLOUD.includes(base)) {
      const baseCloudMatch = matchAvailable(base, availableSet);
      if (baseCloudMatch) {
        return { resolved: baseCloudMatch, wasAuto: true, basis: base };
      }
    }
    const cloudToolPick = pickFirstAvailable(
      TOOL_CALL_CAPABLE_CLOUD,
      availableSet,
      null,
    );
    if (cloudToolPick) {
      return { resolved: cloudToolPick, wasAuto: true, basis: base };
    }
    const toolPick = pickFirstAvailable(TOOL_CALL_CAPABLE, availableSet, null);
    if (toolPick) {
      return { resolved: toolPick, wasAuto: true, basis: base };
    }
    // No tool-capable model available — fall through and use the cloud model (fallback in server.js will handle it)
  }

  let preference = base;

  // If the mapped model is available, use it directly — respect the user's per-mode choice
  const baseMatch = matchAvailable(base, availableSet);
  if (baseMatch) {
    preference = baseMatch;
  } else {
    // Mapped model not available — fall back based on content size
    const cloudAvailable = names.filter(isCloudModelName);
    const localAvailable = names.filter((n) => !isCloudModelName(n));

    if (estimatedTokens > 10000 && cloudAvailable.length > 0) {
      const cloudPick =
        CLOUD_FALLBACKS.find((n) => availableSet.has(n)) || cloudAvailable[0];
      preference = cloudPick || base;
    } else if (
      estimatedTokens < 2000 &&
      localAvailable.length > 0 &&
      !isCloudModelName(base)
    ) {
      const localPick =
        LOCAL_FALLBACKS.find((n) => availableSet.has(n)) || localAvailable[0];
      preference = localPick || base;
    }
  }

  const chain = [
    preference,
    base,
    ...CLOUD_FALLBACKS,
    ...LOCAL_FALLBACKS,
    ...names,
  ];

  const resolved =
    pickFirstAvailable(chain, availableSet, names[0]) || names[0];

  return { resolved, wasAuto: true, basis: base };
}

module.exports = {
  DEFAULT_AUTO_MODEL_MAP,
  TOOL_CALL_CAPABLE,
  TOOL_CALL_CAPABLE_CLOUD,
  MODE_ORDER,
  MODE_LABELS,
  mergeAutoModelMap,
  resolveAutoModel,
  isCloudModelName,
  isModelDemoted,
  demoteModel,
  clearDemotions,
  listDemotedModels,
};
