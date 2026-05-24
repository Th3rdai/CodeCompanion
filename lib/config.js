const fs = require("fs");
const path = require("path");
const os = require("os");
const { mergeAutoModelMap } = require("./auto-model");

let _config = null;
let _appRoot = null;

/** When unset or blank in config, use the current user's home directory. */
function defaultProjectFolder() {
  return os.homedir() || process.cwd();
}

function normalizeProjectFolder(merged) {
  if (!merged.projectFolder || !String(merged.projectFolder).trim()) {
    merged.projectFolder = defaultProjectFolder();
  }
  // chatFolder must be within projectFolder; default to projectFolder if unset
  if (!merged.chatFolder || !String(merged.chatFolder).trim()) {
    merged.chatFolder = merged.projectFolder;
    return merged;
  }
  const pf = path.resolve(String(merged.projectFolder));
  const cfRaw = path.resolve(String(merged.chatFolder));
  try {
    if (!fs.existsSync(cfRaw) || !fs.statSync(cfRaw).isDirectory()) {
      merged.chatFolder = merged.projectFolder;
      return merged;
    }
    const cf = fs.realpathSync(cfRaw);
    let pfReal;
    try {
      pfReal = fs.realpathSync(pf);
    } catch {
      merged.chatFolder = merged.projectFolder;
      return merged;
    }
    if (cf !== pfReal && !cf.startsWith(pfReal + path.sep)) {
      merged.chatFolder = merged.projectFolder;
      return merged;
    }
    merged.chatFolder = cf;
  } catch {
    merged.chatFolder = merged.projectFolder;
  }
  return merged;
}

function initConfig(appRoot) {
  _appRoot = appRoot;
  const CONFIG_FILE = path.join(appRoot, ".cc-config.json");
  let persistHomeDefault = false;
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
      const pf = raw.projectFolder;
      if (
        pf === undefined ||
        pf === null ||
        (typeof pf === "string" && !pf.trim())
      ) {
        persistHomeDefault = true;
      }
    } catch {
      /* ignore */
    }
  }
  _config = loadConfig(appRoot);
  if (persistHomeDefault) {
    saveConfig(_config, _appRoot);
  }
  return _config;
}

function getConfig() {
  if (!_config)
    throw new Error("Config not initialized. Call initConfig(appRoot) first.");
  return _config;
}

function updateConfig(updates) {
  if (!_config)
    throw new Error("Config not initialized. Call initConfig(appRoot) first.");
  Object.assign(_config, updates);
  saveConfig(_config, _appRoot);
}

