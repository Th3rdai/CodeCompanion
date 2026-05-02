<original_task>
Implement MCP per-tool enable/disable controls (MCPFIX) for Code Companion v1.6.9.
</original_task>

<work_completed>

**Post-v1.6.33 cleanup + smoke (2026-05-02 evening)**

Day-after follow-ups to the v1.6.24 → v1.6.33 ship cycle. Master is **7 commits ahead of v1.6.33** (5 mine, 2 Cursor's); will bundle into **v1.6.34** when cut. Full per-commit table + smoke results in `journal/2026-05-02.md`.

- **`50d0d00` — MCP error-handler ReferenceError fix**: `logMcpConnectFailure()` was declared at module top-level in `lib/mcp-api-routes.js` but referenced the closure variable `log`. Every call threw a silent `ReferenceError`, which Express converted to a generic 500 with no message. Manual-connect failures looked like "undefined" to the user. Moved the helper inside `createMcpApiRoutes(...)` so `log` is in scope. Real transport errors (e.g. `connect ECONNREFUSED 192.168.50.7:8051`) now surface in both the banner and `app.log`. Worth a future scan for similar shapes — top-level helpers referencing closure vars compile fine and only fail at runtime when the error path runs.
- **`4f07c69` — Archon auto-connect noise downgrade**: ERROR → WARN with hint `(hint: set "autoConnect": false in .cc-config.json#mcpClients to skip on next startup)`. Was paging on every cold start while Archon's API service is degraded.
- **`cc2c247` — `useChat` legacy `experimentId` fallback**: v1.6.24 migrated `experimentId` → `experimentIds[]` on writes but the read-side in `loadConversation()` only checked the plural field. Existing experiment-mode chats showed empty `LinkedExperimentChips` rows. Now reads `Array.isArray(conv.experimentIds) ? conv.experimentIds : (conv.experimentId ? [conv.experimentId] : [])`.
- **`87401cf` — experiment ↔ conversation back-pointer**: New `POST /api/experiment/:id/link-conversation` endpoint + `ExperimentPanel` call after `saveHistory(...)` returns the chat id. Closes the order-of-operations gap where the experiment was created before the chat existed, leaving `conversationId: null` on the experiment record (chip-restore lost chat context). Idempotent; fire-and-forget on failure.
- **`08728bb` — prettier + .gitignore cleanup**: Format-fixed four files Cursor committed unformatted (`CLAUDE.md`, `docs/CRAWL4AI-RAG-MCP.md`, `lib/resolve-mcp-test-config-root.js`, `scripts/test-mcp-clients.js`); added `e2e-screenshots/` + `e2e-test-report.md` to `.gitignore` so Playwright artifacts stop polluting the tree.
- **Cursor: `c60e3c3` + `0d73e3f`** — Crawl4AI prefer-over-Playwright prompt; MCP smoke-test config resolution + Crawl4AI docs + Settings log hints.

**Smoke test against installed app v1.6.33** (4 parallel sub-agents against `http://127.0.0.1:8910`):

- **A — Experiment lifecycle**: PASS 9/9. Duplicate-start 409, trust boundary (server ignored client-supplied `done:true`/`decision:keep` and used parser output `done:false`/`decision:iterate`), abort, migration shim — all working.
- **B — Review/Score/Pentest**: PASS 5/5. Review grade A in 13.7s, Pentest grade F in 24s; both returned structured JSON, no SSE fallback. Error envelopes match v1.6.33 wording.
- **C — History → experimentIds chip**: PARTIAL → drove the two fixes above. Endpoint plumbing correct (`?include=experiments` hydrates), but 0 of 29 conversations had `experimentIds` populated; both experiment-mode chats used the legacy singular field. Surfaced `cc2c247` + `87401cf`.
- **D — `app.log` scan**: CLEAN. 0 real code issues in 11 ERROR+WARN lines (all known/expected/external). 36 tool-call rounds. Duplicate-experiment guard fired once (working as designed).

**Archon status (blocking task-sync)**: Connection to `http://192.168.50.7:8051/mcp` works (handshake + tool list), but `health_check` returns `{"status":"degraded","api_service":false,"agents_service":false}` and `find_projects` returns `connection_error`. Task management via Archon MCP is unavailable until the upstream service is back; doc updates captured locally in `journal/2026-05-02.md` + `journal/README.md` + `.planning/STATE.md` + this file. Re-sync to Archon when the API service recovers.

**End-of-day verification**: `validate:fast` clean (lint + typecheck + format + vite + 403 unit + 8 integration + smoke); working tree empty before this commit; installed app v1.6.33 (auto-updater will offer v1.6.34 once tagged).

**Lessons worth keeping**:

- **Smoke-test sub-agents in parallel** worked well. Four endpoint domains × four sub-agents × ~1 min each, vs. ~4 min sequential. Each report was concise enough to surface real findings (the singular-`experimentId` legacy schema would not have been obvious from code review alone).
- **Error-handler bugs are silent** because the error path itself rarely runs in tests. The `logMcpConnectFailure` ReferenceError lurked for at least a few releases, only surfacing when MCP servers actually failed and the user clicked Connect. Worth scanning for similar shapes: top-level functions in modules that reference closure variables.
- **Schema migrations on read are cheap insurance.** v1.6.24's `_migrate()` shim covered the experiment record migration but the corresponding `experimentId` → `experimentIds` migration on the chat-history side was missed. Pattern to consider when shipping schema changes: add a read-side fallback for at least one prior shape on top of the write-side migration.

---

**Experiment redesign + AGENTSKILL Phase 1 + cleanup sweep — v1.6.24 → v1.6.33 (2026-05-01 → 2026-05-02)**

Nine tagged releases shipped in one day. CI workflow finally went green on **v1.6.33** after 9 consecutive red runs (the cause was a `tests/unit/review-files.test.js` fetch-after-test-end leak). Full per-release breakdown in `journal/2026-05-01.md`. Headline deliverables:

- **Experiment Mode form-and-report UX (v1.6.24)** — hard switch from chat-bubble to phase machine (`input → running → report → deep-dive`). New `ExperimentInputForm` (hypothesis + scope + metric + budgets), `ExperimentReport` (status badge, metric callout, sparkline, scope-adherence, denials, step timeline), `ExperimentStepCard`, fresh `DeepDivePanel`. Server-side: `lib/experiment-schema.js` (Zod), `lib/experiment-step-parser.js` (server-only parser; trust boundary on `note-step`), `enforceExperimentScope` with realpath/symlink defense, `_activeExperimentByProject` in-process registry, `finalizeExperiment` with first-arrival-wins status precedence, `sweepStaleActiveExperiments` startup hook, `GET /api/experiment` paginated list, `POST /experiment/:id/abort`, `lib/history.js#experimentIds` link, `_migrate(record)` shim. Plan: `~/.claude/plans/experiment-mode-redesign.md` (two plan-reviewer passes folded in).
- **Iterative dogfood fixes (v1.6.25–v1.6.32)** — eight bugs caught on real runs against TradingAgents, each a 5–15 min fix shipped as its own tag. Highlights: progress strip on the running phase; tab-switch recovery (Resume button when remounting into an active run); Mark complete button; bullet-`Done` parser fix; comma-separated scope chips; non-zero exit "undefined error" hallucination fix (`runTerminalCmd` now returns `success:true` for non-zero exits + system-prompt extension); MiniMax bare-tool-call format parser; misleading "model may need to be larger" copy on builder score; restore-from-server effect for tab-switch survival.
- **Global `ChatSessionProgress` (v1.6.26, parallel Cursor work)** — indeterminate "Working" bar wired across chat / builders / Review / Security / Experiment / Build / DeepDivePanel. `[Unreleased]` CHANGELOG entry covers the wiring sites.
- **AGENTSKILL Phase 0/0.5/1 (Cursor in parallel + my gap-fill)** — `agentAppSkills` config gates with master + 3 family flags (default off); Settings UI toggles; `chatStructured` abort fix (was dropping `abortSignal`); four agent builtins (`review_run`, `pentest_scan`, `pentest_scan_folder`, `builder_score`) with pinned §5.0.1 success / §5.0.2 error envelopes (`lib/agent-app-skill-envelope.js`); `[SKILL_AUDIT]` audit log prefix in `app.log`. **My gap-fill**: extracted `lib/pentest-service.js` + `lib/score-service.js` so routes and agent skills both call the same service (matches Review's pre-existing `lib/review-service.js` pattern); created user-facing `docs/AGENT-SKILLS.md`. Plan: `AGENTSKILL.md` (three plan-reviewer passes; envelope contracts pinned in §5.0.1/5.0.2).
- **v1.6.33 cleanup sweep** — three deferred items in one release: review-files CI flake fixed; `LinkedExperimentChips` surfaces linked experiments above the chat panel (closes the v1.6.24 history-link feature loop); `ReviewPanel.jsx` full-page deep-dive delegates to shared `DeepDivePanel` (-107 lines, 1905 → 1798). Plan: `~/.claude/plans/cleanup-three-items.md` (plan-reviewer Major fixes folded: `restoreExperimentId` lifecycle, `connected` prop wiring, listing-endpoint bypass).
- **`npm run validate:fast` script** — chains lint + typecheck + format + vite + unit + integration + smoke for routine pre-rebuild gate. Documented in CLAUDE.md follow-up.
- **`.gitignore` / `.prettierignore`** — added `experiments/`, `history/`, `memory/`, `logs/`, `e2e-test-report.md` so dev-mode artifacts don't pollute the repo or fail format-check.

**Verification at the end of the day**: 403 unit tests, 8 integration tests, 36 UI Playwright, 23 E2E Playwright, vite build green, server smoke PASS, **CI workflow green on v1.6.33**.

---

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
**Current version:** 1.6.25 (`package.json`; [Unreleased] in `CHANGELOG.md` until the next tagged release)
**App install:** `/Applications/Code Companion.app` (packaged) or `npm run electron:dev` from repo
**Unit tests:** 388 pass (0 fail) — `npm run test:unit` (2026-05-01)
**MCP clients:** Whatever is configured under Settings → MCP Clients (`mcpClients` in `.cc-config.json`); tool counts vary by server and version — do not treat old per-server counts here as canonical.

**Model note:** `qwen3-coder:30b` does not reliably emit `TOOL_CALL` format for complex Google MCP flows — use `bazobehram/qwen3-14b-claude-4.5-opus-high-reasoning` or similar for Google Workspace agentic tasks.

**Archon project ID:** `2c1b9ed7-1ebd-4cac-85a7-275942ae136d`
**MCPFIX Archon task:** `4b7ca017-8205-471b-a025-64b7df8c66d9` (done)
</context>
