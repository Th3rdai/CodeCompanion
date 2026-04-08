const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { getConfig } = require("../lib/config");
const { resolveAutoModel, mergeAutoModelMap } = require("../lib/auto-model");
const { effectiveOllamaApiKey, chatComplete } = require("../lib/ollama-client");
const { scaffoldProject } = require("../lib/icm-scaffolder");
const { scaffoldBuildProject } = require("../lib/build-scaffolder");
const { scanProjectForValidation } = require("../lib/validate");
const { CLIENT_INTERNAL_ERROR } = require("../lib/client-errors");

module.exports = function createRouter(appContext) {
  const router = express.Router();
  const { log, dataRoot: _dataRoot } = appContext;

  function ollamaAuthOpts(cfg) {
    const k = effectiveOllamaApiKey(cfg);
    return k ? { apiKey: k } : {};
  }

  // ── GET /api/project-health ──────────────────────────
  router.get("/project-health", (req, res) => {
    const config = getConfig();
    const folder = config.projectFolder;
    if (!folder || !fs.existsSync(folder)) {
      return res.json({ issues: 0, details: [] });
    }
    try {
      const result = scanProjectForValidation(folder);
      const details = [];
      if (result.linting.length === 0) details.push("No linter configured");
      if (
        result.typeChecking.length === 0 &&
        ["typescript", "python"].includes(result.language)
      )
        details.push("No type checker configured");
      if (result.testing.length === 0 && result.testDirs.length === 0)
        details.push("No test runner detected");
      if (result.formatting.length === 0)
        details.push("No formatter configured");
      res.json({
        issues: details.length,
        details,
        language: result.language,
        framework: result.framework,
      });
    } catch {
      res.json({ issues: 0, details: [] });
    }
  });

  // ── POST /api/create-project (ICM scaffold) ──────────
  router.post("/create-project", (req, res) => {
    log(
      "INFO",
      "create-project body keys: " + Object.keys(req.body || {}).join(", "),
    );
    const {
      name,
      description,
      role,
      audience,
      tone,
      stages,
      outputRoot,
      overwrite,
      makerEnabled,
    } = req.body;
    if (!name || !outputRoot) {
      log(
        "WARN",
        `create-project missing fields — name: "${name}", outputRoot: "${outputRoot}"`,
      );
      return res.status(400).json({
        success: false,
        error: "name and outputRoot are required",
        code: "MISSING_FIELDS",
      });
    }
    const config = getConfig();
    try {
      const result = scaffoldProject(
        {
          name,
          description,
          role,
          audience,
          tone,
          stages,
          outputRoot,
          overwrite: overwrite === true,
          makerEnabled: makerEnabled === true,
        },
        config,
      );
      if (result.success) {
        log("INFO", `ICM project created: ${result.projectPath}`);
        return res.status(201).json(result);
      }
      const code = result.code || "SCAFFOLD_FAILED";
      const status =
        code === "PATH_OUTSIDE_ROOT"
          ? 403
          : code === "ALREADY_EXISTS"
            ? 409
            : 400;
      return res.status(status).json({
        success: false,
        error: result.errors?.[0] || "Scaffold failed",
        code,
      });
    } catch (err) {
      log("ERROR", "create-project failed", { error: err.message });
      return res.status(500).json({
        success: false,
        error: CLIENT_INTERNAL_ERROR,
        code: "SERVER_ERROR",
      });
    }
  });

  // ── GET /api/cre8/prp-prompt ─────────────────────────
  router.get("/cre8/prp-prompt", (_req, res) => {
    const prpPath = path.join(
      os.homedir(),
      "AI_Dev",
      "CRE8",
      ".claude",
      "commands",
      "generate-prp.md",
    );
    try {
      if (!fs.existsSync(prpPath)) {
        return res.status(404).json({ error: "generate-prp.md not found" });
      }
      const content = fs.readFileSync(prpPath, "utf8");
      res.json({ content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/build-project (GSD + ICM scaffold) ─────
  router.post("/build-project", (req, res) => {
    const { name, description, outputRoot, audience, tone, overwrite } =
      req.body || {};
    if (!name || !outputRoot) {
      return res.status(400).json({
        success: false,
        error: "name and outputRoot are required",
        code: "MISSING_FIELDS",
      });
    }
    const config = getConfig();
    try {
      const result = scaffoldBuildProject(
        {
          name,
          description,
          outputRoot,
          audience,
          tone,
          overwrite: overwrite === true,
        },
        config,
      );
      if (result.success) {
        log("INFO", `Build project created: ${result.projectPath}`);
        return res.status(201).json(result);
      }
      const code = result.code || "SCAFFOLD_FAILED";
      const status =
        code === "PATH_OUTSIDE_ROOT"
          ? 403
          : code === "ALREADY_EXISTS"
            ? 409
            : 400;
      return res.status(status).json({
        success: false,
        error: result.errors?.[0] || "Scaffold failed",
        code,
      });
    } catch (err) {
      log("ERROR", "build-project failed", { error: err.message });
      return res.status(500).json({
        success: false,
        error: CLIENT_INTERNAL_ERROR,
        code: "SERVER_ERROR",
      });
    }
  });

  // ── POST /api/tutorial-suggestions ──────────────────
  // Rate limiter applied as app.use('/api/tutorial-suggestions', ...) in server.js
  router.post("/tutorial-suggestions", async (req, res) => {
    const { name, description, role, mode, model } = req.body || {};
    const validModes = ["create", "build"];
    if (!mode || !validModes.includes(mode)) {
      return res
        .status(400)
        .json({ error: 'mode is required and must be "create" or "build"' });
    }
    if (!name && !description) {
      return res
        .status(400)
        .json({ error: "At least one of name or description is required" });
    }
    const config = getConfig();
    const ollamaUrl = config.ollamaUrl || "http://localhost:11434";
    let selectedModel = model || config.selectedModel || "llama3.2";
    if (selectedModel === "auto") {
      try {
        const r = await resolveAutoModel({
          requestedModel: "auto",
          mode: mode || "create",
          estimatedTokens: Math.ceil(
            ((name || "").length + (description || "").length + 400) / 3.5,
          ),
          config,
          ollamaUrl: config.ollamaUrl,
          ollamaOpts: ollamaAuthOpts(config),
        });
        selectedModel = r.resolved;
      } catch {
        const m = mergeAutoModelMap(config.autoModelMap);
        selectedModel = m[mode || "create"] || m.chat || "llama3.2";
      }
    }

    const prompt = `You are helping fill out a project wizard. The user has already entered:

Project name: ${(name || "").trim() || "(none)"}
Description: ${(description || "").trim() || "(none)"}
${mode === "create" && role ? `AI role: ${role.trim()}` : ""}

Respond with ONLY a single JSON object, no markdown or explanation, with these exact keys:
- "audience": one short sentence describing who will use or benefit from this project (e.g. "Home cooks and people tracking nutrition")
- "tone": exactly one of: Friendly, Professional, Technical, Warm
- "outputRoot": a suggested parent folder path, e.g. "~/AI_Dev/"

Example: {"audience":"Developers and technical writers","tone":"Professional","outputRoot":"~/AI_Dev/"}`;

    try {
      const text = await chatComplete(
        ollamaUrl,
        selectedModel,
        [{ role: "user", content: prompt }],
        15000,
        [],
        ollamaAuthOpts(config),
      );
      const raw = text.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
      const parsed = JSON.parse(raw || "{}");
      const audience =
        typeof parsed.audience === "string" ? parsed.audience.trim() : null;
      const tone = typeof parsed.tone === "string" ? parsed.tone.trim() : null;
      const outputRoot =
        typeof parsed.outputRoot === "string" ? parsed.outputRoot.trim() : null;
      res.json({
        audience: audience || undefined,
        tone: tone || undefined,
        outputRoot: outputRoot || undefined,
      });
    } catch (err) {
      log("WARN", "tutorial-suggestions failed", { error: err.message });
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  return router;
};
