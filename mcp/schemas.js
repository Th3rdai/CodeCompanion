const { z } = require("zod");

// Shared parameter schemas
const modelParam = z
  .string()
  .optional()
  .describe("Ollama model name (defaults to first available model)");
const contentParam = z
  .string()
  .min(1)
  .describe("The code, text, or question to process");
const contextParam = z
  .string()
  .optional()
  .describe('Additional context (e.g., "this is from our payments service")');

// Mode tool schema (shared by all 6 mode tools)
const modeToolSchema = {
  content: contentParam,
  model: modelParam,
  context: contextParam,
};

// Utility tool schemas
const browseFilesSchema = {
  path: z
    .string()
    .optional()
    .describe("Subfolder path to list (defaults to project root)"),
  depth: z.number().optional().describe("Max directory depth (default 3)"),
};

const readFileSchema = {
  path: z.string().describe("Relative file path within the project folder"),
};

const listModelsSchema = {}; // no params

const getStatusSchema = {}; // no params

const listConversationsSchema = {}; // no params

const runTerminalCmdSchema = {
  command: z
    .string()
    .describe(
      "The command to execute (e.g. 'npm', 'git', 'ls'). Must be in the agent terminal allowlist.",
    ),
  args: z
    .array(z.string())
    .default([])
    .describe(
      "Arguments to pass to the command (e.g. ['test'] for 'npm test').",
    ),
  cwd: z
    .string()
    .optional()
    .describe(
      "Optional subdirectory within the project folder to run the command in.",
    ),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .default(30000)
    .describe(
      "Command timeout in milliseconds (foreground only). Capped by Settings → Agent Terminal → Command Timeout.",
    ),
  background: z
    .boolean()
    .default(false)
    .describe(
      "If true, spawn as a long-running background process (dev server, watcher) and return immediately with the PID and first ~2s of output. Use kill_process and tail_process_output to manage it later. Required for any command that does not exit on its own (npm run dev, node server.js, vite, etc.).",
    ),
  startupWaitMs: z
    .number()
    .int()
    .positive()
    .default(2000)
    .describe(
      "When background:true, how many milliseconds to capture initial output before returning (clamped 250–10000). Ignored in foreground mode.",
    ),
};

const killProcessSchema = {
  pid: z
    .number()
    .int()
    .positive()
    .describe(
      "PID of a background process previously started by run_terminal_cmd with background:true. Refuses PIDs not tracked by this server.",
    ),
};

const tailProcessOutputSchema = {
  pid: z
    .number()
    .int()
    .positive()
    .describe(
      "PID of a background process previously started by run_terminal_cmd with background:true.",
    ),
  lines: z
    .number()
    .int()
    .positive()
    .default(50)
    .describe("Number of trailing lines to return (max 1000)."),
};

const browseUrlSchema = {
  url: z
    .string()
    .describe(
      "The URL to open (http:// or https:// only; localhost and private IPs are blocked)",
    ),
  waitFor: z
    .enum(["load", "domcontentloaded", "networkidle"])
    .default("domcontentloaded")
    .describe(
      'When to consider navigation complete: "domcontentloaded" (fast), "load" (all resources), "networkidle" (JS-heavy SPAs)',
    ),
  screenshot: z
    .boolean()
    .default(true)
    .describe("Include a JPEG screenshot of the page in the response"),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .default(30000)
    .describe("Navigation timeout in milliseconds (max 60000)"),
};

const browserSnapshotSchema = {};

const browserClickSchema = {
  selector: z
    .string()
    .optional()
    .describe("CSS selector of the element to click"),
  text: z
    .string()
    .optional()
    .describe(
      "Visible text of the element to click (used if selector not provided)",
    ),
};

const browserTypeSchema = {
  selector: z.string().describe("CSS selector of the input field to type into"),
  text: z.string().describe("Text to type into the field"),
  clear: z.boolean().default(false).describe("Clear the field before typing"),
  pressEnter: z.boolean().default(false).describe("Press Enter after typing"),
};

const browserScrollSchema = {
  direction: z
    .enum(["up", "down", "top", "bottom"])
    .default("down")
    .describe("Scroll direction"),
  amount: z
    .number()
    .int()
    .positive()
    .default(500)
    .describe("Pixels to scroll (ignored for top/bottom)"),
};

module.exports = {
  modeToolSchema,
  browseFilesSchema,
  readFileSchema,
  listModelsSchema,
  getStatusSchema,
  listConversationsSchema,
  runTerminalCmdSchema,
  killProcessSchema,
  tailProcessOutputSchema,
  browseUrlSchema,
  browserSnapshotSchema,
  browserClickSchema,
  browserTypeSchema,
  browserScrollSchema,
};
