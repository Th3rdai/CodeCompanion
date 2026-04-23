/**
 * Built-in agent tools — executed locally without MCP transport.
 * Currently provides: run_terminal_cmd
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { auditTerminalEvent } = require("./terminal-audit");

const LOG_PREFIX = "[TERMINAL]";
const BROWSER_LOG_PREFIX = "[BROWSER]";

// ── Persistent browser sessions (keyed by clientKey) ──────────────────────
const _browserSessions = new Map(); // clientKey → { browser, page, lastUsed }
const BROWSER_SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 min idle

// Periodically close idle sessions
setInterval(async () => {
  const now = Date.now();
  for (const [key, s] of _browserSessions) {
    if (now - s.lastUsed > BROWSER_SESSION_TIMEOUT_MS) {
      _browserSessions.delete(key);
      try { await s.browser.close(); } catch {}
    }
  }
}, 60_000).unref();

function _getBrowserSession(clientKey) {
  const s = _browserSessions.get(clientKey);
  if (s) s.lastUsed = Date.now();
  return s || null;
}

async function _storeBrowserSession(clientKey, browser, page) {
  // Close any existing session for this client before replacing
  const prev = _browserSessions.get(clientKey);
  if (prev) {
    _browserSessions.delete(clientKey);
    try { await prev.browser.close(); } catch {}
  }
  _browserSessions.set(clientKey, { browser, page, lastUsed: Date.now() });
}

async function _closeBrowserSession(clientKey) {
  const s = _browserSessions.get(clientKey);
  if (!s) return;
  _browserSessions.delete(clientKey);
  try { await s.browser.close(); } catch {}
}

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

// Source of truth for builtin parallel safety (consumed by lib/tool-call-handler.js).
// parallelSafe: false → tool executes serially as its own segment in the chat loop.
// Omitted / true → tool may run concurrently with other parallel-safe calls.
// See .planning/MCPParallelPLAN.md §Tool Safety Policy.
const BUILTIN_TOOLS = [
  {
    name: "run_terminal_cmd",
    description:
      'Run a terminal command in the project folder. Args: {"command": "npm", "args": ["test"], "cwd": "(optional subdirectory)", "timeoutMs": 60000}. Returns stdout/stderr and exit code.',
    requiresTerminal: true,
    parallelSafe: false, // stateful terminal side effects and stream ordering
  },
  {
    name: "write_file",
    description:
      'Write or overwrite a file in the project folder. Automatically creates a .backup before overwriting. Args: {"path": "restart.sh", "content": "#!/bin/bash\\n..."}. Path is relative to project folder. Returns success/failure and file size.',
    requiresTerminal: false,
    parallelSafe: false, // filesystem mutation
  },
  {
    name: "view_pdf_pages",
    description:
      "Render pages of a PDF file as images so you can visually analyze diagrams, network maps, charts, and other visual content. " +
      'Args: {"sourcePath": "path/to/file.pdf", "pages": [1, 2, 3]} — pages is an optional array of 1-based page numbers (default: first 15 pages). ' +
      "Use this when the user asks about visual content in a PDF: network maps, architecture diagrams, charts, screenshots, or anything that text extraction would miss. " +
      "The rendered images will be shown to you directly so you can describe and analyze them.",
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
    parallelSafe: false, // filesystem writes and larger resource footprint
  },
  {
    name: "score_plan",
    description:
      "Score an implementation plan using the same AI pipeline as Planner mode in the UI. " +
      "Returns letter grades (A–F) for Clarity, Feasibility, Completeness, and Structure, plus an overall grade and improvement suggestions. " +
      'Pass either pre-assembled markdown in "content", OR structured fields: planName, goal, steps (required), plus optional scope, dependencies, testing, risks. ' +
      'Args: {"content": "# My Plan\\n...", "model": "auto"} or {"planName": "...", "goal": "...", "steps": "...", "model": "auto"}.',
    requiresPlanner: true,
  },
  {
    name: "validate_scan_project",
    description:
      "Scan the project folder to discover validation configs: linters, type checkers, test runners, CI/CD pipelines, and package scripts. " +
      "Returns a human-readable summary of what was found. " +
      'Args: {"folder": "."} — optional subfolder relative to the project root (default: project root).',
    requiresValidate: true,
  },
  {
    name: "validate_generate_command",
    description:
      "Scan the project folder and use AI to generate a phased validate.md command file tailored to its linters, type checkers, test runners, and CI configs — " +
      "same output as Validate mode in the UI. This tool does the scan + AI generation in one step (may take 30–60 s). " +
      'Args: {"folder": ".", "model": "auto", "savePath": "validate.md"} — ' +
      "folder is relative to the project root; savePath (optional) writes the result to that path under the project root.",
    requiresValidate: true,
  },
  {
    name: "browse_url",
    description:
      "Open a URL in a headless browser, wait for the page to load, and return the page title, text content, and a screenshot for visual analysis. " +
      "Starts a persistent browser session — use browser_click, browser_type, browser_scroll, browser_snapshot to interact after loading. " +
      'Args: {"url": "https://example.com", "waitFor": "domcontentloaded", "screenshot": true, "timeoutMs": 30000}. ' +
      'waitFor options: "load" | "domcontentloaded" | "networkidle" (networkidle for JS-heavy SPAs). ' +
      "Only http:// and https:// URLs are supported. Localhost and private IPs are blocked.",
    requiresBrowser: true,
    parallelSafe: false,
  },
  {
    name: "browser_snapshot",
    description:
      "Take a screenshot of the current browser page and return its visible text content. " +
      "Use after navigation or interaction to see the current page state. " +
      "Requires an active session — call browse_url first. " +
      "Args: {} (no arguments required)",
    requiresBrowser: true,
    parallelSafe: false,
  },
  {
    name: "browser_click",
    description:
      "Click an element on the current browser page. Provide either a CSS selector or visible text to match. " +
      "After clicking, a screenshot of the resulting page state is returned. " +
      "Requires an active session — call browse_url first. " +
      'Args: {"selector": "button.submit"} OR {"text": "Sign In"}. ' +
      "selector must be a valid CSS selector (no Playwright :has-text() or ::nth-child pseudo-classes — use text param instead for text matching). " +
      "selector takes priority over text when both are provided.",
    requiresBrowser: true,
    parallelSafe: false,
  },
  {
    name: "browser_type",
    description:
      "Type text into a field on the current browser page. Use a CSS selector to target the field. " +
      "Fills the field (replacing any existing content). Optionally press Enter after. " +
      "Requires an active session — call browse_url first. " +
      'Args: {"selector": "#email", "text": "user@example.com", "clear": true, "pressEnter": false}',
    requiresBrowser: true,
    parallelSafe: false,
  },
  {
    name: "browser_scroll",
    description:
      "Scroll the current browser page. " +
      'direction: "down" | "up" | "top" | "bottom". amount: pixels to scroll (default 500, ignored for top/bottom). ' +
      "Requires an active session — call browse_url first. " +
      'Args: {"direction": "down", "amount": 500}',
    requiresBrowser: true,
    parallelSafe: false,
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

  const validateEnabled = config.agentValidate?.enabled !== false;
  const plannerEnabled = config.agentPlanner?.enabled !== false;
  const browserEnabled = config.agentBrowser?.enabled === true;

  // Always include non-gated tools; apply feature gates for terminal/validate/planner/browser
  return BUILTIN_TOOLS.filter(
    (t) =>
      (!t.requiresTerminal || terminalAllowed) &&
      (!t.requiresValidate || validateEnabled) &&
      (!t.requiresPlanner || plannerEnabled) &&
      (!t.requiresBrowser || browserEnabled),
  ).map((t) => ({
    serverId: "builtin",
    name: t.name,
    description: t.description,
  }));
}

/** Core builtin preamble (PDF, office, write_file, view_pdf_pages). Terminal block is appended only when advertised. */
const BUILTIN_SAFETY_PREAMBLE_CORE = `
BUILTIN TOOL INSTRUCTIONS:

PDF / BINARY / ATTACHMENTS (read this before answering):
- NEVER claim a specific HTTP error (413, 500, "payload too large", etc.) — you cannot see HTTP responses. Inventing them is wrong.
- If the message includes binary-looking text, "%PDF", or only a filename like "Something.pdf", the user may have attached raw bytes. Do NOT pretend "the conversion service" failed. Use builtin.generate_office_file with "sourcePath" ONCE to extract text. After receiving the tool result, present it — do NOT re-call the same tool. If you only know the filename, use PROJECT / file tree context to infer the path or ask for the path — do not fabricate errors.

PDF VISUAL ANALYSIS (builtin.view_pdf_pages):
- When the user asks about diagrams, network maps, architecture charts, screenshots, or any visual content in a PDF, use this tool to render specific pages as images.
- You will receive the rendered page images directly and can analyze their visual content.
- Example: TOOL_CALL: builtin.view_pdf_pages({"sourcePath": "reports/network.pdf", "pages": [3, 4, 5]})
- If you don't know which pages have the visual content, render a range: TOOL_CALL: builtin.view_pdf_pages({"sourcePath": "report.pdf"})
- After receiving the images, describe what you see and answer the user's question — do NOT re-call this tool unless asked for different pages.

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
`;

