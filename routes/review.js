const express = require("express");

const { getConfig } = require("../lib/config");
const { resolveAutoModel, mergeAutoModelMap } = require("../lib/auto-model");
const { effectiveOllamaApiKey } = require("../lib/ollama-client");
const { reviewCode } = require("../lib/review");
const { CLIENT_INTERNAL_ERROR, STREAM_INTERNAL_ERROR } = require("../lib/client-errors");

module.exports = function createRouter(appContext) {
  const router = express.Router();
  const { log } = appContext;

  function ollamaAuthOpts(cfg) {
    const k = effectiveOllamaApiKey(cfg);
    return k ? { apiKey: k } : {};
  }

  // ── POST /api/review ──────────────────────────────────
  // Rate limiter applied as app.use('/api/review', ...) in server.js
  router.post("/review", async (req, res) => {
    const { model: reqModel, code, filename, images } = req.body;

    if (!reqModel || !code) {
      log("ERROR", "Review request missing fields", {
        model: !!reqModel,
        code: !!code,
      });
      return res.status(400).json({ error: "Missing model or code" });
    }

    let model = reqModel;

    if (images && !Array.isArray(images)) {
      log("ERROR", "Images must be an array");
      return res.status(400).json({ error: "Images must be an array" });
    }
    if (images && images.length > 10) {
      log("ERROR", `Too many images: ${images.length}`, { limit: 10 });
      return res.status(400).json({ error: "Maximum 10 images per message" });
    }

    log("INFO", `Review request: model=${model} code=${code.length} chars`, {
      imageCount: images?.length || 0,
    });

    const config = getConfig();

    if (model === "auto") {
      try {
        const estimatedTokens = Math.ceil(code.length / 3.5);
        const r = await resolveAutoModel({
          requestedModel: model,
          mode: "review",
          estimatedTokens,
          config,
          ollamaUrl: config.ollamaUrl,
          ollamaOpts: ollamaAuthOpts(config),
        });
        model = r.resolved;
        log("INFO", `Auto-model resolved: mode=review → ${model}`);
      } catch (err) {
        log("WARN", "Auto-model resolution failed (review)", {
          error: err.message,
        });
        const m = mergeAutoModelMap(config.autoModelMap);
        model = m.review || m.chat || "llama3.2";
      }
    }

    try {
      const result = await reviewCode(config.ollamaUrl, model, code, {
        filename,
        timeoutSec: config.reviewTimeoutSec,
        images: images || [],
        numCtx: config.numCtx || 0,
        autoAdjustContext: config.autoAdjustContext,
        ollamaApiKey: effectiveOllamaApiKey(config),
      });

      if (result.type === "report-card") {
        log("INFO", `Review complete: overall grade ${result.data.overallGrade}`);
        const payload = { ...result };
        if (reqModel === "auto") payload.resolvedModel = model;
        return res.json(payload);
      }

      // Chat fallback — stream via SSE
      log("INFO", `Review fallback to chat mode: ${result.error}`);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      function sendEvent(data) {
        if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
      }

      sendEvent({
        fallback: true,
        reason: result.error,
        ...(reqModel === "auto" ? { resolvedModel: model } : {}),
      });

      const ollamaRes = result.stream;
      if (!ollamaRes.ok) {
        const errText = await ollamaRes.text();
        log("ERROR", `Ollama fallback error: ${ollamaRes.status}`, {
          body: errText,
        });
        sendEvent({
          error: `Ollama returned HTTP ${ollamaRes.status}. Check the model and try again.`,
        });
        res.write("data: [DONE]\n\n");
        return res.end();
      }

      const reader = ollamaRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let tokenCount = 0;

      async function readStream() {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (buffer.trim()) {
                try {
                  const parsed = JSON.parse(buffer);
                  if (parsed.message?.content) {
                    sendEvent({ token: parsed.message.content });
                    tokenCount++;
                  }
                  if (parsed.done) {
                    sendEvent({ done: true });
                  }
                } catch (e) {
                  /* ignore parse error on final buffer */
                }
              }
              if (!res.writableEnded) {
                res.write("data: [DONE]\n\n");
                res.end();
              }
              log(
                "INFO",
                `Review fallback complete: ${tokenCount} tokens streamed`,
              );
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const parsed = JSON.parse(line);
                if (parsed.message?.content) {
                  sendEvent({ token: parsed.message.content });
                  tokenCount++;
                }
                if (parsed.done) {
                  sendEvent({ done: true });
                  res.write("data: [DONE]\n\n");
                  res.end();
                  log(
                    "INFO",
                    `Review fallback complete: ${tokenCount} tokens streamed`,
                  );
                  return;
                }
              } catch (e) {
                /* ignore parse error */
              }
            }
          }
        } catch (err) {
          log("ERROR", "Review fallback stream error", { error: err.message });
          if (!res.writableEnded) {
            sendEvent({ error: STREAM_INTERNAL_ERROR });
            res.write("data: [DONE]\n\n");
            res.end();
          }
        }
      }

      readStream();

      req.on("close", () => {
        reader.cancel().catch(() => {});
      });
    } catch (err) {
      log("ERROR", "Review failed completely", { error: err.message });
      if (!res.headersSent) {
        res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
      }
    }
  });

  return router;
};
