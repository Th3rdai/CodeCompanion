const express = require("express");

const { getConfig } = require("../lib/config");
const {
  addMemory,
  getMemories,
  updateMemory,
  deleteMemory,
  searchMemories,
  getStats: getMemoryStats,
} = require("../lib/memory");
const {
  listModels,
  embed,
  ollamaAuthOpts,
} = require("../lib/ollama-client");
const { CLIENT_INTERNAL_ERROR } = require("../lib/client-errors");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateMemoryId(req, res) {
  const { id } = req.params;
  if (!id || !UUID_REGEX.test(id)) {
    res.status(400).json({ error: "Invalid memory id" });
    return null;
  }
  return id;
}

module.exports = function createRouter(appContext) {
  const router = express.Router();
  const { log } = appContext;

  // ── GET /api/memory/stats ─────────────────────────────
  router.get("/memory/stats", (req, res) => {
    try {
      res.json(getMemoryStats());
    } catch (err) {
      log("ERROR", "Failed to get memory stats", { error: err.message });
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── GET /api/memory/models ────────────────────────────
  router.get("/memory/models", async (req, res) => {
    try {
      const config = getConfig();
      const models = await listModels(config.ollamaUrl, ollamaAuthOpts(config));
      const embeddingModels = models.filter((m) =>
        /embed|bert|minilm/i.test(m.family || ""),
      );
      res.json(embeddingModels);
    } catch (err) {
      log("ERROR", "Failed to list embedding models", { error: err.message });
      res.json([]);
    }
  });

  // ── GET /api/memory/search ────────────────────────────
  router.get("/memory/search", async (req, res) => {
    try {
      const q = req.query.q;
      if (!q || typeof q !== "string" || !q.trim()) {
        return res.status(400).json({ error: "Query parameter q is required" });
      }
      const config = getConfig();
      const embModel = config.memory?.embeddingModel || "nomic-embed-text";
      const queryEmbedding = await embed(
        config.ollamaUrl,
        q.trim(),
        embModel,
        ollamaAuthOpts(config),
      );
      const results = searchMemories(queryEmbedding, 10, 0.3);
      const cleaned = results.map(({ embedding: _embedding, ...rest }) => rest);
      res.json(cleaned);
    } catch (err) {
      log("ERROR", "Memory search failed", { error: err.message });
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── GET /api/memory ───────────────────────────────────
  router.get("/memory", (req, res) => {
    try {
      const typeFilter = req.query.type || null;
      let memories = getMemories(typeFilter ? { type: typeFilter } : undefined);

      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      const total = memories.length;
      const start = (page - 1) * limit;
      memories = memories.slice(start, start + limit);

      const cleaned = memories.map(
        ({ embedding: _embedding, ...rest }) => rest,
      );
      res.json({ memories: cleaned, total, page, limit });
    } catch (err) {
      log("ERROR", "Failed to list memories", { error: err.message });
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── POST /api/memory ──────────────────────────────────
  router.post("/memory", async (req, res) => {
    try {
      const { type, content, source, confidence } = req.body;
      if (!content || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ error: "content is required" });
      }
      const validTypes = ["fact", "pattern", "project", "summary"];
      if (type && !validTypes.includes(type)) {
        return res
          .status(400)
          .json({ error: `type must be one of: ${validTypes.join(", ")}` });
      }

      let embeddingVec = null;
      let embModel = "";
      try {
        const config = getConfig();
        embModel = config.memory?.embeddingModel || "nomic-embed-text";
        embeddingVec = await embed(
          config.ollamaUrl,
          content.trim(),
          embModel,
          ollamaAuthOpts(config),
        );
      } catch (embErr) {
        log("WARN", "Embedding generation failed for new memory", {
          error: embErr.message,
        });
      }

      const memory = addMemory({
        type: type || "fact",
        content: content.trim(),
        source: source || null,
        embedding: embeddingVec,
        embeddingModel: embModel,
        confidence: typeof confidence === "number" ? confidence : 0.5,
      });

      const { embedding: _embedding, ...cleaned } = memory;
      res.json(cleaned);
    } catch (err) {
      log("ERROR", "Failed to add memory", { error: err.message });
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── PUT /api/memory/:id ───────────────────────────────
  router.put("/memory/:id", (req, res) => {
    const id = validateMemoryId(req, res);
    if (!id) return;

    try {
      const updated = updateMemory(id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Memory not found" });
      }
      const { embedding: _embedding, ...cleaned } = updated;
      res.json(cleaned);
    } catch (err) {
      log("ERROR", "Failed to update memory", { error: err.message });
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── DELETE /api/memory/:id ────────────────────────────
  router.delete("/memory/:id", (req, res) => {
    const id = validateMemoryId(req, res);
    if (!id) return;

    try {
      const deleted = deleteMemory(id);
      if (!deleted) {
        return res.status(404).json({ error: "Memory not found" });
      }
      res.json({ ok: true });
    } catch (err) {
      log("ERROR", "Failed to delete memory", { error: err.message });
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  return router;
};
