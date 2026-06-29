---
description: Research a phase before planning (Researcher agent) — usage: /harness:research <phase-number>
---

# Harness: Research Phase

Research phase **$ARGUMENTS** of this th3rdai-harness project before planning it.

## What this does

1. Read `.planning/ROADMAP.md` and find phase **$ARGUMENTS** (its goal + success criteria).
2. Read `.planning/PROJECT.md` and `.planning/STATE.md` for context.
3. As the **Researcher** agent: gather what is needed to plan this phase —
   key technical decisions, dependencies, risks, and a suggested approach.
   Use codebase search and (if available) web/MCP research tools.
4. Write findings to `.planning/research/phase-$ARGUMENTS-research.md` (create the folder if needed).
5. Summarize the findings and open questions for the user.

## Output

A concise research note that the planner can turn into a concrete plan.

## Next

Run `/harness:plan $ARGUMENTS` to turn this research into a plan.
