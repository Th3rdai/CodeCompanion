/**
 * Built-in agent tools — executed locally without MCP transport.
 * Currently provides: run_terminal_cmd
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const LOG_PREFIX = "[TERMINAL]";

// ── Intra-request rate limit for terminal commands ──
const _cmdRateMap = new Map(); // key → { count, windowStart }
const CMD_RATE_LIMIT = 20; // max commands
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
    return {
      allowed: false,
      reason: `Terminal rate limit exceeded (${CMD_RATE_LIMIT} commands per minute). Wait and try again.`,
    };
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
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

// ── Environment variable whitelist ────────────────
function getWhitelistedEnv() {
  const safe = {};
  const ALLOW = [
    "PATH",
    "HOME",
    "USER",
    "SHELL",
    "LANG",
    "LC_ALL",
    "TERM",
    "NODE_ENV",
    "GOPATH",
    "GOROOT",
    "CARGO_HOME",
    "RUSTUP_HOME",
    "PYTHON",
    "PYTHONPATH",
    "VIRTUAL_ENV",
    "CONDA_DEFAULT_ENV",
    "npm_config_registry",
    "EDITOR",
    "TMPDIR",
    "TMP",
    "TEMP",
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
    return {
      allowed: false,
      reason: "Agent terminal is disabled. Enable it in Settings → General.",
    };
  }

  // Project folder required
  if (!config.projectFolder) {
    return {
      allowed: false,
      reason: "Set a project folder in Settings to use the agent terminal.",
    };
  }

  // Normalize command basename (strip .cmd/.exe for Windows compat)
  const basename = path
    .basename(command)
    .replace(/\.(cmd|exe|bat)$/i, "")
    .toLowerCase();

  // Allowlist check (empty = deny all)
  const allowlist = (terminal.allowlist || []).map((c) => c.toLowerCase());
  if (allowlist.length === 0) {
    return {
      allowed: false,
      reason: `No commands allowed. Add commands to the allowlist in Settings → Agent Terminal.`,
    };
  }
  if (!allowlist.includes(basename)) {
    return {
      allowed: false,
      reason: `Command "${basename}" is not in the allowlist. Allowed: ${allowlist.join(", ")}`,
    };
  }

  // Blocklist check on command
  const blocklist = terminal.blocklist || [];
  const fullCmd = [command, ...args].join(" ");
  for (const blocked of blocklist) {
    if (fullCmd.toLowerCase().includes(blocked.toLowerCase())) {
      return {
        allowed: false,
        reason: `Command blocked by security policy: "${blocked}"`,
      };
    }
  }

  // Shell metacharacter check on each arg
  for (const arg of args) {
    if (METACHAR_PATTERN.test(arg)) {
      return {
        allowed: false,
        reason: `Shell metacharacters detected in argument: "${arg}"`,
      };
    }
  }

  return { allowed: true };
}

// ── Security: validate working directory ──────────

function validateCwd(cwd, projectFolder) {
  if (!projectFolder) {
    return { valid: false, reason: "No project folder configured" };
  }

  try {
    const resolvedProject = fs.realpathSync(path.resolve(projectFolder));
    const resolvedCwd = fs.realpathSync(path.resolve(cwd));

    if (
      resolvedCwd !== resolvedProject &&
      !resolvedCwd.startsWith(resolvedProject + path.sep)
    ) {
      return {
        valid: false,
        reason: `Working directory "${cwd}" is outside the project folder`,
      };
    }

    return { valid: true, resolved: resolvedCwd };
  } catch (err) {
    return {
      valid: false,
      reason: `Path does not exist or is not accessible: ${err.message}`,
    };
  }
}

/** Resolve a file path under projectFolder and ensure it is a readable file (for sourcePath). */
function validateProjectFilePath(userPath, projectFolder) {
  if (!projectFolder) {
    return { valid: false, reason: "No project folder configured" };
  }
  try {
    const resolvedProject = fs.realpathSync(path.resolve(projectFolder));
    const absolute = path.isAbsolute(userPath)
      ? path.resolve(userPath)
      : path.resolve(projectFolder, userPath);
    const resolvedFile = fs.realpathSync(absolute);
    if (
      resolvedFile !== resolvedProject &&
      !resolvedFile.startsWith(resolvedProject + path.sep)
    ) {
      return {
        valid: false,
        reason: "File path must be under the project folder",
      };
    }
    if (!fs.statSync(resolvedFile).isFile()) {
      return { valid: false, reason: "Path is not a file" };
    }
    return { valid: true, resolved: resolvedFile };
  } catch (err) {
    return { valid: false, reason: err.message || "Path is not accessible" };
  }
}

