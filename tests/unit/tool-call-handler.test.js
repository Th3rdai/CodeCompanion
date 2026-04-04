const { test } = require("node:test");
const assert = require("node:assert");
const path = require("path");

const handlerPath = path.join(__dirname, "../../lib/tool-call-handler.js");

function loadHandlerWithMcpTimeoutMs(ms) {
  const prev = process.env.MCP_TOOL_TIMEOUT_MS;
  if (ms === undefined) delete process.env.MCP_TOOL_TIMEOUT_MS;
  else process.env.MCP_TOOL_TIMEOUT_MS = String(ms);
  delete require.cache[require.resolve(handlerPath)];
  const ToolCallHandler = require(handlerPath);
  if (prev === undefined) delete process.env.MCP_TOOL_TIMEOUT_MS;
  else process.env.MCP_TOOL_TIMEOUT_MS = prev;
  return ToolCallHandler;
}

test("parseToolCalls XML fallback parses reliably on repeated invocations", () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(undefined);
  const h = new ToolCallHandler({});
  const xml = '<notes.read_file>{"path":"/tmp/x"}</notes.read_file>';
  for (let i = 0; i < 3; i++) {
    const calls = h.parseToolCalls(xml);
    assert.strictEqual(calls.length, 1, `invocation ${i}`);
    assert.strictEqual(calls[0].serverId, "notes");
    assert.strictEqual(calls[0].toolName, "read_file");
    assert.deepStrictEqual(calls[0].args, { path: "/tmp/x" });
  }
});

test("parseToolCalls primary TOOL_CALL format on repeated invocations", () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(undefined);
  const h = new ToolCallHandler({});
  const text = 'TOOL_CALL: grep.run({"pattern":"foo"})';
  for (let i = 0; i < 3; i++) {
    const calls = h.parseToolCalls(text);
    assert.strictEqual(calls.length, 1, `invocation ${i}`);
    assert.strictEqual(calls[0].serverId, "grep");
    assert.strictEqual(calls[0].toolName, "run");
    assert.deepStrictEqual(calls[0].args, { pattern: "foo" });
  }
});

test("executeTool MCP returns error when callTool exceeds timeout", async () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(80);
  const mockMcp = {
    getAllTools: () => [],
    callTool: () => new Promise(() => {}),
  };
  const h = new ToolCallHandler(mockMcp);
  const r = await h.executeTool("slowserver", "slowtool", {});
  assert.strictEqual(r.success, false);
  assert.match(r.error, /slowserver\.slowtool.*timed out/i);
});

test("executeTool MCP succeeds when callTool resolves within timeout", async () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(5000);
  const mockMcp = {
    getAllTools: () => [],
    callTool: async () => ({
      content: [{ type: "text", text: "ok" }],
    }),
  };
  const h = new ToolCallHandler(mockMcp);
  const r = await h.executeTool("fast", "tool", {});
  assert.strictEqual(r.success, true);
  assert.strictEqual(r.result.content[0].text, "ok");
});

test("buildToolsPrompt includes anti-hallucination block and sourcePath hint for PDFs", () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(undefined);
  const h = new ToolCallHandler(
    { getAllTools: () => [] },
    { getConfig: () => ({}) },
  );
  const p = h.buildToolsPrompt();
  assert.ok(
    p.includes("CRITICAL — NO FAKE SERVER ERRORS"),
    "expected CRITICAL block",
  );
  assert.ok(
    p.includes("413") && p.includes("sourcePath"),
    "expected 413 warning and sourcePath hint",
  );
});

test("buildToolsPrompt omits terminal preamble and AGENT TERMINAL when terminal tool not advertised", () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(undefined);
  const h = new ToolCallHandler(
    { getAllTools: () => [] },
    { getConfig: () => ({ agentTerminal: { enabled: false } }) },
  );
  const p = h.buildToolsPrompt();
  assert.ok(!p.includes("TERMINAL TOOL SAFETY"));
  assert.ok(!p.includes("AGENT TERMINAL:"));
});

test("buildToolsPrompt includes terminal preamble and AGENT TERMINAL when builtin run_terminal_cmd is advertised", () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(undefined);
  const prevHost = process.env.HOST;
  const prevAllow = process.env.CC_ALLOW_AGENT_TERMINAL;
  process.env.HOST = "127.0.0.1";
  delete process.env.CC_ALLOW_AGENT_TERMINAL;
  try {
    const h = new ToolCallHandler(
      { getAllTools: () => [] },
      {
        getConfig: () => ({
          projectFolder: "/tmp/cc-test-project",
          agentTerminal: { enabled: true, allowlist: ["npm"] },
        }),
      },
    );
    const p = h.buildToolsPrompt();
    assert.ok(p.includes("TERMINAL TOOL SAFETY (builtin.run_terminal_cmd)"));
    assert.ok(
      p.includes(
        "AGENT TERMINAL: builtin.run_terminal_cmd is available for this session",
      ),
    );
    assert.ok(p.includes("builtin.run_terminal_cmd:"));
  } finally {
    if (prevHost === undefined) delete process.env.HOST;
    else process.env.HOST = prevHost;
    if (prevAllow === undefined) delete process.env.CC_ALLOW_AGENT_TERMINAL;
    else process.env.CC_ALLOW_AGENT_TERMINAL = prevAllow;
  }
});

test("buildToolsPrompt omits terminal when bind is exposed without CC_ALLOW_AGENT_TERMINAL (matches getBuiltinTools)", () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(undefined);
  const prevHost = process.env.HOST;
  const prevAllow = process.env.CC_ALLOW_AGENT_TERMINAL;
  // ELECTRON_RUN_AS_NODE may be set in the host environment (e.g. Claude Code);
  // clear it so the guard treats this as a non-Electron web-server context.
  const prevElectron = process.env.ELECTRON_RUN_AS_NODE;
  process.env.HOST = "0.0.0.0";
  delete process.env.CC_ALLOW_AGENT_TERMINAL;
  delete process.env.ELECTRON_RUN_AS_NODE;
  try {
    const h = new ToolCallHandler(
      { getAllTools: () => [] },
      {
        getConfig: () => ({
          agentTerminal: { enabled: true, allowlist: ["npm"] },
        }),
      },
    );
    const p = h.buildToolsPrompt();
    assert.ok(!p.includes("TERMINAL TOOL SAFETY"));
    assert.ok(!p.includes("AGENT TERMINAL:"));
    assert.ok(!p.includes("builtin.run_terminal_cmd:"));
  } finally {
    if (prevHost === undefined) delete process.env.HOST;
    else process.env.HOST = prevHost;
    if (prevAllow === undefined) delete process.env.CC_ALLOW_AGENT_TERMINAL;
    else process.env.CC_ALLOW_AGENT_TERMINAL = prevAllow;
    if (prevElectron === undefined) delete process.env.ELECTRON_RUN_AS_NODE;
    else process.env.ELECTRON_RUN_AS_NODE = prevElectron;
  }
});
