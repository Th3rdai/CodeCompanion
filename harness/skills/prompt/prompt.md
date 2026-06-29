---
name: prompt
description: "Design and iterate on AI prompts. Use when creating, refining, or versioning prompts for agents."
---

# Skill: Prompt Design

## Purpose

Design, iterate, and version prompts for AI agents in the harness.

## When to Apply

- Creating a new prompt for an agent role
- Refining an existing prompt based on eval results
- Versioning prompts in `harness/prompts/<agent>/`

## Procedure

1. **Identify agent** — Determine which agent the prompt is for
2. **Read existing** — Check `harness/prompts/<agent>/` for existing versions
3. **Draft prompt** — Write the prompt following the agent contract
4. **Test prompt** — Run a test case from `harness/evals/cases/`
5. **Iterate** — Refine based on test results
6. **Version** — Save the new version in `harness/prompts/<agent>/`
