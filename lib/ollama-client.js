// Vision model families that support image input
const VISION_FAMILIES = [
  "llava", // LLaVA (all variants)
  "bakllava", // BakLLaVA
  "minicpm-v", // MiniCPM-V
  "moondream", // Moondream (efficient vision)
  "minimax", // MiniMax M2
  "cogvlm", // CogVLM
  "fuyu", // Fuyu
  "idefics", // IDEFICS
  "qwen-vl", // Qwen-VL
  "internvl", // InternVL
  "yi-vl", // Yi-VL
  "deepseek-vl", // DeepSeek-VL
  "glm-4v", // GLM-4V
  "mllama", // Meta multimodal Llama (llama3.2-vision and successors)
];

function checkVisionModel(family, modelName = "") {
  if (!family && !modelName) return false;
  const normalizedFamily = (family || "").toLowerCase();
  const normalizedName = (modelName || "").toLowerCase();

  // Check both family and model name (llava models report family as "llama")
  return VISION_FAMILIES.some(
    (vf) => normalizedFamily.includes(vf) || normalizedName.includes(vf),
  );
}

/**
 * API key: process.env (from repo-root .env) wins over .cc-config.json so secrets stay out of JSON.
 */
function effectiveOllamaApiKey(config) {
  const env = process.env.OLLAMA_API_KEY;
  if (env && String(env).trim()) return String(env).trim();
  if (
    config &&
    typeof config.ollamaApiKey === "string" &&
    config.ollamaApiKey.trim()
  ) {
    return config.ollamaApiKey.trim();
  }
  return "";
}

function ollamaAuthOpts(cfg) {
  const k = effectiveOllamaApiKey(cfg);
  return k ? { apiKey: k } : {};
}

function jsonHeaders(apiKey) {
  const h = { "Content-Type": "application/json" };
  const k = apiKey && String(apiKey).trim();
  if (k) h.Authorization = `Bearer ${k}`;
  return h;
}

/** Minimum chat timeout when images are present (vision models are slower). */
const VISION_CHAT_TIMEOUT_MIN_MS = 300000;

/**
 * Resolve the abort timeout for chatComplete/chatStructured.
 * @param {number} timeoutMs
 * @param {string[]} images
 * @param {{ honorExplicitTimeout?: boolean }} [opts]
 * @returns {number}
 */
function resolveChatTimeoutMs(
  timeoutMs,
  images,
  { honorExplicitTimeout = false } = {},
) {
  if (honorExplicitTimeout) return timeoutMs;
  if (images && images.length > 0) {
    return Math.max(timeoutMs, VISION_CHAT_TIMEOUT_MIN_MS);
  }
  return timeoutMs;
}

/** Strip non-Ollama-body fields from chat option bags */
function splitChatOpts(ollamaOptions = {}) {
  const {
    abortSignal,
    apiKey,
    honorExplicitTimeout = false,
    ...restOpts
  } = ollamaOptions;
  return { abortSignal, apiKey, honorExplicitTimeout, restOpts };
}

const DEFAULT_OLLAMA_FAIL_DETAIL_MAX = 2000;

/**
 * Read a failed Ollama HTTP response body (`{ "error": "..." }` or plain text).
 * Consumes the body — call once per failed Response.
 * @param {import('node-fetch').Response} response
 * @returns {Promise<{ status: number, detail: string, formatted: string }>}
 */
async function summarizeOllamaFail(
  response,
  maxDetail = DEFAULT_OLLAMA_FAIL_DETAIL_MAX,
) {
  const status = response.status;
  let raw = "";
  try {
    raw = await response.text();
  } catch {
    return { status, detail: "", formatted: `Ollama error: ${status}` };
  }
  raw = String(raw || "").trim();
  let detail = "";
  if (raw) {
    try {
      const j = JSON.parse(raw);
      if (j && typeof j.error === "string" && j.error.trim()) {
        detail = j.error.trim();
      } else {
        detail = raw;
      }
    } catch {
      detail = raw;
    }
    if (detail.length > maxDetail) {
      detail = `${detail.slice(0, maxDetail)}…`;
    }
  }
  const formatted = detail
    ? `Ollama error: ${status} — ${detail}`
    : `Ollama error: ${status}`;
  return { status, detail, formatted };
}

