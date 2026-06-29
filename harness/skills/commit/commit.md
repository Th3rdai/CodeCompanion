---
name: commit
description: "Commit changes with conventional commit messages. Use when finalizing a phase or slice of work."
---

# Skill: Commit

## Purpose

Stage and commit changes with well-structured conventional commit messages.

## When to Apply

- After completing a phase or slice of work
- Before merging a branch
- When the user asks to commit changes

## Procedure

1. **Check status** — Run `git status` to see what changed
2. **Stage files** — `git add` the relevant files
3. **Write message** — Format: `type(scope): description`
4. **Commit** — Run `git commit -m "<message>"`
5. **Verify** — Run `git log --oneline -1` to confirm
