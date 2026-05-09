const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const {
  StreamableHTTPClientTransport,
} = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const {
  SSEClientTransport,
} = require("@modelcontextprotocol/sdk/client/sse.js");
const {
  AjvJsonSchemaValidator,
} = require("@modelcontextprotocol/sdk/validation/ajv");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { mergeDevToolPathIntoEnv } = require("./spawn-path");

/**
 * The MCP SDK's default validator uses Ajv draft-07, which doesn't recognize
 * `$defs` (added in JSON Schema 2019-09). Tool schemas that use
 * `$ref: "#/$defs/X"` therefore fail to compile in `cacheToolMetadata`,
 * surfacing as `MissingRefError: can't resolve reference #/$defs/X from id #`
 * at connect time. We back the validator with the 2020-12 dialect so $defs/$ref
 * resolve natively.
 *
 * Additionally, some MCP servers ship malformed tool schemas (real example:
 * `@_davideast/stitch-mcp` >=0.5.x emits a `$ref` on `upload_design_md` whose
 * `$defs` block is missing). Without intervention, a single broken tool kills
 * the entire connection because `cacheToolMetadata` iterates all tools and
 * rethrows. We wrap `getValidator` so a per-tool compile failure logs a warning
 * and returns a permissive passthrough — the rest of the server's tools stay
 * usable.
 */
function createMcpJsonSchemaValidator(log) {
  const ajv = new Ajv2020({
    strict: false,
    validateFormats: true,
    validateSchema: false,
    allErrors: true,
  });
  addFormats(ajv);
  const inner = new AjvJsonSchemaValidator(ajv);
  const passthrough = () => ({
    valid: true,
    data: undefined,
    errorMessage: undefined,
  });
  return {
    getValidator(schema) {
      let current = schema;
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          return inner.getValidator(current);
        } catch (err) {
          const msg = err?.message || String(err);
          // Some MCP servers emit $ref: "#/$defs/X" without defining X. Stub the
          // missing def as permissive {} and retry (may need several passes).
          const m = /can't resolve reference #\/\$defs\/([^"\s]+)/.exec(msg);
          if (
            attempt < 7 &&
            m &&
            current &&
            typeof current === "object" &&
            !Array.isArray(current)
          ) {
            const defName = m[1];
            const defs = { ...(current.$defs || {}) };
            if (defs[defName] === undefined) {
              defs[defName] = {};
              current = { ...current, $defs: defs };
              continue;
            }
          }
          if (typeof log === "function") {
            log(
              "WARN",
              "MCP tool schema failed to compile — using passthrough validator",
              { error: msg },
            );
          }
          return passthrough;
        }
      }
      return passthrough;
    },
  };
}

/**
 * Env for stdio MCP children:
 * 1) client `env` from Settings (non-secret options like timeout)
 * 2) process.env (repo / data-dir .env — global keys)
 * 3) MCP_{serverId}__KEY from process.env — per-server override so two stdio servers can use different PATs
 *    (e.g. MCP_github_3rdaai_admin__GITHUB_PERSONAL_ACCESS_TOKEN)
 */
function buildStdioMcpEnv(serverId, clientEnv) {
  // Reload .env files at connect-time so key updates apply without restarting server.
  const dotenvEnv = {};
  const envCandidates = [];
  const dataEnvPath = process.env.CC_DATA_DIR
    ? path.join(process.env.CC_DATA_DIR, ".env")
    : null;
  // If CC_DATA_DIR is set (Electron/user data mode), prefer that .env only.
  // Otherwise, use repo-root .env for connect-time refresh in web/server mode.
  if (dataEnvPath) envCandidates.push(dataEnvPath);
  else envCandidates.push(path.join(__dirname, "..", ".env"));
  for (const filePath of envCandidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const parsed = dotenv.parse(fs.readFileSync(filePath, "utf8"));
      Object.assign(dotenvEnv, parsed);
    } catch {
      // Ignore malformed env files — existing process.env continues to work.
    }
  }

  const safeId = String(serverId || "mcp").replace(/[^a-zA-Z0-9]/g, "_");
  const prefix = `MCP_${safeId}__`;
  const prefixed = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith(prefix) || v === undefined || v === "") continue;
    const subKey = k.slice(prefix.length);
    if (subKey) prefixed[subKey] = v;
  }
  return mergeDevToolPathIntoEnv({
    ...(clientEnv || {}),
    ...process.env,
    ...dotenvEnv,
    ...prefixed,
  });
}

