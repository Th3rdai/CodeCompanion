---
phase: 02-tone-unification
plan: 02
subsystem: ui-labels
tags: [ui, ux, tone, accessibility, vibe-coder]
requirements:
  - UX-02
dependencies:
  requires:
    - 02-01-SUMMARY.md (system prompts rewritten for vibe-coder audience)
  provides:
    - Jargon-free UI labels matching prompt tone
    - Vibe-coder placeholder text (no PM language)
    - Automated UI label validation tests
  affects:
    - src/App.jsx (MODES array)
    - User navigation experience (mode labels)
    - Input placeholder guidance
tech_stack:
  added: []
  patterns:
    - Node.js native test (node:test) for UI validation
    - Regex-based parsing of MODES array from source
key_files:
  created:
    - tests/ui-labels.test.js (UI label validation tests)
  modified:
    - src/App.jsx (MODES array labels and placeholders)
decisions:
  - Translation mode labels use arrow style (Code → Plain English, Idea → Code Spec) for transformation clarity
  - Placeholders reference "AI coding tool" instead of "dev team" to match vibe-coder audience
  - Chat placeholder changed from "PM life" to "building with AI"
  - Other labels (Chat, Explain This, Safety Check, etc.) kept unchanged as already vibe-coder friendly
metrics:
  duration_seconds: 83
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  commits: 2
  tests_added: 5
  completed_at: "2026-03-14T04:14:09Z"
---

# Phase 02 Plan 02: UI Label Tone Unification Summary

**One-liner:** Replaced PM jargon ("Tech → Biz", "dev team") in mode labels and placeholders with vibe-coder language ("Code → Plain English", "AI coding tool"), validated by automated tests.

## What Was Done

### Task 0: Create UI Label Validation Test Scaffold

**Status:** Complete
**Commit:** `0f285b0`

Created `tests/ui-labels.test.js` with Node.js native test framework (`node:test`) to validate MODES array:

- Parses MODES array from App.jsx using regex
- Tests for jargon in labels (Tech, Biz, API, Deploy)
- Tests for PM language in placeholders (dev team, stakeholder, leadership)
- Tests for verb-led or transformation-clear labels
- Tests for vibe-coder appropriate placeholders

Tests initially failed (as expected in Wave 0), detecting:

- "Tech → Biz" contains jargon "tech"
- "translate-biz" placeholder contains PM term "dev team"

### Task 1: Update Mode Labels and Placeholders (TDD)

**Status:** Complete
**Commit:** `9b0e67c`

Updated MODES array in `src/App.jsx` with vibe-coder language:

**Label Changes:**

1. `translate-tech`: "Tech → Biz" → "Code → Plain English"
   - Clearer transformation description
   - No PM/technical jargon
   - User understands they'll get plain English explanation

2. `translate-biz`: "Biz → Tech" → "Idea → Code Spec"
   - Clearer transformation description
   - Removes PM jargon ("Biz")
   - Describes what user provides (idea) and receives (code spec)

**Placeholder Changes:**

1. `chat`: "Ask about tech, PM life..." → "Ask about code, building with AI..."
   - Removed PM-specific reference
   - Aligned with vibe-coder audience

2. `translate-tech`: "...something anyone can understand" → "...in plain English"
   - More direct and concise
   - Removes assumption about audience

3. `translate-biz`: "...your dev team will love" → "...for your AI coding tool"
   - Removed PM assumption (managing a team)
   - Aligned with vibe-coder workflow (working with AI tools)

**Verification:**
All 5 UI label tests pass:

- ✅ No jargon in labels
- ✅ No PM language in placeholders
- ✅ Verb-led or transformation-clear labels
- ✅ Vibe-coder appropriate placeholders

## Deviations from Plan

None — plan executed exactly as written.

## Cross-Plan Consistency

**Alignment with 02-01 (System Prompts):**

- Placeholder tone matches rewritten prompt tone (friendly-teacher, vibe-coder audience)
- Translation mode labels match prompt transformation logic
- No PM assumptions in UI text, consistent with prompt rewrites

**User Decision Adherence:**

- Translation modes use arrow style per user's example in 02-CONTEXT.md
- Other labels unchanged (Chat, Explain This, Safety Check already vibe-coder friendly)
- All placeholders now address vibe coders, not PMs

## Testing

**Automated:**

```bash
node --test tests/ui-labels.test.js
```

Result: ✅ All 5 tests pass

**Manual Verification:**

1. Mode labels clear to non-PM users ✅
2. Translation modes show clear transformation ✅
3. Placeholders address vibe-coder audience ✅

## Impact

**User Experience:**

- Non-technical users understand mode navigation without PM knowledge
- Translation mode purpose immediately clear
- Placeholder guidance aligns with user's workflow (building with AI, not managing teams)

**Code Quality:**

- Automated tests prevent future jargon regression
- MODES array validated on every test run
- Tone consistency enforced programmatically

## Completion Checklist

- [x] tests/ui-labels.test.js created with 5 validation tests
- [x] translate-tech label changed to "Code → Plain English"
- [x] translate-biz label changed to "Idea → Code Spec"
- [x] All 8 placeholders reviewed and updated for vibe-coder language
- [x] Automated tests pass: `node --test tests/ui-labels.test.js`
- [x] No jargon in any label (Tech, Biz, API, Deploy removed)
- [x] No PM language in any placeholder (dev team, stakeholder, leadership removed)
- [x] Placeholder audience matches prompt audience (vibe-coder consistency)

## Self-Check: PASSED

**Created files verification:**

```bash
[ -f "tests/ui-labels.test.js" ] && echo "FOUND: tests/ui-labels.test.js" || echo "MISSING: tests/ui-labels.test.js"
```

Result: FOUND: tests/ui-labels.test.js ✅

**Modified files verification:**

```bash
[ -f "src/App.jsx" ] && echo "FOUND: src/App.jsx" || echo "MISSING: src/App.jsx"
```

Result: FOUND: src/App.jsx ✅

**Commits verification:**

```bash
git log --oneline --all | grep -q "0f285b0" && echo "FOUND: 0f285b0" || echo "MISSING: 0f285b0"
git log --oneline --all | grep -q "9b0e67c" && echo "FOUND: 9b0e67c" || echo "MISSING: 9b0e67c"
```

Result: FOUND: 0f285b0 ✅
Result: FOUND: 9b0e67c ✅

All artifacts verified successfully.
