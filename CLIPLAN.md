# CLIPLAN — Agent terminal / command execution (Code Companion)

**Status:** Draft for review (builtin `run_terminal_cmd` not implemented in core yet — see §10 for related shipped work)  
**Created:** 2026-03-20  
**Audience:** Implementing agents, security review, UX  

---

## 0. Related work already shipped (same release line)

These improvements help **large chats, reviews, and MCP tool use** but are **not** the builtin terminal from §4–5:

| Area | What shipped |
|------|----------------|
| **MCP client** | `lib/mcp-client-manager.js` — **`sse` transport**; if **`http`** (streamable) fails with **Method Not Allowed**, **automatic retry as SSE** to the same URL. |
| **Ollama / chat** | Config + Settings: **`chatTimeoutSec`** (30–600s), **`numCtx`** (Ollama `num_ctx`, `0` = model default), **`autoAdjustContext`** (raises effective `num_ctx` and timeout for large payloads). Wired through **`server.js`**, **`lib/ollama-client.js`**, **`lib/review.js`**. Clearer **HTTP 500 / context** hints in chat SSE errors. |
| **UX / tests** | Playwright **image-upload** E2E hardening; **`playwright.config.js`** runs **`npm run build`** before preview server. Design: empty-state width + **DESIGN-STANDARDS.md** viewport notes. |

**Tool loop today:** Still requires **connected external MCP servers** (or future **builtin** merge per §4). Connecting servers that only speak **SSE** is now supported without manual transport guessing.

---

## 1. Goal

Enable the **in-app LLM agent** (Ollama chat in Code Companion) to run **approved terminal commands** on behalf of the user, with clear security boundaries and optional UI feedback (output in chat or a small terminal panel).

**Non-goals (initial phases):**

- Full interactive TTY (vim, `read`, persistent shell session) — out of scope unless explicitly added later.
- Running commands on remote machines (SSH) — separate feature.
- Bypassing user consent for destructive operations — must remain configurable / blocked by policy.

---

## 2. Current architecture (as of review)

| Piece | Role |
|-------|------|
| `server.js` `/api/chat` | SSE streaming; injects system prompt including **external MCP tool list** |
| `lib/tool-call-handler.js` | Parses `TOOL_CALL: server_id.tool_name({json})` from model text; executes via `McpClientManager` |
| `lib/mcp-client-manager.js` | Connects to **external** MCP servers (stdio/http/sse); `callTool(serverId, ...)` |
| Tool loop | Runs **only when** `toolCallHandler.buildToolsPrompt()` is non-empty — i.e. **at least one connected MCP server** exposes tools (`hasExternalTools` in `server.js`) |

**Implication:** Built-in capabilities (terminal) must **not** depend on the user having an external MCP server connected. The implementation should inject **builtin tool descriptions** and execute them **without** an MCP transport, or register a **synthetic** local “server” that never uses stdio/http.

---

## 3. Options considered

| Option | Pros | Cons |
|--------|------|------|
| **A. External MCP only** (e.g. user installs “terminal MCP”) | No core code; reuses existing tool loop | Poor UX; many users won’t configure; tool loop off when no MCP |
| **B. Builtin tool registry** (`serverId` = `builtin`) | Works out of the box; same `TOOL_CALL:` UX; single code path | Must extend `ToolCallHandler` + prompt merge + `server.js` gate |
| **C. Separate `/api/agent/exec` + different protocol** | Clear API | Model must be taught a second format; duplicates tool plumbing |
| **D. Ollama native “tools” JSON** (if/when consistently available) | Structured | Ollama/tool support varies; app today is text + `TOOL_CALL` |

**Recommendation:** **Option B** — **builtin agent tools** merged into the same prompt and execution path as MCP tools, with `builtin` as a reserved `serverId`.

---

## 4. Proposed design

### 4.1 Builtin tool namespace

- Reserved prefix: **`builtin`** (e.g. `builtin.run_terminal_cmd`).
- `ToolCallHandler`:
  - **`buildToolsPrompt()`** — concatenate MCP tools **plus** enabled builtin tools (formatted identically: `- builtin.run_terminal_cmd: ...`).
  - **`executeTool(serverId, toolName, args)`** — if `serverId === 'builtin'`, delegate to **`lib/builtin-agent-tools.js`**; else existing `mcpClient.callTool`.

### 4.2 Chat route change (`server.js`)

- Replace `hasExternalTools` semantics with **`hasAgentTools`** (or keep name but define as):  
  `(mcpToolsPrompt.length > 0) || (builtinToolsPrompt.length > 0)`.
- Ensure the **tool-call loop** runs when **only** builtin tools are available (today it does not).

### 4.3 Primary tool: `run_terminal_cmd`

**Suggested schema (Zod or manual validation):**

| Field | Type | Notes |
|-------|------|-------|
| `command` | string | **Prefer argv split** — no shell by default |
| `args` | string[] | Optional; if empty, treat `command` as single binary name only |
| `cwd` | string (optional) | Default: `config.projectFolder` if set and exists, else `process.cwd()` |
| `timeoutMs` | number (optional) | Cap (e.g. default 60_000, max 300_000) |

**Execution:**

- Use `child_process.spawn` with `shell: false` when `args` provided.
- If a **shell one-liner** is required later, gate behind a separate tool `run_shell_script` with stricter policy.

**Output:**

- Capture stdout/stderr (bounded, e.g. first **256 KB** combined), exit code, duration.
- Return text to the model in existing tool-result message shape.

### 4.4 Security model (required)

