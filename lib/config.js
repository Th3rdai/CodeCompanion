const fs = require('fs');
const path = require('path');
const os = require('os');

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
  return merged;
}

function initConfig(appRoot) {
  _appRoot = appRoot;
  const CONFIG_FILE = path.join(appRoot, '.cc-config.json');
  let persistHomeDefault = false;
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      const pf = raw.projectFolder;
      if (pf === undefined || pf === null || (typeof pf === 'string' && !pf.trim())) {
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
  if (!_config) throw new Error('Config not initialized. Call initConfig(appRoot) first.');
  return _config;
}

function updateConfig(updates) {
  if (!_config) throw new Error('Config not initialized. Call initConfig(appRoot) first.');
  Object.assign(_config, updates);
  saveConfig(_config, _appRoot);
}

function loadConfig(appRoot) {
  const CONFIG_FILE = path.join(appRoot, '.cc-config.json');
  const defaults = {
    ollamaUrl: 'http://localhost:11434',
    icmTemplatePath: '',
    reviewTimeoutSec: 300,
    chatTimeoutSec: 120,
    numCtx: 0,              // 0 = use model default; set higher for large documents
    autoAdjustContext: true, // auto-boost num_ctx and timeout for large payloads
    preferredPort: 8900,
    memory: {
      enabled: false,
      embeddingModel: '',
      maxContextTokens: 500,
      autoExtract: true,
      maxMemories: 500,
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
      url: 'http://127.0.0.1:5002',
      apiKey: '',
      enabled: true,
      maxFileSizeMB: 50,
      outputFormat: 'md',
      ocr: true,
      ocrEngine: 'easyocr',
      timeoutSec: 120,
    },
    agentTerminal: {
      enabled: false,
      allowlist: [],
      blocklist: ['sudo', 'su', 'rm -rf', 'chmod 777', 'mkfs', 'dd'],
      maxTimeoutSec: 60,
      maxOutputKB: 256,
      confirmBeforeRun: false,
    },
    projectFolder: defaultProjectFolder(),
  };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      // Deep merge for nested objects (memory, imageSupport, docling)
      const merged = {
        ...defaults,
        ...saved,
        memory: { ...defaults.memory, ...(saved.memory || {}) },
        imageSupport: { ...defaults.imageSupport, ...(saved.imageSupport || {}) },
        docling: { ...defaults.docling, ...(saved.docling || {}) },
        agentTerminal: { ...defaults.agentTerminal, ...(saved.agentTerminal || {}) },
      };
      return normalizeProjectFolder(merged);
    }
  } catch (err) {
    // Silently fall through to defaults on error
  }
  return normalizeProjectFolder({ ...defaults });
}

function saveConfig(cfg, appRoot) {
  const CONFIG_FILE = path.join(appRoot, '.cc-config.json');
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function getAppRoot() {
  if (!_appRoot) throw new Error('Config not initialized. Call initConfig(appRoot) first.');
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
