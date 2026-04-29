const { test } = require("node:test");
const assert = require("node:assert");
const path = require("path");

const handlerPath = path.join(__dirname, "../../lib/tool-call-handler.js");

function loadHandlerWithMcpTimeoutMs(ms) {
  const prev = process.env.MCP_TOOL_TIMEOUT_MS;
  const prevImage = process.env.MCP_IMAGE_TOOL_TIMEOUT_MS;
  if (ms === undefined) delete process.env.MCP_TOOL_TIMEOUT_MS;
  else process.env.MCP_TOOL_TIMEOUT_MS = String(ms);
  delete require.cache[require.resolve(handlerPath)];
  const ToolCallHandler = require(handlerPath);
  if (prev === undefined) delete process.env.MCP_TOOL_TIMEOUT_MS;
  else process.env.MCP_TOOL_TIMEOUT_MS = prev;
  if (prevImage === undefined) delete process.env.MCP_IMAGE_TOOL_TIMEOUT_MS;
  else process.env.MCP_IMAGE_TOOL_TIMEOUT_MS = prevImage;
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

test("executeTool MCP writes start/success logs with duration", async () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(5000);
  const logs = [];
  const mockMcp = {
    getAllTools: () => [],
    callTool: async () => ({ content: [{ type: "text", text: "ok" }] }),
  };
  const h = new ToolCallHandler(mockMcp, {
    log: (level, msg, data) => logs.push({ level, msg, data }),
  });

  const result = await h.executeTool("nano-banana", "generate_image", {
    prompt: "x",
  });

  assert.strictEqual(result.success, true);
  const started = logs.find((entry) => entry.msg === "MCP tool call started");
  assert.ok(started, "expected start log entry");
  assert.equal(typeof started.data.callId, "string");
  assert.ok(started.data.callId.startsWith("mcp_"));
  assert.equal(started.data.maxAttempts, 2);
  const success = logs.find((entry) => entry.msg === "MCP tool call succeeded");
  assert.ok(success, "expected success log entry");
  assert.equal(success.data.callId, started.data.callId);
  assert.equal(success.data.serverId, "nano-banana");
  assert.equal(success.data.toolName, "generate_image");
  assert.equal(typeof success.data.durationMs, "number");
});

test("executeTool MCP adds API key hint and logs failure details", async () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(5000);
  const logs = [];
  const mockMcp = {
    getAllTools: () => [],
    callTool: async () => {
      throw new Error("API_KEY_INVALID: API key not valid");
    },
  };
  const h = new ToolCallHandler(mockMcp, {
    log: (level, msg, data) => logs.push({ level, msg, data }),
  });

  const result = await h.executeTool("nano-banana", "generate_image", {
    prompt: "x",
  });

  assert.strictEqual(result.success, false);
  assert.match(result.error, /GEMINI_API_KEY/i);
  const started = logs.find((entry) => entry.msg === "MCP tool call started");
  assert.ok(started, "expected start log entry");
  assert.equal(started.data.maxAttempts, 2);
  const failure = logs.find((entry) => entry.msg === "MCP tool call failed");
  assert.ok(failure, "expected failure log entry");
  assert.equal(failure.level, "ERROR");
  assert.equal(failure.data.callId, started.data.callId);
  assert.equal(failure.data.serverId, "nano-banana");
  assert.equal(failure.data.toolName, "generate_image");
  assert.match(failure.data.error, /API_KEY_INVALID/i);
});

test("executeTool MCP adds Google Workspace auth recovery hint", async () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(5000);
  const mockMcp = {
    getAllTools: () => [],
    callTool: async () => {
      throw new Error("Unauthorized: OAuth consent required");
    },
  };
  const h = new ToolCallHandler(mockMcp);

  const result = await h.executeTool("google", "get_doc_content", {
    documentId: "abc123",
  });

  assert.strictEqual(result.success, false);
  assert.match(result.error, /authorization problem/i);
  assert.match(result.error, /not a document-format limitation/i);
  assert.match(result.error, /google\.start_google_auth/i);
});

