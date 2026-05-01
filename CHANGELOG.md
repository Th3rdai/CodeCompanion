# Changelog

All notable changes to Code Companion will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [1.6.32] — 2026-05-01

### Fixed

- **MiniMax tool calls now execute even without the `<invoke>` wrapper.** Reported in dogfood with `minimax-m2:cloud`: the model emitted a `<minimax:tool_call>` block with the server.tool name on its own line and the JSON args on the next, plus a stray trailing `}` before the closing tag — no `<invoke name="…">` wrapper. The parser found 0 tool calls and the install never ran. Added a fallback in `lib/tool-call-handler.js#parseToolCalls`: when a `<minimax:tool_call>` block has no `<invoke>` tag, treat the first line matching `server.tool` as the call header, walk a brace-balanced JSON object as args, and ignore trailing junk before the closing tag. Regression test in `tests/unit/tool-call-handler.test.js`.

## [1.6.31] — 2026-05-01

### Fixed

- **Stop hallucinating "Command failed with 'undefined' error" on non-zero exits.** Reported in dogfood: model ran `python3 -m pytest --collect-only tests/`, pytest exited 2 with 6KB of real `ImportError` output, model summarized as "Command failed with 'undefined' error" — discarding the actual diagnostic info. Two interacting bugs:
  - **`runTerminalCmd` returned `success: false` on any non-zero exit** (`lib/builtin-agent-tools.js`). The chat handler then prefixed the model's tool-result message with `Tool builtin.run_terminal_cmd **failed**: …` instead of `**returned**: …`. qwen3-32k saw "failed" + non-zero code and fell into its generic-error template without reading the body. Fix: `success: true` whenever the tool actually executed (even with non-zero exit). Reserve `success: false` for genuine tool failures (timeout/killed). Pytest exit 2, ruff exit 1, grep exit 1 — all useful diagnostic outputs the model now reads as data, not as "the tool broke".
  - **The "never report 'undefined error'" instruction** (`BUILTIN_SAFETY_PREAMBLE_TERMINAL`) was scoped to **deny** responses only. Extended to cover non-zero exits explicitly: "**Non-zero exit codes are NOT undefined errors:** pytest exits 2 on collection errors, ruff exits 1 on lint findings, grep exits 1 when nothing matches. The tool result includes the real stdout/stderr below the Exit-code line — read those errors and describe them specifically (e.g. 'pytest exited 2 with 6 ImportError messages: …')."

## [1.6.30] — 2026-05-01

### Fixed

- **Mark complete actually finalizes the run now.** Reported in dogfood: clicking the **✓ Mark complete** button (added v1.6.29) didn't transition the experiment to `completed` — status stayed `active`, panel kept polling, user spammed the button (8 rapid clicks captured in `app.log` at 22:00:08–14). Root cause in `lib/experiment-step-parser.js#parseStepSummary`: the Done-detection regex accepted `**Done**` standalone or after `|` (the inline `Next: … | **Done**` shape), but **not** with a bullet prefix — `- **Done**` or `* **Done**` didn't match. Both the prompt's example block and the Mark complete synthetic text use the bulleted form, so the parser always returned `done: false`, the server never called `finalizeExperiment`, and the run sat active forever. Fix: regex now accepts an optional `[-*•]\s*` bullet prefix on the Done line. Added 4 regression test cases (`tests/unit/experiment-step-parser.test.js`) covering `- **Done**`, `* **Done**`, `• Done`, and the canonical bulleted Step summary form.
- **Mark complete is now a no-op when the run is already terminal.** Defensive guard against the rapid-click spam pattern: `handleMarkComplete` early-returns if `experiment.status` is in `TERMINAL_STATUSES` (`completed`, `aborted`, `failed`, `timeout`). Even with the regex fix, this prevents extra `/note-step` round-trips when the user clicks twice before the next 2.5s poll has updated `experiment.status`.
- **Comma- and space-separated scope chips** in the Experiment input form (`src/components/ExperimentInputForm.jsx`). Both Paths and Commands inputs now split on commas, newlines, or whitespace when you press Enter or click +Path / +Command — paste `python3, pip3, uv, uvx, pytest` and get 5 chips at once instead of one giant useless string. Placeholders updated to advertise: `binary names (e.g. python3, pip3, uv, pytest — comma or space separated)`.

## [1.6.29] — 2026-05-01

### Fixed

- **Experiment running phase: missing follow-up input.** Reported in dogfood: model produced one step and the panel had no way to drive the next round — only Abort. Regression from the v1.6.24 chat-bubble → phase-machine rewrite (the old UX had a "Run step" textarea + button at the bottom; the rewrite dropped it). Restored: a textarea + **Run step** button at the bottom of the running phase. Enter sends; Shift+Enter for newlines (matches chat-mode muscle memory).
- **Experiment never auto-finalizes when the model writes `Decision: keep` without `**Done**`.** The server only finalizes on a parsed `done: true` marker, so a model that says "I'm satisfied with my work" via `Decision: keep` but forgets the explicit `**Done**` tag leaves the run stuck `active` until budget timeout. Added a **✓ Mark complete** button in the running phase that POSTs a synthetic `### Step summary\n- **Done**` to `/note-step`, which routes through `finalizeExperiment` with `status: "completed"` and pulls the latest numeric metric value as `finalMetricValue`. Auto-transitions to the report card on the next poll.

## [1.6.28] — 2026-05-01

### Fixed

- **Builder score: stop telling 1T-parameter cloud models they need to be larger.** Reported in dogfood: scoring a Planner doc against `minimax-m2:cloud` returned "Could not parse score response. The model may need to be larger." — actively misleading for a 1T model. Root cause: `routes/score.js` falls back to `chat-fallback` when the structured (Zod-validated) call fails (cloud models often don't honor Ollama's `format` constraint), then SSE-streams prose. The client at `src/components/builders/BaseBuilderPanel.jsx` ignored the server's `{fallback: true, reason}` event entirely and just tried `JSON.parse(accumulated)` on prose, then surfaced the size copy. Three changes:
  - **Surface the actual reason.** Client now captures `parsed.fallback` / `parsed.reason` from the SSE stream and shows `<model> didn't return a structured score (server: <reason>). Try Auto model or pick one known to honor JSON output.` instead of the size copy.
  - **Salvage useful prose.** When parsing fails, accumulated text is kept and rendered under a `<details>` "Show what the model returned" expander so the user can read what the model actually said.
  - **Tolerant JSON extraction.** Before giving up, the client tries to find ` ```json ... ``` ` fenced blocks and the largest `{...}` substring inside the prose — recovers a score-card when the model emitted valid JSON wrapped in markdown.
  - **Server-side log line** (`routes/score.js`) — `Score fallback to chat (structured output failed) {model, mode, reason}` so future debugging skips the log archaeology.

## [1.6.27] — 2026-05-01

