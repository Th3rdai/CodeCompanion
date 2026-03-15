const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

const { resolveDataDirectory, migrateDevData, exportData, importData } = require('./data-manager');
const { loadWindowState, saveWindowState } = require('./window-state');
const { createMenu } = require('./menu');
const { initAutoUpdater } = require('./updater');
const { launchIDE } = require('./ide-launcher');
const { checkOllamaRunning, installOllama, pullModel } = require('./ollama-setup');

let mainWindow = null;
let serverProcess = null;
let actualPort = null;
let dataDir = null;
let logDir = null;

/**
 * Finds a free port, trying the preferred port first
 * Returns { port, wasFallback, preferredPort }
 */
function findFreePort(preferredPort) {
  return new Promise((resolve) => {
    const server = net.createServer();

    // Try preferred port first
    server.listen(preferredPort, () => {
      const port = server.address().port;
      server.close(() => {
        resolve({ port, wasFallback: false, preferredPort });
      });
    });

    server.on('error', () => {
      // Preferred port is busy, get a random free port
      const fallbackServer = net.createServer();
      fallbackServer.listen(0, () => {
        const port = fallbackServer.address().port;
        fallbackServer.close(() => {
          resolve({ port, wasFallback: true, preferredPort });
        });
      });
    });
  });
}

/**
 * Reads the preferred port from config
 * Returns default 3000 if not configured
 */
function getPreferredPort() {
  try {
    const configPath = path.join(dataDir, '.cc-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const port = parseInt(config.preferredPort, 10);
      if (port >= 1024 && port <= 65535) {
        return port;
      }
    }
  } catch (err) {
    console.error('[Main] Error reading preferred port:', err);
  }
  return 3000; // Default
}

/**
 * Saves the preferred port to config
 */
function savePreferredPort(port) {
  try {
    const configPath = path.join(dataDir, '.cc-config.json');
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    config.preferredPort = port;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('[Main] Saved preferred port:', port);
  } catch (err) {
    console.error('[Main] Error saving preferred port:', err);
  }
}

/**
 * Reads the last active mode from config
 */
function getLastMode() {
  try {
    const configPath = path.join(dataDir, '.cc-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.lastActiveMode || 'chat';
    }
  } catch (err) {
    console.error('[Main] Error reading last mode:', err);
  }
  return 'chat'; // Default
}

/**
 * Saves the last active mode to config
 */
function saveLastMode(mode) {
  try {
    const configPath = path.join(dataDir, '.cc-config.json');
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    config.lastActiveMode = mode;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('[Main] Error saving last mode:', err);
  }
}

/**
 * Spawns the Express server as a child process
 */
