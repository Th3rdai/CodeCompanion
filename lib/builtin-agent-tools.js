/**
 * Built-in agent tools — executed locally without MCP transport.
 * Currently provides: run_terminal_cmd
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const LOG_PREFIX = '[TERMINAL]';

// ── Intra-request rate limit for terminal commands ──
const _cmdRateMap = new Map(); // key → { count, windowStart }
const CMD_RATE_LIMIT = 20;     // max commands
const CMD_RATE_WINDOW = 60000; // per 60 seconds

function checkCmdRateLimit(clientKey) {
  const now = Date.now();
  let entry = _cmdRateMap.get(clientKey);
  if (!entry || now - entry.windowStart > CMD_RATE_WINDOW) {
    entry = { count: 0, windowStart: now };
    _cmdRateMap.set(clientKey, entry);
  }
  entry.count++;
  if (entry.count > CMD_RATE_LIMIT) {
    return { allowed: false, reason: `Terminal rate limit exceeded (${CMD_RATE_LIMIT} commands per minute). Wait and try again.` };
  }
  return { allowed: true };
}

// Cleanup stale entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of _cmdRateMap) {
    if (now - entry.windowStart > CMD_RATE_WINDOW * 2) _cmdRateMap.delete(key);
  }
}, 300000).unref();

// ── ANSI escape code stripper ─────────────────────
function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

// ── Environment variable whitelist ────────────────
function getWhitelistedEnv() {
  const safe = {};
  const ALLOW = [
    'PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'LC_ALL', 'TERM',
    'NODE_ENV', 'GOPATH', 'GOROOT', 'CARGO_HOME', 'RUSTUP_HOME',
    'PYTHON', 'PYTHONPATH', 'VIRTUAL_ENV', 'CONDA_DEFAULT_ENV',
    'npm_config_registry', 'EDITOR',
    'TMPDIR', 'TMP', 'TEMP',
  ];
  for (const key of ALLOW) {
    if (process.env[key]) safe[key] = process.env[key];
  }
  return safe;
}

// ── Security: validate command against allowlist/blocklist ──

const METACHAR_PATTERN = /[;|`]|\$\(|>&|>>|<</;

function validateCommand(command, args, config) {
  const terminal = config.agentTerminal || {};

  // Master switch
  if (!terminal.enabled) {
    return { allowed: false, reason: 'Agent terminal is disabled. Enable it in Settings → General.' };
  }

  // Project folder required
  if (!config.projectFolder) {
    return { allowed: false, reason: 'Set a project folder in Settings to use the agent terminal.' };
  }

  // Normalize command basename (strip .cmd/.exe for Windows compat)
  const basename = path.basename(command).replace(/\.(cmd|exe|bat)$/i, '').toLowerCase();

  // Allowlist check (empty = deny all)
  const allowlist = (terminal.allowlist || []).map(c => c.toLowerCase());
  if (allowlist.length === 0) {
    return { allowed: false, reason: `No commands allowed. Add commands to the allowlist in Settings → Agent Terminal.` };
  }
  if (!allowlist.includes(basename)) {
    return { allowed: false, reason: `Command "${basename}" is not in the allowlist. Allowed: ${allowlist.join(', ')}` };
  }

  // Blocklist check on command
  const blocklist = terminal.blocklist || [];
  const fullCmd = [command, ...args].join(' ');
  for (const blocked of blocklist) {
    if (fullCmd.toLowerCase().includes(blocked.toLowerCase())) {
      return { allowed: false, reason: `Command blocked by security policy: "${blocked}"` };
    }
  }

  // Shell metacharacter check on each arg
  for (const arg of args) {
    if (METACHAR_PATTERN.test(arg)) {
      return { allowed: false, reason: `Shell metacharacters detected in argument: "${arg}"` };
    }
  }

  return { allowed: true };
}

// ── Security: validate working directory ──────────

function validateCwd(cwd, projectFolder) {
  if (!projectFolder) {
    return { valid: false, reason: 'No project folder configured' };
  }

  try {
    const resolvedProject = fs.realpathSync(path.resolve(projectFolder));
    const resolvedCwd = fs.realpathSync(path.resolve(cwd));

    if (resolvedCwd !== resolvedProject && !resolvedCwd.startsWith(resolvedProject + path.sep)) {
      return { valid: false, reason: `Working directory "${cwd}" is outside the project folder` };
    }

    return { valid: true, resolved: resolvedCwd };
  } catch (err) {
    return { valid: false, reason: `Path does not exist or is not accessible: ${err.message}` };
  }
}

// ── Tool definitions ──────────────────────────────

const BUILTIN_TOOLS = [
  {
    name: 'run_terminal_cmd',
    description: 'Run a terminal command in the project folder. Args: {"command": "npm", "args": ["test"], "cwd": "(optional subdirectory)", "timeoutMs": 60000}. Returns stdout/stderr and exit code.',
  },
];

/**
 * Get the list of enabled builtin tools for prompt injection.
 * @param {object} config - App config from getConfig()
 * @returns {Array<{serverId: string, name: string, description: string}>}
 */
