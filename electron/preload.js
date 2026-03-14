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
});
