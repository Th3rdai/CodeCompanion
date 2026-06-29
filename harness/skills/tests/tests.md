---
name: tests
description: "Write and run tests for harness outputs. Use when creating test cases, running test suites, or checking coverage."
---

# Skill: Testing

## Purpose

Write and run tests for code, plans, and agent outputs produced by the harness.

## When to Apply

- After building a feature (write tests)
- Before marking a run complete (run tests)
- When creating eval cases for a new skill
- When checking test coverage

## Procedure

1. **Identify scope** — What needs testing (unit, integration, e2e)
2. **Write tests** — Create test files following project conventions
3. **Run tests** — Execute the test suite via `builtin.run_terminal_cmd`
4. **Check coverage** — Run coverage reports if configured
5. **Report results** — Pass/fail counts, coverage percentage
6. **Fix failures** — Address any failing tests before proceeding
