# CLIPLAN — Agent terminal / command execution (Code Companion)

**Status:** **Ready for implementation** — architecture matches repo; **implementation must follow corrected spawn / rate-limit notes below**  
**Created:** 2026-03-20  
**Last review:** 2026-03-20 — final pass (spawn API, rate limits, prompt tension, parseArgs edge case, env whitelist)  
**Audience:** Implementing agents, security review, UX  

**External validation:** Structured plan review (issues, risks, execution order) → **`docs/CLIPLAN-plan-review.md`** (maintain when design changes).

### Readiness snapshot

| Area | Verdict |
|------|---------|
| Integration points | `server.js` `/api/chat` tool loop + `ToolCallHandler` — confirmed |
| Security model | Opt-in, cwd, allow/block lists, env whitelist — coherent |
| **Corrections in this review** | §4.3 spawn example (no invalid `timeout`); §4.4.6 rate limit scope; §4.6 model behavior clarified |
| Optional scope trim | §4.7 streaming SSE can ship **after** Phase 2 “execute + final result” if schedule slips |

---

## 0. Prerequisite features (already in tree)

Implementers should know these exist; they are **not** part of the terminal feature itself:

- **MCP client:** `stdio` / `http` / `sse`, with HTTP→SSE fallback (`lib/mcp-client-manager.js`).
- **Ollama:** `chatTimeoutSec`, `numCtx`, `autoAdjustContext` in config + Settings (`lib/config.js`, `server.js`, `lib/ollama-client.js`).

---

## 1. Goal

Enable the **in-app LLM agent** (Ollama chat in Code Companion) to run **approved terminal commands** on behalf of the user, with clear security boundaries and **visible command results** in chat after each run; **live streaming** of stdout/stderr is optional (§4.7, post–v1).

**Non-goals (initial phases):**

- Full interactive TTY (vim, `read`, persistent shell session)
- Running commands on remote machines (SSH)
- Bypassing user consent for destructive operations

---

## 2. Current architecture (verified)

| Piece | Location | Detail |
|-------|----------|--------|
| Chat SSE endpoint | `server.js` (`app.post('/api/chat', …)`) | Streams tokens via SSE; injects system prompt with tool list — **search** `hasExternalTools` if line numbers drift |
| Tool call handler | `lib/tool-call-handler.js` L1–85 | Regex: `TOOL_CALL:\s*(\S+?)\.(\S+?)\(([\s\S]*?)\)` parses serverId.toolName(args) |
| Tool prompt | `tool-call-handler.js` L65–81 | `buildToolsPrompt()` → `- serverId.toolName: description` format |
| Tool dispatch | `tool-call-handler.js` L54–62 | `executeTool()` → `mcpClient.callTool()` |
| Tool loop gate | `server.js` ~L552–553 | `hasExternalTools = toolsPrompt.length > 0` — loop skipped when false |
| Tool loop | `server.js` ~L631–721 | `MAX_ROUNDS = 5`, uses `chatComplete` (non-streaming), feeds results back as user messages |
| MCP client | `lib/mcp-client-manager.js` L108–114 | `callTool()` returns MCP `CallToolResult` shape: `{content: [{type:'text', text:'...'}]}` |
| Config | `lib/config.js` | `loadConfig()` already **deep-merges** `memory`, `imageSupport`, `docling`; add **`agentTerminal`** the same way. `updateConfig()` still uses shallow `Object.assign` on the root — POST `/api/config` must **merge** `agentTerminal` fields, not replace the whole object unless intentional |
| Existing exec | `lib/github.js` | Uses `execSync`, `execFileSync` for git ops with path validation + timeouts |

**Critical finding:** The tool prompt at L73–80 says *"USE IT IMMEDIATELY — do NOT ask for permission"*. This is **dangerous for terminal commands** and must be overridden.

---

## 3. Approach: Option B — Builtin tool registry

| Option | Verdict |
|--------|---------|
| A. External MCP only | Rejected — poor UX; tool loop off when no MCP |
| **B. Builtin tool registry** (`serverId = 'builtin'`) | **Selected** — works out of the box; same TOOL_CALL format; single code path |
| C. Separate `/api/agent/exec` | Rejected — duplicates plumbing |
| D. Ollama native tools JSON | Rejected — inconsistent support |

---

