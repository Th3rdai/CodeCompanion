const test = require("node:test");
const assert = require("node:assert/strict");

const McpClientManager = require("../lib/mcp-client-manager");

function createManager() {
  return new McpClientManager({
    log: () => {},
    debug: () => {},
  });
}

test("MCP config validation rejects stdio command with inline args", () => {
  const manager = createManager();
  assert.throws(() => {
    manager.validateAndNormalizeConfig({
      id: "a",
      name: "A",
      transport: "stdio",
      command: "node server.js",
      args: [],
    });
  }, /executable only/);
});

test("MCP config validation rejects forbidden shell characters", () => {
  const manager = createManager();
  assert.throws(() => {
    manager.validateAndNormalizeConfig({
      id: "a",
      name: "A",
      transport: "stdio",
      command: "node;rm",
      args: [],
    });
  }, /forbidden shell characters/);
});

test("MCP config validation rejects invalid env key", () => {
  const manager = createManager();
  assert.throws(() => {
    manager.validateAndNormalizeConfig({
      id: "a",
      name: "A",
      transport: "stdio",
      command: "node",
      args: ["mcp-server.js"],
      env: { "BAD-KEY": "x" },
    });
  }, /env key/);
});

test("MCP config validation keeps args unchanged and normalizes env values", () => {
  const manager = createManager();
  const normalized = manager.validateAndNormalizeConfig({
    id: "safe-client",
    name: "Safe Client",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem"],
    env: { PORT: 3000, ENABLED: true, NAME: "ok" },
  });

  assert.deepEqual(normalized.args, [
    "-y",
    "@modelcontextprotocol/server-filesystem",
  ]);
  assert.deepEqual(normalized.env, {
    PORT: "3000",
    ENABLED: "true",
    NAME: "ok",
  });
});

test("MCP config validation rejects non-http protocols", () => {
  const manager = createManager();
  assert.throws(() => {
    manager.validateAndNormalizeConfig({
      id: "h",
      name: "H",
      transport: "http",
      url: "file:///tmp/socket",
    });
  }, /protocol must be http or https/);
});
