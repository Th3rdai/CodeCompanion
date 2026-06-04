const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { getConfig, updateConfig } = require("../lib/config");
const {
  mergeAutoModelMap,
  DEFAULT_AUTO_MODEL_MAP,
  DEFAULT_AUTO_MODEL_MAP_OPENROUTER,
} = require("../lib/auto-model");
const {
  effectiveProvider,
  effectiveOpenrouterApiKey,
  invalidateListModelsCache,
} = require("../lib/ollama-client");
const { effectiveDoclingApiKey } = require("../lib/docling-client");
const { isDictateTranscribeConfigured } = require("../lib/dictate-transcribe");
const { logEvent, EVENT_TYPES } = require("../lib/audit-log");

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

  // Provider toggle + OpenRouter key (masked; never return the raw value).
  const provider = effectiveProvider(config);
  safe.provider = provider;
  safe.openrouterApiKeyConfigured = Boolean(effectiveOpenrouterApiKey(config));
  safe.openrouterApiKey = safe.openrouterApiKeyConfigured ? "••••••••" : "";
  safe.openrouterUrl = config.openrouterUrl || "https://openrouter.ai/api/v1";

  safe.dictateGroqConfigured = isDictateTranscribeConfigured(config);
  safe.dictateGroqApiKey = safe.dictateGroqConfigured ? "••••••••" : "";

  safe.autoModelMap = mergeAutoModelMap(safe.autoModelMap, provider);
  safe.autoModelMapDefaults =
    provider === "openrouter"
      ? { ...DEFAULT_AUTO_MODEL_MAP_OPENROUTER }
      : { ...DEFAULT_AUTO_MODEL_MAP };

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