## 4. Design

### 4.1 Builtin tool namespace

- Reserved serverId: **`builtin`** (e.g. `TOOL_CALL: builtin.run_terminal_cmd({"command":"npm","args":["test"]})`)
- `ToolCallHandler.buildToolsPrompt()` → concatenate MCP tools + enabled builtin tools
- `ToolCallHandler.executeTool()` → if `serverId === 'builtin'`, delegate to `lib/builtin-agent-tools.js`; else existing `mcpClient.callTool`
- Constructor change: `new ToolCallHandler(mcpClientManager, { log, debug, getConfig })` — builtins need config access

### 4.2 Chat route change (`server.js`)

- `hasExternalTools` → **`hasAgentTools`**: `toolsPrompt.length > 0` where toolsPrompt includes both MCP + builtin descriptions
- Tool loop runs when **only** builtin tools available (currently does not)
- Update log lines from "external tools" to "agent tools"

### 4.3 Primary tool: `run_terminal_cmd`

**Schema:**

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `command` | string | required | Binary name (e.g. `npm`, `node`, `git`) |
| `args` | string[] | `[]` | Arguments array — no shell interpolation |
| `input` | string | — | **Fallback only** — `_parseArgs` may wrap non-JSON as `{input: "..."}`. **Higher risk** than structured JSON. **v1 recommendation:** reject terminal execution when only `input` is present, or apply **strict** blocklist on the full string and treat as experimental — see **`docs/CLIPLAN-plan-review.md`** §2. |
| `cwd` | string | `config.projectFolder` | Must resolve within projectFolder |
| `timeoutMs` | number | from config `maxTimeoutSec` | Effective timeout = **min(`timeoutMs` if set, `maxTimeoutSec * 1000`)**, capped at 300000 (5 min) |

**Execution (Node `child_process.spawn` — real API):**

`spawn` **does not** accept a `timeout` option (that exists on `spawnSync`). Use a **`setTimeout`** + `proc.kill` / process-group kill, or wrap with `AbortSignal` patterns if you standardize on a helper.

```javascript
const proc = spawn(command, args, {
  cwd: resolvedCwd,
  shell: true, // Required for npm/yarn/npx on Windows (batch/cmd) and many Unix setups
  detached: true, // Often used so the child becomes group leader → `kill(-pid)` can reap npm children (verify per OS)
  env: getWhitelistedEnv(), // §4.5
  stdio: ['ignore', 'pipe', 'pipe'],
});
const timer = setTimeout(() => {
  try {
    process.kill(-proc.pid, 'SIGTERM');
  } catch (_) {
    proc.kill('SIGTERM');
  }
  // …after grace, SIGKILL (§4.3 escalation)
}, timeoutMs);
proc.on('close', () => clearTimeout(timer));
```

**Why `shell: true`:** `npm`, `yarn`, `npx` are often scripts, not single ELF binaries. **`shell: false`** is stricter but breaks common workflows on Windows. Mitigate with **basename allowlist**, **arg metachar blocklist**, and **no arbitrary shell strings** (still pass `command` + `args` array; avoid concatenating a user-controlled one-liner).

**Cross-platform:** Consider **`cross-spawn`** (already common in Node ecosystems) if raw `spawn` + `shell: true` behaves inconsistently in CI; document the choice in code comments.

**Output processing:**
- Capture stdout + stderr combined (bounded at **256 KB**)
- **Strip ANSI escape codes** before storing: `output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')`
- Record exit code and duration
- Return MCP-compatible shape: `{content: [{type: 'text', text: '...'}]}`

**Timeout escalation:**
1. `SIGTERM` on timeout (or `proc.kill` if group kill unavailable)
2. Wait ~3 seconds
3. `process.kill(-proc.pid, 'SIGKILL')` when POSIX process groups apply — **Windows behavior differs**; use `taskkill /T /F` or `proc.kill` + documented limitation for orphan npm children on Win32

### 4.4 Security model

1. **Master switch:** `agentTerminal.enabled` — default **`false`**. No builtin tools listed or executed when disabled.

2. **Working directory:**
   - Default: `config.projectFolder`
   - `cwd` arg must resolve within projectFolder (after `fs.realpathSync`)
   - If projectFolder unset → **deny** with message: *"Set a project folder in Settings to use the agent terminal"*

