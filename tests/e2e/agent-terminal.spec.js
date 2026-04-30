/**
 * tests/e2e/agent-terminal.spec.js
 *
 * E2E coverage for the agent terminal builtin (`run_terminal_cmd`) per
 * CLIPLAN.md §8 review checklist. Three scenarios:
 *
 *   1. Enable/disable — terminal disabled → tool not advertised in prompt
 *      (LLM never sees it, can't call it).
 *   2. Allowlist deny — command not in allowlist → executor returns
 *      "Command denied" + writes a "denied" event to terminal-audit.log,
 *      no spawn.
 *   3. Happy path — `node -e "console.log('ok')"` is in allowlist → executor
 *      runs it, output reaches the caller, "executed" event with exitCode=0
 *      lands in terminal-audit.log.
 *
 * These tests run inside Playwright's Node runner but DO NOT need a browser,
 * webServer, or live LLM — they call the executor directly via require(),
 * which is the same code path the chat tool-use loop hits in production.
 * That keeps the tests fast and deterministic, while still living next to
 * the other E2E specs so `npm run test:e2e` exercises them.
 */

const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");

let auditModule;
let toolsModule;

function freshDataRoot(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `cc-e2e-term-${label}-`));
  process.env.CC_DATA_DIR = dir;
  // Reset audit stream so the next event opens against the new dir
  if (auditModule && auditModule._resetForTests) auditModule._resetForTests();
  return dir;
}

function readAudit(dir) {
  const file = path.join(dir, "logs", "terminal-audit.log");
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
}

/** Writable stream buffers on CI — poll until audit lines appear or timeout. */
async function waitForAuditLines(dataRoot, minCount, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const events = readAudit(dataRoot);
    if (events.length >= minCount) return events;
    await new Promise((r) => setTimeout(r, 50));
  }
  return readAudit(dataRoot);
}

function silentLog() {
  return () => {};
}

test.beforeAll(() => {
  auditModule = require("../../lib/terminal-audit");
  toolsModule = require("../../lib/builtin-agent-tools");
});

test.afterEach(() => {
  delete process.env.CC_DATA_DIR;
  if (auditModule && auditModule._resetForTests) auditModule._resetForTests();
});

test("scenario 1 — terminal disabled: run_terminal_cmd is not advertised", () => {
  const tools = toolsModule.getBuiltinTools({
    agentTerminal: { enabled: false },
  });
  const names = tools.map((t) => t.name);
  expect(names).not.toContain("run_terminal_cmd");

  // Sanity: enabling it (with a loopback bind) should advertise it
  const enabled = toolsModule.getBuiltinTools({
    agentTerminal: { enabled: true },
  });
  expect(enabled.map((t) => t.name)).toContain("run_terminal_cmd");
});

test("scenario 2 — allowlist deny: executor refuses + writes denied audit event", async () => {
  const dataRoot = freshDataRoot("deny");
  const config = {
    projectFolder: dataRoot,
    agentTerminal: {
      enabled: true,
      allowlist: ["node"], // explicitly does not include "rm"
      blocklist: [],
      maxTimeoutSec: 10,
      maxOutputKB: 64,
    },
  };

  const result = await toolsModule.executeBuiltinTool(
    "run_terminal_cmd",
    { command: "rm", args: ["-rf", "/"] },
    config,
    silentLog(),
  );

  expect(result.success).toBe(false);
  const text = result.result.content[0].text;
  expect(text).toContain("denied");
  expect(text).toContain("not in the allowlist");

  const events = await waitForAuditLines(dataRoot, 1);
  expect(events.length).toBeGreaterThanOrEqual(1);
  expect(events[0].event).toBe("denied");
  expect(events[0].denyType).toBe("allowlist");
  expect(events[0].command).toBe("rm");
  expect(events[0].reason).toMatch(/not in the allowlist/);
});

test("scenario 3 — happy path: allowlisted command runs and executed event is logged", async () => {
  // `node --version` matches CLIPLAN §8's "happy path" intent — an allowlisted command that
  // runs cleanly, prints to stdout, and exits 0.
  const dataRoot = freshDataRoot("happy");
  const config = {
    projectFolder: dataRoot,
    agentTerminal: {
      enabled: true,
      allowlist: ["node"],
      blocklist: [],
      maxTimeoutSec: 30,
      maxOutputKB: 64,
    },
  };

  const result = await toolsModule.executeBuiltinTool(
    "run_terminal_cmd",
    { command: "node", args: ["--version"] },
    config,
    silentLog(),
  );

  const text = result.result.content[0].text;
  if (!result.success) {
    throw new Error(`happy-path failed: ${text}`);
  }
  expect(text).toContain("Exit code: 0");
  expect(text).toMatch(/v\d+\.\d+\.\d+/);

  const events = await waitForAuditLines(dataRoot, 1);
  expect(events.length).toBeGreaterThanOrEqual(1);
  expect(events[0].event).toBe("executed");
  expect(events[0].command).toBe("node");
  expect(events[0].exitCode).toBe(0);
  expect(typeof events[0].durationMs).toBe("number");
  expect(events[0].truncated).toBe(false);
});

test("scenario 4 — confirm-before-run blocks execution when callback is missing", async () => {
  const dataRoot = freshDataRoot("confirm-missing");
  const config = {
    projectFolder: dataRoot,
    agentTerminal: {
      enabled: true,
      allowlist: ["node"],
      blocklist: [],
      maxTimeoutSec: 30,
      maxOutputKB: 64,
      confirmBeforeRun: true,
    },
  };

  const result = await toolsModule.executeBuiltinTool(
    "run_terminal_cmd",
    { command: "node", args: ["--version"] },
    config,
    silentLog(),
    // No context passed: confirmCallback is unavailable
  );

  expect(result.success).toBe(false);
  const text = result.result.content[0].text;
  expect(text).toContain("confirmation is required but unavailable");

  const events = await waitForAuditLines(dataRoot, 1);
  expect(events.length).toBeGreaterThanOrEqual(1);
  expect(events[0].event).toBe("denied");
  expect(events[0].denyType).toBe("confirm-unavailable");
  expect(events[0].command).toBe("node");
});

test("scenario 5 — confirm-before-run blocks execution when callback throws", async () => {
  const dataRoot = freshDataRoot("confirm-error");
  const config = {
    projectFolder: dataRoot,
    agentTerminal: {
      enabled: true,
      allowlist: ["node"],
      blocklist: [],
      maxTimeoutSec: 30,
      maxOutputKB: 64,
      confirmBeforeRun: true,
    },
  };

  const result = await toolsModule.executeBuiltinTool(
    "run_terminal_cmd",
    { command: "node", args: ["--version"] },
    config,
    silentLog(),
    null,
    {
      confirmCallback: async () => {
        throw new Error("confirm service unavailable");
      },
    },
  );

  expect(result.success).toBe(false);
  const text = result.result.content[0].text;
  expect(text).toContain("confirmation check failed");

  const events = await waitForAuditLines(dataRoot, 1);
  expect(events.length).toBeGreaterThanOrEqual(1);
  expect(events[0].event).toBe("denied");
  expect(events[0].denyType).toBe("confirm-error");
  expect(events[0].command).toBe("node");
});
