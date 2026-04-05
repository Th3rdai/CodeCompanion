const { test } = require("node:test");
const assert = require("node:assert");
const {
  getBuiltinSafetyPreamble,
  getBuiltinTools,
} = require("../../lib/builtin-agent-tools.js");

/**
 * @param {Record<string, string | undefined>} env - keys to set; undefined deletes
 * @param {() => void} fn
 */
function withProcessEnv(env, fn) {
  const prev = {};
  for (const key of Object.keys(env)) {
    prev[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(env)) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  }
}

test("getBuiltinSafetyPreamble omits terminal block when includeTerminal is false", () => {
  const p = getBuiltinSafetyPreamble({ includeTerminal: false });
  assert.ok(p.includes("BUILTIN TOOL INSTRUCTIONS"), "expected core preamble");
  assert.ok(
    !p.includes("TERMINAL TOOL SAFETY"),
    "must not include terminal section",
  );
});

test("getBuiltinSafetyPreamble omits terminal block when options omitted (default)", () => {
  const p = getBuiltinSafetyPreamble();
  assert.ok(!p.includes("TERMINAL TOOL SAFETY"));
});

test("getBuiltinSafetyPreamble includes terminal block when includeTerminal is true", () => {
  const p = getBuiltinSafetyPreamble({ includeTerminal: true });
  assert.ok(p.includes("TERMINAL TOOL SAFETY (builtin.run_terminal_cmd)"));
  assert.ok(p.includes("Prefer read-only commands first"));
});

test("getBuiltinTools includes run_terminal_cmd when terminal enabled and bind is loopback", () => {
  withProcessEnv({ HOST: "127.0.0.1", CC_BIND_ALL: undefined }, () => {
    const tools = getBuiltinTools({ agentTerminal: { enabled: true } });
    const names = tools.map((t) => t.name);
    assert.ok(names.includes("run_terminal_cmd"));
  });
});

test("getBuiltinTools omits run_terminal_cmd when bind is 0.0.0.0 without CC_ALLOW_AGENT_TERMINAL (non-Electron)", () => {
  withProcessEnv(
    {
      HOST: "0.0.0.0",
      CC_ALLOW_AGENT_TERMINAL: undefined,
      ELECTRON_RUN_AS_NODE: undefined,
    },
    () => {
      const tools = getBuiltinTools({ agentTerminal: { enabled: true } });
      const names = tools.map((t) => t.name);
      assert.ok(!names.includes("run_terminal_cmd"));
      assert.ok(names.includes("write_file"));
    },
  );
});

test("getBuiltinTools includes run_terminal_cmd when exposed bind but CC_ALLOW_AGENT_TERMINAL=1", () => {
  withProcessEnv(
    {
      HOST: "0.0.0.0",
      CC_ALLOW_AGENT_TERMINAL: "1",
    },
    () => {
      const tools = getBuiltinTools({ agentTerminal: { enabled: true } });
      assert.ok(tools.some((t) => t.name === "run_terminal_cmd"));
    },
  );
});

// ── Planner tool tests ────────────────────────────

test("getBuiltinTools includes score_plan by default (agentPlanner not set)", () => {
  const tools = getBuiltinTools({});
  assert.ok(
    tools.some((t) => t.name === "score_plan"),
    "score_plan present by default",
  );
});

test("getBuiltinTools includes score_plan when agentPlanner.enabled is true", () => {
  const tools = getBuiltinTools({ agentPlanner: { enabled: true } });
  assert.ok(tools.some((t) => t.name === "score_plan"));
});

test("getBuiltinTools omits score_plan when agentPlanner.enabled is false", () => {
  const tools = getBuiltinTools({ agentPlanner: { enabled: false } });
  assert.ok(!tools.some((t) => t.name === "score_plan"), "score_plan absent");
  // Non-planner tools still present
  assert.ok(tools.some((t) => t.name === "write_file"));
});