/**
 * Best-effort JSON extraction from an Ollama error detail body.
 * Caps input at 4 KB and scans last-`{` first so trailing JSON wins over
 * stray earlier braces. Fail-closed: any parse error returns null so the
 * legacy regex path keeps working.
 *
 * Returns `{ code, errType }` (`undefined` when missing) or `null`.
 */
function tryExtractJson(s) {
  const raw = String(s || "");
  if (!raw) return null;
  const capped = raw.length > 4096 ? raw.slice(-4096) : raw;
  const start = capped.lastIndexOf("{");
  if (start < 0) return null;
  for (let i = start; i >= 0; i = capped.lastIndexOf("{", i - 1)) {
    const slice = capped.slice(i);
    try {
      const parsed = JSON.parse(slice);
      if (parsed && typeof parsed === "object") {
        const errObj = parsed.error;
        const code =
          errObj && typeof errObj === "object" ? errObj.code : undefined;
        const errType =
          errObj && typeof errObj === "object" ? errObj.type : undefined;
        return { code, errType };
      }
    } catch {
      // try previous `{`
    }
  }
  return null;
}

/**
 * Parse status + detail from an Error thrown by chatComplete/chatStructured after enrich.
 *
 * Returns `{ status, detail }` for legacy callers, plus `code` / `errType`
 * when the detail body contained a JSON envelope (Ollama Cloud + some
 * server builds emit `{ "error": { "code": ..., "type": ... } }`).
 * The two extra fields are optional — existing destructure callers that
 * only read `status` and `detail` are unaffected.
 */
function parseOllamaErrMsg(message) {
  const m = String(message || "");
  const sm = m.match(/Ollama error:\s*(\d{3})/i);
  if (!sm) {
    return { status: 0, detail: "" };
  }
  const status = parseInt(sm[1], 10);
  const dm = m.match(/Ollama error:\s*\d{3}\s*[—\-]\s*([\s\S]+)/i);
  const detail = dm ? dm[1].trim() : "";
  const json = tryExtractJson(detail);
  if (json && (json.code !== undefined || json.errType !== undefined)) {
    return { status, detail, code: json.code, errType: json.errType };
  }
  return { status, detail };
}

/**
 * Safe user-visible line for chat failures (streaming + chatComplete paths).
 *
 * @param {object} args
 * @param {number} args.status        HTTP status (0 if the fetch never reached a response).
 * @param {string} args.detail        Error body / message tail.
 * @param {number} [args.totalChars]  Total prompt size — used to phrase the size-aware fallback.
 * @param {(level: string, msg: string, data?: object) => void} [args.log]
 *   Optional logger. When provided, the matched rule name is logged at INFO
 *   level. Detail is intentionally omitted from the log meta (no PII).
 */