function getBuiltinTools(config) {
  const terminal = config.agentTerminal || {};
  if (!terminal.enabled) return [];

  // Remote deployment guard: don't advertise tools on network-exposed servers
  // without explicit opt-in via CC_ALLOW_AGENT_TERMINAL=1
  const bindAddr = process.env.HOST || '0.0.0.0';
  const isExposedBind = (bindAddr === '0.0.0.0' || bindAddr === '::');
  if (isExposedBind && process.env.CC_ALLOW_AGENT_TERMINAL !== '1') {
    const isElectron = Boolean(process.env.ELECTRON_RUN_AS_NODE || process.versions?.electron);
    if (!isElectron) {
      return []; // Don't advertise terminal tools on exposed servers without explicit opt-in
    }
  }

  return BUILTIN_TOOLS.map(t => ({
    serverId: 'builtin',
    name: t.name,
    description: t.description,
  }));
}

/**
 * Get the safety preamble for builtin terminal tools.
 * This overrides the aggressive MCP "USE IT IMMEDIATELY" prompt.
 * @returns {string}
 */
function getBuiltinSafetyPreamble() {
  return `
TERMINAL TOOL SAFETY:
- In the SAME assistant message: briefly state what you will run and why, then emit TOOL_CALL.
- NEVER run destructive commands (rm, drop, truncate, mkfs, etc.) unless the user explicitly asked for that operation.
- If a command fails, explain the error — do not retry blindly with escalated privileges.
- Stay under the configured project folder — do not suggest paths outside it.
- Prefer read-only commands first (git status, ls, cat) before write operations.
`;
}

// ── Execute builtin tool ──────────────────────────

/**
 * Execute a builtin tool and return MCP-compatible result.
 * @param {string} toolName
 * @param {object} args - Parsed tool arguments
 * @param {object} config - App config
 * @param {function} log - Logger function
 * @param {string} [clientKey] - Optional client identifier for intra-request rate limiting
 * @returns {Promise<{success: boolean, result: {content: Array}}>}
 */
async function executeBuiltinTool(toolName, args, config, log, clientKey) {
  // Remote deployment guard (defense-in-depth — mirrors check in getBuiltinTools)
  const bindAddr = process.env.HOST || '0.0.0.0';
  const isExposedBind = (bindAddr === '0.0.0.0' || bindAddr === '::');
  const isElectron = Boolean(process.env.ELECTRON_RUN_AS_NODE || process.versions?.electron);
  if (isExposedBind && !isElectron && process.env.CC_ALLOW_AGENT_TERMINAL !== '1') {
    return {
      success: false,
      result: { content: [{ type: 'text', text: 'Agent terminal blocked: server is exposed to network. Set CC_ALLOW_AGENT_TERMINAL=1 env var to allow.' }] },
    };
  }

  // Intra-request rate limit check
  if (clientKey) {
    const rateCheck = checkCmdRateLimit(clientKey);
    if (!rateCheck.allowed) {
      log('WARN', `${LOG_PREFIX} Rate limited: ${clientKey}`);
      return {
        success: false,
        result: { content: [{ type: 'text', text: rateCheck.reason }] },
      };
    }
  }

  if (toolName === 'run_terminal_cmd') {
    return runTerminalCmd(args, config, log);
  }

  return {
    success: false,
    result: { content: [{ type: 'text', text: `Unknown builtin tool: ${toolName}` }] },
  };
}

/**
 * Run a terminal command with full security validation.
 */