/** JSON-RPC / MCP SDK often surfaces transport death as -32000 "Connection closed". */
function enrichTransportError(err) {
  const msg = err?.message || String(err);
  if (!/connection closed|32000|ECONNRESET|socket hang up/i.test(msg))
    return err;
  const hint =
    " (MCP transport closed: stdio server may have exited, or HTTP/SSE disconnected — check the command/URL, server logs, and reconnect in Settings → MCP Clients.)";
  const next = new Error(msg + hint);
  next.cause = err;
  return next;
}

class McpClientManager {
  constructor(logger) {
    this.connections = new Map(); // id → { client, transport, config, tools, status, connectedAt, error }
    this._connecting = new Map(); // id → Promise — deduplicates concurrent connect calls
    this.log = logger?.log || (() => {});
    this.debug = logger?.debug || (() => {});
    this._jsonSchemaValidator = createMcpJsonSchemaValidator(this.log);
  }

  async connect(serverConfig) {
    const normalizedConfig = this.validateAndNormalizeConfig(serverConfig);
    const { id } = normalizedConfig;

    if (id === "builtin") throw new Error('"builtin" is a reserved server ID');

    // If a connect is already in flight for this server, share the promise.
    if (this._connecting.has(id)) {
      this.debug("Connect already in flight, sharing promise", { id });
      return this._connecting.get(id);
    }

    const promise = this._doConnect(normalizedConfig).finally(() => {
      this._connecting.delete(id);
    });
    this._connecting.set(id, promise);
    return promise;
  }