function formatUserOllamaChatError({
  status,
  detail,
  totalChars = 0,
  model,
  log,
} = {}) {
  const d = String(detail || "").trim();
  const low = d.toLowerCase();
  const kb = Math.max(1, Math.round(totalChars / 1024));
  // Cloud-proxied models (name includes "cloud") fail differently than a dead
  // local daemon: the long-lived stream to ollama.com can drop mid-response on
  // large prompts/long replies. Detect so the network-unreachable line doesn't
  // wrongly blame the (healthy) local Ollama. Matches lib/auto-model.js
  // isCloudModelName without importing it (avoid a module cycle).
  const isCloudModel = typeof model === "string" && /cloud/i.test(model);

  let matched = null;
  let result = null;
  function tryRule(name, predicate, message) {
    if (matched) return;
    if (predicate()) {
      matched = name;
      result = typeof message === "function" ? message() : message;
    }
  }

  tryRule(
    "network-unreachable",
    () =>
      status === 0 &&
      (/fetch failed|econnreset|enetunreach|ehostunreach|socket hang up/i.test(
        low,
      ) ||
        low.includes("network")),
    () =>
      isCloudModel
        ? "The connection to the Ollama Cloud model dropped mid-response — common on long replies or large prompts. Your local Ollama is fine. Try again, shorten the conversation, or pick a local model in the toolbar."
        : "Could not reach Ollama. Check that Ollama is running and Settings → General has the correct server URL.",
  );

  tryRule(
    "context-overflow",
    () =>
      low.includes("context") &&
      (low.includes("window") ||
        low.includes("length") ||
        low.includes("exceed") ||
        low.includes("token") ||
        low.includes("kv cache") ||
        low.includes("n_ctx") ||
        low.includes("nctx")),
    "Context window or model limit exceeded. Try a shorter message, less history or tool output, or a model with a larger context.",
  );

  tryRule(
    "model-not-found",
    () =>
      (low.includes("model") &&
        (low.includes("not found") || low.includes("unknown"))) ||
      (low.includes("pull") && low.includes("model")),
    () => {
      const clip = d.length > 600 ? `${d.slice(0, 600)}…` : d;
      return clip
        ? `Ollama model error: ${clip}`
        : `Ollama returned HTTP ${status}. Check the model name and pull it if needed.`;
    },
  );

  tryRule(
    "model-load-failed",
    () =>
      low.includes("manifest unknown") ||
      low.includes("blob not found") ||
      low.includes("failed to load model") ||
      low.includes("model not loaded"),
    () => {
      const tail = d.length > 220 ? `${d.slice(0, 220)}…` : d;
      return tail
        ? `The model failed to load. Try \`ollama pull <model>\` or pick a different model. Details: ${tail}`
        : "The model failed to load. Try `ollama pull <model>` or pick a different model.";
    },
  );

  tryRule(
    "gpu-oom",
    () =>
      low.includes("cuda") ||
      low.includes("gpu") ||
      low.includes("vram") ||
      low.includes("out of memory") ||
      low.includes("oom") ||
      low.includes("mmap"),
    () => {
      const tail = d.length > 220 ? `${d.slice(0, 220)}…` : d;
      return tail
        ? `Ollama ran out of GPU memory or could not load the context. Try a smaller model, reduce conversation size, or lower context in Settings. (${tail})`
        : "Ollama ran out of GPU memory or could not load the context. Try a smaller model or reduce conversation size.";
    },
  );

  // Ollama Cloud opaque 500: body is generic ("Internal Server Error") plus a
  // ref-id stamped by the cloud edge. Detect this BEFORE the size-aware
  // fallback so a borderline-large request that auto-routed to cloud doesn't
  // get blamed on context/GPU. Common real causes: missing/expired API key,
  // transient cloud outage, per-model rate limit.
  const refMatch = d.match(/ref:\s*([0-9a-f-]{8,})/i);
  tryRule(
    "cloud-opaque-500",
    () => status === 500 && !!refMatch,
    () =>
      `Ollama Cloud returned an opaque error (ref: ${refMatch[1]}). This usually means a missing/expired API key (Settings → General → Ollama Cloud API key), a per-model rate limit, or a transient cloud outage — not a problem with your message. Try again in a moment, or switch to a local model.`,
  );

  tryRule(
    "large-payload-500",
    () => status === 500 && totalChars > 30000,
    () => {
      const tail = d.length > 420 ? `${d.slice(0, 420)}…` : d;
      return tail
        ? `The request is large (~${kb} KB of text). Ollama returned an error — often context size or GPU memory. Try fewer messages or attachments. Details: ${tail}`
        : `The request is large (~${kb} KB of text). Ollama returned HTTP 500 — often context size or GPU memory. Try fewer messages or attachments.`;
    },
  );

  tryRule(
    "generic",
    () => true,
    () => {
      if (d) return d.length > 900 ? `${d.slice(0, 900)}…` : d;
      if (status === 404)
        return "Ollama returned HTTP 404. Check the server URL in Settings.";
      return `Ollama returned HTTP ${status || 500}. Check that Ollama is running and the model is available.`;
    },
  );

  if (typeof log === "function") {
    try {
      log("INFO", "ollama-chat-error", {
        matched,
        status,
        totalChars,
      });
    } catch {
      // logging must never break error formatting
    }
  }

  return result;
}

/** Short TTL cache — every chat used to call /api/tags; parallel requests still benefit. */
const LIST_MODELS_TTL_MS = 45_000;
let _listModelsCache = { key: "", at: 0, models: null };

