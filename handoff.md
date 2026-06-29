# handoff.md — Code Companion multi-agent handoff

**Updated:** 2026-06-29 (evening) — Claude Code completed the HARNESSSWAP **backend rewire** (off the legacy planning-CLI bridge) + verification  
**Package version:** 1.7.4  
**Git state:** uncommitted working tree (~33 modified, ~13 untracked)  
**Archon project:** `2d0295a0-6cf4-423d-94ae-4d75c0bf842f`  
**Archon handoff doc:** `008175bc-39e4-4634-85b3-9a158072d6e0`  
**Canonical handoff:** this file (keep in sync with Archon doc above)

> **All agents:** Read this file before coding. Update it when you change scope, finish a workstream, or hit a blocker. Sync material changes to Archon (project description + handoff document + task statuses).

---

## For all agents

### Read first

| Priority | Path                                                 | Why                                              |
| -------- | ---------------------------------------------------- | ------------------------------------------------ |
| 1        | `handoff.md` (this file)                             | Current workstreams, owners, blockers            |
| 2        | `CLAUDE.md`                                          | Commands, invariants, packaging footguns         |
| 3        | `HARNESSSWAP.md`                                     | Build-mode harness-migration acceptance criteria |
| 4        | `harness/README.md`                                  | Harness layout and mode→agent map                |
| 5        | `.claude/skills/code-companion-conventions/SKILL.md` | Large UI/server change rules                     |

### Repo rules (non-negotiable)

- **Do not commit** unless the user explicitly asks. Current tree is shared WIP.
- **Do not push** unless asked.
- Run `npm run validate:fast` before any commit the user requests.
- **Electron packaging:** new top-level runtime dirs → add to `electron-builder.config.js` `files` array.
- **Config footgun:** Electron reads `.cc-config.json` from **data dir** (`~/Library/Application Support/code-companion/`), not repo root.
- **GitNexus:** run impact analysis before editing shared symbols (`lib/chat-post-handler.js`, `server.js`, etc.).
- Delete `*.backup` files next to `src/` before commit (scaffold leftovers).

### Coordination

1. Check Archon tasks for this project before starting work.
2. Move your task `todo` → `doing` → `review` (not straight to `done` unless user validates).
3. Only **one** task in `doing` per agent; HARNESSSWAP is the active `doing` task now.
4. After your session: update this file + Archon handoff document.

---

## Agent roles

| Agent             | Typical use                                                                | Current assignment                             | Archon task ID                         |
| ----------------- | -------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------- |
| **Claude Code**   | HARNESSSWAP implementation, harness validation, backend bridge             | **Active** — finish swap + tests               | `4ce39913-db0d-4fc0-8a47-4a6989c1635b` |
| **Cursor (Auto)** | Archon sync, mic entitlement, DictateButton, handoff.md                    | Mic fix **in repo**; wait for Claude on commit | `201c918a-8706-44fc-96f1-e111d2a42e84` |
| **Claudette**     | RESPONSEFIX-style reliability, Docker, audit log                           | **Available** — no active task                 | —                                      |
| **User (James)**  | E2E onboarding validation, macOS mic verify after rebuild, commit approval | Mic blocked on **old signed build**            | `e46684da-…` (onboarding review)       |

### What each agent should **not** do right now

| Agent       | Avoid                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| Claude Code | Reverting harness-bridge work; large REORGPLAN phases; committing without validation                               |
| Cursor      | Competing edits on `ClaudeCodeHandoff.jsx` / `routes/build.js` while Claude finishes HARNESSSWAP                   |
| Any agent   | Fixing mic only in Settings UI — root cause is **missing macOS entitlement** on signed builds                      |
| Any agent   | Removing `ICM-fw` references in **Create template** settings (`SettingsPanel.jsx`) — physical template folder name |

---

## Executive summary

Three workstreams on one **uncommitted** tree:

| #   | Workstream                    | Owner                 | Status                                                                                                                                                                          |
| --- | ----------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **HARNESSSWAP / CocoHarness** | Claude Code           | **Functionally complete** — backend rewired off the legacy bridge, scaffolder on 7-stage lifecycle, 1010 tests green; only command-name canonicalization + UI-spec stubs remain |
| 2   | **Desktop mic entitlement**   | Cursor (done in repo) | **Blocked on user** — needs `npm run electron:build:mac` + reinstall                                                                                                            |
| 3   | **Agent autonomy directive**  | Cursor (done in repo) | **Review** — wired + unit tests; commit with harness or separate                                                                                                                |

**Gate:** User asked to wait for Claude before commit. Do not merge to master until HARNESSSWAP checklist passes and user approves commit scope.

---

## Workstream 1 — HARNESSSWAP (Claude Code)

**Plans:** `HARNESSSWAP.md`, `CocoHarness.md`, `BUILDv2.md`  
**Archon:** `4ce39913-db0d-4fc0-8a47-4a6989c1635b` (**doing**), `7154dc6c-92c3-4159-9992-b70e8754bf3e` (**review**)

