/**
 * Resolve "auto" model selection per mode + optional content-size routing.
 * @module lib/auto-model
 */

const { listModels } = require('./ollama-client');

/** Default map: mode id → preferred Ollama model name (must exist on your machine / cloud). */
const DEFAULT_AUTO_MODEL_MAP = {
  chat: 'kimi-k2:1t-cloud',
  explain: 'kimi-k2:1t-cloud',
  bugs: 'kimi-k2:1t-cloud',
  refactor: 'kimi-k2:1t-cloud',
  'translate-tech': 'kimi-k2:1t-cloud',
  'translate-biz': 'kimi-k2:1t-cloud',
  diagram: 'qwen3-32k',
  pentest: 'qwen3-32k',
  validate: 'kimi-k2:1t-cloud',
  review: 'qwen3-32k',
  prompting: 'qwen3-32k',
  skillz: 'qwen3-32k',
  agentic: 'qwen3-32k',
  planner: 'qwen3-32k',
  create: 'kimi-k2:1t-cloud',
  build: 'kimi-k2:1t-cloud',
};

/** Display order for Settings (matches App MODES). */
const MODE_ORDER = [
  'chat', 'explain', 'bugs', 'refactor', 'translate-tech', 'translate-biz', 'diagram',
  'pentest', 'validate', 'review', 'prompting', 'skillz', 'agentic', 'planner', 'create', 'build',
];

const MODE_LABELS = {
  chat: 'Chat',
  explain: 'Explain This',
  bugs: 'Safety Check',
  refactor: 'Clean Up',
  'translate-tech': 'Code → Plain English',
  'translate-biz': 'Idea → Code Spec',
  diagram: 'Diagram',
  pentest: 'Security',
  validate: 'Validate',
  review: 'Review',
  prompting: 'Prompting',
  skillz: 'Skillz',
  agentic: 'Agentic',
  planner: 'Planner',
  create: 'Create',
  build: 'Build',
};

const CLOUD_FALLBACKS = ['kimi-k2:1t-cloud', 'minimax-m2:cloud', 'glm-4.6:cloud'];
const LOCAL_FALLBACKS = ['qwen3-32k', 'qwen3:8b', 'llama3.2:8b', 'llama3.1:8b'];

function isCloudModelName(name) {
  if (!name || typeof name !== 'string') return false;
  const n = name.toLowerCase();
  return n.includes('cloud');
}

function mergeAutoModelMap(saved) {
  const out = { ...DEFAULT_AUTO_MODEL_MAP };
  if (saved && typeof saved === 'object') {
    for (const k of Object.keys(DEFAULT_AUTO_MODEL_MAP)) {
      if (typeof saved[k] === 'string' && saved[k].trim()) out[k] = saved[k].trim();
    }
  }
  return out;
}

function matchAvailable(name, availableSet) {
  if (!name) return null;
  if (availableSet.has(name)) return name;
  // Try with :latest suffix (Ollama reports "qwen3-32k:latest" but config stores "qwen3-32k")
  if (availableSet.has(name + ':latest')) return name + ':latest';
  // Try without :latest suffix
  if (name.endsWith(':latest') && availableSet.has(name.replace(':latest', ''))) return name.replace(':latest', '');
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
 * @returns {Promise<{ resolved: string, wasAuto: boolean, basis: string }>}
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
  } = opts;

  if (requestedModel !== 'auto') {
    return { resolved: requestedModel, wasAuto: false, basis: requestedModel };
  }

  const map = mergeAutoModelMap(config.autoModelMap);
  const base = map[mode] || map.chat || 'qwen3-32k';

  const models = await listModels(ollamaUrl, ollamaOpts);
  const names = models.map(m => m.name);
  const availableSet = new Set(names);

  if (names.length === 0) {
    return { resolved: base, wasAuto: true, basis: base };
  }

  if (preferVision) {
    // Cloud models report vision support but can't handle image uploads via Ollama — prefer local vision models
    // Prefer mid-size vision models (7-12B) for best speed/quality balance; avoid 34B+ which may OOM
    const localVision = models.filter(m => m.supportsVision && !isCloudModelName(m.name));
    if (localVision.length > 0) {
      // Sort by size, prefer models under 15GB (fits in most GPUs)
      // Note: m.size is in GB (e.g. 18.8), not bytes
      const preferred = localVision.filter(m => (m.size || 0) < 15);
      const pick = preferred.length > 0
        ? preferred.sort((a, b) => (b.size || 0) - (a.size || 0))[0]  // largest under 15GB
        : localVision.sort((a, b) => (a.size || 0) - (b.size || 0))[0]; // smallest available
      return { resolved: pick.name, wasAuto: true, basis: base };
    }
    // No local vision model — fall through to normal resolution (cloud will fail on images)
  }

  let preference = base;

  // If the mapped model is available, use it directly — respect the user's per-mode choice
  const baseMatch = matchAvailable(base, availableSet);
  if (baseMatch) {
    preference = baseMatch;
  } else {
    // Mapped model not available — fall back based on content size
    const cloudAvailable = names.filter(isCloudModelName);
    const localAvailable = names.filter(n => !isCloudModelName(n));

    if (estimatedTokens > 10000 && cloudAvailable.length > 0) {
      const cloudPick = CLOUD_FALLBACKS.find(n => availableSet.has(n)) || cloudAvailable[0];
      preference = cloudPick || base;
    } else if (estimatedTokens < 2000 && localAvailable.length > 0 && !isCloudModelName(base)) {
      const localPick = LOCAL_FALLBACKS.find(n => availableSet.has(n)) || localAvailable[0];
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
  MODE_ORDER,
  MODE_LABELS,
  mergeAutoModelMap,
  resolveAutoModel,
  isCloudModelName,
};
