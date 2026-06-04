/**
 * OpenRouter (OpenAI-compatible aggregator) client.
 *
 * Mirrors the public surface of lib/ollama-client's chat functions so the
 * dispatch guards there can delegate transparently when the active provider is
 * "openrouter". Every function reads its base URL + API key from the opts bag
 * (`__ccOpenrouterUrl` / `__ccOpenrouterApiKey`) built by `ollamaAuthOpts`.
 *
 * Design invariants (see OPNRTR.md):
 *  - Streaming returns a Response-like whose `body` is a ReadableStream emitting
 *    **Ollama-shaped NDJSON** so the 7 existing stream consumers work verbatim.
 *  - We NEVER send an OpenAI `tools`/`tool_choice`/`functions` array — the app
 *    relies on the prompted inline `TOOL_CALL:` text protocol which capable
 *    models return in `content`. Native function-calling would empty `content`
 *    and silently break agentic/MCP modes.
 *  - We omit the Ollama-only `num_ctx` (no OR equivalent) and omit `max_tokens`
 *    so the model uses its full completion budget (matches Ollama's uncapped
 *    behavior — a hardcoded cap would truncate long scaffolds/reviews).
 *  - Error strings keep the `Ollama error: NNN — …` prefix so the shared
 *    `parseOllamaErrMsg` status extractor still works; only the user-facing copy
 *    branches by provider (see formatUserOpenrouterChatError).
 *
 * Node >= 22: global fetch / ReadableStream / TransformStream / TextEncoder.
 */

const { resolveChatTimeoutMs } = require("./ollama-client");

const DEFAULT_OR_BASE = "https://openrouter.ai/api/v1";

// Mirrors lib/ollama-client's TOOL_RECOVERY_USER_PREFIX so vision images attach
// to the real user turn, not the tool-loop recovery stub.
const TOOL_RECOVERY_USER_PREFIX =
  "Recovery mode: this request previously stalled";

/** Read base URL (trailing slashes stripped) + API key from the opts bag. */
function readOpts(opts = {}) {
  const apiKey = opts.__ccOpenrouterApiKey || "";
  const base = String(opts.__ccOpenrouterUrl || DEFAULT_OR_BASE).replace(
    /\/+$/,
    "",
  );
  return { apiKey, base };
}

function orHeaders(apiKey) {
  const h = { "Content-Type": "application/json" };
  const k = apiKey && String(apiKey).trim();
  if (k) h.Authorization = `Bearer ${k}`;
  // Optional attribution headers OpenRouter uses for ranking; harmless if absent.
  h["X-Title"] = "Code Companion";
  return h;
}

/** Ensure an image entry is a data URL (the client already sends data: URLs). */
function toDataUrl(img) {
  if (typeof img !== "string" || !img) return null;
  if (/^data:/i.test(img)) return img;
  return `data:image/png;base64,${img}`;
}

/**
 * Convert app messages (role + string content) to OpenAI chat format, attaching
 * vision images to the last real user turn as multimodal content. Reuses the
 * last-user-index logic from ollama-client's messagesWithImagesOnLastUser, but
 * builds `image_url` parts with the data URL passed straight through (do NOT
 * strip the prefix — that's the Ollama path).
 */
function toOpenAiMessages(messages, images = []) {
  const msgs = Array.isArray(messages) ? messages : [];
  const out = msgs.map((m) => ({ role: m.role, content: m.content }));
  const imgs = (Array.isArray(images) ? images : [])
    .map(toDataUrl)
    .filter(Boolean);
  if (imgs.length === 0) return out;

  let idx = out.length - 1;
  while (idx >= 0 && out[idx].role !== "user") idx--;
  if (idx < 0) return out;
  const c = out[idx].content;
  if (typeof c === "string" && c.startsWith(TOOL_RECOVERY_USER_PREFIX)) {
    let j = idx - 1;
    while (j >= 0 && out[j].role !== "user") j--;
    if (j >= 0) idx = j;
  }
  const text = typeof out[idx].content === "string" ? out[idx].content : "";
  out[idx] = {
    role: "user",
    content: [
      { type: "text", text },
      ...imgs.map((url) => ({ type: "image_url", image_url: { url } })),
    ],
  };
  return out;
}

/**
 * Read a failed OpenRouter response into the `Ollama error: NNN — detail` shape
 * (prefix preserved on purpose — see module header). Consumes the body.
 */
