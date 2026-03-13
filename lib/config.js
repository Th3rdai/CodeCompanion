const fs = require('fs');
const path = require('path');
const os = require('os');

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
    icmTemplatePath: path.join(os.homedir(), 'AI_Dev', 'ICM_FW', 'ICM-Framework-Template'),
  };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return { ...defaults, ...saved };
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

module.exports = {
  initConfig,
  getConfig,
  updateConfig,
  loadConfig,
  saveConfig
};
