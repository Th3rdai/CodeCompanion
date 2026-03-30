---
phase: 05-onboarding-and-help
plan: 01
subsystem: onboarding
tags: [onboarding, vibe-coder, lucide-icons, ollama-troubleshooting]
dependency_graph:
  requires: [02-01-vibe-coder-prompts]
  provides: [vibe-coder-onboarding, ollama-troubleshooting-guide]
  affects: [src/components/OnboardingWizard.jsx]
tech_stack:
  added: []
  patterns: [lucide-react-icons, friendly-teacher-tone, zero-jargon]
key_files:
  created: []
  modified:
    - src/components/OnboardingWizard.jsx
decisions:
  - "Preserved emoji step indicators (👋, 🔌, 🎯, 🛡️) for friendly tone while using Lucide icons for mode grid per ui-ux-pro-max skill exception"
  - "Added Ollama troubleshooting section with 3 common issues (port not responding, no models, connection refused) for non-technical users"
  - "Replaced 'Product Managers' framing with 'AI coding tool' and vibe-coder language across all onboarding steps"
  - "Mode descriptions simplified to 'building with AI' context instead of 'PM task' framing"
metrics:
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 1
  duration_seconds: 121
  completed_date: "2026-03-14"
---

# Phase 05 Plan 01: Vibe-Coder Onboarding with Ollama Troubleshooting Summary

**One-liner:** Updated OnboardingWizard to vibe-coder audience with friendly-teacher tone, Ollama troubleshooting guidance, and Lucide React icons for mode grid while preserving emoji step indicators.

## What Was Built

Transformed the existing 4-step OnboardingWizard component from PM-focused to vibe-coder audience by rewriting all content to match Phase 2's friendly-teacher tone, adding Ollama troubleshooting for non-technical users, and replacing mode emoji icons with Lucide React SVG icons.

**Core changes:**

- **Step 1 (Welcome)**: Replaced "helps Product Managers" with "translates AI-generated code into honest, plain-English reviews" and added "AI coding tool" framing for Cursor/ChatGPT users
- **Step 2 (Ollama Setup)**: Added troubleshooting section with 3 common issues and fixes (port not responding, no models installed, connection refused)
- **Step 3 (Pick Your Mode)**: Replaced emoji mode icons with Lucide React components (MessageCircle, Bug, Lightbulb, etc.) and updated descriptions to vibe-coder language
- **Step 4 (Privacy)**: Verified existing privacy messaging meets UX-04 requirement (no changes needed)

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions Made

**1. Icon strategy: Mixed approach**

- Mode grid uses Lucide React SVG icons (MessageCircle, Lightbulb, ArrowRightLeft, WrenchIcon, Bug, FileCheck, Sparkles, Hammer) per ui-ux-pro-max skill rule
- Step indicators preserve emoji (👋, 🔌, 🎯, 🛡️) for friendly tone per user-granted exception
- Balances professional consistency with approachable personality

**2. Ollama troubleshooting scope**

- Added 3 most common issues based on 05-RESEARCH.md Pattern 2:
  - Port not responding → Check Ollama is running in menu bar
  - No models installed → Run `ollama list` and `ollama pull llama3.2`
  - Connection refused → Verify Ollama URL in Settings (default: http://localhost:11434)
- Focused on issues non-technical users encounter (not developer-specific problems)

**3. Content transformation approach**

- Used "building with AI" framing instead of "PM workflow"
- Emphasized translation/understanding over team management
- Maintained existing localStorage keys (`th3rdai_onboarding_complete`) to preserve user state
- Kept keyboard navigation and component structure intact

**4. Privacy messaging verification**

- Step 4 already compliant with UX-04 requirement
- Message clearly states "Your code never leaves your computer"
- No changes needed (existing content vibe-coder friendly)

## Testing & Validation

**Code review verification (all passing):**

- ✅ First launch displays wizard when localStorage key not set
- ✅ Completion persists to `th3rdai_onboarding_complete` unchanged
- ✅ Keyboard navigation preserved (ArrowRight/Left, Enter, Escape)
- ✅ Ollama troubleshooting section visible in Step 2 with 3 bullets
- ✅ Mode grid renders Lucide icon components with `w-4 h-4 text-indigo-400` styling
- ✅ Step indicators keep emoji (👋, 🔌, 🎯, 🛡️)
- ✅ No "Product Managers" language remains (grep verified)
- ✅ "AI coding tool" framing present in Step 1

**Manual spot-check criteria:**

- Step 1 references "AI coding tool" and "vibe coders": YES
- Step 2 includes troubleshooting for non-technical users: YES (3 bullets)
- Step 3 mode grid uses Lucide icons (not emoji): YES
- Step 4 privacy messaging visible and clear: YES (unchanged)
- localStorage keys unchanged: YES (`th3rdai_onboarding_complete`)

## Files Changed

**Modified:**

- `src/components/OnboardingWizard.jsx` (24 insertions, 13 deletions) — Rewrote 3 of 4 steps for vibe-coder tone, added Lucide imports, replaced mode emoji with icon components

## Commits

- `4f1ab9a` — feat(05-01): rewrite onboarding for vibe-coder audience with Lucide icons
- `f62b952` — test(05-01): verify onboarding localStorage persistence and keyboard navigation

## Dependencies

**Requires:**

- `02-01-vibe-coder-prompts` — Tone consistency baseline from Phase 2
- `lucide-react` (0.577.0) — Already installed

**Provides:**

- Vibe-coder-focused onboarding wizard matching Phase 2 tone
- Ollama troubleshooting guidance for non-technical users
- Lucide icon pattern for future onboarding updates

**Affects:**

- First-time user experience now aligned with vibe-coder audience
- UX-01 requirement fulfilled (onboarding flow with vibe-coder tone)
- UX-04 requirement verified (privacy messaging in Step 4)

## What's Next

**Phase 5 Plan 2** will audit and update JargonGlossary.jsx:

- Review all 70+ glossary terms for vibe-coder-friendly definitions
- Remove any PM-centric language from term explanations
- Add "Replay Onboarding" trigger to settings or help menu
- Verify inline term highlighting works with updated onboarding

## Self-Check

**Files modified:**

```bash
[✓] FOUND: src/components/OnboardingWizard.jsx (24 insertions, 13 deletions)
```

**Commits exist:**

```bash
[✓] FOUND: 4f1ab9a (feat: vibe-coder onboarding)
[✓] FOUND: f62b952 (test: verification)
```

**Verification criteria:**

```bash
[✓] No "Product Managers" language detected
[✓] "AI coding tool" framing present
[✓] Ollama troubleshooting section added (3 bullets)
[✓] Lucide icons imported and rendered in mode grid
[✓] localStorage key unchanged
[✓] Keyboard navigation preserved
```

## Self-Check: PASSED

All files modified, commits verified, vibe-coder content implemented across onboarding wizard.
