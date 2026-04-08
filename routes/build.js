const express = require("express");
const fs = require("fs");
const path = require("path");

const { getConfig } = require("../lib/config");
const {
  validateProjects,
  addProject,
  getProject,
  removeProject,
} = require("../lib/build-registry");
const GsdBridge = require("../lib/gsd-bridge");
const { isWithinBasePath } = require("../lib/file-browser");
const { resolveAutoModel, mergeAutoModelMap } = require("../lib/auto-model");
const { effectiveOllamaApiKey, chatComplete } = require("../lib/ollama-client");
const {
  CLIENT_INTERNAL_ERROR,
  STREAM_INTERNAL_ERROR,
} = require("../lib/client-errors");

const PLANNING_FILE_WHITELIST = [
  "ROADMAP.md",
  "REQUIREMENTS.md",
  "STATE.md",
  "CONTEXT.md",
  "PROJECT.md",
  "RETROSPECTIVE.md",
  "config.json",
];

module.exports = function createRouter(appContext) {
  const router = express.Router();
  const { log, dataRoot } = appContext;

  function ollamaAuthOpts(cfg) {
    const k = effectiveOllamaApiKey(cfg);
    return k ? { apiKey: k } : {};
  }

  async function resolveIfAutoModel(model, mode, estimatedTokens, config) {
    if (model !== "auto") return model;
    try {
      const r = await resolveAutoModel({
        requestedModel: "auto",
        mode,
        estimatedTokens: estimatedTokens || 0,
        config,
        ollamaUrl: config.ollamaUrl,
        ollamaOpts: ollamaAuthOpts(config),
      });
      return r.resolved;
    } catch {
      const m = mergeAutoModelMap(config.autoModelMap);
      return m[mode] || m.chat || "llama3.2";
    }
  }

  // Helper: resolve project from registry by ID and validate
  function _resolveBuildProject(req, res) {
    const project = getProject(dataRoot, req.params.id);
    if (!project)
      return res.status(404).json({ error: "Project not found in registry" });
    if (!fs.existsSync(project.path)) {
      return res
        .status(404)
        .json({ error: "Project directory missing", path: project.path });
    }
    return project;
  }

  // ── GET /api/build/projects ───────────────────────────
  router.get("/build/projects", (req, res) => {
    const projects = validateProjects(dataRoot);
    res.json(projects);
  });

  // ── POST /api/build/projects/register ────────────────
  router.post("/build/projects/register", (req, res) => {
    const { name, projectPath } = req.body || {};
    if (!name || !projectPath) {
      return res
        .status(400)
        .json({ error: "name and projectPath are required" });
    }
    const id = addProject(dataRoot, { name, projectPath });
    res.json({ success: true, id });
  });

  // ── POST /api/build/projects ──────────────────────────
  // Import existing project by path (auto-scaffolds .planning/ if missing)
  router.post("/build/projects", (req, res) => {
    const { path: importPath, name } = req.body || {};
    if (!importPath) {
      return res.status(400).json({ error: "path is required" });
    }
    const resolved = path.resolve(
      importPath.replace(/^~/, require("os").homedir()),
    );
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: "Folder not found" });
    }
    // F-03 fix: restrict import path to allowed roots
    const { getWritableRoots, isUnderRoot } = require("../lib/icm-scaffolder");
    const config = getConfig();
    if (!isUnderRoot(resolved, getWritableRoots(config))) {
      log("WARN", `Blocked build import outside allowed roots: ${resolved}`);
      return res
        .status(403)
        .json({ error: "Path is outside allowed directories" });
    }
    const projectName = name || path.basename(resolved);
    let scaffolded = false;

    if (!fs.existsSync(path.join(resolved, ".planning"))) {
      try {
        const { scaffoldPlanning } = require("../lib/build-scaffolder");
        scaffoldPlanning(resolved, projectName);
        scaffolded = true;
        log(
          "INFO",
          `Auto-scaffolded .planning/ for imported project: ${resolved}`,
        );
      } catch (err) {
        log(
          "ERROR",
          `Failed to scaffold .planning/ for import: ${err.message}`,
        );
        return res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
      }
    }

    const id = addProject(dataRoot, {
      name: projectName,
      projectPath: resolved,
    });
    res.json({ success: true, id, scaffolded });
  });

  // ── DELETE /api/build/projects/:id ───────────────────
  router.delete("/build/projects/:id", (req, res) => {
    const removed = removeProject(dataRoot, req.params.id);
    if (!removed) return res.status(404).json({ error: "Project not found" });
    res.json({ success: true });
  });

  // ── GET /api/build/projects/:id/state ────────────────
  router.get("/build/projects/:id/state", (req, res) => {
    const project = _resolveBuildProject(req, res);
    if (!project) return;
    try {
      const bridge = new GsdBridge(project.path);
      res.json(bridge.getState());
    } catch (err) {
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── GET /api/build/projects/:id/roadmap ──────────────
  router.get("/build/projects/:id/roadmap", (req, res) => {
    const project = _resolveBuildProject(req, res);
    if (!project) return;
    try {
      const bridge = new GsdBridge(project.path);
      res.json(bridge.getRoadmap());
    } catch (err) {
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── GET /api/build/projects/:id/progress ─────────────
  router.get("/build/projects/:id/progress", (req, res) => {
    const project = _resolveBuildProject(req, res);
    if (!project) return;
    try {
      const bridge = new GsdBridge(project.path);
      res.json(bridge.getProgress());
    } catch (err) {
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── GET /api/build/projects/:id/phase/:n ─────────────
  router.get("/build/projects/:id/phase/:n", (req, res) => {
    const project = _resolveBuildProject(req, res);
    if (!project) return;
    try {
      const bridge = new GsdBridge(project.path);
      res.json(bridge.getPhaseDetail(req.params.n));
    } catch (err) {
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── POST /api/build/projects/:id/next-action ─────────
  // Rate limiter applied as app.use() in server.js
  router.post("/build/projects/:id/next-action", async (req, res) => {
    const project = _resolveBuildProject(req, res);
    if (!project) return;
    try {
      const config = getConfig();
      const bridge = new GsdBridge(project.path);
      const state = bridge.getState();
      const progress = bridge.getProgress();

      const stateStr = JSON.stringify(state).slice(0, 2000);
      let model = req.body.model || config.selectedModel;
      if (!model) model = "llama3.2";
      model = await resolveIfAutoModel(
        model,
        "build",
        Math.ceil(stateStr.length / 3.5),
        config,
      );
      const messages = [
        {
          role: "system",
          content:
            "You are a friendly project coach. Given the project state, suggest the single most important next action. Be concise (2-3 sentences). Use encouraging, non-technical language. If the project is complete, congratulate them.",
        },
        {
          role: "user",
          content: `Project: ${project.name}\nProgress: ${JSON.stringify(progress)}\nState (truncated): ${stateStr}`,
        },
      ];

      const result = await chatComplete(
        config.ollamaUrl,
        model,
        messages,
        30000,
        [],
        ollamaAuthOpts(config),
      );
      res.json({ action: result, timestamp: new Date().toISOString() });
    } catch (err) {
      log("ERROR", `next-action failed: ${err.message}`);
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── POST /api/build/projects/:id/research ────────────
  // Rate limiter applied as app.use() in server.js
  router.post("/build/projects/:id/research", async (req, res) => {
    const project = _resolveBuildProject(req, res);
    if (!project) return;

    let aborted = false;
    req.on("close", () => {
      aborted = true;
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    function sendEvent(data) {
      if (!aborted && !res.writableEnded)
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    try {
      const config = getConfig();
      const phaseNumber = req.body.phaseNumber;
      if (!phaseNumber) {
        sendEvent({ error: "phaseNumber is required" });
        return res.end();
      }

      const bridge = new GsdBridge(project.path);
      const state = bridge.getState();
      const roadmap = bridge.getRoadmap();

      const stateStr = JSON.stringify(state).slice(0, 3000);
      const roadmapStr = JSON.stringify(roadmap.phases || roadmap).slice(
        0,
        3000,
      );
      let model = req.body.model || config.selectedModel;
      if (!model) model = "llama3.2";
      model = await resolveIfAutoModel(
        model,
        "build",
        Math.ceil((stateStr.length + roadmapStr.length) / 3.5),
        config,
      );

      const messages = [
        {
          role: "system",
          content:
            "You are a technical researcher preparing context for project planning. Given the project state and roadmap, research phase " +
            phaseNumber +
            ". Identify: 1) What needs to be built, 2) Key technical decisions, 3) Dependencies and risks, 4) Suggested approach. Be thorough but concise. Use markdown formatting.",
        },
        {
          role: "user",
          content: `Project: ${project.name}\nPhase: ${phaseNumber}\n\nState (truncated):\n${stateStr}\n\nRoadmap phases (truncated):\n${roadmapStr}`,
        },
      ];

      const result = await chatComplete(
        config.ollamaUrl,
        model,
        messages,
        180000,
        [],
        ollamaAuthOpts(config),
      );

      const words = result.split(/(\s+)/);
      for (const word of words) {
        if (aborted) break;
        sendEvent({ token: word });
      }

      if (!aborted) sendEvent({ done: true });
    } catch (err) {
      log("ERROR", `build-research failed: ${err.message}`);
      sendEvent({ error: STREAM_INTERNAL_ERROR });
    }
    if (!res.writableEnded) res.end();
  });

  // ── POST /api/build/projects/:id/plan ────────────────
  // Rate limiter applied as app.use() in server.js
  router.post("/build/projects/:id/plan", async (req, res) => {
    const project = _resolveBuildProject(req, res);
    if (!project) return;

    let aborted = false;
    req.on("close", () => {
      aborted = true;
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    function sendEvent(data) {
      if (!aborted && !res.writableEnded)
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    try {
      const config = getConfig();
      const phaseNumber = req.body.phaseNumber;
      const researchContext = req.body.researchContext || "";
      if (!phaseNumber) {
        sendEvent({ error: "phaseNumber is required" });
        return res.end();
      }

      const bridge = new GsdBridge(project.path);
      const state = bridge.getState();

      const stateStr = JSON.stringify(state).slice(0, 3000);
      let model = req.body.model || config.selectedModel;
      if (!model) model = "llama3.2";
      model = await resolveIfAutoModel(
        model,
        "build",
        Math.ceil((stateStr.length + researchContext.length) / 3.5),
        config,
      );

      const messages = [
        {
          role: "system",
          content:
            "You are a project planner. Given the research context and project state, create a concrete plan for phase " +
            phaseNumber +
            ". Include: 1) Phase goal, 2) Tasks with specific file paths and actions, 3) Success criteria, 4) Estimated complexity. Format as markdown with clear headings.",
        },
        {
          role: "user",
          content: `Project: ${project.name}\nPhase: ${phaseNumber}\n\nResearch context:\n${researchContext.slice(0, 4000)}\n\nState (truncated):\n${stateStr}`,
        },
      ];

      const result = await chatComplete(
        config.ollamaUrl,
        model,
        messages,
        180000,
        [],
        ollamaAuthOpts(config),
      );

      const words = result.split(/(\s+)/);
      for (const word of words) {
        if (aborted) break;
        sendEvent({ token: word });
      }

      // Write-after-validate
      const validated =
        result.length > 100 &&
        result.trim().startsWith("#") &&
        result.trim().length > 0;
      let written = false;

      if (validated && req.body.writeToFile) {
        try {
          const planningDir = path.join(project.path, ".planning", "phases");
          const targetPath = path.join(
            planningDir,
            `phase-${phaseNumber}-ai-plan.md`,
          );
          if (isWithinBasePath(targetPath, project.path)) {
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            const tmpPath = targetPath + `.tmp.${process.pid}`;
            fs.writeFileSync(tmpPath, result, "utf-8");
            fs.renameSync(tmpPath, targetPath);
            written = true;
          } else {
            log("WARN", `Blocked write outside project: ${targetPath}`);
          }
        } catch (writeErr) {
          log("ERROR", `Failed to write plan: ${writeErr.message}`);
        }
      }

      if (!aborted) sendEvent({ done: true, validated, written });
    } catch (err) {
      log("ERROR", `build-plan failed: ${err.message}`);
      sendEvent({ error: STREAM_INTERNAL_ERROR });
    }
    if (!res.writableEnded) res.end();
  });

  // ── GET /api/build/projects/:id/files ────────────────
  router.get("/build/projects/:id/files", (req, res) => {
    const project = _resolveBuildProject(req, res);
    if (!project) return;
    try {
      const planningDir = path.join(project.path, ".planning");
      if (!fs.existsSync(planningDir)) {
        return res.json({ files: [] });
      }
      const entries = fs.readdirSync(planningDir);
      const files = PLANNING_FILE_WHITELIST.filter((f) => entries.includes(f));
      res.json({ files });
    } catch (err) {
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── GET /api/build/projects/:id/files/:filename ──────
  router.get("/build/projects/:id/files/:filename", (req, res) => {
    const project = _resolveBuildProject(req, res);
    if (!project) return;
    const { filename } = req.params;
    if (!PLANNING_FILE_WHITELIST.includes(filename)) {
      return res.status(403).json({ error: "File not in whitelist" });
    }
    const fullPath = path.join(project.path, ".planning", filename);
    const basePath = path.join(project.path, ".planning");
    if (!isWithinBasePath(basePath, fullPath)) {
      return res.status(403).json({ error: "Path traversal blocked" });
    }
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "File not found" });
    }
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      res.json({ content, filename });
    } catch (err) {
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── PUT /api/build/projects/:id/files/:filename ──────
  router.put("/build/projects/:id/files/:filename", (req, res) => {
    const project = _resolveBuildProject(req, res);
    if (!project) return;
    const { filename } = req.params;
    if (!PLANNING_FILE_WHITELIST.includes(filename)) {
      return res.status(403).json({ error: "File not in whitelist" });
    }
    const fullPath = path.join(project.path, ".planning", filename);
    const basePath = path.join(project.path, ".planning");
    if (!isWithinBasePath(basePath, fullPath)) {
      return res.status(403).json({ error: "Path traversal blocked" });
    }
    const { content } = req.body || {};
    if (!content || typeof content !== "string") {
      return res
        .status(400)
        .json({ error: "content must be a non-empty string" });
    }
    try {
      const tmpPath = fullPath + ".tmp." + process.pid;
      fs.writeFileSync(tmpPath, content, "utf-8");
      fs.renameSync(tmpPath, fullPath);
      res.json({ success: true, filename });
    } catch (err) {
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  return router;
};
