#!/usr/bin/env node
/**
 * Code Companion MCP Server — stdio transport
 * Used by Claude Desktop, Claude Code, Cursor, etc.
 */
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { createLogger } = require('./lib/logger');
const { initConfig, getConfig } = require('./lib/config');
const { initHistory, listConversations } = require('./lib/history');
const { listModels, chatComplete, checkConnection } = require('./lib/ollama-client');
const { buildFileTree, readProjectFile } = require('./lib/file-browser');
const { registerAllTools } = require('./mcp/tools');

const appRoot = __dirname;

// ALL logging goes to stderr in stdio mode
const { log, debug } = createLogger(appRoot, {
  stderrMode: true,
  debugEnabled: process.env.DEBUG === '1'
});

// Initialize modules
initConfig(appRoot);
initHistory(appRoot);

async function main() {
  const config = getConfig();
  const disabledTools = config.mcpServer?.disabledTools || [];
  
  const server = new McpServer({
    name: 'code-companion-mcp',
    version: '1.0.0'
  });

  registerAllTools(server, {
    getConfig, log, debug,
    listModels, chatComplete, checkConnection,
    buildFileTree, readProjectFile, listConversations
  }, disabledTools);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  log('INFO', 'Code Companion MCP server running via stdio');
}

main().catch(err => {
  console.error('Fatal MCP server error:', err);
  process.exit(1);
});
