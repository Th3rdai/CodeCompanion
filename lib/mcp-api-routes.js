const express = require("express");
const { CLIENT_INTERNAL_ERROR } = require("./client-errors");

/** User-visible MCP connect failure (no stack traces; route is loopback/API-key gated). */
function safeMcpConnectMessage(err) {
  const raw = String(err?.message || err || "Connection failed");
  const line = raw.split("\n")[0].trim();
  if (!line) return "Connection failed";
  return line.length > 400 ? `${line.slice(0, 397)}…` : line;
}

/** Non-secret transport summary for logs/app.log (stdio command/args or remote URL). */
function mcpTransportSummary(cfg) {
  if (!cfg) return {};
  const t = cfg.transport;
  if (t === "stdio") {
    return {
      transport: "stdio",
      command: cfg.command || "",
      args: Array.isArray(cfg.args) ? cfg.args : [],
    };
  }
  return { transport: t, url: cfg.url || "" };
}

function createMcpApiRoutes(deps) {
  const {
    getConfig,
    updateConfig,
    mcpClientManager,
    log,
    debug: _debug,
    requireLocalOrApiKey,
  } = deps;
  const router = express.Router();

  // Closure-scoped helper: previously declared at module top-level which left
  // `log` undefined and made every error path throw a silent ReferenceError —
  // routes returned a generic 500 instead of the explicit 502 + safe message,
  // and app.log captured nothing about the underlying transport failure.
  // Bringing it inside the closure so the connect-failure surface (banner +
  // log line) actually carries the underlying stdio command or HTTP error.
  function logMcpConnectFailure(phase, cfg, err) {
    log("ERROR", `MCP connect failed (${phase})`, {
      clientId: cfg?.id,
      clientName: cfg?.name,
      ...mcpTransportSummary(cfg),
      error: String(err?.message || err),
    });
  }

  if (typeof requireLocalOrApiKey === "function") {
    router.use(requireLocalOrApiKey);
  }

  // ---- MCP Server Management ----

  // In-memory usage stats (resets on server restart)
  const stats = {
    totalCalls: 0,
    callsByTool: {},
    callsToday: 0,
    lastCallAt: null,
    todayDate: new Date().toDateString(),
  };

  function recordToolCall(toolName) {
    const today = new Date().toDateString();
    if (today !== stats.todayDate) {
      stats.callsToday = 0;
      stats.todayDate = today;
    }
    stats.totalCalls++;
    stats.callsToday++;
    stats.callsByTool[toolName] = (stats.callsByTool[toolName] || 0) + 1;
    stats.lastCallAt = new Date().toISOString();
  }

  router.get("/mcp/server/status", (req, res) => {
    const config = getConfig();
    res.json({
      httpEnabled: config.mcpServer?.httpEnabled !== false,
      endpoint: "https://localhost:8900/mcp",
      stdioCommand: "node mcp-server.js",
      disabledTools: config.mcpServer?.disabledTools || [],
    });
  });

  router.post("/mcp/server/toggle", (req, res) => {
    const config = getConfig();
    const mcpServer = config.mcpServer || {};
    mcpServer.httpEnabled = req.body.enabled !== false;
    updateConfig({ mcpServer });
    log(
      "INFO",
      `MCP HTTP endpoint ${mcpServer.httpEnabled ? "enabled" : "disabled"}`,
    );
    res.json({ httpEnabled: mcpServer.httpEnabled });
  });

  router.post("/mcp/server/tools", (req, res) => {
    const { disabledTools } = req.body;
    if (!Array.isArray(disabledTools))
      return res.status(400).json({ error: "disabledTools must be an array" });
    const config = getConfig();
    const mcpServer = config.mcpServer || {};
    mcpServer.disabledTools = disabledTools;
    updateConfig({ mcpServer });
    res.json({ disabledTools });
  });

  router.get("/mcp/server/stats", (req, res) => {
    res.json(stats);
  });

  router.get("/mcp/server/clients", (req, res) => {
    // Track recent HTTP request activity (simplified for stateless transport)
    res.json({
      clients: [],
      note: "Stateless HTTP transport — client tracking not available",
    });
  });

  // ---- MCP Client Management ----

  // Test connection (must be BEFORE :id routes so Express doesn't match "test-connection" as :id)
  router.post("/mcp/clients/test-connection", async (req, res) => {
    const { transport, command, args, env, url } = req.body;
    if (!transport)
      return res.status(400).json({ error: "transport is required" });

    const tempConfig = {
      id: "_test",
      name: "test",
      transport,
      command,
      args,
      env,
      url,
    };
    try {
      const validated = mcpClientManager.validateAndNormalizeConfig(tempConfig);
      const tools = await mcpClientManager.connect(validated);
      await mcpClientManager.disconnect("_test");
      res.json({
        success: true,
        tools: tools.map((t) => ({ name: t.name, description: t.description })),
      });
    } catch (err) {
      await mcpClientManager.disconnect("_test").catch(() => {});
      const status = err.message.startsWith("Invalid MCP client config:")
        ? 400
        : 500;
      res.status(status).json({
        success: false,
        error: status === 400 ? err.message : CLIENT_INTERNAL_ERROR,
      });
    }
  });

  // Mask env var values for API responses
  function maskEnvVars(envObj) {
    if (!envObj) return {};
    const masked = {};
    for (const [key, val] of Object.entries(envObj)) {
      if (typeof val === "string" && val.length > 6) {
        masked[key] =
          val.substring(0, 3) + "..." + val.substring(val.length - 3);
      } else {
        masked[key] = "***";
      }
    }
    return masked;
  }

  router.get("/mcp/clients", (req, res) => {
    const config = getConfig();
    const clients = (config.mcpClients || []).map((c) => ({
      ...c,
      env: maskEnvVars(c.env),
    }));
    // Merge runtime status from McpClientManager
    const statuses = mcpClientManager.getStatuses();
    const enriched = clients.map((c) => {
      const status = statuses.find((s) => s.id === c.id);
      return {
        ...c,
        status: status?.status || "disconnected",
        toolCount: status?.toolCount || 0,
        error: status?.error || null,
      };
    });
    res.json(enriched);
  });

  router.post("/mcp/clients", async (req, res) => {
    const { id, name, transport, command, args, env, url, autoConnect } =
      req.body;
    if (!id || !name || !transport)
      return res
        .status(400)
        .json({ error: "id, name, and transport are required" });
    if (id === "builtin" || name === "builtin") {
      return res.status(400).json({
        error: '"builtin" is a reserved ID and cannot be used for MCP servers',
      });
    }

    const config = getConfig();
    const clients = config.mcpClients || [];
    if (clients.find((c) => c.id === id))
      return res.status(409).json({ error: `Client ${id} already exists` });

    let newClient;
    try {
      newClient = mcpClientManager.validateAndNormalizeConfig({
        id,
        name,
        transport,
        command,
        args,
        env,
        url,
        autoConnect: autoConnect || false,
        disabledTools: [],
      });
    } catch (err) {
      const status = err.message.startsWith("Invalid MCP client config:")
        ? 400
        : 500;
      return res
        .status(status)
        .json({ error: status === 400 ? err.message : CLIENT_INTERNAL_ERROR });
    }
    clients.push(newClient);
    updateConfig({ mcpClients: clients });

    let connectError = null;
    if (newClient.autoConnect) {
      try {
        await mcpClientManager.connect(newClient);
      } catch (err) {
        connectError = safeMcpConnectMessage(err);
        logMcpConnectFailure("after-add", newClient, err);
      }
    }
    res.json({
      ...newClient,
      env: maskEnvVars(newClient.env),
      ...(connectError ? { connectError } : {}),
    });
  });

  router.put("/mcp/clients/:id", async (req, res) => {
    if (req.params.id === "builtin") {
      return res.status(400).json({
        error: '"builtin" is a reserved ID and cannot be used for MCP servers',
      });
    }
    const config = getConfig();
    const clients = config.mcpClients || [];
    const idx = clients.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Client not found" });

    const updates = { ...req.body };
    // Don't allow changing id
    delete updates.id;
    const merged = { ...clients[idx], ...updates };

    // Validate BEFORE disconnecting so an invalid update never drops a working connection
    let validatedConfig;
    try {
      validatedConfig = mcpClientManager.validateAndNormalizeConfig(merged);
    } catch (err) {
      const status = err.message.startsWith("Invalid MCP client config:")
        ? 400
        : 500;
      return res
        .status(status)
        .json({ error: status === 400 ? err.message : CLIENT_INTERNAL_ERROR });
    }

    // Detect whether only disabledTools changed — if so, skip disconnect/reconnect
    const updateKeys = Object.keys(updates);
    const disabledToolsOnly =
      updateKeys.length === 1 && updateKeys[0] === "disabledTools";

    if (!disabledToolsOnly) {
      await mcpClientManager.disconnect(req.params.id).catch(() => {});
    }

    clients[idx] = validatedConfig;
    updateConfig({ mcpClients: clients });

    let connectError = null;
    if (validatedConfig.autoConnect) {
      try {
        await mcpClientManager.connect(validatedConfig);
      } catch (err) {
        connectError = safeMcpConnectMessage(err);
        logMcpConnectFailure("after-update", validatedConfig, err);
      }
    }
    res.json({
      ...clients[idx],
      env: maskEnvVars(clients[idx].env),
      ...(connectError ? { connectError } : {}),
    });
  });

  router.delete("/mcp/clients/:id", async (req, res) => {
    if (req.params.id === "builtin") {
      return res.status(400).json({
        error: '"builtin" is a reserved ID and cannot be used for MCP servers',
      });
    }
    const config = getConfig();
    const clients = config.mcpClients || [];
    const idx = clients.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Client not found" });

    // Disconnect first
    await mcpClientManager.disconnect(req.params.id);
    clients.splice(idx, 1);
    updateConfig({ mcpClients: clients });
    res.json({ ok: true });
  });

  router.post("/mcp/clients/:id/connect", async (req, res) => {
    const config = getConfig();
    const clientConfig = (config.mcpClients || []).find(
      (c) => c.id === req.params.id,
    );
    if (!clientConfig)
      return res.status(404).json({ error: "Client not found" });

    try {
      const tools = await mcpClientManager.connect(clientConfig);
      res.json({
        status: "connected",
        tools: tools.map((t) => ({ name: t.name, description: t.description })),
      });
    } catch (err) {
      logMcpConnectFailure("manual", clientConfig, err);
      res.status(502).json({
        error: safeMcpConnectMessage(err),
        status: "error",
      });
    }
  });

  router.post("/mcp/clients/:id/disconnect", async (req, res) => {
    await mcpClientManager.disconnect(req.params.id);
    res.json({ status: "disconnected" });
  });

  router.get("/mcp/clients/:id/tools", (req, res) => {
    const conn = mcpClientManager.getConnection(req.params.id);
    if (!conn || conn.status !== "connected") {
      return res.status(404).json({ error: "Not connected" });
    }
    res.json(
      conn.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    );
  });

  return { router, recordToolCall, stats };
}

module.exports = { createMcpApiRoutes };
