const express = require("express");
const fs = require("fs");
const path = require("path");

const { getConfig } = require("../lib/config");
const { resolveAutoModel, mergeAutoModelMap } = require("../lib/auto-model");
const { ollamaAuthOpts } = require("../lib/ollama-client");
const {
  scanProjectForValidation,
  generateValidateCommand,
} = require("../lib/validate");
const {
  assertResolvedPathUnderAllowedRoots,
  resolveFolderInput,
} = require("../lib/security-helpers");
const {
  CLIENT_INTERNAL_ERROR,
  STREAM_INTERNAL_ERROR,
} = require("../lib/client-errors");

module.exports = function createRouter(appContext) {
  const router = express.Router();
  const { log, requireLocalOrApiKey } = appContext;

  // ── POST /api/validate/scan ───────────────────────────
  router.post("/validate/scan", async (req, res) => {
    const { folder } = req.body;
    if (!folder) return res.status(400).json({ error: "Missing folder" });

    try {
      const result = scanProjectForValidation(folder);
      log(
        "INFO",
        `Validate scan: ${folder} — lang=${result.language} framework=${result.framework}`,
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── POST /api/validate/generate ──────────────────────
  router.post("/validate/generate", async (req, res) => {
    const { model: reqModel, folder, scanResult } = req.body;
    if (!reqModel || !folder || !scanResult) {
      return res
        .status(400)
        .json({ error: "Missing model, folder, or scanResult" });
    }

    const config = getConfig();
    let model = reqModel;
    if (model === "auto") {
      try {
        const estimatedTokens = Math.ceil(
          JSON.stringify(scanResult).length / 3.5,
        );
        const r = await resolveAutoModel({
          requestedModel: model,
          mode: "validate",
          estimatedTokens,
          config,
          ollamaUrl: config.ollamaUrl,
          ollamaOpts: ollamaAuthOpts(config),
        });
        model = r.resolved;
        log("INFO", `Auto-model resolved: mode=validate → ${model}`);
      } catch (err) {
        const m = mergeAutoModelMap(config.autoModelMap);
        model = m.validate || m.chat || "llama3.2";
      }
    }
    log("INFO", `Validate generate: model=${model} folder=${folder}`);

    try {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      function sendEvent(data) {
        if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
      }

      if (reqModel === "auto") {
        sendEvent({ resolvedModel: model });
      }

      const ollamaRes = await generateValidateCommand(
        config.ollamaUrl,
        model,
        folder,
        scanResult,
        ollamaAuthOpts(config),
      );

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
                } catch {}
              }
              if (!res.writableEnded) {
                res.write("data: [DONE]\n\n");
                res.end();
              }
              log("INFO", `Validate generate complete: ${tokenCount} tokens`);
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
                    `Validate generate complete: ${tokenCount} tokens`,
                  );
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
      log("ERROR", "Validate generate failed", { error: err.message });
      if (!res.headersSent) {
        res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
      }
    }
  });

  // ── POST /api/validate/install ────────────────────────
  router.post("/validate/install", requireLocalOrApiKey, (req, res) => {
    const { projectFolder, content, targets } = req.body;

    if (!projectFolder || !content || !targets?.length) {
      return res
        .status(400)
        .json({ error: "Missing projectFolder, content, or targets" });
    }

    const config = getConfig();
    const resolvedProject = resolveFolderInput(projectFolder);
    if (!resolvedProject) {
      return res.status(400).json({ error: "Invalid projectFolder path" });
    }
    const allowed = assertResolvedPathUnderAllowedRoots(
      resolvedProject,
      config,
    );
    if (!allowed.ok) {
      log(
        "WARN",
        "validate/install blocked — projectFolder outside allowed roots",
      );
      return res.status(403).json({ error: allowed.error });
    }

    const absFolder = resolvedProject;
    if (!fs.existsSync(absFolder)) {
      return res.status(400).json({ error: "Project folder not found" });
    }

    const results = [];
    for (const target of targets) {
      const targetPath = path.join(absFolder, target);
      if (
        !targetPath.startsWith(absFolder + path.sep) &&
        targetPath !== absFolder
      ) {
        results.push({
          target,
          success: false,
          error: "Path traversal blocked",
        });
        continue;
      }
      try {
        const dir = path.dirname(targetPath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(targetPath, content, "utf8");
        results.push({ target, success: true });
        log("INFO", `Validate installed: ${targetPath}`);
      } catch (err) {
        results.push({ target, success: false, error: "Write failed" });
      }
    }

    res.json({ results, installed: results.filter((r) => r.success).length });
  });

  return router;
};
