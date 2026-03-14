---
phase: 03-report-card-ui
created: 2026-03-14
dependencies:
  - Phase 01 (Review Engine — must exist before UI can consume it)
  - Phase 02 (Tone Unification — tone must be set before UI text written)
---

# Phase 03: Report Card UI — Context

## Phase Goal
Users can see their code review as a visual report card with color-coded grades, click into conversational deep-dives, and feed code through any input method.

## Requirements Covered
- REVW-05: User can click any grade category to start a conversational deep-dive
- REVW-07: Report card uses color-coded grades (A=green through F=red)
- REVW-08: User sees a friendly loading state while review processes
- REVW-09: User can upload files or use file browser to feed code into review

## Prior Context

### From Phase 1 (Review Engine)
- **Protective parent tone** for review mode — "caring, thorough code reviewer", "friendly safety inspector"
- **Analogies for critical/high severity only** — don't overuse or it loses impact
- **Inline jargon definitions** — technical terms explained in plain English
- **Fallback behavior** — if structured JSON fails, fall back to streaming chat mode
- **Clean code celebration** — "warm but measured" encouragement when code is good

### From Phase 2 (Tone Unification)
- **Friendly-teacher persona** as baseline across all modes
- **Mode-specific personalities** preserved:
  - Explain = patient teacher
  - Bugs = protective friend
  - Refactor = helpful coach
  - Translate = bridge/translator
- **Vibe-coder audience shift** — removed PM language, replaced with "AI coding tool" framing
- **Mode labels clarity** — "Code → Plain English", "Idea → Code Spec" instead of "Tech → Biz"

## Existing Implementation (Discovered)

### Components Already Built
Phase 3 builds on existing components from earlier work:

**`src/components/ReportCard.jsx`** (already exists):
- Color-coded grade system:
  - A = emerald (green) — `bg-emerald-500/20, border-emerald-500/40, text-emerald-300`
  - B = blue — `bg-blue-500/20`
  - C = amber (yellow) — `bg-amber-500/20`
  - D = orange — `bg-orange-500/20`
  - F = red — `bg-red-500/20`
- Category labels with icons:
  - bugs 🐛 — "Logic errors, crashes, and broken behavior"
  - security 🔒 — "Vulnerabilities and safety risks"
  - readability 📖 — "Clarity, naming, and maintainability"
  - completeness ✅ — "Missing features, edge cases, and error handling"
- `GradeBadge` component for displaying letter grades
- `FindingCard` component with expandable details, severity pills, copy fix button

**`src/components/ReviewPanel.jsx`** (already exists):
- State machine with phases: 'input' | 'loading' | 'report' | 'fallback' | 'deep-dive'
- Model capability warnings for small models (< 7B parameters)
- Drag-drop file input handling
- Integration with ReportCard component
- Deep-dive conversation mode support

### What Phase 3 Must Add
- **Loading state animation** with encouragement (see decision below)
- **Explicit deep-dive triggers** on report card (see decision below)
- **Input method tabs** with equal priority (see decision below)
- **Progressive disclosure layout** for findings (see decision below)

## Phase-Specific Decisions

### Loading State Design (REVW-08)
**Decision:** Playful animation with encouragement

**Details:**
- Animated icon (e.g., magnifying glass over code, friendly robot inspector)
- Encouraging messages matching friendly-teacher tone
- Examples: "Looking for ways to make your code even better!", "Checking for any gotchas...", "Making sure everything's ship-shape!"
- NOT static message — needs visual movement to feel alive
- NOT progress bar with category labels — too technical, breaks vibe-coder tone
- NOT rotating tips — feels educational rather than encouraging

**Implementation notes:**
- Use CSS animations or simple SVG animation for icon
- Rotate through 3-4 encouraging phrases (not per-category progress)
- Keep animation subtle and friendly (no aggressive spinning)

### Grade Card Interaction Pattern (REVW-05)
**Decision:** Explicit 'Learn More' or 'See Details' button

**Details:**
- Each grade category card has a clear button labeled "Learn More" or "See Details"
- Button appears below the grade badge and finding count
- Most explicit affordance — no ambiguity about how to drill in
- Prevents accidental deep-dive triggers from clicking card or badge
- Maintains card as informational element, button as action element

**Trade-off accepted:**
- Adds visual element to each card (slight clutter)
- BUT: vibe coders benefit from explicit guidance over minimalism

**Implementation notes:**
- Button uses friendly language ("See what's up", "Learn more", "Show me details")
- Button style matches Tailwind theme (likely `bg-blue-500 hover:bg-blue-600`)
- Button should feel inviting, not clinical

