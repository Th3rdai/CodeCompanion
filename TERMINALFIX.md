# Agent terminal prompt alignment — **implemented**

**Status:** Shipped in `lib/builtin-agent-tools.js` and `lib/tool-call-handler.js` (see git history). Plan review: `docs/TERMINALFIX-plan-review.md`.

## Problem (original)

1. **Contradictory instructions**: The builtin safety preamble included **TERMINAL TOOL SAFETY** whenever any builtin tool was injected, but `getBuiltinTools()` could omit `run_terminal_cmd` (e.g. server exposure / bind rules). The model could read terminal rules while **`run_terminal_cmd` was missing** from “Available external tools.”

2. **Weak positive signal**: When terminal *was* available, there was no short line stating that **`builtin.run_terminal_cmd`** was active for the session.

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

| Location | Coverage |
|----------|----------|
| `tests/unit/builtin-agent-tools.test.js` | Preamble with/without `includeTerminal`; default omits terminal |
| `tests/unit/tool-call-handler.test.js` | Terminal off → no `TERMINAL TOOL SAFETY` / no `AGENT TERMINAL:`; terminal on + allowlist → both present |

Run: `npm run test:unit`

## Manual verification

- [ ] Settings: terminal **off** → no terminal block or AGENT TERMINAL line in tools prompt (use server debug if enabled).
- [ ] Settings: terminal **on**, project folder + allowlist → terminal block + AGENT TERMINAL + `run_terminal_cmd` in tool list.
- [ ] Bind `0.0.0.0` without `CC_ALLOW_AGENT_TERMINAL` (non-Electron): terminal block **absent**, tool not listed (matches `getBuiltinTools`).

## Rollback

Revert the single PR touching `builtin-agent-tools.js`, `tool-call-handler.js`, and tests; no migration.

---

*Historical plan notes and plan-reviewer feedback are summarized in `docs/TERMINALFIX-plan-review.md`.*
