const {
  getBuiltinTools,
  getBuiltinSafetyPreamble,
  executeBuiltinTool,
} = require("./builtin-agent-tools");

const TOOL_CALL_HEADER = /TOOL_CALL:\s*(\S+?)\.(\S+?)\(/g;
// Fallback: XML-style <server.tool> {...} </server.tool> (some cloud models use this)
const XML_TOOL_CALL = /<(\w+)\.(\w+)>\s*(\{[\s\S]*?\})\s*<\/\1\.\2>/g;
const MAX_ROUNDS = 5;

/** Prevent hung MCP servers from blocking chat forever (ms). Override with MCP_TOOL_TIMEOUT_MS (min 50). */
const MCP_TOOL_TIMEOUT_MS = (() => {
  const raw = process.env.MCP_TOOL_TIMEOUT_MS;
  if (raw === undefined || raw === "") return 120000;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(50, n) : 120000;
})();

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

class ToolCallHandler {
  constructor(mcpClientManager, { log, debug, getConfig } = {}) {
    this.mcpClient = mcpClientManager;
    this.log = log || (() => {});
    this.debug = debug || (() => {});
    this.getConfig = getConfig || (() => ({}));
    this.clientKey = null;
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

    return calls;
  }

  // Execute a single tool call
  async executeTool(serverId, toolName, args) {
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

    // Existing MCP dispatch (bounded — hung tools were stalling the whole chat)
    try {
      const result = await withTimeout(
        this.mcpClient.callTool(serverId, toolName, args),
        MCP_TOOL_TIMEOUT_MS,
        `MCP ${serverId}.${toolName}`,
      );
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Build the external tools description for Ollama's system prompt
  buildToolsPrompt() {
    const mcpTools = this.mcpClient.getAllTools();
    const builtinTools = getBuiltinTools(this.getConfig());
    const allTools = [...mcpTools, ...builtinTools];
    if (allTools.length === 0) return "";

    const toolList = allTools
      .map((t) => {
        let line = `- ${t.serverId}.${t.name}: ${(t.description || "No description").split("\n")[0].slice(0, 200)}`;
        // Include required params + params with enums (compact, avoids context bloat)
        const schema = t.inputSchema;
        if (schema && schema.properties) {
          const required = new Set(schema.required || []);
          const params = [];
          for (const [k, v] of Object.entries(schema.properties)) {
            const enumVals = v.enum || v.anyOf?.find((a) => a.enum)?.enum;
            const isRequired = required.has(k);
            // Only show required params, enum params, or the first 4 optional params
            if (!isRequired && !enumVals && params.length >= 4) continue;
            let desc = isRequired ? `${k} (required)` : k;
            if (enumVals) {
              // Limit to 8 enum values to save space
              const shown = enumVals.slice(0, 8);
              desc += `: ${shown.join("|")}${enumVals.length > 8 ? "|..." : ""}`;
            } else if (v.type) {
              desc += `: ${v.type}`;
            }
            params.push(desc);
          }
          if (params.length > 0) {
            line += ` | Params: ${params.join(", ")}`;
          }
        }
        return line;
      })
      .join("\n");

    const hasOfficeTool = builtinTools.some(
      (t) => t.name === "generate_office_file",
    );

    let prompt = `\n\n---\nIMPORTANT: You have access to external tools. When the user's request would benefit from a tool, USE IT IMMEDIATELY — do NOT ask for permission or describe what you would do. Just call the tool directly using this exact format:

TOOL_CALL: server_id.tool_name({"arg1": "value"})

You may call multiple tools in one response. After calling a tool, STOP — do NOT write anything after the TOOL_CALL line. Do NOT predict, guess, or fabricate tool results. The system will execute the tool and provide the actual results in the next message. Always prefer action over asking.

CRITICAL — NO FAKE SERVER ERRORS:
- You do NOT receive HTTP status codes (413, 404, 500, "payload too large", etc.) from this chat. NEVER invent them. If you mention "413" or "conversion service failed" without the user pasting an exact error message, you are hallucinating.
- Binary gibberish, unreadable text, or a PDF filename in the message does NOT mean a conversion failed. Do NOT fabricate plausible errors.
${hasOfficeTool ? '- For PDFs, DOCX, PPTX, and similar files under the project folder: call `TOOL_CALL: builtin.generate_office_file` with `"sourcePath"` ONCE to extract text — do NOT claim Docling or "the service" returned 413. After the tool returns results, present them to the user — do NOT re-call the same tool.\n' : ""}
Available external tools:
${toolList}`;

    if (builtinTools.length > 0) {
      prompt += "\n\n" + getBuiltinSafetyPreamble();
    }

    return prompt;
  }
}

module.exports = ToolCallHandler;
