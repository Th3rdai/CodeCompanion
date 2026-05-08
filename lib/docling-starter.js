/**
 * Docling-serve auto-start for web server (non-Electron).
 * Spawns docling-serve as a background process on server startup.
 */

const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const net = require("net");

const LOG_PREFIX = "[Docling]";

let doclingProcess = null;
let managedPort = null;
// Set when the launcher process exits but a worker (uvicorn child) takes over the
// listening socket. Lets stopDocling() shut the worker down even though Node has
// lost its child handle.
let adoptedWorkerPid = null;

/**
 * Find the PID listening on a TCP port (POSIX only — Windows fallback is `null`).
 */
function findListeningPid(port) {
  if (process.platform === "win32") return null;
  try {
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      encoding: "utf8",
      timeout: 2000,
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    if (!out) return null;
    const pid = parseInt(out.split("\n")[0], 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

/**
 * Find the docling-serve binary on the system.
 * Checks common install locations for uv, pipx, and plain pip.
 * @returns {string|null} Path to docling-serve or null if not found
 */
function findDoclingServe() {
  // Try PATH first (works for pip install, uv tool install, pipx, etc.)
  try {
    const which = process.platform === "win32" ? "where" : "which";
    const result = execSync(`${which} docling-serve`, {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (result) return result.split("\n")[0].trim();
  } catch {
    // not on PATH
  }

  // Check common uv/pipx tool locations
  const home = require("os").homedir();
  const candidates = [
    path.join(home, ".local", "bin", "docling-serve"),
    path.join(home, ".cargo", "bin", "docling-serve"), // uv uses cargo-style on some setups
  ];

  // uv tool bin directory (if UV_TOOL_BIN_DIR is set)
  if (process.env.UV_TOOL_BIN_DIR) {
    candidates.unshift(path.join(process.env.UV_TOOL_BIN_DIR, "docling-serve"));
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      }
    } catch {
      // not executable or not found
    }
  }

  return null;
}

/**
 * Check if a port is already in use.
 * @param {number} port
 * @returns {Promise<boolean>} true if port is in use
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(port, "127.0.0.1");
  });
}

/**
 * Check if docling-serve is already responding on the given URL.
 * @param {string} url - e.g. http://127.0.0.1:5002
 * @returns {Promise<boolean>}
 */
async function isDoclingHealthy(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Parse host and port from a URL string.
 * @param {string} url
 * @returns {{ host: string, port: number }}
 */
function parseHostPort(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname || "127.0.0.1",
      port: parseInt(u.port, 10) || 5002,
    };
  } catch {
    return { host: "127.0.0.1", port: 5002 };
  }
}

/**
 * Start docling-serve as a managed child process.
 * No-ops if docling is disabled, not installed, or already running.
 *
 * @param {object} config - Config object with docling settings
 * @param {function} log - Logging function
 * @returns {Promise<{ managed: boolean, url: string, reason?: string }>}
 */
async function startDocling(config, log = console.log) {
  const doclingConfig = config.docling || {};
  const url = doclingConfig.url || "http://127.0.0.1:5002";
  const enabled = doclingConfig.enabled !== false; // default to true

  if (!enabled) {
    log(`${LOG_PREFIX} Document conversion is disabled in settings`);
    return { managed: false, url, reason: "disabled" };
  }

  const { host, port } = parseHostPort(url);

  // Check if something is already running on the target port
  if (await isDoclingHealthy(url)) {
    log(`${LOG_PREFIX} Already running at ${url}`);
    return { managed: false, url, reason: "already-running" };
  }

  // Find the binary
  const binaryPath = findDoclingServe();
  if (!binaryPath) {
    log(
      `${LOG_PREFIX} docling-serve not found — document conversion will be unavailable`,
    );
    log(
      `${LOG_PREFIX} Install with: uv tool install "docling-serve[ui]"  or  pip install "docling-serve[ui]"`,
    );
    return { managed: false, url, reason: "not-installed" };
  }

  log(`${LOG_PREFIX} Found binary at ${binaryPath}`);

  // Check if port is occupied by something else (not docling)
  if (await isPortInUse(port)) {
    log(
      `${LOG_PREFIX} Port ${port} is in use but not responding as docling — skipping auto-start`,
    );
    return { managed: false, url, reason: "port-conflict" };
  }

  // Spawn docling-serve
  log(`${LOG_PREFIX} Starting on ${host}:${port}...`);

  return new Promise((resolve) => {
    let pollInterval = null;
    let settled = false;
    const resolveOnce = (result) => {
      if (settled) return;
      settled = true;
      if (pollInterval) clearInterval(pollInterval);
      resolve(result);
    };

    const proc = spawn(
      binaryPath,
      ["run", "--host", host, "--port", String(port)],
      {
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
        env: { ...process.env },
      },
    );

    doclingProcess = proc;
    managedPort = port;

    proc.stdout?.on("data", (data) => {
      const line = data.toString().trim();
      if (line) console.log(`${LOG_PREFIX} ${line}`);
    });

    proc.stderr?.on("data", (data) => {
      const line = data.toString().trim();
      if (line) console.log(`${LOG_PREFIX} ${line}`);
    });

    proc.on("error", (err) => {
      log(`${LOG_PREFIX} Failed to start: ${err.message}`);
      doclingProcess = null;
      managedPort = null;
      resolveOnce({ managed: false, url, reason: "spawn-error" });
    });

    proc.on("exit", async (code, signal) => {
      // docling-serve is a Python launcher that delegates to uvicorn. Under
      // some setups the launcher exits with code=1 once a worker takes over
      // the listening socket. Verify the service is still healthy before
      // declaring an unexpected death.
      const stillHealthy = await isDoclingHealthy(url);
      if (stillHealthy) {
        const workerPid = findListeningPid(port);
        if (workerPid) {
          adoptedWorkerPid = workerPid;
          log(
            `${LOG_PREFIX} Launcher exited (code=${code}); worker on port ${port} still healthy (PID ${workerPid} adopted for shutdown)`,
          );
        } else {
          log(
            `${LOG_PREFIX} Launcher exited (code=${code}); worker on port ${port} still healthy (PID unknown — shutdown will not signal it)`,
          );
        }
        doclingProcess = null;
        return;
      }
      if (signal !== "SIGTERM" && signal !== "SIGINT") {
        log(
          `${LOG_PREFIX} Process exited unexpectedly (code=${code}, signal=${signal})`,
        );
      }
      doclingProcess = null;
      managedPort = null;
      adoptedWorkerPid = null;
    });

    // Poll for health — docling-serve takes a few seconds to start (model loading)
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds
    pollInterval = setInterval(async () => {
      attempts++;
      if (await isDoclingHealthy(url)) {
        log(`${LOG_PREFIX} Ready at ${url} (took ~${attempts}s)`);
        resolveOnce({ managed: true, url });
      } else if (attempts >= maxAttempts) {
        log(
          `${LOG_PREFIX} Did not become healthy within ${maxAttempts}s — may still be loading models`,
        );
        // Don't kill it — it might still come up (EasyOCR model download can be slow)
        resolveOnce({ managed: true, url, reason: "slow-start" });
      } else if (!doclingProcess || doclingProcess.killed) {
        resolveOnce({ managed: false, url, reason: "process-died" });
      }
    }, 1000);
  });
}

/**
 * Stop the managed docling-serve process if we started one.
 * @param {function} log - Logging function
 */
function stopDocling(log = console.log) {
  if (doclingProcess && !doclingProcess.killed) {
    log(`${LOG_PREFIX} Shutting down managed process...`);
    doclingProcess.kill("SIGTERM");
    const forceTimer = setTimeout(() => {
      if (doclingProcess && !doclingProcess.killed) {
        log(`${LOG_PREFIX} Force killing process...`);
        doclingProcess.kill("SIGKILL");
      }
    }, 5000);
    doclingProcess.once("exit", () => clearTimeout(forceTimer));
    return;
  }

  // Launcher already exited but a worker took over (uvicorn handoff pattern).
  if (adoptedWorkerPid) {
    const pid = adoptedWorkerPid;
    log(`${LOG_PREFIX} Shutting down adopted worker PID ${pid}...`);
    try {
      process.kill(pid, "SIGTERM");
    } catch (err) {
      if (err.code !== "ESRCH") {
        log(`${LOG_PREFIX} Failed to SIGTERM worker ${pid}: ${err.message}`);
      }
    }
    setTimeout(() => {
      try {
        process.kill(pid, 0);
        log(`${LOG_PREFIX} Force killing worker PID ${pid}...`);
        process.kill(pid, "SIGKILL");
      } catch {
        // already gone
      }
    }, 5000);
    adoptedWorkerPid = null;
    managedPort = null;
  }
}

/**
 * Get the current status of the managed docling instance.
 * @returns {{ managed: boolean, running: boolean, port: number|null }}
 */
function getDoclingStatus() {
  const live =
    (doclingProcess != null && !doclingProcess.killed) ||
    adoptedWorkerPid != null;
  return {
    managed: live,
    running: live,
    port: managedPort,
  };
}

module.exports = {
  startDocling,
  stopDocling,
  getDoclingStatus,
};
