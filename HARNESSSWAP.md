# HARNESSSWAP — Build mode migrated to th3rdai-harness

**Status:** ✅ Complete (backend + frontend + commands + cleanup) — verified 2026-06-29
**Created:** 2026-06-28
**Feature:** build-mode
**Related:** CocoHarness.md, BUILDv2.md, handoff.md

---

## Goal

Replace the legacy planning+stages framework that Build mode used (a planning-CLI for phases bolted to a separate stages methodology) with the **th3rdai-harness** framework (https://github.com/3rdAI-admin/th3rdai-harness) — a single, unified, model-agnostic agent development harness. Build now uses one coherent framework instead of two bolted together.

The harness provides:

- 7-stage lifecycle (Task Definition → Agent Design → Prompt Design → Tool Integration → Evaluation → Iteration → Release)
- 5 agent contracts (researcher, planner, builder, reviewer, evaluator)
- 3-mode autonomy (full, cautious, ask)
- GitNexus code intelligence integration
- Multi-environment support (Claude Code, Cursor, Windsurf, Aider)

The harness is integrated into CodeCompanion via the local `harness/` directory (see CocoHarness.md).

---

## Command mapping (legacy → harness)

The old Build handoff emitted legacy phase/work slash commands that resolved to nothing unless an external CLI was installed. They are replaced by **real** `/harness:*` command files in `IDE_COMMANDS/harness/`:

| Legacy command (retired) | Harness command         | Agent route                                  |
| ------------------------ | ----------------------- | -------------------------------------------- |
| new-project              | `/harness:new-project`  | Planner — confirm roadmap/requirements/state |
| research-phase {N}       | `/harness:research {N}` | Researcher (stage 01)                        |
| plan-phase {N}           | `/harness:plan {N}`     | Researcher → Planner (stages 01→02)          |
| execute-phase {N}        | `/harness:build {N}`    | Builder (stage 04)                           |
| verify-work {N}          | `/harness:review {N}`   | Reviewer (stage 05)                          |

The scaffolder copies `IDE_COMMANDS/` **recursively**, so these land at `.claude/commands/harness/*.md` and resolve as `/harness:plan 2`, etc. in Claude Code. `ClaudeCodeHandoff.jsx` and `BuildPanel.jsx` emit these exact names. The command files write `.planning/phases/phase-N-ai-plan.md` / `phase-N-summary.md`, which the Build dashboard's reader picks up.

---

## What changed

### Backend (the actual failure point — the original draft scoped this out)

Build's runtime (`/state`, `/roadmap`, `/progress`, `/phase/:n`, `/next-action`) called a **legacy bridge** that shelled out to an **external planning CLI that was never installed**, so `getState()` returned a `{error: "…tools not installed…"}` object and the AI "What's Next" coach paraphrased it into a confusing "install the required tools" message.

- **New `lib/harness-bridge.js`** — reads a project's `.planning/` (ROADMAP / STATE / PROJECT / phases) **in-process**, no external CLI. Same method surface + response shapes the Build UI already consumed.
- **`routes/build.js`** — all 7 bridge call sites now use `HarnessBridge`.
- **Legacy bridge file deleted** (0 importers).

### Scaffolder (`lib/build-scaffolder.js`)

- Scaffolds the **7-stage harness lifecycle** roadmap (Task Definition → Release).
- Removed the legacy slash-command references and the false "planning CLI installed" prerequisite.
- Workflows skill is now `skills/harness-workflows.md`.
- Command-copy is recursive (ships `IDE_COMMANDS/harness/` into all 5 IDE command dirs).

### Frontend

- `ClaudeCodeHandoff.jsx`, `BuildPanel.jsx` — emit canonical `/harness:*` commands.
- `BuildWizard.jsx`, `modes.js`, `mode-details.js`, `tutorialSteps.js` — copy updated to th3rdai-harness (7-stage lifecycle, 5 agent roles); legacy "ICM" build-mode mentions cleared (the separate Create-mode `ICM-fw` template is intentionally untouched).
- `mode-suggestion.js` — Build-mode regex matches `harness` / `th3rdai-harness` (legacy alias removed).

### Real commands

- `IDE_COMMANDS/harness/{new-project,research,plan,build,review}.md` — proper Claude Code commands (front matter + `$ARGUMENTS`) driving each lifecycle step against the project's `.planning/` files.

### Docs

- `README.md`, `lib/README.md`, `CLAUDE.md`, `CHANGELOG.md`, `docs/AGENT-APP-CAPABILITIES-ROADMAP.md` (+ AGENT-SKILLS / AGENT-READINESS / DEVELOPMENT-PATH / REORGPLAN) — pointers updated to `harness-bridge` / th3rdai-harness.

---

## Verification (2026-06-29)

- `npm run test:unit` → **1012/1012 pass** (8 new: `harness-bridge` reader + scaffold command-copy).
- `eslint` clean; `scripts/smoke-test-server.js` passes.
- Fresh scaffold via `POST /api/build-project` → reader parses **7 phases** with goals, `progress` 0%, `getState` returns no error; `.claude/commands/harness/{5}` present in every IDE dir.
- Backward-compatible: an existing older-format project still reads correctly.

---

## Acceptance criteria

1. [x] Zero legacy slash-command references in `src/`
2. [x] Build mode description, wizard, tutorial, dashboard copy reference th3rdai-harness
3. [x] All 5 `/harness:*` commands present in `ClaudeCodeHandoff.jsx` **and** backed by real command files
4. [x] `BuildPanel.jsx` uses `harnessCmd` (no legacy variable)
5. [x] Mode-suggestion regex matches `harness` / `th3rdai-harness`
6. [x] Backend reads `.planning/` in-process (no external CLI); legacy bridge deleted
7. [x] `npm run test:unit` — all pass (1012)
8. [x] `bash harness/scripts/validate-harness.sh` — **53/53 passed** (2026-06-29)
9. [ ] Manual: Build handoff panel verified in packaged **Electron** app (verified via web/API only)
