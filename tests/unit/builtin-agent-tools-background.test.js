const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const {
  executeBuiltinTool,
  getBuiltinTools,
  getBuiltinSafetyPreamble,
} = require("../../lib/builtin-agent-tools.js");

// Shared test config: enable terminal, allowlist sleep/echo/node, and use a real
// project folder so validateCwd passes.
function makeConfig() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-bg-test-"));
  return {
    projectFolder: tmpDir,
    chatFolder: tmpDir,
    agentTerminal: {
      enabled: true,
      allowlist: ["sleep", "echo", "node", "true", "false", "sh", "bash"],
      blocklist: [],
      maxTimeoutSec: 60,
      maxOutputKB: 256,
    },
  };
}

const NOOP_LOG = () => {};

test("background:true returns quickly with PID + 'Background process started' text", async () => {
  const config = makeConfig();
  const start = Date.now();
  const result = await executeBuiltinTool(
    "run_terminal_cmd",
    {
      command: "sleep",
      args: ["10"],
      background: true,
      startupWaitMs: 300,
    },
    config,
    NOOP_LOG,
    "test-client-1",
    {},
  );
  const elapsed = Date.now() - start;

  assert.ok(result.success, `expected success: ${JSON.stringify(result)}`);
  const text = result.result.content[0].text;
  assert.match(text, /Background process started/);
  assert.match(text, /PID: \d+/);
  assert.match(text, /kill_process/);
  assert.match(text, /tail_process_output/);
  assert.ok(
    elapsed < 1500,
    `expected to return well under 1.5s, got ${elapsed}ms`,
  );

  // Cleanup: kill the spawned sleep
  const pid = Number(text.match(/PID: (\d+)/)[1]);
  await executeBuiltinTool(
    "kill_process",
    { pid },
    config,
    NOOP_LOG,
    "test-client-1",
    {},
  );
});

test("kill_process refuses PID not in registry (safety: cannot kill arbitrary system PIDs)", async () => {
  const config = makeConfig();
  // Pick a PID extremely unlikely to be tracked: 999999.
  const result = await executeBuiltinTool(
    "kill_process",
    { pid: 999999 },
    config,
    NOOP_LOG,
    "test-client-2",
    {},
  );
  assert.ok(!result.success);
  const text = result.result.content[0].text;
  assert.match(text, /No background process tracked/);
  assert.match(text, /Only processes spawned by run_terminal_cmd/);
});

test("kill_process refuses non-positive-integer PID", async () => {
  const config = makeConfig();
  for (const badPid of [0, -1, 1.5, "abc", null, undefined]) {
    const result = await executeBuiltinTool(
      "kill_process",
      { pid: badPid },
      config,
      NOOP_LOG,
      "test-client-3",
      {},
    );
    assert.ok(!result.success, `expected failure for pid=${String(badPid)}`);
    assert.match(
      result.result.content[0].text,
      /pid must be a positive integer/,
    );
  }
});

test("kill_process kills tracked background PID and is reflected in tail", async () => {
  const config = makeConfig();
  const startResult = await executeBuiltinTool(
    "run_terminal_cmd",
    {
      command: "sleep",
      args: ["30"],
      background: true,
      startupWaitMs: 300,
    },
    config,
    NOOP_LOG,
    "test-client-4",
    {},
  );
  assert.ok(startResult.success);
  const pid = Number(startResult.result.content[0].text.match(/PID: (\d+)/)[1]);

  const killResult = await executeBuiltinTool(
    "kill_process",
    { pid },
    config,
    NOOP_LOG,
    "test-client-4",
    {},
  );
  assert.ok(killResult.success, "kill should succeed");
  assert.match(killResult.result.content[0].text, /SIGTERM sent to PID/);

  // Wait for SIGTERM to take effect
  await new Promise((r) => setTimeout(r, 500));

  const tailResult = await executeBuiltinTool(
    "tail_process_output",
    { pid },
    config,
    NOOP_LOG,
    "test-client-4",
    {},
  );
  assert.ok(tailResult.success);
  assert.match(tailResult.result.content[0].text, /exited.*killed/);
});

test("tail_process_output refuses unknown PID", async () => {
  const config = makeConfig();
  const result = await executeBuiltinTool(
    "tail_process_output",
    { pid: 999998 },
    config,
    NOOP_LOG,
    "test-client-5",
    {},
  );
  assert.ok(!result.success);
  assert.match(
    result.result.content[0].text,
    /No background process tracked with PID/,
  );
});

test("tail_process_output reports 'running' status and captured output for live PID", async () => {
  const config = makeConfig();
  // Use node -e with a comma-operator expression (no `;` so the metachar guard
  // doesn't reject the args). This prints hello-world and stays alive 10s.
  const startResult = await executeBuiltinTool(
    "run_terminal_cmd",
    {
      command: "node",
      args: ["-e", "console.log('hello-world'),setTimeout(()=>{},10000)"],
      background: true,
      startupWaitMs: 500,
    },
    config,
    NOOP_LOG,
    "test-client-6",
    {},
  );
  assert.ok(
    startResult.success,
    `expected success, got: ${startResult.result.content[0].text}`,
  );
  const pid = Number(startResult.result.content[0].text.match(/PID: (\d+)/)[1]);

  const tailResult = await executeBuiltinTool(
    "tail_process_output",
    { pid, lines: 10 },
    config,
    NOOP_LOG,
    "test-client-6",
    {},
  );
  assert.ok(tailResult.success);
  const text = tailResult.result.content[0].text;
  assert.match(text, new RegExp(`PID: ${pid}`));
  assert.match(text, /Status: running/);
  assert.match(text, /hello-world/);

  // Cleanup
  await executeBuiltinTool(
    "kill_process",
    { pid },
    config,
    NOOP_LOG,
    "test-client-6",
    {},
  );
});

test("background process that exits BEFORE startupWaitMs returns 'exited before reaching startup wait window'", async () => {
  const config = makeConfig();
  // 'true' exits immediately with code 0 — well before our 2s wait window.
  const result = await executeBuiltinTool(
    "run_terminal_cmd",
    {
      command: "true",
      args: [],
      background: true,
      startupWaitMs: 2000,
    },
    config,
    NOOP_LOG,
    "test-client-7",
    {},
  );

  assert.match(
    result.result.content[0].text,
    /exited before reaching startup wait window/,
  );
  assert.match(result.result.content[0].text, /Exit code: 0/);
});

test("background mode still enforces command allowlist", async () => {
  const config = makeConfig();
  config.agentTerminal.allowlist = ["echo"]; // sleep NOT allowed
  const result = await executeBuiltinTool(
    "run_terminal_cmd",
    {
      command: "sleep",
      args: ["5"],
      background: true,
    },
    config,
    NOOP_LOG,
    "test-client-8",
    {},
  );
  assert.ok(!result.success);
  assert.match(result.result.content[0].text, /Command denied/);
});

test("getBuiltinTools includes kill_process and tail_process_output when terminal enabled", () => {
  const config = makeConfig();
  const tools = getBuiltinTools(config);
  const names = tools.map((t) => t.name);
  assert.ok(names.includes("run_terminal_cmd"));
  assert.ok(names.includes("kill_process"));
  assert.ok(names.includes("tail_process_output"));
});

test("safety preamble (terminal block) mentions background:true requirement for long-running processes", () => {
  const preamble = getBuiltinSafetyPreamble({ includeTerminal: true });
  assert.match(preamble, /LONG-RUNNING PROCESSES/);
  assert.match(preamble, /background:true/);
  assert.match(preamble, /tail_process_output/);
  assert.match(preamble, /kill_process/);
});