// Best-effort context-window heuristics for cloud models that don't expose
// `model_info["{family}.context_length"]` via /api/show. Used as a fallback so
// the model dropdown can still sort cloud models reasonably.
const CLOUD_MODEL_CONTEXT_HINTS = [
  // Anthropic cloud-hosted via Ollama
  { match: /\bclaude.*opus\b/i, contextLength: 200_000 },
  { match: /\bclaude.*sonnet\b/i, contextLength: 200_000 },
  { match: /\bclaude.*haiku\b/i, contextLength: 200_000 },
  // Google Gemini
  { match: /\bgemini.*1\.5.*pro\b/i, contextLength: 2_000_000 },
  { match: /\bgemini.*1\.5\b/i, contextLength: 1_000_000 },
  { match: /\bgemini\b/i, contextLength: 1_000_000 },
  // OpenAI cloud-hosted
  { match: /\bgpt-?4o\b/i, contextLength: 128_000 },
  { match: /\bgpt-?4\b/i, contextLength: 128_000 },
  // MiniMax cloud
  { match: /\bminimax\b/i, contextLength: 256_000 },
  // Moonshot Kimi cloud
  { match: /\bkimi\b/i, contextLength: 200_000 },
  // Qwen cloud
  { match: /\bqwen.*max\b/i, contextLength: 256_000 },
  { match: /\bqwen3.*32k\b/i, contextLength: 32_768 },
  // Generic :cloud suffix — assume large
  { match: /:cloud\b/i, contextLength: 128_000 },
];

function guessCloudContext(name) {
  for (const hint of CLOUD_MODEL_CONTEXT_HINTS) {
    if (hint.match.test(name)) return hint.contextLength;
  }
  return 0;
}