async function runTerminalCmd(args, config, log) {
  const terminal = config.agentTerminal || {};

  // Handle _parseArgs fallback: {input: "npm test"} → split into command + args
  let command = args.command;
  let cmdArgs = args.args || [];
  if (!command && args.input) {
    const parts = args.input.trim().split(/\s+/);
    command = parts[0];
    cmdArgs = parts.slice(1);
  }

  if (!command) {
    return {
      success: false,
      result: { content: [{ type: 'text', text: 'Error: No command specified' }] },
    };
  }

  // Validate command against allowlist/blocklist
  const validation = validateCommand(command, cmdArgs, config);
  if (!validation.allowed) {
    log('WARN', `${LOG_PREFIX} Command denied: ${command} ${cmdArgs.join(' ')} — ${validation.reason}`);
    return {
      success: false,
      result: { content: [{ type: 'text', text: `Command denied: ${validation.reason}` }] },
    };
  }

  // Validate working directory
  const cwd = args.cwd
    ? path.resolve(config.projectFolder, args.cwd)
    : config.projectFolder;

  const cwdCheck = validateCwd(cwd, config.projectFolder);
  if (!cwdCheck.valid) {
    log('WARN', `${LOG_PREFIX} CWD denied: ${cwd} — ${cwdCheck.reason}`);
    return {
      success: false,
      result: { content: [{ type: 'text', text: `Working directory denied: ${cwdCheck.reason}` }] },
    };
  }

  // Enforce timeout limits
  const maxMs = (terminal.maxTimeoutSec || 60) * 1000;
  const timeoutMs = Math.min(args.timeoutMs || maxMs, 300000);
  const maxOutputBytes = (terminal.maxOutputKB || 256) * 1024;

  log('INFO', `${LOG_PREFIX} Executing: ${command} ${cmdArgs.join(' ')}`, { cwd: cwdCheck.resolved, timeoutMs });

  const startTime = Date.now();

  return new Promise((resolve) => {
    let output = '';
    let killed = false;

    const proc = spawn(command, cmdArgs, {
      cwd: cwdCheck.resolved,
      shell: true,
      detached: true,
      env: getWhitelistedEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Timeout: SIGTERM → 3s grace → SIGKILL
    const timer = setTimeout(() => {
      killed = true;
      try {
        process.kill(-proc.pid, 'SIGTERM');
      } catch (_) {
        proc.kill('SIGTERM');
      }
      setTimeout(() => {
        try {
          process.kill(-proc.pid, 'SIGKILL');
        } catch (_) {
          try { proc.kill('SIGKILL'); } catch (_2) { /* already dead */ }
        }
      }, 3000);
    }, timeoutMs);

    const appendOutput = (chunk) => {
      if (output.length < maxOutputBytes) {
        output += chunk.toString();
        if (output.length > maxOutputBytes) {
          output = output.slice(0, maxOutputBytes) + '\n... (output truncated)';
        }
      }
    };

    proc.stdout.on('data', appendOutput);
    proc.stderr.on('data', appendOutput);

    proc.on('error', (err) => {
      clearTimeout(timer);
      const duration = Date.now() - startTime;
      log('ERROR', `${LOG_PREFIX} Spawn error: ${err.message}`, { command, duration });
      resolve({
        success: false,
        result: {
          content: [{ type: 'text', text: `Error spawning command "${command}": ${err.message}` }],
        },
      });
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      const duration = Date.now() - startTime;
      const cleanOutput = stripAnsi(output);

      log('INFO', `${LOG_PREFIX} Finished: ${command} exit=${code} duration=${duration}ms output=${(cleanOutput.length / 1024).toFixed(1)}KB${killed ? ' (killed)' : ''}`);

      const statusLine = killed
        ? `Command timed out after ${(timeoutMs / 1000).toFixed(0)}s and was killed.`
        : `Exit code: ${code ?? 'unknown'}`;

      resolve({
        success: code === 0,
        result: {
          content: [{
            type: 'text',
            text: `${statusLine}\nDuration: ${(duration / 1000).toFixed(1)}s\n\n${cleanOutput || '(no output)'}`,
          }],
        },
      });
    });
  });
}

module.exports = {
  getBuiltinTools,
  getBuiltinSafetyPreamble,
  executeBuiltinTool,
  validateCommand,
  validateCwd,
  stripAnsi,
  getWhitelistedEnv,
  checkCmdRateLimit,
};
