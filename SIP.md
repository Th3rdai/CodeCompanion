# Self-Improvement Protocol (SIP) for CodeCompanion

## Goal

Improve the in-app agent's reliability, safety, and maintainability without expanding scope into unrelated product roadmap work.

## Scope and Non-Goals

- Scope: agent chat/tool-call loop behavior, builtin tool safety gates, auditability, and regression coverage.
- Scope: planning and implementation steps mapped to existing repo files and test suites.
- Non-goal: redesigning unrelated UI features, introducing new product modes, or broad platform architecture rewrites.
- Non-goal: replacing current logging stack wholesale; improve existing logs and audit traces in-place.

## Phase 0 Ground Truth (verified in repo)

- Agent tool-call orchestration, round caps, and recovery notices already live in `lib/chat-post-handler.js`.
- Builtin terminal execution already enforces allowlist checks, cwd boundary checks, and optional confirm-before-run in `lib/builtin-agent-tools.js`.
- Terminal audit events are append-only JSON lines in `lib/terminal-audit.js`; app audit events are in `lib/audit-log.js`.
- Markdown rendering already sanitizes with `DOMPurify` in `src/components/MarkdownContent.jsx` (there is no `MarkdownPreview.jsx`).
- Test foundations already exist for agent guardrails and tool loop behavior in `tests/unit/chat-post-handler-guardrails.test.js`, `tests/unit/agent-loop-improvements.test.js`, and builtin tool tests.
- `npm test` runs Playwright (`package.json`), so plan validation must call explicit scripts (`test:unit`, `test:integration`, `test:ui`, `test:e2e`) instead of relying on `npm test` for all coverage.

## Execution Guard Template (applies to every SIP task)

- Trigger: clear condition that allows starting work (incident, metric drift, or explicit backlog item).
- Scope limit: files/symbols and behavioral boundaries that may be changed.
- Validation: required commands and acceptance checks before merge.
- Rollback: exact toggle/revert path to restore previous behavior quickly.
- Approval: who signs off before enabling broader rollout.
- Audit trail: what evidence must be recorded (logs, test output, note in journal/SIP updates).

## Workstream A - Tool-Call Loop Stability

Priority: Critical

### A1. Deterministic loop-stop behavior

- Trigger: repeated same-signature tool calls in a single turn, or user-reported "agent looping" regressions.
- Scope limit: `lib/chat-post-handler.js` loop-control and notice emission paths only.
- Repo actions:
  - Tighten duplicate signature handling and final-answer fallback criteria.
  - Keep max-round behavior bounded by existing settings (`agentMaxRounds`) and current hard cap.
  - Ensure user-visible SSE (Server-Sent Events) notices stay explicit when loops are interrupted.
- Validation:
  - `npm run test:unit -- tests/unit/chat-post-handler-guardrails.test.js`
  - `npm run test:unit -- tests/unit/agent-loop-improvements.test.js`
- Rollback:
  - Revert the loop-control patch commit only; retain unrelated test/docs changes.
  - If needed, temporarily lower rollout risk by reducing max rounds in settings (no code rollback required).
- Approval: maintainer review on loop behavior diff + one reproduced scenario from logs.
- Audit trail:
  - Save before/after log snippets showing round-limit or duplicate-loop handling.
  - Record final behavior notes in `journal/` daily entry.

### A2. Tool-result-to-final-answer continuity

- Trigger: turns ending with tool output but weak/no final assistant synthesis.
- Scope limit: final synthesis and fallback generation in `lib/chat-post-handler.js`.
- Repo actions:
  - Strengthen "final answer from accumulated tool results" conditions.
  - Keep browser-specific continuation behavior unchanged unless tests prove regression-safe.
- Validation:
  - Existing unit guardrail suites above.
  - One manual replay of a known tool-heavy prompt in local dev.
- Rollback: revert continuity patch if final answer quality regresses or tool loops increase.
- Approval: maintainer sign-off after manual replay and unit pass.
- Audit trail: attach replay prompt + observed SSE (Server-Sent Events) notice sequence to journal entry.

## Workstream B - Builtin Tool Safety Gates

