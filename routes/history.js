const express = require("express");

const { getConfig } = require("../lib/config");
const {
  listConversations,
  getConversation,
  saveConversation,
  deleteConversation,
} = require("../lib/history");
const { getExperiment } = require("../lib/experiment-store");
const { resolveAutoModel, mergeAutoModelMap } = require("../lib/auto-model");
const { chatComplete, ollamaAuthOpts } = require("../lib/ollama-client");
const {
  extractAndStore,
  deleteMemoriesBySource,
  resolveEmbeddingModel,
  deriveProjectKey,
} = require("../lib/memory");
const {
  SYSTEM_FOLDER_ID,
  listFolders,
  getFolder,
  createFolder,
  updateFolder,
  deleteFolder,
} = require("../lib/history-folders");
const { CLIENT_INTERNAL_ERROR } = require("../lib/client-errors");

module.exports = function createRouter(appContext) {
  const router = express.Router();
  const { log, debug } = appContext;
  const MAX_BATCH_MOVE = 200;
  const MAX_FOLDER_REHOME = 1000;

  // Debounce + single-flight memory extraction per conversation so rapid POST /history
  // (autosave, polling) does not spawn many concurrent Ollama /api/chat calls — that
  // overloads Ollama and surfaces as AbortError / "This operation was aborted" spam.
  const MEM_EXT_DEBOUNCE_MS = 10000;
  const MEM_EXT_RETRY_WHEN_BUSY_MS = 2500;
  const memoryExtractTimers = new Map();
  const memoryExtractRunning = new Set();

  function cancelMemoryExtractionSchedule(conversationId) {
    const t = memoryExtractTimers.get(conversationId);
    if (t) clearTimeout(t);
    memoryExtractTimers.delete(conversationId);
  }

  function scheduleMemoryExtraction(conversationId) {
    if (!conversationId) return;
    const prev = memoryExtractTimers.get(conversationId);
    if (prev) clearTimeout(prev);
    memoryExtractTimers.set(
      conversationId,
      setTimeout(() => {
        memoryExtractTimers.delete(conversationId);
        void runDebouncedMemoryExtract(conversationId);
      }, MEM_EXT_DEBOUNCE_MS),
    );
  }

  async function runDebouncedMemoryExtract(conversationId) {
    if (memoryExtractRunning.has(conversationId)) {
      memoryExtractTimers.set(
        conversationId,
        setTimeout(() => {
          memoryExtractTimers.delete(conversationId);
          void runDebouncedMemoryExtract(conversationId);
        }, MEM_EXT_RETRY_WHEN_BUSY_MS),
      );
      return;
    }
    const config = getConfig();
    if (!config.memory?.enabled || !config.memory?.autoExtract) return;
    const conv = getConversation(conversationId);
    if (!conv?.messages || conv.messages.length < 4) return;

    memoryExtractRunning.add(conversationId);
    try {
      const embModel = resolveEmbeddingModel(config);
      let memModel = conv.model;
      if (memModel === "auto") {
        try {
          const msgs = conv.messages || [];
          const totalChars = msgs.reduce(
            (s, m) =>
              s + (typeof m.content === "string" ? m.content.length : 0),
            0,
          );
          const r = await resolveAutoModel({
            requestedModel: "auto",
            mode: conv.mode || "chat",
            estimatedTokens: Math.ceil(totalChars / 3.5),
            config,
            ollamaUrl: config.ollamaUrl,
            ollamaOpts: ollamaAuthOpts(config),
          });
          memModel = r.resolved;
        } catch {
          const m = mergeAutoModelMap(config.autoModelMap);
          memModel = m[conv.mode || "chat"] || m.chat || "llama3.2";
        }
      }
      const projectKey = deriveProjectKey(
        config.chatFolder || config.projectFolder || null,
      );
      await extractAndStore(
        config.ollamaUrl,
        memModel,
        embModel,
        conv,
        config,
        projectKey,
      );
    } catch (err) {
      log("WARN", "Memory extraction failed", { error: err.message });
    } finally {
      memoryExtractRunning.delete(conversationId);
    }
  }

  async function moveConversationToFolder(conversationId, folderId) {
    const targetFolder = getFolder(folderId);
    if (!targetFolder) throw new Error("Folder not found");
    const conv = getConversation(conversationId);
    conv.folderId = targetFolder.id;
    await saveConversation(conv);
  }

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

  // ── GET /api/history/folders ──────────────────────────
  router.get("/history/folders", (req, res) => {
    try {
      res.json(listFolders());
    } catch (err) {
      log("ERROR", "Failed to load history folders", { error: err.message });
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── POST /api/history/folders ─────────────────────────
  router.post("/history/folders", (req, res) => {
    try {
      const folder = createFolder({
        id: req.body?.id,
        name: req.body?.name,
        color: req.body?.color,
      });
      debug("History folder created", { id: folder.id });
      res.status(201).json(folder);
    } catch (err) {
      const status =
        err.message.includes("already exists") ||
        err.message.includes("required") ||
        err.message.includes("must be")
          ? 400
          : 500;
      res
        .status(status)
        .json({ error: status === 400 ? err.message : CLIENT_INTERNAL_ERROR });
    }
  });

  // ── PATCH /api/history/folders/:id ────────────────────
  router.patch("/history/folders/:id", (req, res) => {
    try {
      const folder = updateFolder(req.params.id, {
        name: req.body?.name,
        color: req.body?.color,
        position: req.body?.position,
        collapsed: req.body?.collapsed,
      });
      res.json(folder);
    } catch (err) {
      let status = 500;
      if (
        err.message.includes("not found") ||
        err.message.includes("already exists") ||
        err.message.includes("required") ||
        err.message.includes("must be") ||
        err.message.includes("cannot be changed")
      ) {
        status = 400;
      }
      res
        .status(status)
        .json({ error: status === 400 ? err.message : CLIENT_INTERNAL_ERROR });
    }
  });

  // ── DELETE /api/history/folders/:id ───────────────────
  router.delete("/history/folders/:id", async (req, res) => {
    try {
      const folderId = req.params.id;
      const members = listConversations().filter(
        (c) => c.folderId === folderId,
      );
      if (members.length > MAX_FOLDER_REHOME) {
        return res.status(400).json({
          error: `Folder has too many conversations to delete safely (>${MAX_FOLDER_REHOME})`,
        });
      }
      for (const conv of members) {
        await moveConversationToFolder(conv.id, SYSTEM_FOLDER_ID);
      }
      const deleted = deleteFolder(folderId);
      debug("History folder deleted", {
        id: folderId,
        movedToInbox: members.length,
      });
      res.json({
        ok: true,
        deleted,
        movedToFolderId: SYSTEM_FOLDER_ID,
        movedCount: members.length,
      });
    } catch (err) {
      let status = 500;
      if (
        err.message.includes("cannot be deleted") ||
        err.message.includes("not found") ||
        err.message.includes("required")
      ) {
        status = 400;
      }
      res
        .status(status)
        .json({ error: status === 400 ? err.message : CLIENT_INTERNAL_ERROR });
    }
  });

  // ── GET /api/history/:id ──────────────────────────────
  router.get("/history/:id", (req, res) => {
    try {
      const data = getConversation(req.params.id);
      const include = String(req.query.include || "");
      if (include.split(",").includes("experiments")) {
        const ids = Array.isArray(data.experimentIds) ? data.experimentIds : [];
        const cfg = getConfig();
        data.experiments = ids
          .map((id) => {
            try {
              return getExperiment(id, cfg);
            } catch {
              return null;
            }
          })
          .filter(Boolean);
      }
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

  // ── PATCH /api/history/:id/folder ─────────────────────
  router.patch("/history/:id/folder", async (req, res) => {
    try {
      const folderId =
        typeof req.body?.folderId === "string" && req.body.folderId.trim()
          ? req.body.folderId.trim()
          : SYSTEM_FOLDER_ID;
      await moveConversationToFolder(req.params.id, folderId);
      res.json({ ok: true, id: req.params.id, folderId });
    } catch (err) {
      let status = 500;
      if (
        err.message.includes("Invalid conversation id") ||
        err.message.includes("Folder not found")
      ) {
        status = 400;
      } else if (err.message === "Conversation not found") {
        status = 404;
      }
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

  // ── POST /api/history ────────────────────────────────
  router.post("/history", async (req, res) => {
    try {
      const id = await saveConversation(req.body);
      debug("Conversation saved", { id });
      res.json({ id });

      // Fire-and-forget memory extraction (non-blocking — response already sent)
      const config = getConfig();
      if (
        config.memory?.enabled &&
        config.memory?.autoExtract &&
        req.body.messages?.length >= 4
      ) {
        scheduleMemoryExtraction(id);
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
                await saveConversation(conv);
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
      cancelMemoryExtractionSchedule(req.params.id);
      deleteConversation(req.params.id);
      // deleteMemoriesBySource only removes memories whose source === conversationId.
      // After the agent/project scoping migration, agent facts (source: null) and
      // project patterns (source: null) intentionally survive conversation deletes —
      // they represent durable knowledge about the user and codebase, not ephemeral
      // chat state. Only summaries (source = conversationId) are cascaded here.
      const removedMemories = deleteMemoriesBySource(req.params.id);
      debug("Conversation deleted", {
        id: req.params.id,
        cascadedMemories: removedMemories,
      });
      res.json({ ok: true, cascadedMemories: removedMemories });
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
      failed = 0,
      cascadedMemories = 0;
    for (const id of ids) {
      try {
        cancelMemoryExtractionSchedule(id);
        deleteConversation(id);
        cascadedMemories += deleteMemoriesBySource(id);
        ok++;
      } catch {
        failed++;
      }
    }
    log(
      "INFO",
      `Batch delete: ${ok} deleted, ${failed} failed, ${cascadedMemories} memories cascaded`,
    );
    res.json({ ok, failed, cascadedMemories });
  });

  // ── POST /api/history/batch-move ──────────────────────
  router.post("/history/batch-move", async (req, res) => {
    const { ids } = req.body;
    const folderId =
      typeof req.body?.folderId === "string" && req.body.folderId.trim()
        ? req.body.folderId.trim()
        : SYSTEM_FOLDER_ID;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids must be a non-empty array" });
    }
    if (ids.length > MAX_BATCH_MOVE) {
      return res
        .status(400)
        .json({ error: `Maximum ${MAX_BATCH_MOVE} moves per batch` });
    }
    if (!getFolder(folderId)) {
      return res.status(400).json({ error: "Folder not found" });
    }

    let ok = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await moveConversationToFolder(id, folderId);
        ok++;
      } catch {
        failed++;
      }
    }
    log(
      "INFO",
      `Batch move: ${ok} moved, ${failed} failed, folder=${folderId}`,
    );
    res.json({ ok, failed, folderId });
  });

  return router;
};