const BUILTIN_SAFETY_PREAMBLE_TERMINAL = `
TERMINAL TOOL SAFETY (builtin.run_terminal_cmd):
- You MUST use TOOL_CALL to run commands — do NOT ask the user to paste output manually or run it themselves. You are the agent; you run it.
- In the SAME assistant message: briefly state what you will run and why, then emit TOOL_CALL.
- NEVER run destructive commands (rm, drop, truncate, mkfs, etc.) unless the user explicitly asked for that operation.
- If a command fails, explain the error — do not retry blindly with escalated privileges.
- Stay under the configured project folder — do not suggest paths outside it.
- Prefer read-only commands first (git status, ls, cat) before write operations.
`;

const BUILTIN_SAFETY_PREAMBLE_PLANNER = `
PLANNER TOOL (builtin.score_plan):
- Use score_plan to evaluate an implementation plan and receive letter grades (A–F) for Clarity, Feasibility, Completeness, and Structure, plus an overall grade and improvement suggestions — the same scoring as Planner mode in the UI.
- Pass the plan as pre-assembled markdown in "content", OR use structured fields: planName, goal, steps (required), plus optional scope, dependencies, testing, risks.
- Scoring calls Ollama and may take 15–60 seconds depending on model size.
- Example (markdown): TOOL_CALL: builtin.score_plan({"content": "# Auth Migration\\n\\n## Goal\\nMigrate to JWT...\\n\\n## Implementation Steps\\n1. Add JWT library..."})
- Example (fields): TOOL_CALL: builtin.score_plan({"planName": "Auth Migration", "goal": "Migrate to JWT tokens", "steps": "1. Add JWT library\\n2. Update auth routes"})
`;

const BUILTIN_SAFETY_PREAMBLE_VALIDATE = `
VALIDATE TOOLS (builtin.validate_scan_project, builtin.validate_generate_command):
- Use validate_scan_project to discover linters, type checkers, test runners, and CI configs in the project folder.
- Use validate_generate_command to generate a phased validate.md command file tailored to the project. This does a scan + AI generation in one step and may take 30–60 seconds.
- Both tools operate on the configured project folder only — paths outside it are rejected.
- Example: TOOL_CALL: builtin.validate_scan_project({"folder": "."})
- Example: TOOL_CALL: builtin.validate_generate_command({"folder": ".", "savePath": "validate.md"})
`;

const BUILTIN_SAFETY_PREAMBLE_BROWSER = `
BROWSER TOOLS (persistent session):
Always start with browse_url to open a page and start a session. Then use interaction tools to navigate the live page.

- builtin.browse_url — Open a URL, load the page, return title/text/screenshot. Starts (or replaces) the browser session.
  Example: TOOL_CALL: builtin.browse_url({"url": "https://example.com"})
  SPA example: TOOL_CALL: builtin.browse_url({"url": "https://app.example.com", "waitFor": "networkidle"})

- builtin.browser_snapshot — Screenshot the current page and return its text. No args required.
  Example: TOOL_CALL: builtin.browser_snapshot({})

- builtin.browser_click — Click an element by CSS selector or visible text. Returns updated screenshot.
  Example: TOOL_CALL: builtin.browser_click({"selector": "button[type=submit]"})
  Example: TOOL_CALL: builtin.browser_click({"text": "Sign In"})

- builtin.browser_type — Type into a field. Optionally clear it first or press Enter after.
  Example: TOOL_CALL: builtin.browser_type({"selector": "#email", "text": "user@example.com", "pressEnter": false})

- builtin.browser_scroll — Scroll the page.
  Example: TOOL_CALL: builtin.browser_scroll({"direction": "down", "amount": 500})

Rules:
- Only http/https URLs. Localhost and private IPs are blocked.
- Call browse_url before using any other browser tool — if no session exists the tool returns an error.
- CRITICAL: Call ONE browser tool per response, then wait for the result before calling the next one. Never queue multiple browser tools in a single response.
- After each tool result arrives, examine the screenshot and text, then immediately call the next required browser tool. Keep going until the user's complete request is fulfilled.
- Only write a final text response to the user when ALL steps are done.
- Do NOT re-call browse_url unless navigating to a new page; use browser_snapshot to refresh.
`;

