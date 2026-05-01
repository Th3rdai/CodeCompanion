<original_task>
Implement MCP per-tool enable/disable controls (MCPFIX) for Code Companion v1.6.9.
</original_task>

<work_completed>

**Session progress UI — complete (2026-05-01)**

- **`ChatSessionProgress`** (`src/components/ui/ChatSessionProgress.jsx` + `src/index.css`): indeterminate bar, glass strip, `aria-*`, `prefers-reduced-motion`.
- **Wired** in `App.jsx` (main chat `streaming`), `BaseBuilderPanel.jsx` (score + revise), `ReviewPanel.jsx` (loading / report / fallback SSE / deep dive), `SecurityPanel.jsx` (loading / remediation / fallback / deep dive), `ExperimentPanel.jsx` (running step), `DeepDivePanel.jsx`, `BuildSimpleView.jsx` (research + plan + What’s Next loading).
- **Docs:** `docs/SESSION-PROGRESS.md`, `CHANGELOG.md` [Unreleased], `CLAUDE.md` project table, `design-system/README.md` link.
- **Verification:** `npm run validate:static`, `npm run test:unit` (388), `npx vite build` all pass.

**Build/agent-terminal hardening (2026-04-29 afternoon)**

Two follow-up commits after the morning's chat-timeout + Terminal-CWD work, triggered by reviewing the installed app's `app.log` and a TradingAgents debugging session that hit a 25-round terminal-failure loop.

- **`a2a8207` — `routes/build.js` next-action timeout + macOS Python guidance**:
  - `routes/build.js:225`: hardcoded `30000` → `(config.chatTimeoutSec || 600) * 1000`. Three back-to-back `next-action failed: This operation was aborted` (each ~30s) triggered the change.
  - `lib/builtin-agent-tools.js` `BUILTIN_SAFETY_PREAMBLE_TERMINAL`: added macOS/Linux guidance to use `python3`/`pip3` (bare `python`/`pip` returns exit 127 on macOS); multi-statement Python via `builtin.write_file` + run, never `python -c "stmt1; stmt2"` (semicolons trip the metacharacter guard).

- **`dc18dfd` — agent-terminal blocklist token-boundary fix + clearer no-shell guidance + 7 unit tests**:
  - `validateCommand` was using `fullCmd.toLowerCase().includes(blocked)` for the blocklist check. With the default blocklist entry `"su"`, this wrongly blocked `python3 -c "import sys; print('Import successful')"` because `"successful"` contains the substring `"su"`. Same false-positive shape for `"dd"` matching `"add"`/`"mkdir"`, `"su"` matching `"sys"`/`"pseudo"`, etc.
  - New helper `commandContainsBlockedToken(fullCmd, blocked)` uses a word-boundary regex (`(^|\s)<blocked>($|\s)`). Genuine threats still match (`sudo apt`, `rm -rf /tmp`, `dd if=/dev/zero`); false positives no longer do.
  - `BUILTIN_SAFETY_PREAMBLE_TERMINAL` strengthened with: "SINGLE BINARY via spawn — no shell" (no `&&`, `;`, `|`, `>`, `<`, `2>&1`, `$()`, backticks, `cd path && cmd`, `source venv && python ...`), "STOP after two same-shape denials" rule, "install Python deps with `uv pip install -r requirements.txt` before retrying ImportError scripts."
  - 7 new unit tests in `tests/unit/builtin-agent-tools.test.js` cover the regression: `su`/`sys`, `su`/`successful`, `sudo`/`pseudo`, multi-token `rm -rf`, `dd`/`add`/`mkdir`, plus a preamble assertion that the new no-shell + rate-limit guidance is present. **284 total pass** (was 277).

