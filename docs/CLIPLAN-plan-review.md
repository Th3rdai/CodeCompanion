# CLIPLAN — plan review (plan-reviewer skill)

**Skill:** `.cursor/skills/plan-reviewer`  
**Subject:** `CLIPLAN.md` (agent terminal / builtin tools)  
**Review date:** 2026-03-19  
**Implementation status (2026-03-20):** **Shipped** — `lib/builtin-agent-tools.js`, `ToolCallHandler` + `hasAgentTools`, Settings **Agent terminal**, intra-request rate limiting, remote guard env. See git history (`feat: add agent terminal`, `feat: add intra-request rate limit…`). Optional follow-ups: §4.7 live SSE stream, Phase 4 confirm-before-run; review-table items (local-server definition, `input` fallback policy) should be re-checked against **current** `builtin-agent-tools.js` if hardening continues.

**Verdict (historical):** **Approved for implementation** — issues below were pre-ship findings; treat §2 as a checklist for hardening, not blockers.

---

## 1. Plan overview (validated)

**Build:** Builtin agent tools under `serverId === 'builtin'`, primary tool `run_terminal_cmd`, merged into the existing `TOOL_CALL` loop in `server.js` / `ToolCallHandler`, opt-in via `agentTerminal` config, with allowlist/blocklist, cwd lock to `projectFolder`, MCP-compatible tool results, and optional SSE streaming of terminal output after v1.

**How:** Phases 0→3 (config, plumbing, spawn + UI, hardening); Phase 4 optional confirm-before-run.

---

## 2. Issues and gaps

| Severity  | Description                                                                                                 | Impact                                                      | Suggested fix                                                                                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Major** | **§4.4.8 “non-local” server** for `CC_ALLOW_AGENT_TERMINAL` is undefined                                    | Feature might ship disabled always, or enabled unsafely     | Define rule: e.g. treat as local if `req.socket` is loopback **or** `HOST` is `127.0.0.1`/`::1` **or** env `CC_TRUST_LOCAL_SERVER=1`; document in BUILD.md                                |
| **Major** | **`input` fallback** (§4.3): whitespace split into `command`/`args` can widen attack surface vs strict JSON | Model or parser could smuggle tokens past JSON expectations | Prefer **reject** when only `{input: "..."}` for terminal tool in v1, or require explicit `command` + `args` and log `input` path as **major** risk with extra blocklist on joined string |
| **Minor** | §1 promises **“real-time UI feedback”** while §4.7 marks streaming **optional** after v1                    | Marketing mismatch                                          | Change §1 to: “clear feedback (result after run); optional live stream in v1.1”                                                                                                           |
| **Minor** | **`timeoutMs`** (tool args) vs **`maxTimeoutSec`** (config) — two knobs                                     | Implementer confusion                                       | Cap tool arg with `min(timeoutMs, maxTimeoutSec * 1000)` and document in §4.10                                                                                                            |
| **Minor** | **Line numbers** in §2 (~L493, etc.) drift                                                                  | Wrong navigation                                            | Add: “Locate by searching `hasExternalTools` / `buildToolsPrompt`”                                                                                                                        |
| **Minor** | Playwright E2E assumes **`node` on PATH** in test env                                                       | Flaky CI                                                    | Use `process.execPath` or skip if `agentTerminal` unsupported in packaged binary test                                                                                                     |

---

## 3. Improvements (optimizations / clarity)

- **Single source for `MAX_ROUNDS`:** Export from `tool-call-handler.js` or small `lib/tool-constants.js` and import in `server.js` to avoid drift.
- **ANSI stripping:** Consider a small dependency (e.g. `strip-ansi`) or expand regex for OSC sequences if npm outputs wide colors.
- **Rate-limit map:** Use bounded structure (TTL per key) to avoid unbounded memory on many IPs.

---

## 4. Implementation steps (numbered, execution order)

1. **Config:** Add `agentTerminal` defaults; deep merge in `loadConfig()` like `memory`/`docling`; POST `/api/config` shallow-merge `agentTerminal` object.
2. **Reserved id:** Reject MCP client `id === 'builtin'` in API + validation.
3. **Handler:** `ToolCallHandler(mcpClientManager, { log, debug, getConfig })`; `buildToolsPrompt()` MCP section + builtin section + §4.6 mitigation; `executeTool` → builtin module.
4. **Server:** `hasAgentTools`; rename logs; optional terminal SSE in tool loop; in-loop terminal rate limiter.
5. **Builtin module:** Validate, spawn (manual timeout), kill strategy, result shape §4.9.
6. **UI:** Settings (enable, allowlist, timeout); chat collapsible result; optional SSE handlers.
7. **Tests:** Unit coverage for validation + shape; integration with mocked Ollama; E2E optional.
8. **Docs:** BUILD.md — opt-in, local trust, `CC_ALLOW_AGENT_TERMINAL`, rate limits.

---

## 5. Dependencies

- **Prerequisite:** §0 — MCP SSE/http, Ollama context settings (already shipped).
- **Ordering:** Config + reserved `builtin` before handler; handler before enabling in UI.
- **External:** None beyond Node `child_process` (optional `cross-spawn`).

---

## 6. Error handling

| Failure                           | Behavior                                                              |
| --------------------------------- | --------------------------------------------------------------------- |
| `agentTerminal.enabled === false` | No tools in prompt; `builtin.*` returns disabled error text to model  |
| Allowlist / blocklist / cwd       | Tool error string in MCP shape; model can explain to user             |
| Timeout                           | SIGTERM → grace → SIGKILL / Windows equivalent; truncated output note |
| Spawn ENOENT                      | Clear “command not found” in tool result                              |
| Rate limit exceeded               | Tool error; suggest retry later                                       |

---

## 7. Testing strategy (aligned with CLIPLAN §6)

| Layer       | Focus                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| Unit        | Path escape, lists, timeout, env whitelist, ANSI, truncation, `input` handling policy |
| Integration | Mock `chatComplete` returning `TOOL_CALL: builtin.run_terminal_cmd(...)`              |
| E2E         | Opt-in + safe command; robust `node` resolution                                       |

---

## 8. Risk assessment

| Risk                                | Mitigation                                                      |
| ----------------------------------- | --------------------------------------------------------------- |
| `shell: true` + weak validation     | Allowlist basename + arg metachar blocklist + no freeform shell |
| Orphan children on Windows          | Document + `taskkill /T` path                                   |
| Prompt “act immediately”            | §4.6 split or softened prompt — **mandatory**                   |
| Remote RCE if UI hits shared server | `CC_ALLOW_AGENT_TERMINAL` + bind/loopback policy                |
| Memory growth (rate limit map)      | TTL eviction                                                    |

---

## 9. Self-check (plan-reviewer)

1. **Implementer questions:** Resolved except explicit **non-local** definition and **`input`** policy — **must decide in code review before merge.**
2. **Beginning / middle / end:** Yes — phases 0→4.
3. **Edge cases:** Largely covered; Windows and `input` need explicit decisions.
4. **Feasible:** Yes within stated effort estimates if streaming deferred per §4.7.

---

_Generated using the **plan-reviewer** skill workflow._
