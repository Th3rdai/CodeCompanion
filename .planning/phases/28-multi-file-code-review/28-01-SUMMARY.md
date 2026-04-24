---
phase: 28-multi-file-code-review
plan: "01"
subsystem: api
tags: [review, multi-file, folder-scan, express, node-test, sse]

# Dependency graph
requires:
  - phase: 28-multi-file-code-review
    provides: Wave 0 test stubs for review-files unit tests and review-folder integration tests

provides:
  - reviewFiles() exported from lib/review.js — concatenates files with FILE separators, scales timeout, calls reviewCode()
  - POST /api/review/folder/preview — returns file list JSON for a local folder path
  - POST /api/review/folder — runs reviewFiles() and returns a report-card result (with SSE fallback)

affects:
  - 28-02-PLAN (UI plan depends on these endpoints)
  - routes/review.js
  - lib/review.js

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Clone-and-adapt pentest/folder pattern for review/folder routes
    - Timeout scaling formula: Math.min(base * ceil(count/5), 600000) for multi-file ops
    - SSE fallback path with req.on('close') abort support

key-files:
  created:
    - tests/unit/review-files.test.js (unskipped — 5 tests now active)
  modified:
    - lib/review.js
    - routes/review.js

key-decisions:
  - "reviewFiles() passes combined string directly to reviewCode() with filename set to '{N} files' — no changes to reviewCode()"
  - "Integration test stubs remain skipped — require live server + Ollama; manual curl verification available"
  - "Auto-model resolution for folder route uses mode: 'review' (not 'pentest')"

patterns-established:
  - "Multi-file concatenation format: // --- FILE: path --- + backtick fences, joined with double newline"
  - "Folder route meta payload: { fileCount, totalSize, skipped, folder } appended to result"

requirements-completed:
  - MREV-01

# Metrics
duration: 6min
completed: 2026-04-09
---

# Phase 28 Plan 01: Multi-File Review Backend Summary

**reviewFiles() function + /api/review/folder/preview + /api/review/folder endpoints using clone-and-adapt of pentest/folder pattern**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-09T21:53:05Z
- **Completed:** 2026-04-09T22:00:07Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `reviewFiles(ollamaUrl, model, files, opts)` to `lib/review.js` with file separator format, preamble instruction, and scaled timeout
- Unskipped all 5 unit tests in `tests/unit/review-files.test.js` — all pass green
- Added `POST /api/review/folder/preview` returning file list (path + size) for a folder path
- Added `POST /api/review/folder` with auto-model resolution (mode: 'review'), meta payload, and full SSE fallback path with abort support
- Updated `module.exports` in `lib/review.js` to export `reviewFiles` alongside `reviewCode` and `getTimeoutForModel`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add reviewFiles() to lib/review.js** - `d3940af` (feat)
2. **Task 2: Add /api/review/folder/preview and /api/review/folder routes** - `76023b4` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `lib/review.js` — added `reviewFiles()` function and updated exports
- `routes/review.js` — added `readFolderFiles` + `reviewFiles` imports and two new route handlers
- `tests/unit/review-files.test.js` — unskipped all 5 test stubs (5/5 pass)

## Decisions Made

- `reviewFiles()` delegates to the existing `reviewCode()` unchanged — combined string is passed as `code`, `filename` set to `"N files"`, and `timeoutMs` overrides the per-call default. No modifications to `reviewCode()`.
- Integration tests (`tests/integration/review-folder.test.js`) remain skipped — they require a live server spawn and Ollama connection. Manual curl verification works against a running instance.
- Auto-model resolution in the folder route uses `mode: "review"` (matching the single-file route), not `"pentest"`.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend foundation complete — `reviewFiles()` and both folder endpoints are live
- Plan 02 (UI) can now implement the Scan Folder tab in ReviewPanel against these endpoints
- Integration tests can be unskipped manually once a running server + Ollama instance is available

---

_Phase: 28-multi-file-code-review_
_Completed: 2026-04-09_
