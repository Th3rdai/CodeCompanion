---
name: revise
description: "Revise and iterate on harness outputs. Use when refining code, plans, or prompts based on feedback."
---

# Skill: Revise

## Purpose

Iterate on harness outputs based on evaluation feedback, review comments, or test results.

## When to Apply

- After an evaluation produces suggestions
- After a review identifies issues
- When iterating on a plan or prompt

## Procedure

1. **Receive feedback** — Accept evaluation results or review comments
2. **Read current output** — Use `builtin.read_file` to see the current state
3. **Apply changes** — Use `builtin.edit_file` to make targeted edits
4. **Re-evaluate** — Run the evaluation again to verify improvements
5. **Document changes** — Note what changed and why
