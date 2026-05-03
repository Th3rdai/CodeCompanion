const {
  getBuiltinTools,
  getBuiltinSafetyPreamble,
  executeBuiltinTool,
  enforceExperimentScope,
  RISKY_BUILTIN_NAMES,
} = require("./builtin-agent-tools");
const { getAgentInteractionRoot } = require("./agent-interaction-root");

const TOOL_CALL_HEADER = /TOOL_CALL:\s*(\S+?)\.(\S+?)\(/g;
// Fallback: XML-style <server.tool> {...} </server.tool> (some cloud models use this)
const XML_TOOL_CALL = /<(\w+)\.(\w+)>\s*(\{[\s\S]*?\})\s*<\/\1\.\2>/g;
// Fallback: minimax native format — <minimax:tool_call><invoke name="server.tool">{...}</invoke></minimax:tool_call>
const MINIMAX_TOOL_CALL =
  /<minimax:tool_call>\s*<invoke\s+name="([^"]+)">\s*(\{[\s\S]*?\})\s*<\/invoke>\s*<\/minimax:tool_call>/g;
const MINIMAX_TOOL_CALL_BLOCK =
  /<minimax:tool_call>([\s\S]*?)<\/minimax:tool_call>/g;
const MINIMAX_INVOKE = /<invoke\s+name="([^"]+)">\s*([\s\S]*?)\s*<\/invoke>/g;
const MINIMAX_PARAMETER =
  /<parameter\s+name="([^"]+)">\s*([\s\S]*?)\s*<\/parameter>/g;
/** MiniMax sometimes emits <path">…</path> / <content>…</content> instead of <parameter> tags. */
const MINIMAX_SLOPPY_PATH = /<path"?\s*>([\s\S]*?)<\/path>/i;
const MINIMAX_SLOPPY_CONTENT = /<content"?\s*>([\s\S]*?)<\/content>/i;
/** Bracket form some models use instead of TOOL_CALL: … (see debug.log minimax samples). */
const BRACKET_TOOL_CALL_BLOCK = /\[TOOL_CALL\]\s*([\s\S]*?)\[\/TOOL_CALL\]/g;
const COMPACT_EXTERNAL_SERVER_TOOL_COUNT = 40;
const DETAILED_DESCRIPTION_MAX_CHARS = 200;
const COMPACT_DESCRIPTION_MAX_CHARS = 40;

/** Crawl4AI RAG MCP (and similar): web search / crawl / extract without Playwright UI driving. */
const CRAWL_RESEARCH_MCP_TOOL_NAMES = new Set([
  "search_web",
  "web_search",
  "crawl_website",
  "extract_content",
  "get_available_sources",
]);

function pickMcpCrawlResearchExampleCall(mcpTools) {
  const order = [
    "search_web",
    "web_search",
    "crawl_website",
    "extract_content",
    "get_available_sources",
  ];
  for (const name of order) {
    const t = mcpTools.find((x) => x.name === name);
    if (t) return `${t.serverId}.${t.name}`;
  }
  return "";
}

/** Prevent hung MCP servers from blocking chat forever (ms). Override with MCP_TOOL_TIMEOUT_MS (min 50). */
const MCP_TOOL_TIMEOUT_MS = (() => {
  const raw = process.env.MCP_TOOL_TIMEOUT_MS;
  if (raw === undefined || raw === "") return 120000;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(50, n) : 120000;
})();
const MCP_TOOL_MAX_RETRIES = (() => {
  const raw = process.env.MCP_TOOL_MAX_RETRIES;
  if (raw === undefined || raw === "") return 1;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 1;
})();
const MCP_TOOL_RETRY_DELAY_MS = (() => {
  const raw = process.env.MCP_TOOL_RETRY_DELAY_MS;
  if (raw === undefined || raw === "") return 1500;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 1500;
})();
const MCP_IMAGE_TOOL_TIMEOUT_MS = (() => {
  const raw = process.env.MCP_IMAGE_TOOL_TIMEOUT_MS;
  if (raw === undefined || raw === "") return 180000;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(50, n) : 180000;
})();

/** When set on the handler instance, MCP is blocked and only these builtins run. */
const EXPERIMENT_ALLOWED_BUILTINS = new Set([
  "write_file",
  "run_terminal_cmd",
  "validate_scan_project",
  "validate_generate_command",
  "view_pdf_pages",
]);

const RETRYABLE_MCP_ERROR_RE =
  /RESOURCE_EXHAUSTED|rate.?limit|quota|429|temporarily unavailable|overloaded/i;
const TIMEOUT_MCP_ERROR_RE =
  /timed out|timeout|ETIMEDOUT|Request timed out|MCP error -32001/i;
const AUTH_MCP_ERROR_RE =
  /unauthori[sz]ed|unauthenticated|not authenticated|authentication required|authorization required|forbidden|insufficient permissions?|permission denied|access denied|OAuth|consent required|401|403/i;
