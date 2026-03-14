const { autoUpdater } = require('electron-updater');
const { ipcMain } = require('electron');
const log = require('electron-log');
const { createBackup } = require('./data-manager');

/**
 * Initializes the auto-updater for GitHub Releases
 * Checks for updates on launch and provides IPC handlers
 */
function initAutoUpdater(win, dataDir) {
  // Configure logging
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';
  log.info('[Auto-Updater] Initializing...');

  // Check for updates on startup (does not download automatically)
  autoUpdater.checkForUpdatesAndNotify();

  // Event: Update available
  autoUpdater.on('update-available', (info) => {
    log.info('[Auto-Updater] Update available:', info.version);
    win.webContents.send('update-available', info);
  });

  // Event: Update downloaded - create backup before applying
  autoUpdater.on('update-downloaded', async (info) => {
    log.info('[Auto-Updater] Update downloaded:', info.version);

    try {
      // Create pre-update backup per user decision
      log.info('[Auto-Updater] Creating pre-update backup...');
      const backupPath = await createBackup(dataDir);
      log.info('[Auto-Updater] Backup created:', backupPath);
    } catch (err) {
      log.error('[Auto-Updater] Backup failed:', err);
      // Continue anyway - user data is still safe
    }

    // Notify renderer that update is ready
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
