# Agent terminal prompt alignment — **implemented**

**Status:** Shipped in `lib/builtin-agent-tools.js` and `lib/tool-call-handler.js` (see git history). Plan review: `docs/TERMINALFIX-plan-review.md`.

## Problem (original)

1. **Contradictory instructions**: The builtin safety preamble included **TERMINAL TOOL SAFETY** whenever any builtin tool was injected, but `getBuiltinTools()` could omit `run_terminal_cmd` (e.g. server exposure / bind rules). The model could read terminal rules while **`run_terminal_cmd` was missing** from “Available external tools.”

2. **Weak positive signal**: When terminal _was_ available, there was no short line stating that **`builtin.run_terminal_cmd`** was active for the session.

3. **Not a persistence bug**: The server rebuilds the tools prompt each request. “Forgetting” is **prompt design + model prior**, not lost Settings state.

## Goals (met)

- Align preamble with **advertised** tools: terminal safety only when `builtin.run_terminal_cmd` is in the built-in tool list for that request.
- Add an explicit **AGENT TERMINAL** line when the terminal tool is advertised.
- **Default `includeTerminal` to false** if omitted (`getBuiltinSafetyPreamble()`), avoiding accidental regression.
- Disambiguate with **`serverId === "builtin"`** so an MCP tool named `run_terminal_cmd` does not flip terminal preamble.

## Non-goals (unchanged)

- Execution policy (`validateCommand`, allowlist, bind checks).
- Settings UI copy.
- Chat UI surfacing “terminal disabled by server” vs Settings (optional follow-up).

## Design (locked — Option A)

### `lib/builtin-agent-tools.js`

- `BUILTIN_SAFETY_PREAMBLE_CORE` — PDF/binary, `view_pdf_pages`, `generate_office_file`, `write_file`.
- `BUILTIN_SAFETY_PREAMBLE_TERMINAL` — `TERMINAL TOOL SAFETY (builtin.run_terminal_cmd)` bullets.
- `getBuiltinSafetyPreamble(options = {})` — `includeTerminal === true` appends the terminal block; otherwise core only (default **no** terminal).

### `lib/tool-call-handler.js` — `buildToolsPrompt()`

- `hasTerminalTool = builtinTools.some((t) => t.serverId === "builtin" && t.name === "run_terminal_cmd")`
- After the tool list: append **AGENT TERMINAL: …** only when `hasTerminalTool`.
- `getBuiltinSafetyPreamble({ includeTerminal: hasTerminalTool })`

## Testing

| Location                                 | Coverage                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `tests/unit/builtin-agent-tools.test.js` | Preamble with/without `includeTerminal`; default omits terminal                                         |
| `tests/unit/tool-call-handler.test.js`   | Terminal off → no `TERMINAL TOOL SAFETY` / no `AGENT TERMINAL:`; terminal on + allowlist → both present |

Run: `npm run test:unit`

## Manual verification

Covered by unit tests (run `npm run test:unit`); no interactive UI pass required for release sign-off.

- [x] Settings: terminal **off** → no terminal block or AGENT TERMINAL line in tools prompt — `buildToolsPrompt omits terminal preamble and AGENT TERMINAL when terminal tool not advertised` in `tests/unit/tool-call-handler.test.js`.
- [x] Settings: terminal **on**, project folder + allowlist → terminal block + AGENT TERMINAL + `run_terminal_cmd` in tool list — `buildToolsPrompt includes terminal preamble and AGENT TERMINAL when builtin run_terminal_cmd is advertised` (uses `projectFolder`, `agentTerminal.enabled`, `allowlist`, `HOST=127.0.0.1` for deterministic loopback).
- [x] Bind `0.0.0.0` without `CC_ALLOW_AGENT_TERMINAL` (non-Electron): terminal block **absent**, tool not listed — `getBuiltinTools omits run_terminal_cmd when bind is 0.0.0.0 without CC_ALLOW_AGENT_TERMINAL` in `tests/unit/builtin-agent-tools.test.js` and `buildToolsPrompt omits terminal when bind is exposed without CC_ALLOW_AGENT_TERMINAL` in `tests/unit/tool-call-handler.test.js`.

## Rollback

Revert the single PR touching `builtin-agent-tools.js`, `tool-call-handler.js`, and tests; no migration.

---

_Historical plan notes and plan-reviewer feedback are summarized in `docs/TERMINALFIX-plan-review.md`._