async function formattedError(res) {
  const status = res.status;
  let raw = "";
  try {
    raw = String((await res.text()) || "").trim();
  } catch {
    return `Ollama error: ${status}`;
  }
  let detail = "";
  if (raw) {
    try {
      const j = JSON.parse(raw);
      const e = j && j.error;
      if (e && typeof e === "object" && typeof e.message === "string") {
        detail = e.message.trim();
      } else if (typeof e === "string" && e.trim()) {
        detail = e.trim();
      } else {
        detail = raw;
      }
    } catch {
      detail = raw;
    }
    if (detail.length > 2000) detail = `${detail.slice(0, 2000)}…`;
  }
  return detail
    ? `Ollama error: ${status} — ${detail}`
    : `Ollama error: ${status}`;
}

// ── Streaming: OpenAI SSE → Ollama-shaped NDJSON ─────────────────────────────

/**
 * TransformStream parsing OpenAI SSE (`data: {choices:[{delta:{content}}]}`)
 * into NDJSON frames the existing Ollama consumers read:
 *   {"message":{"content":"<delta>"},"done":false}\n
 * and a single terminal frame on `[DONE]` / flush:
 *   {"message":{"content":""},"done":true,"total_duration":0,"eval_count":0}\n
 *
 *  - Skips `:`-comment keep-alives, buffers partial lines across chunks.
 *  - Drops `delta.reasoning` (never forward reasoning to the user).
 *  - `done:true` is gated on `[DONE]`/flush only (no duplicate from finish_reason).
 *  - A mid-stream `{error}` payload ends the stream with the terminal frame.
 */
function makeSseToNdjsonStream() {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let doneEmitted = false;

  const emitToken = (controller, content) => {
    controller.enqueue(
      encoder.encode(
        JSON.stringify({ message: { content }, done: false }) + "\n",
      ),
    );
  };
  const emitDone = (controller) => {
    if (doneEmitted) return;
    doneEmitted = true;
    controller.enqueue(
      encoder.encode(
        JSON.stringify({
          message: { content: "" },
          done: true,
          total_duration: 0,
          eval_count: 0,
        }) + "\n",
      ),
    );
  };

  const handleLine = (controller, rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith(":")) return; // blank or keep-alive comment
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload) return;
    if (payload === "[DONE]") {
      emitDone(controller);
      return;
    }
    if (doneEmitted) return;
    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return; // partial/invalid — ignore (completed lines only reach here)
    }
    if (parsed && parsed.error) {
      // Surface the upstream failure as a visible token instead of silently
      // truncating — otherwise the user sees a clean, "complete" partial reply.
      const msg =
        (parsed.error &&
          (parsed.error.message ||
            (typeof parsed.error === "string" ? parsed.error : ""))) ||
        "stream interrupted";
      emitToken(
        controller,
        `\n\n[OpenRouter error: ${String(msg).slice(0, 300)}]`,
      );
      emitDone(controller);
      return;
    }
    const delta = parsed && parsed.choices && parsed.choices[0]?.delta;
    const content =
      delta && typeof delta.content === "string" ? delta.content : "";
    if (content) emitToken(controller, content);
  };

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep the (possibly partial) trailing line
      for (const line of lines) handleLine(controller, line);
    },
    flush(controller) {
      const trailing = buffer;
      buffer = "";
      if (trailing && trailing.trim()) handleLine(controller, trailing);
      emitDone(controller); // terminal frame if upstream closed without [DONE]
    },
  });
}

/**
 * Streaming chat. Returns a Response-like:
 *   200 → { ok:true, status, body:<ReadableStream NDJSON>, text() }
 *   non-200 → { ok:false, status, async text() } (no body — consumers check .ok first)
 */
async function chatStream(model, messages, images = [], opts = {}) {
  const { apiKey, base } = readOpts(opts);
  const body = {
    model,
    messages: toOpenAiMessages(messages, images),
    stream: true,
  };
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;

  const upstream = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: orHeaders(apiKey),
    body: JSON.stringify(body),
    ...(opts.abortSignal && { signal: opts.abortSignal }),
  });

  if (!upstream.ok) {
    let raw = "";
    try {
      raw = await upstream.text();
    } catch {
      raw = "";
    }
    return {
      ok: false,
      status: upstream.status,
      text: async () => raw,
    };
  }

  const ndjson = upstream.body.pipeThrough(makeSseToNdjsonStream());
  return {
    ok: true,
    status: upstream.status,
    body: ndjson,
    text: async () => "",
  };
}