/**
 * Safety preamble for builtin tools (PDF, office, write_file, optional terminal/validate/planner).
 * Overrides the aggressive MCP "USE IT IMMEDIATELY" prompt where needed.
 * @param {{ includeTerminal?: boolean, includeValidate?: boolean, includePlanner?: boolean }} [options]
 * @returns {string}
 */
function getBuiltinSafetyPreamble(options = {}) {
  const includeTerminal = options.includeTerminal === true;
  const includeValidate = options.includeValidate === true;
  const includePlanner = options.includePlanner === true;
  const includeBrowser = options.includeBrowser === true;
  return (
    BUILTIN_SAFETY_PREAMBLE_CORE +
    (includeTerminal ? BUILTIN_SAFETY_PREAMBLE_TERMINAL : "") +
    (includePlanner ? BUILTIN_SAFETY_PREAMBLE_PLANNER : "") +
    (includeValidate ? BUILTIN_SAFETY_PREAMBLE_VALIDATE : "") +
    (includeBrowser ? BUILTIN_SAFETY_PREAMBLE_BROWSER : "")
  );
}

// ── Execute builtin tool ──────────────────────────

/**
 * Execute a builtin tool and return MCP-compatible result.
 * @param {string} toolName
 * @param {object} args - Parsed tool arguments
 * @param {object} config - App config
 * @param {function} log - Logger function
 * @param {string} [clientKey] - Optional client identifier for intra-request rate limiting
 * @param {object} [context] - Optional SSE context: { onStart, onData, onStatus, logDir, confirmCallback }
 * @returns {Promise<{success: boolean, result: {content: Array}}>}
 */
