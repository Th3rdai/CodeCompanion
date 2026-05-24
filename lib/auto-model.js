/**
 * Resolve "auto" model selection per mode + optional content-size routing.
 * @module lib/auto-model
 */

const {
  listModels,
  guessCloudContext,
  fetchContextLength,
} = require("./ollama-client");

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
  // gemma4 intentionally excluded: in practice it narrates actions instead of
  // emitting TOOL_CALL: reliably (observed live → corrective-retry churn). It
  // remains usable as a last-resort fallback via the normal resolution chain.
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

/** True if `name` matches any entry in `list`, ignoring a trailing :latest tag. */
function nameMatchesAny(name, list) {
  if (!name) return false;
  const norm = (s) => String(s || "").replace(/:latest$/, "");
  const n = norm(name);
  return list.some((c) => norm(c) === n);
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
  const requiredCtx =
    minContextTokens > 0 ? Math.ceil(minContextTokens * 1.2) : 0;
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
    const localVision = models.filter(
      (m) => m.supportsVision && !isCloudModelName(m.name),
    );
    if (localVision.length > 0) {
      // Moondream (and similar tiny vision-first models) often **narrates** instead of emitting
      // `TOOL_CALL:` when agent/MCP tool prompts are large — triggering corrective retries and
      // poor UX. Skip them for Auto when `preferToolCapable` is also true; if nothing remains,
      // fall back to the full local vision list so image chat still works when Moondream is the
      // only vision model installed.
      let visionPool = localVision;
      if (preferToolCapable) {
        const skipForTools = (name) => {
          const lc = String(name || "").toLowerCase();
          return lc.includes("moondream");
        };
        const filtered = localVision.filter((m) => !skipForTools(m.name));
        if (filtered.length > 0) visionPool = filtered;
      }

      // Prefer dedicated vision specialists first: they stay focused on the image
      // and don't confabulate from the surrounding agent system prompt the way
      // small generalist vision LLMs (e.g. llava:7b) do.
      const VISION_SPECIALISTS = [
        "moondream",
        "qwen-vl",
        "deepseek-vl",
        "minicpm-v",
        "glm-4v",
        "yi-vl",
        "internvl",
      ];
      const isSpecialist = (n) => {
        const lc = String(n || "").toLowerCase();
        return VISION_SPECIALISTS.some((s) => lc.includes(s));
      };
      const specialists = visionPool.filter((m) => isSpecialist(m.name));
      const pickFrom = (list) => {
        // Largest under 15GB (better quality), else smallest available.
        // Note: m.size is in GB (e.g. 18.8), not bytes.
        const underCap = list.filter((m) => (m.size || 0) < 15);
        return underCap.length > 0
          ? underCap.sort((a, b) => (b.size || 0) - (a.size || 0))[0]
          : list.sort((a, b) => (a.size || 0) - (b.size || 0))[0];
      };
      const pick =
        specialists.length > 0 ? pickFrom(specialists) : pickFrom(visionPool);
      return { resolved: pick.name, wasAuto: true, basis: base };
    }
    // No local vision model — fall through to normal resolution (cloud will fail on images)
  }

  // When agent tools are active, prefer a model validated to emit TOOL_CALL:
  // patterns. This applies to BOTH a cloud base (most cloud-proxied models don't
  // support the format — only TOOL_CALL_CAPABLE_CLOUD is validated) AND a local
  // base (e.g. a weak local tool-caller chosen when no cloud key is set — the
  // gemma4-narrates-instead-of-calling case). If the base is already a known-good
  // tool-caller and installed, respect it; otherwise swap to one, staying on the
  // base's tier (local↔local / cloud↔cloud) so we don't force a local user onto
  // cloud (or vice-versa) just to get tool calling.
  if (preferToolCapable) {
    const baseCloud = isCloudModelName(base);
    const baseIsToolCapable = baseCloud
      ? TOOL_CALL_CAPABLE_CLOUD.includes(base)
      : nameMatchesAny(base, TOOL_CALL_CAPABLE);
    if (baseIsToolCapable) {
      const baseMatch = matchAvailable(base, availableSet);
      if (baseMatch) {
        return { resolved: baseMatch, wasAuto: true, basis: base };
      }
    }
    const localToolPick = pickFirstAvailable(
      TOOL_CALL_CAPABLE,
      availableSet,
      null,
    );
    const cloudToolPick = pickFirstAvailable(
      TOOL_CALL_CAPABLE_CLOUD,
      availableSet,
      null,
    );
    const ordered = baseCloud
      ? [cloudToolPick, localToolPick]
      : [localToolPick, cloudToolPick];
    for (const pick of ordered) {
      if (pick) {
        return { resolved: pick, wasAuto: true, basis: base };
      }
    }
    // No validated tool-caller installed — fall through to normal resolution
    // (the configured base, including gemma4 as a last resort, still gets used).
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

/**
 * Resolve a model's advertised context window.
 *
 * Lives in auto-model (not ollama-client) because auto-model already requires
 * ollama-client at module load — moving the helper into ollama-client would
 * create a circular dependency.
 *
 * Return-shape contract: ALWAYS a number.
 *   - `> 0` = real advertised length (from /api/show or cloud heuristic)
 *   - `0`   = unknown
 * Never returns `null` / `undefined` / `NaN`. Phase 2's `ctxTarget` chain
 * relies on `0` being falsy. Only the route handler (server.js
 * /api/model-context) converts `0` → `null` for the JSON response.
 *
 * @param {string} name      Model name (e.g. "llama3.1:8b" or "kimi-k2:1t-cloud")
 * @param {string} ollamaUrl Ollama server URL
 * @param {string} [apiKey]  Optional Bearer key for cloud / authed Ollama
 * @returns {Promise<number>}
 */
async function getContextLengthForModel(name, ollamaUrl, apiKey) {
  const safe = String(name || "").trim();
  if (!safe) return 0;
  if (isCloudModelName(safe)) {
    return guessCloudContext(safe) || 0;
  }
  try {
    const ctx = await fetchContextLength(ollamaUrl, safe, apiKey);
    return Number.isFinite(ctx) && ctx > 0 ? ctx : 0;
  } catch {
    return 0;
  }
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
  getContextLengthForModel,
};