  async _doConnect(normalizedConfig) {
    const { id, transport, command, args, env, url } = normalizedConfig;

    // Disconnect existing if any
    if (this.connections.has(id)) {
      await this.disconnect(id);
    }

    let clientTransport;
    let _effectiveTransport = transport;

    if (transport === "stdio") {
      // If command is npx and the package exists in local node_modules/.bin,
      // use the local (patched) binary instead of downloading a fresh copy.
      let resolvedCommand = command;
      let resolvedArgs = args;
      if (command === "npx" && args.length >= 1) {
        const pkgName = args[0]
          .replace(/@latest$/, "")
          .replace(/@[\d.^~]+$/, "");
        const localBin = path.join(
          __dirname,
          "..",
          "node_modules",
          ".bin",
          pkgName.split("/").pop(),
        );
        if (fs.existsSync(localBin)) {
          resolvedCommand = localBin;
          resolvedArgs = args.slice(1); // drop the package name, keep remaining args
          this.debug("Stdio: using local binary", {
            localBin,
            args: resolvedArgs.join(" "),
          });
        }
      }
      this.debug("Stdio transport", {
        command: resolvedCommand,
        args: resolvedArgs.join(" "),
        envKeys: Object.keys(env || {}),
      });
      clientTransport = new StdioClientTransport({
        command: resolvedCommand,
        args: resolvedArgs,
        env: buildStdioMcpEnv(id, env),
      });
    } else if (transport === "sse") {
      clientTransport = new SSEClientTransport(new URL(url));
    } else if (transport === "http") {
      clientTransport = new StreamableHTTPClientTransport(new URL(url));
    } else {
      throw new Error(`Unknown transport type: ${transport}`);
    }

    const client = new Client(
      { name: "code-companion", version: "1.0.0" },
      {
        capabilities: {},
        jsonSchemaValidator: this._jsonSchemaValidator,
      },
    );

    try {
      await client.connect(clientTransport);
      const { tools } = await client.listTools();

      this.connections.set(id, {
        client,
        transport: clientTransport,
        config: normalizedConfig,
        tools: tools || [],
        status: "connected",
        connectedAt: new Date(),
        error: null,
      });

      this.log(
        "INFO",
        `Connected to external MCP server: ${normalizedConfig.name} (${tools.length} tools)`,
      );
      return tools;
    } catch (err) {
      // Auto-fallback: if HTTP (streamable-http) fails with Method Not Allowed, retry as SSE
      if (
        transport === "http" &&
        err.message &&
        err.message.includes("Method Not Allowed")
      ) {
        this.log(
          "INFO",
          `Streamable HTTP failed for ${normalizedConfig.name}, falling back to SSE transport`,
        );
        try {
          const sseTransport = new SSEClientTransport(new URL(url));
          const sseClient = new Client(
            { name: "code-companion", version: "1.0.0" },
            {
              capabilities: {},
              jsonSchemaValidator: this._jsonSchemaValidator,
            },
          );
          await sseClient.connect(sseTransport);
          const { tools } = await sseClient.listTools();
          _effectiveTransport = "sse";

          this.connections.set(id, {
            client: sseClient,
            transport: sseTransport,
            config: { ...normalizedConfig, _effectiveTransport: "sse" },
            tools: tools || [],
            status: "connected",
            connectedAt: new Date(),
            error: null,
          });

          this.log(
            "INFO",
            `Connected to external MCP server via SSE fallback: ${normalizedConfig.name} (${tools.length} tools)`,
          );
          return tools;
        } catch (sseErr) {
          this.connections.set(id, {
            client: null,
            transport: null,
            config: normalizedConfig,
            tools: [],
            status: "error",
            connectedAt: null,
            error: `HTTP failed: ${err.message}; SSE fallback also failed: ${sseErr.message}`,
          });
          throw new Error(
            `HTTP failed: ${err.message}; SSE fallback also failed: ${sseErr.message}`,
          );
        }
      }

      this.connections.set(id, {
        client: null,
        transport: null,
        config: normalizedConfig,
        tools: [],
        status: "error",
        connectedAt: null,
        error: enrichTransportError(err).message,
      });
      throw enrichTransportError(err);
    }
  }

  async disconnect(id) {
    this._connecting.delete(id); // cancel in-flight dedup so next connect starts fresh
    const conn = this.connections.get(id);
    if (!conn) return;
    try {
      if (conn.client) await conn.client.close();
      if (conn.transport) await conn.transport.close();
    } catch (err) {
      this.debug("Disconnect cleanup error", { id, error: err.message });
    }
    this.connections.delete(id);
  }

  async callTool(serverId, toolName, toolArgs, { timeout } = {}) {
    const conn = this.connections.get(serverId);
    if (!conn || conn.status !== "connected") {
      throw new Error(`Server ${serverId} not connected`);
    }
    try {
      const opts = timeout != null ? { timeout } : undefined;
      return await conn.client.callTool(
        { name: toolName, arguments: toolArgs },
        undefined,
        opts,
      );
    } catch (err) {
      throw enrichTransportError(err);
    }
  }

  // Get all enabled tools across all connected servers
  getAllTools(disabledToolsMap = {}) {
    const allTools = [];
    for (const [id, conn] of this.connections) {
      if (conn.status !== "connected") continue;
      const disabled = disabledToolsMap[id] || [];
      for (const tool of conn.tools) {
        if (!disabled.includes(tool.name)) {
          allTools.push({
            serverId: id,
            serverName: conn.config.name,
            ...tool,
          });
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
        error: conn.error,
      });
    }
    return statuses;
  }

  getConnection(id) {
    return this.connections.get(id);
  }

  async disconnectAll() {
    for (const id of this.connections.keys()) {
      await this.disconnect(id);
    }
  }