async function executeBuiltinTool(
  toolName,
  args,
  config,
  log,
  clientKey,
  context,
) {
  // Safe tools that don't need terminal access — skip security guards
  if (toolName === "generate_office_file") {
    return generateOfficeFileTool(args, config, log);
  }

  if (toolName === "write_file") {
    return writeFileTool(args, config, log);
  }

  if (toolName === "view_pdf_pages") {
    return viewPdfPagesTool(args, config, log);
  }

  if (toolName === "score_plan") {
    return scorePlanTool(args, config, log);
  }

  if (toolName === "validate_scan_project") {
    return validateScanProjectTool(args, config, log);
  }

  if (toolName === "validate_generate_command") {
    return validateGenerateCommandTool(args, config, log);
  }

  if (toolName === "browse_url") {
    return browseUrlTool(args, config, log, clientKey);
  }

  if (toolName === "browser_snapshot") {
    return browserSnapshotTool(args, config, log, clientKey);
  }

  if (toolName === "browser_click") {
    return browserClickTool(args, config, log, clientKey);
  }

  if (toolName === "browser_type") {
    return browserTypeTool(args, config, log, clientKey);
  }

  if (toolName === "browser_scroll") {
    return browserScrollTool(args, config, log, clientKey);
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
    return runTerminalCmd(args, config, log, context);
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
 * @param {object} [context] - SSE context: { onStart, onData, onStatus, logDir, confirmCallback }
 */
async function runTerminalCmd(args, config, log, context) {
  const terminal = config.agentTerminal || {};

  // Handle _parseArgs fallback: {input: "npm test"} → split into command + args
  let command = args.command;
  let cmdArgs = args.args || [];
  if (!command && args.input) {
    const parts = args.input.trim().split(/\s+/);
    command = parts[0];
    cmdArgs = parts.slice(1);
  }
  // Handle models that embed args in command: {command: "cat game.js"} → command="cat", args=["game.js"]
  if (command && command.includes(" ") && cmdArgs.length === 0) {
    const parts = command.trim().split(/\s+/);
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
    auditTerminalEvent({
      event: "denied",
      denyType: "allowlist",
      command,
      args: cmdArgs,
      reason: validation.reason,
    });
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
    auditTerminalEvent({
      event: "denied",
      denyType: "cwd",
      command,
      args: cmdArgs,
      cwd,
      reason: cwdCheck.reason,
    });
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

  // Confirm-before-run gate (fail closed)
  if (terminal.confirmBeforeRun) {
    if (!context?.confirmCallback) {
      auditTerminalEvent({
        event: "denied",
        denyType: "confirm-unavailable",
        command,
        args: cmdArgs,
        cwd: cwdCheck.resolved,
        reason:
          "Command confirmation required but no confirm callback was provided",
      });
      return {
        success: false,
        result: {
          content: [
            {
              type: "text",
              text: "Command execution blocked: confirmation is required but unavailable.",
            },
          ],
        },
      };
    }

    let approved = false;
    try {
      const decision = await context.confirmCallback({
        command,
        args: cmdArgs,
        cwd: cwdCheck.resolved,
      });
      approved = Boolean(decision?.approved);
    } catch (err) {
      log("WARN", `${LOG_PREFIX} confirmBeforeRun callback failed`, {
        error: err?.message || String(err),
      });
      auditTerminalEvent({
        event: "denied",
        denyType: "confirm-error",
        command,
        args: cmdArgs,
        cwd: cwdCheck.resolved,
        reason: "Command confirmation callback failed",
      });
      return {
        success: false,
        result: {
          content: [
            {
              type: "text",
              text: "Command execution blocked: confirmation check failed.",
            },
          ],
        },
      };
    }

    if (!approved) {
      auditTerminalEvent({
        event: "denied",
        denyType: "user-rejected",
        command,
        args: cmdArgs,
        cwd: cwdCheck.resolved,
        reason: "User rejected command execution",
      });
      return {
        success: false,
        result: {
          content: [
            { type: "text", text: "Command execution rejected by user." },
          ],
        },
      };
    }
  }

  // Enforce timeout limits
  const maxMs = (terminal.maxTimeoutSec || 60) * 1000;
  const timeoutMs = Math.min(args.timeoutMs || maxMs, 300000);
  const maxOutputBytes = (terminal.maxOutputKB || 256) * 1024;

  log("INFO", `${LOG_PREFIX} Executing: ${command} ${cmdArgs.join(" ")}`, {
    cwd: cwdCheck.resolved,
    timeoutMs,
  });
  context?.onStart?.({ command, args: cmdArgs, cwd: cwdCheck.resolved });

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
      if (context?.onData) context.onData(chunk);
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
      auditTerminalEvent({
        event: "spawn-error",
        command,
        args: cmdArgs,
        cwd: cwdCheck.resolved,
        durationMs: duration,
        error: err.message,
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
      const truncated = output.length >= maxOutputBytes;

      log(
        "INFO",
        `${LOG_PREFIX} Finished: ${command} exit=${code} duration=${duration}ms output=${(cleanOutput.length / 1024).toFixed(1)}KB${killed ? " (killed)" : ""}`,
      );
      auditTerminalEvent({
        event: "executed",
        command,
        args: cmdArgs,
        cwd: cwdCheck.resolved,
        exitCode: code,
        durationMs: duration,
        outputBytes: cleanOutput.length,
        truncated,
        killed,
      });
      context?.onStatus?.({
        exitCode: code,
        durationMs: duration,
        killed,
        truncated,
      });

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

/**
 * Render PDF pages as images using pdftoppm so the agent can visually analyze
 * diagrams, network maps, charts, and other visual content.
 */
async function viewPdfPagesTool(args, config, log) {
  const { mergeDevToolPathIntoEnv } = require("./spawn-path");
  const MAX_PAGES = 15;

  if (!args.sourcePath) {
    return {
      success: false,
      result: {
        content: [{ type: "text", text: 'Error: "sourcePath" is required.' }],
      },
    };
  }

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

  if (path.extname(pathCheck.resolved).toLowerCase() !== ".pdf") {
    return {
      success: false,
      result: {
        content: [
          {
            type: "text",
            text: "Error: view_pdf_pages only supports PDF files.",
          },
        ],
      },
    };
  }

  // Determine page range
  let firstPage = 1;
  let lastPage = MAX_PAGES;
  if (Array.isArray(args.pages) && args.pages.length > 0) {
    const nums = args.pages
      .map(Number)
      .filter((n) => Number.isFinite(n) && n >= 1);
    if (nums.length === 0) {
      return {
        success: false,
        result: {
          content: [
            {
              type: "text",
              text: 'Error: "pages" must be an array of positive integers.',
            },
          ],
        },
      };
    }
    firstPage = Math.min(...nums);
    lastPage = Math.min(Math.max(...nums), firstPage + MAX_PAGES - 1);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-pdf-"));
  const prefix = path.join(tmpDir, "page");

  try {
    const spawnEnv = mergeDevToolPathIntoEnv({ PATH: process.env.PATH || "" });

    await new Promise((resolve, reject) => {
      const proc = spawn(
        "pdftoppm",
        [
          "-r",
          "120",
          "-png",
          "-f",
          String(firstPage),
          "-l",
          String(lastPage),
          pathCheck.resolved,
          prefix,
        ],
        { env: spawnEnv },
      );
      let stderr = "";
      proc.stderr.on("data", (d) => (stderr += d.toString()));
      proc.on("close", (code) => {
        if (code !== 0)
          reject(
            new Error(
              `pdftoppm failed (exit ${code}): ${stderr.slice(0, 200)}`,
            ),
          );
        else resolve();
      });
      proc.on("error", (err) =>
        reject(
          new Error(
            `pdftoppm not found: ${err.message}. Install poppler: brew install poppler`,
          ),
        ),
      );
    });

    const files = fs
      .readdirSync(tmpDir)
      .filter((f) => f.endsWith(".png"))
      .sort()
      .slice(0, MAX_PAGES);

    if (files.length === 0) {
      return {
        success: false,
        result: {
          content: [
            {
              type: "text",
              text: "No pages rendered. The PDF may be empty or the page range invalid.",
            },
          ],
        },
      };
    }

    log(
      "INFO",
      `[PDF-PAGES] Rendered ${files.length} page(s) from ${path.basename(pathCheck.resolved)} (pages ${firstPage}-${firstPage + files.length - 1})`,
    );

    const content = [
      {
        type: "text",
        text: `Rendered ${files.length} page(s) from "${path.basename(pathCheck.resolved)}" (pages ${firstPage}–${firstPage + files.length - 1}). Analyze the visual content in the images below.`,
      },
    ];

    for (const file of files) {
      const imgBuf = fs.readFileSync(path.join(tmpDir, file));
      content.push({
        type: "image_for_analysis",
        mimeType: "image/png",
        data: imgBuf.toString("base64"),
      });
    }

    return { success: true, result: { content } };
  } catch (err) {
    log("ERROR", `[PDF-PAGES] Failed: ${err.message}`);
    return {
      success: false,
      result: {
        content: [
          { type: "text", text: `PDF page rendering failed: ${err.message}` },
        ],
      },
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true });
    } catch {}
  }
}

// ── Planner score tool ────────────────────────────

/**
 * Assemble planner markdown from structured fields — mirrors PlannerPanel.buildContent().
 * Used when the agent passes individual form fields rather than pre-built markdown.
 */
function _buildPlannerContent(args) {
  const lines = [];
  lines.push(`# ${args.planName || "Untitled Plan"}`);
  lines.push("");
  lines.push("## Goal");
  lines.push("");
  lines.push(args.goal || "");
  lines.push("");
  if (String(args.scope || "").trim()) {
    lines.push("## Scope");
    lines.push("");
    lines.push(args.scope);
    lines.push("");
  }
  lines.push("## Implementation Steps");
  lines.push("");
  lines.push(args.steps || "");
  lines.push("");
  if (String(args.dependencies || "").trim()) {
    lines.push("## Dependencies");
    lines.push("");
    lines.push(args.dependencies);
    lines.push("");
  }
  if (String(args.testing || "").trim()) {
    lines.push("## Testing Strategy");
    lines.push("");
    lines.push(args.testing);
    lines.push("");
  }
  if (String(args.risks || "").trim()) {
    lines.push("## Risk Assessment");
    lines.push("");
    lines.push(args.risks);
    lines.push("");
  }
  return lines.join("\n");
}

async function scorePlanTool(args, config, log) {
  const { scoreContent } = require("./builder-score");

  // Accept pre-built markdown OR structured fields
  let content = args.content || args.input;
  if (!content) {
    if (!args.steps && !args.goal) {
      return {
        success: false,
        result: {
          content: [
            {
              type: "text",
              text: 'Error: Provide either "content" (markdown) or at minimum "goal" and "steps" fields.',
            },
          ],
        },
      };
    }
    content = _buildPlannerContent(args);
  }

  const ollamaUrl = config.ollamaUrl || "http://localhost:11434";

  // Determine model
  let model = args.model && args.model !== "auto" ? args.model : null;
  if (!model) {
    const autoMap = config.autoModelMap || {};
    model = autoMap.planner || autoMap.chat || "llama3.2";
  }

  const apiKey = config.ollamaApiKey || process.env.OLLAMA_API_KEY || "";
  const ollamaOpts = apiKey ? { apiKey } : {};

  log("INFO", `[SCORE_PLAN] model=${model} content=${content.length} chars`);

  try {
    const result = await scoreContent(
      ollamaUrl,
      model,
      "planner",
      content,
      args.metadata || {},
      ollamaOpts,
    );

    if (result.type === "score-card") {
      const d = result.data;
      const fmt = (cat) =>
        `  Grade: ${cat.grade}\n  ${cat.summary}\n  Suggestions:\n${(cat.suggestions || []).map((s) => `    • ${s}`).join("\n")}`;

      const text = [
        `Plan Score — Overall: ${d.overallGrade}`,
        `Summary: ${d.summary}`,
        "",
        `Clarity\n${fmt(d.categories.clarity)}`,
        "",
        `Feasibility\n${fmt(d.categories.feasibility)}`,
        "",
        `Completeness\n${fmt(d.categories.completeness)}`,
        "",
        `Structure\n${fmt(d.categories.structure)}`,
      ].join("\n");

      log("INFO", `[SCORE_PLAN] complete overall=${d.overallGrade}`);
      return {
        success: true,
        result: { content: [{ type: "text", text }] },
      };
    }

    // chat-fallback: collect stream
    const ollamaRes = result.stream;
    if (!ollamaRes.ok) {
      return {
        success: false,
        result: {
          content: [
            {
              type: "text",
              text: `Scoring fallback stream failed: HTTP ${ollamaRes.status}`,
            },
          ],
        },
      };
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let generated = "";

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) generated += parsed.message.content;
          if (parsed.done) break outer;
        } catch {}
      }
    }

    log(
      "INFO",
      `[SCORE_PLAN] fallback complete chars=${generated.length} reason=${result.error}`,
    );
    return {
      success: true,
      result: {
        content: [
          {
            type: "text",
            text: `Plan Score (conversational fallback — structured scoring unavailable: ${result.error}):\n\n${generated}`,
          },
        ],
      },
    };
  } catch (err) {
    log("ERROR", `[SCORE_PLAN] Failed: ${err.message}`);
    return {
      success: false,
      result: {
        content: [{ type: "text", text: `Error scoring plan: ${err.message}` }],
      },
    };
  }
}

// ── Validate scan tool ────────────────────────────
async function validateScanProjectTool(args, config, log) {
  const { scanProjectForValidation } = require("./validate");

  const projectFolder = config.projectFolder;
  if (!projectFolder) {
    return {
      success: false,
      result: {
        content: [
          {
            type: "text",
            text: "Error: No project folder configured. Set one in Settings → General.",
          },
        ],
      },
    };
  }

  // Resolve target folder — default to project root
  const resolvedProject = path.resolve(projectFolder);
  let targetFolder = resolvedProject;
  if (args.folder && args.folder !== "." && args.folder !== "") {
    const candidate = path.resolve(projectFolder, args.folder);
    if (
      candidate !== resolvedProject &&
      !candidate.startsWith(resolvedProject + path.sep)
    ) {
      return {
        success: false,
        result: {
          content: [
            {
              type: "text",
              text: "Error: folder must be within the configured project folder.",
            },
          ],
        },
      };
    }
    targetFolder = candidate;
  }

  try {
    const result = scanProjectForValidation(targetFolder);
    log(
      "INFO",
      `[VALIDATE_SCAN] folder=${targetFolder} lang=${result.language} fw=${result.framework}`,
    );

    const lines = [
      `Project scan: ${targetFolder}`,
      `Language: ${result.language}  |  Framework: ${result.framework}`,
      `Linting: ${result.linting.length > 0 ? result.linting.join(", ") : "none found"}`,
      `Type checking: ${result.typeChecking.length > 0 ? result.typeChecking.join(", ") : "none found"}`,
      `Formatting: ${result.formatting.length > 0 ? result.formatting.join(", ") : "none found"}`,
      `Testing: ${result.testing.length > 0 ? result.testing.join(", ") : "none found"}`,
      `CI/CD: ${result.ci.length > 0 ? result.ci.join(", ") : "none found"}`,
      `Package managers: ${result.packageManagers.length > 0 ? result.packageManagers.join(", ") : "none found"}`,
      `Test directories: ${result.testDirs.length > 0 ? result.testDirs.join(", ") : "none found"}`,
    ];

    const scripts = Object.entries(result.scripts);
    if (scripts.length > 0) {
      lines.push(
        `\nPackage scripts:\n${scripts.map(([k, v]) => `  ${k}: ${v}`).join("\n")}`,
      );
    }

    if (result.readme) {
      const excerpt = result.readme.slice(0, 800);
      lines.push(
        `\nREADME excerpt:\n${excerpt}${result.readme.length > 800 ? "\n...(truncated)" : ""}`,
      );
    }

    lines.push(
      '\nTo generate a validate.md for this project, call: TOOL_CALL: builtin.validate_generate_command({"folder": "."})',
    );

    return {
      success: true,
      result: { content: [{ type: "text", text: lines.join("\n") }] },
    };
  } catch (err) {
    log("ERROR", `[VALIDATE_SCAN] Failed: ${err.message}`);
    return {
      success: false,
      result: {
        content: [
          { type: "text", text: `Error scanning project: ${err.message}` },
        ],
      },
    };
  }
}

// ── Validate generate command tool ────────────────
async function validateGenerateCommandTool(args, config, log) {
  const {
    scanProjectForValidation,
    generateValidateCommand,
  } = require("./validate");

  const projectFolder = config.projectFolder;
  if (!projectFolder) {
    return {
      success: false,
      result: {
        content: [
          {
            type: "text",
            text: "Error: No project folder configured. Set one in Settings → General.",
          },
        ],
      },
    };
  }

  const ollamaUrl = config.ollamaUrl || "http://localhost:11434";

  // Resolve target folder
  const resolvedProject = path.resolve(projectFolder);
  let targetFolder = resolvedProject;
  if (args.folder && args.folder !== "." && args.folder !== "") {
    const candidate = path.resolve(projectFolder, args.folder);
    if (
      candidate !== resolvedProject &&
      !candidate.startsWith(resolvedProject + path.sep)
    ) {
      return {
        success: false,
        result: {
          content: [
            {
              type: "text",
              text: "Error: folder must be within the configured project folder.",
            },
          ],
        },
      };
    }
    targetFolder = candidate;
  }

  // Determine model — fall back to configured auto map
  let model = args.model && args.model !== "auto" ? args.model : null;
  if (!model) {
    const autoMap = config.autoModelMap || {};
    model = autoMap.validate || autoMap.chat || "llama3.2";
  }

  // Ollama auth opts
  const apiKey = config.ollamaApiKey || process.env.OLLAMA_API_KEY || "";
  const ollamaOpts = apiKey ? { apiKey } : {};

  log("INFO", `[VALIDATE_GEN] folder=${targetFolder} model=${model}`);

  try {
    // Step 1: scan
    const scanResult = scanProjectForValidation(targetFolder);
    log(
      "INFO",
      `[VALIDATE_GEN] scan done lang=${scanResult.language} fw=${scanResult.framework}`,
    );

    // Step 2: generate — collect streaming response into a string
    const ollamaRes = await generateValidateCommand(
      ollamaUrl,
      model,
      targetFolder,
      scanResult,
      ollamaOpts,
    );

    if (!ollamaRes.ok) {
      return {
        success: false,
        result: {
          content: [
            {
              type: "text",
              text: `Ollama returned HTTP ${ollamaRes.status}. Check the model name and Ollama connection.`,
            },
          ],
        },
      };
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let generated = "";
    let tokenCount = 0;

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            generated += parsed.message.content;
            tokenCount++;
          }
          if (parsed.done) break outer;
        } catch {}
      }
    }

    log(
      "INFO",
      `[VALIDATE_GEN] complete tokens=${tokenCount} chars=${generated.length}`,
    );

    // Step 3: optional save to project folder
    let saveNote = "";
    if (args.savePath) {
      const resolved = path.resolve(projectFolder, args.savePath);
      if (
        resolved !== resolvedProject &&
        !resolved.startsWith(resolvedProject + path.sep)
      ) {
        saveNote =
          "\n\nWarning: savePath is outside the project folder — file was NOT saved.";
      } else {
        try {
          if (fs.existsSync(resolved)) {
            fs.copyFileSync(resolved, resolved + ".backup");
          }
          fs.mkdirSync(path.dirname(resolved), { recursive: true });
          fs.writeFileSync(resolved, generated, "utf8");
          saveNote = `\n\nSaved to: ${resolved}`;
          log("INFO", `[VALIDATE_GEN] saved to ${resolved}`);
        } catch (writeErr) {
          saveNote = `\n\nFailed to save file: ${writeErr.message}`;
          log("ERROR", `[VALIDATE_GEN] save failed: ${writeErr.message}`);
        }
      }
    }

    // Cap content returned to model to avoid flooding context
    const MAX_DISPLAY = 12000;
    const display =
      generated.length > MAX_DISPLAY
        ? generated.slice(0, MAX_DISPLAY) +
          "\n...(truncated — full content saved to file)"
        : generated;

    return {
      success: true,
      result: {
        content: [
          {
            type: "text",
            text: `Generated validate.md for ${targetFolder} (language: ${scanResult.language}, framework: ${scanResult.framework}):\n\n${display}${saveNote}`,
          },
        ],
      },
    };
  } catch (err) {
    log("ERROR", `[VALIDATE_GEN] Failed: ${err.message}`);
    return {
      success: false,
      result: {
        content: [
          {
            type: "text",
            text: `Error generating validate command: ${err.message}`,
          },
        ],
      },
    };
  }
}

