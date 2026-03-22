const { ipcMain } = require('electron');
const { createBackup } = require('./data-manager');

/**
 * Initializes the auto-updater for GitHub Releases
 * Checks for updates on launch and provides IPC handlers
 */
function initAutoUpdater(win, dataDir) {
  let autoUpdater;
  let log;

  try {
    log = require('electron-log');
    const updaterModule = require('electron-updater');
    autoUpdater = updaterModule.autoUpdater;
  } catch (err) {
    console.error('[Auto-Updater] Failed to load:', err.message);
    ipcMain.handle('check-for-updates', async () => ({
      success: false,
      error: `Auto-updater unavailable: ${err.message}`,
    }));
    ipcMain.handle('restart-for-update', () => {});
    return;
  }

  // Configure logging
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';
  log.info('[Auto-Updater] Initializing...');

  // GitHub: (1) Web URL .../releases/latest + Accept: application/json → 406 (fixed via patch-package
  // on electron-updater to use api.github.com). (2) If the repo has only prereleases, API /releases/latest
  // returns 404 — keep allowPrerelease true so the updater resolves versions from the Atom feed.
  // When you publish stable-only releases and want to hide betas from stable users, set false and test.
  autoUpdater.allowPrerelease = true;

  // Check for updates on startup (download behavior follows electron-updater defaults, e.g. autoDownload)
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    log.error('[Auto-Updater] Initial check failed:', err.message);
  });

  // Event: Update available
  autoUpdater.on('update-available', (info) => {
    log.info('[Auto-Updater] Update available:', info.version);
    win.webContents.send('update-available', info);
  });

  // Event: Download progress
  autoUpdater.on('download-progress', (progress) => {
    log.info(`[Auto-Updater] Download progress: ${Math.round(progress.percent)}%`);
    win.webContents.send('update-download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  // Event: Update downloaded - create backup before applying
  autoUpdater.on('update-downloaded', async (info) => {
    log.info('[Auto-Updater] Update downloaded:', info.version);

    try {
      log.info('[Auto-Updater] Creating pre-update backup...');
      const backupPath = await createBackup(dataDir);
      log.info('[Auto-Updater] Backup created:', backupPath);
    } catch (err) {
      log.error('[Auto-Updater] Backup failed:', err);
    }

    win.webContents.send('update-downloaded', info);
  });

  // Event: Error
  autoUpdater.on('error', (err) => {
    log.error('[Auto-Updater] Error:', err);
  });

  // IPC Handler: Manual update check
  // Note: checkForUpdates() always includes updateInfo (latest from feed) even when already on latest —
  // callers must use isUpdateAvailable, not truthiness of updateInfo.
  ipcMain.handle('check-for-updates', async () => {
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
      log.error('[Auto-Updater] Manual check failed:', err);
      return { success: false, error: err.message };
    }
  });

  // IPC Handler: Restart and install update
  ipcMain.handle('restart-for-update', () => {
    log.info('[Auto-Updater] Restarting for update...');
    autoUpdater.quitAndInstall();
  });

  log.info('[Auto-Updater] Ready');
}

module.exports = { initAutoUpdater };
