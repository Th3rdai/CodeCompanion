const express = require("express");
const crypto = require("crypto");
const { getConfig } = require("../lib/config");
const {
  createExperiment,
  getExperiment,
  updateExperiment,
  appendStep,
  finalizeExperiment,
  listExperiments,
  DuplicateExperimentError,
} = require("../lib/experiment-store");
const {
  parseStepSummary,
  extractMetricBlock,
  extractDeniedToolCalls,
  inferDecision,
} = require("../lib/experiment-step-parser");
const { ExperimentRecordSchema } = require("../lib/experiment-schema");
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

function _hashStartPayload({ hypothesis, scope, metric }) {
  const canonical = JSON.stringify({
    h: (hypothesis || "").trim(),
    s: scope || null,
    m: metric || null,
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function _sanitizeScope(input) {
  if (!input || typeof input !== "object") return null;
  const paths = Array.isArray(input.paths)
    ? input.paths
        .filter((p) => typeof p === "string" && p.length > 0)
        .slice(0, 16)
    : [];
  const commands = Array.isArray(input.commands)
    ? input.commands
        .filter((c) => typeof c === "string" && c.length > 0)
        .slice(0, 64)
    : [];
  return { paths, commands };
}

function _sanitizeMetric(input) {
  if (!input || typeof input !== "object") return null;
  const allowed = ["<", ">", "==", ">=", "<="];
  if (!allowed.includes(input.comparison)) return null;
  if (typeof input.name !== "string" || !input.name.trim()) return null;
  return {
    name: input.name.trim().slice(0, 64),
    target:
      typeof input.target === "number" && Number.isFinite(input.target)
        ? input.target
        : null,
    comparison: input.comparison,
    unit:
      typeof input.unit === "string" && input.unit.trim()
        ? input.unit.trim().slice(0, 16)
        : null,
  };
}

module.exports = function createExperimentRouter(appContext) {
  const router = express.Router();
  const { log, requireLocalOrApiKey } = appContext;

  router.get("/experiment/status", requireLocalOrApiKey, (_req, res) => {
    res.json(experimentDefaults());
  });

  router.get("/experiment", requireLocalOrApiKey, (req, res) => {
    if (!experimentEnabled()) {
      return res.status(403).json({ error: "Experiment mode is disabled" });
    }
    const projectFolder = req.query.projectFolder
      ? String(req.query.projectFolder)
      : undefined;
    const limit = parseInt(req.query.limit, 10);
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const rows = listExperiments({
      projectFolder,
      limit: Number.isFinite(limit) ? limit : 50,
      cursor,
    });
    res.json({
      items: rows,
      nextCursor: rows.length > 0 ? rows[rows.length - 1].updatedAt : null,
    });
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
      const scope = _sanitizeScope(req.body?.scope);
      const metric = _sanitizeMetric(req.body?.metric);
      const reproducibility =
        req.body?.reproducibility &&
        typeof req.body.reproducibility === "object"
          ? {
              note:
                typeof req.body.reproducibility.note === "string"
                  ? req.body.reproducibility.note.slice(0, 200)
                  : null,
              seed: req.body.reproducibility.seed ?? null,
            }
          : null;
      const budgetSecRaw = parseInt(req.body?.budgetSec, 10);
      const budgetSec = Number.isFinite(budgetSecRaw)
        ? Math.min(Math.max(budgetSecRaw, 60), defaults.maxDurationSec)
        : defaults.maxDurationSec;
      const promptHash = _hashStartPayload({ hypothesis, scope, metric });

      try {
        const record = createExperiment({
          hypothesis,
          maxRounds,
          budgetSec,
          conversationId: req.body?.conversationId || null,
          projectFolder: cfg.projectFolder || null,
          scope,
          metric,
          reproducibility,
          promptHash,
        });
        log("INFO", "Experiment started", { id: record.id });
        return res.json({ id: record.id, ...defaults, record });
      } catch (err) {
        if (err instanceof DuplicateExperimentError) {
          log("WARN", "Duplicate experiment start blocked", {
            existingId: err.existingId,
          });
          return res.status(409).json({
            error: "experiment_already_running",
            existingId: err.existingId,
          });
        }
        log("ERROR", "experiment/start failed", { error: err.message });
        return res.status(500).json({ error: "Could not create experiment" });
      }
    },
  );

  /**
   * Back-fill `conversationId` on an experiment after the chat record is
   * saved. ExperimentPanel calls /experiment/start BEFORE the chat exists
   * (start mints the id, then saveHistory writes the chat with
   * experimentIds: [id]). Without this endpoint, experiment.conversationId
   * stays null, and clicking the linked-experiment chip restores the report
   * but loses the conversation context. One-shot, idempotent: if the field
   * is already set to the same value, it's a no-op; only sets when null OR
   * when the caller is updating to a different conv (rare).
   */
  router.post(
    "/experiment/:id/link-conversation",
    requireLocalOrApiKey,
    express.json({ limit: "8kb" }),
    (req, res) => {
      if (!experimentEnabled()) {
        return res.status(403).json({ error: "Experiment mode is disabled" });
      }
      const exp = getExperiment(req.params.id, getConfig());
      if (!exp) return res.status(404).json({ error: "Not found" });
      const conversationId = req.body?.conversationId;
      if (typeof conversationId !== "string" || !conversationId.trim()) {
        return res.status(400).json({ error: "conversationId is required" });
      }
      if (exp.conversationId === conversationId) {
        return res.json({ ok: true, status: "already-linked" });
      }
      try {
        updateExperiment(req.params.id, { conversationId });
        log("INFO", "Experiment linked to conversation", {
          id: exp.id,
          conversationId,
        });
        res.json({ ok: true, status: "linked" });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  router.get("/experiment/:id", requireLocalOrApiKey, (req, res) => {
    if (!experimentEnabled()) {
      return res.status(403).json({ error: "Experiment mode is disabled" });
    }
    const exp = getExperiment(req.params.id, getConfig());
    if (!exp) return res.status(404).json({ error: "Not found" });
    try {
      ExperimentRecordSchema.parse(exp);
    } catch (e) {
      log("WARN", "Experiment record failed schema parse", {
        id: exp.id,
        error: e.message,
      });
    }
    res.json(exp);
  });

  /** Lightweight SSE: one snapshot frame (client can reconnect). */
  router.get("/experiment/:id/events", requireLocalOrApiKey, (req, res) => {
    if (!experimentEnabled()) {
      return res.status(403).json({ error: "Experiment mode is disabled" });
    }
    const exp = getExperiment(req.params.id, getConfig());
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

  /**
   * Server is the *sole* parser. Body must be { rawAssistantText: string }.
   * Old `summary` field is accepted for one release with a deprecation log.
   * Any client-supplied did/observed/next/done/decision/metric/denials are ignored.
   */
  router.post(
    "/experiment/:id/note-step",
    requireLocalOrApiKey,
    express.json({ limit: "64kb" }),
    (req, res) => {
      if (!experimentEnabled()) {
        return res.status(403).json({ error: "Experiment mode is disabled" });
      }
      const exp = getExperiment(req.params.id, getConfig());
      if (!exp) return res.status(404).json({ error: "Not found" });

      let rawAssistantText = "";
      if (typeof req.body?.rawAssistantText === "string") {
        rawAssistantText = req.body.rawAssistantText;
      } else if (typeof req.body?.summary === "string") {
        rawAssistantText = req.body.summary;
        log("DEBUG", "note-step: deprecated 'summary' field used", {
          id: exp.id,
        });
      }

      try {
        const parsed = parseStepSummary(rawAssistantText);
        const metric = extractMetricBlock(rawAssistantText);
        const denials = extractDeniedToolCalls(rawAssistantText);
        const decision = inferDecision({
          next: parsed.next,
          done: parsed.done,
          denials,
          rawSummary: rawAssistantText,
        });

        const next = appendStep(req.params.id, {
          role: req.body?.role === "user" ? "user" : "assistant",
          rawAssistantText,
          did: parsed.did,
          observed: parsed.observed,
          next: parsed.next,
          done: parsed.done,
          decision,
          denials,
          metric,
        });

        if (parsed.done && next.status === "active") {
          const finalValue =
            metric && typeof metric.value === "number" ? metric.value : null;
          finalizeExperiment(req.params.id, {
            status: "completed",
            finalMetricValue: finalValue,
          });
        }

        res.json({ ok: true, steps: next.steps.length });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  router.post(
    "/experiment/:id/abort",
    requireLocalOrApiKey,
    express.json({ limit: "8kb" }),
    (req, res) => {
      if (!experimentEnabled()) {
        return res.status(403).json({ error: "Experiment mode is disabled" });
      }
      const exp = getExperiment(req.params.id, getConfig());
      if (!exp) return res.status(404).json({ error: "Not found" });
      try {
        const reason =
          typeof req.body?.reason === "string"
            ? req.body.reason.slice(0, 200)
            : "user";
        const next = finalizeExperiment(req.params.id, {
          status: "aborted",
          abortReason: reason,
        });
        log("INFO", "Experiment aborted", { id: exp.id, reason });
        res.json({ ok: true, status: next.status });
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
      const exp = getExperiment(req.params.id, getConfig());
      if (!exp) return res.status(404).json({ error: "Unknown experiment id" });

      const defaults = experimentDefaults();
      const budgetSec = exp.budgetSec || defaults.maxDurationSec;
      if (elapsedSec(exp.createdAt) > budgetSec) {
        try {
          finalizeExperiment(exp.id, { status: "timeout" });
        } catch (_) {}
        return res.status(410).json({
          error: `Experiment exceeded max duration (${budgetSec}s)`,
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
        _experimentId: exp.id,
      };

      return handleChatPost(req, res, appContext);
    },
  );

  return router;
};
