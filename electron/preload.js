const { contextBridge, ipcRenderer } = require("electron");

/**
 * Exposes secure API to renderer process via contextBridge
 * Available as window.electronAPI in the React app
 */
contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,

  // App metadata
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getIsPackaged: () => ipcRenderer.invoke("get-is-packaged"),
  getDataDir: () => ipcRenderer.invoke("get-data-dir"),

  // Data management
  exportData: () => ipcRenderer.invoke("export-data"),
  importData: () => ipcRenderer.invoke("import-data"),

  // Last active mode persistence
  getLastMode: () => ipcRenderer.invoke("get-last-mode"),
  setLastMode: (mode) => ipcRenderer.invoke("set-last-mode", mode),

  // Port configuration
  getPortConfig: () => ipcRenderer.invoke("get-port-config"),
  setPortConfig: (port) => ipcRenderer.invoke("set-port-config", port),
  getActualPort: () => ipcRenderer.invoke("get-actual-port"),

  // Port fallback notification listener
  onPortFallback: (callback) => {
    ipcRenderer.on("port-fallback", (event, data) => callback(data));
  },

  /** Open https URLs in the system browser (installers page, docs). */
  openExternalUrl: (url) => ipcRenderer.invoke("open-external-url", url),

  /** Close the app (Settings UI). */
  quitApp: () => ipcRenderer.invoke("quit-app"),

  /** Restart the app process (Settings UI). */
  restartApp: () => ipcRenderer.invoke("restart-app"),

  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  getUpdateState: () => ipcRenderer.invoke("get-update-state"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  restartForUpdate: () => ipcRenderer.invoke("restart-for-update"),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on("update-available", (event, info) => callback(info));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on("update-downloaded", (event, info) => callback(info));
  },
  onUpdateDownloadProgress: (callback) => {
    ipcRenderer.on("update-download-progress", (event, progress) =>
      callback(progress),
    );
  },
  onUpdateError: (callback) => {
    ipcRenderer.on("update-error", (event, info) => callback(info));
  },

  // IDE launcher
  launchIDE: (ide, folder) => ipcRenderer.invoke("launch-ide", { ide, folder }),

  // Folder picker (native OS dialog)
  pickFolder: () => ipcRenderer.invoke("pick-folder"),

  // Microphone permissions (macOS)
  getMicrophoneAccessStatus: () =>
    ipcRenderer.invoke("get-microphone-access-status"),
  requestMicrophoneAccess: () =>
    ipcRenderer.invoke("request-microphone-access"),

  // Docling (managed document conversion service)
  getDoclingStatus: () => ipcRenderer.invoke("get-docling-status"),

  // Integrated terminal (Electron-only; browser shows empty state)
  terminal: {
    start: (cwd) => ipcRenderer.invoke("terminal-start", cwd),
    write: (data) => ipcRenderer.invoke("terminal-write", data),
    resize: (cols, rows) => ipcRenderer.invoke("terminal-resize", cols, rows),
    kill: () => ipcRenderer.invoke("terminal-kill"),
    onData: (cb) => ipcRenderer.on("terminal-data", (_, b64) => cb(atob(b64))),
    offData: () => ipcRenderer.removeAllListeners("terminal-data"),
    onExit: (cb) => ipcRenderer.once("terminal-exit", cb),
  },

  // Ollama setup
  checkOllama: (ollamaUrl, ollamaApiKey) =>
    ipcRenderer.invoke("check-ollama", {
      ollamaUrl: ollamaUrl || "http://localhost:11434",
      ollamaApiKey: ollamaApiKey || "",
    }),
  installOllama: () => ipcRenderer.invoke("install-ollama"),
  pullModel: (ollamaUrl, modelName, ollamaApiKey) =>
    ipcRenderer.invoke("pull-model", {
      ollamaUrl,
      modelName,
      ollamaApiKey: ollamaApiKey || "",
    }),
  onPullProgress: (callback) =>
    ipcRenderer.on("pull-progress", (_, data) => callback(data)),
  offPullProgress: () => ipcRenderer.removeAllListeners("pull-progress"),
});