// ── Tool definitions ──────────────────────────────

const BUILTIN_TOOLS = [
  {
    name: "run_terminal_cmd",
    description:
      'Run a terminal command in the project folder. Args: {"command": "npm", "args": ["test"], "cwd": "(optional subdirectory)", "timeoutMs": 60000}. Returns stdout/stderr and exit code.',
    requiresTerminal: true,
  },
  {
    name: "write_file",
    description:
      'Write or overwrite a file in the project folder. Automatically creates a .backup before overwriting. Args: {"path": "restart.sh", "content": "#!/bin/bash\\n..."}. Path is relative to project folder. Returns success/failure and file size.',
    requiresTerminal: false,
  },
  {
    name: "generate_office_file",
    description:
      "Generate a document file from markdown and save it to disk (no Docling). Supported formats: DOCX, XLSX, PPTX, CSV, PDF, ODT, ODS, HTML, TXT, MD, JSON. " +
      'Either pass "content" as markdown OR "sourcePath": a file under the project folder to convert with the built-in reader (PDF, DOCX, CSV, XLSX, PPTX, etc.) — text becomes the document body; use XLSX/CSV/ODS when you want spreadsheet output. ' +
      "Use sourcePath when the user references a PDF or Office file by path (including when chat shows binary or only a filename) — do NOT invent HTTP errors; this tool reads the file on disk. " +
      'Args: {"content": "...", "filename": "out.xlsx", "savePath": "..."} or {"sourcePath": "data/report.pdf", "filename": "report.xlsx", "savePath": "..."}. ' +
      "For spreadsheets: prefer markdown tables in content; plain text becomes one column. Returns file path and size.",
    requiresTerminal: false,
  },
];

/**
 * Get the list of enabled builtin tools for prompt injection.
 * @param {object} config - App config from getConfig()
 * @returns {Array<{serverId: string, name: string, description: string}>}
 */
