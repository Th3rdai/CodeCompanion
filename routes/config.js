const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { getConfig, updateConfig } = require("../lib/config");
const {
  resolveAutoModel,
  mergeAutoModelMap,
  DEFAULT_AUTO_MODEL_MAP,
} = require("../lib/auto-model");
const { effectiveDoclingApiKey } = require("../lib/docling-client");
const { effectiveOllamaApiKey } = require("../lib/ollama-client");
const { resolveFolderInput } = require("../lib/security-helpers");

function maskSensitiveValue(value) {
  if (!value) return "";
  if (typeof value !== "string") return "[REDACTED]";
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

function sanitizeConfigForClient(config) {
  const safe = { ...config };
  safe.githubTokenConfigured = Boolean(
    safe.githubToken || (safe.githubTokens && safe.githubTokens.length),
  );
  if ("githubToken" in safe) delete safe.githubToken;
  if (safe.githubTokens) {
    safe.githubTokens = safe.githubTokens.map((t) => ({
      label: t.label || "",
      username: t.username || "",
      avatar: t.avatar || "",
    }));
  }

  delete safe.license;

  if (safe.mcpServers && typeof safe.mcpServers === "object") {
    const clonedServers = {};
    for (const [name, server] of Object.entries(safe.mcpServers)) {
      const cloned = { ...server };
      if (cloned.env && typeof cloned.env === "object") {
        const maskedEnv = {};
        for (const [k, v] of Object.entries(cloned.env)) {
          const lower = String(k).toLowerCase();
          const looksSensitive =
            lower.includes("token") ||
            lower.includes("secret") ||
            lower.includes("password") ||
            lower.includes("key");
          maskedEnv[k] = looksSensitive ? maskSensitiveValue(v) : v;
        }
        cloned.env = maskedEnv;
      }
      clonedServers[name] = cloned;
    }
    safe.mcpServers = clonedServers;
  }

  if (safe.docling) {
    safe.docling = {
      ...safe.docling,
      apiKey: effectiveDoclingApiKey(config) ? "••••••••" : "",
    };
  }

  if (safe.ollamaApiKey) {
    safe.ollamaApiKey = "••••••••";
  }

  safe.autoModelMap = mergeAutoModelMap(safe.autoModelMap);
  safe.autoModelMapDefaults = { ...DEFAULT_AUTO_MODEL_MAP };

  return safe;
}

// Search common directories for a folder by name (1-2 levels deep)
const FOLDER_SEARCH_SKIP = new Set([
  ".Trash",
  ".Trashes",
  "Library",
  "node_modules",
  ".git",
  ".cache",
  ".npm",
  ".nvm",
]);

function findFolderByName(name) {
  const searchRoots = [
    os.homedir(),
    path.join(os.homedir(), "AI_Dev"),
    path.join(os.homedir(), "Projects"),
    path.join(os.homedir(), "Developer"),
    path.join(os.homedir(), "Documents"),
    path.join(os.homedir(), "Desktop"),
    path.join(os.homedir(), "Docker"),
    path.join(__dirname, ".."),
  ];
  for (const root of searchRoots) {
    const candidate = path.join(root, name);
    try {
      if (FOLDER_SEARCH_SKIP.has(path.basename(root))) continue;
      if (candidate.split(path.sep).some((seg) => FOLDER_SEARCH_SKIP.has(seg)))
        continue;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory())
        return candidate;
    } catch {}
  }
  for (const root of searchRoots) {
    try {
      if (!fs.existsSync(root)) continue;
      const children = fs.readdirSync(root, { withFileTypes: true });
      for (const child of children) {
        if (!child.isDirectory()) continue;
        if (FOLDER_SEARCH_SKIP.has(child.name)) continue;
        const candidate = path.join(root, child.name, name);
        try {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory())
            return candidate;
        } catch {}
      }
    } catch {}
  }
  return null;
}

function resolveFolder(folder) {
  if (folder.startsWith("~")) folder = path.join(os.homedir(), folder.slice(1));
  folder = path.resolve(folder);
  if (fs.existsSync(folder)) return folder;
  return findFolderByName(path.basename(folder));
}

