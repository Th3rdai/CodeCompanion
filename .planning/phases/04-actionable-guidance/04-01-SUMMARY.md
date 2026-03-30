---
phase: 04-actionable-guidance
plan: 01
subsystem: ui, api
tags: [review, fix-prompts, clipboard, lucide, zod, ollama]

# Dependency graph
requires:
  - phase: 03-report-card-ui
    provides: ReportCard component, FindingCard, review schema
provides:
  - fixPrompt field in FindingSchema and JSON schema
  - LLM instructions to generate natural-language fix prompts
  - FixPromptBlock UI in FindingCard with per-finding copy
  - "Copy All Fix Prompts" bulk copy button in report card header
  - Configurable Toast duration prop
affects: [04-actionable-guidance]

# Tech tracking
tech-stack:
  added: []
  patterns: [fallback-prompt-generation, bulk-copy-pattern, severity-sorted-prompts]

key-files:
  created: []
  modified:
    - lib/review-schema.js
    - lib/prompts.js
    - src/components/ReportCard.jsx
    - src/components/Toast.jsx

key-decisions:
  - "Fallback fix prompts generated from finding title+explanation when LLM omits fixPrompt"
  - "Bulk copy sorts prompts by severity (critical first) for prioritized AI fixing"
  - "Replaced emoji Copy/Fix icons with Lucide Clipboard/ClipboardCopy per UI skill rules"

patterns-established:
  - "Fallback prompt pattern: generate actionable text from existing data when LLM field is missing"
  - "Bulk copy pattern: buildBulkFixPrompts aggregates across categories, sorts by severity"

requirements-completed: [REVW-06]

# Metrics
duration: 2min
completed: 2026-03-14
---

# Phase 4 Plan 1: Fix Prompts Summary

**End-to-end fix prompts: schema fixPrompt field, LLM prompt instructions, per-finding copy blocks, and bulk "Copy All" button with severity-sorted output**

## Performance

- **Duration:** 141s (~2 min)
- **Started:** 2026-03-14T17:40:00Z
- **Completed:** 2026-03-14T17:42:21Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Extended FindingSchema with optional fixPrompt field, auto-included in JSON schema for Ollama structured output
- Updated review system prompt to instruct LLM to generate context-aware, natural-language fix prompts referencing the filename
- Added FixPromptBlock UI in each FindingCard with "What to ask your AI to fix" label and per-finding copy button
- Added fallback prompt generation from title+explanation when LLM omits fixPrompt
- Added "Copy All Fix Prompts" button in report card header that aggregates all prompts sorted by severity
- Made Toast duration configurable via prop (default 3000ms, was hardcoded 2500ms)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fixPrompt to schema and review system prompt** - `7fe6579` (feat)
2. **Task 2: Add fix prompt blocks, bulk copy, and configurable Toast** - `d9b74e9` (feat)

## Files Created/Modified

- `lib/review-schema.js` - Added optional fixPrompt field to FindingSchema
- `lib/prompts.js` - Updated review system prompt with fixPrompt generation instructions
- `src/components/ReportCard.jsx` - FixPromptBlock UI, buildBulkFixPrompts, Copy All button, updated CopyFixButton
- `src/components/Toast.jsx` - Configurable duration prop (default 3000ms)

## Decisions Made

- Fallback fix prompts generated from finding title+explanation when LLM omits fixPrompt field
- Bulk copy sorts prompts by severity (critical first) so user addresses most important issues first
- Replaced emoji icons (clipboard emoji) with Lucide Clipboard/ClipboardCopy SVG icons per UI skill no-emoji-icons rule

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added cursor-pointer to interactive buttons**

- **Found during:** Task 2 (ReportCard UI)
- **Issue:** Interactive buttons missing cursor-pointer class per UI skill rules
- **Fix:** Added cursor-pointer to CopyFixButton, Copy All button, and deep-dive button
- **Files modified:** src/components/ReportCard.jsx
- **Verification:** Build passes, classes present
- **Committed in:** d9b74e9 (Task 2 commit)

**2. [Rule 1 - Bug] Removed emoji from "Ask about this finding" button**

- **Found during:** Task 2 (ReportCard UI)
- **Issue:** Deep-dive button used magnifying glass emoji, violates no-emoji-icons UI rule
- **Fix:** Removed emoji prefix from button text
- **Files modified:** src/components/ReportCard.jsx
- **Verification:** Build passes
- **Committed in:** d9b74e9 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Minor UI quality improvements aligned with project skill rules. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Fix prompts fully wired end-to-end: schema -> LLM prompt -> UI display -> clipboard copy
- Ready for Plan 02 (if applicable) or next phase work
- Existing reviews without fixPrompt field will show fallback prompts from explanation text

---

_Phase: 04-actionable-guidance_
_Completed: 2026-03-14_
