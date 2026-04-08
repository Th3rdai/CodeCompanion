const express = require("express");
const fs = require("fs");
const path = require("path");

const { getConfig, updateConfig } = require("../lib/config");
const {
  cloneRepo,
  deleteClonedRepo,
  listClonedRepos,
  listUserRepos,
  validateTokenCached,
  resolveToken,
  getAllTokens,
  createRepo,
  initAndPush,
  parseGitHubUrl,
} = require("../lib/github");
const { isWithinBasePath } = require("../lib/file-browser");
const {
  assertLocalPathForGitPush,
  isAllowedGitHubRemoteUrl,
} = require("../lib/security-helpers");
const { CLIENT_INTERNAL_ERROR } = require("../lib/client-errors");

module.exports = function createRouter(appContext) {
  const router = express.Router();
  const { log, debug, dataRoot, requireLocalOrApiKey } = appContext;

  // ── POST /api/github/clone ───────────────────────────
  // Rate limiter applied as app.use('/api/github/clone', ...) in server.js
  router.post("/github/clone", (req, res) => {
    const { url: repoUrl, destination } = req.body;
    if (!repoUrl) return res.status(400).json({ error: "Missing repo URL" });

    const config = getConfig();
    // Resolve token by repo owner if multi-PAT configured
    const parsed = parseGitHubUrl(repoUrl);
    const token = resolveToken(
      config,
      parsed?.owner || config.activeGithubAccount,
    );

    // Validate destination exists if provided
    if (destination) {
      const destResolved = path.resolve(destination);
      if (!fs.existsSync(destResolved)) {
        return res
          .status(400)
          .json({ error: `Destination folder does not exist: ${destination}` });
      }
    }

    log(
      "INFO",
      `Cloning GitHub repo: ${repoUrl}${destination ? ` → ${destination}` : ""}`,
    );
    const result = cloneRepo(dataRoot, repoUrl, token, { destination });

    if (result.success) {
      log(
        "INFO",
        `Clone success: ${result.owner}/${result.repo} → ${result.localPath}`,
      );
      debug("Clone result", result);
    } else {
      log("ERROR", `Clone failed: ${result.error}`);
    }

    res.json(result);
  });

  // ── GET /api/github/repos ────────────────────────────
  router.get("/github/repos", (req, res) => {
    try {
      const repos = listClonedRepos(dataRoot);
      res.json({ repos });
    } catch (err) {
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── DELETE /api/github/repos/:dirName ────────────────
  router.delete("/github/repos/:dirName", (req, res) => {
    const result = deleteClonedRepo(dataRoot, req.params.dirName);
    res.json(result);
  });

  // ── POST /api/github/open ────────────────────────────
  router.post("/github/open", (req, res) => {
    const { dirName } = req.body;
    if (!dirName) return res.status(400).json({ error: "Missing dirName" });
    if (!/^[a-zA-Z0-9_.-]+--[a-zA-Z0-9_.-]+$/.test(dirName)) {
      return res.status(400).json({ error: "Invalid dirName" });
    }

    const reposRoot = path.resolve(dataRoot, "github-repos");
    const fullPath = path.resolve(reposRoot, dirName);
    if (!isWithinBasePath(reposRoot, fullPath)) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!fs.existsSync(fullPath))
      return res.status(404).json({ error: "Cloned repo not found" });

    const config = getConfig();
    config.projectFolder = fullPath;
    updateConfig(config);

    log("INFO", `Project folder set to cloned repo: ${fullPath}`);
    res.json({ success: true, projectFolder: fullPath });
  });

  // ── GET /api/github/browse ───────────────────────────
  router.get("/github/browse", async (req, res) => {
    const config = getConfig();
    const tokenOwner = req.query.owner || config.activeGithubAccount || "";
    const token = resolveToken(config, tokenOwner);
    if (!token)
      return res.status(401).json({
        error: "No GitHub token configured. Add one in Settings → GitHub.",
      });

    try {
      const page = parseInt(req.query.page) || 1;
      const repos = await listUserRepos(token, page);
      res.json({ repos });
    } catch (err) {
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── POST /api/github/token ───────────────────────────
  router.post("/github/token", requireLocalOrApiKey, async (req, res) => {
    const { token, label, remove } = req.body;
    const config = getConfig();
    if (!config.githubTokens) config.githubTokens = [];

    // Remove a token by label/username
    if (remove) {
      const removeLower = remove.toLowerCase();
      config.githubTokens = config.githubTokens.filter(
        (t) =>
          (t.label || "").toLowerCase() !== removeLower &&
          (t.username || "").toLowerCase() !== removeLower,
      );
      // Also clear legacy token if it matches the removed one
      if (!config.githubTokens.length) config.githubToken = "";
      else config.githubToken = config.githubTokens[0].token;
      updateConfig(config);
      return res.json({
        valid: true,
        message: `Token "${remove}" removed`,
        tokens: getAllTokens(config).map((t) => ({
          label: t.label,
          username: t.username,
          avatar: t.avatar,
        })),
      });
    }

    if (!token) {
      // Clear all tokens
      config.githubToken = "";
      config.githubTokens = [];
      updateConfig(config);
      return res.json({ valid: true, message: "All tokens cleared" });
    }

    const result = await validateTokenCached(token);
    if (result.valid) {
      const entryLabel = label || result.username;
      const entry = {
        label: entryLabel,
        token,
        username: result.username,
        avatar: result.avatar || "",
      };
      // Replace if same label exists; allow multiple tokens for same username with different labels
      const idx = config.githubTokens.findIndex(
        (t) => (t.label || "").toLowerCase() === entryLabel.toLowerCase(),
      );
      if (idx >= 0) config.githubTokens[idx] = entry;
      else config.githubTokens.push(entry);
      // Keep legacy field in sync (first token)
      config.githubToken = config.githubTokens[0].token;
      updateConfig(config);
      log("INFO", `GitHub token saved for user: ${result.username}`);
      result.tokens = config.githubTokens.map((t) => ({
        label: t.label,
        username: t.username,
        avatar: t.avatar,
      }));
    }
    res.json(result);
  });

  // ── GET /api/github/token/status ─────────────────────
  router.get("/github/token/status", requireLocalOrApiKey, async (req, res) => {
    const config = getConfig();
    const tokens = getAllTokens(config);
    if (!tokens.length) return res.json({ configured: false, tokens: [] });

    const activeLabel = config.activeGithubAccount || tokens[0].label;
    const activeToken = resolveToken(config, activeLabel);
    const active = await validateTokenCached(activeToken);
    res.json({
      configured: true,
      ...active,
      activeAccount: activeLabel,
      tokens: tokens.map((t) => ({
        label: t.label,
        username: t.username,
        avatar: t.avatar,
      })),
    });
  });

  // ── POST /api/github/active-account ──────────────────
  router.post("/github/active-account", requireLocalOrApiKey, (req, res) => {
    const { label } = req.body;
    if (!label) return res.status(400).json({ error: "Missing label" });
    const config = getConfig();
    config.activeGithubAccount = label;
    updateConfig(config);
    log("INFO", `Active GitHub account switched to: ${label}`);
    res.json({ success: true, activeAccount: label });
  });

  // ── POST /api/github/create ───────────────────────────
  router.post("/github/create", async (req, res) => {
    const config = getConfig();
    const token = resolveToken(
      config,
      req.body?.owner || config.activeGithubAccount,
    );
    if (!token)
      return res.status(401).json({
        error: "GitHub token not configured. Add one in Settings → GitHub.",
      });

    const { name, description, isPrivate } = req.body || {};
    if (!name)
      return res.status(400).json({ error: "Repository name is required" });

    try {
      const result = await createRepo(token, name, { description, isPrivate });
      if (result.success) {
        log("INFO", `GitHub repo created: ${result.fullName}`);
      } else {
        log("ERROR", `GitHub create failed: ${result.error}`);
      }
      res.status(result.success ? 201 : 400).json(result);
    } catch (err) {
      log("ERROR", `GitHub create error: ${err.message}`);
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── POST /api/github/push ─────────────────────────────
  router.post("/github/push", requireLocalOrApiKey, (req, res) => {
    const config = getConfig();
    const parsed = parseGitHubUrl(req.body?.remoteUrl || "");
    const token = resolveToken(
      config,
      parsed?.owner || config.activeGithubAccount,
    );
    if (!token)
      return res.status(401).json({ error: "GitHub token not configured" });

    const { localPath, remoteUrl, commitMessage, branch } = req.body || {};
    if (!localPath || !remoteUrl)
      return res
        .status(400)
        .json({ error: "localPath and remoteUrl are required" });
    if (!isAllowedGitHubRemoteUrl(remoteUrl)) {
      return res.status(400).json({
        error: "remoteUrl must be a github.com HTTPS or git@github.com SSH URL",
      });
    }
    const pathCheck = assertLocalPathForGitPush(localPath, config);
    if (!pathCheck.ok) {
      return res.status(403).json({ error: pathCheck.error });
    }
    if (!fs.existsSync(pathCheck.resolved))
      return res.status(404).json({ error: "Local path does not exist" });

    try {
      const result = initAndPush(pathCheck.resolved, remoteUrl, token, {
        commitMessage,
        branch,
      });
      if (result.success) {
        log("INFO", `Pushed to GitHub: ${remoteUrl}`);
      } else {
        log("ERROR", `Push failed: ${result.error}`);
      }
      res.json(result);
    } catch (err) {
      log("ERROR", `Push error: ${err.message}`);
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  return router;
};