function getBuiltinTools(config) {
  const terminal = config.agentTerminal || {};

  // Determine if terminal tools are available
  let terminalAllowed = !!terminal.enabled;
  if (terminalAllowed) {
    const bindAddr =
      process.env.HOST ||
      (process.env.CC_BIND_ALL === "1" ? "0.0.0.0" : "127.0.0.1");
    const isExposedBind = bindAddr === "0.0.0.0" || bindAddr === "::";
    if (isExposedBind && process.env.CC_ALLOW_AGENT_TERMINAL !== "1") {
      const isElectron = Boolean(
        process.env.ELECTRON_RUN_AS_NODE || process.versions?.electron,
      );
      if (!isElectron) terminalAllowed = false;
    }
  }

  // Always include non-terminal tools; include terminal tools only when allowed
  return BUILTIN_TOOLS.filter(
    (t) => !t.requiresTerminal || terminalAllowed,
  ).map((t) => ({
    serverId: "builtin",
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
BUILTIN TOOL INSTRUCTIONS:

PDF / BINARY / ATTACHMENTS (read this before answering):
- NEVER claim a specific HTTP error (413, 500, "payload too large", etc.) — you cannot see HTTP responses. Inventing them is wrong.
- If the message includes binary-looking text, "%PDF", or only a filename like "Something.pdf", the user may have attached raw bytes. Do NOT pretend "the conversion service" failed. To get text from a PDF or Office file in the project folder, use builtin.generate_office_file with "sourcePath" (relative path under the project). If you only know the filename, use PROJECT / file tree context to infer the path or ask for the path — do not fabricate errors.

FILE GENERATION (builtin.generate_office_file):
- When the user asks you to create, export, convert, or save a file in ANY of these formats: DOCX, XLSX, PPTX, CSV, PDF, ODT, ODS, HTML, TXT, MD, JSON — you MUST use this tool. Do NOT suggest manual alternatives or Docling for this.
- Write the content as clean markdown. The tool converts all markdown formatting (headings, bold, italic, lists, tables, code blocks) into native document formatting automatically.
- For spreadsheets (XLSX/ODS/CSV): structure data as markdown tables with | column | headers |. Plain paragraphs become a single column of rows.
- To convert an existing project file to Excel/Word/etc. without Docling, pass "sourcePath" (path under the project folder, e.g. "exports/data.csv" or "report.pdf") plus "filename"/"savePath" for the output. Built-in text extraction is used; OCR for scanned PDFs requires Docling separately.
- For presentations (PPTX): use # headings to create new slides.
- Always save to the user's Desktop unless they specify a different path.
- Example: TOOL_CALL: builtin.generate_office_file({"content": "# Report\\n\\n## Summary\\n\\n**Key finding**: growth was 15%.\\n\\n| Metric | Value |\\n|--------|-------|\\n| Revenue | $1.2M |", "filename": "report.docx", "savePath": "/Users/james/Desktop/report.docx"})
- Example (file → spreadsheet): TOOL_CALL: builtin.generate_office_file({"sourcePath": "inputs/sales.csv", "filename": "sales.xlsx", "savePath": "/Users/james/Desktop/sales.xlsx"})

FILE WRITING (builtin.write_file):
- Use this tool to save corrected code, create new files, or update existing files in the project folder.
- Automatically creates a .backup of the original file before overwriting.
- Path is relative to the project folder.
- Example: TOOL_CALL: builtin.write_file({"path": "restart.sh", "content": "#!/bin/bash\\nset -e\\n..."})

TERMINAL TOOL SAFETY (builtin.run_terminal_cmd):
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
  // Safe tools that don't need terminal access — skip security guards
  if (toolName === "generate_office_file") {
    return generateOfficeFileTool(args, config, log);
  }

  if (toolName === "write_file") {
    return writeFileTool(args, config, log);
  }

  // Remote deployment guard — only applies to terminal tools
  const bindAddr =
    process.env.HOST ||
    (process.env.CC_BIND_ALL === "1" ? "0.0.0.0" : "127.0.0.1");
  const isExposedBind = bindAddr === "0.0.0.0" || bindAddr === "::";
  const isElectron = Boolean(
    process.env.ELECTRON_RUN_AS_NODE || process.versions?.electron,
  );
  if (
    isExposedBind &&
    !isElectron &&
    process.env.CC_ALLOW_AGENT_TERMINAL !== "1"
  ) {
    return {
      success: false,
      result: {
        content: [
          {
            type: "text",
            text: "Agent terminal blocked: server is exposed to network. Set CC_ALLOW_AGENT_TERMINAL=1 env var to allow.",
          },
        ],
      },
    };
  }

  // Intra-request rate limit check (terminal commands only)
  if (clientKey) {
    const rateCheck = checkCmdRateLimit(clientKey);
    if (!rateCheck.allowed) {
      log("WARN", `${LOG_PREFIX} Rate limited: ${clientKey}`);
      return {
        success: false,
        result: { content: [{ type: "text", text: rateCheck.reason }] },
      };
    }
  }

  if (toolName === "run_terminal_cmd") {
    return runTerminalCmd(args, config, log);
  }

  return {
    success: false,
    result: {
      content: [{ type: "text", text: `Unknown builtin tool: ${toolName}` }],
    },
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
      result: {
        content: [{ type: "text", text: "Error: No command specified" }],
      },
    };
  }

  // Validate command against allowlist/blocklist
  const validation = validateCommand(command, cmdArgs, config);
  if (!validation.allowed) {
    log(
      "WARN",
      `${LOG_PREFIX} Command denied: ${command} ${cmdArgs.join(" ")} — ${validation.reason}`,
    );
    return {
      success: false,
      result: {
        content: [
          { type: "text", text: `Command denied: ${validation.reason}` },
        ],
      },
    };
  }

  // Validate working directory
  const cwd = args.cwd
    ? path.resolve(config.projectFolder, args.cwd)
    : config.projectFolder;

  const cwdCheck = validateCwd(cwd, config.projectFolder);
  if (!cwdCheck.valid) {
    log("WARN", `${LOG_PREFIX} CWD denied: ${cwd} — ${cwdCheck.reason}`);
    return {
      success: false,
      result: {
        content: [
          {
            type: "text",
            text: `Working directory denied: ${cwdCheck.reason}`,
          },
        ],
      },
    };
  }

  // Enforce timeout limits
  const maxMs = (terminal.maxTimeoutSec || 60) * 1000;
  const timeoutMs = Math.min(args.timeoutMs || maxMs, 300000);
  const maxOutputBytes = (terminal.maxOutputKB || 256) * 1024;

  log("INFO", `${LOG_PREFIX} Executing: ${command} ${cmdArgs.join(" ")}`, {
    cwd: cwdCheck.resolved,
    timeoutMs,
  });

  const startTime = Date.now();

  return new Promise((resolve) => {
    let output = "";
    let killed = false;

    const proc = spawn(command, cmdArgs, {
      cwd: cwdCheck.resolved,
      shell: true,
      detached: true,
      env: getWhitelistedEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Timeout: SIGTERM → 3s grace → SIGKILL
    const timer = setTimeout(() => {
      killed = true;
      try {
        process.kill(-proc.pid, "SIGTERM");
      } catch (_) {
        proc.kill("SIGTERM");
      }
      setTimeout(() => {
        try {
          process.kill(-proc.pid, "SIGKILL");
        } catch (_) {
          try {
            proc.kill("SIGKILL");
          } catch (_2) {
            /* already dead */
          }
        }
      }, 3000);
    }, timeoutMs);

    const appendOutput = (chunk) => {
      if (output.length < maxOutputBytes) {
        output += chunk.toString();
        if (output.length > maxOutputBytes) {
          output = output.slice(0, maxOutputBytes) + "\n... (output truncated)";
        }
      }
    };

    proc.stdout.on("data", appendOutput);
    proc.stderr.on("data", appendOutput);

    proc.on("error", (err) => {
      clearTimeout(timer);
      const duration = Date.now() - startTime;
      log("ERROR", `${LOG_PREFIX} Spawn error: ${err.message}`, {
        command,
        duration,
      });
      resolve({
        success: false,
        result: {
          content: [
            {
              type: "text",
              text: `Error spawning command "${command}": ${err.message}`,
            },
          ],
        },
      });
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      const duration = Date.now() - startTime;
      const cleanOutput = stripAnsi(output);

      log(
        "INFO",
        `${LOG_PREFIX} Finished: ${command} exit=${code} duration=${duration}ms output=${(cleanOutput.length / 1024).toFixed(1)}KB${killed ? " (killed)" : ""}`,
      );

      const statusLine = killed
        ? `Command timed out after ${(timeoutMs / 1000).toFixed(0)}s and was killed.`
        : `Exit code: ${code ?? "unknown"}`;

      resolve({
        success: code === 0,
        result: {
          content: [
            {
              type: "text",
              text: `${statusLine}\nDuration: ${(duration / 1000).toFixed(1)}s\n\n${cleanOutput || "(no output)"}`,
            },
          ],
        },
      });
    });
  });
}

// ── Write file tool ───────────────────────────────
async function writeFileTool(args, config, log) {
  const filePath = args.path;
  const content = args.content;

  if (!filePath || content == null) {
    return {
      success: false,
      result: {
        content: [
          { type: "text", text: 'Error: "path" and "content" are required.' },
        ],
      },
    };
  }

  const projectFolder = config.projectFolder;
  if (!projectFolder) {
    return {
      success: false,
      result: {
        content: [{ type: "text", text: "Error: No project folder set." }],
      },
    };
  }

  // Resolve and validate path is within project folder
  const resolved = path.resolve(projectFolder, filePath);
  if (!resolved.startsWith(path.resolve(projectFolder))) {
    return {
      success: false,
      result: {
        content: [
          { type: "text", text: "Error: Path is outside the project folder." },
        ],
      },
    };
  }

  try {
    // Create backup if file exists
    if (fs.existsSync(resolved)) {
      const backupPath = resolved + ".backup";
      fs.copyFileSync(resolved, backupPath);
      log("INFO", `[WRITE_FILE] Backup created: ${backupPath}`);
    }

    // Ensure directory exists
    fs.mkdirSync(path.dirname(resolved), { recursive: true });

    // Write the file
    fs.writeFileSync(resolved, content, "utf8");
    const stats = fs.statSync(resolved);
    log(
      "INFO",
      `[WRITE_FILE] Saved ${resolved} (${(stats.size / 1024).toFixed(1)}KB)`,
    );

    return {
      success: true,
      result: {
        content: [
          {
            type: "text",
            text: `File written successfully.\nPath: ${resolved}\nSize: ${(stats.size / 1024).toFixed(1)} KB\nBackup: ${fs.existsSync(resolved + ".backup") ? resolved + ".backup" : "none (new file)"}`,
          },
        ],
      },
    };
  } catch (err) {
    log("ERROR", `[WRITE_FILE] Failed: ${err.message}`);
    return {
      success: false,
      result: {
        content: [{ type: "text", text: `Error writing file: ${err.message}` }],
      },
    };
  }
}

// ── Office file generation tool ───────────────────
async function generateOfficeFileTool(args, config, log) {
  const { generateOfficeFile } = require("./office-generator");
  const {
    canConvertBuiltin,
    convertBuiltin,
    BUILTIN_SUPPORTED,
  } = require("./builtin-doc-converter");

  let content = args.content || args.input;

  if (args.sourcePath) {
    const pathCheck = validateProjectFilePath(
      args.sourcePath,
      config.projectFolder,
    );
    if (!pathCheck.valid) {
      return {
        success: false,
        result: {
          content: [
            { type: "text", text: `Error (sourcePath): ${pathCheck.reason}` },
          ],
        },
      };
    }
    const srcName = path.basename(pathCheck.resolved);
    if (!canConvertBuiltin(srcName)) {
      const exts = [...BUILTIN_SUPPORTED].sort().join(", ");
      return {
        success: false,
        result: {
          content: [
            {
              type: "text",
              text: `Built-in conversion does not support ${path.extname(srcName)}. Supported extensions: ${exts}.`,
            },
          ],
        },
      };
    }
    try {
      const buf = fs.readFileSync(pathCheck.resolved);
      const conv = await convertBuiltin(buf, srcName);
      content = conv.markdown || "";
      if (conv.errors?.length) {
        log(
          "INFO",
          `[OFFICE] sourcePath conversion notes for ${srcName}: ${conv.errors.join("; ")}`,
        );
      }
    } catch (err) {
      log("ERROR", `[OFFICE] sourcePath read failed: ${err.message}`);
      return {
        success: false,
        result: {
          content: [
            {
              type: "text",
              text: `Error reading or converting source file: ${err.message}`,
            },
          ],
        },
      };
    }
  }

  if (!content || !String(content).trim()) {
    log(
      "ERROR",
      '[OFFICE] No content (provide "content" or a readable "sourcePath")',
      { argKeys: Object.keys(args) },
    );
    return {
      success: false,
      result: {
        content: [
          {
            type: "text",
            text: 'Error: Missing "content", or "sourcePath" did not produce text.',
          },
        ],
      },
    };
  }

  // Default filename if not provided — infer from savePath or default to .docx
  let filename = args.filename;
  if (!filename && args.savePath) {
    filename = path.basename(args.savePath);
  }
  if (!filename) {
    // Generate a default filename from the first line of content
    const firstLine = content
      .split("\n")[0]
      .replace(/^#+\s*/, "")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim();
    const slug =
      firstLine.split(/\s+/).slice(0, 3).join("-").toLowerCase() || "document";
    const date = new Date().toISOString().slice(0, 10);
    filename = `${slug}-${date}.docx`;
    log("INFO", `[OFFICE] No filename provided, defaulting to: ${filename}`);
  }

  const ext = path.extname(filename).toLowerCase();
  const { SUPPORTED_FORMATS } = require("./office-generator");
  if (!SUPPORTED_FORMATS.has(ext)) {
    return {
      success: false,
      result: {
        content: [
          {
            type: "text",
            text: `Unsupported format: ${ext}. Supported: ${[...SUPPORTED_FORMATS].join(", ")}`,
          },
        ],
      },
    };
  }

  try {
    log(
      "INFO",
      `[OFFICE] Generating ${ext}: ${filename} (${content.length} chars)`,
    );
    const result = await generateOfficeFile(content, filename);

    // Determine save location — prefer Desktop for user-facing files
    const desktop = path.join(require("os").homedir(), "Desktop");
    const outputPath =
      args.savePath ||
      path.join(
        fs.existsSync(desktop)
          ? desktop
          : config.projectFolder || require("os").homedir(),
        filename,
      );

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(outputPath, result.buffer);
    log(
      "INFO",
      `[OFFICE] Saved ${outputPath} (${(result.size / 1024).toFixed(1)}KB)`,
    );

    return {
      success: true,
      result: {
        content: [
          {
            type: "text",
            text: `Office file created successfully.\nPath: ${outputPath}\nFormat: ${ext.slice(1).toUpperCase()}\nSize: ${(result.size / 1024).toFixed(1)} KB\nGeneration time: ${result.processingTime}s`,
          },
        ],
      },
    };
  } catch (err) {
    log("ERROR", `[OFFICE] Generation failed: ${err.message}`);
    return {
      success: false,
      result: {
        content: [
          {
            type: "text",
            text: `Office file generation failed: ${err.message}`,
          },
        ],
      },
    };
  }
}

module.exports = {
  getBuiltinTools,
  getBuiltinSafetyPreamble,
  executeBuiltinTool,
  validateCommand,
  validateCwd,
  validateProjectFilePath,
  stripAnsi,
  getWhitelistedEnv,
  checkCmdRateLimit,
};
