const { ipcMain, app } = require("electron");
const { createBackup } = require("./data-manager");

/**
 * Unpackaged `electron .` / dev: electron-updater does nothing (see AppUpdater.isUpdaterActive).
 * Skip loading the module and expose IPC so Settings never throws; renderer uses getIsPackaged to disable UI.
 */
function registerUnpackagedUpdaterIpc() {
  ipcMain.handle("check-for-updates", async () => ({
    success: true,
    updateInfo: null,
    isUpdateAvailable: false,
  }));
  ipcMain.handle("restart-for-update", () => {});
  ipcMain.handle("get-update-state", () => ({
    success: true,
    updateDownloaded: false,
    updateInfo: null,
  }));
  ipcMain.handle("download-update", async () => ({
    success: false,
    error:
      "Updates apply to the installed app only. Use a packaged build (DMG/EXE/AppImage) or download from GitHub Releases.",
  }));
}

/**
 * Initializes the auto-updater for GitHub Releases
 * Checks for updates on launch and provides IPC handlers
 */
function initAutoUpdater(win, dataDir) {
  if (!app.isPackaged) {
    registerUnpackagedUpdaterIpc();
    return;
  }

  let autoUpdater;
  let log;
  /** Set when `update-downloaded` fires so renderer can sync if it missed the event (e.g. opened Settings late). */
  let lastDownloadedInfo = null;

  try {
    log = require("electron-log");
    const updaterModule = require("electron-updater");
    autoUpdater = updaterModule.autoUpdater;
  } catch (err) {
    console.error("[Auto-Updater] Failed to load:", err.message);
    ipcMain.handle("check-for-updates", async () => ({
      success: false,
      error: `Auto-updater unavailable: ${err.message}`,
    }));
    ipcMain.handle("restart-for-update", () => {});
    ipcMain.handle("get-update-state", async () => ({
      success: false,
      updateDownloaded: false,
      updateInfo: null,
    }));
    ipcMain.handle("download-update", async () => ({
      success: false,
      error: `Auto-updater unavailable: ${err.message}`,
    }));
    return;
  }

  // Configure logging
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = "info";
  log.info("[Auto-Updater] Initializing...");

  // GitHub: (1) Web URL .../releases/latest + Accept: application/json → 406 (fixed via patch-package
  // on electron-updater to use api.github.com). (2) If the repo has only prereleases, API /releases/latest
  // returns 404 — keep allowPrerelease true so the updater resolves versions from the Atom feed.
  // When you publish stable-only releases and want to hide betas from stable users, set false and test.
  autoUpdater.allowPrerelease = true;
  if (process.platform === "darwin" && process.arch === "x64") {
    // Intel mac builds publish a dedicated feed filename in CI: latest-x64-mac.yml.
    autoUpdater.channel = "latest-x64";
    log.info("[Auto-Updater] Using Intel macOS channel: latest-x64");
  }
  autoUpdater.autoInstallOnAppQuit = true;

  // Check for updates on startup (download behavior follows electron-updater defaults, e.g. autoDownload)
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    log.error("[Auto-Updater] Initial check failed:", err.message);
  });

  // Event: Update available
  autoUpdater.on("update-available", (info) => {
    log.info("[Auto-Updater] Update available:", info.version);
    win.webContents.send("update-available", info);
  });

  // Event: Download progress
  autoUpdater.on("download-progress", (progress) => {
    log.info(
      `[Auto-Updater] Download progress: ${Math.round(progress.percent)}%`,
    );
    win.webContents.send("update-download-progress", {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  // Event: Update downloaded - create backup before applying
  autoUpdater.on("update-downloaded", async (info) => {
    log.info("[Auto-Updater] Update downloaded:", info.version);
    lastDownloadedInfo = info;

    try {
      log.info("[Auto-Updater] Creating pre-update backup...");
      const backupPath = await createBackup(dataDir);
      log.info("[Auto-Updater] Backup created:", backupPath);
    } catch (err) {
      log.error("[Auto-Updater] Backup failed:", err);
    }

    win.webContents.send("update-downloaded", info);
  });

  // Event: Error
  autoUpdater.on("error", (err) => {
    log.error("[Auto-Updater] Error:", err);
  });

  // IPC Handler: Manual update check
  // Note: checkForUpdates() always includes updateInfo (latest from feed) even when already on latest —
  // callers must use isUpdateAvailable, not truthiness of updateInfo.
  ipcMain.handle("check-for-updates", async () => {
    try {
      const result = await autoUpdater.checkForUpdatesAndNotify();
      if (result == null) {
        return { success: true, updateInfo: null, isUpdateAvailable: false };
      }
      return {
        success: true,
        updateInfo: result.updateInfo,
        isUpdateAvailable: result.isUpdateAvailable === true,
      };
    } catch (err) {
      log.error("[Auto-Updater] Manual check failed:", err);
      return { success: false, error: err.message };
    }
  });

  // IPC Handler: Restart and install update
  ipcMain.handle("restart-for-update", () => {
    log.info("[Auto-Updater] Restarting for update...");
    // isSilent=false (show installer), isForceRunAfter=true (relaunch after install).
    // Without these args macOS may not quit the running app, leaving the update unapplied.
    setImmediate(() => {
      app.removeAllListeners("window-all-closed");
      autoUpdater.quitAndInstall(false, true);
    });
  });

  ipcMain.handle("get-update-state", () => ({
    success: true,
    updateDownloaded: lastDownloadedInfo != null,
    updateInfo: lastDownloadedInfo,
  }));

  /** Explicit download — needed when UI is already "update available" (re-check alone does not change state). */
  ipcMain.handle("download-update", async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true, updateInfo: lastDownloadedInfo };
    } catch (err) {
      log.error("[Auto-Updater] downloadUpdate failed:", err);
      return { success: false, error: err.message || String(err) };
    }
  });

  log.info("[Auto-Updater] Ready");
}

module.exports = { initAutoUpdater };