### Fixed

- **Switching tabs no longer wipes an active Experiment.** Reported in dogfood: a long Experiment session was lost when the user clicked away to another mode and back. Root cause: switching modes unmounts `ExperimentPanel` (`src/App.jsx` conditionally renders it), so all local state — `phase`, `experiment`, `messages`, `convId` — was gone on remount and the panel reset to the empty input form even though the run was still active server-side. Fix: on mount, `ExperimentPanel` now calls `GET /api/experiment?projectFolder=…&limit=1`; if the latest record is still `active` (or terminal but updated within the last hour), it rehydrates the experiment record and pulls the linked chat history via `GET /api/history/<conversationId>` so the message thread comes back. While restored-but-not-streaming, a yellow banner explains "This run was paused when you switched tabs" with a green **Resume** button (sends a short nudge message to continue the conversation) alongside the existing **Abort**. Older terminal records aren't auto-loaded — those are reached via history navigation.

## [1.6.26] — 2026-05-01

### Added

- **Global session progress strip (`ChatSessionProgress`)** — Indeterminate “Working” bar with mode-specific subtitle, `aria-busy` / `aria-live`, and `prefers-reduced-motion` handling (`src/components/ui/ChatSessionProgress.jsx`, `src/index.css` `.cc-chat-progress-*`). Wired wherever the user waits on the model: **main chat** under the mode tab bar when `streaming` (`src/App.jsx`); **builders** scoring + revise (`src/components/builders/BaseBuilderPanel.jsx`); **Review** loading, report inline chat, fallback SSE, deep dive (`src/components/ReviewPanel.jsx`); **Security** loading, remediation, fallback SSE + follow-up, deep dive (`src/components/SecurityPanel.jsx`); **Experiment** running step (`src/components/ExperimentPanel.jsx`); **shared `DeepDivePanel`**; **Build simple** research/plan + What’s Next loading (`src/components/BuildSimpleView.jsx`). Per-surface `data-testid` values avoid collisions (`chat-session-progress`, `builder-session-progress`, `review-session-progress`, etc.). See **`docs/SESSION-PROGRESS.md`**.

## [1.6.25] — 2026-05-01

### Added