// ── Browser tool ──────────────────────────────────

const PRIVATE_IP_PATTERNS = [
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
];

function validateBrowseUrl(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { valid: false, reason: `Invalid URL: "${urlStr}"` };
  }
  const proto = parsed.protocol.toLowerCase();
  if (proto !== "http:" && proto !== "https:") {
    return {
      valid: false,
      reason: `Protocol "${proto}" is not allowed. Only http: and https: are supported.`,
    };
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    PRIVATE_IP_PATTERNS.some((re) => re.test(host))
  ) {
    return {
      valid: false,
      reason: "Browsing localhost and private IP addresses is not allowed.",
    };
  }
  return { valid: true };
}

async function browseUrlTool(args, config, log, clientKey) {
  if (!config.agentBrowser?.enabled) {
    return {
      success: false,
      result: {
        content: [
          {
            type: "text",
            text: "Agent Web Browser is disabled. Enable it in Settings → General → Agent Web Browser.",
          },
        ],
      },
    };
  }

  const url = args.url;
  if (!url) {
    return {
      success: false,
      result: { content: [{ type: "text", text: 'Error: "url" is required.' }] },
    };
  }

  const urlCheck = validateBrowseUrl(url);
  if (!urlCheck.valid) {
    return {
      success: false,
      result: {
        content: [{ type: "text", text: `URL blocked: ${urlCheck.reason}` }],
      },
    };
  }

  const VALID_WAIT = ["load", "domcontentloaded", "networkidle"];
  const waitFor = VALID_WAIT.includes(args.waitFor)
    ? args.waitFor
    : "domcontentloaded";
  const includeScreenshot = args.screenshot !== false;
  const timeoutMs = Math.min(args.timeoutMs || 30000, 60000);
  const MAX_TEXT = 10000;

  log("INFO", `${BROWSER_LOG_PREFIX} Navigating to: ${url} waitFor=${waitFor}`);

  // Load Playwright (production dep; falls back to HTTP fetch if missing)
  let chromium;
  try {
    chromium = require("playwright").chromium;
  } catch {
    // playwright not available — fall back to HTTP fetch
  }

  if (!chromium) {
    return browseUrlFetch(url, timeoutMs, MAX_TEXT, log);
  }

  // Auto-install Chromium browser if not yet downloaded (~100MB, once only)
  const browserExec = chromium.executablePath();
  if (!fs.existsSync(browserExec)) {
    log("INFO", `${BROWSER_LOG_PREFIX} Chromium not found — downloading (this takes ~30s the first time)...`);
    try {
      const { execFileSync } = require("child_process");
      const cliPath = require.resolve("playwright/cli.js");
      execFileSync(process.execPath, [cliPath, "install", "chromium"], {
        stdio: ["ignore", "ignore", "ignore"],
        timeout: 300000,
      });
      log("INFO", `${BROWSER_LOG_PREFIX} Chromium installed successfully`);
    } catch (installErr) {
      log("ERROR", `${BROWSER_LOG_PREFIX} Chromium install failed: ${installErr.message} — falling back to HTTP fetch`);
      return browseUrlFetch(url, timeoutMs, MAX_TEXT, log);
    }
  }

  const headed = config.agentBrowser?.headed === true;
  let browser;
  try {
    browser = await chromium.launch({ headless: !headed });
    const browserContext = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    const page = await browserContext.newPage();

    await page.goto(url, { waitUntil: waitFor, timeout: timeoutMs });

    const title = await page.title();
    const finalUrl = page.url();

    const extractText = () =>
      page.evaluate(() => {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
        return (clone.innerText || clone.textContent || "").trim();
      });

    let text = await extractText();

    // SPA auto-retry: if text is empty after domcontentloaded, wait for network idle
    if (text.length === 0 && waitFor !== "networkidle") {
      log("INFO", `${BROWSER_LOG_PREFIX} Empty content — waiting for networkidle (SPA)`);
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      text = await extractText();
    }

    const truncatedText =
      text.length > MAX_TEXT
        ? text.slice(0, MAX_TEXT) +
          `\n\n...(text truncated at ${MAX_TEXT} chars — ${text.length} total)`
        : text;

    const resultContent = [
      {
        type: "text",
        text: `Page: ${title}\nURL: ${finalUrl}\n\n${truncatedText}`,
      },
    ];

    if (includeScreenshot) {
      const shot = await page.screenshot({ type: "jpeg", quality: 75, fullPage: false });
      const shotB64 = shot.toString("base64");
      resultContent.push({ type: "image", mimeType: "image/jpeg", data: shotB64 });
      resultContent.push({ type: "image_for_analysis", mimeType: "image/jpeg", data: shotB64 });
    }

    log(
      "INFO",
      `${BROWSER_LOG_PREFIX} Done: "${title}" text=${text.length}chars screenshot=${includeScreenshot}`,
    );

    // Persist session for interaction tools; keyed by clientKey (falls back to a fixed key)
    await _storeBrowserSession(clientKey || "default", browser, page);

    return { success: true, result: { content: resultContent } };
  } catch (err) {
    log("ERROR", `${BROWSER_LOG_PREFIX} Playwright failed: ${err.message}`);
    if (browser) { try { await browser.close(); } catch {} }
    return {
      success: false,
      result: {
        content: [{ type: "text", text: `Browser error: ${err.message}` }],
      },
    };
  }
}

