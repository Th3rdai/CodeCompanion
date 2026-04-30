const express = require("express");
const {
  handleChatPost,
  pendingConfirmations,
  buildEmptyAssistantReplyMessage,
} = require("../lib/chat-post-handler");

module.exports = function createRouter(appContext) {
  const router = express.Router();

  // ── POST /api/chat/confirm — resolve a pending confirm-before-run prompt ──
  router.post("/chat/confirm", express.json({ limit: "1kb" }), (req, res) => {
    const { id, approved } = req.body || {};
    if (!id) return res.status(400).json({ error: "Missing id" });
    const pending = pendingConfirmations.get(id);
    if (!pending)
      return res.status(404).json({ error: "Unknown confirmation id" });
    pendingConfirmations.delete(id);
    clearTimeout(pending.timeout);
    pending.resolve({ approved: !!approved });
    res.json({ ok: true });
  });

  // ── POST /api/chat (SSE streaming + tool-call loop) ──
  // Rate limiter applied as app.use('/api/chat', ...) in server.js
  router.post("/chat", (req, res) => handleChatPost(req, res, appContext));

  return router;
};

module.exports.buildEmptyAssistantReplyMessage =
  buildEmptyAssistantReplyMessage;