test("executeTool MCP retries once on RESOURCE_EXHAUSTED and succeeds", async () => {
  const prevDelay = process.env.MCP_TOOL_RETRY_DELAY_MS;
  process.env.MCP_TOOL_RETRY_DELAY_MS = "1";
  try {
    const ToolCallHandler = loadHandlerWithMcpTimeoutMs(5000);
    const logs = [];
    let callCount = 0;
    const mockMcp = {
      getAllTools: () => [],
      callTool: async () => {
        callCount += 1;
        if (callCount === 1) {
          throw new Error("RESOURCE_EXHAUSTED: quota exceeded");
        }
        return { content: [{ type: "text", text: "ok-after-retry" }] };
      },
    };
    const h = new ToolCallHandler(mockMcp, {
      log: (level, msg, data) => logs.push({ level, msg, data }),
    });

    const result = await h.executeTool("nano-banana", "generate_image", {
      prompt: "x",
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result.content[0].text, "ok-after-retry");
    assert.strictEqual(callCount, 2);
    const started = logs.find((entry) => entry.msg === "MCP tool call started");
    assert.ok(started, "expected start log entry");
    assert.equal(started.data.maxAttempts, 2);
    const failures = logs.filter(
      (entry) => entry.msg === "MCP tool call failed",
    );
    assert.strictEqual(failures.length, 1);
    assert.strictEqual(failures[0].data.retryable, true);
    assert.strictEqual(failures[0].data.attempt, 1);
    const success = logs.find(
      (entry) => entry.msg === "MCP tool call succeeded",
    );
    assert.ok(success, "expected success log entry");
    assert.strictEqual(success.data.attempt, 2);
    assert.equal(success.data.callId, started.data.callId);
  } finally {
    if (prevDelay === undefined) delete process.env.MCP_TOOL_RETRY_DELAY_MS;
    else process.env.MCP_TOOL_RETRY_DELAY_MS = prevDelay;
  }
});

test("executeTool generate_image uses image timeout override over global timeout", async () => {
  const prevImageTimeout = process.env.MCP_IMAGE_TOOL_TIMEOUT_MS;
  process.env.MCP_IMAGE_TOOL_TIMEOUT_MS = "220";
  try {
    const ToolCallHandler = loadHandlerWithMcpTimeoutMs(80);
    const mockMcp = {
      getAllTools: () => [],
      callTool: async () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ content: [{ type: "text", text: "image-ok" }] }),
            120,
          ),
        ),
    };
    const h = new ToolCallHandler(mockMcp);
    const r = await h.executeTool("nano-banana", "generate_image", {});
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.result.content[0].text, "image-ok");
  } finally {
    if (prevImageTimeout === undefined)
      delete process.env.MCP_IMAGE_TOOL_TIMEOUT_MS;
    else process.env.MCP_IMAGE_TOOL_TIMEOUT_MS = prevImageTimeout;
  }
});

test("executeTool MCP retries once on timeout and then succeeds", async () => {
  const prevDelay = process.env.MCP_TOOL_RETRY_DELAY_MS;
  process.env.MCP_TOOL_RETRY_DELAY_MS = "1";
  try {
    const ToolCallHandler = loadHandlerWithMcpTimeoutMs(50);
    const logs = [];
    let callCount = 0;
    const mockMcp = {
      getAllTools: () => [],
      callTool: async () => {
        callCount += 1;
        if (callCount === 1) {
          return new Promise(() => {});
        }
        return { content: [{ type: "text", text: "ok-after-timeout-retry" }] };
      },
    };
    const h = new ToolCallHandler(mockMcp, {
      log: (level, msg, data) => logs.push({ level, msg, data }),
    });

    const result = await h.executeTool("nano-banana", "list_models", {});

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result.content[0].text, "ok-after-timeout-retry");
    assert.strictEqual(callCount, 2);
    const failures = logs.filter(
      (entry) => entry.msg === "MCP tool call failed",
    );
    assert.strictEqual(failures.length, 1);
    assert.strictEqual(failures[0].data.retryable, true);
    assert.match(failures[0].data.error, /timed out/i);
  } finally {
    if (prevDelay === undefined) delete process.env.MCP_TOOL_RETRY_DELAY_MS;
    else process.env.MCP_TOOL_RETRY_DELAY_MS = prevDelay;
  }
});

test("executeTool normalizes Google AI Studio image args to image model", async () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(5000);
  let receivedArgs = null;
  const mockMcp = {
    getAllTools: () => [],
    callTool: async (_serverId, _toolName, args) => {
      receivedArgs = args;
      return { content: [{ type: "text", text: "ok" }] };
    },
  };
  const h = new ToolCallHandler(mockMcp);

  const result = await h.executeTool("google-ai-studio", "generate_content", {
    user_prompt: "Draw a test icon",
    enable_image_generation: true,
    only_image: true,
    model: "gemini-2.5-flash",
  });

  assert.strictEqual(result.success, true);
  assert.ok(receivedArgs, "expected args passed to callTool");
  assert.strictEqual(receivedArgs.enable_image_generation, true);
  assert.strictEqual(receivedArgs.only_image, true);
  assert.strictEqual(receivedArgs.model, "gemini-2.5-flash-image");
});

