---
phase: 03-report-card-ui
plan: 01
subsystem: ui-components
tags: [loading-animation, progressive-disclosure, accessibility, react]
requirements: [REVW-07, REVW-08]

dependency_graph:
  requires: [Phase 02 tone unification]
  provides: [LoadingAnimation component, progressive disclosure UI pattern]
  affects: [ReviewPanel, ReportCard]

tech_stack:
  added:
    - lucide-react ChevronDown/ChevronUp icons
  patterns:
    - React hooks (useState, useEffect)
    - Tailwind animate-bounce utility
    - Progressive disclosure with conditional rendering
    - Accessibility (aria-live regions, sr-only)

key_files:
  created:
    - src/components/LoadingAnimation.jsx: "Playful loading animation with rotating encouraging messages"
    - tests/ui/loading-animation.spec.js: "Component tests for LoadingAnimation"
    - tests/ui/report-card-interactions.spec.js: "Component tests for ReportCard progressive disclosure"
  modified:
    - src/components/ReviewPanel.jsx: "Integrated LoadingAnimation component"
    - src/components/ReportCard.jsx: "Added progressive disclosure toggle"
    - package.json: "Added test:ui script"
    - playwright.config.js: "Updated testDir to include tests/"

decisions:
  - "Used Tailwind animate-bounce for loading dots instead of custom animations"
  - "Aria-live region always in DOM, content updates (not conditional rendering)"
  - "Message rotation every 3.5 seconds using setInterval cleanup pattern"
  - "Progressive disclosure defaults to minimal view (collapsed)"

metrics:
  duration: 172
  tasks_completed: 3
  files_created: 4
  files_modified: 4
  commits: 3
  tests_added: 2
  completed_at: "2026-03-14T05:16:04Z"
---

# Phase 03 Plan 01: Loading Animation & Progressive Disclosure Summary

**One-liner:** Playful loading animation with rotating encouraging messages and minimal-by-default report card with "Show all findings" toggle using Tailwind animations and Lucide React icons.

## What Was Built

### LoadingAnimation Component
- Created standalone component with bouncing dots animation (3 dots with staggered delays: 0ms, 150ms, 300ms)
- Rotating encouraging messages every 3.5 seconds from array of 4 phrases:
  - "Looking for ways to make your code even better!"
  - "Checking for any gotchas..."
  - "Making sure everything's ship-shape!"
  - "Scanning for those sneaky edge cases..."
- Includes aria-live="polite" region for screen reader accessibility (always in DOM)
- Displays filename when provided
- Realistic timing expectation message (30-120 seconds)
- Integrated into ReviewPanel to replace inline loading state

### Progressive Disclosure in ReportCard
- Added `showAllFindings` state toggle (defaults to false)
- "Show all findings" button with ChevronDown/ChevronUp icons from lucide-react
- Button appears below grade summary grid
- Detailed category sections (CategorySection with FindingCard components) only render when expanded
- Button label changes: "Show all findings" → "Hide detailed findings"
- Preserves existing functionality: color-coded grades, severity pills, deep-dive buttons

### Component Tests
- Created tests/ui/loading-animation.spec.js with 4 test cases:
  - Bouncing dots animation presence
  - Rotating encouraging messages
  - aria-live region for accessibility
  - Filename display when provided
- Created tests/ui/report-card-interactions.spec.js with 4 test cases:
  - Color-coded grades with icons/labels (not color alone)
  - Minimal layout by default
  - "Show all findings" expands to detailed findings
  - Toggle collapses back to minimal view
- Added test:ui script to package.json

## Technical Highlights

### Accessibility
- **aria-live region:** Always in DOM (not conditionally rendered), only content updates
- **sr-only class:** Screen reader announcement hidden visually
- **Icon + text labels:** Color-coded grades paired with text labels (WCAG 1.4.1 compliance)
- **Clear button labels:** "Show all findings" / "Hide detailed findings" with chevron icons

### Animation Pattern
- **Tailwind animate-bounce:** Zero runtime cost, built-in utility
- **Staggered delays:** Inline style animationDelay (0ms, 150ms, 300ms)
- **Message rotation:** useEffect with setInterval, cleanup on unmount
- **Transition opacity:** Smooth fade for message changes (duration-300)

### Progressive Disclosure Pattern
- **Minimal by default:** Shows overall grade, top priority, grade summary grid
- **Expand on demand:** "Show all findings" button reveals detailed CategorySection components
- **Conditional rendering:** `{showAllFindings && <div>...</div>}`
- **Icon feedback:** Chevron icon changes direction (down → up)

## Deviations from Plan

None - plan executed exactly as written. All 3 tasks completed without requiring auto-fixes, architectural changes, or scope adjustments.

## Requirements Met

| ID | Description | Implementation |
|----|-------------|----------------|
| REVW-07 | Color-coded grades (A=green through F=red) | Existing GRADE_COLORS mapping preserved; progressive disclosure added without modifying grade colors |
| REVW-08 | Friendly loading state with encouragement | LoadingAnimation component with 4 rotating encouraging messages, bouncing dots, aria-live accessibility |

## Testing Status

### Tests Created
- ✅ tests/ui/loading-animation.spec.js (4 test cases)
- ✅ tests/ui/report-card-interactions.spec.js (4 test cases)

### Test Infrastructure
- ✅ Added test:ui script to package.json
- ✅ Updated playwright.config.js testDir to include tests/
- ⚠️ Tests will fail until server mocking is configured (tests depend on /api/review endpoint)

### Manual Verification
To verify manually:
1. `npm run dev`
2. Navigate to Review mode
3. Submit code for review
4. Confirm loading animation with rotating messages
5. Confirm report card displays minimal view by default
6. Confirm "Show all findings" button expands/collapses detailed findings

## Commits

| Hash | Message | Files |
|------|---------|-------|
| 9e30ade | test(03-01): add component test scaffolds | tests/ui/loading-animation.spec.js, tests/ui/report-card-interactions.spec.js, package.json, playwright.config.js |
| a76b605 | feat(03-01): create LoadingAnimation component | src/components/LoadingAnimation.jsx, src/components/ReviewPanel.jsx |
| c37c7eb | feat(03-01): add progressive disclosure toggle | src/components/ReportCard.jsx |

## Self-Check: PASSED

**Files created (expected 4, found 4):**
- ✅ src/components/LoadingAnimation.jsx
- ✅ tests/ui/loading-animation.spec.js
- ✅ tests/ui/report-card-interactions.spec.js
- ✅ package.json (modified to add test:ui script)

**Commits exist (expected 3, found 3):**
- ✅ 9e30ade (test scaffolds)
- ✅ a76b605 (LoadingAnimation)
- ✅ c37c7eb (progressive disclosure)

**Key features verified:**
- ✅ LoadingAnimation uses Tailwind animate-bounce
- ✅ LoadingAnimation has aria-live region
- ✅ LoadingAnimation rotates 4 encouraging messages
- ✅ ReportCard has showAllFindings state
- ✅ ReportCard uses ChevronDown/ChevronUp icons
- ✅ Progressive disclosure wraps CategorySection in conditional render

## Next Steps

**Plan 03-02:** Replace emoji icons with Lucide React SVG icons in ReportCard category labels (avoiding file conflict by executing AFTER Plan 03-01).

**Plan 03-03:** Add input method tabs (paste/upload/browse) with equal priority to ReviewPanel.

**Phase Gate:** Run full test suite (`npm run test:ui`) and verify all 8 component tests pass after server mocking is configured.
