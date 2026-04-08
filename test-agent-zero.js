#!/usr/bin/env node
const McpClientManager = require("./lib/mcp-client-manager");
const { initConfig, getConfig } = require("./lib/config");
const _path = require("path");

// App root must match server.js / CLI so `.cc-config.json` and getAppRoot() resolve correctly
initConfig(__dirname);

const config = getConfig();
const mcpClient = new McpClientManager({
  log: (level, msg, data) => console.log(`[${level}] ${msg}`, data || ""),
  debug: (msg, data) => console.log(`[DEBUG] ${msg}`, data || ""),
  getConfig: () => config,
});

async function testAgentZero() {
  try {
    console.log("\n=== Testing Agent Zero Connection ===\n");

    const agentZeroConfig = (config.mcpClients || []).find(
      (c) => c.id === "agent-zero",
    );
    if (!agentZeroConfig) {
      console.error("Agent Zero not found in config");
      return;
    }

    console.log("Connecting to Agent Zero...");
    const tools = await mcpClient.connect(agentZeroConfig);
    console.log(
      `✅ Connected! Available tools: ${tools.map((t) => t.name).join(", ")}\n`,
    );

    console.log("Sending message to Agent Zero...");
    const result = await mcpClient.callTool("agent-zero", "send_message", {
      message:
        "Hello! I am Code Companion. Can you briefly tell me what capabilities you have for agent-to-agent collaboration?",
    });

    console.log("\n=== AGENT ZERO RESPONSE ===");
    console.log(JSON.stringify(result, null, 2));

    await mcpClient.disconnect("agent-zero");
    console.log("\n✅ Test complete!");
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    console.error(err.stack);
  }
}

testAgentZero()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
