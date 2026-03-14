---
phase: 02-tone-unification
plan: 01
subsystem: llm-prompts
tags: [tone, prompts, vibe-coder, audience-shift]
dependency_graph:
  requires: []
  provides: [tone-validation-tests, vibe-coder-prompts]
  affects: [lib/prompts.js]
tech_stack:
  added: []
  patterns: [TDD, mode-specific-personalities, inline-jargon-definitions]
key_files:
  created:
    - tests/tone-validation.test.js
  modified:
    - lib/prompts.js
decisions:
  - "Mode-specific personalities preserved: explain=patient teacher, bugs=protective friend, refactor=helpful coach, translate=bridge"
  - "Refactor mode enhanced with 'Here's What to Tell Your AI' section containing copy-pasteable prompts"
  - "Inline jargon explanations pattern used in bugs mode example ('this could let someone access data they shouldn't see' not 'SQL injection')"
  - "All non-review modes confirmed to have MODE_GUARDRAIL for conversational fallback"
metrics:
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
  duration_seconds: 137
  completed_date: "2026-03-14"
---

# Phase 02 Plan 01: Tone Unification for Vibe Coders Summary

**One-liner:** Transformed all system prompts from PM-focused to vibe-coder audience by removing team management language, adding mode-specific personalities (patient teacher, protective friend, helpful coach), and ensuring zero-jargon communication with inline definitions.

## What Was Built

Rewrote 7 mode system prompts in `lib/prompts.js` to serve vibe coders (non-technical users building with AI coding tools) instead of Product Managers. Created automated tone validation tests to ensure no PM-specific language, analogy usage, personality archetypes, and conversational guardrails.

**Core changes:**
- **Chat mode**: Changed from "PM who works with dev teams" to "building with AI coding tools"
- **Explain mode**: Added "never written code" framing with everyday analogies (library, kitchen, recipe)
- **Bugs mode**: Shifted to "protective friend" identity with plain-English severity examples
- **Refactor mode**: Added "Here's What to Tell Your AI" section with copy-pasteable prompts for Cursor/ChatGPT
- **Translate-tech**: Changed "stakeholder/manager" framing to "explaining to a friend"
- **Translate-biz**: Changed "PM/engineering team" to "your AI coding tool"
- **Review modes**: Minor adjustments only (already vibe-coder friendly from Phase 1)

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions Made

**1. Mode personality preservation**
- Each mode retains distinct archetype while sharing friendly-teacher baseline
- Explain: patient teacher ("friend who makes complex things feel simple")
- Bugs: protective friend ("friendly safety inspector")
- Refactor: helpful coach ("supportive coding mentor")
- Translate modes: bridge ("translator who speaks both languages")

**2. Refactor mode enhancement**
- Added "Here's What to Tell Your AI" section after showing improved code
- Provides copy-pasteable prompts users can give to Cursor, ChatGPT, or other AI tools
- Maintains reference code display (doesn't skip it) as requested in CONTEXT.md

**3. Jargon handling strategy**
- Used inline plain-English examples in bugs mode ("this could let someone access data they shouldn't see" not "SQL injection vulnerability")
- Leverages existing MODE_GUARDRAIL pattern for conversational fallback
- Relies on existing JargonGlossary.jsx for hover definitions (no changes needed)

**4. Test-driven validation**
- Created 5 automated tests covering: no PM language, inline definitions, analogies, personality archetypes, MODE_GUARDRAIL presence
- Tests initially failed (detected PM terms in chat, missing guardrail), proving detection works
- All tests green after prompt rewrites

## Testing & Validation

**Automated tests (all passing):**
- `node --test tests/tone-validation.test.js` — 5/5 green
  - No PM-specific language detected (dev team, stakeholder, leadership, manager, standup)
  - Analogies present in explain/bugs/refactor modes
  - Personality archetypes established for all modes
  - MODE_GUARDRAIL confirmed in all non-review modes
  - Inline jargon definition pattern validated

**Manual spot-check:**
- Explain prompt readable by non-coder: YES (uses kitchen/library analogies)
- Bugs prompt describes "what will break" in plain English: YES (includes example)
- Refactor prompt includes copy-pasteable AI prompts: YES (new section added)
- Translate prompts bridge vibe-coder understanding: YES (removed PM-to-dev framing)

## Files Changed

**Created:**
- `tests/tone-validation.test.js` (121 lines) — 5 automated tone validation tests using Node.js `node:test`

**Modified:**
- `lib/prompts.js` (34 insertions, 28 deletions) — Rewrote 7 mode prompts, added MODE_GUARDRAIL to chat mode

## Commits

- `9b04ece` — test(02-01): add tone validation test scaffold
- `c787a1c` — feat(02-01): rewrite mode prompts for vibe-coder audience

## Dependencies

**Requires:** None (standalone tone update)

**Provides:**
- `tests/tone-validation.test.js` — Reusable validation for future prompt changes
- Vibe-coder-focused prompts in `lib/prompts.js` — Foundation for Phase 2 Plan 2 (UI label updates)

**Affects:**
- All LLM interactions across 8 modes now use vibe-coder language
- Future prompt edits should maintain validation test compliance

## What's Next

**Phase 2 Plan 2** will update mode labels in `src/App.jsx`:
- Rename "Tech → Biz" and "Biz → Tech" to clear transformation language ("Code → Plain English", "Idea → Code Spec")
- Update placeholder text to match vibe-coder audience (remove "your dev team" references)
- Ensure UI language consistency with rewritten prompts

## Self-Check

**Files created:**
```bash
[✓] FOUND: tests/tone-validation.test.js
```

**Commits exist:**
```bash
[✓] FOUND: 9b04ece (test scaffold)
[✓] FOUND: c787a1c (prompt rewrites)
```

**Tests passing:**
```bash
[✓] node --test tests/tone-validation.test.js — 5/5 green
```

## Self-Check: PASSED

All files created, commits verified, tests passing.
