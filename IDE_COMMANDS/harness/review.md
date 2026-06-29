---
description: Verify a phase's work against its success criteria (Reviewer agent) — usage: /harness:review <phase-number>
---

# Harness: Review Phase

Verify that phase **$ARGUMENTS** of this th3rdai-harness project is complete and correct.

## What this does

1. Read phase **$ARGUMENTS** in `.planning/ROADMAP.md` (its success criteria),
   `.planning/phases/phase-$ARGUMENTS-ai-plan.md`, and `.planning/phases/phase-$ARGUMENTS-summary.md`.
2. As the **Reviewer** agent, check the actual changes against the plan and success criteria:
   correctness, completeness, security, and test coverage. Grade A–F per dimension.
3. List any gaps or follow-ups. If the phase passes, mark it `[x]` in `.planning/ROADMAP.md`
   and advance `.planning/STATE.md` to the next phase.
4. If it does not pass, summarize what is missing and recommend `/harness:build $ARGUMENTS` again
   (or `/harness:plan $ARGUMENTS` if the plan itself was wrong) — this is the Iteration loop.

## Output

A review verdict (pass/fail + grades) and an updated roadmap/state.

## Next

If passing, continue with `/harness:research`, `/harness:plan`, or `/harness:build` for the next phase.