// ── Shared helper: snapshot the current page ──────────────────────────────

async function _pageSnapshot(page, log) {
  const title = await page.title().catch(() => "");
  const finalUrl = page.url();
  const text = await page.evaluate(() => {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
    return (clone.innerText || clone.textContent || "").trim();
  }).catch(() => "");
  // Extract current form field values so the model can see what's filled
  const formFields = await page.evaluate(() => {
    return [...document.querySelectorAll("input, textarea, select")]
      .filter((el) => el.offsetParent !== null) // visible only
      .map((el) => ({
        id: el.id || el.name || el.placeholder || "?",
        type: el.type || "text",
        value: el.value || "",
      }))
      .filter((f) => f.value);
  }).catch(() => []);
  const truncated = text.length > 10000
    ? text.slice(0, 10000) + `\n\n...(truncated at 10000 chars)`
    : text;
  const shot = await page.screenshot({ type: "jpeg", quality: 75, fullPage: false });
  const shotB64 = shot.toString("base64");
  log("INFO", `${BROWSER_LOG_PREFIX} Snapshot: "${title}" text=${text.length}chars`);
  let formSummary = "";
  if (formFields.length > 0) {
    const fieldLines = formFields.map((f) => {
      const display = f.type === "password" ? "***" : f.value;
      return `  ${f.id} (${f.type}): "${display}"`;
    });
    formSummary = `\nForm fields currently filled:\n${fieldLines.join("\n")}\n`;
  }
  return {
    content: [
      { type: "text", text: `Page: ${title}\nURL: ${finalUrl}\n${formSummary}\n${truncated}` },
      { type: "image", mimeType: "image/jpeg", data: shotB64 },
      { type: "image_for_analysis", mimeType: "image/jpeg", data: shotB64 },
    ],
  };
}

