const { ipcMain, app } = require("electron");
const fs = require("fs");
const path = require("path");
const { createBackup } = require("./data-manager");

// ── Failed-install loop guard ────────────────────────────────────────────────
// Squirrel.Mac (and the equivalent Windows / Linux flow) can stage a downloaded
// update, fail the swap (most often from a code-signature designated-requirement
// mismatch — see logs for "code failed to satisfy specified code requirement(s)"),
// then silently relaunch the OLD bundle. Without intervention the app immediately
// re-checks, finds the same "available" version, fires update-downloaded again,
// and the renderer prompts "Restart to apply" forever. We persist the version we
// just attempted to install in dataDir/.update-attempt; on the next launch we
// compare against app.getVersion() and, if the install clearly failed, mark that
// version as "skip" and surface a one-shot manual-install instruction to the user.

const UPDATE_ATTEMPT_FILENAME = ".update-attempt.json";

function readUpdateAttemptState(dataDir) {
  if (!dataDir) return null;
  try {
    const raw = fs.readFileSync(
      path.join(dataDir, UPDATE_ATTEMPT_FILENAME),
      "utf8",
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeUpdateAttemptState(dataDir, state) {
  if (!dataDir) return;
  try {
    fs.writeFileSync(
      path.join(dataDir, UPDATE_ATTEMPT_FILENAME),
      JSON.stringify(state, null, 2),
    );
  } catch {
    // best-effort — losing this state just means we lose the loop guard
  }
}

function clearUpdateAttemptState(dataDir) {
  if (!dataDir) return;
  try {
    fs.unlinkSync(path.join(dataDir, UPDATE_ATTEMPT_FILENAME));
  } catch {
    // already absent — fine
  }
}

function isCodeSignatureError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("code signature") ||
    msg.includes("code requirement") ||
    msg.includes("not pass validation")
  );
}

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

  // Detect a previous install attempt that failed (we restarted but came back
  // on the OLD version). If detected, mark the target version as "skip" so we
  // do not loop on update-downloaded → restart → fail → restart → ...
  const attemptState = readUpdateAttemptState(dataDir);
  let skipVersionUntilCleared = null;
  if (
    attemptState &&
    attemptState.targetVersion &&
    attemptState.targetVersion !== app.getVersion()
  ) {
    skipVersionUntilCleared = attemptState.targetVersion;
    log.warn(
      `[Auto-Updater] Previous install attempt for ${attemptState.targetVersion} did not take effect — running version is still ${app.getVersion()}. Suppressing the restart prompt for this version; the user must install it manually.`,
    );
  } else if (attemptState && attemptState.targetVersion === app.getVersion()) {
    // Install actually succeeded — clear the marker.
    clearUpdateAttemptState(dataDir);
  }

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

    // Loop guard: if we just tried this exact version and the relaunch came
    // back on the old version, do NOT prompt to restart again. Tell the user
    // the update was downloaded but the previous install attempt failed and
    // they need to install manually from GitHub Releases.
    if (skipVersionUntilCleared && info.version === skipVersionUntilCleared) {
      log.warn(
        `[Auto-Updater] Suppressing restart prompt for ${info.version} — previous install attempt did not take effect. Surfacing manual-install message instead.`,
      );
      lastDownloadedInfo = null;
      win.webContents.send("update-error", {
        kind: "install-failed-loop",
        targetVersion: info.version,
        runningVersion: app.getVersion(),
        message: `Auto-update to ${info.version} failed on the previous attempt (likely a code-signature mismatch — see ~/Library/Logs/code-companion/main.log). Please download the latest installer manually from https://github.com/Th3rdai/CodeCompanion/releases/tag/v${info.version} and replace /Applications/Code Companion.app to upgrade.`,
      });
      return;
    }

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

  // Event: Error — surface signature failures specifically so the renderer
  // can replace the "Restart to apply" affordance with a manual-install CTA.
  autoUpdater.on("error", (err) => {
    log.error("[Auto-Updater] Error:", err);
    if (isCodeSignatureError(err)) {
      const targetVersion = lastDownloadedInfo?.version || null;
      // Persist the failure marker so the next launch (if Squirrel relaunches
      // us on the OLD bundle) can suppress the loop without seeing this event.
      if (targetVersion) {
        writeUpdateAttemptState(dataDir, {
          targetVersion,
          failedAt: new Date().toISOString(),
          reason: "code-signature",
        });
      }
      // Drop the cached download so any IPC poll for state won't lie.
      lastDownloadedInfo = null;
      win.webContents.send("update-error", {
        kind: "code-signature",
        targetVersion,
        runningVersion: app.getVersion(),
        message: `The downloaded update${targetVersion ? ` (${targetVersion})` : ""} failed Apple's code-signature designated-requirement check, so macOS refused to apply it. This usually means the new bundle was signed by a different identity than the running app. Please download the installer manually from https://github.com/Th3rdai/CodeCompanion/releases and drag it to /Applications.`,
      });
    }
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
    // Record the version we are about to install. If the next launch comes
    // back on the OLD version (Squirrel ShipIt swap failed for any reason),
    // the startup probe above will detect it and suppress the loop.
    if (lastDownloadedInfo?.version) {
      writeUpdateAttemptState(dataDir, {
        targetVersion: lastDownloadedInfo.version,
        attemptedAt: new Date().toISOString(),
      });
    }
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

module.exports = {
  initAutoUpdater,
  // Exported for tests — pure helpers around the failed-install loop guard.
  readUpdateAttemptState,
  writeUpdateAttemptState,
  clearUpdateAttemptState,
  isCodeSignatureError,
};
