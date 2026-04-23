# Agent Terminal UI Enhancements — Implementation Plan

## Overview

Four enhancements to surface, validate, and expose the agent terminal capability:

| # | Feature | Scope |
|---|---------|-------|
| 1 | Settings "Test Terminal" button | Backend + Frontend |
| 2 | Toolbar status indicator (dot badge on Agentic tab) | Frontend only |
| 3 | MCP tool: `codecompanion_run_terminal_cmd` | Backend only |
| 4 | Global "terminal active" chip in toolbar | Frontend only |

> Features 2 and 4 share the same `agentTerminalEnabled` state, so they are implemented together.

---

## Feature 1 — Settings "Test Terminal" Button

### 1A. New backend endpoint

**File:** `server.js`  
**Location:** After the `GET /api/docling/health` endpoint (around line 350), before `app.get("*", ...)`.

```js
// GET /api/agent-terminal/test — validates agent terminal configuration and spawns pwd
app.get("/api/agent-terminal/test", requireLocalOrApiKey, (req, res) => {
  const { spawn } = require("child_process");
  const config = getConfig();
  const terminal = config.agentTerminal || {};

  if (!terminal.enabled) {
    return res.json({ ok: false, error: "Agent terminal is disabled. Enable it in Settings → General." });
  }
  if (!config.projectFolder) {
    return res.json({ ok: false, error: "No project folder configured. Set one in Settings → General." });
  }
  if (!terminal.allowlist || terminal.allowlist.length === 0) {
    return res.json({ ok: false, error: "Allowlist is empty — add commands in Settings → Agent Terminal." });
  }

  const startTime = Date.now();
  const proc = spawn("pwd", [], { cwd: config.projectFolder, shell: false });
  let output = "";
  proc.stdout.on("data", (d) => { output += d.toString(); });
  proc.stderr.on("data", (d) => { output += d.toString(); });

  // 5s hard timeout — guards against network-mounted folders or stalled fs
  const timer = setTimeout(() => {
    proc.kill();
    if (!res.headersSent) res.json({ ok: false, error: "Test timed out after 5s. Check your project folder path." });
  }, 5000);

  // Guard against both 'error' and 'close' firing for the same process
  proc.on("error", (err) => {
    clearTimeout(timer);
    if (!res.headersSent) res.json({ ok: false, error: `Spawn failed: ${err.message}` });
  });
  proc.on("close", (code) => {
    clearTimeout(timer);
    if (res.headersSent) return;
    if (code !== 0) {
      return res.json({ ok: false, error: `pwd exited with code ${code}: ${output.trim()}` });
    }
    res.json({ ok: true, cwd: output.trim(), durationMs: Date.now() - startTime });
  });
});
```

**Notes:**
- Handler is not `async` — no `await` inside, and the response is sent from spawn callbacks. Using async would give a false impression that the function awaits something.
- `res.headersSent` guard prevents the double-response race: Node.js can emit both `error` then `close` on a failed spawn; the guard ensures only the first one sends the response.
- Uses `requireLocalOrApiKey` — already in scope in server.js (line 69).
- `getConfig` is in scope in server.js (line 14). No new top-level imports needed.
- `spawn` from `child_process` is NOT already imported in server.js; use inline `require("child_process")` inside the handler to keep it self-contained, or add `const { spawn } = require("child_process");` to the top of server.js alongside existing requires. Inline is preferred to minimize surface area of the change.

### 1B. Frontend: new state in SettingsPanel

**File:** `src/components/SettingsPanel.jsx`  
**Location:** Around line 112 (existing state declarations block).

Add two new state variables:
```jsx
const [terminalTesting, setTerminalTesting] = useState(false);
const [terminalTestResult, setTerminalTestResult] = useState(null);
```

### 1C. Frontend: handler function in SettingsPanel

**File:** `src/components/SettingsPanel.jsx`  
**Location:** After `handleTestDocling` function (around line 641).

