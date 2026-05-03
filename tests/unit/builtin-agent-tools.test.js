const { test } = require("node:test");
const assert = require("node:assert");
const {
  getWhitelistedEnv,
  getBuiltinSafetyPreamble,
  getBuiltinTools,
  validateBrowseUrl,
  validateCommand,
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

test("getBuiltinSafetyPreamble includes Create/Build workflow and milestone guidance", () => {
  const p = getBuiltinSafetyPreamble();
  assert.ok(
    p.includes("Guided **Create** and **Build** modes"),
    "expected Create/Build workflow hint",
  );
  assert.ok(
    p.includes("milestone-sized steps"),
    "expected milestone steering hint",
  );
});

test("getBuiltinSafetyPreamble routes project markdown creation to write_file", () => {
  const p = getBuiltinSafetyPreamble();
  assert.ok(
    p.includes("Do NOT use this tool for project/source Markdown files"),
  );
  assert.ok(
    p.includes(
      "Always use this tool when creating or editing project Markdown/source files",
    ),
  );
  assert.ok(
    p.includes("Do NOT create Markdown files through terminal redirection"),
  );
  assert.ok(p.includes("builtin.write_file"));
  assert.ok(p.includes("docs/notes.md"));
});

test("validateBrowseUrl rejects localhost with terminal + browser guidance", () => {
  const r = validateBrowseUrl("http://localhost:3000/");
  assert.equal(r.valid, false);
  assert.ok(
    r.reason.includes("run_terminal_cmd"),
    "reason should steer to terminal",
  );
  assert.ok(
    r.reason.includes("desktop browser"),
    "reason should steer to user browser",
  );
});

test("validateBrowseUrl rejects private LAN IP with distinct guidance", () => {
  const r = validateBrowseUrl("http://192.168.1.1/");
  assert.equal(r.valid, false);
  assert.ok(r.reason.includes("Private-network"));
});

test("getWhitelistedEnv extends packaged app PATH for developer tools", () => {
  withProcessEnv({ PATH: "/usr/bin:/bin" }, () => {
    const env = getWhitelistedEnv();
    assert.ok(env.PATH.includes("/usr/local/bin"));
    if (process.platform === "darwin") {
      assert.ok(env.PATH.includes("/opt/homebrew/bin"));
    }
  });
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

// ── validateCommand: blocklist token-boundary matching ───────────────────────
// Regression for false-positive substring matches (e.g. blocklist "su" wrongly
// blocking `python3 -c "import sys; print('successful')"` because "successful"
// contains the substring "su").

const baseTerminalConfig = {
  agentTerminal: {
    enabled: true,
    allowlist: ["python3", "ls", "cat", "echo"],
    blocklist: ["sudo", "su", "rm -rf", "dd"],
  },
  projectFolder: "/tmp",
};

test("validateCommand: blocklist 'su' does not match 'sys' or 'successful'", () => {
  const r = validateCommand(
    "python3",
    ["-c", "import sys; print('successful')"],
    baseTerminalConfig,
  );
  // The semicolon will trigger the metachar guard (intended) but NOT the "su"
  // blocklist — verify the deny reason is metachar, not blocklist.
  assert.equal(r.allowed, false);
  assert.match(r.reason, /metacharacters/i);
  assert.doesNotMatch(r.reason, /security policy: "su"/);
});

test("validateCommand: blocklist 'su' does not block 'usable' or 'pseudo'", () => {
  const r = validateCommand(
    "echo",
    ["pseudo-usable-output"],
    baseTerminalConfig,
  );
  assert.equal(r.allowed, true);
});

test("validateCommand: blocklist 'su' still blocks bare 'su -' invocation", () => {
  const cfg = {
    ...baseTerminalConfig,
    agentTerminal: {
      ...baseTerminalConfig.agentTerminal,
      allowlist: [...baseTerminalConfig.agentTerminal.allowlist, "su"],
    },
  };
  const r = validateCommand("su", ["-"], cfg);
  assert.equal(r.allowed, false);
  assert.match(r.reason, /security policy: "su"/);
});

test("validateCommand: blocklist 'sudo' blocks 'sudo apt' but not 'pseudo'", () => {
  const cfg = {
    ...baseTerminalConfig,
    agentTerminal: {
      ...baseTerminalConfig.agentTerminal,
      allowlist: [
        ...baseTerminalConfig.agentTerminal.allowlist,
        "sudo",
        "pseudo",
      ],
    },
  };
  const blocked = validateCommand("sudo", ["apt", "install", "x"], cfg);
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason, /security policy: "sudo"/);

  const ok = validateCommand("pseudo", ["arg"], cfg);
  assert.equal(ok.allowed, true);
});

test("validateCommand: multi-token blocklist 'rm -rf' matches 'rm -rf /tmp'", () => {
  const cfg = {
    ...baseTerminalConfig,
    agentTerminal: {
      ...baseTerminalConfig.agentTerminal,
      allowlist: [...baseTerminalConfig.agentTerminal.allowlist, "rm"],
    },
  };
  const r = validateCommand("rm", ["-rf", "/tmp"], cfg);
  assert.equal(r.allowed, false);
  assert.match(r.reason, /security policy: "rm -rf"/);
});

test("validateCommand: blocklist 'dd' does not match 'add' or 'mkdir'", () => {
  const cfg = {
    ...baseTerminalConfig,
    agentTerminal: {
      ...baseTerminalConfig.agentTerminal,
      allowlist: [...baseTerminalConfig.agentTerminal.allowlist, "echo"],
    },
  };
  // "add" and "mkdir" both contain "dd" as substring; word-boundary match must
  // not flag them.
  const r = validateCommand("echo", ["add", "mkdir"], cfg);
  assert.equal(r.allowed, true);
});

test("validateCommand: terminal tool safety preamble guides away from shell features", () => {
  const p = getBuiltinSafetyPreamble({ includeTerminal: true });
  assert.match(p, /SINGLE BINARY/);
  assert.match(p, /pass cwd as an argument/i);
  assert.match(p, /Do NOT loop on denied commands/);
  assert.match(p, /20-command-per-minute rate limit/);
  assert.match(p, /NEVER report "undefined error"/);
});

// ── METACHAR_PATTERN: && / || are now denied for consistency with ; / | ───
// Previously `cd path && cmd` slipped through the metacharacter check while
// `cmd1; cmd2` and `cmd | grep` were rejected — the inconsistency confused the
// model and produced partial executions.

test("validateCommand: && conditional chaining is denied", () => {
  const r = validateCommand(
    "cd",
    ["/Users/james/Projects/x", "&&", "ls", "-la"],
    {
      ...baseTerminalConfig,
      agentTerminal: {
        ...baseTerminalConfig.agentTerminal,
        allowlist: [...baseTerminalConfig.agentTerminal.allowlist, "cd"],
      },
    },
  );
  assert.equal(r.allowed, false);
  assert.match(r.reason, /metacharacters/i);
  assert.match(r.reason, /&&/);
});

test("validateCommand: || conditional chaining is denied", () => {
  const r = validateCommand(
    "echo",
    ["foo", "||", "echo", "bar"],
    baseTerminalConfig,
  );
  assert.equal(r.allowed, false);
  assert.match(r.reason, /metacharacters/i);
});

// ── Deny payloads include an actionable ACTION line for the model ─────────
// Without a clear next step, the model has been summarizing structured deny
// messages as "undefined errors" to the user.

test("validateCommand: allowlist deny includes ACTION instructing the model how to surface it", () => {
  const r = validateCommand("chmod", ["+x", "deploy.sh"], baseTerminalConfig);
  assert.equal(r.allowed, false);
  assert.ok(r.action, "deny should carry an action field");
  assert.match(r.action, /^ACTION:/);
  assert.match(r.action, /Add 'chmod' to Settings/);
  assert.match(r.action, /Do NOT retry/);
});

test("validateCommand: metacharacter deny ACTION explains there is no shell", () => {
  const r = validateCommand(
    "echo",
    ["a", "|", "grep", "b"],
    baseTerminalConfig,
  );
  assert.equal(r.allowed, false);
  assert.ok(r.action);
  assert.match(r.action, /^ACTION:/);
  assert.match(r.action, /no shell/i);
  assert.match(r.action, /spawn/);
});

test("validateCommand: blocklist deny ACTION explains it's a security policy", () => {
  const cfg = {
    ...baseTerminalConfig,
    agentTerminal: {
      ...baseTerminalConfig.agentTerminal,
      allowlist: [...baseTerminalConfig.agentTerminal.allowlist, "sudo"],
    },
  };
  const r = validateCommand("sudo", ["apt", "install", "x"], cfg);
  assert.equal(r.allowed, false);
  assert.ok(r.action);
  assert.match(r.action, /^ACTION:/);
  assert.match(r.action, /security policy/i);
});

test("validateCommand: allowed commands return no action field", () => {
  const r = validateCommand("ls", ["-la"], baseTerminalConfig);
  assert.equal(r.allowed, true);
  assert.equal(r.action, undefined);
});

test("getBuiltinSafetyPreamble includes app skills block when includeAppSkills", () => {
  const p = getBuiltinSafetyPreamble({ includeAppSkills: true });
  assert.ok(p.includes("APP SKILLS"));
  assert.ok(p.includes("builtin.review_run"));
});

test("getBuiltinTools gates app-skill builtins on agentAppSkills", () => {
  const names = (cfg) => getBuiltinTools(cfg).map((t) => t.name);
  const cfgOn = {
    projectFolder: "/tmp",
    agentAppSkills: {
      enabled: true,
      review: true,
      pentest: true,
      builderScore: true,
    },
  };
  assert.ok(!names({ projectFolder: "/tmp" }).includes("review_run"));
  assert.ok(
    !names({
      projectFolder: "/tmp",
      agentAppSkills: {
        enabled: true,
        review: false,
        pentest: false,
        builderScore: false,
      },
    }).includes("review_run"),
  );
  assert.ok(names(cfgOn).includes("review_run"));
  assert.ok(names(cfgOn).includes("pentest_scan"));
  assert.ok(names(cfgOn).includes("pentest_scan_folder"));
  assert.ok(names(cfgOn).includes("builder_score"));
});
