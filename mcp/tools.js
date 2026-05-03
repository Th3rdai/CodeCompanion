const { SYSTEM_PROMPTS } = require("../lib/prompts");
const { effectiveOllamaApiKey } = require("../lib/ollama-client");
const { executeBuiltinTool } = require("../lib/builtin-agent-tools");
const {
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
} = require("./schemas");

const RESPONSE_CAP = 25000;

function capResponse(text) {
  if (text.length > RESPONSE_CAP) {
    return (
      text.substring(0, RESPONSE_CAP) +
      "\n\n[Response truncated — exceeded 25000 character limit]"
    );
  }
  return text;
}

// Convert browser tool result to MCP response format (image_for_analysis → image)
function _browserMcpResult(result) {
  if (result?.result?.content) {
    const content = result.result.content
      .filter((item) => item.type !== "image") // strip display-only; keep text + image_for_analysis
      .map((item) =>
        item.type === "image_for_analysis"
          ? { type: "image", data: item.data, mimeType: item.mimeType }
          : item,
      );
    return { isError: !result.success, content };
  }
  return {
    isError: true,
    content: [{ type: "text", text: "Unexpected result from browser tool." }],
  };
}

/**
 * Resolve model name — if user didn't specify one, use config default or first available.
 * Returns the model name string, or null if no models available.
 */
async function resolveModel(model, listModelsFn, ollamaUrl, config) {
  if (model) return model;
  if (config?.selectedModel) return config.selectedModel;
  const auth = effectiveOllamaApiKey(config)
    ? { apiKey: effectiveOllamaApiKey(config) }
    : {};
  const models = await listModelsFn(ollamaUrl, auth);
  if (!models || models.length === 0) return null;
  return models[0].name; // models are objects {name, size, ...}
}

/**
 * Create a mode tool handler (shared logic for all 6 mode tools)
 */
function createModeHandler(modeKey, deps) {
  const { getConfig, debug, listModels, chatComplete } = deps;

  return async ({ content, model, context }) => {
    try {
      const config = getConfig();
      const ollamaUrl = config.ollamaUrl || "http://localhost:11434";

      const selectedModel = await resolveModel(
        model,
        listModels,
        ollamaUrl,
        config,
      );
      if (!selectedModel) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Error: No Ollama models available. Make sure Ollama is running (try: ollama serve).",
            },
          ],
        };
      }

      const messages = [
        { role: "system", content: SYSTEM_PROMPTS[modeKey] },
        ...(context
          ? [{ role: "system", content: `Context: ${context}` }]
          : []),
        { role: "user", content },
      ];

      const auth = effectiveOllamaApiKey(config)
        ? { apiKey: effectiveOllamaApiKey(config) }
        : {};
      const response = await chatComplete(
        ollamaUrl,
        selectedModel,
        messages,
        120000,
        [],
        auth,
      );
      return { content: [{ type: "text", text: capResponse(response) }] };
    } catch (err) {
      debug(`${modeKey} tool error`, { error: err.message });
      const msg =
        err.name === "AbortError"
          ? "Error: Request timed out. The model may be too slow or the input too large."
          : `Error: Cannot reach Ollama at ${getConfig().ollamaUrl || "http://localhost:11434"}. Make sure Ollama is running (try: ollama serve). Detail: ${err.message}`;
      return { isError: true, content: [{ type: "text", text: msg }] };
    }
  };
}

const ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

/**
 * Register all MCP tools on the given McpServer instance.
 * @param {McpServer} server
 * @param {object} deps - shared dependencies
 * @param {string[]} disabledTools - tool names to skip
 */
