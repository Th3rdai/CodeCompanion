const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');
const fs = require('fs');
const path = require('path');
const { mergeDevToolPathIntoEnv } = require('./spawn-path');

class McpClientManager {
  constructor(logger) {
    this.connections = new Map(); // id → { client, transport, config, tools, status, connectedAt, error }
    this.log = logger?.log || (() => {});
    this.debug = logger?.debug || (() => {});
  }

  async connect(serverConfig) {
    const normalizedConfig = this.validateAndNormalizeConfig(serverConfig);
    const { id, transport, command, args, env, url } = normalizedConfig;

    if (id === 'builtin') throw new Error('"builtin" is a reserved server ID');

    // Disconnect existing if any
    if (this.connections.has(id)) {
      await this.disconnect(id);
    }

    let clientTransport;
    let effectiveTransport = transport;

    if (transport === 'stdio') {
      this.debug('Stdio transport', { command, args: args.join(' '), envKeys: Object.keys(env || {}) });
      clientTransport = new StdioClientTransport({
        command,
        args,
        env: mergeDevToolPathIntoEnv({ ...process.env, ...(env || {}) })
      });
    } else if (transport === 'sse') {
      clientTransport = new SSEClientTransport(new URL(url));
    } else if (transport === 'http') {
      clientTransport = new StreamableHTTPClientTransport(new URL(url));
    } else {
      throw new Error(`Unknown transport type: ${transport}`);
    }

    const client = new Client(
      { name: 'code-companion', version: '1.0.0' },
      { capabilities: {} }
    );

    // Stdio proxies (e.g. stitch-mcp) may need time to connect upstream before
    // they can accept the MCP initialize handshake. Retry up to 2 times with a
    // short delay so the proxy has time to become ready.
    const maxAttempts = transport === 'stdio' ? 4 : 1;
    let lastErr;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          this.log('INFO', `Retrying stdio connection for ${normalizedConfig.name} (attempt ${attempt}/${maxAttempts})...`);
          clientTransport = new StdioClientTransport({
            command, args,
            env: mergeDevToolPathIntoEnv({ ...process.env, ...(env || {}) })
          });
          const retryClient = new Client({ name: 'code-companion', version: '1.0.0' }, { capabilities: {} });
          await new Promise(r => setTimeout(r, 5000));
          await retryClient.connect(clientTransport);
          const { tools } = await retryClient.listTools();
          this.connections.set(id, {
            client: retryClient, transport: clientTransport, config: normalizedConfig,
            tools: tools || [], status: 'connected', connectedAt: new Date(), error: null
          });
          this.log('INFO', `Connected to external MCP server: ${normalizedConfig.name} (${tools.length} tools) on attempt ${attempt}`);
          return tools;
        }

        await client.connect(clientTransport);
        const { tools } = await client.listTools();

        this.connections.set(id, {
          client, transport: clientTransport, config: normalizedConfig,
          tools: tools || [], status: 'connected', connectedAt: new Date(), error: null
        });

        this.log('INFO', `Connected to external MCP server: ${normalizedConfig.name} (${tools.length} tools)`);
        return tools;
      } catch (err) {
        lastErr = err;
        if (attempt < maxAttempts && transport === 'stdio' && err.message?.includes('Connection closed')) {
          this.log('INFO', `Stdio connection closed for ${normalizedConfig.name}, will retry in 5s...`);
          continue;
        }
        break;
      }
    }

    const err = lastErr;
    {
      // Auto-fallback: if HTTP (streamable-http) fails with Method Not Allowed, retry as SSE
      if (transport === 'http' && err.message && err.message.includes('Method Not Allowed')) {
        this.log('INFO', `Streamable HTTP failed for ${normalizedConfig.name}, falling back to SSE transport`);
        try {
          const sseTransport = new SSEClientTransport(new URL(url));
          const sseClient = new Client(
            { name: 'code-companion', version: '1.0.0' },
            { capabilities: {} }
          );
          await sseClient.connect(sseTransport);
          const { tools } = await sseClient.listTools();
          effectiveTransport = 'sse';

          this.connections.set(id, {
            client: sseClient, transport: sseTransport, config: { ...normalizedConfig, _effectiveTransport: 'sse' },
            tools: tools || [], status: 'connected', connectedAt: new Date(), error: null
          });

          this.log('INFO', `Connected to external MCP server via SSE fallback: ${normalizedConfig.name} (${tools.length} tools)`);
          return tools;
        } catch (sseErr) {
          this.connections.set(id, {
            client: null, transport: null, config: normalizedConfig,
            tools: [], status: 'error', connectedAt: null, error: `HTTP failed: ${err.message}; SSE fallback also failed: ${sseErr.message}`
          });
          throw new Error(`HTTP failed: ${err.message}; SSE fallback also failed: ${sseErr.message}`);
        }
      }

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

    if (normalized.id === 'builtin') {
      throw new Error('Invalid MCP client config: "builtin" is a reserved server ID');
    }

    if (!['stdio', 'http', 'sse'].includes(normalized.transport)) {
      throw new Error('Invalid MCP client config: transport must be stdio, http, or sse');
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

    if (normalized.transport === 'http' || normalized.transport === 'sse') {
      if (!normalized.url) {
        throw new Error(`Invalid MCP client config: url is required for ${normalized.transport} transport`);
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
