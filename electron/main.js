const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Menu,
  systemPreferences,
} = require("electron");
const { fork } = require("child_process");
const path = require("path");
const fs = require("fs");
// Repo-root .env — loaded before fork(server) so secrets apply to MCP, Ollama, Docling, etc.
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const net = require("net");

// Create emergency log file for debugging startup issues
// Defer app.getPath() — not safe before app 'ready' in Electron 41+
let emergencyLogPath;
function getEmergencyLogPath() {
  if (!emergencyLogPath) {
    try {
      emergencyLogPath = path.join(
        app.getPath("temp"),
        "code-companion-startup.log",
      );
    } catch {
      emergencyLogPath = path.join(
        require("os").tmpdir(),
        "code-companion-startup.log",
      );
    }
  }
  return emergencyLogPath;
}
function emergencyLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(getEmergencyLogPath(), logMessage);
    console.log(message);
  } catch (err) {
    console.error("Failed to write emergency log:", err);
  }
}

// Log startup
emergencyLog("=== Code Companion Starting ===");
emergencyLog(`Platform: ${process.platform}`);
emergencyLog(`Arch: ${process.arch}`);
emergencyLog(`Node: ${process.version}`);
emergencyLog(`Electron: ${process.versions.electron}`);
try {
  emergencyLog(`App Path: ${app.getAppPath()}`);
} catch {
  emergencyLog("App Path: (not yet available)");
}
try {
  emergencyLog(`EXE Path: ${app.getPath("exe")}`);
} catch {
  emergencyLog("EXE Path: (not yet available)");
}
try {
  emergencyLog(`Packaged: ${app.isPackaged}`);
} catch {
  emergencyLog("Packaged: (not yet available)");
}

// Catch all uncaught exceptions
process.on("uncaughtException", (error) => {
  emergencyLog(`UNCAUGHT EXCEPTION: ${error.message}`);
  emergencyLog(`Stack: ${error.stack}`);
  dialog.showErrorBox(
    "Startup Error",
    `${error.message}\n\nLog: ${getEmergencyLogPath()}`,
  );
  app.quit();
});

// Wrap all requires in try-catch
let resolveDataDirectory,
  migrateDevData,
  mergeDevMcpClientsFromRoot,
  exportData,
  importData;
let loadWindowState, saveWindowState;
let createMenu;
let initAutoUpdater;
let launchIDE;
let checkOllamaRunning, installOllama, pullModel;

try {
  emergencyLog("Loading data-manager...");
  ({
    resolveDataDirectory,
    migrateDevData,
    mergeDevMcpClientsFromRoot,
    exportData,
    importData,
  } = require("./data-manager"));
  emergencyLog("✓ data-manager loaded");
} catch (err) {
  emergencyLog(`✗ data-manager failed: ${err.message}`);
  throw err;
}

try {
  emergencyLog("Loading window-state...");
  ({ loadWindowState, saveWindowState } = require("./window-state"));
  emergencyLog("✓ window-state loaded");
} catch (err) {
  emergencyLog(`✗ window-state failed: ${err.message}`);
  throw err;
}

try {
  emergencyLog("Loading menu...");
  ({ createMenu } = require("./menu"));
  emergencyLog("✓ menu loaded");
} catch (err) {
  emergencyLog(`✗ menu failed: ${err.message}`);
  throw err;
}

try {
  emergencyLog("Loading updater...");
  ({ initAutoUpdater } = require("./updater"));
  emergencyLog("✓ updater loaded");
} catch (err) {
  emergencyLog(`✗ updater failed: ${err.message}`);
  throw err;
}

try {
  emergencyLog("Loading ide-launcher...");
  ({ launchIDE } = require("./ide-launcher"));
  emergencyLog("✓ ide-launcher loaded");
} catch (err) {
  emergencyLog(`✗ ide-launcher failed: ${err.message}`);
  throw err;
}

try {
  emergencyLog("Loading ollama-setup...");
  ({
    checkOllamaRunning,
    installOllama,
    pullModel,
  } = require("./ollama-setup"));
  emergencyLog("✓ ollama-setup loaded");
} catch (err) {
  emergencyLog(`✗ ollama-setup failed: ${err.message}`);
  throw err;
}

