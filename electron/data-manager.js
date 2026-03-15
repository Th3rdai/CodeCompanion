const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const extractZip = require('extract-zip');

/**
 * Resolves the portable app root — the directory containing the app itself.
 * Data lives as a sibling folder so deleting the parent = full uninstall.
 *
 * Layout:
 *   SomeFolder/
 *   ├── Code Companion.app | CodeCompanion.exe | CodeCompanion-linux
 *   └── CodeCompanion-Data/
 *
 * In dev mode, data goes next to the project root.
 */
function getPortableRoot() {
  if (app.isPackaged) {
    // macOS: appPath is /path/to/Code Companion.app/Contents/Resources/app
    // Windows/Linux: appPath is /path/to/resources/app
    const appPath = app.getAppPath();

    if (process.platform === 'darwin') {
      // Walk up from .app/Contents/Resources/app → directory containing .app
      const dotApp = appPath.replace(/\/Contents\/Resources\/app\/?$/, '');
      return path.dirname(dotApp);
    }
    // Windows/Linux: exe is in the app root folder
    return path.dirname(app.getPath('exe'));
  }
  // Dev mode: project root
  return path.join(__dirname, '..');
}

/**
 * Resolves the data directory for Code Companion.
 * Self-contained: data lives next to the app so uninstall = delete the folder.
 * Automatically migrates from the legacy OS user-data location on first run.
 */
function resolveDataDirectory() {
  const portableRoot = getPortableRoot();
  const dataDir = path.join(portableRoot, 'CodeCompanion-Data');

  // Create directory if it doesn't exist
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });

    // Copy README to data directory
    const readmePath = path.join(__dirname, '..', 'resources', 'data-readme.txt');
    const destReadme = path.join(dataDir, 'README.txt');
    if (fs.existsSync(readmePath)) {
      fs.copyFileSync(readmePath, destReadme);
    }
  }

  // Migrate from legacy OS user-data location if it exists and portable dir is empty
  const legacyDir = path.join(app.getPath('userData'), 'CodeCompanion-Data');
  if (legacyDir !== dataDir && fs.existsSync(legacyDir)) {
    const portableFiles = fs.readdirSync(dataDir).filter(f => f !== 'README.txt');
    if (portableFiles.length === 0) {
      console.log('[Data Manager] Migrating from legacy OS location to portable...');
      copyDirectoryRecursive(legacyDir, dataDir);
      console.log('[Data Manager] Migration complete. Legacy data preserved at:', legacyDir);
    }
  }

  return dataDir;
}

/**
 * Migrates dev data from legacy locations to the Electron data directory
 * Checks for ./data/, ./history/, and ./config.json relative to app root
 */
function migrateDevData(dataDir, appRoot) {
  const legacyDataDir = path.join(appRoot, 'data');
  const legacyHistoryDir = path.join(appRoot, 'history');
  const legacyConfigFile = path.join(appRoot, '.cc-config.json');

  let migrated = false;
  const migrationLog = [];

  // Check if data directory is effectively empty (only README or nothing)
  const existingFiles = fs.existsSync(dataDir)
    ? fs.readdirSync(dataDir).filter(f => f !== 'README.txt')
    : [];

  if (existingFiles.length > 0) {
    console.log('[Data Manager] Data directory already has content, skipping migration');
    return { migrated: false, log: [] };
  }

  // Migrate legacy data directory
  if (fs.existsSync(legacyDataDir)) {
    const newDataSubdir = path.join(dataDir, 'data');
    fs.mkdirSync(newDataSubdir, { recursive: true });
    copyDirectoryRecursive(legacyDataDir, newDataSubdir);
    migrationLog.push(`Migrated ${legacyDataDir} to ${newDataSubdir}`);
    migrated = true;
  }

  // Migrate legacy history directory
  if (fs.existsSync(legacyHistoryDir)) {
    const newHistoryDir = path.join(dataDir, 'history');
    fs.mkdirSync(newHistoryDir, { recursive: true });
    copyDirectoryRecursive(legacyHistoryDir, newHistoryDir);
    migrationLog.push(`Migrated ${legacyHistoryDir} to ${newHistoryDir}`);
    migrated = true;
  }

  // Migrate legacy config file
  if (fs.existsSync(legacyConfigFile)) {
    const newConfigFile = path.join(dataDir, '.cc-config.json');
    fs.copyFileSync(legacyConfigFile, newConfigFile);
    migrationLog.push(`Migrated ${legacyConfigFile} to ${newConfigFile}`);
    migrated = true;
  }

  if (migrated) {
    console.log('[Data Manager] Migration complete:', migrationLog);
  }

  return { migrated, log: migrationLog };
}

/**
 * Helper: Copy directory recursively
 */
function copyDirectoryRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Creates a timestamped backup of the entire data directory
 * Returns the backup file path
 */
function createBackup(dataDir) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const backupFileName = `CodeCompanion-Backup-${timestamp}.zip`;
    const backupPath = path.join(dataDir, backupFileName);

    const output = fs.createWriteStream(backupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`[Data Manager] Backup created: ${backupPath} (${archive.pointer()} bytes)`);
      resolve(backupPath);
    });

    archive.on('error', (err) => {
      console.error('[Data Manager] Backup error:', err);
      reject(err);
    });

    archive.pipe(output);

    // Add all files in data directory except other backup ZIPs
    const entries = fs.readdirSync(dataDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.endsWith('.zip')) continue; // Skip existing backups

      const fullPath = path.join(dataDir, entry.name);
      if (entry.isDirectory()) {
        archive.directory(fullPath, entry.name);
      } else {
        archive.file(fullPath, { name: entry.name });
      }
    }

    archive.finalize();
  });
}

/**
 * Exports the entire data directory as a ZIP
 * Returns the path to the exported ZIP
 */
async function exportData(dataDir) {
  // Create a backup and return its path
  return createBackup(dataDir);
}

/**
 * Imports data from a ZIP file into the data directory
 * Merges with existing files (overwrites on conflict)
 */
async function importData(dataDir, zipPath) {
  try {
    console.log(`[Data Manager] Importing data from ${zipPath}`);
    await extractZip(zipPath, { dir: dataDir });
    console.log(`[Data Manager] Import complete`);
    return { success: true };
  } catch (err) {
    console.error('[Data Manager] Import error:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  resolveDataDirectory,
  migrateDevData,
  createBackup,
  exportData,
  importData,
};