module.exports = function createRouter(appContext) {
  const router = express.Router();
  const { config: _config, requireLocalOrApiKey, log, debug } = appContext;

  // ── GET /api/config ──────────────────────────────────
  router.get("/config", (req, res) => {
    debug("Config requested");
    const fullCfg = getConfig();
    if (fullCfg.projectFolder && !fs.existsSync(fullCfg.projectFolder)) {
      const home = os.homedir() || process.cwd();
      fullCfg.projectFolder = home;
      updateConfig({ projectFolder: home });
    }
    const config = sanitizeConfigForClient(getConfig());
    res.json(config);
  });

  // ── POST /api/config ─────────────────────────────────
  router.post("/config", requireLocalOrApiKey, (req, res) => {
    const { ollamaUrl, projectFolder, icmTemplatePath } = req.body;
    const config = getConfig();

    if (req.body.brandAssets !== undefined) {
      config.brandAssets = Array.isArray(req.body.brandAssets)
        ? req.body.brandAssets
        : [];
      log("INFO", `Brand assets updated: ${config.brandAssets.length} item(s)`);
    }

    if (icmTemplatePath !== undefined) {
      const val =
        typeof icmTemplatePath === "string" ? icmTemplatePath.trim() : "";
      if (val) {
        const resolved = resolveFolder(val);
        if (
          resolved &&
          fs.existsSync(resolved) &&
          fs.statSync(resolved).isDirectory()
        ) {
          config.icmTemplatePath = resolved;
          log("INFO", `icmTemplatePath set to: ${config.icmTemplatePath}`);
        } else {
          config.icmTemplatePath = "";
          log(
            "WARN",
            `icmTemplatePath ignored (not a directory or missing): ${val}`,
          );
        }
      } else {
        config.icmTemplatePath = "";
      }
    }

    if (ollamaUrl) {
      config.ollamaUrl = ollamaUrl.replace(/\/+$/, "");
      log("INFO", `Ollama URL changed to: ${config.ollamaUrl}`);
    }

    if (req.body.ollamaApiKey !== undefined) {
      const v = req.body.ollamaApiKey;
      if (typeof v === "string") {
        const t = v.trim();
        if (t === "") {
          config.ollamaApiKey = "";
          log("INFO", "Ollama API key cleared");
        } else if (!/^•+$/.test(t)) {
          config.ollamaApiKey = t;
          log("INFO", "Ollama API key updated");
        }
      }
    }

    if (req.body.selectedModel !== undefined) {
      config.selectedModel = req.body.selectedModel || "";
      if (config.selectedModel)
        log("INFO", `Default model set to: ${config.selectedModel}`);
    }

    if (req.body.reviewTimeoutSec !== undefined) {
      const timeout = parseInt(req.body.reviewTimeoutSec, 10);
      if (timeout >= 60 && timeout <= 600) {
        config.reviewTimeoutSec = timeout;
        log("INFO", `Review timeout set to: ${config.reviewTimeoutSec}s`);
      }
    }

    if (req.body.chatTimeoutSec !== undefined) {
      const timeout = parseInt(req.body.chatTimeoutSec, 10);
      if (timeout >= 30 && timeout <= 600) {
        config.chatTimeoutSec = timeout;
        log("INFO", `Chat timeout set to: ${config.chatTimeoutSec}s`);
      }
    }

    if (req.body.numCtx !== undefined) {
      const ctx = parseInt(req.body.numCtx, 10);
      if (ctx >= 0 && ctx <= 1048576) {
        config.numCtx = ctx;
        log(
          "INFO",
          `num_ctx set to: ${config.numCtx}${ctx === 0 ? " (model default)" : ""}`,
        );
      }
    }

    if (req.body.autoAdjustContext !== undefined) {
      config.autoAdjustContext = !!req.body.autoAdjustContext;
      log("INFO", `Auto-adjust context: ${config.autoAdjustContext}`);
    }

    if (req.body.preferredPort !== undefined) {
      const port = parseInt(req.body.preferredPort, 10);
      if (port >= 1024 && port <= 65535) {
        config.preferredPort = port;
        log(
          "INFO",
          `Preferred port set to: ${config.preferredPort} (takes effect on restart)`,
        );
      }
    }

    if (req.body.imageSupport !== undefined) {
      config.imageSupport = {
        ...config.imageSupport,
        ...req.body.imageSupport,
      };
      log("INFO", `Image support updated:`, config.imageSupport);
    }

    if (req.body.docling !== undefined) {
      const prev = config.docling || {};
      config.docling = { ...prev, ...req.body.docling };
      if (config.docling.url)
        config.docling.url = config.docling.url.replace(/\/+$/, "");
      log("INFO", `Docling config updated: ${config.docling.url}`);
    }

    if (req.body.memory !== undefined) {
      const prev = config.memory || {};
      config.memory = { ...prev, ...req.body.memory };
      log(
        "INFO",
        `Memory config updated: enabled=${config.memory.enabled}, model=${config.memory.embeddingModel || "auto"}`,
      );
    }

    if (req.body.agentTerminal !== undefined) {
      config.agentTerminal = {
        ...config.agentTerminal,
        ...req.body.agentTerminal,
      };
      log(
        "INFO",
        `Agent terminal config updated: enabled=${config.agentTerminal.enabled}`,
      );
    }

    if (
      req.body.autoModelMap !== undefined &&
      typeof req.body.autoModelMap === "object"
    ) {
      config.autoModelMap = mergeAutoModelMap(req.body.autoModelMap);
      log("INFO", "autoModelMap updated");
    }

    if (projectFolder !== undefined) {
      if (projectFolder) {
        log("INFO", `Config projectFolder received: "${projectFolder}"`);
        const resolvedFolder = resolveFolder(projectFolder);
        if (!resolvedFolder) {
          return res.status(400).json({ error: "Folder does not exist" });
        }
        const stat = fs.statSync(resolvedFolder);
        if (!stat.isDirectory()) {
          return res
            .status(400)
            .json({ error: "projectFolder must be a directory" });
        }
        const { getWritableRoots, isUnderRoot } = require("../lib/icm-scaffolder");
        const allowedRoots = getWritableRoots(config);
        if (!isUnderRoot(resolvedFolder, allowedRoots)) {
          log(
            "WARN",
            `Blocked projectFolder outside allowed roots: ${resolvedFolder}`,
          );
          return res
            .status(403)
            .json({ error: "Folder is outside allowed directories" });
        }
        config.projectFolder = resolvedFolder;
      } else {
        config.projectFolder = os.homedir() || process.cwd();
      }
      log("INFO", `Project folder set to: ${config.projectFolder || "(none)"}`);
    }

    updateConfig(config);
    res.json(sanitizeConfigForClient(getConfig()));
  });

  return router;
};
