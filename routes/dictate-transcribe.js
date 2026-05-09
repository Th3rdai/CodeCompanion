const express = require("express");
const { getConfig } = require("../lib/config");
const {
  effectiveDictateGroqApiKey,
  isDictateTranscribeConfigured,
  transcribeWithGroq,
  MAX_AUDIO_BYTES,
} = require("../lib/dictate-transcribe");

module.exports = function createDictateTranscribeRouter(appContext) {
  const router = express.Router();
  const { log, requireLocalOrApiKey } = appContext;

  /**
   * POST /api/dictate-transcribe
   * Body: { audioBase64: string, mimeType?: string }
   * Requires Groq API key (env GROQ_API_KEY / DICTATE_GROQ_API_KEY or config dictateGroqApiKey).
   */
  router.post("/dictate-transcribe", requireLocalOrApiKey, async (req, res) => {
    try {
      const config = getConfig();
      if (!isDictateTranscribeConfigured(config)) {
        return res.status(503).json({
          error:
            "Dictation fallback is not configured. Add a Groq API key in Settings → General (voice dictation) or set env GROQ_API_KEY, then save.",
          code: "DICTATE_NOT_CONFIGURED",
        });
      }

      const raw = req.body && req.body.audioBase64;
      if (typeof raw !== "string" || !raw.trim()) {
        return res.status(400).json({ error: "Missing audioBase64" });
      }

      let buf;
      try {
        buf = Buffer.from(raw, "base64");
      } catch {
        return res.status(400).json({ error: "Invalid base64 audio" });
      }

      if (!buf.length || buf.length > MAX_AUDIO_BYTES) {
        return res.status(413).json({
          error: `Audio too large or empty (max ${Math.floor(MAX_AUDIO_BYTES / 1024 / 1024)} MB)`,
        });
      }

      const mimeType =
        typeof req.body.mimeType === "string" && req.body.mimeType.trim()
          ? req.body.mimeType.trim()
          : "audio/webm";

      const apiKey = effectiveDictateGroqApiKey(config);
      const text = await transcribeWithGroq(buf, mimeType, apiKey);
      log("INFO", "Dictate transcribe OK", { chars: text.length });
      return res.json({ text });
    } catch (err) {
      log("WARN", "Dictate transcribe failed", { error: err.message });
      return res.status(502).json({
        error: err.message || "Transcription failed",
        code: "DICTATE_FAILED",
      });
    }
  });

  return router;
};