function _noSessionError() {
  return {
    success: false,
    result: {
      content: [{ type: "text", text: "No active browser session. Call browse_url first to open a page." }],
    },
  };
}

// ── browser_snapshot ──────────────────────────────────────────────────────

async function browserSnapshotTool(args, config, log, clientKey) {
  if (!config.agentBrowser?.enabled) {
    return { success: false, result: { content: [{ type: "text", text: "Agent Web Browser is disabled. Enable it in Settings → General." }] } };
  }
  const session = _getBrowserSession(clientKey || "default");
  if (!session) return _noSessionError();
  try {
    const result = await _pageSnapshot(session.page, log);
    return { success: true, result };
  } catch (err) {
    await _closeBrowserSession(clientKey || "default");
    log("ERROR", `${BROWSER_LOG_PREFIX} Snapshot failed: ${err.message}`);
    return { success: false, result: { content: [{ type: "text", text: `Snapshot error: ${err.message}` }] } };
  }
}

// ── browser_click ─────────────────────────────────────────────────────────

async function browserClickTool(args, config, log, clientKey) {
  if (!config.agentBrowser?.enabled) {
    return { success: false, result: { content: [{ type: "text", text: "Agent Web Browser is disabled. Enable it in Settings → General." }] } };
  }
  const session = _getBrowserSession(clientKey || "default");
  if (!session) return _noSessionError();

  const { selector, text } = args;
  if (!selector && !text) {
    return { success: false, result: { content: [{ type: "text", text: 'Error: provide "selector" (CSS) or "text" (visible text) to click.' }] } };
  }

  try {
    const page = session.page;
    if (selector) {
      await page.click(selector, { timeout: 10000, force: true });
    } else {
      // Prefer interactive elements (buttons, submit inputs) over plain text links/spans
      const interactiveLocator = page
        .locator(`button, [role="button"], input[type="submit"], a`)
        .filter({ hasText: text });
      const count = await interactiveLocator.count().catch(() => 0);
      if (count > 0) {
        await interactiveLocator.first().click({ timeout: 10000, force: true });
      } else {
        await page.getByText(text, { exact: false }).first().click({ timeout: 10000, force: true });
      }
    }
    // Wait for navigation (if click triggered one) or network to settle
    await Promise.race([
      page.waitForNavigation({ timeout: 5000, waitUntil: "domcontentloaded" }),
      new Promise((resolve) => setTimeout(resolve, 1200)),
    ]).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
    log("INFO", `${BROWSER_LOG_PREFIX} Clicked: ${selector || `"${text}"`}`);
    const result = await _pageSnapshot(page, log);
    return { success: true, result };
  } catch (err) {
    log("ERROR", `${BROWSER_LOG_PREFIX} Click failed: ${err.message}`);
    return { success: false, result: { content: [{ type: "text", text: `Click error: ${err.message}` }] } };
  }
}