test("executeTool keeps explicit modern AI Studio image model unchanged", async () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(5000);
  let receivedArgs = null;
  const mockMcp = {
    getAllTools: () => [],
    callTool: async (_serverId, _toolName, args) => {
      receivedArgs = args;
      return { content: [{ type: "text", text: "ok" }] };
    },
  };
  const h = new ToolCallHandler(mockMcp);

  const result = await h.executeTool("google-ai-studio", "generate_content", {
    user_prompt: "Draw a test icon",
    enable_image_generation: true,
    model: "gemini-2.5-flash-image",
  });

  assert.strictEqual(result.success, true);
  assert.ok(receivedArgs, "expected args passed to callTool");
  assert.strictEqual(receivedArgs.model, "gemini-2.5-flash-image");
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

test("buildToolsPrompt includes Google Workspace auth recovery guidance", () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(undefined);
  const h = new ToolCallHandler(
    {
      getAllTools: () => [
        {
          serverId: "google",
          serverName: "Google Workspace",
          name: "start_google_auth",
          description: "Start Google OAuth flow",
        },
        {
          serverId: "google",
          serverName: "Google Workspace",
          name: "get_doc_content",
          description: "Read Google Docs content",
        },
      ],
    },
    { getConfig: () => ({}) },
  );
  const p = h.buildToolsPrompt();
  assert.ok(
    p.includes("GOOGLE WORKSPACE AUTH:"),
    "expected Google Workspace auth guidance",
  );
  assert.ok(
    p.includes("google.start_google_auth"),
    "expected concrete auth tool reference",
  );
  assert.ok(
    p.includes("not an unsupported format"),
    "expected format-vs-auth clarification",
  );
});

test("buildToolsPrompt compacts large external MCP servers", () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(undefined);
  const longDescription =
    "This is a very long Google Workspace tool description that would otherwise bloat the tool prompt and slow down local model tool selection. ".repeat(
      4,
    );
  const googleTools = Array.from({ length: 45 }, (_, i) => ({
    serverId: "google",
    serverName: "Google",
    name: `google_tool_${i}`,
    description: longDescription,
    inputSchema: {
      required: ["user_google_email"],
      properties: {
        user_google_email: { type: "string" },
        optional_a: { type: "string" },
        optional_b: { type: "string" },
        optional_c: { type: "string" },
        optional_d: { type: "string" },
      },
    },
  }));
  const h = new ToolCallHandler(
    { getAllTools: () => googleTools },
    { getConfig: () => ({ agentTerminal: { enabled: false } }) },
  );

  const p = h.buildToolsPrompt();
  assert.ok(
    p.includes("Large MCP servers are listed in compact form"),
    "expected compact-server note",
  );
  assert.ok(
    p.includes("google.google_tool_0") &&
      p.includes("user_google_email (required)"),
    "expected callable tool names and required params",
  );
  assert.ok(
    !p.includes("optional_a: string"),
    "expected optional non-enum params omitted in compact form",
  );
  assert.ok(p.length < 14000, `prompt remained too large (${p.length})`);
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

test("executeTool MCP blocks disabled external tool before callTool", async () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(5000);
  let called = false;
  const mockMcp = {
    getAllTools: () => [],
    callTool: async () => {
      called = true;
      return { content: [] };
    },
  };
  const h = new ToolCallHandler(mockMcp, {
    getConfig: () => ({
      mcpClients: [
        { id: "google-workspace", disabledTools: ["send_gmail_message"] },
      ],
    }),
    log: () => {},
  });

  const result = await h.executeTool(
    "google-workspace",
    "send_gmail_message",
    {},
  );

  assert.strictEqual(result.success, false);
  assert.match(result.error, /google-workspace\.send_gmail_message.*disabled/i);
  assert.strictEqual(called, false, "disabled tool must not call MCP server");
});

test("executeTool MCP allows enabled external tool", async () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(5000);
  let called = false;
  const mockMcp = {
    getAllTools: () => [],
    callTool: async () => {
      called = true;
      return { content: [{ type: "text", text: "ok" }] };
    },
  };
  const h = new ToolCallHandler(mockMcp, {
    getConfig: () => ({
      mcpClients: [
        { id: "google-workspace", disabledTools: ["send_gmail_message"] },
      ],
    }),
    log: () => {},
  });

  const result = await h.executeTool(
    "google-workspace",
    "search_gmail_messages",
    {},
  );

  assert.strictEqual(result.success, true);
  assert.strictEqual(called, true);
});

test("executeTool MCP allows server with no disabledTools entry", async () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(5000);
  let called = false;
  const mockMcp = {
    getAllTools: () => [],
    callTool: async () => {
      called = true;
      return { content: [] };
    },
  };
  const h = new ToolCallHandler(mockMcp, {
    getConfig: () => ({
      mcpClients: [
        { id: "google-workspace", disabledTools: ["send_gmail_message"] },
      ],
    }),
    log: () => {},
  });

  const result = await h.executeTool("other-server", "any_tool", {});

  assert.strictEqual(result.success, true);
  assert.strictEqual(called, true);
});
