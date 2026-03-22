# IDE workflow commands (`IDE_COMMANDS/`)

The **`IDE_COMMANDS/`** directory contains **markdown command templates** for AI-assisted IDEs (Cursor, Claude Code, VS Code Copilot, OpenCode). They are **not** shell commands in this repo — they are instructions that get **copied into each new project** when you use Create or Build mode, and can be installed manually into `.cursor/commands/`, `.claude/commands/`, etc.

## Canonical documentation

See **[`IDE_COMMANDS/README.md`](../IDE_COMMANDS/README.md)** for:

- What each `.md` file does (PRD, PRP, validate, e2e-test, …)
- How to copy files into a project’s IDE command folders
- Suggested folder layout (`PRDs/`, `PRPs/`, `journal/`, …)

## Relationship to Code Companion

When you scaffold a project in **Create** or **Build**, the app copies these files (and optional templates from your **Create template path**) into the new project’s IDE paths. The app root **`IDE_COMMANDS/`** is the **source of truth** for those templates.

## `INSTALL.sh`

`IDE_COMMANDS/INSTALL.sh` is a helper script referenced in the README inside that folder for batch copying commands into a target project — read `IDE_COMMANDS/README.md` for usage.
