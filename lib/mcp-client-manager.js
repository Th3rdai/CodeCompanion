const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const fs = require('fs');
const path = require('path');

class McpClientManager {
  constructor(logger) {
    this.connections = new Map(); // id → { client, transport, config, tools, status, connectedAt, error }
    this.log = logger?.log || (() => {});
    this.debug = logger?.debug || (() => {});
  }

  async connect(serverConfig) {
    const normalizedConfig = this.validateAndNormalizeConfig(serverConfig);
    const { id, transport, command, args, env, url } = normalizedConfig;
    
    // Disconnect existing if any
    if (this.connections.has(id)) {
      await this.disconnect(id);
    }

    let clientTransport;
    if (transport === 'stdio') {
      this.debug('Stdio transport', { command, args: args.join(' '), envKeys: Object.keys(env || {}) });
      clientTransport = new StdioClientTransport({
        command,
        args,
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
        client, transport: clientTransport, config: normalizedConfig,
        tools: tools || [], status: 'connected', connectedAt: new Date(), error: null
      });

      this.log('INFO', `Connected to external MCP server: ${normalizedConfig.name} (${tools.length} tools)`);
      return tools;
    } catch (err) {
      this.connections.set(id, {
        client: null, transport: null, config: normalizedConfig,
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

  validateAndNormalizeConfig(serverConfig = {}) {
    const normalized = {
      id: String(serverConfig.id || '').trim(),
      name: String(serverConfig.name || '').trim(),
      transport: String(serverConfig.transport || '').trim(),
      command: typeof serverConfig.command === 'string' ? serverConfig.command.trim() : '',
      args: Array.isArray(serverConfig.args) ? serverConfig.args : [],
      env: serverConfig.env && typeof serverConfig.env === 'object' && !Array.isArray(serverConfig.env) ? serverConfig.env : {},
      url: typeof serverConfig.url === 'string' ? serverConfig.url.trim() : '',
      autoConnect: Boolean(serverConfig.autoConnect),
      disabledTools: Array.isArray(serverConfig.disabledTools) ? serverConfig.disabledTools : [],
    };

    if (!normalized.id || !normalized.name || !normalized.transport) {
      throw new Error('Invalid MCP client config: id, name, and transport are required');
    }

    if (!['stdio', 'http'].includes(normalized.transport)) {
      throw new Error('Invalid MCP client config: transport must be stdio or http');
    }

    if (normalized.transport === 'stdio') {
      if (!normalized.command) {
        throw new Error('Invalid MCP client config: command is required for stdio transport');
      }
      if (/\s/.test(normalized.command)) {
        throw new Error('Invalid MCP client config: command must be executable only (no inline arguments)');
      }
      if (/[;&|`$><]/.test(normalized.command)) {
        throw new Error('Invalid MCP client config: command contains forbidden shell characters');
      }

      const isAbsolute = path.isAbsolute(normalized.command);
      const looksLikeExeName = /^[a-zA-Z0-9._-]+$/.test(normalized.command);
      if (!isAbsolute && !looksLikeExeName) {
        throw new Error('Invalid MCP client config: command must be an executable name or absolute path');
      }
      if (isAbsolute && !fs.existsSync(normalized.command)) {
        throw new Error('Invalid MCP client config: command path does not exist');
      }

      normalized.args = normalized.args.map((arg) => {
        if (typeof arg !== 'string') {
          throw new Error('Invalid MCP client config: all args must be strings');
        }
        if (arg.includes('\u0000')) {
          throw new Error('Invalid MCP client config: args cannot contain null bytes');
        }
        if (arg.length > 2000) {
          throw new Error('Invalid MCP client config: arg exceeds max length');
        }
        return arg;
      });
    }

    if (normalized.transport === 'http') {
      if (!normalized.url) {
        throw new Error('Invalid MCP client config: url is required for http transport');
      }
      let parsedUrl;
      try {
        parsedUrl = new URL(normalized.url);
      } catch {
        throw new Error('Invalid MCP client config: url must be a valid absolute URL');
      }
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid MCP client config: url protocol must be http or https');
      }
    }

    const cleanEnv = {};
    for (const [key, value] of Object.entries(normalized.env)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        throw new Error(`Invalid MCP client config: env key "${key}" is invalid`);
      }
      if (value === null || value === undefined) continue;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        cleanEnv[key] = String(value);
      } else {
        throw new Error(`Invalid MCP client config: env value for "${key}" must be string/number/boolean`);
      }
    }
    normalized.env = cleanEnv;

    return normalized;
  }
}

module.exports = McpClientManager;