let startDocling, stopDocling, getDoclingStatus;
try {
  emergencyLog("Loading docling-manager...");
  ({
    startDocling,
    stopDocling,
    getDoclingStatus,
  } = require("./docling-manager"));
  emergencyLog("✓ docling-manager loaded");
} catch (err) {
  emergencyLog(`✗ docling-manager failed: ${err.message}`);
  throw err;
}

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

    // Bind to the same host the Express server will use (0.0.0.0)
    // to avoid false-positive "free" results from IPv4/IPv6 mismatches
    server.listen(preferredPort, "0.0.0.0", () => {
      const port = server.address().port;
      server.close(() => {
        resolve({ port, wasFallback: false, preferredPort });
      });
    });

    server.on("error", (err) => {
      emergencyLog(
        `[findFreePort] Port ${preferredPort} unavailable: ${err.code || err.message}`,
      );
      // Preferred port is busy, get a random free port
      const fallbackServer = net.createServer();
      fallbackServer.listen(0, "0.0.0.0", () => {
        const port = fallbackServer.address().port;
        emergencyLog(`[findFreePort] Using fallback port ${port}`);
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
    const configPath = path.join(dataDir, ".cc-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      const port = parseInt(config.preferredPort, 10);
      if (port >= 1024 && port <= 65535) {
        return port;
      }
    }
  } catch (err) {
    console.error("[Main] Error reading preferred port:", err);
  }
  return 8900; // Default
}

/**
 * Saves the preferred port to config
 */
function savePreferredPort(port) {
  try {
    const configPath = path.join(dataDir, ".cc-config.json");
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
    config.preferredPort = port;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("[Main] Saved preferred port:", port);
  } catch (err) {
    console.error("[Main] Error saving preferred port:", err);
  }
}

/**
 * Reads the last active mode from config
 */
function getLastMode() {
  try {
    const configPath = path.join(dataDir, ".cc-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      return config.lastActiveMode || "chat";
    }
  } catch (err) {
    console.error("[Main] Error reading last mode:", err);
  }
  return "chat"; // Default
}

/**
 * Saves the last active mode to config
 */
function saveLastMode(mode) {
  try {
    const configPath = path.join(dataDir, ".cc-config.json");
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
    config.lastActiveMode = mode;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error("[Main] Error saving last mode:", err);
  }
}

/**
 * Spawns the Express server as a child process
 */
function spawnServer(port) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let startupTimeout;

    emergencyLog(`[spawnServer] Starting on port ${port}...`);

    // In packaged mode, asarUnpack puts server.js in app.asar.unpacked/
    let serverPath = path.join(__dirname, "..", "server.js");
    emergencyLog(`[spawnServer] Initial path: ${serverPath}`);
    if (app.isPackaged) {
      serverPath = serverPath.replace("app.asar", "app.asar.unpacked");
      emergencyLog(`[spawnServer] Adjusted for asar: ${serverPath}`);
    }

    // Check if server.js exists
    if (!fs.existsSync(serverPath)) {
      const error = new Error(`server.js not found at: ${serverPath}`);
      emergencyLog(`[spawnServer] ERROR: ${error.message}`);
      reject(error);
      return;
    }
    emergencyLog(`[spawnServer] ✓ server.js found at: ${serverPath}`);

    emergencyLog(`[spawnServer] Forking process...`);
    emergencyLog(`[spawnServer] CC_DATA_DIR=${dataDir}`);
    const proc = fork(serverPath, [], {
      env: {
        ...process.env,
        PORT: String(port),
        CC_DATA_DIR: dataDir,
      },
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    });

    function settle(type, value) {
      if (settled) return;
      settled = true;
      clearTimeout(startupTimeout);
      if (type === "resolve") resolve(value);
      else reject(value);
    }

    // Listen for IPC ready message
    proc.on("message", (msg) => {
      if (msg.type === "server-ready") {
        emergencyLog(`[spawnServer] Server ready on port ${msg.port}`);
        settle("resolve", proc);
      }
    });

    // Handle server crash — log to emergency log and reject immediately
    proc.on("exit", (code, signal) => {
      emergencyLog(
        `[spawnServer] Server exited: code=${code}, signal=${signal}`,
      );
      if (code !== 0 && signal !== "SIGTERM") {
        // During startup, reject the promise so the error surfaces immediately
        settle(
          "reject",
          new Error(
            `Server crashed on startup (code=${code}, signal=${signal}). Check ${getEmergencyLogPath()} for [Server] output above.`,
          ),
        );
        if (mainWindow && !mainWindow.isDestroyed()) {
          dialog
            .showMessageBox(mainWindow, {
              type: "error",
              title: "Server Stopped",
              message: "The server stopped unexpectedly. Your data is safe.",
              buttons: ["View Logs", "Restart Server", "Quit"],
              defaultId: 1,
            })
            .then(({ response }) => {
              if (response === 0) {
                shell.openPath(logDir || getEmergencyLogPath());
              } else if (response === 1) {
                respawnServer();
              } else {
                app.quit();
              }
            });
        }
      } else {
        // Even a clean exit during startup is unexpected
        settle(
          "reject",
          new Error(
            `Server exited unexpectedly during startup (code=${code}, signal=${signal})`,
          ),
        );
      }
    });

    proc.on("error", (err) => {
      emergencyLog(`[spawnServer] Fork error: ${err.message}`);
      settle("reject", err);
    });

    // Pipe server stdout/stderr to emergency log so they're visible in packaged builds
    proc.stdout?.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg) emergencyLog(`[Server] ${msg}`);
    });
    proc.stderr?.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg) emergencyLog(`[Server Error] ${msg}`);
    });

    // Timeout after 30 seconds
    startupTimeout = setTimeout(() => {
      settle("reject", new Error("Server failed to start within 30 seconds"));
    }, 30000);
  });
}