async function fetchContextLength(ollamaUrl, modelName, apiKey) {
  try {
    const res = await fetch(`${ollamaUrl}/api/show`, {
      method: "POST",
      headers: jsonHeaders(apiKey),
      body: JSON.stringify({ model: modelName }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    if (data?.error) return 0;
    const info = data.model_info || {};
    // Look for any key ending in `.context_length` regardless of family prefix.
    for (const [k, v] of Object.entries(info)) {
      if (/\.context_length$/i.test(k) && typeof v === "number" && v > 0) {
        return v;
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

async function listModels(ollamaUrl, opts = {}) {
  const apiKey = opts.apiKey || "";
  const cacheKey = `${ollamaUrl}\0${apiKey}`;
  const now = Date.now();
  if (
    _listModelsCache.models &&
    _listModelsCache.key === cacheKey &&
    now - _listModelsCache.at < LIST_MODELS_TTL_MS
  ) {
    return _listModelsCache.models;
  }

  const url = `${ollamaUrl}/api/tags`;
  const response = await fetch(url, { headers: jsonHeaders(apiKey) });
  const data = await response.json();

  const baseModels = (data.models || []).map((m) => {
    const family = m.details?.family || "unknown";
    return {
      name: m.name,
      size: Math.round((m.size / 1024 / 1024 / 1024) * 10) / 10,
      modified: m.modified_at,
      family,
      paramSize: m.details?.parameter_size || "",
      supportsVision: checkVisionModel(family, m.name),
    };
  });

  // Enrich each model with `contextLength` (parallel /api/show calls). Falls
  // back to a name-pattern heuristic for cloud models that don't return useful
  // model_info. Failures resolve to 0 so unknown models sort to the bottom.
  const enriched = await Promise.all(
    baseModels.map(async (m) => {
      let ctx = await fetchContextLength(ollamaUrl, m.name, apiKey);
      if (!ctx) ctx = guessCloudContext(m.name);
      return { ...m, contextLength: ctx };
    }),
  );

  // Sort largest context first; ties break alphabetically by name.
  enriched.sort((a, b) => {
    if ((b.contextLength || 0) !== (a.contextLength || 0)) {
      return (b.contextLength || 0) - (a.contextLength || 0);
    }
    return a.name.localeCompare(b.name);
  });

  _listModelsCache = { key: cacheKey, at: now, models: enriched };
  return enriched;
}

/** Clear listModels cache (e.g. after config changes in tests). */
function invalidateListModelsCache() {
  _listModelsCache = { key: "", at: 0, models: null };
}

async function checkConnection(ollamaUrl, opts = {}) {
  const apiKey = opts.apiKey || "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${ollamaUrl}/api/tags`, {
      signal: controller.signal,
      headers: jsonHeaders(apiKey),
    });
    clearTimeout(timeout);

    const data = await response.json();
    const modelCount = (data.models || []).length;
    return { connected: true, modelCount };
  } catch (err) {
    return { connected: false, modelCount: 0 };
  }
}

/** Tool-loop recovery user line — vision must not bind only to this stub */
const TOOL_RECOVERY_USER_PREFIX =
  "Recovery mode: this request previously stalled";

/**
 * Ollama /api/chat expects raw base64, no data: prefix.
 * @param {string[]|undefined} images
 * @returns {string[]|undefined}
 */
function normalizeVisionImages(images) {
  if (!Array.isArray(images) || images.length === 0) return images;
  return images.map((img) => {
    if (typeof img !== "string") return img;
    const m = img.match(/^data:image\/[a-z0-9+.@-]+;base64,(.+)$/i);
    return m ? m[1] : img;
  });
}

/**
 * Attach vision images to the last real user turn (not assistant/system; not tool-recovery stub).
 * Returns a new array when images are applied so callers are not mutated unexpectedly.
 * @param {object[]} messages
 * @param {string[]} images
 * @returns {object[]}
 */
function messagesWithImagesOnLastUser(messages, images) {
  const norm = normalizeVisionImages(images);
  if (!norm || norm.length === 0 || !messages || messages.length === 0) {
    return messages;
  }
  let idx = messages.length - 1;
  while (idx >= 0 && messages[idx].role !== "user") idx--;
  if (idx < 0) return messages;
  const c = messages[idx].content;
  if (typeof c === "string" && c.startsWith(TOOL_RECOVERY_USER_PREFIX)) {
    let j = idx - 1;
    while (j >= 0 && messages[j].role !== "user") j--;
    if (j >= 0) idx = j;
  }
  return messages.map((m, i) =>
    i === idx ? { ...messages[idx], images: norm } : m,
  );
}

/**
 * POST `/api/chat` with `stream: true`. Returns the `fetch` {@link Response}; callers must read NDJSON from `response.body`.
 *
 * **API contract (regression guard, v1.6.44):** arguments are exactly
 * `(ollamaUrl, model, messages, images, ollamaOptions)`. There is **no** token
 * callback parameter — a historical bug passed `(token) => …` as the 4th
 * argument, which Ollama treated as `images` and dropped real vision input.
 *
 * @param {string} ollamaUrl
 * @param {string} model
 * @param {object[]} messages
 * @param {string[]} [images=[]] Raw base64 strings (optional `data:image/...;base64,` stripped by {@link messagesWithImagesOnLastUser})
 * @param {object} [ollamaOptions={}] `abortSignal`, `apiKey`, `num_ctx`, `temperature`, etc. (see {@link splitChatOpts})
 * @returns {Promise<import('node-fetch').Response>}
 */
function chatStream(
  ollamaUrl,
  model,
  messages,
  images = [],
  ollamaOptions = {},
) {
  const url = `${ollamaUrl}/api/chat`;
  const { abortSignal, apiKey, restOpts } = splitChatOpts(ollamaOptions);

  const enrichedMessages = messagesWithImagesOnLastUser(messages, images);

  // Build options (num_ctx, temperature, etc.) — only include if set
  const options = {};
  if (restOpts.num_ctx > 0) options.num_ctx = restOpts.num_ctx;
  if (restOpts.temperature !== undefined)
    options.temperature = restOpts.temperature;

  return fetch(url, {
    method: "POST",
    headers: jsonHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: enrichedMessages,
      stream: true,
      ...(Object.keys(options).length > 0 && { options }),
    }),
    ...(abortSignal && { signal: abortSignal }),
  });
}

async function chatComplete(
  ollamaUrl,
  model,
  messages,
  timeoutMs = 600000,
  images = [],
  ollamaOptions = {},
) {
  const url = `${ollamaUrl}/api/chat`;
  const { abortSignal, apiKey, honorExplicitTimeout, restOpts } =
    splitChatOpts(ollamaOptions);
  timeoutMs = resolveChatTimeoutMs(timeoutMs, images, { honorExplicitTimeout });

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  if (abortSignal) {
    abortSignal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  try {
    const enrichedMessages = messagesWithImagesOnLastUser(messages, images);

    // Build options — merge num_ctx with temperature:0
    const options = {};
    if (restOpts.num_ctx > 0) options.num_ctx = restOpts.num_ctx;
    if (restOpts.temperature !== undefined)
      options.temperature = restOpts.temperature;

    const response = await fetch(url, {
      method: "POST",
      headers: jsonHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages: enrichedMessages,
        stream: false,
        ...(Object.keys(options).length > 0 && { options }),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const { formatted } = await summarizeOllamaFail(response);
      throw new Error(formatted);
    }

    const data = await response.json();
    return data.message?.content || "";
  } catch (err) {
    clearTimeout(timeout);
    // Distinguish OUR timeout from a caller/client abort. Only the timeout should
    // trigger the slow-model self-heal upstream; a real Stop (abortSignal) must
    // end the turn. Throwing a bare AbortError here was being misread as a client
    // disconnect (chat-post-handler treats AbortError as a Stop), so the
    // slow-model switch never fired and the turn died silently at the timeout.
    if (timedOut && !(abortSignal && abortSignal.aborted)) {
      const e = new Error(
        `Ollama request timed out after ${Math.round(timeoutMs / 1000)}s`,
      );
      e.name = "TimeoutError";
      throw e;
    }
    throw err;
  }
}

async function chatStructured(
  ollamaUrl,
  model,
  messages,
  jsonSchema,
  timeoutMs = 600000,
  images = [],
  ollamaOptions = {},
) {
  const url = `${ollamaUrl}/api/chat`;
  const {
    abortSignal: _abortSignal,
    apiKey,
    honorExplicitTimeout,
    restOpts,
  } = splitChatOpts(ollamaOptions);
  timeoutMs = resolveChatTimeoutMs(timeoutMs, images, { honorExplicitTimeout });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  if (_abortSignal) {
    if (_abortSignal.aborted) {
      clearTimeout(timeout);
      const err = new Error("The request was aborted");
      err.name = "AbortError";
      throw err;
    }
    _abortSignal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        controller.abort();
      },
      { once: true },
    );
  }

  try {
    const enrichedMessages = messagesWithImagesOnLastUser(messages, images);

    // Build options — merge num_ctx with temperature:0
    const options = { temperature: 0 };
    if (restOpts.num_ctx > 0) options.num_ctx = restOpts.num_ctx;

    const response = await fetch(url, {
      method: "POST",
      headers: jsonHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages: enrichedMessages,
        format: jsonSchema,
        stream: false,
        options,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const { formatted } = await summarizeOllamaFail(response);
      throw new Error(formatted);
    }

    const data = await response.json();
    let raw = data.message?.content || "{}";
    // Strip markdown code fences (```json ... ```) that cloud models often add
    raw = raw
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
    return JSON.parse(raw);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function embed(
  ollamaUrl,
  text,
  model = "nomic-embed-text",
  embedOpts = {},
) {
  const apiKey = embedOpts.apiKey || "";
  const outerSignal = embedOpts.signal;
  const timeoutMs =
    typeof embedOpts.timeoutMs === "number" && embedOpts.timeoutMs > 0
      ? embedOpts.timeoutMs
      : 30000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => {
    clearTimeout(timeout);
    controller.abort();
  };
  if (outerSignal) {
    if (outerSignal.aborted) {
      clearTimeout(timeout);
      const err = new Error("The request was aborted");
      err.name = "AbortError";
      throw err;
    }
    outerSignal.addEventListener("abort", onOuterAbort, { once: true });
  }
  try {
    const res = await fetch(`${ollamaUrl}/api/embed`, {
      method: "POST",
      headers: jsonHeaders(apiKey),
      body: JSON.stringify({ model, input: text }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (outerSignal) outerSignal.removeEventListener("abort", onOuterAbort);
    if (!res.ok) throw new Error(`Embed failed: ${res.status}`);
    const data = await res.json();
    return data.embeddings[0];
  } catch (err) {
    clearTimeout(timeout);
    if (outerSignal) outerSignal.removeEventListener("abort", onOuterAbort);
    throw err;
  }
}

module.exports = {
  listModels,
  invalidateListModelsCache,
  checkConnection,
  chatStream,
  chatComplete,
  chatStructured,
  embed,
  effectiveOllamaApiKey,
  ollamaAuthOpts,
  summarizeOllamaFail,
  parseOllamaErrMsg,
  formatUserOllamaChatError,
  // Exported for tests / reuse:
  guessCloudContext,
  fetchContextLength,
  normalizeVisionImages,
  messagesWithImagesOnLastUser,
  checkVisionModel,
  resolveChatTimeoutMs,
  VISION_CHAT_TIMEOUT_MIN_MS,
  VISION_FAMILIES,
};
