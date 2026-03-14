---
phase: 05-onboarding-and-help
plan: 02
subsystem: onboarding-ux-testing
tags: [glossary, privacy-banner, testing, vibe-coder, accessibility]
dependency_graph:
  requires: [UX-03, UX-04]
  provides: [phase-05-test-coverage, vibe-coder-glossary]
  affects: [JargonGlossary, PrivacyBanner, test-suite]
tech_stack:
  added: []
  patterns: [playwright-e2e, playwright-component-testing, lucide-icons]
key_files:
  created:
    - tests/ui/onboarding.spec.js
    - tests/ui/OnboardingWizard.spec.jsx
    - tests/ui/JargonGlossary.spec.jsx
    - tests/ui/glossary.spec.js
    - tests/ui/privacy-banner.spec.js
  modified:
    - src/components/JargonGlossary.jsx
    - src/components/PrivacyBanner.jsx
decisions:
  - Replaced emoji icons (📖, 🛡️) with Lucide SVG icons (BookOpen, Shield) per ui-ux-pro-max skill
  - All 70+ GLOSSARY definitions already vibe-coder-friendly — no definition changes needed
  - Privacy banner messaging verified complete — includes all 4 required assurances
metrics:
  duration: 136
  completed_date: "2026-03-14T21:39:27Z"
  tasks: 3
  files: 7
---

# Phase 05 Plan 02: Glossary Audit and Test Scaffolds Summary

**One-liner:** Verified vibe-coder language consistency in JargonGlossary and PrivacyBanner, replaced emoji icons with Lucide SVG icons, created 5 Playwright test scaffolds for Phase 5 behaviors (onboarding, glossary, privacy).

## What Was Built

### Task 1: Glossary Language Audit (Commit: 81d6946)
- **Audited GLOSSARY object** (70+ definitions) for vibe-coder language compliance
- **Replaced PM-centric comment**: "jargon that PMs encounter" → "jargon you'll encounter when building with AI coding tools"
- **Replaced emoji icon**: Book emoji (📖) → Lucide BookOpen SVG icon
- **Result**: All definitions already use analogies and conversational tone — no definition changes needed
- **Examples of good definitions**:
  - API: "Think of it like a waiter taking your order to the kitchen"
  - Cache: "Like keeping your favorite books on your desk instead of the shelf"
  - Component: "Like LEGO blocks — you snap them together to build a page"

### Task 2: Test Scaffold Creation (Commit: 860d781)
Created 5 test scaffold files using Playwright syntax with ARIA role queries:

1. **tests/ui/onboarding.spec.js** (E2E test)
   - First-launch wizard display verification
   - localStorage persistence after completion
   - Vibe-coder tone validation

2. **tests/ui/OnboardingWizard.spec.jsx** (Component test)
   - 4-step wizard content verification
   - Keyboard navigation (ArrowLeft, ArrowRight, Escape)
   - Lucide icon rendering validation

3. **tests/ui/JargonGlossary.spec.jsx** (Component test)
   - Search input filtering
   - Category button filtering
   - Analogy presence in definitions

4. **tests/ui/glossary.spec.js** (E2E test)
   - Toolbar button integration
   - Panel open/close behavior

5. **tests/ui/privacy-banner.spec.js** (E2E test)
   - First-launch visibility
   - Dismissal persistence
   - localStorage verification

### Task 3: Privacy Banner Verification (Commit: 3e9d074)
- **Verified UX-04 compliance**: All 4 privacy assurances present
  - ✅ "Your code and conversations stay on your machine"
  - ✅ "nothing is sent to the cloud"
  - ✅ "AI runs locally through Ollama"
  - ✅ "No tracking, no accounts, no data collection"
- **Verified accessibility**: Uses `role="status"` for screen readers
- **Verified dismissal**: "Got it" button with localStorage persistence
- **Replaced emoji icon**: Shield emoji (🛡️) → Lucide Shield SVG icon
- **Result**: Messaging meets UX-04 requirement — clear local-only assurance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Replaced emoji icons with SVG icons**
- **Found during:** Tasks 1 and 3
- **Issue:** JargonGlossary and PrivacyBanner used emoji icons (📖, 🛡️) which violate ui-ux-pro-max skill rule "no-emoji-icons"
- **Fix:** Imported Lucide React icons (BookOpen, Shield) and replaced emojis with properly sized SVG icons
- **Files modified:**
  - src/components/JargonGlossary.jsx (BookOpen icon)
  - src/components/PrivacyBanner.jsx (Shield icon with flex-shrink-0)
- **Commits:** 81d6946, 3e9d074
- **Rationale:** Professional UI requires SVG icons instead of emojis per accessibility and design consistency rules

## Requirements Coverage

### UX-03: Contextual Jargon Glossary
- ✅ 70+ terms with vibe-coder-friendly definitions (all use analogies)
- ✅ Zero unexplained jargon in definitions
- ✅ All terms use conversational tone ("Think of it like...", "Like a...")
- ✅ PM-centric language removed from comments
- ✅ Category filtering maintained (Architecture, Process, Security, Data, Frontend, Infrastructure)
- ✅ Test coverage: JargonGlossary.spec.jsx, glossary.spec.js