### Input Method Prioritization (REVW-09)
**Decision:** All methods equal (tabs or buttons)

**Details:**
- Show paste, file upload, and file browser as equivalent options
- Use tabs or button group to present all three without hierarchy
- No default bias — let user choose their preferred workflow
- Matches reality: vibe coders might paste from Cursor, upload from Replit, or browse local files

**Layout suggestion:**
- Three tabs: "Paste Code" | "Upload File" | "Browse Files"
- OR three buttons in a button group with icons
- Drag-drop still works globally as convenience feature (don't hide it)

**Implementation notes:**
- Maintain existing drag-drop functionality (already in ReviewPanel.jsx)
- Ensure all three paths produce identical report card output
- Preserve model capability warnings across all input methods

### Report Card Layout and Density (REVW-07)
**Decision:** Progressive disclosure — minimal by default, expand on demand

**Details:**
- **Default view (minimal):**
  - 4 grade badges (bugs, security, readability, completeness)
  - Overall grade badge (prominent)
  - Top priority callout (highlighted, plain English)
  - Finding counts per category ("3 issues found")
- **Expanded view (on demand):**
  - "Show all findings" toggle/button
  - Expands to show all findings inline (per category)
  - FindingCard components with severity, description, copy fix button
- **Deep-dive mode (per category):**
  - Clicking "Learn More" button enters conversational mode for that category
  - Replaces report card with streaming chat interface
  - User can ask follow-up questions about that category's issues

**Trade-off accepted:**
- More complex UI (three states instead of one)
- BUT: best of both worlds — quick scan + detailed review + conversational drill-down

**Implementation notes:**
- Use existing `FindingCard` component for expanded view
- Use existing deep-dive state in ReviewPanel.jsx for conversational mode
- "Show all findings" should be a clear toggle (e.g., chevron icon + label)
- Expanded findings should collapse back to minimal on toggle

## Technical Constraints

### Stack
- React 18 (functional components, hooks)
- Tailwind CSS (utility classes, dark theme)
- Vite (build tool, dev server)
- Express backend with `/api/review` endpoint returning structured JSON

### Data Flow
1. User provides code via paste/upload/browse
2. Frontend sends code to `/api/review` endpoint
3. Backend calls Ollama with structured output (Zod schema)
4. Backend returns JSON report card OR falls back to streaming chat
5. Frontend displays color-coded report card with grades, findings, top priority
6. User clicks "Learn More" on a category → enters deep-dive mode
7. Deep-dive mode streams conversational responses via SSE

### Accessibility
- Color-coding MUST NOT be sole indicator (use icons, labels, text)
- Buttons must have clear labels (no icon-only buttons)
- Loading state must have aria-live announcement for screen readers

## Open Questions

None — all gray areas resolved through discussion.

## Success Criteria (from ROADMAP.md)

1. Report card displays color-coded letter grades (green for A through red for F) for each category ✓ (existing implementation)
2. User can click any grade category to enter a streaming conversational deep-dive about that category's issues ✓ (decision: explicit button)
3. User sees a friendly loading state ("Grading your code...") while the review processes ✓ (decision: playful animation with encouragement)
4. User can feed code into review via paste, file upload, or file browser — all paths produce the same report card ✓ (decision: equal priority tabs)

## Next Steps

1. **Research Phase 3** (if needed):
   - Verify existing components meet new requirements
   - Research Tailwind animation patterns for loading state
   - Research progressive disclosure UI patterns
   - Research tab/button group patterns for input methods

2. **Plan Phase 3**:
   - Break down implementation into tasks
   - Define file modifications vs new files
   - Create test scaffolds for UI validation
   - Map requirements to specific code changes

3. **Execute Phase 3**:
   - Implement loading animation with encouraging messages
   - Add explicit "Learn More" buttons to grade cards
   - Implement input method tabs with equal priority
   - Implement progressive disclosure (minimal → expanded → deep-dive)
   - Add accessibility attributes (aria-live, labels)
   - Test all three input paths produce identical output

4. **Verify Phase 3**:
   - Confirm all 4 success criteria met
   - Test progressive disclosure states
   - Test deep-dive mode for each category
   - Test loading state animation and messages
   - Test input method parity (paste = upload = browse)

---

_Context captured: 2026-03-14_
_Source: discuss-phase workflow (4 gray areas probed)_
_Ready for: plan-phase → research (optional) → plan creation → verification_