```js
async function handleTestTerminal() {
  setTerminalTesting(true);
  setTerminalTestResult(null);
  try {
    const res = await apiFetch("/api/agent-terminal/test");
    const data = await res.json();
    setTerminalTestResult(data);
  } catch (err) {
    setTerminalTestResult({ ok: false, error: err.message });
  } finally {
    setTerminalTesting(false);
  }
}
```

### 1D. Frontend: Test button and result UI in SettingsPanel

**File:** `src/components/SettingsPanel.jsx`  
**Location:** Inside the Agent Terminal section, after the description paragraph at line 980 (the `<p>` that reads "Allow the AI agent to run terminal commands…").

Insert immediately **before** the `{terminalEnabled && (` block:

```jsx
<div className="flex items-center gap-2 mt-2 mb-3">
  <button
    onClick={handleTestTerminal}
    disabled={terminalTesting || !terminalEnabled}
    title={!terminalEnabled ? "Enable Agent Terminal above to test" : undefined}
    className="px-3 py-1.5 rounded-lg text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-200"
  >
    {terminalTesting ? (
      <span className="inline-block spin mr-1">&#x27F3;</span>
    ) : null}
    {terminalTesting ? "Testing…" : "Test Terminal"}
  </button>
</div>
{terminalTestResult && (
  <div
    className={`text-xs rounded-lg px-3 py-2 mb-3 ${
      terminalTestResult.ok
        ? "bg-emerald-900/40 text-emerald-300"
        : "bg-red-900/40 text-red-300"
    }`}
  >
    {terminalTestResult.ok
      ? `✓ Working — project folder: ${terminalTestResult.cwd}`
      : `✗ ${terminalTestResult.error}`}
  </div>
)}
```

**Pattern match:** Mirrors the Ollama test button (lines 775–796) and Docling test button (lines 897–908): same state pattern, same button styling, same result display idiom.

**Reset on close:** `terminalTestResult` resets naturally since SettingsPanel unmounts when closed (conditionally rendered in App.jsx).

**Reset on toggle:** In the existing Agent Terminal toggle `onClick` (line 959), add `setTerminalTestResult(null)` so a stale test result clears when the user toggles the switch:
```jsx
onClick={() => {
  const next = !terminalEnabled;
  setTerminalEnabled(next);
  setTerminalTestResult(null); // ← add this line
  apiFetch("/api/config", { ... });
}}
```

---

## Features 2 & 4 — Toolbar Status Indicator + Global Chip

Both features need `agentTerminalEnabled` boolean state in `App.jsx`. They are implemented together.

### 2A. Add `agentTerminalEnabled` state to App.jsx

**File:** `src/App.jsx`  
**Location:** Near line 315, alongside other boolean state declarations.

```jsx
const [agentTerminalEnabled, setAgentTerminalEnabled] = useState(false);
```

### 2B. Fetch config on mount to seed the state

**File:** `src/App.jsx`  
**Location:** In the startup `useEffect` (look for the effect that calls `refreshModels` or fetches initial state on mount). If no such effect exists that is appropriate, add a dedicated one.

```jsx
useEffect(() => {
  apiFetch("/api/config")
    .then((r) => r.json())
    .then((d) => setAgentTerminalEnabled(!!d.agentTerminal?.enabled))
    .catch(() => {});
}, []);
```

### 2C. Refresh state when Settings panel closes

**File:** `src/App.jsx`  
**Location:** Line 1806, the `onClose` prop passed to `<SettingsPanel>`.

Change:
```jsx
onClose={() => setShowSettings(false)}
```
To:
```jsx
onClose={() => {
  setShowSettings(false);
  apiFetch("/api/config")
    .then((r) => r.json())
    .then((d) => setAgentTerminalEnabled(!!d.agentTerminal?.enabled))
    .catch(() => {});
}}
```

**Why on close, not on save:** SettingsPanel saves agent terminal config in its own inline `apiFetch` calls (e.g., the toggle at line 959), not through the `onSave` callback passed from App.jsx. Syncing on close catches all intermediate saves.