### UX-04: Privacy Messaging
- ✅ Privacy banner includes all 4 assurances (local storage, no cloud, Ollama, no tracking)
- ✅ Accessible via role="status"
- ✅ Dismissal persists via localStorage
- ✅ Non-intrusive bottom banner pattern
- ✅ Test coverage: privacy-banner.spec.js

## Verification Results

### Automated Checks
```bash
# No PM-centric language in glossary
grep -i "PM\|dev team\|stakeholder" src/components/JargonGlossary.jsx
# Returns: No matches (comment updated)

# Privacy messaging verification
grep "Your code and conversations stay on your machine" src/components/PrivacyBanner.jsx
# Returns: Line 41 (present)

# Test files created
ls tests/ui/*.spec.{js,jsx}
# Returns: 8 files (3 existing + 5 new)
```

### Key Links Verified
1. ✅ GLOSSARY object exported and importable for MarkdownContent.jsx
2. ✅ GlossaryPanel component exported for App.jsx integration
3. ✅ PrivacyBanner localStorage key matches constant (th3rdai_privacy_banner_dismissed)
4. ✅ All test files use correct import paths

## Testing Strategy

### Test Architecture (Nyquist-compliant)
- **E2E tests** (onboarding.spec.js, glossary.spec.js, privacy-banner.spec.js): Integration with running app
- **Component tests** (OnboardingWizard.spec.jsx, JargonGlossary.spec.jsx): Isolated component behavior
- **ARIA role queries**: Accessibility-first selector strategy
- **Requirement IDs**: All tests annotated with UX-01, UX-03, or UX-04

### Test Execution
Tests scaffold complete but not yet executed (requires running app server):
```bash
# Component tests only
npm run test:ui -- JargonGlossary.spec.jsx

# Full test suite
npm test -- tests/ui/onboarding.spec.js tests/ui/OnboardingWizard.spec.jsx tests/ui/JargonGlossary.spec.jsx tests/ui/glossary.spec.js tests/ui/privacy-banner.spec.js
```

## What's Next

### Immediate Next Steps
1. ✅ Plan 05-02 complete — all test scaffolds created
2. ⏭️ Next plan: 05-03 (if exists) or Phase 5 verification

### Deferred Items
None — plan executed exactly as specified with only minor auto-fixes (emoji → SVG icons).

## Files Changed

### Created (5 test files)
- tests/ui/onboarding.spec.js (35 lines)
- tests/ui/OnboardingWizard.spec.jsx (48 lines)
- tests/ui/JargonGlossary.spec.jsx (35 lines)
- tests/ui/glossary.spec.js (19 lines)
- tests/ui/privacy-banner.spec.js (36 lines)

### Modified (2 component files)
- src/components/JargonGlossary.jsx (+3 lines, -2 lines)
  - Added Lucide BookOpen import
  - Replaced emoji with SVG icon
  - Updated comment to vibe-coder language

- src/components/PrivacyBanner.jsx (+2 lines, -1 line)
  - Added Lucide Shield import
  - Replaced emoji with SVG icon

## Self-Check: PASSED

### Created Files Verification
```bash
[ -f "tests/ui/onboarding.spec.js" ] && echo "FOUND: tests/ui/onboarding.spec.js" || echo "MISSING: tests/ui/onboarding.spec.js"
# FOUND: tests/ui/onboarding.spec.js

[ -f "tests/ui/OnboardingWizard.spec.jsx" ] && echo "FOUND: tests/ui/OnboardingWizard.spec.jsx" || echo "MISSING: tests/ui/OnboardingWizard.spec.jsx"
# FOUND: tests/ui/OnboardingWizard.spec.jsx

[ -f "tests/ui/JargonGlossary.spec.jsx" ] && echo "FOUND: tests/ui/JargonGlossary.spec.jsx" || echo "MISSING: tests/ui/JargonGlossary.spec.jsx"
# FOUND: tests/ui/JargonGlossary.spec.jsx

[ -f "tests/ui/glossary.spec.js" ] && echo "FOUND: tests/ui/glossary.spec.js" || echo "MISSING: tests/ui/glossary.spec.js"
# FOUND: tests/ui/glossary.spec.js

[ -f "tests/ui/privacy-banner.spec.js" ] && echo "FOUND: tests/ui/privacy-banner.spec.js" || echo "MISSING: tests/ui/privacy-banner.spec.js"
# FOUND: tests/ui/privacy-banner.spec.js
```

### Commit Verification
```bash
git log --oneline --all | grep -q "81d6946" && echo "FOUND: 81d6946" || echo "MISSING: 81d6946"
# FOUND: 81d6946

git log --oneline --all | grep -q "860d781" && echo "FOUND: 860d781" || echo "MISSING: 860d781"
# FOUND: 860d781

git log --oneline --all | grep -q "3e9d074" && echo "FOUND: 3e9d074" || echo "MISSING: 3e9d074"
# FOUND: 3e9d074
```

All files created and commits exist. Self-check PASSED.