Priority: Critical

### B1. Confirm-before-run and deny-path hardening

- Trigger: any denial ambiguity, missing reason text, or safety-policy bypass bug report.
- Scope limit: terminal command validation and confirmation flow in `lib/builtin-agent-tools.js`.
- Repo actions:
  - Keep fail-closed behavior when confirmation callback is missing/failing.
  - Normalize deny reason/action text so the assistant can relay exact actionable guidance.
  - Preserve project-folder and interaction-root boundaries.
- Validation:
  - `npm run test:unit -- tests/unit/builtin-agent-tools.test.js`
  - `npm run test:unit -- tests/unit/builtin-agent-tools-path.test.js`
  - `npm run test:unit -- tests/unit/builtin-agent-tools-background.test.js`
- Rollback:
  - Revert only builtin terminal gate changes.
  - Temporarily force `confirmBeforeRun=true` in config for extra safety if needed.
- Approval: security-focused review on deny/confirm paths.
- Audit trail: capture denied/approved command samples from `logs/terminal-audit.log`.

### B2. Scope-limited file/tool operations for self-improvement actions

- Trigger: self-improvement task needs automated file mutation or command execution.
- Scope limit: only files under configured project folder and active interaction root.
- Repo actions:
  - Re-verify path-resolution utilities used by builtins and app skills (`lib/agent-interaction-root.js`, `lib/agent-app-skills.js`).
  - Add/expand tests where relative-vs-absolute resolution could escape boundaries.
- Validation:
  - `npm run test:unit -- tests/unit/agent-app-skills.test.js`
  - `npm run test:unit -- tests/unit/agent-app-skill-envelope.test.js`
- Rollback: revert only path-validation changes if false positives block legitimate workflows.
- Approval: maintainer + one additional reviewer for path-boundary diffs.
- Audit trail: include boundary test outputs in PR description.

## Workstream C - Auditability and Evidence

Priority: High

### C1. Unified evidence checklist for agent incidents

- Trigger: any production/dev incident where agent behavior is disputed.
- Scope limit: documentation updates in `SIP.md`, `SIP.md`-referenced runbook notes, and minimal supporting docs only.
- Repo actions:
  - Define required evidence bundle: `CodeCompanion-Data/logs/app.log`, `CodeCompanion-Data/logs/debug.log`, `CodeCompanion-Data/logs/terminal-audit.log`, relevant test run output, repro prompt.
  - Keep field naming aligned with existing JSON-line entries in `lib/terminal-audit.js` and `lib/audit-log.js`.
- Validation: markdown-only review + one dry-run incident reconstruction.
- Rollback: remove checklist section if it conflicts with established runbooks.
- Approval: maintainer approval with one dry-run confirmation.
- Audit trail: log dry-run completion in journal.

### C2. Audit Logging Failure Mode (Security Enhancement)

- Trigger: disk full, permissions error, or other I/O failure during audit logging.
- Scope limit: `lib/terminal-audit.js` and `lib/audit-log.js`.
- Repo actions:
  - Implement fail-closed behavior: if audit logging fails, halt execution and return error.
  - Add secondary fallback: attempt console.error() + graceful degradation (continue with warning) if file logging completely fails.
  - Never lose evidence of agent actions; if logging fails, surface the failure clearly to the user.
- Validation:
  - Unit test for I/O error handling in audit paths.
  - Manual test: simulate disk full condition and verify error propagation.
- Rollback: revert audit failure-handling changes; revert to previous "silent failure" behavior if needed.
- Approval: security-focused review.
- Audit trail: document failure mode behavior in `docs/SECURITY-OPERATIONS.md`.

## Workstream D - Safe Rollout and Change Governance

Priority: High

### D1. Progressive rollout gates for self-improvement patches

- Trigger: patch changes agent behavior in tool-calling, command execution, or path boundaries.
- Scope limit: behavior flags and guarded code paths in existing config + handler files.
- Repo actions:
  - Require three promotion stages: local validation -> limited internal use -> default-on.
  - Document explicit stop conditions (loop frequency spike, deny-path regression, missing final answer synthesis).
  - Require a rollback owner for each change before rollout starts.
