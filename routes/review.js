const express = require("express");

const { getConfig } = require("../lib/config");
const { readFolderFiles, isWithinBasePath } = require("../lib/file-browser");
const {
  runReviewSnippetPhase,
  runReviewFolderPhase,
} = require("../lib/review-service");
const {
  CLIENT_INTERNAL_ERROR,
  STREAM_INTERNAL_ERROR,
} = require("../lib/client-errors");

module.exports = function createRouter(appContext) {
  const router = express.Router();
  const { log } = appContext;

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

    if (images && !Array.isArray(images)) {
      log("ERROR", "Images must be an array");
      return res.status(400).json({ error: "Images must be an array" });
    }
    if (images && images.length > 10) {
      log("ERROR", `Too many images: ${images.length}`, { limit: 10 });
      return res.status(400).json({ error: "Maximum 10 images per message" });
    }

    log("INFO", `Review request: model=${reqModel} code=${code.length} chars`, {
      imageCount: images?.length || 0,
    });

    const config = getConfig();
    const httpAbort = new AbortController();
    // Do not use req.on("close") — it can fire when the request body stream ends,
    // aborting before Ollama runs. Socket close = actual connection drop.
    const onSocketClose = () => {
      if (!res.writableEnded) httpAbort.abort();
    };
    req.socket?.once?.("close", onSocketClose);

    try {
      const { model, result } = await runReviewSnippetPhase({
        config,
        log,
        reqModel,
        code,
        filename,
        images,
        abortSignal: httpAbort.signal,
      });

      if (result.type === "report-card") {
        log(
          "INFO",
          `Review complete: overall grade ${result.data.overallGrade}`,
        );
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
      if (err.httpStatus === 400 && !res.headersSent) {
        return res.status(400).json({ error: err.message });
      }
      log("ERROR", "Review failed completely", { error: err.message });
      if (!res.headersSent) {
        res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
      }
    }
  });

  // ── POST /api/review/folder/preview ──────────────────
  router.post("/review/folder/preview", async (req, res) => {
    const { folder } = req.body;
    if (!folder) return res.status(400).json({ error: "Missing folder" });

    const cfgForPreview = getConfig();
    if (
      cfgForPreview.projectFolder &&
      !isWithinBasePath(cfgForPreview.projectFolder, folder)
    ) {
      return res
        .status(403)
        .json({ error: "Folder is outside the configured project folder" });
    }

    try {
      const { files, totalSize, skipped } = readFolderFiles(folder, {
        maxFiles: 80,
        maxTotalSize: 2 * 1024 * 1024,
      });
      res.json({
        files: files.map((f) => ({ path: f.path, size: f.size })),
        totalSize,
        skipped,
        folder,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── POST /api/review/folder ───────────────────────────
  router.post("/review/folder", async (req, res) => {
    const { model: reqModel, folder } = req.body;

    if (!reqModel || !folder) {
      return res.status(400).json({ error: "Missing model or folder" });
    }

    const config = getConfig();

    if (
      config.projectFolder &&
      !isWithinBasePath(config.projectFolder, folder)
    ) {
      return res
        .status(403)
        .json({ error: "Folder is outside the configured project folder" });
    }

    const httpAbort = new AbortController();
    const onSocketCloseFolder = () => {
      if (!res.writableEnded) httpAbort.abort();
    };
    req.socket?.once?.("close", onSocketCloseFolder);

    try {
      const { files, totalSize, skipped } = readFolderFiles(folder, {
        maxFiles: 80,
        maxTotalSize: 2 * 1024 * 1024,
      });

      if (files.length === 0) {
        return res
          .status(400)
          .json({ error: "No reviewable text files found in folder" });
      }

      log(
        "INFO",
        `Review folder: ${folder} — ${files.length} files, ${(totalSize / 1024).toFixed(1)}KB${skipped ? `, ${skipped} skipped` : ""}`,
      );

      const { model, result } = await runReviewFolderPhase({
        config,
        log,
        reqModel,
        folder,
        files,
        totalSize,
        skipped,
        abortSignal: httpAbort.signal,
      });

      if (result.type === "report-card") {
        log(
          "INFO",
          `Review folder complete: overall grade ${result.data.overallGrade}`,
        );
        const payload = {
          ...result,
          meta: { fileCount: files.length, totalSize, skipped, folder },
        };
        if (reqModel === "auto") payload.resolvedModel = model;
        return res.json(payload);
      }

      // Chat fallback — stream via SSE
      log("INFO", `Review folder fallback to chat mode: ${result.error}`);
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
        meta: { fileCount: files.length, totalSize, skipped },
        ...(reqModel === "auto" ? { resolvedModel: model } : {}),
      });

      const ollamaRes = result.stream;
      if (!ollamaRes.ok) {
        const _errText = await ollamaRes.text();
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
                  if (parsed.done) sendEvent({ done: true });
                } catch {}
              }
              if (!res.writableEnded) {
                res.write("data: [DONE]\n\n");
                res.end();
              }
              log(
                "INFO",
                `Review folder fallback complete: ${tokenCount} tokens`,
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
                  return;
                }
              } catch {}
            }
          }
        } catch (err) {
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
      if (err.httpStatus === 400 && !res.headersSent) {
        return res.status(400).json({ error: err.message });
      }
      log("ERROR", "Review folder failed", { error: err.message });
      if (!res.headersSent) {
        res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
      }
    }
  });

  return router;
};