  validateAndNormalizeConfig(serverConfig = {}) {
    const normalized = {
      id: String(serverConfig.id || "").trim(),
      name: String(serverConfig.name || "").trim(),
      transport: String(serverConfig.transport || "").trim(),
      command:
        typeof serverConfig.command === "string"
          ? serverConfig.command.trim()
          : "",
      args: Array.isArray(serverConfig.args) ? serverConfig.args : [],
      env:
        serverConfig.env &&
        typeof serverConfig.env === "object" &&
        !Array.isArray(serverConfig.env)
          ? serverConfig.env
          : {},
      url: typeof serverConfig.url === "string" ? serverConfig.url.trim() : "",
      autoConnect: Boolean(serverConfig.autoConnect),
      disabledTools: [], // normalized below
    };

    // Normalize disabledTools: strings only, trimmed, de-duplicated, no empties
    if (!Array.isArray(serverConfig.disabledTools)) {
      normalized.disabledTools = [];
    } else {
      normalized.disabledTools = [
        ...new Set(
          serverConfig.disabledTools
            .map((name) => {
              if (typeof name !== "string") {
                throw new Error(
                  "Invalid MCP client config: disabledTools entries must be strings",
                );
              }
              return name.trim();
            })
            .filter(Boolean),
        ),
      ];
    }

    if (!normalized.id || !normalized.name || !normalized.transport) {
      throw new Error(
        "Invalid MCP client config: id, name, and transport are required",
      );
    }

    if (normalized.id === "builtin") {
      throw new Error(
        'Invalid MCP client config: "builtin" is a reserved server ID',
      );
    }

    if (!["stdio", "http", "sse"].includes(normalized.transport)) {
      throw new Error(
        "Invalid MCP client config: transport must be stdio, http, or sse",
      );
    }

    if (normalized.transport === "stdio") {
      if (!normalized.command) {
        throw new Error(
          "Invalid MCP client config: command is required for stdio transport",
        );
      }
      if (/\s/.test(normalized.command)) {
        throw new Error(
          "Invalid MCP client config: command must be executable only (no inline arguments)",
        );
      }
      if (/[;&|`$><]/.test(normalized.command)) {
        throw new Error(
          "Invalid MCP client config: command contains forbidden shell characters",
        );
      }

      const isAbsolute = path.isAbsolute(normalized.command);
      const looksLikeExeName = /^[a-zA-Z0-9._-]+$/.test(normalized.command);
      if (!isAbsolute && !looksLikeExeName) {
        throw new Error(
          "Invalid MCP client config: command must be an executable name or absolute path",
        );
      }
      if (isAbsolute && !fs.existsSync(normalized.command)) {
        throw new Error(
          "Invalid MCP client config: command path does not exist",
        );
      }

      normalized.args = normalized.args.map((arg) => {
        if (typeof arg !== "string") {
          throw new Error(
            "Invalid MCP client config: all args must be strings",
          );
        }
        if (arg.includes("\u0000")) {
          throw new Error(
            "Invalid MCP client config: args cannot contain null bytes",
          );
        }
        if (arg.length > 2000) {
          throw new Error("Invalid MCP client config: arg exceeds max length");
        }
        return arg;
      });
    }

    if (normalized.transport === "http" || normalized.transport === "sse") {
      if (!normalized.url) {
        throw new Error(
          `Invalid MCP client config: url is required for ${normalized.transport} transport`,
        );
      }
      let parsedUrl;
      try {
        parsedUrl = new URL(normalized.url);
      } catch {
        throw new Error(
          "Invalid MCP client config: url must be a valid absolute URL",
        );
      }
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error(
          "Invalid MCP client config: url protocol must be http or https",
        );
      }
    }

    const cleanEnv = {};
    for (const [key, value] of Object.entries(normalized.env)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        throw new Error(
          `Invalid MCP client config: env key "${key}" is invalid`,
        );
      }
      if (value === null || value === undefined) continue;
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        cleanEnv[key] = String(value);
      } else {
        throw new Error(
          `Invalid MCP client config: env value for "${key}" must be string/number/boolean`,
        );
      }
    }
    normalized.env = cleanEnv;

    return normalized;
  }
}

module.exports = McpClientManager;
module.exports.buildStdioMcpEnv = buildStdioMcpEnv;
module.exports.createMcpJsonSchemaValidator = createMcpJsonSchemaValidator;
