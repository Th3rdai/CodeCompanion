const express = require("express");
const { Readable } = require("stream");

const { getConfig } = require("../lib/config");
const { resolveAutoModel, mergeAutoModelMap } = require("../lib/auto-model");
const { effectiveOllamaApiKey } = require("../lib/ollama-client");
const { scoreContent } = require("../lib/builder-score");
const {
  CLIENT_INTERNAL_ERROR,
  STREAM_INTERNAL_ERROR,
} = require("../lib/client-errors");

module.exports = function createRouter(appContext) {
  const router = express.Router();
  const { log } = appContext;

  function ollamaAuthOpts(cfg) {
    const k = effectiveOllamaApiKey(cfg);
    return k ? { apiKey: k } : {};
  }

  // ── POST /api/score ───────────────────────────────────
  // Rate limiter applied as app.use('/api/score', ...) in server.js
  router.post("/score", async (req, res) => {
    const { model: reqModel, mode, content, metadata } = req.body;

    if (!reqModel || !content || !mode) {
      return res
        .status(400)
        .json({ error: "model, mode, and content are required" });
    }

    const validModes = ["prompting", "skillz", "agentic", "planner"];
    if (!validModes.includes(mode)) {
      return res.status(400).json({
        error: `Invalid mode. Must be one of: ${validModes.join(", ")}`,
      });
    }

    const config = getConfig();
    let model = reqModel;
    if (model === "auto") {
      try {
        const estimatedTokens = Math.ceil(content.length / 3.5);
        const r = await resolveAutoModel({
          requestedModel: model,
          mode,
          estimatedTokens,
          config,
          ollamaUrl: config.ollamaUrl,
          ollamaOpts: ollamaAuthOpts(config),
        });
        model = r.resolved;
        log("INFO", `Auto-model resolved: mode=${mode} (score) → ${model}`);
      } catch (err) {
        const m = mergeAutoModelMap(config.autoModelMap);
        model = m[mode] || m.chat || "llama3.2";
      }
    }

    log(
      "INFO",
      `Score request: model=${model} mode=${mode} content=${content.length} chars`,
    );

    try {
      const ollamaUrl = config.ollamaUrl || "http://localhost:11434";
      const result = await scoreContent(
        ollamaUrl,
        model,
        mode,
        content,
        metadata,
        ollamaAuthOpts(config),
      );

      if (result.type === "score-card") {
        log(
          "INFO",
          `Score complete: overall grade ${result.data?.overallGrade || "N/A"}`,
        );
        const payload = { ...result };
        if (reqModel === "auto") payload.resolvedModel = model;
        return res.json(payload);
      }

      // Fallback: stream response
      if (result.type === "chat-fallback") {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const sendEvent = (data) => {
          if (!res.writableEnded)
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };
        sendEvent({
          fallback: true,
          reason: result.error,
          ...(reqModel === "auto" ? { resolvedModel: model } : {}),
        });

        const ollamaRes = result.stream;
        if (!ollamaRes || typeof ollamaRes.ok !== "boolean") {
          log("ERROR", "Score fallback: invalid stream (not a Response)", {
            hasStream: !!result.stream,
          });
          sendEvent({ error: "Invalid response from model" });
          res.write("data: [DONE]\n\n");
          return res.end();
        }
        if (!ollamaRes.ok) {
          const errText = await ollamaRes.text();
          log("ERROR", `Ollama score fallback error: ${ollamaRes.status}`, {
            body: errText,
          });
          sendEvent({
            error: `Ollama returned HTTP ${ollamaRes.status}. Check the model and try again.`,
          });
          res.write("data: [DONE]\n\n");
          return res.end();
        }

        const body = ollamaRes.body;
        if (!body || typeof body.getReader !== "function") {
          log("ERROR", "Score fallback: response has no readable body", {
            hasBody: !!body,
          });
          sendEvent({
            error: "Model returned a response that cannot be streamed",
          });
          res.write("data: [DONE]\n\n");
          return res.end();
        }

        // Use Readable.fromWeb for robust consumption
        const nodeStream = Readable.fromWeb(body);
        const decoder = new TextDecoder();
        let buf = "";
        for await (const chunk of nodeStream) {
          buf += Buffer.isBuffer(chunk)
            ? chunk.toString("utf8")
            : decoder.decode(chunk);
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.message?.content)
                sendEvent({ token: parsed.message.content });
              if (parsed.done) sendEvent({ done: true });
            } catch {}
          }
        }
        if (buf.trim()) {
          try {
            const parsed = JSON.parse(buf);
            if (parsed.message?.content)
              sendEvent({ token: parsed.message.content });
            if (parsed.done) sendEvent({ done: true });
          } catch {}
        }
        res.write("data: [DONE]\n\n");
        res.end();
      }
    } catch (err) {
      log("ERROR", "Score endpoint failed", { error: err.message });
      if (!res.headersSent) {
        res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
      }
    }
  });

  return router;
};
