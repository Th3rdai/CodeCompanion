// Vision model families that support image input
const VISION_FAMILIES = [
  'llava',           // LLaVA (all variants)
  'bakllava',        // BakLLaVA
  'minicpm-v',       // MiniCPM-V
  'moondream',       // Moondream (efficient vision)
  'minimax',         // MiniMax M2
  'cogvlm',          // CogVLM
  'fuyu',            // Fuyu
  'idefics',         // IDEFICS
  'qwen-vl',         // Qwen-VL
  'internvl',        // InternVL
  'yi-vl',           // Yi-VL
  'deepseek-vl',     // DeepSeek-VL
  'glm-4v',          // GLM-4V
];

function checkVisionModel(family, modelName = '') {
  if (!family && !modelName) return false;
  const normalizedFamily = (family || '').toLowerCase();
  const normalizedName = (modelName || '').toLowerCase();

  // Check both family and model name (llava models report family as "llama")
  return VISION_FAMILIES.some(vf =>
    normalizedFamily.includes(vf) || normalizedName.includes(vf)
  );
}

/**
 * API key from config and/or OLLAMA_API_KEY (used for Ollama Cloud: https://ollama.com).
 */
function effectiveOllamaApiKey(config) {
  if (config && typeof config.ollamaApiKey === 'string' && config.ollamaApiKey.trim()) {
    return config.ollamaApiKey.trim();
  }
  const env = process.env.OLLAMA_API_KEY;
  return (env && String(env).trim()) || '';
}

function jsonHeaders(apiKey) {
  const h = { 'Content-Type': 'application/json' };
  const k = apiKey && String(apiKey).trim();
  if (k) h.Authorization = `Bearer ${k}`;
  return h;
}

/** Strip non-Ollama-body fields from chat option bags */
function splitChatOpts(ollamaOptions = {}) {
  const { abortSignal, apiKey, ...restOpts } = ollamaOptions;
  return { abortSignal, apiKey, restOpts };
}

async function listModels(ollamaUrl, opts = {}) {
  const apiKey = opts.apiKey || '';
  const url = `${ollamaUrl}/api/tags`;
  const response = await fetch(url, { headers: jsonHeaders(apiKey) });
  const data = await response.json();

  return (data.models || []).map(m => {
    const family = m.details?.family || 'unknown';
    return {
      name: m.name,
      size: Math.round(m.size / 1024 / 1024 / 1024 * 10) / 10,
      modified: m.modified_at,
      family,
      paramSize: m.details?.parameter_size || '',
      supportsVision: checkVisionModel(family, m.name),
    };
  });
}

async function checkConnection(ollamaUrl, opts = {}) {
  const apiKey = opts.apiKey || '';
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

function chatStream(ollamaUrl, model, messages, images = [], ollamaOptions = {}) {
  const url = `${ollamaUrl}/api/chat`;
  const { abortSignal, apiKey, restOpts } = splitChatOpts(ollamaOptions);

  // Attach images to the last user message if provided
  const enrichedMessages = messages;
  if (images && images.length > 0 && messages.length > 0) {
    enrichedMessages[messages.length - 1] = {
      ...messages[messages.length - 1],
      images: images // base64 strings WITHOUT data URI prefix
    };
  }

  // Build options (num_ctx, temperature, etc.) — only include if set
  const options = {};
  if (restOpts.num_ctx > 0) options.num_ctx = restOpts.num_ctx;
  if (restOpts.temperature !== undefined) options.temperature = restOpts.temperature;

  return fetch(url, {
    method: 'POST',
    headers: jsonHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: enrichedMessages,
      stream: true,
      ...(Object.keys(options).length > 0 && { options })
    }),
    ...(abortSignal && { signal: abortSignal })
  });
}

async function chatComplete(ollamaUrl, model, messages, timeoutMs = 120000, images = [], ollamaOptions = {}) {
  const url = `${ollamaUrl}/api/chat`;
  const { abortSignal, apiKey, restOpts } = splitChatOpts(ollamaOptions);

  // Increase timeout when images are present (vision models are slower)
  if (images && images.length > 0) {
    timeoutMs = Math.max(timeoutMs, 300000); // Minimum 300s (5 min) for vision
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    // Attach images to the last user message if provided
    const enrichedMessages = messages;
    if (images && images.length > 0 && messages.length > 0) {
      enrichedMessages[messages.length - 1] = {
        ...messages[messages.length - 1],
        images: images // base64 strings WITHOUT data URI prefix
      };
    }

    // Build options — merge num_ctx with temperature:0
    const options = {};
    if (restOpts.num_ctx > 0) options.num_ctx = restOpts.num_ctx;
    if (restOpts.temperature !== undefined) options.temperature = restOpts.temperature;

    const response = await fetch(url, {
      method: 'POST',
      headers: jsonHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages: enrichedMessages,
        stream: false,
        ...(Object.keys(options).length > 0 && { options })
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function chatStructured(ollamaUrl, model, messages, jsonSchema, timeoutMs = 120000, images = [], ollamaOptions = {}) {
  const url = `${ollamaUrl}/api/chat`;
  const { abortSignal, apiKey, restOpts } = splitChatOpts(ollamaOptions);

  // Increase timeout when images are present (vision models are slower)
  if (images && images.length > 0) {
    timeoutMs = Math.max(timeoutMs, 300000); // Minimum 300s (5 min) for vision
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Attach images to the last user message if provided
    const enrichedMessages = messages;
    if (images && images.length > 0 && messages.length > 0) {
      enrichedMessages[messages.length - 1] = {
        ...messages[messages.length - 1],
        images: images // base64 strings WITHOUT data URI prefix
      };
    }

    // Build options — merge num_ctx with temperature:0
    const options = { temperature: 0 };
    if (restOpts.num_ctx > 0) options.num_ctx = restOpts.num_ctx;

    const response = await fetch(url, {
      method: 'POST',
      headers: jsonHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages: enrichedMessages,
        format: jsonSchema,
        stream: false,
        options
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    let raw = data.message?.content || '{}';
    // Strip markdown code fences (```json ... ```) that cloud models often add
    raw = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    return JSON.parse(raw);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function embed(ollamaUrl, text, model = 'nomic-embed-text', embedOpts = {}) {
  const apiKey = embedOpts.apiKey || '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${ollamaUrl}/api/embed`, {
      method: 'POST',
      headers: jsonHeaders(apiKey),
      body: JSON.stringify({ model, input: text }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Embed failed: ${res.status}`);
    const data = await res.json();
    return data.embeddings[0];
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

module.exports = {
  listModels,
  checkConnection,
  chatStream,
  chatComplete,
  chatStructured,
  embed,
  effectiveOllamaApiKey,
};