- **Diagnosis trail (so the next pass doesn't re-derive it)**:
  - The user reported "undefined errors" across rounds 1–25. Reading `~/Library/Application Support/code-companion/logs/{app.log,debug.log}` showed the actual failures: model emitting compound shell commands, tripping the metacharacter guard; one specific round (13) tripped the false-positive `"su"` blocklist match on `print('successful')`; rounds 21–23 hit the 20-cmd/min rate limit because the model kept retrying same-shape variations.
  - Root cause was _not_ an environmental glitch — the model was misreading structured deny responses as "undefined" in its summary. The preamble update is the durable fix.

- **User's live config (`~/Library/Application Support/code-companion/.cc-config.json`)**:
  - `chatTimeoutSec` bumped from 510 → 600 in-place (backup at `.cc-config.json.before-timeoutfix.bak`) so the installed v1.6.16 stops hitting the 5-min `fetch failed` until the next signed release ships.
  - User's blocklist still contains `"su"` — the installed v1.6.16 has the substring-match bug. Workaround until next release: remove the bare `"su"` entry in Settings → Agent Terminal → Blocklist.

- **Dev build state**: PID 46181 running `electron electron/main.js` against `https://localhost:8900` (HTTPS, repo `cert/`), patched code loaded. All four of today's commits (`a07b43b`, `a2a8207`, `dc18dfd`) are on `origin/master`.

---

**Chat timeout + Terminal CWD fixes (2026-04-29)**

- **Chat fetch timeout default raised to 10 min**:
  - `lib/config.js` `chatTimeoutSec` default 120 → 600.
  - `routes/chat.js:412` fallback `(config.chatTimeoutSec || 120)` → `|| 600`.
  - `lib/ollama-client.js` `chatComplete` and `chatStructured` `timeoutMs` defaults 120 000ms → 600 000ms (defense-in-depth — every current caller already passes an explicit timeout, so this only affects future callers).
  - `.cc-config.json.example` `chatTimeoutSec` 120 → 600.
  - Existing user configs continue to take precedence; new defaults only apply to fresh installs (Settings → Chat Timeout slider still scales 30s–600s).
  - Triage: log `POST /chat 200 300928ms` followed by `Ollama chatComplete failed (round 1) {"error":"fetch failed"}` against `qwen3-coder:30b` with ~10K-token context; the 5-min ceiling came from `chatTimeoutSec=300` plus the 600 000ms cap on the auto-bump path.

- **Terminal CWD now tracks the active File Browser folder** (previously always read `cfg.projectFolder` from disk):
  - `electron/main.js` `terminal-start` accepts an optional `requestedCwd` from the renderer, validates with `fs.statSync(p).isDirectory()`, falls back to `cfg.chatFolder` → `cfg.projectFolder` → `$HOME`.
  - `electron/preload.js` `terminal.start(cwd)` passes the path through IPC.
  - `src/components/TerminalPanel.jsx` accepts a `projectFolder` prop and includes it in the `useEffect` deps so changing the File Browser folder respawns the PTY at the new location.
  - `src/App.jsx` passes `projectFolder={chatFolder || projectFolder}` to `TerminalPanel` (matches what `FileBrowser` displays).
  - Server-side `lib/config.js` already constrains `chatFolder` to within `projectFolder` and resets it on `projectFolder` change, so no schema change needed.

- **Docs updated**: `CLAUDE.md` (Terminal Mode section + TERMINALFEATURE doc-index summary), `docs/TERMINALFEATURE.md` (How It Works step 3, Security table, Testing Checklist), `CHANGELOG.md` (Unreleased / Changed).

- **Notes for the next signed release**:
  - Source-side timeout fix means new installs default to 10-min chat budget without needing the Settings slider.
  - Terminal CWD change is renderer + main + preload — one PR's worth of scope.
  - During this session, the _installed_ `/Applications/Code Companion.app` was patched in-place to verify the timeout fix; that broke the bundle's notarized signature and the bundle had to be restored from `~/Library/Caches/code-companion-updater/pending/code-companion-1.6.16-arm64.zip`. Lesson: never edit a signed bundle's resources — apply the fix at source, ship a new release. The user is currently using the dev build (`npm run electron:dev`) until the next release ships.

---

**MCP per-tool enable/disable — complete and verified (2026-04-25)**

- **ToolsModal UX** (`src/components/McpClientPanel.jsx`):
  - `SERVICE_LABELS` map + `getGroup()` added at module level (handles Google Workspace verb_service_noun naming; includes plural keys: `calendars`, `tasks`, `contacts`, `forms`).
  - Flat 121-item list replaced with grouped collapsible sections by service.
  - Real-time search input (name + description); auto-expands collapsed groups while typing.
  - Group-level checkbox enables/disables all tools in a group atomically.
  - Modal widened `max-w-lg` → `max-w-2xl`.
  - `useGroups` flag: flat list for ≤10 tools, grouped for larger servers.
  - `enabledCount` computed from visible tool names (stale-name safe).
  - Enable all / Disable all footer unchanged; apply to full tools array.

- **Execution-time denial guard** (`lib/tool-call-handler.js`):
  - Guard inserted before `callTool`: checks `config.mcpClients[serverId].disabledTools`.
  - Returns `{ success: false, error: "...disabled in Settings → MCP Clients..." }`.
  - Logs WARN with `serverId` + `toolName` only.
  - 3 new unit tests; **225 total pass**.

- **Route hardening** (`lib/mcp-api-routes.js` + `lib/mcp-client-manager.js`):
  - `validateAndNormalizeConfig()` normalizes `disabledTools`: trims, de-dupes, type-checks.
  - `PUT /api/mcp/clients/:id` validates before disconnecting; `disabledTools`-only saves skip disconnect entirely.

- **Build + install**: Desktop app rebuilt and installed at `/Applications/Code Companion.app`. Production logs confirm `PUT /mcp/clients/google 200 0ms` (no reconnect on tool toggle); `toolsLength` reduced 30120 → 28417 confirming filtering works.

**Nano Banana reliability + image actions — complete and verified (2026-04-25)**

- **Timeout hardening** (`lib/tool-call-handler.js`):
  - Added per-image timeout support via `MCP_IMAGE_TOOL_TIMEOUT_MS` (default `180000`).
  - `generate_image` now uses `max(MCP_TOOL_TIMEOUT_MS, MCP_IMAGE_TOOL_TIMEOUT_MS)`.
  - Timeout errors are retry-classified with clearer user hints; structured logs include `timeoutMs`.
- **Assistant image UX restore** (`src/hooks/useChat.js`, `src/components/MessageBubble.jsx`):
  - Tool-generated images are now persisted on assistant messages via `images` metadata (not markdown-only rendering).
  - Restored inline **Copy** and **Download** buttons for generated images.
  - Lightbox behavior remains intact for click-to-open image viewing.
- **Verification**:
  - Unit tests for timeout behavior pass (`tests/unit/tool-call-handler.test.js`).
  - Installed desktop app rebuilt/reinstalled; production logs confirm successful `nano-banana.generate_image` calls with `partTypes: ["text","image"]`.

**Chat image-claim guardrail — complete and verified (2026-04-25)**

- **False-success claim filtering** (`src/lib/chat-image-claims.js`, `src/hooks/useChat.js`):
  - Assistant image-success text is sanitized unless a real `toolImage` payload is present on that response.
  - Prevents “Generated image…” / “image is displayed above” false positives when model text claims success without tool output.
- **Verification**:
  - Added focused unit tests (`tests/unit/use-chat-image-claim-guard.test.js`) with claim-removal + pass-through coverage.
  - Guard test passes locally (3/3).

</work_completed>

<work_remaining>

- **Cut next patch release** (e.g. tag after merging [Unreleased] CHANGELOG) so desktop users get `ChatSessionProgress` + any other pending [Unreleased] items via GitHub Releases / auto-update.
- **Optional:** Playwright assertion on `data-testid="chat-session-progress"` during mocked SSE.

</work_remaining>

<context>
**Current version:** 1.6.9
**App install:** `/Applications/Code Companion.app`
**Unit tests:** 225 pass (0 fail)
**MCP clients connected:** Archon (17), Google (121), crawl4ai-rag (5), Stitch (12), nano banana (4)

**Model note:** `qwen3-coder:30b` does not reliably emit `TOOL_CALL` format for complex Google MCP flows — use `bazobehram/qwen3-14b-claude-4.5-opus-high-reasoning` or similar for Google Workspace agentic tasks.

**Archon project ID:** `2c1b9ed7-1ebd-4cac-85a7-275942ae136d`
**MCPFIX Archon task:** `4b7ca017-8205-471b-a025-64b7df8c66d9` (done)
</context>