/**
 * Non-streaming completion. Owns its AbortController + timeout and preserves the
 * TimeoutError-vs-AbortError distinction that drives the slow-model self-heal.
 */
async function chatComplete(
  model,
  messages,
  timeoutMs = 600000,
  images = [],
  opts = {},
) {
  const { apiKey, base } = readOpts(opts);
  timeoutMs = resolveChatTimeoutMs(timeoutMs, images, {
    honorExplicitTimeout: !!opts.honorExplicitTimeout,
  });

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  if (opts.abortSignal) {
    opts.abortSignal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  try {
    const body = {
      model,
      messages: toOpenAiMessages(messages, images),
      stream: false,
    };
    if (typeof opts.temperature === "number")
      body.temperature = opts.temperature;

    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: orHeaders(apiKey),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(await formattedError(res));
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (err) {
    clearTimeout(timeout);
    if (timedOut && !(opts.abortSignal && opts.abortSignal.aborted)) {
      const e = new Error(
        `OpenRouter request timed out after ${Math.round(timeoutMs / 1000)}s`,
      );
      e.name = "TimeoutError";
      throw e;
    }
    throw err;
  }
}

/**
 * Structured (JSON) completion. OpenRouter has no Ollama `format:` field — we
 * use `response_format: { type: "json_object" }` + a trailing schema-instruction
 * message, then reuse the markdown-fence strip + JSON.parse. A model that
 * doesn't support json_object returns 400, which the consumers' try/catch around
 * chatStructured already turns into a chat fallback (degrades, not breaks).
 */
async function chatStructured(
  model,
  messages,
  jsonSchema,
  timeoutMs = 600000,
  images = [],
  opts = {},
) {
  const { apiKey, base } = readOpts(opts);
  timeoutMs = resolveChatTimeoutMs(timeoutMs, images, {
    honorExplicitTimeout: !!opts.honorExplicitTimeout,
  });

  const controller = new AbortController();
  if (opts.abortSignal) {
    if (opts.abortSignal.aborted) {
      const err = new Error("The request was aborted");
      err.name = "AbortError";
      throw err;
    }
    opts.abortSignal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const baseMsgs = toOpenAiMessages(messages, images);
    const schemaMsg = {
      role: "system",
      content: `Respond ONLY with a single JSON object matching this schema (no prose, no markdown): ${JSON.stringify(
        jsonSchema,
      )}`,
    };
    const body = {
      model,
      messages: [...baseMsgs, schemaMsg],
      stream: false,
      temperature: 0,
      response_format: { type: "json_object" },
    };

    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: orHeaders(apiKey),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(await formattedError(res));
    const data = await res.json();
    let raw = data.choices?.[0]?.message?.content || "{}";
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

// ── Catalog + connection ─────────────────────────────────────────────────────

const LIST_MODELS_TTL_MS = 45_000;
let _listModelsCache = { key: "", at: 0, models: null };

/** Friendly context-window tag for the toolbar label (avoids an ugly "(0GB)"). */
function friendlyCtx(n) {
  const v = Number(n) || 0;
  if (!v) return "";
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M ctx`;
  }
  if (v >= 1000) return `${Math.round(v / 1000)}K ctx`;
  return `${v} ctx`;
}

function modelSupportsVision(m) {
  const arch = (m && m.architecture) || {};
  const mods = arch.input_modalities;
  if (Array.isArray(mods) && mods.includes("image")) return true;
  // Older catalog entries expose a modality string like "text+image->text".
  if (typeof arch.modality === "string" && /image/i.test(arch.modality))
    return true;
  return false;
}

/** Map an OpenRouter catalog entry to the app's model shape. */
function mapModel(m) {
  const id = String(m.id || m.name || "");
  const contextLength = Number(m.context_length) || 0;
  return {
    name: id, // plain id, no prefix — safe because provider is a toggle
    family: id.split("/")[0] || "unknown",
    size: 0,
    paramSize: friendlyCtx(contextLength),
    supportsVision: modelSupportsVision(m),
    contextLength,
  };
}

/**
 * GET /models → app-shaped model list, sorted largest-context-first.
 * Throws on non-200 (esp. 401) so server.js /api/models reports connected:false
 * and the Settings "Test" button surfaces the failure.
 */
async function listModels(opts = {}) {
  const { apiKey, base } = readOpts(opts);
  const cacheKey = `${base}\0${apiKey}`;
  const now = Date.now();
  if (
    _listModelsCache.models &&
    _listModelsCache.key === cacheKey &&
    now - _listModelsCache.at < LIST_MODELS_TTL_MS
  ) {
    return _listModelsCache.models;
  }

  const res = await fetch(`${base}/models`, { headers: orHeaders(apiKey) });
  if (!res.ok) {
    let detail = "";
    try {
      detail = String((await res.text()) || "").slice(0, 500);
    } catch {
      detail = "";
    }
    throw new Error(
      `OpenRouter error: ${res.status}${detail ? ` — ${detail}` : ""}`,
    );
  }
  const data = await res.json();
  const models = (data.data || []).map(mapModel);

  models.sort((a, b) => {
    if ((b.contextLength || 0) !== (a.contextLength || 0)) {
      return (b.contextLength || 0) - (a.contextLength || 0);
    }
    return a.name.localeCompare(b.name);
  });

  _listModelsCache = { key: cacheKey, at: now, models };
  return models;
}

function invalidateListModelsCache() {
  _listModelsCache = { key: "", at: 0, models: null };
}

/** Look up a model's advertised context length from the cached catalog. */
async function getContextLengthForModel(name, opts = {}) {
  const safe = String(name || "").trim();
  if (!safe) return 0;
  try {
    const models = await listModels(opts);
    const m = models.find((x) => x.name === safe);
    return m && m.contextLength > 0 ? m.contextLength : 0;
  } catch {
    return 0;
  }
}

async function checkConnection(opts = {}) {
  const { apiKey, base } = readOpts(opts);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${base}/models`, {
      headers: orHeaders(apiKey),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { connected: false, modelCount: 0 };
    const data = await res.json();
    const modelCount = (data.data || []).length;
    return { connected: true, modelCount };
  } catch {
    return { connected: false, modelCount: 0 };
  }
}

/**
 * Provider-specific user-facing chat error copy. Status parsing stays shared
 * (parseOllamaErrMsg) because the adapter keeps the `Ollama error:` prefix; only
 * this final copy branches by provider.
 */
function formatUserOpenrouterChatError({
  status,
  detail,
  totalChars = 0,
  log,
} = {}) {
  const d = String(detail || "").trim();
  const low = d.toLowerCase();
  let matched = null;
  let result = null;

  if (
    low.includes("context") &&
    (low.includes("length") ||
      low.includes("window") ||
      low.includes("token") ||
      low.includes("exceed") ||
      low.includes("maximum context"))
  ) {
    matched = "context-overflow";
    result =
      "Context window or model limit exceeded. Try a shorter message, less history or tool output, or an OpenRouter model with a larger context.";
  } else if (status === 401) {
    matched = "auth";
    result =
      "OpenRouter rejected the request (401 — invalid or missing API key). Check your OpenRouter API key in Settings → General.";
  } else if (status === 402) {
    matched = "credits";
    result =
      "Your OpenRouter account is out of credits (402). Add credits at openrouter.ai, or switch back to Ollama in Settings.";
  } else if (status === 429) {
    matched = "rate-limit";
    result =
      "OpenRouter rate limit hit (429). Wait a moment and try again, or pick a different model.";
  } else if (status === 404) {
    matched = "model-not-found";
    result =
      "OpenRouter could not find that model (404). Pick a different model from the dropdown.";
  } else if (
    status === 0 &&
    (/fetch failed|econnreset|enetunreach|ehostunreach|socket hang up/i.test(
      low,
    ) ||
      low.includes("network"))
  ) {
    matched = "network-unreachable";
    result =
      "Could not reach OpenRouter. Check your internet connection and that openrouter.ai is reachable.";
  } else {
    matched = "generic";
    if (d) {
      result = d.length > 900 ? `${d.slice(0, 900)}…` : d;
    } else {
      result = `OpenRouter returned HTTP ${
        status || 500
      }. Try again or pick a different model.`;
    }
  }

  if (typeof log === "function") {
    try {
      log("INFO", "openrouter-chat-error", { matched, status, totalChars });
    } catch {
      // logging must never break error formatting
    }
  }
  return result;
}

module.exports = {
  chatStream,
  chatComplete,
  chatStructured,
  listModels,
  checkConnection,
  invalidateListModelsCache,
  getContextLengthForModel,
  formatUserOpenrouterChatError,
  // Exported for tests / reuse:
  toOpenAiMessages,
  makeSseToNdjsonStream,
  mapModel,
  friendlyCtx,
};
