# Phase 5: Onboarding and Help — Context

**Phase Goal:** A first-time user understands what Code Companion does, how to use it, and can get help with any technical term they encounter — all while knowing their code stays private

**Context gathered:** 2026-03-14
**Method:** Interactive discussion focusing on updating existing components for vibe-coder audience

---

## Current State Discovery

**Key Finding:** Phase 5 components already exist and are integrated:

1. **OnboardingWizard.jsx** (80 lines)
   - 4-step wizard: Welcome → Connect to Ollama → Pick Your Mode → Privacy
   - localStorage persistence via `th3rdai_onboarding_complete`
   - **Issue:** Line 14 references "Product Managers" (pre-Phase 2 tone)
   - Integrated in App.jsx lines 643, displays on first launch

2. **JargonGlossary.jsx** (200+ lines)
   - GLOSSARY object with 70+ technical terms across 6 categories
   - GlossaryPanel: floating panel with search and category filtering
   - MarkdownContent.jsx has `highlightJargon()` for inline term highlighting
   - Integrated in App.jsx line 648-649, triggered by toolbar icon

3. **PrivacyBanner.jsx** (54 lines)
   - Compact dismissable banner at bottom of app
   - Message: "100% private. Your code and conversations stay on your machine..."
   - localStorage dismissal: `th3rdai_privacy_banner_dismissed`
   - Integrated in App.jsx line 648, always renders unless dismissed

**Implementation Strategy:** Update existing components for vibe-coder audience (analogies, zero jargon, friendly-teacher tone) rather than rebuild from scratch.

---

## User Decisions Captured

### Onboarding Content Updates

**Decision 1: Structure**

- **Choice:** Keep 4-step wizard structure
- **Rationale:** Existing flow (Welcome → Connect → Modes → Privacy) covers all requirements
- **Impact:** Plans focus on content rewrites, not structural changes

**Decision 2: Welcome Message Framing**

- **Choice:** Position as "code translator" for vibe coders
- **Rationale:** Matches Phase 2 tone shift from PM-focused to vibe-coder-focused
- **Impact:** Replace "helps Product Managers" language with "translates AI-generated code into honest reviews"

**Decision 3: Mode Overview Presentation**

- **Choice:** Show all 8 modes in grid view
- **Rationale:** User wants comprehensive overview, not just highlighted subset
- **Impact:** Keep existing 8-mode grid, update descriptions to vibe-coder language

**Decision 4: Icon Strategy**

- **Choice:** Mix emoji (for step indicators) and Lucide icons (for mode grid)
- **Rationale:** Emoji conveys friendly tone for steps, Lucide provides professional consistency for modes
- **Impact:** Replace mode emoji icons with Lucide (per ui-ux-pro-max skill rule), keep step emoji

**Decision 5: Ollama Setup Detail Level**

- **Choice:** Add troubleshooting guidance to Ollama setup step
- **Rationale:** Vibe coders may not be familiar with local LLM setup
- **Impact:** Expand step 2 with common issues (port not responding, no models installed) and fixes

### Jargon Glossary Integration

**Default approach:** Keep existing GlossaryPanel (floating panel) as primary interface. Inline term highlighting in MarkdownContent.jsx already implemented. No changes needed unless glossary content requires vibe-coder updates.

### Onboarding Triggers & Replay

**Default approach:** Keep existing triggers (first launch via localStorage check). Add "Replay Onboarding" button to settings/help if not already present.

### Privacy Messaging Prominence

**Default approach:** Keep existing PrivacyBanner at bottom. Banner is non-intrusive and dismissable, which respects user attention while meeting UX-04 requirement.

---

## Requirements Mapping

| Requirement                           | Status                  | Implementation Approach                                                                                    |
| ------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| **UX-01**: First-time onboarding flow | Exists, needs update    | Rewrite OnboardingWizard content for vibe-coder tone, add troubleshooting to step 2                        |
| **UX-03**: Contextual jargon glossary | Exists, verify coverage | Review GLOSSARY object for vibe-coder relevance, ensure floating panel + inline highlighting work together |
| **UX-04**: Privacy messaging visible  | Exists                  | Keep existing PrivacyBanner, verify message clarity                                                        |

---

## Phase Constraints

1. **Tone Consistency:** All content must match Phase 2's friendly-teacher persona (analogies, zero jargon, patient explanations)
2. **Icon Consistency:** Use Lucide React icons for UI elements per ui-ux-pro-max skill (Step indicator emoji exception granted by user)
3. **Existing Integration:** Components are already wired in App.jsx — no routing or integration work needed
4. **localStorage Keys:** Do not change existing keys (`th3rdai_onboarding_complete`, `th3rdai_privacy_banner_dismissed`) to preserve user state
5. **No Ollama Dependency:** Onboarding must work even if Ollama is offline (graceful degradation in step 2)

---

## Success Criteria Reference (from ROADMAP.md)

1. **A first-time user sees an onboarding flow that explains what Code Companion does and walks them through their first review**
   - **How verified:** OnboardingWizard displays on first launch, 4 steps complete before dismissing, localStorage persists completion

2. **Hovering over or clicking a technical term anywhere in the app shows a plain-English definition**
   - **How verified:** Click jargon term in markdown output → GlossaryPanel opens with term highlighted

3. **The UI displays clear privacy messaging visible without hunting for it**
   - **How verified:** PrivacyBanner visible at bottom of app on first launch before dismissal

---

## Open Questions for Planner/Researcher

1. **Glossary Content Audit:** Do all 70+ terms in GLOSSARY object use vibe-coder-friendly definitions? (Check for PM-centric language)
2. **Onboarding Replay Access:** Where should "Replay Onboarding" button live? (Settings modal? Help menu? Toolbar?)
3. **Ollama Troubleshooting Specificity:** What are the 3 most common Ollama setup issues for non-technical users? (Need web research or user data)
4. **Mode Grid Layout:** Should mode descriptions in onboarding match mode descriptions in UI exactly, or be simplified for first-time context?
5. **Privacy Banner Timing:** Should banner show on every launch until dismissed, or only first 3 launches?

---

## Prior Context References

- **Phase 2 Decisions:** Mode-specific personalities preserved (explain=patient teacher, bugs=protective friend, refactor=helpful coach). AI coding tool references, not dev team references. Arrow-style transformation labels.
- **Phase 3 Decisions:** Lucide React icons preferred over emoji. Headless UI Tab component for accessible interactions. Progressive disclosure defaults to minimal view.
- **Phase 4 Decisions:** Copy-pasteable prompts sorted by severity. Incremental persistence. MODEL_TIERS empirical object for review quality warnings.

---

## Researcher Guidance

If invoking research for this phase:

- **Search for:** "First-time user onboarding best practices for technical tools", "Ollama setup common issues", "Glossary UI patterns for non-technical users"
- **Code examples:** Look for tooltip/popover patterns for inline glossary, wizard completion tracking, dismissable banner patterns
- **Avoid:** Generic SaaS onboarding patterns (no account creation, no feature tours beyond first launch)

---

_Context captured: 2026-03-14_
_Captured by: Claude (gsd-phase-researcher workflow)_
_Next step: Planning (create 05-01-PLAN.md based on this context)_
