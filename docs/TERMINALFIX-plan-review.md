# TERMINALFIX — plan review (plan-reviewer skill)

**Skill:** `.cursor/skills/plan-reviewer`  
**Subject:** `TERMINALFIX.md` (revised after implementation)  
**Review date:** 2026-04-03

**Verdict:** **Approved — matches shipped behavior.** Suitable as the record of what was built; no blocking gaps for this scope.

---

## 1. Plan overview (validated)

**Built:** Conditional **TERMINAL TOOL SAFETY** preamble and an **AGENT TERMINAL** availability line, driven by the same predicate as advertised builtins: `builtin.run_terminal_cmd` present in `getBuiltinTools()` output, with **`serverId === "builtin"`** to avoid MCP name collisions.

**How:** String split in `lib/builtin-agent-tools.js` (`BUILTIN_SAFETY_PREAMBLE_CORE` + optional `BUILTIN_SAFETY_PREAMBLE_TERMINAL`); `buildToolsPrompt()` in `lib/tool-call-handler.js` computes `hasTerminalTool` and passes `getBuiltinSafetyPreamble({ includeTerminal: hasTerminalTool })`.

---

## 2. Issues log (revised plan vs implementation)

| Severity            | Description                                             | Status                                                                         |
| ------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Major** (pre-fix) | `hasTerminalTool` must require `serverId === "builtin"` | **Resolved** in implementation                                                 |
| **Minor**           | Line-number references in plan drift                    | **Resolved** — revised doc uses file/symbol names only                         |
| **Minor**           | Option A vs B ambiguity                                 | **Resolved** — Option A (constants + one function) locked                      |
| **Minor**           | Default for `includeTerminal`                           | **Resolved** — `options.includeTerminal === true` only; default omits terminal |

No **critical** findings on the revised plan.

---

## 3. Improvements (optional follow-ups)

- **Debug logging:** Log `hasTerminalTool` when `DEBUG` and `hasAgentTools` are used (parity with `toolsLength`) — optional; not required for correctness.
- **User-visible explanation:** When Settings enable terminal but `getBuiltinTools` strips `run_terminal_cmd` (bind exposure), a chat or Settings hint — out of scope for TERMINALFIX; listed in original non-goals.

---

## 4. Implementation steps (as shipped)

1. Add core + terminal preamble constants; implement `getBuiltinSafetyPreamble({ includeTerminal })` with safe default.
2. In `buildToolsPrompt`, compute `hasTerminalTool` with `serverId` + `name`; append AGENT TERMINAL line; pass flag into preamble.
3. Unit tests: `tests/unit/builtin-agent-tools.test.js`, extend `tests/unit/tool-call-handler.test.js`.
4. Run `npm run test:unit`.

---

## 5. Dependencies

- **Prerequisite:** Existing `getBuiltinTools()` / exposure rules unchanged.
- **Ordering:** Single PR; no feature flags.

---

## 6. Error handling

| Case                              | Behavior                                           |
| --------------------------------- | -------------------------------------------------- |
| `includeTerminal` omitted / false | No terminal preamble block                         |
| `hasTerminalTool` false           | No AGENT TERMINAL line                             |
| MCP tool named `run_terminal_cmd` | Ignored for `hasTerminalTool` (requires `builtin`) |

Execution-time denials (allowlist, etc.) unchanged.

---

## 7. Testing strategy

| Layer          | Focus                                                        |
| -------------- | ------------------------------------------------------------ |
| Unit (builtin) | Preamble substrings for `includeTerminal` true/false/default |
| Unit (handler) | `buildToolsPrompt` with terminal enabled/disabled config     |

Manual checklist in `TERMINALFIX.md` for bind/Electron scenarios.

---

## 8. Risks

| Risk                            | Mitigation                                                       |
| ------------------------------- | ---------------------------------------------------------------- |
| Regression to old contradiction | Default omits terminal; single call site passes explicit boolean |
| Name collision                  | `serverId === "builtin"` required                                |

---

## 9. Self-check (plan-reviewer)

1. **Implementer questions:** None remaining for this scope.
2. **Beginning / middle / end:** Yes — constants → handler → tests.
3. **Edge cases:** Bind/Electron handled by existing `getBuiltinTools()`; preamble tracks advertised tools.
4. **Feasible:** Shipped; tests green.

---

_Generated using the **plan-reviewer** skill workflow on the **revised** TERMINALFIX plan._
