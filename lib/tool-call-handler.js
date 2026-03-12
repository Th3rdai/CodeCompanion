const TOOL_CALL_PATTERN = /TOOL_CALL:\s*(\S+?)\.(\S+?)\(([\s\S]*?)\)/g;
const MAX_ROUNDS = 5;

class ToolCallHandler {
  constructor(mcpClientManager, logger) {
    this.mcpClient = mcpClientManager;
    this.log = logger?.log || (() => {});
    this.debug = logger?.debug || (() => {});
  }

  // Try to parse args as JSON, falling back to flexible key=value parsing
  _parseArgs(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return {};

    // Try standard JSON first
    try { return JSON.parse(trimmed); } catch (e) { /* fall through */ }

    // Handle Python-style key="value" or key='value' — convert to JSON
    // e.g. project_id="abc-123", name="foo" → {"project_id":"abc-123","name":"foo"}
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
    this.debug('Could not parse args, wrapping as input string', { raw: trimmed });
    return { input: trimmed };
  }

  // Parse TOOL_CALL: patterns from model response
  parseToolCalls(text) {
    const calls = [];
    let match;
    const regex = new RegExp(TOOL_CALL_PATTERN);
    while ((match = regex.exec(text)) !== null) {
      try {
        const args = this._parseArgs(match[3]);
        calls.push({ serverId: match[1], toolName: match[2], args });
      } catch (e) {
        this.debug('Failed to parse tool call args', { raw: match[0], error: e.message });
      }
    }
    return calls;
  }

  // Execute a single tool call
  async executeTool(serverId, toolName, args) {
    try {
      const result = await this.mcpClient.callTool(serverId, toolName, args);
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Build the external tools description for Ollama's system prompt
  buildToolsPrompt() {
    const tools = this.mcpClient.getAllTools();
    if (tools.length === 0) return '';
    
    const toolList = tools.map(t =>
      `- ${t.serverId}.${t.name}: ${t.description || 'No description'}`
    ).join('\n');

    return `\n\n---\nIMPORTANT: You have access to external tools. When the user's request would benefit from a tool, USE IT IMMEDIATELY — do NOT ask for permission or describe what you would do. Just call the tool directly using this exact format:

TOOL_CALL: server_id.tool_name({"arg1": "value"})

You may call multiple tools in one response. After you call a tool, you will receive the results and can continue your response. Always prefer action over asking.

Available external tools:
${toolList}`;
  }
}

module.exports = ToolCallHandler;