function loadConfig(appRoot) {
  const CONFIG_FILE = path.join(appRoot, ".cc-config.json");
  const defaults = {
    ollamaUrl: "http://localhost:11434",
    /** Ollama Cloud / Bearer auth (optional). Env OLLAMA_API_KEY used when empty. */
    ollamaApiKey: "",
    icmTemplatePath: "",
    organizationName: "",
    reviewTimeoutSec: 300,
    chatTimeoutSec: 600,
    numCtx: 0, // 0 = use model default; set higher for large documents
    autoAdjustContext: true, // auto-boost num_ctx and timeout for large payloads
    /**
     * CTXFIX Phase 1: client-side preflight banner that warns when the
     * pending message + history is approaching the model's context window.
     * Default off in v1.7.0; flipped on in v1.7.1 after dogfooding.
     */
    enablePreflightBanner: false,
    /**
     * CTXFIX Phase 3: hard cap on the cumulative tool-output character
     * budget injected back into a single chat round. Past this, the next
     * round's tool stdout is either externalized (see externalizeToolOutput)
     * or tail-truncated to keep history under the model's context.
     */
    cumulativeToolOutputMaxChars: 100_000,
    /**
     * CTXFIX Phase 3: when true AND projectFolder is set, externalize
     * tool stdout that would breach cumulativeToolOutputMaxChars to
     * `<projectFolder>/.codecompanion/tool-results/` and replace the
     * inline content with a placeholder pointing at codecompanion_read_file.
     * Default off in v1.7.0; flipped on in v1.7.1 after dogfood.
     */
    externalizeToolOutput: false,
    /**
     * CTXFIX Phase 2: server-side history compaction. Default off due to
     * behavioral impact; when on, older turns may be summarized when history
     * nears model context limits.
     */
    enableHistoryCompaction: false,
    /**
     * CTXFIX Phase 2: number of most-recent messages to keep verbatim when
     * compaction runs.
     */
    historyCompactKeepRecent: 10,
    /**
     * CTXFIX Phase 2: allow cloud models for compaction summarization.
     * Default false prefers local summarizer models for privacy/cost control.
     */
    historyCompactCloudAllowed: false,
    /**
     * CTXFIX Phase 2: hard cap for inserted summary text.
     */
    historyCompactMaxSummaryChars: 2000,
    /**
     * CTXFIX Phase 2: optional local model override used for summarization
     * when cloud summarizers are disallowed.
     */
    historyCompactSummarizerModelLocal: "",
    preferredPort: 8900,
    selectedModel: "",
    mcpClients: [],
    memory: {
      enabled: false,
      embeddingModel: "",
      maxContextTokens: 500,
      recallThreshold: 0.6,
      autoExtract: true,
      maxMemories: 500,
      hybridRecall: false,
      recallTurns: 3,
    },
    imageSupport: {
      enabled: true,
      maxSizeMB: 25,
      maxDimensionPx: 8192,
      compressionQuality: 0.9,
      maxImagesPerMessage: 10,
      resizeThreshold: 2048,
      warnOnFirstUpload: true,
    },
    docling: {
      url: "http://127.0.0.1:5002",
      apiKey: "",
      enabled: true,
      maxFileSizeMB: 50,
      outputFormat: "md",
      ocr: true,
      ocrEngine: "easyocr",
      timeoutSec: 120,
    },
    agentTerminal: {
      enabled: false,
      /** Command basenames for run_terminal_cmd: exact names or globs with only * and ? (e.g. git*). Lone "*" allows any basename. Blocklist still enforced. */
      allowlist: [],
      blocklist: ["sudo", "su", "rm -rf", "chmod 777", "mkfs", "dd"],
      maxTimeoutSec: 60,
      maxOutputKB: 256,
      confirmBeforeRun: false,
      /**
       * When true, commands whose reconstructed line matches shell metacharacters
       * (&& ; | etc.) run via `/bin/bash -lc` (Unix) or `cmd /d /s /c` (Windows)
       * instead of posix spawn(). Blocklist still applies to the full line.
       */
      allowShellChaining: true,
    },
    agentBrowser: {
      enabled: false,
      headed: false,
    },
    toolExec: {
      parallel: false, // default off for initial rollout
      maxConcurrent: 4,
    },
    /** Chat agent: Validate builtins (scan / generate validate.md). Default on. */
    agentValidate: { enabled: true },
    /** Chat agent: Planner score_plan builtin. Default on. */
    agentPlanner: { enabled: true },
    /**
     * Chat agent: first-party app skills (Review / Security scan / Builder score builtins).
     * Master `enabled` must be true and each sub-flag true for that tool to appear.
     */
    agentAppSkills: {
      enabled: false,
      review: false,
      pentest: false,
      builderScore: false,
    },
    /**
     * Chat-mode auto-continue: when the model returns prose after running tools
     * but doesn't explicitly signal completion, re-prompt with "continue" up to
     * `maxSteps` times so multi-step work doesn't stall at turn boundaries.
     * Off by default — keeps standard chat single-turn behavior unchanged.
     */
    autoContinue: {
      enabled: false,
      maxSteps: 5,
    },
    /**
     * When true, Chat mode blocks builtin.write_file and builtin.generate_office_file
     * unless the user's message matches explicit file-artifact intent (see
     * userExplicitlyRequestsFileWrites in chat-post-handler). User phrases like
     * "don't save to a file" still block writes. Default false — agent may write
     * project files in Chat when helpful.
     */
    chatRequireExplicitFileWrites: false,
    /** Experiment mode (UI + /api/experiment/*). On by default; turn off in Settings if undesired. */
    experimentMode: {
      enabled: true,
      maxRounds: 8,
      maxDurationSec: 900,
      /** Reserved for future command policy presets ("safe" | "strict") */
      commandProfile: "safe",
      /** If true, UI could require confirm before keeping edits (reserved) */
      confirmBeforeApply: false,
    },
    /** Per-mode default when the UI model is "auto". Merged with saved.autoModelMap. */
    autoModelMap: mergeAutoModelMap(),
    /**
     * Groq API key for POST /api/dictate-transcribe when Web Speech is blocked.
     * Prefer env GROQ_API_KEY or DICTATE_GROQ_API_KEY; this field is optional.
     */
    dictateGroqApiKey: "",
    projectFolder: defaultProjectFolder(),
    // chatFolder intentionally absent — normalizeProjectFolder sets it from projectFolder
    // so a saved config with no chatFolder always inherits the current projectFolder value.
  };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
      // Deep merge for nested objects (memory, imageSupport, docling)
      const merged = {
        ...defaults,
        ...saved,
        memory: { ...defaults.memory, ...(saved.memory || {}) },
        imageSupport: {
          ...defaults.imageSupport,
          ...(saved.imageSupport || {}),
        },
        docling: { ...defaults.docling, ...(saved.docling || {}) },
        agentTerminal: {
          ...defaults.agentTerminal,
          ...(saved.agentTerminal || {}),
        },
        agentBrowser: {
          ...defaults.agentBrowser,
          ...(saved.agentBrowser || {}),
        },
        toolExec: {
          ...defaults.toolExec,
          ...(saved.toolExec || {}),
        },
        agentValidate: {
          ...defaults.agentValidate,
          ...(saved.agentValidate || {}),
        },
        agentPlanner: {
          ...defaults.agentPlanner,
          ...(saved.agentPlanner || {}),
        },
        agentAppSkills: {
          ...defaults.agentAppSkills,
          ...(saved.agentAppSkills || {}),
        },
        experimentMode: {
          ...defaults.experimentMode,
          ...(saved.experimentMode || {}),
        },
        autoContinue: {
          ...defaults.autoContinue,
          ...(saved.autoContinue || {}),
        },
        autoModelMap: mergeAutoModelMap(saved.autoModelMap),
      };
      normalizeProjectFolder(merged);
      if (!String(merged.selectedModel || "").trim() && merged.defaultModel) {
        merged.selectedModel = String(merged.defaultModel).trim();
      }
      return merged;
    }
  } catch (err) {
    // Silently fall through to defaults on error
  }
  return normalizeProjectFolder({ ...defaults });
}

function saveConfig(cfg, appRoot) {
  const CONFIG_FILE = path.join(appRoot, ".cc-config.json");
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function getAppRoot() {
  if (!_appRoot)
    throw new Error("Config not initialized. Call initConfig(appRoot) first.");
  return _appRoot;
}

module.exports = {
  initConfig,
  getConfig,
  getAppRoot,
  updateConfig,
  loadConfig,
  saveConfig,
  defaultProjectFolder,
};