const AI_STUDIO_IMAGE_FALLBACK_MODEL = "gemini-2.5-flash-image";
const AI_STUDIO_IMAGE_TOOL_NAME = "generate_content";
const LEGACY_AI_STUDIO_IMAGE_MODELS = new Set([
  "gemini-2.5-flash-image-preview",
  "gemini-2.0-flash-preview-image-generation",
]);

function createMcpCallId() {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `mcp_${now}_${rand}`;
}

function withTimeout(promise, ms, label) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      t = setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(t));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableMcpError(message) {
  const normalized = String(message || "");
  return (
    RETRYABLE_MCP_ERROR_RE.test(normalized) ||
    TIMEOUT_MCP_ERROR_RE.test(normalized)
  );
}

function getMcpToolTimeoutMs(serverId, toolName) {
  // Image generation can legitimately take longer than generic MCP calls.
  if (toolName === "generate_image") {
    return Math.max(MCP_TOOL_TIMEOUT_MS, MCP_IMAGE_TOOL_TIMEOUT_MS);
  }
  return MCP_TOOL_TIMEOUT_MS;
}

function decorateMcpToolError(serverId, toolName, rawMessage) {
  const message = String(rawMessage || "Unknown MCP tool error");
  if (/API_KEY_INVALID|API key not valid/i.test(message)) {
    return (
      `${message} ` +
      `Hint: update the provider API key (for Nano Banana, check GEMINI_API_KEY), then reconnect ${serverId} in Settings -> MCP Clients.`
    );
  }
  if (AUTH_MCP_ERROR_RE.test(message)) {
    return (
      `${message} ` +
      `Hint: this is an authorization problem, not a document-format limitation. If this is a Google Workspace, Drive, or Docs tool, call ${serverId}.start_google_auth to refresh OAuth access, then retry the original file-content/export tool. If no auth tool is available, reconnect ${serverId} in Settings -> MCP Clients.`
    );
  }
  if (isRetryableMcpError(message)) {
    if (TIMEOUT_MCP_ERROR_RE.test(message)) {
      return (
        `${message} ` +
        `Hint: this tool call timed out. Code Companion retries once automatically; if it still fails, retry with a simpler prompt or increase MCP_IMAGE_TOOL_TIMEOUT_MS.`
      );
    }
    return (
      `${message} ` +
      `Hint: provider capacity/rate limits were reached. Code Companion retries once automatically; if it still fails, wait 30-60s and retry.`
    );
  }
  return message;
}

function isGoogleAiStudioServer(serverId) {
  const normalized = String(serverId || "").toLowerCase();
  return normalized === "google-ai-studio" || normalized.includes("aistudio");
}

function wantsAiStudioImageGeneration(args) {
  if (!args || typeof args !== "object") return false;
  return args.enable_image_generation === true || args.only_image === true;
}

function normalizeMcpToolArgs(serverId, toolName, args) {
  if (!isGoogleAiStudioServer(serverId)) return args;
  if (toolName !== AI_STUDIO_IMAGE_TOOL_NAME) return args;
  if (!wantsAiStudioImageGeneration(args)) return args;

  const normalizedArgs = { ...args, enable_image_generation: true };
  const model = String(args.model || "").trim();
  const modelLower = model.toLowerCase();
  const shouldForceImageModel =
    !model ||
    LEGACY_AI_STUDIO_IMAGE_MODELS.has(model) ||
    !modelLower.includes("image");

  if (shouldForceImageModel) {
    normalizedArgs.model = AI_STUDIO_IMAGE_FALLBACK_MODEL;
  }

  return normalizedArgs;
}

function getEnumValues(schemaProperty) {
  return schemaProperty.enum || schemaProperty.anyOf?.find((a) => a.enum)?.enum;
}

function formatToolLine(tool, { compact = false } = {}) {
  const descriptionLimit = compact
    ? COMPACT_DESCRIPTION_MAX_CHARS
    : DETAILED_DESCRIPTION_MAX_CHARS;
  let line = compact
    ? `- ${tool.serverId}.${tool.name}`
    : `- ${tool.serverId}.${tool.name}: ${(tool.description || "No description").split("\n")[0].slice(0, descriptionLimit)}`;

  const schema = tool.inputSchema;
  if (!schema || !schema.properties) return line;

  const required = new Set(schema.required || []);
  const params = [];
  for (const [key, value] of Object.entries(schema.properties)) {
    const enumVals = getEnumValues(value);
    const isRequired = required.has(key);

    if (compact && !isRequired && !enumVals) continue;
    if (!compact && !isRequired && !enumVals && params.length >= 4) continue;

    let desc = isRequired ? `${key} (required)` : key;
    if (enumVals) {
      const shown = enumVals.slice(0, compact ? 5 : 8);
      desc += `: ${shown.join("|")}${enumVals.length > shown.length ? "|..." : ""}`;
    } else if (value.type && !compact) {
      desc += `: ${value.type}`;
    }
    params.push(desc);
    if (compact && params.length >= 6) break;
  }

  if (params.length > 0) {
    line += ` | Params: ${params.join(", ")}`;
  }
  return line;
}

