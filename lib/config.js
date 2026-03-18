const fs = require('fs');
const path = require('path');

let _config = null;
let _appRoot = null;

function initConfig(appRoot) {
  _appRoot = appRoot;
  _config = loadConfig(appRoot);
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
  };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      // Deep merge for nested objects (memory, imageSupport)
      return {
        ...defaults,
        ...saved,
        memory: { ...defaults.memory, ...(saved.memory || {}) },
        imageSupport: { ...defaults.imageSupport, ...(saved.imageSupport || {}) },
      };
    }
  } catch (err) {
    // Silently fall through to defaults on error
  }
  return defaults;
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
  saveConfig
};
