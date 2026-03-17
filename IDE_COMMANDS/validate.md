---
description: Project-specific validation for Akassets Query agent (lint, typing, tests, workflow E2E)
---

# Validate Akassets AI Agent

> **Project-specific example.** This command is tailored to the Akassets Query agent. For other projects, run `/generate-validate` to create a project-specific `/validate` command.

> Run from project root. This validates the real user workflow for local LLMs (Ollama/LM Studio), Akassets GraphQL reachability, and CLI query execution.

## Phase 1: Linting
!`./venv/bin/python -m ruff check .`

Expected: `All checks passed!`

## Phase 2: Type Checking
!`./venv/bin/python -m mypy .`

Expected: `Success: no issues found in N source files`

## Phase 3: Unit Testing
!`./venv/bin/python -m pytest -q`

Expected: all tests pass (currently 47).

**Coverage areas:**
- `tests/test_settings.py` — env loading/defaults
- `tests/test_tools.py` — GraphQL tool paths, mTLS fallback, field/category validation
- `tests/test_main.py` — tool-call fallback parsing, cert-gate behavior
- `tests/test_agent.py` — deps wiring and agent registration

## Phase 4: End-to-End Smoke Tests

### 4a: Workflow smoke script (full stack check)
!`AKASSETS_LLM_MODEL=qwen2.5-coder:7b AKASSETS_LLM_TIMEOUT_SECONDS=180 ./scripts/smoke.sh`

Expected: all smoke checks pass (venv, LLM reachability, GraphQL direct call, full agent query).

### 4b: Direct CLI query workflow
!`AKASSETS_LLM_TIMEOUT_SECONDS=180 ./venv/bin/python -m agent.main --query "how many hardware assets?"`

Expected: non-empty agent response (or explicit environment/auth error with clear message).

### 4c: REPL workflow entry/exit
!`printf 'how many hardware assets?\n/clear\nquit\n' | AKASSETS_LLM_TIMEOUT_SECONDS=180 ./venv/bin/python -m agent.main`

Expected: REPL starts, responds once, accepts `/clear`, exits cleanly.

### 4d: Local LLM endpoint health (only if using local base URL)
!`curl -sf --max-time 10 http://localhost:11434/api/tags >/dev/null && echo "Ollama reachable" || echo "Skipped: local LLM not enabled"`

Expected: `Ollama reachable` when local mode is configured.

## Summary

Validation passes when Phases 1-4 succeed.

```bash
# Canonical local validation command
./venv/bin/python -m ruff check . && ./venv/bin/python -m pytest -q && ./venv/bin/python -m mypy .
```

## Journal Entry (required after running)

1. **Ensure `journal/` exists:** `mkdir -p journal`
2. **Append one line to `journal/YYYY-MM-DD.md`** (today's date):
   `HH:MM | Pass/Fail | E:N W:M | P1:OK P2:OK P3:OK P4:OK | optional note`
   Example: `14:30 | Pass | E:0 W:0 | P1:OK P2:OK P3:OK P4:OK | 47 tests, smoke green`
3. **Update `journal/README.md`:** One line per date with latest outcome.
