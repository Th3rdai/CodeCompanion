/**
 * Optional speech-to-text fallback when the browser Web Speech API cannot reach
 * Google's service (VPN, firewall, corporate network). Uses Groq's OpenAI-
 * compatible audio API; key from env or .cc-config.json (never sent to client).
 */

const GROQ_TRANSCRIBE_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";

const GROQ_WHISPER_MODEL = "whisper-large-v3-turbo";

/** Max binary audio size accepted by POST /api/dictate-transcribe (bytes). */
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

function effectiveDictateGroqApiKey(config) {
  const env = (
    process.env.GROQ_API_KEY ||
    process.env.DICTATE_GROQ_API_KEY ||
    ""
  ).trim();
  if (env) return env;
  const k =
    config && typeof config.dictateGroqApiKey === "string"
      ? config.dictateGroqApiKey.trim()
      : "";
  return k;
}

function isDictateTranscribeConfigured(config) {
  return !!effectiveDictateGroqApiKey(config);
}

/**
 * @param {Buffer} audioBuffer
 * @param {string} mimeType e.g. audio/webm;codecs=opus
 * @param {string} apiKey Groq API key
 * @returns {Promise<string>} transcript text
 */
async function transcribeWithGroq(audioBuffer, mimeType, apiKey) {
  const ext = /webm/i.test(mimeType || "")
    ? "webm"
    : /wav/i.test(mimeType || "")
      ? "wav"
      : /mp4|m4a/i.test(mimeType || "")
        ? "m4a"
        : "webm";
  const filename = `dictate.${ext}`;
  const blob = new Blob([audioBuffer], {
    type: mimeType && mimeType.trim() ? mimeType : "audio/webm",
  });

  const fd = new FormData();
  fd.append("file", blob, filename);
  fd.append("model", GROQ_WHISPER_MODEL);

  const res = await fetch(GROQ_TRANSCRIBE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: fd,
  });

  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 500);
    try {
      const j = JSON.parse(text);
      if (j.error && (j.error.message || j.error.code))
        detail = j.error.message || String(j.error.code);
    } catch {
      /* keep raw */
    }
    throw new Error(`Groq transcription failed (${res.status}): ${detail}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Groq returned non-JSON body");
  }
  const out = typeof parsed.text === "string" ? parsed.text.trim() : "";
  if (!out) throw new Error("Groq returned empty transcript");
  return out;
}

module.exports = {
  effectiveDictateGroqApiKey,
  isDictateTranscribeConfigured,
  transcribeWithGroq,
  MAX_AUDIO_BYTES,
};
