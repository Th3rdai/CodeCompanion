const express = require("express");
const fs = require("fs");
const path = require("path");

const { getConfig } = require("../lib/config");
const { resolveAutoModel, mergeAutoModelMap } = require("../lib/auto-model");
const { effectiveOllamaApiKey, chatComplete } = require("../lib/ollama-client");
const {
  createBranch,
  getGitDiff,
  getMergePreview,
  resolveConflictFile,
  getGitStatus,
} = require("../lib/github");
const { CLIENT_INTERNAL_ERROR } = require("../lib/client-errors");

module.exports = function createRouter(appContext) {
  const router = express.Router();
  const { log, logDir, requireLocalOrApiKey } = appContext;

  function ollamaAuthOpts(cfg) {
    const k = effectiveOllamaApiKey(cfg);
    return k ? { apiKey: k } : {};
  }

  // ── Helper: resolve repo path from config ────────────
  function getConfiguredGitRepoPathOrRespond(res) {
    const config = getConfig();
    const folder = config.projectFolder;
    if (!folder || !fs.existsSync(folder)) {
      res.status(400).json({
        error:
          "No project folder configured, or it no longer exists. Set **Project folder** in Settings (General), then open GitHub → VCS → Refresh.",
      });
      return null;
    }
    return path.resolve(folder);
  }

  // ── Helper: assert a relative file path is within the repo ──
  function assertSafeRepoFilePath(repoPath, filePath) {
    if (!filePath) return "";
    const abs = path.resolve(repoPath, filePath);
    const root = path.resolve(repoPath);
    if (abs !== root && !abs.startsWith(root + path.sep)) {
      throw new Error("Path outside repository");
    }
    return path.relative(root, abs) || ".";
  }

  // ── GET /api/git/status ──────────────────────────────
  router.get("/git/status", (req, res) => {
    const repoPath = getConfiguredGitRepoPathOrRespond(res);
    if (!repoPath) return;
    try {
      const data = getGitStatus(repoPath);
      res.json({ ...data, repoPath });
    } catch (err) {
      log("WARN", `git status: ${err.message}`, { repoPath });
      res.status(400).json({ error: err.message });
    }
  });

  // ── POST /api/git/branch ─────────────────────────────
  router.post("/git/branch", (req, res) => {
    const repoPath = getConfiguredGitRepoPathOrRespond(res);
    if (!repoPath) return;
    try {
      const { name, checkout = true } = req.body || {};
      const result = createBranch(repoPath, name, checkout !== false);
      res.json(result);
    } catch (err) {
      log("WARN", `git branch: ${err.message}`, { repoPath });
      res.status(400).json({ error: err.message });
    }
  });

  // ── GET /api/git/diff ────────────────────────────────
  router.get("/git/diff", (req, res) => {
    const repoPath = getConfiguredGitRepoPathOrRespond(res);
    if (!repoPath) return;
    try {
      let rel = "";
      if (req.query.file) {
        rel = assertSafeRepoFilePath(repoPath, String(req.query.file));
      }
      const { diff } = getGitDiff(repoPath, rel);
      res.json({ diff });
    } catch (err) {
      log("WARN", `git diff: ${err.message}`, { repoPath });
      res.status(400).json({ error: err.message, diff: "" });
    }
  });

  // ── POST /api/git/merge-preview ──────────────────────
  router.post("/git/merge-preview", (req, res) => {
    const repoPath = getConfiguredGitRepoPathOrRespond(res);
    if (!repoPath) return;
    try {
      const { sourceBranch, targetRef = "HEAD" } = req.body || {};
      const preview = getMergePreview(repoPath, sourceBranch, targetRef);
      res.json(preview);
    } catch (err) {
      log("WARN", `git merge-preview: ${err.message}`, { repoPath });
      res
        .status(400)
        .json({ error: err.message, hasConflicts: false, preview: "" });
    }
  });

  // ── POST /api/git/resolve ────────────────────────────
  router.post("/git/resolve", (req, res) => {
    const repoPath = getConfiguredGitRepoPathOrRespond(res);
    if (!repoPath) return;
    try {
      const { filePath, strategy } = req.body || {};
      const rel = assertSafeRepoFilePath(repoPath, filePath);
      const result = resolveConflictFile(repoPath, rel, strategy);
      res.json(result);
    } catch (err) {
      log("WARN", `git resolve: ${err.message}`, { repoPath });
      res.status(400).json({ error: err.message });
    }
  });

  // ── POST /api/git/review ─────────────────────────────
  router.post("/git/review", async (req, res) => {
    const repoPath = getConfiguredGitRepoPathOrRespond(res);
    if (!repoPath) return;
    try {
      const config = getConfig();
      let model = req.body?.model || config.selectedModel;
      if (!model) {
        return res.status(400).json({ error: "No model selected", review: "" });
      }
      let rel = "";
      if (req.body?.filePath) {
        rel = assertSafeRepoFilePath(repoPath, String(req.body.filePath));
      }
      const { diff } = getGitDiff(repoPath, rel);
      const maxLen = 120000;
      const truncated = diff.length > maxLen;
      const diffBody = truncated
        ? `${diff.slice(0, maxLen)}\n\n[…truncated…]`
        : diff;
      if (model === "auto") {
        try {
          const r = await resolveAutoModel({
            requestedModel: "auto",
            mode: "chat",
            estimatedTokens: Math.ceil(diffBody.length / 3.5),
            config,
            ollamaUrl: config.ollamaUrl,
            ollamaOpts: ollamaAuthOpts(config),
          });
          model = r.resolved;
          log("INFO", `Auto-model resolved: git review → ${model}`);
        } catch {
          const m = mergeAutoModelMap(config.autoModelMap);
          model = m.chat || "llama3.2";
        }
      }
      const messages = [
        {
          role: "system",
          content:
            "You are a friendly code reviewer. Review the git diff below. Note risks, bugs, and style issues in plain language. Use short sections and bullet points.",
        },
        {
          role: "user",
          content: `Git diff (working tree)${rel ? ` for file: ${rel}` : " (all changes)"}:\n\n\`\`\`diff\n${diffBody}\n\`\`\``,
        },
      ];
      const review = await chatComplete(
        config.ollamaUrl,
        model,
        messages,
        120000,
        [],
        ollamaAuthOpts(config),
      );
      res.json({ review, truncated });
    } catch (err) {
      log("ERROR", `git review: ${err.message}`, { repoPath });
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR, review: "" });
    }
  });

  // ── GET /api/logs ────────────────────────────────────
  router.get("/logs", requireLocalOrApiKey, (req, res) => {
    const type = req.query.type === "debug" ? "debug.log" : "app.log";
    const lines = parseInt(req.query.lines) || 50;
    const logPath = path.join(logDir, type);
    try {
      if (!fs.existsSync(logPath)) return res.json({ lines: [], file: type });
      const content = fs.readFileSync(logPath, "utf8");
      const allLines = content.split("\n").filter(Boolean);
      res.json({
        lines: allLines.slice(-lines),
        file: type,
        total: allLines.length,
      });
    } catch (err) {
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  return router;
};
