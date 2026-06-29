---
description: Initialize this th3rdai-harness project — confirm roadmap, requirements, and state
---

# Harness: New Project

Initialize (or re-orient) this th3rdai-harness project so it is ready to build.

## What this does

1. Read `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, and `.planning/STATE.md`.
2. Confirm the project identity (What This Is, Core Value) and the 7-stage lifecycle roadmap:
   Task Definition → Agent Design → Prompt Design → Tool Integration → Evaluation → Iteration → Release.
3. Fill any obvious gaps in PROJECT.md / REQUIREMENTS.md based on the user's intent.
4. Set `.planning/STATE.md` "Current Position" to Phase 1 (Task Definition) if it is still at scaffold defaults.
5. Summarize the plan and the recommended first phase to the user.

## Agent roles

Planner leads; Researcher assists with any unknowns. Keep edits inside `.planning/`.

## Next

When the roadmap and requirements look right, run `/harness:research 1` or `/harness:plan 1`.
