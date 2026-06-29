---
name: run
description: "Run development servers and long-running processes. Use when starting a dev server, watcher, or background process."
---

# Skill: Run

## Purpose

Start and manage development servers, watchers, and long-running processes.

## When to Apply

- Starting the CodeCompanion dev server
- Running a watcher for file changes
- Starting a background process

## Procedure

1. **Identify command** — Determine the command to run
2. **Use background mode** — Always use `background: true` for long-running processes
3. **Verify startup** — Use `builtin.tail_process_output` to confirm the server started
4. **Monitor** — Check output periodically
5. **Stop** — Use `builtin.kill_process` when done