// ── browser_type ──────────────────────────────────────────────────────────

async function browserTypeTool(args, config, log, clientKey) {
  if (!config.agentBrowser?.enabled) {
    return { success: false, result: { content: [{ type: "text", text: "Agent Web Browser is disabled. Enable it in Settings → General." }] } };
  }
  const session = _getBrowserSession(clientKey || "default");
  if (!session) return _noSessionError();

  const { selector, text, clear = false, pressEnter = false } = args;
  if (!selector) return { success: false, result: { content: [{ type: "text", text: 'Error: "selector" is required.' }] } };
  if (typeof text !== "string") return { success: false, result: { content: [{ type: "text", text: 'Error: "text" is required.' }] } };

  try {
    const page = session.page;
    // Clear then type character-by-character via keyboard to reliably trigger React onChange
    await page.locator(selector).clear({ timeout: 10000 });
    await page.locator(selector).pressSequentially(text, { delay: 30 });
    if (pressEnter) {
      await page.keyboard.press("Enter");
      await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
    }
    log("INFO", `${BROWSER_LOG_PREFIX} Typed into ${selector} (${text.length} chars)${pressEnter ? " + Enter" : ""}`);
    const result = await _pageSnapshot(page, log);
    // Prepend explicit action confirmation so the model knows the field is filled
    const masked = selector.toLowerCase().includes("pass") ? "***" : text;
    const confirmation = `✅ Action completed: typed "${masked}" into "${selector}".${pressEnter ? " Pressed Enter." : " Field is now filled."}\n\n`;
    if (result.content[0]?.type === "text") {
      result.content[0].text = confirmation + result.content[0].text;
    }
    return { success: true, result };
  } catch (err) {
    log("ERROR", `${BROWSER_LOG_PREFIX} Type failed: ${err.message}`);
    return { success: false, result: { content: [{ type: "text", text: `Type error: ${err.message}` }] } };
  }
}

// ── browser_scroll ────────────────────────────────────────────────────────

async function browserScrollTool(args, config, log, clientKey) {
  if (!config.agentBrowser?.enabled) {
    return { success: false, result: { content: [{ type: "text", text: "Agent Web Browser is disabled. Enable it in Settings → General." }] } };
  }
  const session = _getBrowserSession(clientKey || "default");
  if (!session) return _noSessionError();

  const VALID_DIRS = ["up", "down", "top", "bottom"];
  const direction = VALID_DIRS.includes(args.direction) ? args.direction : "down";
  const amount = Math.min(Math.abs(parseInt(args.amount, 10) || 500), 5000);

  try {
    const page = session.page;
    if (direction === "top") {
      await page.evaluate(() => window.scrollTo(0, 0));
    } else if (direction === "bottom") {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    } else {
      const delta = direction === "down" ? amount : -amount;
      await page.evaluate((d) => window.scrollBy(0, d), delta);
    }
    log("INFO", `${BROWSER_LOG_PREFIX} Scrolled ${direction}${direction === "top" || direction === "bottom" ? "" : ` ${amount}px`}`);
    const result = await _pageSnapshot(page, log);
    return { success: true, result };
  } catch (err) {
    log("ERROR", `${BROWSER_LOG_PREFIX} Scroll failed: ${err.message}`);
    return { success: false, result: { content: [{ type: "text", text: `Scroll error: ${err.message}` }] } };
  }
}

// HTTP fetch fallback — used when Playwright is unavailable (packaged app)
async function browseUrlFetch(url, timeoutMs, maxText, log) {
  log("INFO", `${BROWSER_LOG_PREFIX} Fetch fallback: ${url}`);
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!resp.ok) {
      return {
        success: false,
        result: {
          content: [
            { type: "text", text: `HTTP ${resp.status} ${resp.statusText} — ${url}` },
          ],
        },
      };
    }

    const html = await resp.text();
    // Extract page title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "(no title)";
    // Strip tags → readable text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s{2,}/g, " ")
      .trim();

    const truncated =
      text.length > maxText
        ? text.slice(0, maxText) +
          `\n\n...(text truncated at ${maxText} chars — ${text.length} total)`
        : text;

    log(
      "INFO",
      `${BROWSER_LOG_PREFIX} Fetch done: "${title}" text=${text.length}chars (no screenshot — headless browser unavailable)`,
    );

    return {
      success: true,
      result: {
        content: [
          {
            type: "text",
            text: `Page: ${title}\nURL: ${resp.url}\nNote: screenshot unavailable — headless browser not installed in this environment.\n\n${truncated}`,
          },
        ],
      },
    };
  } catch (err) {
    log("ERROR", `${BROWSER_LOG_PREFIX} Fetch failed: ${err.message}`);
    return {
      success: false,
      result: {
        content: [{ type: "text", text: `Failed to fetch URL: ${err.message}` }],
      },
    };
  }
}

/**
 * Set of builtin tool names that must NEVER run in parallel.
 * Source of truth derived from BUILTIN_TOOLS entries where parallelSafe === false.
 * Consumed by lib/tool-call-handler.js segmentToolCalls() — do not duplicate.
 */
const RISKY_BUILTIN_NAMES = new Set(
  BUILTIN_TOOLS.filter((t) => t.parallelSafe === false).map((t) => t.name),
);

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
  RISKY_BUILTIN_NAMES,
};
