"use strict";

const express = require("express");
const { getConfig } = require("../lib/config");
const { mergeAutoModelMap } = require("../lib/auto-model");
const {
  checkConnection,
  chatComplete,
  chatStructured,
  listModels,
  ollamaAuthOpts,
} = require("../lib/ollama-client");
const { parseSetupAssistantJson } = require("../lib/setup-assistant-json");
const {
  normalizeIntents,
  mapIntentsToConfigBody,
  buildAcquireList,
  buildSystemPromptSnippet,
} = require("../lib/setup-services");
const createConfigRouter = require("./config");

const MAX_MESSAGES = 12;
const MAX_TOTAL_CHARS = 8000;
const OLLAMA_TIMEOUT_MS = 55_000;
const SNAPSHOT_JSON_MAX = 14_000;

/** Prefer small local tags; `listModels` order is context-sorted, not size-sorted. */
const SETUP_MODEL_FALLBACKS = [
  "llama3.2",
  "llama3.1",
  "phi3",
  "mistral",
  "tinyllama",
  "qwen2.5-coder",
];

const SETUP_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    intents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          action: { type: "string", enum: ["enable", "disable", "skip"] },
        },
        required: ["id", "action"],
      },
    },
    summary: { type: "string" },
  },
  required: ["intents", "summary"],
};

function truncateSnapshotJson(jsonStr) {
  if (jsonStr.length <= SNAPSHOT_JSON_MAX) return jsonStr;
  return `${jsonStr.slice(0, SNAPSHOT_JSON_MAX)}\n…(truncated for setup prompt)`;
}

/**
 * Pick a model that actually exists on this Ollama. Auto-model map defaults
 * often point at cloud-only tags (e.g. kimi-*-cloud) which break local setups.
 * @param {object} config
 * @param {string} ollamaUrl
 * @returns {Promise<string>}
 */
async function pickSetupModel(config, ollamaUrl) {
  const opts = ollamaAuthOpts(config);
  let names = [];
  try {
    const models = await listModels(ollamaUrl, opts);
    names = models.map((m) => m.name);
  } catch {
    names = [];
  }
  const nameSet = new Set(names);

  const pickIfPresent = (want) => {
    if (!want || want === "auto") return null;
    if (nameSet.size === 0) return want;
    if (nameSet.has(want)) return want;
    const hit = names.find((n) => n === want || n.startsWith(`${want}:`));
    return hit || null;
  };

  const env = String(process.env.CC_SETUP_ASSISTANT_MODEL || "").trim();
  const fromEnv = pickIfPresent(env);
  if (fromEnv) return fromEnv;

  const sel = String(config.selectedModel || "").trim();
  const fromSel = pickIfPresent(sel);
  if (fromSel) return fromSel;

  const m = mergeAutoModelMap(config.autoModelMap);
  const fromMap = pickIfPresent(String(m.chat || "").trim());
  if (fromMap) return fromMap;

  for (const base of SETUP_MODEL_FALLBACKS) {
    const hit = names.find((n) => n === base || n.startsWith(`${base}:`));
    if (hit) return hit;
  }

  return names[0] || "llama3.2";
}

function summarizeMessages(messages) {
  if (!Array.isArray(messages)) return "";
  const parts = [];
  let total = 0;
  const capped = messages.slice(-MAX_MESSAGES);
  for (const m of capped) {
    if (!m || typeof m !== "object") continue;
    const role = m.role === "assistant" ? "assistant" : "user";
    const content =
      typeof m.content === "string" ? m.content : String(m.content ?? "");
    const piece = `[${role}]\n${content}`;
    if (total + piece.length > MAX_TOTAL_CHARS) break;
    parts.push(piece);
    total += piece.length;
  }
  return parts.join("\n\n");
}