- Validation:
  - `npm run test:unit`
  - `npm run test:integration`
  - targeted Playwright run (`npm run test:ui` or `npm run test:e2e`) when UI-visible behavior changes.
- Rollback:
  - Immediate feature-flag disable or targeted revert commit.
  - Post-rollback incident note with root-cause hypothesis within same day.
- Approval: maintainer approval required at each promotion stage.
- Audit trail: keep a short rollout log in journal entries and reference associated PR/check outputs.

## Implementation Sequence (no scope expansion)

1. Workstream A (loop stability) and Workstream B (safety gates) first.
2. Workstream C (evidence checklist, audit failure mode) after A/B behavior is stable.
3. Workstream D applies to every A/B/C change and must be enforced before default-on rollout.

## Definition of Done

- No unresolved Critical/Major safety findings in affected workstreams.
- All required validation commands pass for changed areas.
- Rollback path tested or dry-run documented.
- Approval and audit trail artifacts are attached to the corresponding change.

## Open Questions (must be answered before broad rollout)

| Question                                                                                             | Owner  | Deadline   | Status  |
| ---------------------------------------------------------------------------------------------------- | ------ | ---------- | ------- |
| What quantitative threshold defines "loop frequency spike" for stop conditions?                      | @james | 2026-05-30 | Answered |
| Should confirm-before-run default to enabled in all environments, or remain deployment-configurable? | @james | 2026-05-30 | Answered |
| Which single owner is accountable for rollback execution during off-hours?                           | @james | 2026-05-30 | Answered |

### Answers (signed off 2026-05-24)

**Q1 — "loop frequency spike" threshold.** Reuse the loop's existing deterministic guards in `lib/chat-post-handler.js` instead of inventing a new metric. Define a **loop-terminated turn** as any turn that triggers (a) the identical-signature stop — same tool + same args repeated after a prior successful run, fires on 1 repeat; (b) the `tool_pattern` warning — same tool called ≥3× in a turn; or (c) `roundLimitHit:true` — the turn reached `MAX_ROUNDS` (`clamp(agentMaxRounds ‖ 10, 1, 25)`) without a natural final answer. **Stop condition (roll back):** ≥3 loop-terminated turns within any rolling 20-turn window, OR loop-terminated turns exceeding 10% of agent turns over a session. Baseline today is ~0 — these guards rarely fire in normal use. Measured from the existing `tool_pattern` SSE notices and `roundLimitHit` log lines; no new instrumentation required.

**Q2 — confirm-before-run default.** Remain **deployment-configurable**; a blanket "enabled in all environments" is unsafe because the gate fails closed (`lib/builtin-agent-tools.js` — if `confirmBeforeRun=true` with no `confirmCallback`, every command is denied), which would brick headless/CI/test and unattended self-improvement runs. Resolution: flip the **default to enabled** wherever a confirm callback is wired (Electron desktop + interactive web), and keep it **off by default** only where a confirmation cannot be presented (headless, CI, tests, unattended automation). Current code default is `false` in `lib/config.js`.

**Q3 — off-hours rollback owner.** Rollback requires no deploy — fast paths are config/flag toggles (force `confirmBeforeRun=true`, lower `agentMaxRounds`) or `git revert` of the single guarded commit. CodeCompanion is locally hosted (each user runs their own instance), so there is no shared production paging path; the only rollback with real blast radius is yanking/replacing a signed GitHub Release. **Accountable owner:** the change author owns code revert / flag-disable; **@james** is escalation and sole owner of any emergency GitHub Release yank or patch (release signer).

## Appendix: Glossary

- **SSE (Server-Sent Events):** A technology where the server pushes real-time updates to the browser over HTTP. Used in CodeCompanion for streaming assistant responses and progress notices to the UI.
- **Fail-Closed:** A security principle where the system denies an action by default if any safety check cannot be completed (e.g., if audit logging fails, deny the operation).
- **Journal Directory:** Located at `CodeCompanion-Data/logs/` in the project root, containing daily timestamped entries (`journal/YYYY-MM-DD.md`).
