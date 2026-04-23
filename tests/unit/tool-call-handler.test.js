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

test("parseToolCalls parses minimax parameter-style invoke format", () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(undefined);
  const h = new ToolCallHandler({});
  const text = `<minimax:tool_call>
  <invoke name="playwright.browser_navigate">
    <parameter name="url">https://example.com</parameter>
  </invoke>
  <invoke name="builtin.run_shell_command">
    <parameter name="command">pwd</parameter>
  </invoke>
</minimax:tool_call>`;
  const calls = h.parseToolCalls(text);
  assert.strictEqual(calls.length, 2);
  assert.deepStrictEqual(calls[0], {
    serverId: "playwright",
    toolName: "browser_navigate",
    args: { url: "https://example.com" },
  });
  assert.deepStrictEqual(calls[1], {
    serverId: "builtin",
    toolName: "run_shell_command",
    args: { command: "pwd" },
  });
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

test("buildToolsPrompt includes agent identity override forbidding teacher-deflection phrases", () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(undefined);
  const h = new ToolCallHandler(
    { getAllTools: () => [] },
    { getConfig: () => ({}) },
  );
  const p = h.buildToolsPrompt();
  assert.ok(p.includes("AGENT IDENTITY OVERRIDE"), "expected override header");
  assert.ok(
    p.includes("you'll need to run this yourself"),
    "expected explicit forbidden phrase listed",
  );
  assert.ok(
    p.includes("you are the one holding the keyboard"),
    "expected keyboard deflection phrase listed",
  );
  assert.ok(
    p.includes("I cannot directly execute browser automation commands"),
    "expected browser-automation deflection phrase listed",
  );
  assert.ok(
    p.includes("Those statements are FALSE"),
    "expected FALSE assertion",
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
        "AGENT TERMINAL: builtin.run_terminal_cmd executes shell commands",
      ),
      "expected updated terminal session line",
    );
    assert.ok(p.includes("builtin.run_terminal_cmd:"));
    // Option B: example + allowlist reminder
    assert.ok(
      p.includes('TOOL_CALL: builtin.run_terminal_cmd({"command": "ls"'),
      "expected example TOOL_CALL in terminal section",
    );
    assert.ok(
      p.includes(
        "Use only commands allowed in Settings → Agent terminal allowlist",
      ),
      "expected allowlist reminder",
    );
    // Option C: affirmative must-use bullet
    assert.ok(
      p.includes("You MUST use TOOL_CALL to run commands"),
      "expected must-use TOOL_CALL bullet in terminal preamble",
    );
  } finally {
    if (prevHost === undefined) delete process.env.HOST;
    else process.env.HOST = prevHost;
    if (prevAllow === undefined) delete process.env.CC_ALLOW_AGENT_TERMINAL;
    else process.env.CC_ALLOW_AGENT_TERMINAL = prevAllow;
  }
});

test("getToolsPromptAndFlags returns prompt + flags from single builtinTools pass", () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(undefined);
  const prevHost = process.env.HOST;
  process.env.HOST = "127.0.0.1";
  try {
    const h = new ToolCallHandler(
      { getAllTools: () => [] },
      {
        getConfig: () => ({
          projectFolder: "/tmp/cc-test-project",
          agentTerminal: { enabled: true, allowlist: ["ls"] },
        }),
      },
    );
    const result = h.getToolsPromptAndFlags();
    assert.ok(typeof result.prompt === "string", "prompt is a string");
    assert.strictEqual(
      result.hasTerminalTool,
      true,
      "hasTerminalTool true when terminal enabled",
    );
    assert.strictEqual(
      typeof result.hasValidateTool,
      "boolean",
      "hasValidateTool is boolean",
    );
    assert.strictEqual(
      typeof result.hasPlannerTool,
      "boolean",
      "hasPlannerTool is boolean",
    );
    // buildToolsPrompt() wrapper returns the same prompt
    assert.strictEqual(
      h.buildToolsPrompt(),
      result.prompt,
      "buildToolsPrompt() matches prompt field",
    );
  } finally {
    if (prevHost === undefined) delete process.env.HOST;
    else process.env.HOST = prevHost;
  }
});

test("getToolsPromptAndFlags hasTerminalTool false when terminal disabled", () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(undefined);
  const h = new ToolCallHandler(
    { getAllTools: () => [] },
    { getConfig: () => ({ agentTerminal: { enabled: false } }) },
  );
  const { hasTerminalTool, prompt } = h.getToolsPromptAndFlags();
  assert.strictEqual(hasTerminalTool, false);
  assert.strictEqual(
    h.getToolsPromptAndFlags().hasBrowserTool,
    false,
    "hasBrowserTool defaults to false",
  );
  assert.ok(
    !prompt.includes("CAPABILITY:"),
    "no lead-in needed in prompt itself",
  );
});

test("getToolsPromptAndFlags detects browser MCP tools", () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(undefined);
  const h = new ToolCallHandler(
    {
      getAllTools: () => [
        {
          serverId: "playwright",
          name: "browser_navigate",
          description: "Navigate browser to URL",
        },
      ],
    },
    { getConfig: () => ({}) },
  );
  const { hasBrowserTool } = h.getToolsPromptAndFlags();
  assert.strictEqual(hasBrowserTool, true);
});

test("buildToolsPrompt includes AGENT BROWSER guidance when browser tools are available", () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(undefined);
  const h = new ToolCallHandler(
    {
      getAllTools: () => [
        {
          serverId: "playwright",
          name: "browser_navigate",
          description: "Navigate browser to URL",
        },
      ],
    },
    { getConfig: () => ({}) },
  );
  const p = h.buildToolsPrompt();
  assert.ok(
    p.includes("AGENT BROWSER:"),
    "expected browser capability section in tools prompt",
  );
  assert.ok(
    p.includes("browser_navigate"),
    "expected browser_navigate example in AGENT BROWSER guidance",
  );
});

test("getToolsPromptAndFlags flags are all false when gated tools disabled (always-on tools still present)", () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(undefined);
  const h = new ToolCallHandler(
    { getAllTools: () => [] },
    {
      getConfig: () => ({
        agentTerminal: { enabled: false },
        agentValidate: { enabled: false },
        agentPlanner: { enabled: false },
      }),
    },
  );
  const result = h.getToolsPromptAndFlags();
  // write_file / generate_office_file / view_pdf_pages are always on — prompt is non-empty
  assert.ok(
    result.prompt.length > 0,
    "prompt non-empty (always-on tools present)",
  );
  assert.strictEqual(result.hasTerminalTool, false);
  assert.strictEqual(result.hasValidateTool, false);
  assert.strictEqual(result.hasPlannerTool, false);
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
