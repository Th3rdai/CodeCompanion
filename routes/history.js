const express = require("express");

const { getConfig } = require("../lib/config");
const {
  listConversations,
  getConversation,
  saveConversation,
  deleteConversation,
} = require("../lib/history");
const { resolveAutoModel, mergeAutoModelMap } = require("../lib/auto-model");
const { chatComplete, ollamaAuthOpts } = require("../lib/ollama-client");
const { extractAndStore } = require("../lib/memory");
const { CLIENT_INTERNAL_ERROR } = require("../lib/client-errors");

module.exports = function createRouter(appContext) {
  const router = express.Router();
  const { log, debug } = appContext;


  // ── GET /api/history ─────────────────────────────────
  router.get("/history", (req, res) => {
    try {
      const conversations = listConversations();
      res.json(conversations);
    } catch (err) {
      log("ERROR", "Failed to load history", { error: err.message });
      res.json([]);
    }
  });

  // ── GET /api/history/:id ──────────────────────────────
  router.get("/history/:id", (req, res) => {
    try {
      const data = getConversation(req.params.id);
      res.json(data);
    } catch (err) {
      const status = err.message.includes("Invalid conversation id")
        ? 400
        : 404;
      res
        .status(status)
        .json({ error: status === 404 ? "Not found" : err.message });
    }
  });

  // ── POST /api/history ────────────────────────────────
  router.post("/history", async (req, res) => {
    try {
      const id = saveConversation(req.body);
      debug("Conversation saved", { id });
      res.json({ id });

      // Fire-and-forget memory extraction (non-blocking — response already sent)
      const config = getConfig();
      if (
        config.memory?.enabled &&
        config.memory?.autoExtract &&
        req.body.messages?.length >= 4
      ) {
        const embModel = config.memory.embeddingModel || "nomic-embed-text";
        (async () => {
          let memModel = req.body.model;
          if (memModel === "auto") {
            try {
              const msgs = req.body.messages || [];
              const totalChars = msgs.reduce(
                (s, m) =>
                  s + (typeof m.content === "string" ? m.content.length : 0),
                0,
              );
              const r = await resolveAutoModel({
                requestedModel: "auto",
                mode: req.body.mode || "chat",
                estimatedTokens: Math.ceil(totalChars / 3.5),
                config,
                ollamaUrl: config.ollamaUrl,
                ollamaOpts: ollamaAuthOpts(config),
              });
              memModel = r.resolved;
            } catch {
              const m = mergeAutoModelMap(config.autoModelMap);
              memModel = m[req.body.mode || "chat"] || m.chat || "llama3.2";
            }
          }
          await extractAndStore(
            config.ollamaUrl,
            memModel,
            embModel,
            req.body,
            config,
          );
        })().catch((err) =>
          log("WARN", "Memory extraction failed", { error: err.message }),
        );
      }

      // Fire-and-forget conversation summary generation
      if (req.body.messages?.length >= 4 && !req.body.summary) {
        const config2 = getConfig();
        (async () => {
          try {
            const msgs = req.body.messages;
            const last6 = msgs.slice(-6).map((m) => ({
              role: m.role,
              content:
                typeof m.content === "string"
                  ? m.content.slice(0, 500)
                  : String(m.content).slice(0, 500),
            }));
            let sumModel = req.body.model;
            if (sumModel === "auto") {
              const m = mergeAutoModelMap(config2.autoModelMap);
              sumModel = m[req.body.mode || "chat"] || m.chat || "llama3.2";
            }
            const summary = await chatComplete(
              config2.ollamaUrl,
              sumModel,
              [
                {
                  role: "system",
                  content:
                    "Summarize the following conversation in 2-3 sentences. Focus on what was discussed and any decisions made. Reply with ONLY the summary, no preamble.",
                },
                {
                  role: "user",
                  content: last6
                    .map((m) => `${m.role}: ${m.content}`)
                    .join("\n"),
                },
              ],
              15000,
              [],
              ollamaAuthOpts(config2),
            );
            if (summary && summary.trim()) {
              const conv = getConversation(id);
              if (conv) {
                conv.summary = summary.trim().slice(0, 500);
                saveConversation(conv);
                log("INFO", `Conversation summary stored for ${id}`);
              }
            }
          } catch (err) {
            debug("Summary generation failed (non-blocking)", {
              error: err.message,
            });
          }
        })();
      }
    } catch (err) {
      const status = err.message.includes("Invalid conversation id")
        ? 400
        : 500;
      res
        .status(status)
        .json({ error: status === 400 ? err.message : CLIENT_INTERNAL_ERROR });
    }
  });

  // ── DELETE /api/history/:id ───────────────────────────
  router.delete("/history/:id", (req, res) => {
    try {
      deleteConversation(req.params.id);
      debug("Conversation deleted", { id: req.params.id });
      res.json({ ok: true });
    } catch (err) {
      let status = 500;
      if (err.message.includes("Invalid conversation id")) status = 400;
      else if (err.message === "Conversation not found") status = 404;
      res.status(status).json({
        error:
          status === 404
            ? "Not found"
            : status === 400
              ? err.message
              : CLIENT_INTERNAL_ERROR,
      });
    }
  });

  // ── POST /api/history/batch-delete ───────────────────
  router.post("/history/batch-delete", (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ error: "ids must be a non-empty array" });
    if (ids.length > 200)
      return res.status(400).json({ error: "Maximum 200 deletions per batch" });
    let ok = 0,
      failed = 0;
    for (const id of ids) {
      try {
        deleteConversation(id);
        ok++;
      } catch {
        failed++;
      }
    }
    log("INFO", `Batch delete: ${ok} deleted, ${failed} failed`);
    res.json({ ok, failed });
  });

  return router;
};