/**
 * Respawns the server after a crash
 */
async function respawnServer() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
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
        mainWindow.webContents.send("port-fallback", {
          actual: port,
          preferred: preferredPort,
        });
      }
    }
  } catch (err) {
    console.error("[Main] Failed to respawn server:", err);
    dialog.showErrorBox("Failed to Restart", err.message);
  }
}

/**
 * Main application startup
 */
async function startApp() {
  try {
    emergencyLog("startApp() called");

    // Resolve data directory and migrate legacy data
    emergencyLog("Resolving data directory...");
    dataDir = resolveDataDirectory();
    emergencyLog(`Data directory: ${dataDir}`);

    const dataEnvPath = path.join(dataDir, ".env");
    if (fs.existsSync(dataEnvPath)) {
      require("dotenv").config({ path: dataEnvPath, override: true });
      emergencyLog(
        `Loaded data-dir .env (overrides repo .env): ${dataEnvPath}`,
      );
    }

    const appRoot = path.join(__dirname, "..");
    emergencyLog(`App root: ${appRoot}`);

    emergencyLog("Migrating dev data...");
    const migration = migrateDevData(dataDir, appRoot);
    if (migration.migrated) {
      emergencyLog(
        `[Main] Migration results: ${JSON.stringify(migration.log)}`,
      );
    }

    if (!app.isPackaged) {
      const mcpMerge = mergeDevMcpClientsFromRoot(dataDir, appRoot, {
        isDev: true,
      });
      if (mcpMerge.merged) {
        emergencyLog(
          `[Main] Synced ${mcpMerge.count} MCP client(s) from repo .cc-config.json into data directory`,
        );
      }
    }

    // Set log directory (used for crash dialog)
    logDir = path.join(dataDir, "logs");
    emergencyLog(`Log directory: ${logDir}`);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Get preferred port and find free port
    emergencyLog("Getting preferred port...");
    const preferredPort = getPreferredPort();
    emergencyLog(`Preferred port: ${preferredPort}`);

    emergencyLog("Finding free port...");
    const { port, wasFallback } = await findFreePort(preferredPort);
    actualPort = port;
    emergencyLog(
      `Using port ${actualPort} (preferred: ${preferredPort}, fallback: ${wasFallback})`,
    );

    // Create splash window
    emergencyLog("Loading window state...");
    const windowState = loadWindowState(dataDir);
    emergencyLog(`Window state: ${JSON.stringify(windowState)}`);

    emergencyLog("Creating BrowserWindow...");
    mainWindow = new BrowserWindow({
      title: "Code Companion — Vibe Coder Edition",
      width: windowState.width,
      height: windowState.height,
      x: windowState.x,
      y: windowState.y,
      minWidth: 1024,
      minHeight: 768,
      backgroundColor: "#0f172a",
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    emergencyLog("BrowserWindow created successfully");

    // Load splash screen first
    const splashPath = path.join(__dirname, "splash.html");
    emergencyLog(`Loading splash screen from: ${splashPath}`);
    await mainWindow.loadFile(splashPath);
    emergencyLog("Splash screen loaded");

    // Show window when ready
    mainWindow.once("ready-to-show", () => {
      emergencyLog("Window ready-to-show");
      if (windowState.isMaximized) {
        mainWindow.maximize();
      }
      mainWindow.show();
    });

    // Set application menu
    emergencyLog("Creating application menu...");
    Menu.setApplicationMenu(
      createMenu({
        reloadAppHome: () => {
          if (mainWindow && !mainWindow.isDestroyed() && actualPort != null) {
            mainWindow.loadURL(`http://localhost:${actualPort}`);
          }
        },
      }),
    );
    emergencyLog("Menu set");

    // Spawn server as child process
    emergencyLog("Spawning server...");
    try {
      serverProcess = await spawnServer(actualPort);
      emergencyLog("Server spawned successfully");

      // Navigate to the app once server is ready
      mainWindow.loadURL(`http://localhost:${actualPort}`);

      // If port was a fallback, notify renderer
      if (wasFallback) {
        mainWindow.webContents.on("did-finish-load", () => {
          mainWindow.webContents.send("port-fallback", {
            actual: actualPort,
            preferred: preferredPort,
          });
        });
      }

      // Start docling-serve in background (non-blocking — don't delay app startup)
      emergencyLog("Starting docling-serve...");
      startDocling(dataDir, emergencyLog)
        .then((result) => {
          if (result.managed) {
            emergencyLog(`Docling managed by app at ${result.url}`);
          } else {
            emergencyLog(`Docling not managed: ${result.reason}`);
          }
        })
        .catch((err) => {
          emergencyLog(`Docling start error (non-fatal): ${err.message}`);
        });

      // Initialize auto-updater after window is ready
      emergencyLog("Initializing auto-updater...");
      initAutoUpdater(mainWindow, dataDir);
      emergencyLog("Auto-updater initialized");
    } catch (err) {
      emergencyLog(`SERVER START ERROR: ${err.message}`);
      emergencyLog(`Stack: ${err.stack}`);
      console.error("[Main] Failed to start server:", err);
      dialog.showErrorBox(
        "Server Error",
        `Failed to start server: ${err.message}\n\nLog: ${getEmergencyLogPath()}`,
      );
      app.quit();
      return;
    }

    // Save window state on close
    mainWindow.on("close", () => {
      saveWindowState(mainWindow, dataDir);
    });

    // Open target=_blank / window.open in the system browser (new Electron window denied)
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });

    // Same-window navigations (e.g. <a href="https://..."> without target=_blank) would otherwise
    // replace the SPA with no way back. Keep only the local app origin; everything else opens
    // in the default browser.
    function isMainWindowAppUrl(urlString) {
      if (!urlString || actualPort == null) return false;
      try {
        const u = new URL(urlString);
        if (u.protocol === "file:") return true; // splash.html
        if (u.protocol !== "http:" && u.protocol !== "https:") return false;
        const host = u.hostname;
        if (host !== "localhost" && host !== "127.0.0.1") return false;
        const effectivePort =
          u.port || (u.protocol === "https:" ? "443" : "80");
        return String(actualPort) === effectivePort;
      } catch {
        return false;
      }
    }

    mainWindow.webContents.on("will-navigate", (event, url) => {
      if (isMainWindowAppUrl(url)) return;
      if (/^mailto:/i.test(url) || /^tel:/i.test(url)) {
        event.preventDefault();
        shell.openExternal(url);
        return;
      }
      if (/^https?:\/\//i.test(url)) {
        event.preventDefault();
        shell.openExternal(url).catch((err) => {
          console.error("[Main] openExternal failed:", err.message);
        });
      }
    });

    emergencyLog("=== Startup complete ===");
  } catch (error) {
    emergencyLog(`STARTUP ERROR: ${error.message}`);
    emergencyLog(`Stack: ${error.stack}`);
    dialog.showErrorBox(
      "Startup Failed",
      `Failed to start Code Companion:\n\n${error.message}\n\nLog file: ${emergencyLogPath}`,
    );
    app.quit();
  }
}

