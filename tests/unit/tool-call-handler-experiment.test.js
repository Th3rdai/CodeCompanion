const { test } = require("node:test");
const assert = require("node:assert/strict");
const ToolCallHandler = require("../../lib/tool-call-handler");

test("experiment strict policy blocks MCP tools", async () => {
  const h = new ToolCallHandler(
    {
      getAllTools: () => [
        {
          serverId: "notes",
          serverName: "notes",
          name: "read",
          description: "x",
        },
      ],
      callTool: async () => ({ content: [{ type: "text", text: "ok" }] }),
    },
    { log: () => {}, debug: () => {}, getConfig: () => ({}) },
  );
  h._experimentToolPolicy = "strict";
  const r = await h.executeTool("notes", "read", {});
  h._experimentToolPolicy = null;
  assert.equal(r.success, false);
  assert.match(r.error, /does not allow MCP/i);
});