/**
 * MiniMax sometimes omits <parameter> wrappers and emits `<path">…</path>` or `<content>…</content>`.
 */
function mergeMinimaxSloppyInvokeTags(inner, args) {
  const out = { ...args };
  const pathM = inner.match(MINIMAX_SLOPPY_PATH);
  if (pathM && (out.path == null || String(out.path).trim() === "")) {
    out.path = pathM[1].trim();
  }
  const contentM = inner.match(MINIMAX_SLOPPY_CONTENT);
  if (contentM && (out.content == null || String(out.content).trim() === "")) {
    out.content = contentM[1].trim();
  }
  return out;
}

class ToolCallHandler {
  constructor(mcpClientManager, { log, debug, getConfig } = {}) {
    this.mcpClient = mcpClientManager;
    this.log = log || (() => {});
    this.debug = debug || (() => {});
    this.getConfig = getConfig || (() => ({}));
    this.clientKey = null;
    /** SSE context set by routes/chat.js before each tool loop: { onStart, onData, onStatus, logDir, confirmCallback } */
    this.sseContext = null;
  }

  /**
   * True when at least one **connected** external MCP server exposes a tool (after disabledTools).
   * Used by chat Auto-model resolution: cloud defaults in autoModelMap should yield to
   * TOOL_CALL-capable locals when MCP tools are actually available (see lib/auto-model.js).
   */
  hasExternalMcpTools() {
    const config = this.getConfig();
    const disabledToolsMap = {};
    for (const c of config.mcpClients || []) {
      if (Array.isArray(c.disabledTools) && c.disabledTools.length > 0) {
        disabledToolsMap[c.id] = c.disabledTools;
      }
    }
    return this.mcpClient.getAllTools(disabledToolsMap).length > 0;
  }

  // Try to parse args as JSON, falling back to flexible key=value parsing
  _parseArgs(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return {};

    // Try standard JSON first
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      /* fall through */
    }

