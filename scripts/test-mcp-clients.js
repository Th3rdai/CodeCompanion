#!/usr/bin/env node
/**
 * Smoke-test each entry in .cc-config.json → mcpClients (connect, list_tools, disconnect).
 * Does not start the HTTP server. Uses the same McpClientManager as server.js.
 *
 * Config root: **`lib/resolve-mcp-test-config-root.js`** (newest `.cc-config.json` among
 * repo, `CodeCompanion-Data/`, packaged mac app support; **`CC_DATA_DIR`** overrides).
 * Covered by **`tests/unit/resolve-mcp-test-config-root.test.js`**.
 *
 * Usage (from repo root):
 *   npm run mcp:clients:test
 */
"use strict";

const path = require("path");
const {
  resolveMcpTestConfigRoot,
} = require("../lib/resolve-mcp-test-config-root");
const { initConfig, getConfig } = require("../lib/config");
const McpClientManager = require("../lib/mcp-client-manager");

async function main() {
  const repoRoot = path.join(__dirname, "..");
  const appRoot = resolveMcpTestConfigRoot(repoRoot);
  if (appRoot !== repoRoot) {
    console.log(`Using config: ${path.join(appRoot, ".cc-config.json")}\n`);
  }
  initConfig(appRoot);
  const cfg = getConfig();
  const clients = (cfg.mcpClients || []).filter((c) => !c.disabled);

  if (!clients.length) {
    console.log(
      "No MCP clients in config (or all disabled). Add mcpClients in .cc-config.json, or set CC_DATA_DIR to the app data folder that contains .cc-config.json.",
    );
    process.exit(0);
  }

  const manager = new McpClientManager({
    log: (level, msg, extra) => {
      if (level === "ERROR") console.error(`[log] ${msg}`, extra || "");
    },
    debug: () => {},
  });

  let failed = 0;
  for (const c of clients) {
    const label = `${c.id} (${c.transport})`;
    process.stdout.write(`${label} ... `);
    try {
      const tools = await manager.connect(c);
      const sample = tools.map((t) => t.name).slice(0, 12);
      const more = tools.length > sample.length ? " …" : "";
      console.log(`OK (${tools.length} tools)`);
      console.log(`   ${sample.join(", ")}${more}`);
      await manager.disconnect(c.id);
    } catch (e) {
      failed += 1;
      console.log("FAIL");
      console.error(`   ${e?.message || e}`);
      await manager.disconnect(c.id).catch(() => {});
    }
  }

  if (failed) {
    console.error(`\nDone: ${failed}/${clients.length} failed.`);
    process.exit(1);
  }
  console.log(`\nDone: ${clients.length}/${clients.length} OK.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
