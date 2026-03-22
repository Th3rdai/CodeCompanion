const { contextBridge, ipcRenderer } = require('electron');

/**
 * Exposes secure API to renderer process via contextBridge
 * Available as window.electronAPI in the React app
 */
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // App metadata
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getIsPackaged: () => ipcRenderer.invoke('get-is-packaged'),
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
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  restartForUpdate: () => ipcRenderer.invoke('restart-for-update'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, info) => callback(info));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, info) => callback(info));
  },
  onUpdateDownloadProgress: (callback) => {
    ipcRenderer.on('update-download-progress', (event, progress) => callback(progress));
  },

  // IDE launcher
  launchIDE: (ide, folder) => ipcRenderer.invoke('launch-ide', { ide, folder }),

  // Microphone permissions (macOS)
  getMicrophoneAccessStatus: () => ipcRenderer.invoke('get-microphone-access-status'),
  requestMicrophoneAccess: () => ipcRenderer.invoke('request-microphone-access'),

  // Docling (managed document conversion service)
  getDoclingStatus: () => ipcRenderer.invoke('get-docling-status'),

  // Ollama setup
  checkOllama: (ollamaUrl) => ipcRenderer.invoke('check-ollama', ollamaUrl),
  installOllama: () => ipcRenderer.invoke('install-ollama'),
  pullModel: (ollamaUrl, modelName) => ipcRenderer.invoke('pull-model', { ollamaUrl, modelName }),
  onPullProgress: (callback) => ipcRenderer.on('pull-progress', (_, data) => callback(data)),
  offPullProgress: () => ipcRenderer.removeAllListeners('pull-progress'),
});
