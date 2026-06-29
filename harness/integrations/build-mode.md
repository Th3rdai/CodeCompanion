# Harness Integration: Build Mode

**Maps:** `harness/agents/builder.agent.md` → `src/components/build-mode/`
**Created:** 2026-06-28

---

## Builder Agent → Build UI Mapping

| Agent Role | Build UI Component       | Responsibility                                    |
| ---------- | ------------------------ | ------------------------------------------------- |
| Builder    | `BuildSimpleView.jsx`    | Execute research, generate plans, save to project |
| Builder    | `BuildAdvancedView.jsx`  | View phases, planning files, lifecycle progress   |
| Builder    | `ClaudeCodeHandoff.jsx`  | Generate handoff commands for external IDEs       |
| Reviewer   | `BuildHeader.jsx`        | Display agent role + autonomy mode badge          |
| —          | `PlanningFileViewer.jsx` | View/edit `.planning/` files with atomic save     |

---

## Autonomy Mode → UI Behavior

| Mode                 | UI Behavior                                                                          |
| -------------------- | ------------------------------------------------------------------------------------ |
| `cautious` (default) | Show confirmation prompts before destructive actions (e.g., unsaved-changes warning) |
| `full`               | Auto-proceed without confirmation (future — not yet exposed in UI)                   |
| `ask`                | Prompt for every action (future — not yet exposed in UI)                             |

---

## Lifecycle Stages → Build Progress Phases

| Build Phase | Harness Stage         | Stage Contract                         |
| ----------- | --------------------- | -------------------------------------- |
| Phase 1     | 01 — Task Definition  | `stages/01-task-definition/README.md`  |
| Phase 2     | 02 — Agent Design     | `stages/02-agent-design/README.md`     |
| Phase 3     | 03 — Prompt Design    | `stages/03-prompt-design/README.md`    |
| Phase 4     | 04 — Tool Integration | `stages/04-tool-integration/README.md` |
| Phase 5     | 05 — Evaluation       | `stages/05-evaluation/README.md`       |
| Phase 6     | 06 — Iteration        | `stages/06-iteration/README.md`        |
| Phase 7+    | 07 — Release          | `stages/07-release/README.md`          |

> **Note:** Phases beyond 7 map to Release (capped at stage 7).

---

## Build Actions → Harness Skills

| Build UI Action        | Harness Skill | Skill File                            |
| ---------------------- | ------------- | ------------------------------------- |
| Research Phase button  | Research      | `harness/skills/research/research.md` |
| Generate Plan button   | Plan          | `harness/skills/plan/planner.md`      |
| Save to Project button | Build         | `harness/skills/build/build.md`       |
| View Files button      | Run           | `harness/skills/run/run.md`           |
| View Phases button     | Validate      | `harness/skills/validate/validate.md` |
| Claude Code commands   | Commit        | `harness/skills/commit/commit.md`     |

---

## MCP Tool Usage in Build Mode

| MCP Server       | Build Use Case                       |
| ---------------- | ------------------------------------ |
| Crawl4AI         | Web research for phase planning      |
| Archon           | Task/project sync for build tracking |
| Google AI Studio | AI synthesis of research findings    |

---

## Integration Points

1. **BuildHeader.jsx** — Receives `agentRole` and `autonomyMode` props, renders badge
2. **BuildAdvancedView.jsx** — Renders lifecycle breadcrumb derived from phase number
3. **BuildSimpleView.jsx** — AbortController for streaming (cautious mode: user can cancel)
4. **PlanningFileViewer.jsx** — Unsaved-changes warning (cautious mode: confirm before discard)
5. **ClaudeCodeHandoff.jsx** — Generates IDE handoff commands based on project state
