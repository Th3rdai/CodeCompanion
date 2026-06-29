---
description: Execute a phase's plan (Builder agent) — usage: /harness:build <phase-number>
---

# Harness: Build Phase

Execute the plan for phase **$ARGUMENTS** of this th3rdai-harness project.

## What this does

1. Read `.planning/phases/phase-$ARGUMENTS-ai-plan.md` (created by `/harness:plan`).
   If it is missing, run `/harness:plan $ARGUMENTS` first.
2. As the **Builder** agent, implement the plan task by task: write/edit the files it specifies,
   keeping changes scoped to the plan.
3. Validate as you go (run the project's tests / lint where applicable).
4. Write a short summary of what was built to `.planning/phases/phase-$ARGUMENTS-summary.md`.
5. Update `.planning/STATE.md` (Current Position, Last activity). Mark the phase `[x]` in
   `.planning/ROADMAP.md` only once its success criteria are met.

## Output

Working changes for phase **$ARGUMENTS** plus `.planning/phases/phase-$ARGUMENTS-summary.md`.

## Next

Run `/harness:review $ARGUMENTS` to verify the work.
