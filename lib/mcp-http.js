/**
 * lib/mcp-http.js
 *
 * MCP HTTP transport — factory-per-request McpServer and the /mcp Express
 * handler. Extracted from server.js in Phase 24.5-03.
 *
 * Usage:
 *   const { mountMcpHttp } = require("./lib/mcp-http");
 *   mountMcpHttp(app, { getConfig, log, debug, requireLocalOrApiKey, deps });
 *
 * `deps` is the shared object forwarded to registerAllTools (listModels,
 * chatComplete, checkConnection, buildFileTree, readProjectFile,
 * listConversations, etc.).
 */

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { registerAllTools } = require("../mcp/tools");

function createMcpServerFactory({ getConfig, log, debug, deps }) {
  return function createMcpServer() {
    const config = getConfig();
    const disabledTools = config.mcpServer?.disabledTools || [];
    const mcpServer = new McpServer({
      name: "code-companion-mcp",
      version: "1.0.0",
    });
    registerAllTools(
      mcpServer,
      {
        getConfig,
        log,
        debug,
        ...deps,
      },
      disabledTools,
    );
    return mcpServer;
  };
}

function mountMcpHttp(
  app,
  { getConfig, log, debug, requireLocalOrApiKey, deps },
) {
  const createMcpServer = createMcpServerFactory({
    getConfig,
    log,
    debug,
    deps,
  });

  app.all("/mcp", requireLocalOrApiKey, async (req, res) => {
    try {
      const config = getConfig();
      if (config.mcpServer?.httpEnabled === false) {
        return res.status(503).json({ error: "MCP server is disabled" });
      }
      const mcpServer = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on("close", () => transport.close());
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      log("ERROR", "MCP request failed", { error: err.message });
      if (!res.headersSent) {
        res.status(500).json({ error: "MCP server error" });
      }
    }
  });
}

module.exports = { mountMcpHttp };
