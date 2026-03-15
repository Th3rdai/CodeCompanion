const { contextBridge, ipcRenderer } = require('electron');

/**
 * Exposes secure API to renderer process via contextBridge
 * Available as window.electronAPI in the React app
 */
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // App metadata
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getDataDir: () => ipcRenderer.invoke('get-data-dir'),

  // Data management
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: () => ipcRenderer.invoke('import-data'),

  // Last active mode persistence
  getLastMode: () => ipcRenderer.invoke('get-last-mode'),
  setLastMode: (mode) => ipcRenderer.invoke('set-last-mode', mode),

  // Port configuration
  getPortConfig: () => ipcRenderer.invoke('get-port-config'),
  setPortConfig: (port) => ipcRenderer.invoke('set-port-config', port),
  getActualPort: () => ipcRenderer.invoke('get-actual-port'),

  // Port fallback notification listener
  onPortFallback: (callback) => {
    ipcRenderer.on('port-fallback', (event, data) => callback(data));
  },

  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  restartForUpdate: () => ipcRenderer.invoke('restart-for-update'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, info) => callback(info));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, info) => callback(info));
  },

  // IDE launcher
  launchIDE: (ide, folder) => ipcRenderer.invoke('launch-ide', { ide, folder }),

  // License
  getLicenseInfo: () => ipcRenderer.invoke('get-license-info'),
  activateLicense: (key) => ipcRenderer.invoke('activate-license', key),
  purchasePro: () => ipcRenderer.invoke('purchase-pro'),
  restorePurchases: () => ipcRenderer.invoke('restore-purchases'),
  onPurchaseComplete: (cb) => ipcRenderer.on('purchase-complete', (_, data) => cb(data)),

  // Ollama setup
  checkOllama: (ollamaUrl) => ipcRenderer.invoke('check-ollama', ollamaUrl),
  installOllama: () => ipcRenderer.invoke('install-ollama'),
  pullModel: (ollamaUrl, modelName) => ipcRenderer.invoke('pull-model', { ollamaUrl, modelName }),
  onPullProgress: (callback) => ipcRenderer.on('pull-progress', (_, data) => callback(data)),
  offPullProgress: () => ipcRenderer.removeAllListeners('pull-progress'),
});
