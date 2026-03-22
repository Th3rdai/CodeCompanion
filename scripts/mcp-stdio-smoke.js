#!/usr/bin/env node
/**
 * Non-interactive smoke test: stdio MCP (mcp-server.js) — initialize + list tools.
 * Usage: node scripts/mcp-stdio-smoke.js   (from repo root)
 */
const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const root = path.resolve(__dirname, '..');

(async () => {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(root, 'mcp-server.js')],
    cwd: root,
  });
  const client = new Client({ name: 'mcp-stdio-smoke', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  const { tools } = await client.listTools();
  console.log(`stdio MCP: OK — ${tools.length} tools`);
  console.log(tools.map((t) => t.name).join(', '));
  await client.close();
})().catch((e) => {
  console.error('stdio MCP: FAIL', e.message);
  process.exit(1);
});
