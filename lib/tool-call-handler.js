const { getBuiltinTools, getBuiltinSafetyPreamble, executeBuiltinTool } = require('./builtin-agent-tools');

const TOOL_CALL_HEADER = /TOOL_CALL:\s*(\S+?)\.(\S+?)\(/g;
// Fallback: XML-style <server.tool> {...} </server.tool> (some cloud models use this)
const XML_TOOL_CALL = /<(\w+)\.(\w+)>\s*(\{[\s\S]*?\})\s*<\/\1\.\2>/g;
const MAX_ROUNDS = 5;

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
    try { return JSON.parse(trimmed); } catch (e) { /* fall through */ }

    // AI models often put literal newlines/tabs inside JSON string values.
    // Escape them so JSON.parse succeeds.
    try {
      const fixed = trimmed.replace(
        /"(?:[^"\\]|\\.)*"/g,
        m => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
      );
      return JSON.parse(fixed);
    } catch (e) { /* fall through */ }

    // Handle Python-style key="value" or key='value' — convert to JSON
    const kvPattern = /(\w+)\s*=\s*"([^"]*)"|(\w+)\s*=\s*'([^']*)'|(\w+)\s*=\s*(\S+)/g;
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
    this.debug('Could not parse args, wrapping as input string', { raw: trimmed.slice(0, 200) });
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
    let stringChar = '';

    for (let i = startIdx; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }

      if (inString) {
        if (ch === stringChar) inString = false;
        continue;
      }

      if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
      if (ch === '(' || ch === '{' || ch === '[') { depth++; continue; }
      if (ch === ')' || ch === '}' || ch === ']') {
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
        this.debug('Failed to parse tool call args', { raw: match[0], error: e.message });
      }
    }

    // Fallback: XML-style <server.tool> {"key":"val"} </server.tool>
    if (calls.length === 0) {
      const xmlRegex = new RegExp(XML_TOOL_CALL);
      while ((match = xmlRegex.exec(text)) !== null) {
        try {
          const args = this._parseArgs(match[3]);
          calls.push({ serverId: match[1], toolName: match[2], args });
          this.debug('Parsed XML-style tool call', { server: match[1], tool: match[2] });
        } catch (e) {
          this.debug('Failed to parse XML tool call args', { raw: match[0], error: e.message });
        }
      }
    }

    return calls;
  }

  // Execute a single tool call
  async executeTool(serverId, toolName, args) {
    // Route builtin tools locally (no MCP transport)
    if (serverId === 'builtin') {
      try {
        this.debug('Builtin tool args', { tool: toolName, argKeys: Object.keys(args), hasContent: !!args.content, hasInput: !!args.input });
        const config = this.getConfig();
        const result = await executeBuiltinTool(toolName, args, config, this.log, this.clientKey);
        this.debug('Builtin tool result', { tool: toolName, success: result.success, resultPreview: result.result?.content?.[0]?.text?.slice(0, 200) });
        return result;
      } catch (err) {
        this.log('ERROR', `Builtin tool exception: ${toolName}`, { error: err.message, stack: err.stack?.split('\n')[1] });
        return { success: false, error: err.message };
      }
    }

    // Existing MCP dispatch
    try {
      const result = await this.mcpClient.callTool(serverId, toolName, args);
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
    if (allTools.length === 0) return '';

    const toolList = allTools.map(t =>
      `- ${t.serverId}.${t.name}: ${t.description || 'No description'}`
    ).join('\n');

    let prompt = `\n\n---\nIMPORTANT: You have access to external tools. When the user's request would benefit from a tool, USE IT IMMEDIATELY — do NOT ask for permission or describe what you would do. Just call the tool directly using this exact format:

TOOL_CALL: server_id.tool_name({"arg1": "value"})

You may call multiple tools in one response. After you call a tool, you will receive the results and can continue your response. Always prefer action over asking.

Available external tools:
${toolList}`;

    if (builtinTools.length > 0) {
      prompt += '\n\n' + getBuiltinSafetyPreamble();
    }

    return prompt;
  }
}

module.exports = ToolCallHandler;
