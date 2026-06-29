---
name: debug
description: "Debug issues in code or harness outputs. Use when diagnosing errors, fixing bugs, or troubleshooting."
---

# Skill: Debug

## Purpose

Systematically diagnose and fix issues in code, plans, or harness outputs.

## When to Apply

- A test fails and needs diagnosis
- Code throws an error that needs investigation
- A plan produces unexpected results
- Troubleshooting harness configuration issues

## Procedure

1. **Reproduce** — Confirm the issue is reproducible
2. **Isolate** — Narrow down the root cause
3. **Read code** — Use `builtin.read_file` and `builtin.search_files`
4. **Hypothesize** — Form a theory about the cause
5. **Fix** — Apply the fix using `builtin.edit_file`
6. **Verify** — Re-run the failing test or command
7. **Document** — Note the root cause and fix for future reference
