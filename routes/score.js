const express = require("express");
const { Readable } = require("stream");

const { getConfig } = require("../lib/config");
const { runBuilderScorePhase } = require("../lib/score-service");
const { CLIENT_INTERNAL_ERROR } = require("../lib/client-errors");

module.exports = function createRouter(appContext) {
  const router = express.Router();
  const { log } = appContext;

  // ── POST /api/score ───────────────────────────────────
  // Rate limiter applied as app.use('/api/score', ...) in server.js
  router.post("/score", async (req, res) => {
    const { model: reqModel, mode, content, metadata } = req.body;
    const config = getConfig();

    let model;
    let result;
    try {
      const phase = await runBuilderScorePhase({
        config,
        log,
        reqModel,
        mode,
        content,
        metadata,
      });
      model = phase.model;
      result = phase.result;
      log(
        "INFO",
        `Score request: model=${model} mode=${mode} content=${content.length} chars`,
      );
    } catch (err) {
      const status = err.httpStatus || 500;
      log(status >= 500 ? "ERROR" : "WARN", "Score request failed", {
        error: err.message,
      });
      return res.status(status).json({
        error: status === 500 ? CLIENT_INTERNAL_ERROR : err.message,
      });
    }

    try {
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
        log("WARN", "Score fallback to chat (structured output failed)", {
          model,
          mode,
          reason: result.error,
        });
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
