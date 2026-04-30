const express = require("express");
const { getConfig } = require("../lib/config");
const {
  createExperiment,
  getExperiment,
  updateExperiment,
  appendStep,
} = require("../lib/experiment-store");
const { handleChatPost } = require("../lib/chat-post-handler");

function experimentEnabled() {
  const cfg = getConfig();
  return cfg.experimentMode?.enabled === true;
}

function experimentDefaults() {
  const em = getConfig().experimentMode || {};
  return {
    enabled: em.enabled === true,
    maxRounds: Math.min(Math.max(parseInt(em.maxRounds, 10) || 8, 1), 25),
    maxDurationSec: Math.min(
      Math.max(parseInt(em.maxDurationSec, 10) || 900, 60),
      7200,
    ),
    commandProfile: em.commandProfile || "safe",
  };
}

function elapsedSec(iso) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return (Date.now() - t) / 1000;
}

module.exports = function createExperimentRouter(appContext) {
  const router = express.Router();
  const { log, requireLocalOrApiKey } = appContext;

  router.get("/experiment/status", requireLocalOrApiKey, (_req, res) => {
    res.json(experimentDefaults());
  });

  router.post(
    "/experiment/start",
    requireLocalOrApiKey,
    express.json({ limit: "256kb" }),
    (req, res) => {
      if (!experimentEnabled()) {
        return res.status(403).json({
          error:
            "Experiment mode is disabled. Enable it in Settings → General.",
        });
      }
      const hypothesis = String(req.body?.hypothesis || "").trim();
      if (!hypothesis) {
        return res.status(400).json({ error: "Missing hypothesis" });
      }
      const defaults = experimentDefaults();
      const maxRounds = Math.min(
        Math.max(parseInt(req.body?.maxRounds, 10) || defaults.maxRounds, 1),
        defaults.maxRounds,
      );
      const cfg = getConfig();
      try {
        const record = createExperiment({
          hypothesis,
          maxRounds,
          conversationId: req.body?.conversationId || null,
          projectFolder: cfg.projectFolder || null,
        });
        log("INFO", "Experiment started", { id: record.id });
        return res.json({ id: record.id, ...defaults, record });
      } catch (err) {
        log("ERROR", "experiment/start failed", { error: err.message });
        return res.status(500).json({ error: "Could not create experiment" });
      }
    },
  );

  router.get("/experiment/:id", requireLocalOrApiKey, (req, res) => {
    if (!experimentEnabled()) {
      return res.status(403).json({ error: "Experiment mode is disabled" });
    }
    const exp = getExperiment(req.params.id);
    if (!exp) return res.status(404).json({ error: "Not found" });
    res.json(exp);
  });

  /** Lightweight SSE: one snapshot frame (client can reconnect). */
  router.get("/experiment/:id/events", requireLocalOrApiKey, (req, res) => {
    if (!experimentEnabled()) {
      return res.status(403).json({ error: "Experiment mode is disabled" });
    }
    const exp = getExperiment(req.params.id);
    if (!exp) return res.status(404).json({ error: "Not found" });
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write(
      `data: ${JSON.stringify({ type: "snapshot", experiment: exp })}\n\n`,
    );
    res.write("data: [DONE]\n\n");
    res.end();
  });

  router.post(
    "/experiment/:id/note-step",
    requireLocalOrApiKey,
    express.json({ limit: "64kb" }),
    (req, res) => {
      if (!experimentEnabled()) {
        return res.status(403).json({ error: "Experiment mode is disabled" });
      }
      const exp = getExperiment(req.params.id);
      if (!exp) return res.status(404).json({ error: "Not found" });
      try {
        const next = appendStep(req.params.id, {
          role: req.body?.role || "assistant",
          summary: req.body?.summary || "",
          metric: req.body?.metric || null,
        });
        res.json({ ok: true, steps: next.steps.length });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  router.post(
    "/experiment/:id/step",
    requireLocalOrApiKey,
    express.json({ limit: "50mb" }),
    (req, res) => {
      if (!experimentEnabled()) {
        return res.status(403).json({
          error:
            "Experiment mode is disabled. Enable it in Settings → General.",
        });
      }
      const exp = getExperiment(req.params.id);
      if (!exp) return res.status(404).json({ error: "Unknown experiment id" });

      const defaults = experimentDefaults();
      if (elapsedSec(exp.createdAt) > defaults.maxDurationSec) {
        try {
          updateExperiment(exp.id, { status: "timeout" });
        } catch (_) {}
        return res.status(410).json({
          error: `Experiment exceeded max duration (${defaults.maxDurationSec}s)`,
        });
      }

      const {
        model: reqModel,
        messages,
        images,
        conversationId,
        agentMaxRounds: clientRounds,
      } = req.body || {};
      if (!reqModel || !messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Missing model or messages" });
      }

      const cappedRounds = Math.min(
        Math.max(parseInt(clientRounds, 10) || exp.maxRounds, 1),
        exp.maxRounds,
        defaults.maxRounds,
        25,
      );

      req.body = {
        model: reqModel,
        messages,
        mode: "experiment",
        images,
        conversationId: conversationId || exp.conversationId || undefined,
        agentMaxRounds: cappedRounds,
      };

      return handleChatPost(req, res, appContext);
    },
  );

  return router;
};
