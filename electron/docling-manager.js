const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

const LOG_PREFIX = '[Docling]';

let doclingProcess = null;
let managedPort = null;

/**
 * Find the docling-serve binary on the system.
 * Checks common install locations for uv, pipx, and plain pip.
 * @returns {string|null} Path to docling-serve or null if not found
 */
function findDoclingServe() {
  // Try PATH first (works for pip install, uv tool install, pipx, etc.)
  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const result = execSync(`${which} docling-serve`, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (result) return result.split('\n')[0].trim();
  } catch {
    // not on PATH
  }

  // Check common uv/pipx tool locations
  const home = require('os').homedir();
  const candidates = [
    path.join(home, '.local', 'bin', 'docling-serve'),
    path.join(home, '.cargo', 'bin', 'docling-serve'), // uv uses cargo-style on some setups
  ];

  // uv tool bin directory (if UV_TOOL_BIN_DIR is set)
  if (process.env.UV_TOOL_BIN_DIR) {
    candidates.unshift(path.join(process.env.UV_TOOL_BIN_DIR, 'docling-serve'));
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
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, '127.0.0.1');
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
 * Read the docling config from .cc-config.json.
 * @param {string} dataDir
 * @returns {{ url: string, enabled: boolean }}
 */
function readDoclingConfig(dataDir) {
  const defaults = { url: 'http://127.0.0.1:5002', enabled: true };
  try {
    const configPath = path.join(dataDir, '.cc-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.docling) {
        return {
          url: config.docling.url || defaults.url,
          enabled: config.docling.enabled ?? defaults.enabled,
        };
      }
    }
  } catch {
    // fall through to defaults
  }
  return defaults;
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
      host: u.hostname || '127.0.0.1',
      port: parseInt(u.port, 10) || 5002,
    };
  } catch {
    return { host: '127.0.0.1', port: 5002 };
  }
}

/**
 * Start docling-serve as a managed child process.
 * No-ops if docling is disabled, not installed, or already running.
 *
 * @param {string} dataDir - App data directory (to read config)
 * @param {function} log - Logging function (e.g. emergencyLog)
 * @returns {Promise<{ managed: boolean, url: string, reason?: string }>}
 */
async function startDocling(dataDir, log = console.log) {
  const config = readDoclingConfig(dataDir);

  if (!config.enabled) {
    log(`${LOG_PREFIX} Document conversion is disabled in settings`);
    return { managed: false, url: config.url, reason: 'disabled' };
  }

  const { host, port } = parseHostPort(config.url);

  // Check if something is already running on the target port
  if (await isDoclingHealthy(config.url)) {
    log(`${LOG_PREFIX} Already running at ${config.url}`);
    return { managed: false, url: config.url, reason: 'already-running' };
  }

  // Find the binary
  const binaryPath = findDoclingServe();
  if (!binaryPath) {
    log(`${LOG_PREFIX} docling-serve not found on this system — document conversion will be unavailable`);
    log(`${LOG_PREFIX} Install with: uv tool install "docling-serve[ui]"  or  pip install "docling-serve[ui]"`);
    return { managed: false, url: config.url, reason: 'not-installed' };
  }

  log(`${LOG_PREFIX} Found binary at ${binaryPath}`);

  // Check if port is occupied by something else (not docling)
  if (await isPortInUse(port)) {
    log(`${LOG_PREFIX} Port ${port} is in use but not responding as docling — skipping auto-start`);
    return { managed: false, url: config.url, reason: 'port-conflict' };
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

    const proc = spawn(binaryPath, ['run', '--host', host, '--port', String(port)], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
      env: { ...process.env },
    });

    doclingProcess = proc;
    managedPort = port;

    proc.stdout?.on('data', (data) => {
      const line = data.toString().trim();
      if (line) console.log(`${LOG_PREFIX} ${line}`);
    });

    proc.stderr?.on('data', (data) => {
      const line = data.toString().trim();
      if (line) console.log(`${LOG_PREFIX} ${line}`);
    });

    proc.on('error', (err) => {
      log(`${LOG_PREFIX} Failed to start: ${err.message}`);
      doclingProcess = null;
      managedPort = null;
      resolveOnce({ managed: false, url: config.url, reason: 'spawn-error' });
    });

    proc.on('exit', (code, signal) => {
      if (signal !== 'SIGTERM' && signal !== 'SIGINT') {
        log(`${LOG_PREFIX} Process exited unexpectedly (code=${code}, signal=${signal})`);
      }
      doclingProcess = null;
      managedPort = null;
      resolveOnce({ managed: false, url: config.url, reason: 'process-died' });
    });

    // Poll for health — docling-serve takes a few seconds to start (model loading)
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds
    pollInterval = setInterval(async () => {
      attempts++;
      if (await isDoclingHealthy(config.url)) {
        log(`${LOG_PREFIX} Ready at ${config.url} (took ~${attempts}s)`);
        resolveOnce({ managed: true, url: config.url });
      } else if (attempts >= maxAttempts) {
        log(`${LOG_PREFIX} Did not become healthy within ${maxAttempts}s — may still be loading models`);
        // Don't kill it — it might still come up (EasyOCR model download can be slow)
        resolveOnce({ managed: true, url: config.url, reason: 'slow-start' });
      } else if (!doclingProcess || doclingProcess.killed) {
        resolveOnce({ managed: false, url: config.url, reason: 'process-died' });
      }
    }, 1000);
  });
}

/**
 * Stop the managed docling-serve process if we started one.
 * @param {function} log - Logging function
 */
function stopDocling(log = console.log) {
  if (!doclingProcess || doclingProcess.killed) return;

  log(`${LOG_PREFIX} Shutting down managed process...`);
  doclingProcess.kill('SIGTERM');

  // Force kill after 5 seconds
  const forceTimer = setTimeout(() => {
    if (doclingProcess && !doclingProcess.killed) {
      log(`${LOG_PREFIX} Force killing process...`);
      doclingProcess.kill('SIGKILL');
    }
  }, 5000);

  doclingProcess.once('exit', () => clearTimeout(forceTimer));
}

/**
 * Get the current status of the managed docling instance.
 * @returns {{ managed: boolean, running: boolean, port: number|null }}
 */
function getDoclingStatus() {
  return {
    managed: doclingProcess != null && !doclingProcess.killed,
    running: doclingProcess != null && !doclingProcess.killed,
    port: managedPort,
  };
}

module.exports = {
  findDoclingServe,
  startDocling,
  stopDocling,
  getDoclingStatus,
};