module.exports = function createSetupAssistantRouter(appContext) {
  const router = express.Router();
  const { requireLocalOrApiKey, log } = appContext;

  router.post("/setup-assistant", requireLocalOrApiKey, async (req, res) => {
    const isElectron = req.body?.isElectron === true;
    const config = getConfig();
    const ollamaUrl = config.ollamaUrl || "http://localhost:11434";

    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "messages array is required",
        code: "BAD_REQUEST",
      });
    }

    const userBlob = summarizeMessages(messages);
    if (!userBlob.trim()) {
      return res.status(400).json({
        error: "No usable message content",
        code: "BAD_REQUEST",
      });
    }

    const conn = await checkConnection(ollamaUrl, ollamaAuthOpts(config));
    if (!conn.connected) {
      return res.status(503).json({
        code: "OLLAMA_UNAVAILABLE",
        fallback: "checklist",
        steps: [
          "Install or start Ollama on this machine.",
          "Confirm the server URL under Settings → General (default http://localhost:11434).",
          "Run `ollama pull llama3.2` (or another model), then try again.",
        ],
      });
    }

    const snapshot = createConfigRouter.sanitizeConfigForClient(getConfig());
    let snapshotJson;
    try {
      snapshotJson = JSON.stringify(snapshot);
    } catch {
      snapshotJson = "{}";
    }
    snapshotJson = truncateSnapshotJson(snapshotJson);

    const rules = buildSystemPromptSnippet(isElectron);
    const prompt = `You are a setup assistant for the Code Companion app. Classify the user's goals into structured intents only.

${rules}

Current app configuration (redacted JSON):\n${snapshotJson}\n\nUser conversation:\n${userBlob}\n`;

    const model = await pickSetupModel(config, ollamaUrl);

    try {
      let parsed = null;
      try {
        parsed = await chatStructured(
          ollamaUrl,
          model,
          [{ role: "user", content: prompt }],
          SETUP_JSON_SCHEMA,
          OLLAMA_TIMEOUT_MS,
          [],
          ollamaAuthOpts(config),
        );
      } catch (structErr) {
        log(
          "INFO",
          "setup-assistant: structured output failed, using plain chat",
          {
            error: structErr.message,
          },
        );
        const text = await chatComplete(
          ollamaUrl,
          model,
          [{ role: "user", content: prompt }],
          OLLAMA_TIMEOUT_MS,
          [],
          ollamaAuthOpts(config),
        );
        parsed = parseSetupAssistantJson(text);
      }

      if (!parsed || typeof parsed !== "object") {
        return res.status(502).json({
          error:
            "Ollama responded, but the reply was not valid setup JSON. Try a different model (e.g. llama3.2) or a shorter question.",
          code: "SETUP_PARSE_FAILED",
          hints: [
            "Pick a concrete model in Settings (toolbar or General), then try again.",
            "Set CC_SETUP_ASSISTANT_MODEL to a model you have pulled (see docs/ENVIRONMENT_VARIABLES.md).",
          ],
        });
      }

      const rawIntents = parsed?.intents;
      const intents = normalizeIntents(rawIntents, { isElectron });
      const summaryRaw =
        typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
      const summaryMarkdown =
        summaryRaw ||
        (intents.length
          ? `Suggested **${intents.length}** setup step(s). Review acquire links and apply changes you want.`
          : "No specific setup steps were inferred. Use Settings or the checklist in docs.");

      const configPatch = mapIntentsToConfigBody(intents, { isElectron });
      const acquire = buildAcquireList(intents, { isElectron });

      log("INFO", "setup-assistant intents", {
        count: intents.length,
        ids: intents.map((i) => i.id),
      });

      return res.json({
        intents,
        summaryMarkdown,
        acquire,
        configPatch,
      });
    } catch (err) {
      const detail = String(err?.message || err || "unknown").slice(0, 420);
      log("WARN", "setup-assistant failed", { error: err.message, model });
      return res.status(502).json({
        error:
          "The setup assistant could not get a usable response from Ollama. Your connection test passed, but the model call failed or timed out.",
        code: "SETUP_MODEL_FAILED",
        detail,
        hints: [
          "Open Settings → General, tap Test next to the Ollama URL, and confirm a model exists on this machine (`ollama list`).",
          "If you use Auto in the toolbar, pick a concrete model once, or set CC_SETUP_ASSISTANT_MODEL in .env (see docs/ENVIRONMENT_VARIABLES.md).",
          "Cloud-only model names in the Auto map will not work on a local Ollama URL — pull a local model (e.g. `ollama pull llama3.2`) or use Ollama Cloud with an API key.",
        ],
      });
    }
  });

  return router;
};