- **Live progress indicator on the Experiment running phase** (`src/components/ExperimentPanel.jsx`) — the v1.6.24 running phase showed a blank screen until the first token streamed (which on a cold local 30B model can take 30–60s). New `RunningProgress` strip drives off the SSE events `lib/chat-post-handler.js` already emits: a phase pill (Thinking / Tool / Streaming / Wrapping up), a "Round N of max" counter (from `toolCallRound`), an elapsed mm:ss timer (tabular-nums so the layout doesn't jitter), and a one-line activity label ("Waiting for <model> to start…", "Running: pytest -q", "Terminal command finished — analyzing output…", "Streaming response…", round-limit notices). Includes a 1px progress bar tinted to match phase, an emerald "still alive" dot on the header, `aria-live="polite"` + proper `progressbar` role, and `motion-safe` / `motion-reduce` variants for `prefers-reduced-motion`. Zero backend change.

## [1.6.24] — 2026-05-01

### Added

- **Experiment mode now feels like a deliverable, not a chat that trails off.** Hard switch from the chat-bubble-only UX to a Review-style phase machine: `input → running → report → deep-dive`. The new **input form** (`src/components/ExperimentInputForm.jsx`) captures hypothesis, scope (paths + commands chips, server-enforced — see below), an optional success metric (name + comparison + target + unit), tool-round budget, and a budget-in-seconds slider; ⌘/Ctrl+Enter still starts. The **report card** (`src/components/ExperimentReport.jsx`) shows status badge, final-metric vs target callout (green when met, red when not), inline-SVG sparkline (no recharts dep) when there are ≥2 numeric measurements, scope-adherence badges, expandable denials block, and a step-card timeline (3 most-recent visible, "Show all N" toggle). Each step card (`src/components/ExperimentStepCard.jsx`) parses the model's `Did/Observed/Next/Done` block server-side and renders structured rows with a decision pill (`keep`/`iterate`/`discard`); raw summary, denials, and metric value are in an expandable section. **Ask about this step…** and **Ask about the outcome…** open a deep-dive sub-thread (`src/components/DeepDivePanel.jsx`) anchored on that context; **Back to report** returns. Abort button is rendered only during the running phase.
- **Server-enforced experiment scope.** `scope.paths` and `scope.commands` are no longer display fields — they are checked on every `write_file` and `run_terminal_cmd` call when `mode === "experiment"`. `lib/builtin-agent-tools.js#enforceExperimentScope` resolves both sides through `realpath` (defends against symlink escape) and rejects with the canonical `Command denied: …\nACTION: …` payload that v1.6.21 already taught the agent to handle. Wired through `lib/chat-post-handler.js` (looks up the active experiment via the new `_activeExperimentByProject` registry in `lib/experiment-store.js`) into `lib/tool-call-handler.js#executeTool`. Tests: `tests/unit/experiment-scope-enforcement.test.js` (path/command rejection, symlink defense, ACTION-line presence).
- **Experiment record schema + server-side parser.** `lib/experiment-schema.js` (Zod) defines `ScopeSchema`, `MetricSpecSchema`, `ExperimentRecordSchema`. `lib/experiment-step-parser.js` is the **only** code that reads raw model output: it extracts `did/observed/next/done` from the markdown block, a fenced ` ```metric {"value": N} ``` ` JSON block, and `Command denied: … ACTION: …` denial events; `inferDecision()` maps the result to `keep`/`iterate`/`discard` (explicit `**Decision:**` line wins). 23 parser tests in `tests/unit/experiment-step-parser.test.js`.
- **Duplicate-start guard with 409 response.** Starting a second experiment on the same `projectFolder` while one is active now returns `409 {error: "experiment_already_running", existingId}`; the input form surfaces a "Resume the active run →" link instead of failing silently. Backed by the new in-process `_activeExperimentByProject` registry, populated by `createExperiment` and cleared by `finalizeExperiment`.
- **Status precedence with single source of truth.** `finalizeExperiment(id, {status, ...})` is now the only path to terminal state; the first arrival wins (`note-step` parsing `done: true` → `completed`; `POST /experiment/:id/abort` → `aborted`; budget exceeded → `timeout`). Subsequent calls become no-ops returning the existing record.
- **Startup sweep for orphaned active runs.** `sweepStaleActiveExperiments(now)` runs after `initExperimentStore(dataRoot)` in `server.js`; flips any `status: "active"` record past its budget to `timeout`, otherwise restores the in-memory registry so the tool-handler can find the active scope after an Electron restart.
- **`GET /api/experiment` paginated list endpoint** — most-recent-first, optional `?projectFolder=` filter, `?cursor=` pagination by `updatedAt`. Replaces the previous `listExperiments(limit)` positional API with `listExperiments({projectFolder, limit, cursor})`.
- **`POST /api/experiment/:id/abort`** — explicit user-driven termination; sets `status: "aborted"`, persists `abortReason: "user"`, clears the registry entry.
- **History ↔ experiment link.** `lib/history.js` accepts `experimentIds: string[]` on a chat record (validated, capped at 32). `routes/history.js` `GET /api/history/:id?include=experiments` hydrates the linked experiments inline.
- **Migration shim** (`lib/experiment-store.js#_migrate`) — fills in `scope`, `metric`, `denials`, `messageCountAtStart`, `finalMetricValue`, `promptHash`, and step-level structured fields on legacy v1.6.22 records. **Never widens capability**: missing `scope` defaults to `{paths: [projectFolder], commands: [...config.agentTerminal.allowlist]}`. Tests: `tests/unit/experiment-store-migration.test.js` covers `active`, `timeout`, no-`status` fixtures.
- **Trust boundary on `note-step`.** Body is now `{rawAssistantText: string}` strict-mode; the server is the **sole parser**. Any client-supplied `did/observed/next/done/decision/metric/denials` fields are ignored. Prevents a malicious or buggy client from forging `done: true` to flip status, or under-reporting denials. Old `summary` field accepted for one release with a deprecation log line. Idempotent on retry: replaying the same `rawAssistantText` overwrites the last step rather than appending, so a dropped SSE connection doesn't double-count denials.
- **`promptHash`** (sha256 of hypothesis + scope + metric) persisted on `/start` for repro-detection across runs.
- **Shared report-card tokens** (`src/components/report-card-tokens.js`) — `GRADE_COLORS`, `SEVERITY_COLORS`, `STATUS_COLORS`, `DECISION_COLORS`. `ReportCard.jsx` now imports from this module so Review and Experiment palettes stay in sync.

### Changed

- **`SYSTEM_PROMPTS.experiment`** (`lib/prompts.js`) — Step summary block now permits an optional `**Decision:** keep|iterate|discard` line and a fenced ` ```metric {"value": N} ``` ` block. **Done** marker is required on the final turn. New one-liner reminds the model that scope is server-enforced and the `ACTION:` line should be followed rather than retrying the same denied shape.
- **Toolbar Rounds selector now shows in Experiment mode** (`src/App.jsx`) — was chat-only. ExperimentPanel already used `agentMaxRounds` as a per-step cap (`Math.min(experiment.maxRounds, agentMaxRounds, ...)`), so the control belongs alongside Chat's.
- **`npm run validate:fast`** alias chains lint + typecheck + format + vite build + unit + integration + server smoke for a routine pre-rebuild gate.
- **Runtime data dirs ignored** — `.gitignore` and `.prettierignore` now exclude `experiments/` (and `history/` / `memory/` / `logs/` for prettier) so dev-mode artifacts don't pollute the repo.

## [1.6.23] — 2026-05-01

### Changed

- **Experiment mode is now a primary tab** (`src/App.jsx`) — promoted from `MORE_MENU_GROUPS → Analyze` to `PRIMARY_MODE_IDS`, so it appears next to **Chat / Review / Security / Build / Create / Diagram** in the main mode strip. Several users (verified via `~/Library/Application Support/code-companion/logs/app.log`) opened v1.6.22, enabled the feature flag in Settings, then never found the panel — they kept pasting their experiment prompts into Chat mode. Three rounds of "I switched to Experiment but it stays stuck" turned out to be "the run never started because nobody clicked More → Analyze → Experiment." Fixing discoverability now rather than waiting for usage data.
- **Settings copy** (`src/components/SettingsPanel.jsx`) — replaced the misleading `(off by default)` parenthetical (it actually ships **on**) with a one-line pointer telling users where to find the panel.

### Added

- **`⌘/Ctrl + Enter` from the Hypothesis textarea starts the experiment** (`src/components/ExperimentPanel.jsx`) — matches chat-mode keyboard muscle memory. Plain `Enter` still inserts newlines so multi-paragraph hypotheses still work. Label updated to surface the shortcut.

## [1.6.22] — 2026-04-30

### Added

- **Experiment mode** — New **Experiment** app mode (under **More → Analyze**) for bounded hypothesis → change → measure loops: `POST /api/experiment/start`, `POST /api/experiment/:id/step` (SSE, reuses `lib/chat-post-handler.js` with `mode: "experiment"`), `GET /api/experiment/:id`, `GET /api/experiment/:id/events`, `POST /api/experiment/:id/note-step`. Runs are stored under **`${CC_DATA_DIR}/experiments/`** (`lib/experiment-store.js`). **Settings → General** toggles **`experimentMode.enabled`** (default **on**) and caps **`maxRounds` / `maxDurationSec`**. Chat tool policy: when `mode === "experiment"`, MCP tools are hidden/blocked and only builtins `write_file`, `run_terminal_cmd`, `validate_scan_project`, `validate_generate_command`, `view_pdf_pages` execute (`lib/tool-call-handler.js`). **`SYSTEM_PROMPTS.experiment`** in `lib/prompts.js`. Auto-model map includes **`experiment`**. Tests: `tests/unit/experiment-store.test.js`, `tests/unit/prompts-experiment.test.js`, `tests/unit/tool-call-handler-experiment.test.js`, `tests/integration/experiment-api.test.js`, `tests/e2e/experiment-mode.spec.js`.

## [1.6.21] — 2026-04-30

### Fixed

- **Auto-update no longer stuck in "Restart to apply" loop on signature mismatch** — When the auto-updater downloaded a new release whose code-signature designated requirement didn't match the running app's, Squirrel.Mac silently failed to swap the bundle and the app relaunched on the OLD version. The renderer kept showing "Restart to apply" because `lastDownloadedInfo` was never cleared and the same version was found again on next check, looping indefinitely. Three pieces now break the loop: (1) `electron/updater.js` persists `dataDir/.update-attempt.json` before `quitAndInstall()`; on the next launch, if the running version still differs from the recorded target, the loop guard suppresses the restart prompt for that version; (2) the `error` event now traps Squirrel's "code signature ... did not pass validation" / "code requirement(s)" strings via a new `isCodeSignatureError` helper and forwards an `update-error` IPC event with `{ kind: "code-signature", targetVersion, runningVersion, message }`; (3) `SettingsPanel` subscribes to `update-error` and renders the existing `error` state with a clear "install manually from GitHub Releases" message. 10 new unit tests cover the helpers.
- **Agent terminal denials now carry an actionable `ACTION:` line** — Previously the model received `Command denied: <reason>` and often summarized to the user as "undefined error" or kept retrying the same denied shape. `validateCommand` now also returns an `action` string per deny path; the deny payload to the model becomes `Command denied: <reason>\nACTION: <next step>`. Allowlist miss → `Tell the user verbatim "Add 'X' to Settings → Agent Terminal → Allowlist"`. Metacharacter hit → `run_terminal_cmd executes a single binary via spawn() — there is NO shell. Re-run as a single binary; pass cwd as a tool arg`. Blocklist hit → `security policy ... do not retry`. Plus terminal-disabled / no-project-folder / empty-allowlist actions.
- **Agent terminal `&&` and `||` chaining now denied consistently with `;`, `|`, redirects** — `METACHAR_PATTERN` extended to include `&&` and `||`. Previously these slipped past the metacharacter guard, letting `cd path && cmd` partially execute (spawning `cd` with confusing args) while `cmd1; cmd2` and `cmd | grep` were properly denied. Now any shell-feature chaining is denied uniformly with the same actionable hint to use the `cwd` tool argument instead of `cd path && ...`.
- **Agent prompt: never report "undefined" / "unknown" terminal errors** — `BUILTIN_SAFETY_PREAMBLE_TERMINAL` extended with explicit "NEVER report 'undefined error' / 'unknown error' / 'the terminal failed' to the user — every deny starts with literal `Command denied:` followed by the exact reason. Quote it. If allowlist miss, name the command to add."

## [1.6.20] — 2026-04-30

### Fixed

- **Chat now explains when it stops at the tool-call round limit** — Previously, if the agent exhausted its `agentMaxRounds` budget without producing a final reply (often because the model burned rounds on denied compound shell commands like `cmd | grep`, `a && b`), the finalizer summarized from accumulated tool results into a short, unexplained message. From the user side, the chat just stopped. Now: (1) when the loop exits without final text the route sends a new `notice: { kind: "round_limit", rounds, message }` SSE event, (2) `useChat` renders it as a visible `> ⚠️ ...` blockquote above the partial answer, (3) the finalizer prompt is told to lead with one sentence acknowledging the limit hit and to name a couple of denied calls if any. Default `agentMaxRounds` raised 10 → 15 for headroom (UI slider still ranges to the server's 25 cap).

## [1.6.19] — 2026-04-29

### Fixed

- **File Browser `+AI` quick-attach silently failed for files outside `chatFolder`** — Clicking the per-row `+AI` button (or the "Attach to Chat" preview button) appeared to do nothing when the FileBrowser was navigated to a folder different from your saved `chatFolder` (e.g. `chatFolder` is a Google Drive sync folder but you're browsing a project folder). Three issues combined: (1) `/api/files/read` defaulted its `folder` query to `cfg.chatFolder` when the param was omitted, so reads of files under `cfg.projectFolder` returned 403 "Access denied"; (2) `handleQuickAttach` and `handleFileClick` never sent `folder=tree.root` even though the FileBrowser knows which folder it's displaying; (3) `catch {}` wrapped the fetches and there was no `res.ok` check, so the 403 was silently dropped — no toast, no console error, click looked like a no-op. Now: (1) the FileBrowser sends `folder=tree.root` for `read`, `read-raw`, and convertible-document attach paths; (2) errors are surfaced via `onToast` (`"Access denied"`, `"File not found"`, `"Could not reach server"`); (3) `routes/files.js` adds `cfg.chatFolder` to the explicit-folder allowlist alongside `cfg.projectFolder` and the repo root. Path-traversal protection is unchanged.

## [1.6.18] — 2026-04-29

### Fixed

- **File Browser per-row `+AI` attach button always visible** — The button used `opacity-0 group-hover:opacity-100`, leaving it invisible until you hovered the specific row, with no visual cue that hovering would reveal it. Several users reported the button as "gone." Now `opacity-70 group-hover:opacity-100` so it's always visible and brightens on hover. No behavior change to the click handler — just discoverability.

## [1.6.17] — 2026-04-29

### Changed

- **Chat fetch timeout default raised to 10 min** — `chatTimeoutSec` default in `lib/config.js` and the fallback in `routes/chat.js` raised from 120s → 600s; `chatComplete` and `chatStructured` defaults in `lib/ollama-client.js` raised from 120 000ms → 600 000ms; `.cc-config.json.example` updated to match. Existing user configs still take precedence — only fresh installs see the new default. Fixes the 5-minute `fetch failed` hang seen with large local models (e.g. `qwen3-coder:30b`) under big contexts and tool-call rounds.
- **Terminal CWD follows the active File Browser folder** — When opening Terminal mode, the renderer now passes its current folder (`chatFolder || projectFolder`) into `terminal-start`. The main process validates the path is an existing directory before honoring it; falls back to `cfg.chatFolder` → `cfg.projectFolder` → `$HOME`. Changing the File Browser folder respawns the PTY at the new location. Previously the terminal always read `cfg.projectFolder` from disk and ignored in-app navigation.
- **Build mode `next-action` honors `chatTimeoutSec`** — `routes/build.js` was hardcoding a 30-second timeout on its `chatComplete` call. Local models on CPU/MPS routinely round-tripped past that, surfacing as `next-action failed: This operation was aborted`. Now uses `(config.chatTimeoutSec || 600) * 1000` so the Build flow inherits the same long-form budget the chat path uses.
- **Agent terminal preamble (`BUILTIN_SAFETY_PREAMBLE_TERMINAL`)** — Strengthened with explicit "single binary via spawn — no shell" guidance, "stop after two same-shape denials" rule, macOS/Linux Python guidance (`python3`/`pip3` over `python`/`pip`; multi-statement Python via `write_file` + run, not `python -c`), and instructions to install Python deps before retrying scripts that fail with `ImportError`.

### Fixed

- **Agent terminal blocklist false positive on substring match** — `validateCommand` was using `fullCmd.toLowerCase().includes(blocked)` for blocklist matching. With the default blocklist `["sudo","su","rm -rf","chmod 777","mkfs","dd"]`, this wrongly blocked benign commands like `python3 -c "import sys; print('Import successful')"` because the literal string `"successful"` contains `"su"` as a substring. Switched to a word-boundary regex (`commandContainsBlockedToken`): blocklist tokens only match at start/end of the command line or surrounded by whitespace. Genuine threats (`sudo apt`, `rm -rf /tmp`, `dd if=/dev/zero`) still block; false positives (`successful`, `pseudo`, `add`, `mkdir`, paths containing `Users`) no longer do. 7 new unit tests cover the regression.

- **Sidebar `Invalid Date` history rows** — Conversation timestamps are now normalized end-to-end: `createdAt` is validated in `useChat` before save, malformed history rows are auto-repaired in `lib/history.js`, and sidebar rendering now has a safe date fallback.
- **Playwright/browser tool-call deflection** — Strengthened agent tool prompt + chat capability lead-ins so browser automation requests use MCP `browser_*` tools directly instead of returning advisory “I can’t run this here” responses.
- **Browser-vs-terminal tool precedence** — Added explicit AGENT BROWSER guidance when both terminal and browser tools are available so website navigation/snapshot tasks prefer Playwright tools over terminal-script suggestions.
- **Server-side browser refusal fallback** — Chat tool loop now detects browser-execution refusal patterns (when browser tools are available), injects a corrective instruction, and retries once to recover into actual `TOOL_CALL` execution.
- **Snapshot-call consistency for browser automation** — When the user explicitly asks for a snapshot/screenshot and the model emits browser actions without `browser_snapshot`, the chat route now appends a snapshot call before execution so navigate+snapshot behavior is consistent.
- **Minimax parameter-style tool-call parsing** — Tool-call handler now parses `<minimax:tool_call><invoke ...><parameter ...>` format, fixing mixed prompt rounds that previously failed to execute browser/terminal tools from that output shape.
- **File Browser loading hangs** — Added bounded file-tree scanning guardrails (`max scan ms`, `max nodes`, `max entries/dir`, symlink skip) and frontend request timeouts with a clear timeout error instead of indefinite loading states.
- **Nano Banana image-call reliability** — MCP image generation now uses a dedicated timeout path (`MCP_IMAGE_TOOL_TIMEOUT_MS`, default `180000`) and timeout-aware retry classification/hints; call-start logs now include `timeoutMs` for easier call correlation.
- **Generated image actions in chat** — Restored inline **Copy** and **Download** controls for assistant-generated images by preserving tool-image payloads on assistant messages and rendering per-image action buttons in chat history.
- **False image-success claims in chat** — Assistant text that says an image was generated is now filtered unless a real `toolImage` payload is present, preventing “Generated image…” messages when no image was actually returned.

### Changed

- **Installed desktop app refreshed** — Local `/Applications/Code Companion.app` has been rebuilt/reinstalled with the above fixes so runtime behavior matches current workspace code.

---

## [1.6.5] — 2026-04-09

### Fixed

- **Packaged app startup crash (all v1.6.x installs)** — `routes/` directory was missing from `electron-builder.config.js`. The Phase 24.5 server.js refactor (v1.6.0) extracted 16 Express route modules into `routes/` but the packaging config was never updated. Every packaged install from v1.6.0–v1.6.4 crashed at startup with `code=1, signal=null` when `server.js` tried to `require('./routes/...')`. v1.5.27 and earlier were unaffected (predated the refactor).

### Added

- **CI server smoke test** — New `smoke-test` job in `.github/workflows/build.yml` spawns `node server.js` and verifies it binds to a port before any platform build runs (`needs: smoke-test`). Catches missing runtime directories before a broken installer ships. Also runnable locally: `node scripts/smoke-test-server.js`.
- **Packaging rule documented** — `BUILD.md`, `docs/RELEASES-AND-UPDATES.md`, and `CLAUDE.md` now explicitly warn that new top-level runtime directories must be added to the `files` array in `electron-builder.config.js`.

---

## [1.6.4] — 2026-04-09

### Changed

- **Tool call ordering fixed** — Parallel tool execution now uses order-preserving window segmentation. Previously all safe tools ran first then all risky tools, which could execute a write before a preceding read in mixed-call rounds. Now the original call order is always respected: contiguous safe calls run in parallel, risky calls run in-place as serial checkpoints.

---

## [1.6.3] — 2026-04-09

### Added

- **Intel Mac (x64) installer** — CI now builds a native x64 DMG on `macos-13` for Intel Mac users; ARM64 build remains the primary with the auto-update feed.

### Fixed

- **Startup log includes app version** — The `code-companion-startup.log` emergency file now records the app version at launch, making crash reports immediately identifiable.

---

## [1.6.2] — 2026-04-08

### Fixed

- **Server crash on startup** — Added `tslib` to production dependencies. `pdfkit` → `fontkit` → `@swc/helpers` requires `tslib` as a peer dependency; its absence caused "Cannot find module 'tslib'" on fresh installs.

---

## [1.6.1] — 2026-04-08

### Fixed

- **Download page URL** — "Open download page" in Settings now correctly links to `github.com/Th3rdai/CodeCompanion/releases/latest` (was pointing to the old `3rdAI-admin` org).

---

## [1.6.0] — 2026-04-08

### Added

- **Phase 24.5 Tech Health** — Major structural refactor improving long-term maintainability:
  - **Hook extraction** (`src/hooks/`): `useModels.js`, `useChat.js`, `useImageAttachments.js` extracted from `App.jsx`; App.jsx reduced from 2,954 → 1,873 lines.
  - **Route decomposition**: 15 Express router factory modules created under `routes/`; `server.js` reduced from 5,169 → 507 lines. Router factory pattern: each module exports `createRouter(appContext)`.
  - **ESLint baseline**: `eslint.config.mjs` established at 0 errors / 148 warnings; test consolidation under `tests/unit/`.
- **Streaming terminal SSE** — Agent `run_terminal_cmd` now streams live output during execution. New SSE events: `terminalCmd` (command start), `terminalOutput` (live chunks), `terminalStatus` (exit/timeout). The in-chat terminal indicator shows real-time output with status icons (running/done/error/timeout).
- **Confirm-before-run modal** (`ConfirmRunModal.jsx`) — When `agentTerminal.confirmBeforeRun` is enabled in Settings, the AI agent pauses before executing each command and presents an Allow/Deny modal. Unacknowledged confirmations auto-deny after 60 seconds. New `POST /api/chat/confirm` endpoint handles responses.
- **Agent terminal audit logging** (`lib/terminal-audit.js`) — Append-only JSON-lines log at `${CC_DATA_DIR}/logs/terminal-audit.log`. Records every command invocation (denied/spawn-error/executed) with timestamp, command, args, cwd, exit code, duration, and truncation status.
- **Draggable modals** — `ImagePrivacyWarning`, `JargonGlossary`, `OllamaSetup`, and `RenameModal` all support pointer-drag repositioning with viewport clamping.
- **Mac codesign identity normalizer** (`lib/mac-codesign-identity.js`) — Strips the `"Developer ID Application:"` prefix from `MAC_CODESIGN_IDENTITY` so both bare Team ID and full certificate name forms work with `electron-builder`.

### Fixed

- **Stale-asset caching** — `sendSpaIndexHtml` now sends `Cache-Control: no-cache, no-store, must-revalidate`; SPA fallback returns 404 (not `index.html`) for paths with file extensions or under `/assets/`. Eliminates blank-page on first load after upgrade.
- **`routes/convert.js` mounting** — Route module was created but never mounted; orphaned inline handler removed from `server.js`.
- **Atomic history writes** — `lib/history.js` now uses a tmp-file + rename pattern to prevent partial writes on crash.

### Tests

- 184 unit tests pass (added: `terminal-audit.test.js`, `mac-codesign-identity.test.js`).
- 3 new Playwright E2E scenarios: agent terminal enable/disable, allowlist deny, happy-path execution.

---

## [1.5.27] — 2026-04-05

### Fixed

- **Auto-updater**: `electron-builder.config.js` publish `owner` corrected from `3rdAI-admin` to `Th3rdai` — installed apps were checking the private mirror repo and receiving 404 on `releases.atom`. In-app **Check for updates** now resolves correctly.

---

## [1.5.26] — 2026-04-04

### Added

- **Integrated Terminal mode** — New **Terminal** mode in the sidebar spawns a full interactive PTY shell (`node-pty`) inside the Electron app via IPC. Renders with `xterm.js` (`@xterm/xterm` + `@xterm/addon-fit`). Shell CWD is read from `.cc-config.json` project folder in `electron/main.js` (never from renderer). One PTY per window; killed on window close. Browser users see a "desktop app only" empty state. See [`docs/TERMINALFEATURE.md`](docs/TERMINALFEATURE.md).
- **`docs/TERMINALFEATURE.md`** — Living spec: architecture diagram, security model, Agent terminal comparison table, testing checklist.

### Fixed

- **Electron `loadURL` HTTPS protocol** — All `mainWindow.loadURL()` calls now detect whether the Express server uses HTTPS (same cert-file check as `server.js`) and use the correct protocol. Previously, using `http://` against an HTTPS server caused `ERR_EMPTY_RESPONSE` / blank window.
- **Self-signed cert acceptance** — Added `certificate-error` handler in `electron/main.js` to accept the self-signed localhost cert without a browser warning page.
- **xterm.js UTF-8 encoding** — PTY output (base64-decoded binary string) is now converted to `Uint8Array` before `term.write()` so multi-byte UTF-8 sequences (box-drawing characters, emoji, CJK) render correctly instead of as garbled Latin-1.
- **Mode tabs second row clipped** — Removed `overflow-hidden` from the mode tabs bar; `FloatingGeometry` is already `position: absolute` and self-contained so the clip wasn't needed. Second row of mode buttons now fully visible.
- **Terminal mode layout** — Changed `TerminalPanel` outer container from `h-full` to `flex-1 min-h-0` so it participates correctly in the flex column layout without pushing the mode tabs off-screen.
- **Chat input hidden in Terminal mode** — The chat textarea and toolbar are now hidden when Terminal mode is active (consistent with Create, Build, Review).

---

## [1.5.19] — 2026-03-30

### Added

- **CRE8 framework integration** — Create mode now scaffolds CRE8 workflow files: `PRPs/`, `examples/`, `journal/`, PRP templates (`prp_base.md`, `prd_base.md`), 12 CRE8 command files across all 5 IDE paths, and `INITIAL.md` pre-populated with wizard data. New **"Generate Execution Plan"** button on the success screen auto-sends the `generate-prp.md` prompt to chat, producing a full PRP immediately after project creation.
- **`GET /api/cre8/prp-prompt`** — Returns CRE8 `generate-prp.md` content for chat pre-fill.

### Fixed

- **Claude Code launch** — "Open in Claude Code" now runs `claude` CLI in a new Terminal tab via AppleScript instead of just opening Terminal in the folder.

---

## [1.5.24] — 2026-04-04

### Added

- **Agent Validate builtins (Phase 25)** — Chat agent can now scan any project folder and generate a phased `validate.md` command file directly from chat, using the same `lib/validate.js` pipeline as Validate mode. Two new builtin tools: `validate_scan_project` (discover linters, type checkers, test runners, CI configs) and `validate_generate_command` (scan + AI generation in one step, optional save to project folder). Both are gated by `agentValidate.enabled` (default on) and path-scoped to the configured project folder.
- **Agent Planner scoring (Phase 26)** — Chat agent can score implementation plans with the same AI pipeline as Planner mode. New builtin tool `score_plan` returns letter grades (A–F) for Clarity, Feasibility, Completeness, and Structure, plus an overall grade and improvement suggestions. Accepts pre-built markdown or structured fields (planName, goal, steps, scope, dependencies, testing, risks). Gated by `agentPlanner.enabled` (default on).
- **Agent identity override** — Injected prompt block explicitly forbids teacher-deflection phrases ("you'll need to run this yourself", "you are the one holding the keyboard", etc.) so the model correctly acts as an agent with real execution tools rather than an advisory chatbot.
- **Configurable agent max rounds** — Chat toolbar "Rounds" picker (1/3/5/10/15/20/25, default 10) lets users control how many tool-call iterations the agent can run per message. Server enforces a cap of 25 (min 1). Replaces the previous hardcoded limit of 5, enabling the agent to autonomously write code, run tests, fix failures, and install dependencies in one turn.

### Planning

- **Agent first-party capabilities** — [`docs/AGENT-APP-CAPABILITIES-ROADMAP.md`](docs/AGENT-APP-CAPABILITIES-ROADMAP.md) promoted to [`.planning/ROADMAP.md`](.planning/ROADMAP.md) as **Phases 25–27** (Validate / Planner / optional GSD builtins from chat). Pointers added in README, CLAUDE.md, `whats-next.md`, STATE.

---

## [1.5.21] — 2026-04-04

### Security

- **Electron 41.0.2 → 41.1.1** — Fixes HTTP Response Header Injection in custom protocol handlers (GHSA-4p4r-m79c-wq3v) and use-after-free in offscreen shared texture release callback (GHSA-8x5q-pvf5-64mp).
- **`lodash-es` override `>=4.18.1`** — Forces mermaid → langium → chevrotain dependency chain off vulnerable `<=4.17.23` range; fixes Code Injection via `_.template` (GHSA-r5fr-rjxr-66jc) and Prototype Pollution via `_.unset`/`_.omit` (GHSA-f23m-r3pf-42rh) without downgrading mermaid.
- **`@xmldom/xmldom` → `>=0.8.12`** — Fixes XML injection via unsafe CDATA serialization (GHSA-wh4c-j3r5-mjhp).
- **`lodash` (direct)** — Upgraded via `npm audit fix`; same CVEs as lodash-es above.
- **`npm audit`** — 0 vulnerabilities.

---

## [1.5.20] — 2026-04-04

### Added

- **`builtin.view_pdf_pages` tool** — Renders PDF pages as images via `pdftoppm` (poppler) so the vision model can analyze diagrams, network maps, charts, and screenshots. Tool result images are fed directly into the next Ollama call rather than streamed to the client. Requires `poppler` (`brew install poppler`).
- **Auto model per mode** — Toolbar option **Auto (best per mode)**; server resolves via **`lib/auto-model.js`** + **`autoModelMap`** in **`.cc-config.json`**; Settings → **Auto model map**; SSE **`resolvedModel`** on chat. Applies to review, pentest, score, validate, build APIs, git review, tutorial suggestions, memory extraction.
- **`scripts/clean-artifacts.sh`** — Removes **`release/`**, **`dist/`**, and Playwright output dirs; optional **`--with-gitnexus`** to drop **`.gitnexus/`** before re-indexing. Documented in **[BUILD.md](BUILD.md)**.
- **`npm run test:integration`** — Runs **`tests/integration/api-with-images.test.js`** (spawned server; chat/review/pentest/remediate). Documented in **[docs/TESTING.md](docs/TESTING.md)**.
- **Image lightbox** — Click any image in chat to preview full-size in a modal overlay; `Escape` or click backdrop to close.
- **Tool parameter schemas in system prompt** — MCP tool descriptions now include required params, types, and enum values. Compact format keeps prompt at ~8.5 KB (was 23.7 KB).
- **Image revision flow** — `IMAGE_DELIVERED` marker in tool results instructs models to re-call `generate_image` for revisions instead of hallucinating fake image markdown.
- **Batch conversation delete** — `POST /api/history/batch-delete` for single-request bulk deletion.
- **GitHub clone destination picker** — **Clone to folder** field in the clone URL section.

### Changed

- **Tool context persistence across turns** — After each tool-call round, server emits a `toolContextMessages` SSE event with text-only tool context. Client saves these with `_toolContext: true` into conversation history so the model retains which file/resource it was working on across follow-up queries. Hidden from chat UI and exports.
- **Per-conversation isolation** — `_toolContext` flag preserved in `postBody.messages` so server strips it before Ollama; memory retrieval scoped by `conversationId`; `searchMemories` filters by `source` so unrelated conversations are not mixed.
- **Agent terminal system prompt (TERMINALFIX)** — Builtin safety preamble and **AGENT TERMINAL** line only injected when `builtin.run_terminal_cmd` is advertised for the session (`lib/builtin-agent-tools.js`, `lib/tool-call-handler.js`).
- **Chat latency** — `listModels` short-TTL cache; parallel auto-model + memory embedding on `POST /api/chat`; cached project file-list snippet; `requestAnimationFrame` batching for streaming tokens.
- **`/api/convert-document`** — Added to 50 MB body-limit whitelist (was capped at 5 MB by global middleware, blocking PDFs over ~3.7 MB).

### Fixed

- **`previousSessionPrompt` ReferenceError** — Variable was referenced but never declared in the `clientHasSystem` branch (deep-dive review mode). Removed.
- **npm transitive dependencies** — `npm audit fix` updates **brace-expansion**, **path-to-regexp**, and **picomatch** (via lockfile) to clear Dependabot-reported moderate/high advisories.
- **Playwright E2E** — Duplicate image upload test awaits `dialog` before `dismiss()` so async `confirm()` does not race the test end.
- **MCP image generation** — Hallucination stripping after `TOOL_CALL:` patterns; base64 context bloat prevention; `const` reassignment crash fix.
- **Tool-call system prompt** — Instructs models to STOP after `TOOL_CALL:` lines and never fabricate results.
- **Auto-model vision fallback** — `preferVision` now only triggers when the **current** message has images, not historical ones.
- **Historical image arrays causing 400 errors** — Strips `images` from older messages before sending to non-vision models.

### Documentation

- **`docs/TESTING.md`**, **`docs/INSTALL-MAC.md`**, **`docs/TROUBLESHOOTING.md`**, **`docs/ENVIRONMENT_VARIABLES.md`** — Updated for new features and current version.
- **`TERMINALFIX.md`** / **`docs/TERMINALFIX-plan-review.md`** — Documents terminal prompt alignment design and plan review.

---

## [1.5.14] - 2026-03-27

### Added

- **Desktop release pipeline** — Per-platform CI checks that **`release/`** contains **`latest-mac.yml`** / **`latest.yml`** / Linux feeds before upload; release job verifies **`GITHUB_REPOSITORY`** matches **`electron-builder.config.js`** `publish` (prevents fork-only releases while the app updates from **th3rdai/CodeCompanion**); **`fail_on_unmatched_files`** on **`softprops/action-gh-release`**; scripts **`verify-release-output.js`**, **`verify-ci-repo-matches-publish.js`**.
- **`package.json`** — **`repository`** URL for **`github.com/th3rdai/CodeCompanion`**.
- **Electron — View → Go to app home** (⌥⌘H on macOS, Ctrl+Shift+H on Windows/Linux) reloads the local app URL if navigation ever gets stuck.

### Changed

- **Settings → Software Updates (Electron)** — Plain-language status and error text; always-visible **Open download page** (official releases URL in `src/lib/release-urls.js`); IPC **`open-external-url`** for safe browser handoff. Browser-only section links the same download page instead of dev jargon.
- **`electron-builder.config.js`** — Explicit **`publish.publishAutoUpdate: true`** so updater YAML is always written to **`release/`**.
- **Electron** — **`will-navigate`** keeps the main window on the app (`file://` splash, `http(s)://localhost|127.0.0.1` on the app port); other **`http(s)`** and **`mailto:`** / **`tel:`** open in the system browser. **`setWindowOpenHandler`** continues to send **`target=_blank`** / **`window.open`** to the browser.
- **Chat markdown** — Off-origin **`http(s)`** links open in the default browser (or Electron **`openExternal`**); DOMPurify strips **`iframe`**, **`frame`**, **`object`**, **`embed`**; external links get **`target="_blank"`** / **`rel="noopener noreferrer"`** when appropriate.

### Documentation

- **AGENTS.md** / **CLAUDE.md** — GitNexus index stats refreshed.

---

## [1.5.5] - 2026-03-22

### Fixed

- **Auto-update (404)** — Set **`artifactName`** in **`electron-builder.config.js`** to **`${name}-${version}-${arch}.${ext}`** (uses npm `name`, no spaces) so **`latest-mac.yml`** / **`latest.yml`** URLs match GitHub Release asset filenames. v1.5.4 published **`Code-Companion-…`** in YAML while assets were **`Code.Companion-…`**, causing updater downloads to 404.

---

## [1.5.4] - 2026-03-20

### Changed

- **File Browser** — **Claude Code** is the primary full-width launch control; VS Code, Cursor, Windsurf, and OpenCode are in a compact row above it.

---

## [1.5.3] - 2026-03-24

### Fixed

- **Install & release docs** — macOS app data path documented as **`~/Library/Application Support/code-companion/`** (matches Electron `userData` from package `name`); Windows CLI examples use the default NSIS location **`%LOCALAPPDATA%\Programs\Code Companion\`**; **BUILD.md** / **docs/RELEASES-AND-UPDATES.md** use current Software Updates control names.
- **Software Updates (Electron)** — After an update is found, **Download update** runs `autoUpdater.downloadUpdate()`; **get-update-state** syncs “ready to restart” if Settings opens after a background download (`electron/updater.js`, `electron/preload.js`, `SettingsPanel.jsx`).

### Added

- **Tests** — `tests/unit/build-file-ops.test.js` integration tests for **`/api/build/projects/:id/files/:filename`** (whitelist, traversal, atomic write).
- **Stop / Escape** — In-flight **AbortSignal** for Review, Security, Validate, and builder flows; **Stop** control + global **Escape** runs chat stop + `abortAll()` (`useAbortable`, `useAbortRegistry`, `StopButton`).

---

## [1.5.2] - 2026-03-22

### Security

- **CSP** — Per-request **nonces** for `script-src` (no `unsafe-inline` for scripts); SPA `index.html` served with matching nonces.
- **API errors** — Generic **5xx** / SSE messages via `lib/client-errors.js` (details server-side only).
- **SCA** — CI runs **`npm audit --audit-level=critical`** (`.github/workflows/ci.yml`).
- **GitHub** — **`validateTokenCached`** reduces repeated GitHub `/user` calls from Settings.

### Changed

- **Tags & remotes** — `v1.5.2` aligned with `master` on **origin** and **th3rdai**; installers follow **th3rdai/CodeCompanion** (`electron-builder` publish target).

---

## [1.5.1] - 2026-03-22

### Changed

- **Desktop installers rebuilt** — macOS (DMG/ZIP), Windows x64 (NSIS/ZIP), Linux x64 (AppImage/ZIP) from current `main` (Vite + Electron).

### Added

- **Chat Stop** — abort in-flight `/api/chat` (streaming + agent tool rounds); server aborts Ollama via `AbortSignal`.
- **Toolbar Export** — 11 output formats via `office-generator` + `POST /api/generate-office`.
- **Claude Code automation** — `.claude/` skills, agents, hooks (sensitive-file guard, unit tests on `lib/`/`server.js`/`mcp/` edits); see `docs/CLAUDE-CODE-AUTOMATION.md`.
- **`electron-updater` patch** — GitHub API for `getLatestTagName` + `allowPrerelease` for prerelease-only feeds (`patches/electron-updater+*.patch`).

### Fixed

- GitHub **406** on updater check when using web `releases/latest` JSON URL (patched upstream provider via `patch-package`).

---

## [1.5.0] - 2026-03-17

### Added - Image & Vision Model Support 🖼️

**Major Feature**: Complete image upload and vision model integration across Code Companion.

#### Core Features

- **Image uploads** via drag-and-drop, file picker, or clipboard paste (Cmd+V / Ctrl+V)
- **Vision model support** for llava, bakllava, minicpm-v, and other Ollama vision models
- **Automatic security hardening**:
  - EXIF metadata stripping (GPS coordinates, timestamps, camera info)
  - Embedded script destruction via canvas re-encoding
  - MIME type whitelist (PNG, JPEG, GIF only - SVG rejected)
- **Smart image processing**:
  - Auto-resize to 2048px max dimension (configurable)
  - Multi-step downscaling for quality preservation
  - Thumbnail generation (128x128px)
  - Compression (configurable quality 50%-100%, default 90%)
- **Duplicate detection** via SHA-256 hashing with user confirmation
- **Gallery viewer** with lightbox, zoom, pan, download, navigation
- **Privacy warning** modal on first upload (dismissible, localStorage-persisted)
- **Real-time processing indicator** showing active image count

#### Mode Integration

- **Chat mode**: Upload screenshots, diagrams, error messages alongside text
- **Review mode**: Attach bug screenshots with code for visual evidence
- **Security mode**: Include error logs and configuration screenshots for context

#### Vision Model Detection

- Real-time detection when images attached with non-vision model
- Warning banner with "Switch to vision model" and "Remove images" quick actions
- Send button disabled until conflict resolved
- Vision model badges (👁️) in model dropdown and settings

#### Settings & Configuration

New "Image Support" settings panel:

- Enable/disable image uploads toggle
- Max file size slider (1-50 MB, default 25MB)
- Max images per message (1-20, default 10)
- Compression quality slider (50%-100%, default 90%)
- Available vision models list with installation instructions

#### Error Handling

Categorized, user-friendly error messages:

- **Validation errors**: Unsupported format, file too large, dimensions exceeded
- **Processing errors**: Canvas failure, memory exhaustion, corrupted file
- **Runtime errors**: Timeout with vision models, context window exceeded, Ollama offline
- **Duplicate warnings**: Confirmation dialog before attaching duplicate images

#### Technical Improvements

- **Zero new dependencies** - uses browser Canvas API, crypto.subtle, FileReader
- **Backwards compatible** - existing conversations and features unchanged
- **Optional field** in conversation schema - old conversations load without errors
- **Efficient storage** - images stored as base64 without data URI prefix
- **File size warnings** - alerts when conversation exceeds 5MB

#### Developer Experience

- Comprehensive documentation (3,440+ lines across 11 planning docs)
- Manual testing checklist (150+ test scenarios)
- Build verification (all tests passing)
- Component architecture documented
- Security audit completed

#### Files Added

- `lib/image-processor.js` - Node.js image processing utilities (370 lines)
- `src/lib/image-processor.js` - Browser ES6 image processor (265 lines)
- `src/components/ImageThumbnail.jsx` - Thumbnail display component (120 lines)
- `src/components/ImageLightbox.jsx` - Full-size viewer component (280 lines)
- `src/components/ImagePrivacyWarning.jsx` - Privacy modal component (150 lines)

#### Files Modified

- `src/App.jsx` (+200 lines) - Main chat image support
- `src/components/ReviewPanel.jsx` (+150 lines) - Code review images
- `src/components/SecurityPanel.jsx` (+170 lines) - Security scan images
- `src/components/MessageBubble.jsx` (+20 lines) - Image display in history
- `lib/ollama-client.js` (+40 lines) - Images parameter support
- `server.js` (+60 lines) - API endpoint updates
- `lib/review.js` (+15 lines) - Vision context injection
- `lib/pentest.js` (+20 lines) - Vision context injection
- `lib/config.js` (+25 lines) - Image support config
- `src/components/SettingsPanel.jsx` (+50 lines) - Settings UI
- `lib/history.js` (+15 lines) - File size warnings

**Total**: ~1,820 lines of code across 16 files

#### Known Limitations

- No processing queue (all images process concurrently) - deferred to Phase 7
- No object URL cleanup (minor memory impact) - deferred to Phase 7
- GIF animations analyze first frame only (Ollama limitation)
- Folder scans in Security mode exclude images (intentional - performance)
- FileBrowser has no image preview (deferred - low priority UX)

#### Credits

Implementation completed 2026-03-17 via coordinated parallel development sessions.

---

## [1.0.0] - Previous Release

_Prior changelog entries to be added here as project evolves._

---

## Guidelines for Contributors

When adding entries:

- Group changes by type: Added, Changed, Deprecated, Removed, Fixed, Security
- Use present tense ("Add feature" not "Added feature")
- Reference issue numbers where applicable
- Keep descriptions concise but informative
- Date entries when released (YYYY-MM-DD)
