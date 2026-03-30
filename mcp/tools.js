const { SYSTEM_PROMPTS } = require("../lib/prompts");
const { effectiveOllamaApiKey } = require("../lib/ollama-client");
const {
  modeToolSchema,
  browseFilesSchema,
  readFileSchema,
  listModelsSchema,
  getStatusSchema,
  listConversationsSchema,
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
    log,
    debug,
    listModels,
    chatComplete,
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
}

module.exports = { registerAllTools };
