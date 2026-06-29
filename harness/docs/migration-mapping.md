# Harness Migration Mapping

This document maps existing CodeCompanion artifacts to their new locations in the harness structure.

## .planning/ → harness/

| Source                      | Destination                           | Notes                                        |
| --------------------------- | ------------------------------------- | -------------------------------------------- |
| `.planning/PROJECT.md`      | `harness/_config/project-notes.md`    | Project identity and scope                   |
| `.planning/REQUIREMENTS.md` | `harness/plans/requirements.md`       | Core requirements                            |
| `.planning/ROADMAP.md`      | `harness/plans/roadmap.md`            | Project roadmap                              |
| `.planning/STATE.md`        | `harness/runs/state.md`               | Current project state                        |
| `.planning/phases/*.md`     | `harness/plans/phases/`               | Phase plans (reference only — do not modify) |
| `.planning/research/*.md`   | `harness/plans/research/`             | Research documents                           |
| `.planning/codebase/*.md`   | `harness/docs/`                       | Codebase documentation                       |
| `.planning/design/*.md`     | `harness/docs/`                       | Design decisions                             |
| `.planning/drafts/*.md`     | `harness/plans/drafts/`               | Draft plans                                  |
| `.planning/config.json`     | `harness/configs/harness-config.json` | Harness configuration                        |

## .claude/ → harness/ (cross-reference, not move)

The `.claude/` directory is NOT moved — it stays in place as the IDE integration layer. The harness cross-references it.

| Source                                       | Harness Cross-Reference             | Notes                                               |
| -------------------------------------------- | ----------------------------------- | --------------------------------------------------- |
| `.claude/skills/plan-reviewer/`              | `harness/skills/plan/`              | Shared skill — harness version is the canonical one |
| `.claude/skills/code-companion-conventions/` | `harness/_config/conventions.md`    | Project conventions                                 |
| `.claude/skills/release-desktop/`            | `harness/skills/build/`             | Desktop release process                             |
| `.claude/skills/gitnexus/`                   | `harness/docs/gitnexus.md`          | GitNexus integration guide                          |
| `.claude/agents/security-pass.md`            | `harness/agents/reviewer.agent.md`  | Security agent maps to reviewer role                |
| `.claude/agents/mcp-contract-check.md`       | `harness/agents/evaluator.agent.md` | MCP contract checking maps to evaluator             |
| `.claude/commands/validate-project.md`       | `harness/skills/validate/`          | Validate command maps to validate skill             |
| `.claude/commands/whats-next.md`             | `harness/plans/whats-next.md`       | Next steps planning                                 |
| `.claude/hooks/*.sh`                         | `harness/_config/safety-hooks.md`   | Safety hooks documentation                          |

## What NOT to Move

- `.claude/` — Stays in place (IDE integration layer)
- `.planning/` — Stays in place (historical reference). Harness docs cross-reference it.
- `src/` — Source code is not part of the harness
- `docs/` — Existing docs stay; harness adds its own `harness/docs/`
- `tests/` — Test suite stays; harness evals are separate

## Migration Approach

1. **No destructive moves** — Existing files are NOT moved or deleted
2. **Cross-references** — Harness docs reference existing `.planning/` and `.claude/` content
3. **Copy key docs** — Important planning docs are copied (not moved) into `harness/plans/` for self-containment
4. **New work goes in harness/** — All new planning, runs, and evals go in the harness structure