### Key finding

`HARNESSSWAP.md` as drafted was **front-end-only** — it mapped 22 legacy text/slash-command references in `src/` but marked _"Backend API changes out of scope"_ and never touched the runtime dependency. The real Build failure ("install the required planning tools" in the What's Next coach) came from `routes/build.js` → the **legacy bridge** (now removed), which shelled out to an **un-installed** `~/.claude/`-based planning CLI; `getState()` returned `{error:"…tools not installed…"}` and the AI paraphrased it. The fix required the backend rewire the draft omitted.

### Done (working tree)

- `harness/` — 40 files (untracked): agents, skills, configs, stages, `validate-harness.sh`
- **`lib/harness-bridge.js`** — in-process `.planning/` reader (no external CLI); same method surface + response shapes as the old bridge. `routes/build.js` now uses `HarnessBridge` at **all 7** call sites
- **`lib/build-scaffolder.js`** — scaffolds the **7-stage harness lifecycle** (Task Definition→Release); removed the legacy slash-commands and the false _"planning CLI installed"_ prerequisite; the workflows skill is now `harness-workflows.md`
- **`tests/unit/harness-bridge.test.js`** (new) — 6 tests incl. _"getState never returns a tools-not-installed error"_; degrades gracefully for un-scaffolded projects
- Build UI copy: `modes.js`, `mode-details.js`, `tutorialSteps.js`, `BuildWizard.jsx` → th3rdai-harness (leftover "ICM" mentions cleared)
- `ClaudeCodeHandoff.jsx` — `/harness:*` commands; `BuildPanel.jsx` — `harnessCmd`
- `src/lib/mode-suggestion.js` — matches `harness`/`th3rdai-harness` (legacy alias removed)
- `routes/projects.js`, `lib/README.md`, `CLAUDE.md` — comment/doc refs → `harness-bridge`
- **Real `/harness:*` commands** — `IDE_COMMANDS/harness/{new-project,research,plan,build,review}.md` (canonical `HARNESSSWAP.md` names). Scaffolder command-copy is now **recursive**, so they land at `.claude/commands/harness/*.md` → invokable as `/harness:plan 2` etc. in Claude Code. `ClaudeCodeHandoff.jsx` + `BuildPanel.jsx` emit these canonical names; the command files write `.planning/phases/phase-N-ai-plan.md` / `-summary.md`, which the reader picks up.

### Verified (Claude, this session)

- `npm run test:unit` → **1010/1010 pass** (1004 + 6 new); `eslint` clean on all changed files
- Backward-compat: existing old-format (4-phase) project reads correctly, no error field
- Fresh scaffold (HTTP `POST /api/build-project`) → reader parses **7 phases** w/ goals, `progress` 0%, `getState` **no error**, zero legacy planning-CLI strings in output
- `/state`, `/roadmap`, `/progress` endpoints return correct shapes — the "install planning tools" message is now structurally impossible

### Remaining (Claude)

- [x] **Command naming** — standardized on canonical `HARNESSSWAP.md` names (`/harness:plan|build|review|research|new-project`) across handoff, BuildPanel, scaffolder workflows; backed by **real command files** in `IDE_COMMANDS/harness/`.
- [ ] `tests/ui/build-handoff.spec.js` — update any legacy stubs → harness (Playwright UI; not run this session). NOTE: handoff now emits `/harness:plan`, `/harness:build`, `/harness:review`, `/harness:research` (not the old `-phase`/`-work` variants).
- [x] `bash harness/scripts/validate-harness.sh` — **53/53 passed** (2026-06-29)
- [x] Legacy bridge file — **deleted** (0 importers; superseded by `harness-bridge`). Doc refs updated in `README.md`, `lib/README.md`, `CLAUDE.md`. Smoke test + 1012 unit tests still pass.
- [x] Grep `src/` for legacy framework refs — clean (Settings `ICM-fw` template path is a separate, intentional feature)
- [x] `npm run test:unit` — 1010 pass
- [x] `README.md` / `CLAUDE.md` — doc refs updated to `harness-bridge`
- [ ] Manual: Build handoff panel in **Electron** (verified via web/API this session, not packaged app)

---

## Workstream 2 — Desktop microphone (blocked on rebuild)

**Archon:** `201c918a-8706-44fc-96f1-e111d2a42e84` (**review**)
**User symptom:** Mic works in Chrome; Electron shows denial; **Code Companion not in System Settings → Microphone list**.

**Root cause:** `/Applications/Code Companion.app` has **hardened runtime** but was built **without** `com.apple.security.device.audio-input` / `com.apple.security.device.microphone`. macOS blocks before TCC registration. `tccutil reset Microphone com.th3rdai.code-companion` does not fix installed signed builds.

**Fix already in repo (uncommitted):**

- `resources/entitlements.mac.plist` — mic entitlements added
- `electron-builder.config.js` — `entitlements` + `entitlementsInherit` wired
- `electron/main.js`, `electron/preload.js`, `src/components/chat/DictateButton.jsx`
- `tests/unit/mac-entitlements.test.js`

**User / release agent after merge:**

```bash
npm run build && npm run electron:build:mac
```

Install `release/mac-arm64/Code Companion.app`, relaunch, tap mic once.

**Workaround until rebuild:** `~/Applications/Code Companion.app` (ad-hoc, no hardened runtime).

---

## Workstream 3 — Agent autonomy

**Archon:** `c5dd2ce4-4e15-4550-a6ec-35787fff2e30` (**review**)

- `lib/agent-autonomy.js` — `AGENT_AUTONOMY_PROMPT_SNIPPET` + pinned memory marker `[cc-agent-autonomy-v1]`
- Wired: `prompts.js`, `memory.js`, `chat-post-handler.js`, `tool-call-handler.js`, `server.js`
- Tests: `agent-autonomy-memory.test.js` + guardrail test updates

Safe for any agent to **review**; avoid conflicting edits to `memory.js` / `chat-post-handler.js` during HARNESSSWAP.

---

## Archon task board (snapshot)

| Status     | Task                                                                       | ID                                     |
| ---------- | -------------------------------------------------------------------------- | -------------------------------------- |
| **doing**  | HARNESSSWAP: Replace the legacy framework with th3rdai-harness in Build UI | `4ce39913-db0d-4fc0-8a47-4a6989c1635b` |
| **review** | CocoHarness: Scaffold harness directory                                    | `7154dc6c-92c3-4159-9992-b70e8754bf3e` |
| **review** | Agent autonomy: prompts + pinned memory                                    | `c5dd2ce4-4e15-4550-a6ec-35787fff2e30` |
| **review** | Desktop mic: macOS entitlement fix                                         | `201c918a-8706-44fc-96f1-e111d2a42e84` |
| **review** | E2E onboarding journey                                                     | `e46684da-e0d5-489f-9ac3-06bdc5cdb22e` |
| **review** | REORGPLAN file reorganization                                              | `b8c9734a-1a65-4c71-bec1-e25a1f96c008` |
| **todo**   | Harness workstream: validation, CHANGELOG, commit                          | `4c25b155-8b17-4ba6-b27f-a2766b2603a1` |

---

## Validation before commit

```bash
npm run validate:fast
bash harness/scripts/validate-harness.sh
npm run test:unit
node --test tests/unit/mac-entitlements.test.js
```

Frontend → `npm run build` before Electron test.

---

## Uncommitted inventory

**Modified (~33):** electron builder + main + preload, entitlements, build-scaffolder, `routes/build`, `routes/projects`, `lib/README`, `CLAUDE.md`, agent-autonomy, memory, prompts, chat-post-handler, tool-call-handler, server, Build UI (`modes`, `mode-details`, `tutorialSteps`, `BuildWizard`, `mode-suggestion`), DictateButton, tests.

**Untracked:** `harness/`, `handoff.md`, `HARNESSSWAP.md`, `CocoHarness.md`, `BUILDv2.md`, `VIRA_COCO.md`, `docs/VIRA-MCP-INTEGRATION.md`, `lib/harness-bridge.js`, `lib/agent-autonomy.js`, `tests/unit/harness-bridge.test.js`, `tests/unit/agent-autonomy-memory.test.js`, `tests/unit/mac-entitlements.test.js`.

**Remove before commit:** `src/**/*.backup` — ✅ **done** (11 build-mode backups deleted). Still present (other workstreams, left untouched): `server.js.backup`, `electron/main.js.backup`, `CocoHarness.md.backup`, `BUILDv2.md.backup`, `HARNESSSWAP.md.backup`, `SIP.md.backup`, `validate.md.backup`, `CodeCompanion-Data/memory/memories.json.backup`, `!ARCHIVES/…` — their owners should clear them.

---

## Suggested sequence (all agents)

1. **Claude** — complete HARNESSSWAP checklist → move task to `review`.
2. **Any agent** — run validation; fix failures.
3. **User** — approve commit scope (one commit vs split).
4. **Release agent** — `electron:build:mac`; user verifies mic.
5. **Archon** — mark tasks `done`; update project description to post-commit state.

---

## References

| Doc                            | Audience                             |
| ------------------------------ | ------------------------------------ |
| `HARNESSSWAP.md`               | Claude — acceptance criteria         |
| `CocoHarness.md`               | Harness scaffold spec                |
| `harness/CLAUDE.md`            | Agents working inside `harness/`     |
| `docs/VOICE-DICTATION-PLAN.md` | Dictation UX                         |
| `BUILD.md`                     | Desktop build, signing, entitlements |
| `docs/TROUBLESHOOTING.md`      | Config / data dir issues             |