// App lifecycle
app.whenReady().then(() => {
  emergencyLog("App ready event fired");
  startApp().catch((err) => {
    emergencyLog(`startApp() rejected: ${err.message}`);
    emergencyLog(`Stack: ${err.stack}`);
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  // Shut down managed docling-serve
  stopDocling(console.log);

  if (serverProcess && !serverProcess.killed) {
    console.log("[Main] Shutting down server...");
    serverProcess.kill("SIGTERM");

    // Force kill after 5 seconds
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        console.log("[Main] Force killing server...");
        serverProcess.kill("SIGKILL");
      }
    }, 5000);
  }
});

// IPC Handlers
ipcMain.handle("get-app-version", () => app.getVersion());
ipcMain.handle("get-is-packaged", () => app.isPackaged);
ipcMain.handle("get-data-dir", () => dataDir);

ipcMain.handle("open-external-url", async (event, url) => {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) {
    return { success: false, error: "Invalid URL" };
  }
  try {
    await shell.openExternal(url.trim());
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("export-data", async () => {
  try {
    const zipPath = await exportData(dataDir);
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Export Code Companion Data",
      defaultPath: path.basename(zipPath),
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
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
    console.error("[Main] Export error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("import-data", async () => {
  try {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: "Import Code Companion Data",
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
      properties: ["openFile"],
    });

    if (filePaths && filePaths.length > 0) {
      const result = await importData(dataDir, filePaths[0]);
      return result;
    }

    return { success: false, cancelled: true };
  } catch (err) {
    console.error("[Main] Import error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("get-last-mode", () => getLastMode());
ipcMain.handle("set-last-mode", (event, mode) => {
  saveLastMode(mode);
  return { success: true };
});

ipcMain.handle("get-port-config", () => getPreferredPort());
ipcMain.handle("set-port-config", (event, port) => {
  const portNum = parseInt(port, 10);
  if (portNum >= 1024 && portNum <= 65535) {
    savePreferredPort(portNum);
    return { success: true };
  }
  return { success: false, error: "Port must be between 1024 and 65535" };
});

ipcMain.handle("get-actual-port", () => actualPort);

ipcMain.handle("launch-ide", async (event, { ide, folder }) => {
  try {
    await launchIDE(ide, folder);
    return { success: true };
  } catch (error) {
    console.error("[Main] IDE launch error:", error);
    return { success: false, error: error.message };
  }
});

// Folder picker (native OS dialog)
ipcMain.handle("pick-folder", async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: "Choose Project Folder",
    properties: ["openDirectory"],
  });
  return filePaths?.[0] || null;
});

// Microphone permission (macOS)
ipcMain.handle("get-microphone-access-status", () => {
  if (process.platform === "darwin") {
    return systemPreferences.getMediaAccessStatus("microphone");
  }
  return "granted"; // Non-macOS platforms don't gate mic access this way
});

ipcMain.handle("request-microphone-access", async () => {
  if (process.platform === "darwin") {
    const granted = await systemPreferences.askForMediaAccess("microphone");
    return granted ? "granted" : "denied";
  }
  return "granted";
});

// Docling status
ipcMain.handle("get-docling-status", () => getDoclingStatus());

ipcMain.handle("check-ollama", async (event, payload) => {
  try {
    const url =
      (typeof payload === "string" ? payload : payload?.ollamaUrl) ||
      "http://localhost:11434";
    const apiKey =
      typeof payload === "object" && payload ? payload.ollamaApiKey : undefined;
    const result = await checkOllamaRunning(url, apiKey);
    return result;
  } catch (error) {
    console.error("[Main] Check Ollama error:", error);
    return { running: false, models: [], error: error.message };
  }
});

ipcMain.handle("install-ollama", async (event) => {
  try {
    const result = await installOllama();
    return result;
  } catch (error) {
    console.error("[Main] Install Ollama error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "pull-model",
  async (event, { ollamaUrl, modelName, ollamaApiKey }) => {
    try {
      const url = ollamaUrl || "http://localhost:11434";
      const result = await pullModel(
        url,
        modelName,
        (progress) => {
          // Send progress updates to renderer
          event.sender.send("pull-progress", progress);
        },
        ollamaApiKey,
      );
      return result;
    } catch (error) {
      console.error("[Main] Pull model error:", error);
      return { success: false, error: error.message };
    }
  },
);