### 2D. Green dot badge on Agentic mode tab (Feature 2)

**File:** `src/App.jsx`  
**Location:** Lines 1236–1237 — the current tab button inner content is:
```jsx
<span aria-hidden="true">{m.icon}</span>
<span>{m.label}</span>
```

Replace with:
```jsx
<span aria-hidden="true">{m.icon}</span>
<span className="relative">
  {m.label}
  {m.id === "agentic" && agentTerminalEnabled && (
    <span
      className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-green-400"
      title="Agent terminal is active"
    />
  )}
</span>
```

**Visual result:** An 8px green dot appears at the top-right corner of the "Agentic" label text when terminal is enabled. The `relative`/`absolute` pair keeps the dot from affecting tab width or shifting neighbouring tabs.

### 2E. Global "terminal active" chip in header (Feature 4)

**File:** `src/App.jsx`  
**Location:** Line 1054 — after `<ConnectionDot connected={connected} />` and before the `{activeMemories?.count > 0 && (` conditional block.

Insert:
```jsx
{agentTerminalEnabled && (
  <span
    className="hidden sm:flex items-center gap-1 text-xs text-green-400 bg-green-900/20 border border-green-800/40 rounded-full px-2 py-0.5"
    title="Agent terminal is enabled — the AI can run commands in your project folder"
  >
    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
    Terminal
  </span>
)}
```

**Behavior:** Visible in the header regardless of which mode is active. Hidden on small screens (`hidden sm:flex`) to avoid crowding. Sits naturally alongside ConnectionDot and Memory since they are all status/context indicators. No interaction required — hover tooltip explains what it means.

---

## Feature 3 — MCP Tool: `codecompanion_run_terminal_cmd`

### 3A. Add schema to mcp/schemas.js

**File:** `mcp/schemas.js`  
**Location:** After `listConversationsSchema` (line 41), before `module.exports`.

```js
const runTerminalCmdSchema = {
  command: z
    .string()
    .describe("The command to execute (e.g. 'npm', 'git', 'ls'). Must be in the agent terminal allowlist."),
  args: z
    .array(z.string())
    .default([])
    .describe("Arguments to pass to the command (e.g. ['test'] for 'npm test')."),
  cwd: z
    .string()
    .optional()
    .describe("Optional subdirectory within the project folder to run the command in."),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .default(30000)
    .describe("Command timeout in milliseconds. Capped by Settings → Agent Terminal → Command Timeout."),
};
```

Add `runTerminalCmdSchema` to `module.exports`.

### 3B. Import in mcp/tools.js

**File:** `mcp/tools.js`  
**Location:** Line 1 (top of file, alongside existing requires).

```js
const { executeBuiltinTool } = require("../lib/builtin-agent-tools");
```

Add `runTerminalCmdSchema` to the destructured import from `./schemas`:
```js
const {
  modeToolSchema,
  browseFilesSchema,
  readFileSchema,
  listModelsSchema,
  getStatusSchema,
  listConversationsSchema,
  runTerminalCmdSchema,           // ← add
} = require("./schemas");
```

### 3C. Register the tool in registerAllTools

**File:** `mcp/tools.js`  
**Location:** Between lines 383 and 384 — after the last `);` that closes `codecompanion_list_conversations`, but before the `}` on line 384 that closes `registerAllTools`. (The plan originally cited line 320, which is wrong — that lands inside `codecompanion_read_file`.)

