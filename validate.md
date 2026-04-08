---
description: Project-specific validation for Th3rdAI Code Companion (lint, typing, tests, E2E)
---

# Validate Th3rdAI Code Companion

> Run from project root. This validates the React + Node.js codebase through linting, type checking, formatting, unit tests, and E2E tests.

## Phase 1: Linting

`npm run lint`

Expected: ESLint passes with zero errors/warnings

## Phase 2: Type Checking

`npm run typecheck`

Expected: TypeScript compiler reports zero type errors

## Phase 3: Style/Formatting

`npm run format:check`

Expected: Prettier reports all files formatted correctly

## Phase 4: Unit Testing

`npm run test:unit`

Expected: All unit tests pass (Node.js built-in test runner)

**Coverage areas:**

- tests/unit/\*.test.js - Core utilities
- tests/rate-limit.test.js - Rate limiting logic
- tests/mcp-security.test.js - MCP security validation
- tests/tone-validation.test.js - Tone validation
- tests/ui-labels.test.js - UI label validation

## Phase 5: End-to-End / Integration

`npm run test:e2e`

Expected: Playwright E2E tests pass in Chromium

## Summary

Validation passes when all phases succeed.

```bash
# Canonical local validation command (all phases in one line)
npm run lint && npm run typecheck && npm run format:check && npm run test:unit && npm run test:e2e
```

## Journal Entry (required after running)

1. **Ensure `journal/` exists:** `mkdir -p journal`
2. **Append one line to `journal/YYYY-MM-DD.md`** (today's date):
   `HH:MM | Pass/Fail | E:N W:M | P1:OK P2:OK P3:OK P4:OK P5:OK | optional note`