    // AI models often put literal newlines/tabs inside JSON string values.
    // Escape them so JSON.parse succeeds.
    try {
      const fixed = trimmed.replace(/"(?:[^"\\]|\\.)*"/g, (m) =>
        m.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t"),
      );
      return JSON.parse(fixed);
    } catch (e) {
      /* fall through */
    }

    // Handle Python-style key="value" or key='value' — convert to JSON
    const kvPattern =
      /(\w+)\s*=\s*"([^"]*)"|(\w+)\s*=\s*'([^']*)'|(\w+)\s*=\s*(\S+)/g;
    const obj = {};
    let kvMatch;
    let found = false;
    while ((kvMatch = kvPattern.exec(trimmed)) !== null) {
      const key = kvMatch[1] || kvMatch[3] || kvMatch[5];
      const val = kvMatch[2] ?? kvMatch[4] ?? kvMatch[6];
      obj[key] = val;
      found = true;
    }
    if (found) return obj;

    // Last resort: treat the whole thing as a single string argument named "input"
    this.debug("Could not parse args, wrapping as input string", {
      raw: trimmed.slice(0, 200),
    });
    return { input: trimmed };
  }

  /**
   * Extract the balanced argument string between ( and ) after TOOL_CALL header.
   * Handles nested braces/brackets and quoted strings so JSON with parentheses
   * or newlines doesn't get truncated by a simple regex.
   */
  _extractBalancedArgs(text, startIdx) {
    let depth = 0;
    let inString = false;
    let escape = false;
    let stringChar = "";

    for (let i = startIdx; i < text.length; i++) {
      const ch = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }

      if (inString) {
        if (ch === stringChar) inString = false;
        continue;
      }

      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
        continue;
      }
      if (ch === "(" || ch === "{" || ch === "[") {
        depth++;
        continue;
      }
      if (ch === ")" || ch === "}" || ch === "]") {
        depth--;
        if (depth < 0) {
          // Found the closing ) for the TOOL_CALL
          return { args: text.slice(startIdx, i), endIdx: i + 1 };
        }
      }
    }
    // No balanced close found — take everything remaining
    return { args: text.slice(startIdx), endIdx: text.length };
  }

  // Parse TOOL_CALL: patterns from model response using balanced extraction
  parseToolCalls(text) {
    const calls = [];
    let match;

    // Primary format: TOOL_CALL: server.tool({...})
    const regex = new RegExp(TOOL_CALL_HEADER);
    while ((match = regex.exec(text)) !== null) {
      try {
        const argsStart = match.index + match[0].length;
        const { args: rawArgs } = this._extractBalancedArgs(text, argsStart);
        const args = this._parseArgs(rawArgs);
        calls.push({ serverId: match[1], toolName: match[2], args });
      } catch (e) {
        this.debug("Failed to parse tool call args", {
          raw: match[0],
          error: e.message,
        });
      }
    }

    // Bracket form: [TOOL_CALL]\nbuiltin.tool\n{...}\n[/TOOL_CALL] (some cloud models, e.g. MiniMax)
    if (calls.length === 0) {
      const brRe = new RegExp(BRACKET_TOOL_CALL_BLOCK.source, "g");
      let bm;
      while ((bm = brRe.exec(text)) !== null) {
        const body = bm[1].trim();
        const nl = body.indexOf("\n");
        const fullName = (nl === -1 ? body : body.slice(0, nl)).trim();
        const jsonPart = nl === -1 ? "" : body.slice(nl + 1).trim();
        if (!fullName.includes(".") || !jsonPart) continue;
        try {
          const args = JSON.parse(jsonPart);
          const dotIdx = fullName.indexOf(".");
          if (dotIdx > 0) {
            calls.push({
              serverId: fullName.slice(0, dotIdx),
              toolName: fullName.slice(dotIdx + 1),
              args,
            });
            this.debug("Parsed bracket [TOOL_CALL] block", { tool: fullName });
          }
        } catch (e) {
          this.debug("Failed to parse bracket [TOOL_CALL] JSON", {
            error: e.message,
            preview: jsonPart.slice(0, 160),
          });
        }
      }
    }

    // Fallback: XML-style <server.tool> {"key":"val"} </server.tool>
    if (calls.length === 0) {
      const xmlRegex = new RegExp(XML_TOOL_CALL.source, "g");
      while ((match = xmlRegex.exec(text)) !== null) {
        try {
          const args = this._parseArgs(match[3]);
          calls.push({ serverId: match[1], toolName: match[2], args });
          this.debug("Parsed XML-style tool call", {
            server: match[1],
            tool: match[2],
          });
        } catch (e) {
          this.debug("Failed to parse XML tool call args", {
            raw: match[0],
            error: e.message,
          });
        }
      }
    }

    // Fallback: minimax native format — <minimax:tool_call><invoke name="server.tool">{...}</invoke></minimax:tool_call>
    if (calls.length === 0) {
      const mmRegex = new RegExp(MINIMAX_TOOL_CALL.source, "g");
      while ((match = mmRegex.exec(text)) !== null) {
        try {
          const fullName = match[1]; // e.g. "builtin.write_file"
          const args = this._parseArgs(match[2]);
          const dotIdx = fullName.indexOf(".");
          if (dotIdx > 0) {
            const serverId = fullName.slice(0, dotIdx);
            const toolName = fullName.slice(dotIdx + 1);
            calls.push({ serverId, toolName, args });
            this.debug("Parsed minimax:tool_call", { tool: fullName });
          }
        } catch (e) {
          this.debug("Failed to parse minimax tool call args", {
            raw: match[0],
            error: e.message,
          });
        }
      }
    }

    // Fallback fallback: bare minimax block without <invoke> wrapper.
    // minimax-m2:cloud occasionally emits this v1.6.31 dogfood-observed shape:
    //   <minimax:tool_call>
    //   builtin.run_terminal_cmd
    //   {"command": "uv", "args": ["pip", "install", "langgraph"]}
    //   }                          ← stray brace tolerated
    //   </minimax:tool_call>
    // Strategy: header line is server.tool on its own; JSON args are the first
    // balanced { ... } block; trailing junk between args close-brace and the
    // tag close is ignored.
    if (calls.length === 0 && text.includes("<minimax:tool_call>")) {
      const blockRegex = new RegExp(MINIMAX_TOOL_CALL_BLOCK.source, "g");
      let blockMatch;
      while ((blockMatch = blockRegex.exec(text)) !== null) {
        const block = blockMatch[1].trim();
        if (!block || block.includes("<invoke")) continue;
        const lines = block
          .split(/\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        const headerLine = lines.find((l) => /^[\w-]+\.[\w-]+$/.test(l));
        if (!headerLine) continue;
        const dotIdx = headerLine.indexOf(".");
        const serverId = headerLine.slice(0, dotIdx);
        const toolName = headerLine.slice(dotIdx + 1);
        const firstBrace = block.indexOf("{");
        if (firstBrace < 0) continue;
        let depth = 0;
        let lastClose = -1;
        for (let i = firstBrace; i < block.length; i++) {
          if (block[i] === "{") depth++;
          else if (block[i] === "}") {
            depth--;
            if (depth === 0) {
              lastClose = i;
              break;
            }
          }
        }
        if (lastClose < 0) continue;
        const jsonText = block.slice(firstBrace, lastClose + 1);
        try {
          const args = JSON.parse(jsonText);
          calls.push({ serverId, toolName, args });
          this.debug("Parsed bare-minimax tool call (no <invoke> wrapper)", {
            tool: `${serverId}.${toolName}`,
          });
        } catch (e) {
          this.debug("Failed to parse bare-minimax JSON args", {
            raw: jsonText.slice(0, 200),
            error: e.message,
          });
        }
      }
    }

    // Fallback: minimax parameter format:
    // <minimax:tool_call><invoke name="server.tool"><parameter name="k">v</parameter></invoke></minimax:tool_call>
    if (calls.length === 0 && text.includes("<minimax:tool_call>")) {
      const blockRegex = new RegExp(MINIMAX_TOOL_CALL_BLOCK.source, "g");
      let blockMatch;
      while ((blockMatch = blockRegex.exec(text)) !== null) {
        const block = blockMatch[1];
        const invokeRegex = new RegExp(MINIMAX_INVOKE.source, "g");
        let invokeMatch;
        while ((invokeMatch = invokeRegex.exec(block)) !== null) {
          try {
            const fullName = invokeMatch[1];
            const inner = invokeMatch[2];
            const dotIdx = fullName.indexOf(".");
            if (dotIdx <= 0) continue;
            const serverId = fullName.slice(0, dotIdx);
            const toolName = fullName.slice(dotIdx + 1);
            const args = {};
            const paramRegex = new RegExp(MINIMAX_PARAMETER.source, "g");
            let paramMatch;
            while ((paramMatch = paramRegex.exec(inner)) !== null) {
              const key = paramMatch[1];
              const rawVal = paramMatch[2].trim();
              // Keep this conservative: parse primitive JSON when possible,
              // otherwise treat as a plain string.
              let val = rawVal;
              if (
                /^-?\d+(\.\d+)?$/.test(rawVal) ||
                /^(true|false|null)$/i.test(rawVal) ||
                (rawVal.startsWith("[") && rawVal.endsWith("]")) ||
                (rawVal.startsWith("{") && rawVal.endsWith("}"))
              ) {
                try {
                  val = JSON.parse(rawVal);
                } catch {
                  val = rawVal;
                }
              }
              args[key] = val;
            }
            const mergedArgs = mergeMinimaxSloppyInvokeTags(inner, args);
            calls.push({ serverId, toolName, args: mergedArgs });
            this.debug("Parsed minimax parameter-style tool call", {
              tool: fullName,
            });
          } catch (e) {
            this.debug("Failed to parse minimax parameter-style tool call", {
              raw: invokeMatch[0],
              error: e.message,
            });
          }
        }
      }
    }

    return calls;
  }

  // Execute a single tool call
  async executeTool(serverId, toolName, args) {
    if (this._experimentToolPolicy === "strict") {
      if (serverId !== "builtin") {
        return {
          success: false,
          error: `Experiment mode does not allow MCP tools (${serverId}.${toolName}). Use only project-scoped builtins listed in the experiment instructions.`,
        };
      }
      if (!EXPERIMENT_ALLOWED_BUILTINS.has(toolName)) {
        return {
          success: false,
          error: `Experiment mode: builtin.${toolName} is not in the allowed set (${[...EXPERIMENT_ALLOWED_BUILTINS].join(", ")}).`,
        };
      }
      if (
        this._experimentScope &&
        (toolName === "write_file" || toolName === "run_terminal_cmd")
      ) {
        const cfg = this.getConfig();
        const denial = enforceExperimentScope({
          tool: toolName,
          args,
          scope: this._experimentScope,
          projectFolder: cfg.projectFolder,
          interactionRoot: getAgentInteractionRoot(cfg),
        });
        if (denial) {
          const text = `Command denied: ${denial.denied}\nACTION: ${denial.action}`;
          this.log("WARN", "Experiment scope denial", {
            tool: toolName,
            reason: denial.denied,
          });
          return {
            success: false,
            result: { content: [{ type: "text", text }] },
          };
        }
      }
    }

    // Route builtin tools locally (no MCP transport)
    if (serverId === "builtin") {
      try {
        this.debug("Builtin tool args", {
          tool: toolName,
          argKeys: Object.keys(args),
          hasContent: !!args.content,
          hasInput: !!args.input,
        });
        const config = this.getConfig();
        const result = await executeBuiltinTool(
          toolName,
          args,
          config,
          this.log,
          this.clientKey,
          this.sseContext,
        );
        this.debug("Builtin tool result", {
          tool: toolName,
          success: result.success,
          resultPreview: result.result?.content?.[0]?.text?.slice(0, 200),
        });
        return result;
      } catch (err) {
        this.log("ERROR", `Builtin tool exception: ${toolName}`, {
          error: err.message,
          stack: err.stack?.split("\n")[1],
        });
        return { success: false, error: err.message };
      }
    }

    // Block disabled MCP tools at execution time. Prompt filtering alone is not enforcement.
    const config = this.getConfig();
    const clientConfig = (config.mcpClients || []).find(
      (c) => c.id === serverId,
    );
    const disabledTools = Array.isArray(clientConfig?.disabledTools)
      ? clientConfig.disabledTools
      : [];
    if (disabledTools.includes(toolName)) {
      this.log("WARN", "Blocked disabled MCP tool call", {
        serverId,
        toolName,
      });
      return {
        success: false,
        error: `Tool ${serverId}.${toolName} is disabled in Settings -> MCP Clients. Enable it before retrying.`,
      };
    }

    // Existing MCP dispatch (bounded — hung tools were stalling the whole chat)
    const startedAt = Date.now();
    const callId = createMcpCallId();
    const maxAttempts = MCP_TOOL_MAX_RETRIES + 1;
    const timeoutMs = getMcpToolTimeoutMs(serverId, toolName);
    const normalizedArgs = normalizeMcpToolArgs(serverId, toolName, args);
    const argsWereNormalized = normalizedArgs !== args;
    this.log("INFO", "MCP tool call started", {
      callId,
      serverId,
      toolName,
      argKeys: Object.keys(normalizedArgs || {}),
      maxAttempts,
      timeoutMs,
      argsWereNormalized,
      normalizedModel:
        argsWereNormalized && isGoogleAiStudioServer(serverId)
          ? normalizedArgs.model || null
          : null,
    });
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await withTimeout(
          this.mcpClient.callTool(serverId, toolName, normalizedArgs, {
            timeout: timeoutMs,
          }),
          timeoutMs,
          `MCP ${serverId}.${toolName}`,
        );
        this.log("INFO", "MCP tool call succeeded", {
          callId,
          serverId,
          toolName,
          attempt,
          durationMs: Date.now() - startedAt,
        });
        return { success: true, result };
      } catch (err) {
        const decoratedError = decorateMcpToolError(
          serverId,
          toolName,
          err.message,
        );
        const retryable =
          attempt < maxAttempts && isRetryableMcpError(err.message);
        this.log("ERROR", "MCP tool call failed", {
          callId,
          serverId,
          toolName,
          attempt,
          durationMs: Date.now() - startedAt,
          retryable,
          error: decoratedError,
        });
        if (retryable) {
          await sleep(MCP_TOOL_RETRY_DELAY_MS);
          continue;
        }
        return {
          success: false,
          error: decoratedError,
        };
      }
    }
  }

  /**
   * Build the tools prompt AND return feature flags derived from the same
   * builtinTools array — single getBuiltinTools() call, no drift.
   * @returns {{ prompt: string, hasTerminalTool: boolean, hasValidateTool: boolean, hasPlannerTool: boolean, hasBrowserTool: boolean, hasCrawl4aiResearchTools: boolean }}
   */
  getToolsPromptAndFlags() {
    const config = this.getConfig();
    const disabledToolsMap = {};
    for (const c of config.mcpClients || []) {
      if (Array.isArray(c.disabledTools) && c.disabledTools.length > 0) {
        disabledToolsMap[c.id] = c.disabledTools;
      }
    }
    let mcpTools = this.mcpClient.getAllTools(disabledToolsMap);
    let builtinTools = getBuiltinTools(this.getConfig());
    if (this._experimentToolPolicy === "strict") {
      mcpTools = [];
      builtinTools = builtinTools.filter((t) =>
        EXPERIMENT_ALLOWED_BUILTINS.has(t.name),
      );
    }
    const allTools = [...mcpTools, ...builtinTools];
    if (allTools.length === 0)
      return {
        prompt: "",
        hasTerminalTool: false,
        hasValidateTool: false,
        hasPlannerTool: false,
        hasBrowserTool: false,
        hasBuiltinBrowserTool: false,
        hasAppSkillTool: false,
        hasCrawl4aiResearchTools: false,
      };

    const hasCrawl4aiResearchTools = mcpTools.some((t) =>
      CRAWL_RESEARCH_MCP_TOOL_NAMES.has(t.name),
    );
    const crawlResearchExample = pickMcpCrawlResearchExampleCall(mcpTools);

    const mcpToolCounts = new Map();
    for (const tool of mcpTools) {
      mcpToolCounts.set(
        tool.serverId,
        (mcpToolCounts.get(tool.serverId) || 0) + 1,
      );
    }
    const compactedServerNames = new Set();
    const toolList = allTools
      .map((tool) => {
        const compact =
          tool.serverId !== "builtin" &&
          (mcpToolCounts.get(tool.serverId) || 0) >
            COMPACT_EXTERNAL_SERVER_TOOL_COUNT;
        if (compact) compactedServerNames.add(tool.serverName || tool.serverId);
        return formatToolLine(tool, { compact });
      })
      .join("\n");
    const compactedServerLine =
      compactedServerNames.size > 0
        ? `\n\nNOTE: Large MCP servers are listed in compact form to keep local models responsive: ${Array.from(compactedServerNames).join(", ")}. Tool names remain callable with TOOL_CALL.`
        : "";

    const hasOfficeTool = builtinTools.some(
      (t) => t.name === "generate_office_file",
    );

    const googleAuthToolRefs = Array.from(
      new Set(
        mcpTools
          .filter((t) => t.name === "start_google_auth")
          .map((t) => `${t.serverId}.${t.name}`),
      ),
    );
    const hasGoogleWorkspaceTools =
      googleAuthToolRefs.length > 0 ||
      mcpTools.some(
        (t) =>
          /google/i.test(t.serverName || t.serverId || "") ||
          /(^|_)(drive|doc|docs|gmail|sheets|slides|calendar)(_|$)/i.test(
            t.name,
          ),
      );

    const hasTerminalTool = builtinTools.some(
      (t) => t.serverId === "builtin" && t.name === "run_terminal_cmd",
    );

    const hasValidateTool = builtinTools.some(
      (t) => t.serverId === "builtin" && t.name === "validate_scan_project",
    );

    const hasPlannerTool = builtinTools.some(
      (t) => t.serverId === "builtin" && t.name === "score_plan",
    );

    const hasAppSkillTool = builtinTools.some(
      (t) =>
        t.serverId === "builtin" &&
        (t.name === "review_run" ||
          t.name === "pentest_scan" ||
          t.name === "pentest_scan_folder" ||
          t.name === "builder_score"),
    );

    // Browser automation: external Playwright MCP or builtin browse_url.
    const hasBuiltinBrowserTool = builtinTools.some(
      (t) => t.serverId === "builtin" && t.name === "browse_url",
    );
    const hasBrowserTool =
      hasBuiltinBrowserTool ||
      allTools.some(
        (t) =>
          t.name === "browser_navigate" ||
          t.name === "browser_snapshot" ||
          /^browser_/i.test(t.name),
      );

    // Session capability hints with concrete examples.
    const terminalSessionLine = hasTerminalTool
      ? "\n\nAGENT TERMINAL: builtin.run_terminal_cmd executes shell commands directly on the user's machine in their project folder. Use TOOL_CALL when a shell command is the right way to help.\n" +
        'Example: TOOL_CALL: builtin.run_terminal_cmd({"command": "ls", "args": ["-la"]})\n' +
        "Use only commands allowed in Settings → Agent terminal allowlist. Do NOT ask the user to paste output manually — run the command yourself."
      : "";

    const browserSessionLine = hasBrowserTool
      ? hasBuiltinBrowserTool
        ? "\n\nAGENT BROWSER: Persistent browser session tools are available. Start with browse_url, then interact with the live page.\n" +
          '- TOOL_CALL: builtin.browse_url({"url": "https://example.com"}) — open page, get screenshot + text\n' +
          "- TOOL_CALL: builtin.browser_snapshot({}) — screenshot current page state\n" +
          '- TOOL_CALL: builtin.browser_click({"selector": "button.submit"}) — click element\n' +
          '- TOOL_CALL: builtin.browser_click({"text": "Sign In"}) — click by visible text\n' +
          '- TOOL_CALL: builtin.browser_type({"selector": "#email", "text": "user@example.com"}) — type into field\n' +
          '- TOOL_CALL: builtin.browser_scroll({"direction": "down", "amount": 500}) — scroll page'
        : "\n\nAGENT BROWSER: Browser automation tools are available (for example `browser_navigate` and `browser_snapshot`). Use them for **interactive** pages: logins, clicking through a flow, waiting on client-rendered UI, or **screenshots of the fully rendered page**. Do not use them as a substitute for a dedicated **web search** or **fetch/summarize URL** tool when one is listed above. If the user asks for a snapshot/screenshot of a driven session, include `browser_snapshot` before writing your summary.\n" +
          'Example: TOOL_CALL: playwright.browser_navigate({"url":"https://example.com"})\n' +
          "Example: TOOL_CALL: playwright.browser_snapshot({})"
      : "";

    const crawlWebResearchLine =
      hasCrawl4aiResearchTools && crawlResearchExample
        ? `\n\nWEB / SEARCH / CRAWL: Crawl4AI-style MCP tools are available (search_web / web_search, crawl_website, extract_content, get_available_sources). For **web search**, **answers from URLs or crawled docs**, or **site crawl / extract text**, call those tools with TOOL_CALL first — e.g. TOOL_CALL: ${crawlResearchExample}(…). Prefer them over Playwright browser_* tools for those tasks; reserve browser_* for flows that truly need a real browser (authenticated SPA, multi-step clicks, rendered-layout screenshots).`
        : "";

    const googleWorkspaceLine = hasGoogleWorkspaceTools
      ? `\n\nGOOGLE WORKSPACE AUTH: Google Docs/Drive/Sheets files are supported through Google Workspace tools. If a Google file-content/export tool reports unauthorized, unauthenticated, forbidden, insufficient permissions, or OAuth/consent required, treat it as an authorization refresh issue — not an unsupported format. ${googleAuthToolRefs.length > 0 ? `Call ${googleAuthToolRefs.join(" or ")} with TOOL_CALL, then retry the original file-content/export tool.` : "Ask the user to reconnect Google Workspace in Settings -> MCP Clients, then retry the original file-content/export tool."}`
      : "";

    let prompt = `\n\n---\nAGENT IDENTITY OVERRIDE — YOU CAN ACT:
Regardless of your described persona, you are an ACTIVE AGENT with tools that execute directly on the user's machine. NEVER say any of the following:
- "you'll need to run this yourself"
- "as an AI I can't execute code"
- "I can write the code and you can run it"
- "you are the one holding the keyboard"
- "I can only provide guidance"
- "I cannot directly execute browser automation commands from this interface"
Those statements are FALSE. You have tools. Use them.

IMPORTANT: When the user's request would benefit from a tool, USE IT IMMEDIATELY — do NOT ask for permission or describe what you would do. Just call the tool directly using this exact format:

TOOL_CALL: server_id.tool_name({"arg1": "value"})

You may call multiple tools in one response. After calling a tool, STOP — do NOT write anything after the TOOL_CALL line. Do NOT predict, guess, or fabricate tool results. The system will execute the tool and provide the actual results in the next message. Always prefer action over asking.

CRITICAL — NO FAKE SERVER ERRORS:
- You do NOT receive HTTP status codes (413, 404, 500, "payload too large", etc.) from this chat. NEVER invent them. If you mention "413" or "conversion service failed" without the user pasting an exact error message, you are hallucinating.
- Binary gibberish, unreadable text, or a PDF filename in the message does NOT mean a conversion failed. Do NOT fabricate plausible errors.
${hasOfficeTool ? '- For PDFs, DOCX, PPTX, and similar files under the project folder: call `TOOL_CALL: builtin.generate_office_file` with `"sourcePath"` ONCE to extract text — do NOT claim Docling or "the service" returned 413. After the tool returns results, present them to the user — do NOT re-call the same tool.\n' : ""}
Available external tools:
${toolList}${compactedServerLine}${terminalSessionLine}${crawlWebResearchLine}${browserSessionLine}${googleWorkspaceLine}`;

    if (builtinTools.length > 0) {
      prompt +=
        "\n\n" +
        getBuiltinSafetyPreamble({
          includeTerminal: hasTerminalTool,
          includePlanner: hasPlannerTool,
          includeValidate: hasValidateTool,
          includeBrowser: hasBuiltinBrowserTool,
          includeAppSkills: hasAppSkillTool,
        });
    }

    if (this._experimentToolPolicy === "strict") {
      prompt += `\n\n---\nEXPERIMENT MODE (enforced): Only these builtins are available — no MCP, no browser, no office export, no planner scoring: ${[...EXPERIMENT_ALLOWED_BUILTINS].join(", ")}.\n- Prefer builtin.write_file for any project source or doc edits (small, reversible diffs).\n- Use run_terminal_cmd only for read-only checks or bounded test/lint commands allowed by Settings → Agent terminal.\n- Stop when the success metric for this step is met, when you are blocked, or when the user should take over.`;
    }

    return {
      prompt,
      hasTerminalTool,
      hasValidateTool,
      hasPlannerTool,
      hasBrowserTool,
      hasBuiltinBrowserTool,
      hasAppSkillTool,
      hasCrawl4aiResearchTools,
    };
  }

  // Thin wrapper — keeps existing call sites and tests stable
  buildToolsPrompt() {
    return this.getToolsPromptAndFlags().prompt;
  }

  /**
   * Segment tool calls into ordered execution segments, preserving original call order.
   * Contiguous safe calls are grouped into parallel segments; risky calls flush the
   * current window and execute in-place as individual serial segments.
   *
   * Example: [read_A, write_B, read_C] → [{parallel:[read_A]}, {serial:[write_B]}, {parallel:[read_C]}]
   * This ensures write_B never runs before read_A or after read_C regardless of batch ordering.
   *
   * Safe prefixes: read_, view_, list_, get_, fetch_, search_, validate_, check_, scan_, analyze_, score_, explain_, chat_
   * Risky prefixes: write_, create_, delete_, remove_, update_, modify_, patch_, execute_, run_, generate_
   * Unknown prefixes → risky (conservative default)
   * Explicit risky builtins: sourced from RISKY_BUILTIN_NAMES in lib/builtin-agent-tools.js
   * (derived from BUILTIN_TOOLS entries where parallelSafe === false — single source of truth).
   *
   * @param {Array} toolCalls - Array of { serverId, toolName, args } objects
   * @returns {Array} segments - Ordered array of { type: 'parallel'|'serial', calls: [...] } with originalIndex attached
   */
  segmentToolCalls(toolCalls) {
    const safePatterns =
      /^(read_|view_|list_|get_|fetch_|search_|validate_|check_|scan_|analyze_|score_|explain_|chat_)/i;
    const riskyPatterns =
      /^(write_|create_|delete_|remove_|update_|modify_|patch_|execute_|run_|generate_)/i;

    const isRisky = (call) => {
      if (call.serverId === "builtin" && RISKY_BUILTIN_NAMES.has(call.toolName))
        return true;
      if (riskyPatterns.test(call.toolName)) return true;
      if (!safePatterns.test(call.toolName)) return true; // unknown → conservative
      return false;
    };

    const segments = [];
    let window = [];

    const flushWindow = () => {
      if (window.length > 0) {
        segments.push({ type: "parallel", calls: [...window] });
        window = [];
      }
    };

    toolCalls.forEach((call, idx) => {
      const entry = { ...call, originalIndex: idx };
      if (isRisky(call)) {
        flushWindow();
        segments.push({ type: "serial", calls: [entry] });
      } else {
        window.push(entry);
      }
    });

    flushWindow();
    return segments;
  }
}

ToolCallHandler.EXPERIMENT_ALLOWED_BUILTINS = EXPERIMENT_ALLOWED_BUILTINS;

module.exports = ToolCallHandler;
