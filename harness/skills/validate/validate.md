---
name: validate
description: "Scan the project for validation configs (linters, type checkers, test runners, CI/CD) and generate a validate command file."
---

# Skill: Validate Project

## Purpose

Discover validation configs in a project and generate a phased validate.md command file tailored to its linters, type checkers, test runners, and CI configs.

## When to Apply

- User asks to validate a project
- User wants to know what linters/test runners are configured
- User wants a validate.md command file generated
- Before running CI to check if gates will pass

## Inputs

- Project folder (defaults to the active File Browser folder)
- Optional: save path for the generated validate.md

## Outputs

- List of discovered validation configs
- Generated validate.md command file (if requested)
- Validation status report

## Procedure

1. **Scan project** — Call `builtin.validate_scan_project` on the target folder
2. **Report findings** — List discovered linters, type checkers, test runners, CI configs
3. **Generate command** — Optionally call `builtin.validate_generate_command` to create validate.md
4. **Run validation** — Optionally run the validation commands
5. **Report results** — Pass/fail status per validation step

## Tool Binding

- `builtin.validate_scan_project` — Discover validation configs
- `builtin.validate_generate_command` — Generate validate.md
- `builtin.run_terminal_cmd` — Run validation commands
