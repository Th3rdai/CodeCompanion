---
phase: 04-actionable-guidance
plan: 02
subsystem: ui
tags: [react, model-tier, review-history, sidebar, deep-dive, lucide-react]

# Dependency graph
requires:
  - phase: 03-report-card-ui
    provides: ReviewPanel with report card display, ReportCard component, deep-dive conversation
provides:
  - Model tier system with empirical tier list and parameter-count fallback
  - Pre-review model warning with one-click Switch to better model
  - Post-review suspicion banner for weak models with all-A grades
  - Review history with overallGrade in sidebar listings
  - Colored grade badges (A-F) in sidebar for review entries
  - Deep-dive message persistence and restoration
affects: [05-polish, 06-testing]

# Tech tracking
tech-stack:
  added: []
  patterns: [model-tier-detection, suspicion-detection, incremental-history-save]

key-files:
  created: []
  modified:
    - src/components/ReviewPanel.jsx
    - src/components/Sidebar.jsx
    - src/App.jsx
    - lib/history.js

key-decisions:
  - "Empirical MODEL_TIERS object with strong/adequate/weak classifications based on known model capabilities"
  - "Parameter-count regex fallback for unknown models not in the tier list"
  - "Deep-dive messages persisted incrementally after each assistant response via setDeepDiveMessages callback"

patterns-established:
  - "Model tier detection: normalize model name, match against tier list, fallback to param count regex"
  - "Incremental history save: update specific fields in existing conversation without full re-save"

requirements-completed: [REVW-10, UX-05]

# Metrics
duration: 4min
completed: 2026-03-14
---

# Phase 4 Plan 2: Review History & Model Warnings Summary

**Empirical model tier system with pre/post-review warnings, sidebar grade badges, and deep-dive message persistence**

## Performance

- **Duration:** 217s (~4 min)
- **Started:** 2026-03-14T17:39:58Z
- **Completed:** 2026-03-14T17:43:35Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Replaced regex-based model warnings with empirical 3-tier system (strong/adequate/weak) covering 40+ model variants
- Added pre-review warning with "Switch" button that suggests and auto-selects best available installed model
- Added post-review suspicion banner detecting weak models with suspiciously good grades
- Sidebar now displays colored grade badges (A-F) for review history entries
- Deep-dive conversation messages persist to history after each response and restore on reload

## Task Commits

Each task was committed atomically:

1. **Task 1: Model tier system and enhanced warnings** - `62caa60` (feat)
2. **Task 2: Review history persistence with grade badge and deep-dive restore** - `9ecae81` (feat)

## Files Created/Modified
- `src/components/ReviewPanel.jsx` - MODEL_TIERS, getModelTier(), suggestBetterModel(), pre-review warning with Switch, post-review suspicion banner, deep-dive persistence
- `src/components/Sidebar.jsx` - Grade badge rendering with color-coded A-F grades
- `src/App.jsx` - Pass models/onSetSelectedModel/onUpdateReviewDeepDive to ReviewPanel, restore deepDiveMessages on load
- `lib/history.js` - Extract overallGrade from reviewData in listConversations

## Decisions Made
- Used empirical MODEL_TIERS object rather than purely regex-based detection for more accurate model classification
- Parameter-count regex serves as fallback for models not in the tier list
- Deep-dive messages saved incrementally (after each response) rather than on unmount to prevent data loss
- AlertTriangle and History icons from lucide-react replace emoji warning icons per skill guidelines

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Review mode now fully persistent with grade badges and model-aware warnings
- Deep-dive conversations survive browser refresh and history navigation
- Ready for Phase 5 polish and Phase 6 testing

---
*Phase: 04-actionable-guidance*
*Completed: 2026-03-14*
