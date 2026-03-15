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
    return;
  }

  // Configure logging
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';
  log.info('[Auto-Updater] Initializing...');

  // Check for updates on startup (does not download automatically)
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    log.error('[Auto-Updater] Initial check failed:', err.message);
  });

  // Event: Update available
  autoUpdater.on('update-available', (info) => {
    log.info('[Auto-Updater] Update available:', info.version);
    win.webContents.send('update-available', info);
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
  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdatesAndNotify();
      return { success: true, updateInfo: result?.updateInfo };
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