3. **Allowlist (v1 default — empty until user configures):**
   - Configurable list in `.cc-config.json` and Settings UI
   - Suggested entries: `npm`, `npx`, `node`, `git`, `pnpm`, `yarn`, `python`, `python3`, `pytest`, `go`, `cargo`, `make`, `cat`, `ls`, `echo`
   - Match against `path.basename(command)` (normalize for Windows `.cmd`/`.exe` suffixes)

4. **Blocklist (hard deny, always enforced):**
   - Shell metacharacters in args: `;`, `|`, `` ` ``, `$(`, `>&`, `>>`, `<<`
   - Dangerous commands: `rm -rf /`, `sudo`, `su`, `chmod 777`, `curl | sh`, `wget | sh`
   - Regex-based check on the full command + args string

5. **Concurrent command limit:** If the model emits multiple `run_terminal_cmd` calls in **one** assistant message, run **sequentially**; **cap at 3 terminal invocations per tool-call round** (reject extras with a clear tool error back to the model).

6. **Rate limit (important — not HTTP middleware):** `app.use('/api/chat', createRateLimiter(...))` limits **POSTs to `/api/chat`**, not commands **inside** a long-lived SSE response. Track **per-request** or **per-IP + sliding window** counters **inside the tool loop** (in-memory Map + cleanup) for terminal executions, e.g. max **20 commands / minute / client key** (derive key from `getClientAddress(req)` or a session id if added later). Document limits in BUILD.md.

7. **Audit logging:** Log to existing log system: `[TERMINAL] command, args, cwd, exitCode, duration, truncated`

8. **Remote deployment warning:** If the server is **not** bound/trusted as local-only, `agentTerminal.enabled` must also require env var `CC_ALLOW_AGENT_TERMINAL=1`. **Define “local” in code** (e.g. loopback client + bind address) and document in BUILD.md — see **`docs/CLIPLAN-plan-review.md`** §2.

### 4.5 Environment variable whitelist

When spawning processes, pass only safe env vars:

```javascript
function getWhitelistedEnv() {
  const safe = {};
  const ALLOW = ['PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'LC_ALL', 'TERM',
    'NODE_ENV', 'GOPATH', 'GOROOT', 'CARGO_HOME', 'RUSTUP_HOME',
    'PYTHON', 'PYTHONPATH', 'VIRTUAL_ENV', 'CONDA_DEFAULT_ENV',
    'npm_config_registry', 'EDITOR',
    'TMPDIR', 'TMP', 'TEMP'];  // Build tools need temp dirs
  for (const key of ALLOW) {
    if (process.env[key]) safe[key] = process.env[key];
  }
  return safe;
}
```

### 4.6 Tool prompt safety override (resolve tension with MCP text)

The existing MCP block in `buildToolsPrompt()` says *"USE IT IMMEDIATELY — do NOT ask for permission"*. That is **appropriate for read-only MCP tools** but **wrong for terminal execution**.

**Required implementation approach (pick one, document in code):**

1. **Split prompt sections:** Keep the urgent wording only for **MCP** tools. For **`builtin.run_terminal_cmd`**, inject a **separate** block with stricter rules (below), **or**
2. **Single softened prompt** when **any** builtin terminal tool is enabled: replace “never ask” with “for **terminal** tools: explain planned command in the **same** assistant message **before** the `TOOL_CALL:` line; prefer read-only commands; never destructive ops without explicit user confirmation in chat history.”

**Builtin / terminal preamble (content):**

```
TERMINAL TOOL SAFETY:
- In the SAME assistant message: briefly state what you will run and why, then emit TOOL_CALL (user sees narration + tool in one bubble).
- NEVER run destructive commands (rm, drop, truncate, mkfs, etc.) unless the user explicitly asked for that operation in this conversation.
- If a command fails, explain the error — do not retry blindly with escalated privileges.
- Stay under the configured project folder — do not suggest paths outside it.
- Prefer read-only commands first (git status, ls/dir) before writes.
```

**Note:** True “confirm before run” for every command is **Phase 4** (`confirmBeforeRun` / modal) — the preamble is **not** a substitute for that UX.

### 4.7 SSE events for terminal output (recommended; may follow v1)

**v1 minimal:** Execute command, truncate + strip ANSI, return MCP-shaped text to the model (§4.9) — **no** streaming required for acceptance.

**v1.1 / Phase 2+:** During tool execution, stream terminal output to the UI so users see real-time progress:

```javascript
// In the tool loop, when executing a terminal command:
res.write(`data: ${JSON.stringify({
  toolCallRound: round,
  terminalCmd: { command, args, cwd },
  terminalStatus: 'running'
})}\n\n`);

// Stream stdout chunks as they arrive:
proc.stdout.on('data', (chunk) => {
  res.write(`data: ${JSON.stringify({
    terminalOutput: stripAnsi(chunk.toString()),
    terminalStream: 'stdout'
  })}\n\n`);
});

proc.stderr.on('data', (chunk) => {
  res.write(`data: ${JSON.stringify({
    terminalOutput: stripAnsi(chunk.toString()),
    terminalStream: 'stderr'
  })}\n\n`);
});

// On completion:
res.write(`data: ${JSON.stringify({
  terminalStatus: 'done',
  terminalExitCode: code,
  terminalDuration: durationMs
})}\n\n`);
```

Frontend renders these in a collapsible `<pre>` block within the chat stream.

### 4.8 Reserved MCP client id

**`builtin`** must be rejected when saving MCP client config. Add validation in `lib/mcp-api-routes.js` and/or `lib/mcp-client-manager.js`:

```javascript
if (id === 'builtin') return res.status(400).json({ error: '"builtin" is a reserved ID' });
```

### 4.9 Tool result shape (MCP compatibility)

Builtin tools must return the same shape as MCP tools so `server.js` tool loop works unchanged:

```javascript
// From executeTool():
return {
  success: true,
  result: {
    content: [
      { type: 'text', text: `Exit code: ${exitCode}\nDuration: ${duration}ms\n\n${output}` }
    ]
  }
};
```

### 4.10 Config schema

```javascript
// In lib/config.js defaults:
agentTerminal: {
  enabled: false,           // Master switch — opt-in
  allowlist: [],            // Empty = deny all commands until user configures
  blocklist: ['sudo', 'su', 'rm -rf', 'chmod 777', 'mkfs', 'dd'],
  maxTimeoutSec: 60,        // Per-command timeout (max 300)
  maxOutputKB: 256,          // Truncate output beyond this
  confirmBeforeRun: false,  // P2 feature — show modal before execution
},
```

Deep merge in `loadConfig()`:
```javascript
agentTerminal: { ...defaults.agentTerminal, ...(saved.agentTerminal || {}) },
```

POST `/api/config` handler:
```javascript
if (req.body.agentTerminal !== undefined) {
  config.agentTerminal = { ...config.agentTerminal, ...req.body.agentTerminal };
  log('INFO', `Agent terminal config updated: enabled=${config.agentTerminal.enabled}`);
}
```

`sanitizeConfigForClient()` — no sensitive fields in v1, pass through as-is.

---

## 5. Implementation phases

### Phase 0 — Config & guards (~30 min)

- [ ] Add `agentTerminal` to config defaults + deep merge in `loadConfig()`
- [ ] Add POST handler + sanitization in `server.js`
- [ ] Reject `builtin` as MCP client id in `mcp-api-routes.js`
- [ ] Document in BUILD.md: opt-in, local-only deployment note

### Phase 1 — Builtin tool plumbing (~2 hours)

- [ ] Create `lib/builtin-agent-tools.js`: tool registry, validation, `executeBuiltinTool()`, MCP-shaped return
- [ ] Extend `ToolCallHandler` constructor to accept `getConfig`
- [ ] `buildToolsPrompt()` merges MCP + builtin tools (with safety preamble)
- [ ] `executeTool()` routes `builtin.*` to `builtin-agent-tools.js`
- [ ] `server.js`: `hasAgentTools` gate so tool loop runs with builtins only
- [ ] Unit tests: reserved id, parsing, cwd validation, blocklist, result shape

### Phase 2 — `run_terminal_cmd` + Settings UI (~3 hours)

- [ ] Implement spawn with: allowlist check, blocklist check, cwd validation, env whitelist, ANSI stripping, output truncation, process group kill, **manual** timeout (§4.3 — not `spawn({ timeout })`)
- [ ] Settings panel: Agent Terminal section (enable toggle, allowlist editor, timeout slider)
- [ ] Frontend: collapsible “Ran command …” block fed by **final** tool result at minimum
- [ ] Optional same-phase: handle `terminalCmd`, `terminalOutput`, `terminalStatus` SSE events (§4.7)

### Phase 3 — Hardening (~1 hour)

- [ ] Audit logging (command, cwd, exit code, duration)
- [ ] Playwright smoke test: enable + run `node -e "console.log('ok')"`
- [ ] Remote deployment guard: require `CC_ALLOW_AGENT_TERMINAL=1` env var when non-local

### Phase 4 (optional) — Confirm-before-run

- [ ] SSE event `pendingCommand` → UI modal → POST `/api/chat/approve-tool`
- [ ] State machine for single-flight pending tool per conversation

---

## 6. Testing strategy

| Layer | Tests |
|-------|--------|
| Unit | `builtin-agent-tools.js` — path escape, blocklist, allowlist, timeout, env whitelist, ANSI strip, output truncation, binary not found, result shape |
| Integration | `/api/chat` with mocked Ollama returning `TOOL_CALL: builtin.run_terminal_cmd(...)` → assert spawn called with expected argv |
| E2E | Settings toggle + `node -e "console.log('ok')"` → verify output in chat |

---

## 7. Files to modify/create

| File | Change |
|------|--------|
| `lib/config.js` | Add `agentTerminal` defaults + deep merge |
| `lib/builtin-agent-tools.js` | **NEW** — tool registry + execution |
| `lib/tool-call-handler.js` | Constructor change; merge builtin in `buildToolsPrompt`; route in `executeTool` |
| `lib/mcp-api-routes.js` | Reject `builtin` as MCP client id |
| `server.js` | `hasAgentTools` gate; POST config merge for `agentTerminal`; optional SSE terminal stream events (§4.7) |
| `src/components/SettingsPanel.jsx` | Agent Terminal section |
| `src/App.jsx` | Chat UI for tool results; **optional** `terminalOutput` / `terminalStatus` SSE (§4.7) |
| `tests/unit/builtin-agent-tools.test.js` | **NEW** — unit tests |

---

## 8. Acceptance criteria

**v1 (must ship):**

- [ ] With **no MCP clients** connected, opted-in user sees builtin tools in system prompt and tool loop runs
- [ ] With `agentTerminal.enabled === false`, builtins are NOT listed and any `builtin.*` call returns disabled error
- [ ] `cwd` cannot escape `projectFolder` (after realpathSync)
- [ ] `builtin` cannot be registered as an MCP client id
- [ ] Allowlist enforced — commands not in list are rejected
- [ ] Blocklist enforced — shell metacharacters in args rejected
- [ ] Output truncated at configured limit; ANSI stripped before model + UI
- [ ] Timeout implemented without invalid `spawn` options; child processes not left orphaned in happy-path tests
- [ ] **Intra-request / per-IP** terminal rate limit enforced (§4.4.6), not only `POST /api/chat` middleware
- [ ] Settings UI: enable/disable, allowlist editor, timeout
- [ ] Chat shows command result (collapsible or inline) **after** execution at minimum

**Follow-up (optional):**

- [ ] Live **streaming** stdout/stderr via SSE during execution (§4.7)
- [ ] Modal **confirm-before-run** (Phase 4)

---

## 9. Review checklist (for other agents)

- [ ] Security: cwd locked to project; allowlist + blocklist; timeouts; opt-in default off
- [ ] No tool execution when `agentTerminal.enabled === false`
- [ ] Tool loop works **without** external MCP servers
- [ ] Prompt injection: model cannot override cwd via creative args
- [ ] Tool prompt: MCP “act immediately” wording is **not** applied to terminal tools without the §4.6 mitigation (split or softened prompt)
- [ ] MCP result shape compatibility maintained
- [ ] `shell: true` (or `cross-spawn`) only with strict allowlist + arg validation — no user-controlled shell one-liners
- [ ] Timeout / kill strategy verified on **macOS/Linux**; **Windows** limitations documented if process-group kill is incomplete
- [ ] ANSI escape codes stripped before display and model consumption
- [ ] Environment variables whitelisted (no secret leakage)
- [ ] UX: user understands commands run as the local server user

---

*End of CLIPLAN — update this document as decisions are made.*