1. **Master switch:** Config + Settings UI — `agentTerminal.enabled` default **`false`** until user opts in.
2. **Working directory:** Default to **`projectFolder`**; reject `cwd` outside `projectFolder` (resolve real paths, no `..` escape).
3. **Blocklist** (hard deny): e.g. commands containing `;`, `|`, `` ` ``, `$(`, `>&`, heredoc, or known dangerous binaries — tune per OS.
4. **Allowlist mode (optional, recommended for v1):** Only permit prefixes: `npm`, `npx`, `node`, `git`, `pnpm`, `yarn`, `python`, `python3`, `pytest`, `go`, `cargo`, etc. — **configurable list** in `.cc-config.json` / Settings.
5. **Timeout + process group kill** on expiry.
6. **Rate limit:** Reuse or extend existing rate limit middleware for a new endpoint if exec is exposed via HTTP separately; for tool-only path, limit rounds (already `MAX_ROUNDS`) and consider per-session command count.
7. **Logging:** Audit log line (command, cwd, exit, user/session id if any) — **no secrets** in logs; truncate.

**Electron vs browser:** Server runs **locally** for typical installs; risk profile is “same as user running terminal.” Still apply defaults above.

### 4.5 User approval (phased)

| Phase | Behavior |
|-------|----------|
| **P1** | Opt-in only; immediate execution after model emits `TOOL_CALL` (same as current MCP tools). |
| **P2** | Optional **“confirm before run”**: SSE event `pendingCommand` → UI modal → POST `/api/chat/approve-tool` or resume token — **higher effort**; document API shape before coding. |

### 4.6 UI / UX

| Piece | Description |
|-------|-------------|
| **Settings** | Section “Agent terminal”: enable toggle, allowlist editor (textarea or tags), max timeout, optional “confirm each command”. |
| **Chat** | When tool runs, show collapsible **“Ran: …”** block (stdout/stderr) — similar to tool round indicator today (`toolCallRound`). |
| **Optional panel** | “Terminal output” side panel — nice-to-have after P1. |

### 4.7 Prompt / model guidance

Extend builtin tool description with:

- Run only from **project folder** unless user explicitly needs otherwise.
- Prefer **read/analyze** tools over shell when possible (future: `read_file` builtin).
- Never suggest `rm -rf /`, credential harvesting, or disabling security.

---

## 5. Implementation phases (task list)

### Phase 0 — Docs & flags

- [ ] Add `agentTerminal` (or `builtinAgentTools`) section to config schema in `lib/config` / `getConfig` / Settings persistence.
- [ ] Document in `BUILD.md` or `docs/` that terminal execution is **opt-in**.

### Phase 1 — Builtin tool plumbing (no shell yet)

- [ ] Add `lib/builtin-agent-tools.js`: registry, validation, `executeBuiltinTool`.
- [ ] Extend `ToolCallHandler`: merge builtin tools in `buildToolsPrompt`; route `executeTool` for `serverId === 'builtin'`.
- [ ] Update `server.js`: **`hasAgentTools`** so tool loop runs with builtin-only tools.
- [ ] Unit tests: parsing, cwd restriction, blocklist, timeout, output truncation.

### Phase 2 — `run_terminal_cmd` + Settings UI

- [ ] Implement `builtin.run_terminal_cmd` with spawn + security defaults.
- [ ] Settings panel + persist allowlist / enabled.
- [ ] Frontend: show tool execution summary in chat stream (extend SSE payload if needed).

### Phase 3 — Hardening & polish

- [ ] Optional allowlist-only mode enforced server-side.
- [ ] Audit logging file or structured log.
- [ ] Playwright smoke: enable flag in test, mock spawn or run `echo ok`.

### Phase 4 (optional) — Confirm-before-run

- [ ] Design pending-tool state machine (single-flight per conversation).
- [ ] API + UI modal; resume tool loop after approval.

---

## 6. Testing strategy

| Layer | Tests |
|-------|--------|
| Unit | `builtin-agent-tools.js` — path escape, blocklist, timeout, binary not found |
| Integration | `/api/chat` with mocked Ollama returning `TOOL_CALL: builtin.run_terminal_cmd(...)` → assert spawn called with expected argv (mock `child_process`) |
| E2E (optional) | Settings toggle + safe command `node -e "console.log('ok')"` |

---

## 7. Open questions (for reviewers)

1. Should **browse_files** / future **read_file** be builtin too (same namespace)?
2. **Windows** vs Unix: separate blocklist/allowlist entries?
3. Is **npm install** allowed by default in allowlist, or too noisy / supply-chain sensitive?
4. Should terminal output be **streamed** to UI (chunked SSE) for long runs, or P1 truncate-only is enough?

---

## 8. Related files (implementation index)

| File | Change |
|------|--------|
| `server.js` | `hasAgentTools`; tool loop condition |
| `lib/tool-call-handler.js` | Builtin merge + dispatch |
| `lib/builtin-agent-tools.js` | **New** |
| `lib/config.js` (or equivalent) | New config keys |
| `src/components/SettingsPanel.jsx` | Agent terminal section |
| `src/App.jsx` | Handle new SSE fields for tool output (if any) |
| `tests/unit/*` | New test file for builtin tools |

---

## 9. Review checklist (for other agents)

- [ ] Security: cwd locked to project; blocklist; timeouts; opt-in default.
- [ ] No tool execution when `agentTerminal.enabled === false`.
- [ ] Tool loop works **without** external MCP servers.
- [ ] Prompt injection: model cannot override cwd via creative args if validation is strict.
- [ ] UX: user understands commands run **as the local server user**.

---

---

## 10. Archon / task tracking

Implementation batches for this plan should be tracked in Archon under **Code Companion — Vibe Coder Edition**. Example: task *“MCP SSE + Ollama chat context/timeout (Settings)”* documents the §0 delivery; **builtin terminal** phases (§5) remain open until coded.

---

*End of CLIPLAN — update this document as decisions are made.*
