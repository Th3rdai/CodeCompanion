---
description: Create a concrete plan for a phase (Planner agent) — usage: /harness:plan <phase-number>
---

# Harness: Plan Phase

Create a concrete, executable plan for phase **$ARGUMENTS** of this th3rdai-harness project.

## What this does

1. Read `.planning/ROADMAP.md` (phase **$ARGUMENTS** goal + success criteria), `.planning/STATE.md`,
   and any `.planning/research/phase-$ARGUMENTS-research.md` from `/harness:research`.
2. As the **Planner** agent, produce a plan with:
   - **Goal** for the phase
   - **Tasks** — each with specific file paths and concrete actions
   - **Success criteria** (testable)
   - **Estimated complexity** and risks
3. Write the plan to `.planning/phases/phase-$ARGUMENTS-ai-plan.md`.
4. Self-check the plan for Clarity, Feasibility, Completeness, and Structure before finishing.

## Output

`.planning/phases/phase-$ARGUMENTS-ai-plan.md` — the Build dashboard reads this back as the phase's plan.

## Next

Run `/harness:build $ARGUMENTS` to execute the plan.