function spawnServer(port) {
  return new Promise((resolve, reject) => {
    console.log(`[Main] Spawning server on port ${port}...`);

    // In packaged mode, asarUnpack puts server.js in app.asar.unpacked/
    let serverPath = path.join(__dirname, '..', 'server.js');
    if (app.isPackaged) {
      serverPath = serverPath.replace('app.asar', 'app.asar.unpacked');
    }
    console.log(`[Main] Server path: ${serverPath}`);
    const proc = fork(serverPath, [], {
      env: {
        ...process.env,
        PORT: String(port),
        CC_DATA_DIR: dataDir,
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    // Listen for IPC ready message
    proc.on('message', (msg) => {
      if (msg.type === 'server-ready') {
        console.log(`[Main] Server ready on port ${msg.port}`);
        resolve(proc);
      }
    });

    // Handle server crash
    proc.on('exit', (code, signal) => {
      if (code !== 0 && signal !== 'SIGTERM') {
        console.error(`[Main] Server crashed with code ${code}, signal ${signal}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'Server Stopped',
            message: 'The server stopped unexpectedly. Your data is safe.',
            buttons: ['View Logs', 'Restart Server', 'Quit'],
            defaultId: 1,
          }).then(({ response }) => {
            if (response === 0) {
              // View Logs
              shell.openPath(logDir);
            } else if (response === 1) {
              // Restart Server
              respawnServer();
            } else {
              // Quit
              app.quit();
            }
          });
        }
      }
    });

    proc.on('error', (err) => {
      console.error('[Main] Server process error:', err);
      reject(err);
    });

    // Pipe server stdout/stderr to console
    proc.stdout?.on('data', (data) => console.log('[Server]', data.toString().trim()));
    proc.stderr?.on('data', (data) => console.error('[Server Error]', data.toString().trim()));

    // Timeout after 30 seconds
    setTimeout(() => {
      if (proc && !proc.killed) {
        reject(new Error('Server failed to start within 30 seconds'));
      }
    }, 30000);
  });
}

/**
 * Respawns the server after a crash
 */
async function respawnServer() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');
  }

  try {
    const preferredPort = getPreferredPort();
    const { port, wasFallback } = await findFreePort(preferredPort);
    actualPort = port;

    serverProcess = await spawnServer(port);

    // Navigate to the new server
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(`http://localhost:${port}`);

      if (wasFallback) {
        mainWindow.webContents.send('port-fallback', {
          actual: port,
          preferred: preferredPort,
        });
      }
    }
  } catch (err) {
    console.error('[Main] Failed to respawn server:', err);
    dialog.showErrorBox('Failed to Restart', err.message);
  }
}

/**
 * Main application startup
 */
async function startApp() {
  // Resolve data directory and migrate legacy data
  dataDir = resolveDataDirectory();
  const appRoot = path.join(__dirname, '..');
  const migration = migrateDevData(dataDir, appRoot);
  if (migration.migrated) {
    console.log('[Main] Migration results:', migration.log);
  }

  // Set log directory (used for crash dialog)
  logDir = path.join(dataDir, 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Get preferred port and find free port
  const preferredPort = getPreferredPort();
  const { port, wasFallback } = await findFreePort(preferredPort);
  actualPort = port;

  console.log(`[Main] Using port ${actualPort} (preferred: ${preferredPort}, fallback: ${wasFallback})`);

  // Create splash window
  const windowState = loadWindowState(dataDir);
  mainWindow = new BrowserWindow({
    title: 'Code Companion — Vibe Coder Edition',
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 1024,
    minHeight: 768,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load splash screen first
  await mainWindow.loadFile(path.join(__dirname, 'splash.html'));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (windowState.isMaximized) {
      mainWindow.maximize();
    }
    mainWindow.show();
  });

  // Set application menu
  Menu.setApplicationMenu(createMenu());

  // Spawn server as child process
  try {
    serverProcess = await spawnServer(actualPort);

    // Navigate to the app once server is ready
    mainWindow.loadURL(`http://localhost:${actualPort}`);

    // If port was a fallback, notify renderer
    if (wasFallback) {
      mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('port-fallback', {
          actual: actualPort,
          preferred: preferredPort,
        });
      });
    }

    // Initialize auto-updater after window is ready
    initAutoUpdater(mainWindow, dataDir);
  } catch (err) {
    console.error('[Main] Failed to start server:', err);
    dialog.showErrorBox('Server Error', `Failed to start server: ${err.message}`);
    app.quit();
    return;
  }

  // Save window state on close
  mainWindow.on('close', () => {
    saveWindowState(mainWindow, dataDir);
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// App lifecycle
app.whenReady().then(startApp);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess && !serverProcess.killed) {
    console.log('[Main] Shutting down server...');
    serverProcess.kill('SIGTERM');

    // Force kill after 5 seconds
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        console.log('[Main] Force killing server...');
        serverProcess.kill('SIGKILL');
      }
    }, 5000);
  }
});

// IPC Handlers
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-data-dir', () => dataDir);

ipcMain.handle('export-data', async () => {
  try {
    const zipPath = await exportData(dataDir);
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Code Companion Data',
      defaultPath: path.basename(zipPath),
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    });

    if (filePath) {
      fs.copyFileSync(zipPath, filePath);
      // Clean up the temp backup
      fs.unlinkSync(zipPath);
      return { success: true, path: filePath };
    }

    // Clean up if user cancelled
    fs.unlinkSync(zipPath);
    return { success: false, cancelled: true };
  } catch (err) {
    console.error('[Main] Export error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('import-data', async () => {
  try {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Code Companion Data',
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      properties: ['openFile'],
    });

    if (filePaths && filePaths.length > 0) {
      const result = await importData(dataDir, filePaths[0]);
      return result;
    }

    return { success: false, cancelled: true };
  } catch (err) {
    console.error('[Main] Import error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-last-mode', () => getLastMode());
ipcMain.handle('set-last-mode', (event, mode) => {
  saveLastMode(mode);
  return { success: true };
});

ipcMain.handle('get-port-config', () => getPreferredPort());
ipcMain.handle('set-port-config', (event, port) => {
  const portNum = parseInt(port, 10);
  if (portNum >= 1024 && portNum <= 65535) {
    savePreferredPort(portNum);
    return { success: true };
  }
  return { success: false, error: 'Port must be between 1024 and 65535' };
});

ipcMain.handle('get-actual-port', () => actualPort);

ipcMain.handle('launch-ide', async (event, { ide, folder }) => {
  try {
    await launchIDE(ide, folder);
    return { success: true };
  } catch (error) {
    console.error('[Main] IDE launch error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-ollama', async (event, ollamaUrl) => {
  try {
    const url = ollamaUrl || 'http://localhost:11434';
    const result = await checkOllamaRunning(url);
    return result;
  } catch (error) {
    console.error('[Main] Check Ollama error:', error);
    return { running: false, models: [], error: error.message };
  }
});

ipcMain.handle('install-ollama', async (event) => {
  try {
    const result = await installOllama();
    return result;
  } catch (error) {
    console.error('[Main] Install Ollama error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('pull-model', async (event, { ollamaUrl, modelName }) => {
  try {
    const url = ollamaUrl || 'http://localhost:11434';
    const result = await pullModel(url, modelName, (progress) => {
      // Send progress updates to renderer
      event.sender.send('pull-progress', progress);
    });
    return result;
  } catch (error) {
    console.error('[Main] Pull model error:', error);
    return { success: false, error: error.message };
  }
});