test("getBuiltinTools score_plan has serverId=builtin", () => {
  const tool = getBuiltinTools({}).find((t) => t.name === "score_plan");
  assert.strictEqual(tool.serverId, "builtin");
});

test("getBuiltinSafetyPreamble omits planner block by default", () => {
  const p = getBuiltinSafetyPreamble();
  assert.ok(!p.includes("PLANNER TOOL"));
});

test("getBuiltinSafetyPreamble includes planner block when includePlanner is true", () => {
  const p = getBuiltinSafetyPreamble({ includePlanner: true });
  assert.ok(p.includes("PLANNER TOOL"));
  assert.ok(p.includes("score_plan"));
  assert.ok(p.includes("Clarity, Feasibility, Completeness, and Structure"));
});

test("getBuiltinSafetyPreamble includePlanner false suppresses planner block", () => {
  const p = getBuiltinSafetyPreamble({ includePlanner: false });
  assert.ok(!p.includes("PLANNER TOOL"));
});

test("getBuiltinSafetyPreamble can include terminal + planner + validate together", () => {
  const p = getBuiltinSafetyPreamble({
    includeTerminal: true,
    includePlanner: true,
    includeValidate: true,
  });
  assert.ok(p.includes("TERMINAL TOOL SAFETY"));
  assert.ok(p.includes("PLANNER TOOL"));
  assert.ok(p.includes("VALIDATE TOOLS"));
});

// ── Validate tool tests ───────────────────────────

test("getBuiltinTools includes validate tools by default (agentValidate not set)", () => {
  const tools = getBuiltinTools({});
  const names = tools.map((t) => t.name);
  assert.ok(names.includes("validate_scan_project"), "scan tool present");
  assert.ok(
    names.includes("validate_generate_command"),
    "generate tool present",
  );
});

test("getBuiltinTools includes validate tools when agentValidate.enabled is true", () => {
  const tools = getBuiltinTools({ agentValidate: { enabled: true } });
  const names = tools.map((t) => t.name);
  assert.ok(names.includes("validate_scan_project"));
  assert.ok(names.includes("validate_generate_command"));
});

test("getBuiltinTools omits validate tools when agentValidate.enabled is false", () => {
  const tools = getBuiltinTools({ agentValidate: { enabled: false } });
  const names = tools.map((t) => t.name);
  assert.ok(!names.includes("validate_scan_project"), "scan tool absent");
  assert.ok(
    !names.includes("validate_generate_command"),
    "generate tool absent",
  );
  // Non-validate tools still present
  assert.ok(names.includes("write_file"));
  assert.ok(names.includes("generate_office_file"));
});

test("getBuiltinTools validate tools have serverId=builtin", () => {
  const tools = getBuiltinTools({});
  const scan = tools.find((t) => t.name === "validate_scan_project");
  const gen = tools.find((t) => t.name === "validate_generate_command");
  assert.strictEqual(scan.serverId, "builtin");
  assert.strictEqual(gen.serverId, "builtin");
});

test("getBuiltinSafetyPreamble omits validate block by default", () => {
  const p = getBuiltinSafetyPreamble();
  assert.ok(!p.includes("VALIDATE TOOLS"));
});

test("getBuiltinSafetyPreamble includes validate block when includeValidate is true", () => {
  const p = getBuiltinSafetyPreamble({ includeValidate: true });
  assert.ok(p.includes("VALIDATE TOOLS"));
  assert.ok(p.includes("validate_scan_project"));
  assert.ok(p.includes("validate_generate_command"));
});

test("getBuiltinSafetyPreamble can include both terminal and validate blocks", () => {
  const p = getBuiltinSafetyPreamble({
    includeTerminal: true,
    includeValidate: true,
  });
  assert.ok(p.includes("TERMINAL TOOL SAFETY"));
  assert.ok(p.includes("VALIDATE TOOLS"));
});

test("getBuiltinSafetyPreamble includeValidate false suppresses validate block", () => {
  const p = getBuiltinSafetyPreamble({ includeValidate: false });
  assert.ok(!p.includes("VALIDATE TOOLS"));
});
