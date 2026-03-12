const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

class McpClientManager {
  constructor(logger) {
    this.connections = new Map(); // id → { client, transport, config, tools, status, connectedAt, error }
    this.log = logger?.log || (() => {});
    this.debug = logger?.debug || (() => {});
  }

  async connect(serverConfig) {
    const { id, transport, command, args, env, url } = serverConfig;
    
    // Disconnect existing if any
    if (this.connections.has(id)) {
      await this.disconnect(id);
    }

    let clientTransport;
    if (transport === 'stdio') {
      // Split command string into executable + args (e.g. "npx -y @mcp/server" → "npx" + ["-y", "@mcp/server"])
      const cmdParts = command.trim().split(/\s+/);
      const exe = cmdParts[0];
      // Also split any args entries that contain spaces (e.g. "-y @mcp/server" → ["-y", "@mcp/server"])
      const splitArgs = (args || []).flatMap(a => a.trim().split(/\s+/));
      const cmdArgs = [...cmdParts.slice(1), ...splitArgs];
      this.debug('Stdio transport', { exe, cmdArgs: cmdArgs.join(' '), envKeys: Object.keys(env || {}) });
      clientTransport = new StdioClientTransport({
        command: exe,
        args: cmdArgs,
        env: { ...process.env, ...(env || {}) }
      });
    } else if (transport === 'http') {
      clientTransport = new StreamableHTTPClientTransport(new URL(url));
    } else {
      throw new Error(`Unknown transport type: ${transport}`);
    }

    const client = new Client(
      { name: 'code-companion', version: '1.0.0' },
      { capabilities: {} }
    );

    try {
      await client.connect(clientTransport);
      const { tools } = await client.listTools();

      this.connections.set(id, {
        client, transport: clientTransport, config: serverConfig,
        tools: tools || [], status: 'connected', connectedAt: new Date(), error: null
      });

      this.log('INFO', `Connected to external MCP server: ${serverConfig.name} (${tools.length} tools)`);
      return tools;
    } catch (err) {
      this.connections.set(id, {
        client: null, transport: null, config: serverConfig,
        tools: [], status: 'error', connectedAt: null, error: err.message
      });
      throw err;
    }
  }

  async disconnect(id) {
    const conn = this.connections.get(id);
    if (!conn) return;
    try {
      if (conn.client) await conn.client.close();
      if (conn.transport) await conn.transport.close();
    } catch (err) {
      this.debug('Disconnect cleanup error', { id, error: err.message });
    }
    this.connections.delete(id);
  }

  async callTool(serverId, toolName, toolArgs) {
    const conn = this.connections.get(serverId);
    if (!conn || conn.status !== 'connected') {
      throw new Error(`Server ${serverId} not connected`);
    }
    return conn.client.callTool({ name: toolName, arguments: toolArgs });
  }

  // Get all enabled tools across all connected servers
  getAllTools(disabledToolsMap = {}) {
    const allTools = [];
    for (const [id, conn] of this.connections) {
      if (conn.status !== 'connected') continue;
      const disabled = disabledToolsMap[id] || [];
      for (const tool of conn.tools) {
        if (!disabled.includes(tool.name)) {
          allTools.push({ serverId: id, serverName: conn.config.name, ...tool });
        }
      }
    }
    return allTools;
  }

  getStatuses() {
    const statuses = [];
    for (const [id, conn] of this.connections) {
      statuses.push({
        id,
        name: conn.config.name,
        transport: conn.config.transport,
        status: conn.status,
        toolCount: conn.tools.length,
        connectedAt: conn.connectedAt,
        error: conn.error
      });
    }
    return statuses;
  }

  getConnection(id) { return this.connections.get(id); }

  async disconnectAll() {
    for (const id of this.connections.keys()) {
      await this.disconnect(id);
    }
  }
}

module.exports = McpClientManager;