function createConfigRouter(appContext) {
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
    const { ollamaUrl, projectFolder, chatFolder, icmTemplatePath } = req.body;
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

    if (req.body.organizationName !== undefined) {
      if (typeof req.body.organizationName === "string") {
        config.organizationName = req.body.organizationName.trim();
        log("INFO", "Organization name updated");
      }
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

    if (req.body.provider !== undefined) {
      const p = String(req.body.provider || "").trim();
      if (p === "ollama" || p === "openrouter") {
        config.provider = p;
        log("INFO", `LLM provider set to: ${config.provider}`);
      } else {
        log("WARN", `Ignored invalid provider: ${p}`);
      }
    }

    if (req.body.openrouterUrl !== undefined) {
      const raw = String(req.body.openrouterUrl || "").trim();
      // Require http(s) and strip trailing slashes; fall back to the canonical
      // host on anything malformed so a bad value can't redirect the API key.
      const stripped = raw.replace(/\/+$/, "");
      if (/^https?:\/\//i.test(stripped)) {
        config.openrouterUrl = stripped;
        // The OpenRouter Bearer key is sent to this host. Self-host proxies are
        // allowed, but flag non-canonical, non-loopback targets so a redirected
        // key is auditable in the logs.
        try {
          const host = new URL(stripped).hostname.toLowerCase();
          const trusted =
            host === "openrouter.ai" ||
            host.endsWith(".openrouter.ai") ||
            host === "localhost" ||
            host === "127.0.0.1";
          if (!trusted) {
            log(
              "WARN",
              `OpenRouter base URL points at a non-canonical host (${host}); the API key will be sent there. Confirm this is a trusted proxy.`,
            );
          }
        } catch {
          /* parse guarded by the http(s) regex above */
        }
      } else {
        config.openrouterUrl = "https://openrouter.ai/api/v1";
        if (raw) log("WARN", `Ignored invalid openrouterUrl: ${raw}`);
      }
      log("INFO", `OpenRouter URL set to: ${config.openrouterUrl}`);
    }

    if (req.body.openrouterApiKey !== undefined) {
      const v = req.body.openrouterApiKey;
      if (typeof v === "string") {
        const t = v.trim();
        if (t === "") {
          config.openrouterApiKey = "";
          log("INFO", "OpenRouter API key cleared");
        } else if (!/^•+$/.test(t)) {
          config.openrouterApiKey = t;
          log("INFO", "OpenRouter API key updated");
        }
      }
    }

    if (req.body.dictateGroqApiKey !== undefined) {
      const v = req.body.dictateGroqApiKey;
      if (typeof v === "string") {
        const t = v.trim();
        if (t === "") {
          config.dictateGroqApiKey = "";
          log("INFO", "Groq dictation API key cleared");
        } else if (!/^•+$/.test(t)) {
          config.dictateGroqApiKey = t;
          log("INFO", "Groq dictation API key updated");
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

    if (req.body.autoContinue !== undefined) {
      config.autoContinue = {
        ...(config.autoContinue || { enabled: false, maxSteps: 5 }),
        ...req.body.autoContinue,
      };
      log(
        "INFO",
        `Auto-continue config updated: enabled=${config.autoContinue.enabled} maxSteps=${config.autoContinue.maxSteps}`,
      );
    }

    if (req.body.chatRequireExplicitFileWrites !== undefined) {
      config.chatRequireExplicitFileWrites =
        !!req.body.chatRequireExplicitFileWrites;
      log(
        "INFO",
        `Chat require explicit file writes: ${config.chatRequireExplicitFileWrites}`,
      );
    }

    if (req.body.agentBrowser !== undefined) {
      config.agentBrowser = {
        ...(config.agentBrowser || {}),
        ...req.body.agentBrowser,
      };
      log(
        "INFO",
        `Agent browser config updated: enabled=${config.agentBrowser.enabled}`,
      );
    }

    if (req.body.agentValidate !== undefined) {
      config.agentValidate = {
        ...(config.agentValidate || { enabled: true }),
        ...req.body.agentValidate,
      };
      log(
        "INFO",
        `Agent validate config updated: enabled=${config.agentValidate.enabled !== false}`,
      );
    }

    if (req.body.agentPlanner !== undefined) {
      config.agentPlanner = {
        ...(config.agentPlanner || { enabled: true }),
        ...req.body.agentPlanner,
      };
      log(
        "INFO",
        `Agent planner config updated: enabled=${config.agentPlanner.enabled !== false}`,
      );
    }

    if (req.body.agentAppSkills !== undefined) {
      const prev = config.agentAppSkills || {};
      const incoming = req.body.agentAppSkills;
      if (typeof incoming === "object" && incoming) {
        config.agentAppSkills = { ...prev, ...incoming };
        log(
          "INFO",
          `Agent app skills updated: ${JSON.stringify(config.agentAppSkills)}`,
        );
      }
    }

    if (req.body.experimentMode !== undefined) {
      const prev = config.experimentMode || {};
      const incoming = req.body.experimentMode;
      if (typeof incoming === "object" && incoming) {
        config.experimentMode = { ...prev, ...incoming };
        if (typeof config.experimentMode.maxRounds === "number") {
          config.experimentMode.maxRounds = Math.min(
            Math.max(Math.floor(config.experimentMode.maxRounds), 1),
            25,
          );
        }
        if (typeof config.experimentMode.maxDurationSec === "number") {
          config.experimentMode.maxDurationSec = Math.min(
            Math.max(Math.floor(config.experimentMode.maxDurationSec), 60),
            7200,
          );
        }
        log(
          "INFO",
          `Experiment mode config updated: enabled=${config.experimentMode.enabled}`,
        );
      }
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
        const {
          getWritableRoots,
          isUnderRoot,
        } = require("../lib/icm-scaffolder");
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
      // When projectFolder changes, reset chatFolder to the new projectFolder
      // unless chatFolder was also provided in the same request
      if (chatFolder === undefined) {
        config.chatFolder = config.projectFolder;
      }
    }

    if (chatFolder !== undefined) {
      if (chatFolder) {
        const resolvedChat = resolveFolder(chatFolder);
        if (!resolvedChat) {
          return res.status(400).json({ error: "Chat folder does not exist" });
        }
        if (!fs.statSync(resolvedChat).isDirectory()) {
          return res
            .status(400)
            .json({ error: "chatFolder must be a directory" });
        }
        // chatFolder must be within projectFolder (the security boundary)
        const boundary = config.projectFolder || os.homedir();
        if (
          !resolvedChat.startsWith(boundary + path.sep) &&
          resolvedChat !== boundary
        ) {
          return res
            .status(403)
            .json({ error: "Chat folder must be within the project folder" });
        }
        config.chatFolder = resolvedChat;
      } else {
        config.chatFolder =
          config.projectFolder || os.homedir() || process.cwd();
      }
      log("INFO", `Chat folder set to: ${config.chatFolder}`);
    }

    updateConfig(config);

    // Drop the cached model catalog when a provider/connection field changed so
    // the next /api/models fetch reflects the new provider/key/URL immediately
    // (rather than serving a ≤45s-stale list). Clears both Ollama + OR caches.
    if (
      [
        "provider",
        "openrouterUrl",
        "openrouterApiKey",
        "ollamaUrl",
        "ollamaApiKey",
      ].some((k) => req.body[k] !== undefined)
    ) {
      invalidateListModelsCache();
    }

    // Audit log: settings changed
    // Capture which top-level settings were modified
    const changedSettings = Object.keys(req.body).filter(
      (key) =>
        ![
          "brandAssets",
          "mcpServers",
          "mcpClients",
          "memory",
          "imageSupport",
          "docling",
          "agentTerminal",
          "agentBrowser",
          "toolExec",
          "agentValidate",
          "agentPlanner",
          "agentAppSkills",
          "autoContinue",
          "experimentMode",
        ].includes(key),
    );

    logEvent({
      event: EVENT_TYPES.SETTINGS_CHANGED,
      userId: "anonymous", // TODO: replace with actual userId when multi-user is implemented
      ip: req.ip || req.socket?.remoteAddress || "unknown",
      meta: {
        changedSettings:
          changedSettings.length > 0 ? changedSettings : ["nested-object"],
        settingCount: Object.keys(req.body).length,
      },
    });

    res.json(sanitizeConfigForClient(getConfig()));
  });

  return router;
}

createConfigRouter.sanitizeConfigForClient = sanitizeConfigForClient;
module.exports = createConfigRouter;