```js
register(
  "codecompanion_run_terminal_cmd",
  "Run a shell command in the configured project folder. Commands must appear in the agent terminal allowlist (Settings → General → Agent Terminal). Agent Terminal must be enabled. Returns stdout/stderr and exit code.",
  runTerminalCmdSchema,
  async ({ command, args = [], cwd, timeoutMs = 30000 }) => {
    try {
      const config = getConfig();
      if (!config.agentTerminal?.enabled) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Agent Terminal is disabled. Enable it in Settings → General → Agent Terminal.",
            },
          ],
        };
      }

      // No-op context: MCP is request/response, no streaming needed.
      // onData is ignored because runTerminalCmd still collects output
      // internally and returns it in the resolved promise.
      const collectingCtx = {
        onStart: () => {},
        onData: () => {},
        onStatus: () => {},
      };

      const result = await executeBuiltinTool(
        "run_terminal_cmd",
        { command, args, cwd, timeoutMs },
        config,
        _log, // use deps logger so rate-limit warnings surface in app.log
        "mcp",
        collectingCtx,
      );

      if (result?.result?.content) {
        return {
          isError: !result.success,
          content: result.result.content,
        };
      }

      return {
        isError: true,
        content: [{ type: "text", text: "Unexpected result from terminal tool." }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${err.message}` }],
      };
    }
  },
);
```

**Key design decisions:**
- `clientKey: "mcp"` routes through the same `checkCmdRateLimit` bucket as all MCP terminal calls (20 commands/60s — appropriate for MCP usage).
- No `confirmCallback` in context → if user has `confirmBeforeRun: true`, the call returns "Command execution blocked: confirmation is required but unavailable." This is intentional safe behavior.
- All allowlist, blocklist, CWD, and network-exposure security checks fire exactly as they do for agentic chat calls — same code path.
- Audit logging inside `runTerminalCmd` still fires, so MCP commands appear in terminal audit logs.

---

## Implementation Order

Execute in this order to avoid breaking the running app:

1. **`server.js`** — add test endpoint (backend, no frontend dep)
2. **`mcp/schemas.js`** — add `runTerminalCmdSchema` (no runtime effect until imported)
3. **`mcp/tools.js`** — import `executeBuiltinTool` + `runTerminalCmdSchema`, add tool registration
4. **`src/components/SettingsPanel.jsx`** — add state, handler, and UI for test button
5. **`src/App.jsx`** — add `agentTerminalEnabled` state, fetch on mount, onClose refresh, dot badge, toolbar chip

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `spawn` in test endpoint blocks event loop | Unlikely for `pwd` (completes in <5ms). Add 5s timeout to be safe |
| `executeBuiltinTool` called from MCP bypasses network exposure guard | It does NOT — the guard fires inside `executeBuiltinTool` before routing to `runTerminalCmd` |
| `agentTerminalEnabled` state out-of-sync if toggle changed without closing Settings | Acceptable — chip/badge updates on next Settings close |
| MCP tool name collision with existing tools | `codecompanion_run_terminal_cmd` is unique; no existing tool has this name |
| `pwd` not in user's allowlist blocks nothing | Test endpoint bypasses allowlist for `pwd` intentionally; it tests infrastructure, not the allowlist |

---

## Verification Checklist

- [ ] `GET /api/agent-terminal/test` returns `{ok: true, cwd: "..."}` when terminal is enabled with non-empty allowlist and valid project folder
- [ ] `GET /api/agent-terminal/test` returns `{ok: false, error: "..."}` when terminal is disabled
- [ ] Test button in Settings renders after the toggle description, disabled when terminal is off
- [ ] Test button shows spinner during request, clears result on next click
- [ ] Green dot appears on Agentic tab when terminal is enabled; disappears when disabled (toggle + close Settings)
- [ ] "Terminal" chip appears in toolbar; hidden on narrow screens
- [ ] Server restarted after MCP tool registration (tool only loads at startup)
- [ ] `codecompanion_run_terminal_cmd` MCP tool appears in MCP tool list
- [ ] MCP tool runs an allowlisted command and returns stdout + exit code
- [ ] MCP tool returns `isError: true` when terminal is disabled
- [ ] MCP tool returns "Command denied" when command is not in allowlist
- [ ] Audit log (`terminal-audit`) shows MCP-sourced commands with `clientKey: "mcp"`