function registerAllTools(server, deps, disabledTools = []) {
  const {
    getConfig,
    log: _log,
    debug: _debug,
    listModels,
    chatComplete: _chatComplete,
    checkConnection,
    buildFileTree,
    readProjectFile,
    listConversations,
  } = deps;

  function register(name, description, schema, handler) {
    if (disabledTools.includes(name)) return;
    server.tool(
      name,
      description,
      schema,
      { annotations: ANNOTATIONS },
      handler,
    );
  }

  // ===== 6 Mode Tools =====

  register(
    "codecompanion_chat",
    "General conversational mode for PMs. Ask questions, get advice, brainstorm ideas about code and technology.",
    modeToolSchema,
    createModeHandler("chat", deps),
  );

  register(
    "codecompanion_explain",
    "Explains code in plain English for PMs and non-technical stakeholders. Returns structured breakdown: What It Does, How It Works, Business Impact.",
    modeToolSchema,
    createModeHandler("explain", deps),
  );

  register(
    "codecompanion_find_bugs",
    "Reviews code for bugs, security issues, and edge cases. Returns severity-ranked issues with user impact and suggested fixes.",
    modeToolSchema,
    createModeHandler("bugs", deps),
  );

  register(
    "codecompanion_refactor",
    "Suggests refactoring improvements for code clarity, performance, and maintainability. Returns refactored code with explanations.",
    modeToolSchema,
    createModeHandler("refactor", deps),
  );

  register(
    "codecompanion_tech_to_biz",
    "Translates technical content (PRs, specs, code) into business language. Returns business summary, user impact, risks, and talking points.",
    modeToolSchema,
    createModeHandler("translate-tech", deps),
  );

  register(
    "codecompanion_biz_to_tech",
    "Translates business requirements into technical specifications. Returns tech requirements, architecture, acceptance criteria, and complexity estimate.",
    modeToolSchema,
    createModeHandler("translate-biz", deps),
  );

  // ===== 5 Utility Tools =====

  register(
    "codecompanion_list_models",
    "Lists all available Ollama models with their sizes and families.",
    listModelsSchema,
    async () => {
      try {
        const config = getConfig();
        const ollamaUrl = config.ollamaUrl || "http://localhost:11434";
        const auth = effectiveOllamaApiKey(config)
          ? { apiKey: effectiveOllamaApiKey(config) }
          : {};
        const models = await listModels(ollamaUrl, auth);

        if (models.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No Ollama models found. Pull a model with: ollama pull llama3.2",
              },
            ],
          };
        }

        const formatted = models
          .map(
            (m, i) =>
              `${i + 1}. ${m.name} (${m.size}GB, ${m.family}${m.paramSize ? ", " + m.paramSize : ""})`,
          )
          .join("\n");

        return {
          content: [
            { type: "text", text: `Available Ollama Models:\n${formatted}` },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            { type: "text", text: `Error listing models: ${err.message}` },
          ],
        };
      }
    },
  );

  register(
    "codecompanion_get_status",
    "Returns Ollama connection status and current Th3rdAI Code Companion configuration.",
    getStatusSchema,
    async () => {
      try {
        const config = getConfig();
        const ollamaUrl = config.ollamaUrl || "http://localhost:11434";
        const auth = effectiveOllamaApiKey(config)
          ? { apiKey: effectiveOllamaApiKey(config) }
          : {};
        const status = await checkConnection(ollamaUrl, auth);

        const response = `Th3rdAI Code Companion Status:
- Ollama: ${status.connected ? `Connected (${status.modelCount} model${status.modelCount !== 1 ? "s" : ""})` : "Disconnected"}
- Ollama URL: ${ollamaUrl}
- Project Folder: ${config.projectFolder || "Not set"}
- MCP Server: Active`;

        return { content: [{ type: "text", text: response }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${err.message}` }],
        };
      }
    },
  );

  register(
    "codecompanion_browse_files",
    "Lists the project file tree. Returns directories and text files, respecting ignore lists (node_modules, .git, etc.).",
    browseFilesSchema,
    async ({ path: subPath, depth }) => {
      try {
        const config = getConfig();
        const projectFolder = config.projectFolder;
        if (!projectFolder) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Error: No project folder configured. Set one in Th3rdAI Code Companion settings.",
              },
            ],
          };
        }

        const targetFolder = subPath
          ? require("path").join(projectFolder, subPath)
          : projectFolder;

        const result = buildFileTree(targetFolder, depth || 3);

        // Format tree as readable text
        function formatTree(items, indent = "") {
          let out = "";
          for (const item of items) {
            if (item.type === "dir") {
              out += `${indent}📁 ${item.name}/\n`;
              if (item.children)
                out += formatTree(item.children, indent + "  ");
            } else {
              out += `${indent}📄 ${item.name} (${item.size > 1024 ? Math.round(item.size / 1024) + "KB" : item.size + "B"})\n`;
            }
          }
          return out;
        }

        const text = `Project: ${result.root}\n\n${formatTree(result.tree)}`;
        return { content: [{ type: "text", text: capResponse(text) }] };
      } catch (err) {
        return {
          isError: true,
          content: [
            { type: "text", text: `Error browsing files: ${err.message}` },
          ],
        };
      }
    },
  );

  register(
    "codecompanion_read_file",
    "Reads a file from the project folder. Returns file contents with metadata. 500KB size limit.",
    readFileSchema,
    async ({ path: filePath }) => {
      try {
        const config = getConfig();
        const projectFolder = config.projectFolder;
        if (!projectFolder) {
          return {
            isError: true,
            content: [
              { type: "text", text: "Error: No project folder configured." },
            ],
          };
        }

        const result = readProjectFile(projectFolder, filePath);
        const header = `File: ${result.name} (${result.lines} lines, ${result.size} bytes${result.truncated ? ", TRUNCATED" : ""})\n\n`;
        return {
          content: [
            { type: "text", text: capResponse(header + result.content) },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            { type: "text", text: `Error reading file: ${err.message}` },
          ],
        };
      }
    },
  );

  register(
    "codecompanion_list_conversations",
    "Lists saved conversation history from the Th3rdAI Code Companion web UI (read-only).",
    listConversationsSchema,
    async () => {
      try {
        const conversations = listConversations();

        if (conversations.length === 0) {
          return {
            content: [{ type: "text", text: "No conversations stored yet." }],
          };
        }

        const formatted = conversations
          .map(
            (c) =>
              `- ${c.title || "(untitled)"} [${c.mode}] — ${new Date(c.createdAt).toLocaleDateString()}${c.archived ? " (archived)" : ""}`,
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Saved Conversations (${conversations.length}):\n${formatted}`,
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${err.message}` }],
        };
      }
    },
  );

  register(
    "codecompanion_run_terminal_cmd",
    "Run a shell command in the configured project folder. Commands must appear in the agent terminal allowlist (Settings → General → Agent Terminal). Agent Terminal must be enabled. Returns stdout/stderr and exit code. Set background:true for long-running processes (dev servers, watchers) to spawn-and-return with the PID instead of blocking until exit.",
    runTerminalCmdSchema,
    async ({
      command,
      args = [],
      cwd,
      timeoutMs = 30000,
      background = false,
      startupWaitMs = 2000,
    }) => {
      try {
        const config = getConfig();
        if (!config.agentTerminal?.enabled) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Agent Terminal is disabled. Enable it in Settings → General → Agent Terminal.",
              },
            ],
          };
        }

        const collectingCtx = {
          onStart: () => {},
          onData: () => {},
          onStatus: () => {},
        };

        const result = await executeBuiltinTool(
          "run_terminal_cmd",
          { command, args, cwd, timeoutMs, background, startupWaitMs },
          config,
          _log,
          "mcp",
          collectingCtx,
        );

        if (result?.result?.content) {
          return {
            isError: !result.success,
            content: result.result.content,
          };
        }

        return {
          isError: true,
          content: [
            { type: "text", text: "Unexpected result from terminal tool." },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${err.message}` }],
        };
      }
    },
  );

  register(
    "codecompanion_kill_process",
    "Stop a background process previously started by run_terminal_cmd with background:true. Sends SIGTERM, escalates to SIGKILL after 3s. Refuses PIDs not tracked by this server.",
    killProcessSchema,
    async ({ pid }) => {
      try {
        const config = getConfig();
        if (!config.agentTerminal?.enabled) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Agent Terminal is disabled. Enable it in Settings → General → Agent Terminal.",
              },
            ],
          };
        }
        const result = await executeBuiltinTool(
          "kill_process",
          { pid },
          config,
          _log,
          "mcp",
          {},
        );
        if (result?.result?.content) {
          return { isError: !result.success, content: result.result.content };
        }
        return {
          isError: true,
          content: [
            { type: "text", text: "Unexpected result from kill tool." },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${err.message}` }],
        };
      }
    },
  );

  register(
    "codecompanion_tail_process_output",
    "Read the last N lines of stdout+stderr from a background process previously started by run_terminal_cmd with background:true. Returns process status (running / exited / killed) and recent output.",
    tailProcessOutputSchema,
    async ({ pid, lines = 50 }) => {
      try {
        const config = getConfig();
        if (!config.agentTerminal?.enabled) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Agent Terminal is disabled. Enable it in Settings → General → Agent Terminal.",
              },
            ],
          };
        }
        const result = await executeBuiltinTool(
          "tail_process_output",
          { pid, lines },
          config,
          _log,
          "mcp",
          {},
        );
        if (result?.result?.content) {
          return { isError: !result.success, content: result.result.content };
        }
        return {
          isError: true,
          content: [
            { type: "text", text: "Unexpected result from tail tool." },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${err.message}` }],
        };
      }
    },
  );

  register(
    "codecompanion_browse_url",
    "Open a URL in a headless browser and return the page title, text content, and a screenshot for visual analysis. Use for visiting websites, reading live content, and analyzing web pages.",
    browseUrlSchema,
    async ({
      url,
      waitFor = "domcontentloaded",
      screenshot = true,
      timeoutMs = 30000,
    }) => {
      try {
        const config = getConfig();
        if (!config.agentBrowser?.enabled) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Agent Web Browser is disabled. Enable it in Settings → General → Agent Web Browser.",
              },
            ],
          };
        }
        const result = await executeBuiltinTool(
          "browse_url",
          { url, waitFor, screenshot, timeoutMs },
          config,
          _log,
          "mcp",
          {},
        );
        if (result?.result?.content) {
          // Convert image_for_analysis → MCP image type for external MCP clients
          const content = result.result.content.map((item) =>
            item.type === "image_for_analysis"
              ? { type: "image", data: item.data, mimeType: item.mimeType }
              : item,
          );
          return { isError: !result.success, content };
        }
        return {
          isError: true,
          content: [
            { type: "text", text: "Unexpected result from browser tool." },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${err.message}` }],
        };
      }
    },
  );
  register(
    "codecompanion_browser_snapshot",
    "Take a screenshot of the current browser page and return its visible text. Requires an active session (call codecompanion_browse_url first).",
    browserSnapshotSchema,
    async () => {
      const config = getConfig();
      const result = await executeBuiltinTool(
        "browser_snapshot",
        {},
        config,
        _log,
        "mcp",
        {},
      );
      return _browserMcpResult(result);
    },
  );

  register(
    "codecompanion_browser_click",
    "Click an element on the current browser page by CSS selector or visible text. Returns a screenshot of the result. Requires an active session.",
    browserClickSchema,
    async ({ selector, text }) => {
      const config = getConfig();
      const result = await executeBuiltinTool(
        "browser_click",
        { selector, text },
        config,
        _log,
        "mcp",
        {},
      );
      return _browserMcpResult(result);
    },
  );

  register(
    "codecompanion_browser_type",
    "Type text into a field on the current browser page. Returns a screenshot of the result. Requires an active session.",
    browserTypeSchema,
    async ({ selector, text, clear = false, pressEnter = false }) => {
      const config = getConfig();
      const result = await executeBuiltinTool(
        "browser_type",
        { selector, text, clear, pressEnter },
        config,
        _log,
        "mcp",
        {},
      );
      return _browserMcpResult(result);
    },
  );

  register(
    "codecompanion_browser_scroll",
    "Scroll the current browser page. Returns a screenshot of the result. Requires an active session.",
    browserScrollSchema,
    async ({ direction = "down", amount = 500 }) => {
      const config = getConfig();
      const result = await executeBuiltinTool(
        "browser_scroll",
        { direction, amount },
        config,
        _log,
        "mcp",
        {},
      );
      return _browserMcpResult(result);
    },
  );
}

module.exports = { registerAllTools };
