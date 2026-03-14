# Roadmap: Code Companion — Vibe Coder Edition

## Overview

This roadmap transforms Code Companion from a PM-focused code analysis tool into a vibe-coder-friendly code reviewer, then packages it as a self-contained desktop application. The build order is architecturally constrained: the structured review engine must exist before any UI can consume it, tone must be unified before user-facing testing, and the report card UI must be functional before layering on history, fix prompts, and onboarding. Six phases deliver requirements across four categories (Review Mode, Tone, UX, Desktop).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Review Engine** - Backend structured output endpoint that generates report cards with grades, findings, and top priority
- [ ] **Phase 2: Tone Unification** - Rewrite all system prompts and mode labels for friendly-teacher vibe-coder persona
- [ ] **Phase 3: Report Card UI** - Visual report card display with color-coded grades, deep-dive conversation, and all input methods
- [ ] **Phase 4: Actionable Guidance** - Copy-pasteable fix prompts, review history persistence, and model capability warnings
- [ ] **Phase 5: Onboarding and Help** - First-time user flow, contextual jargon glossary, and privacy messaging
- [ ] **Phase 6: Desktop App** - Electron packaging for self-contained macOS and Linux desktop application

## Phase Details

### Phase 1: Review Engine
**Goal**: A working backend endpoint that accepts code and returns a structured report card with letter grades, plain-English findings, and a top priority callout
**Depends on**: Nothing (first phase)
**Requirements**: REVW-01, REVW-02, REVW-03, REVW-04
**Success Criteria** (what must be TRUE):
  1. Sending code to the review endpoint returns a JSON report card with letter grades (A-F) for bugs, security, readability, and completeness
  2. The response includes an overall grade summarizing code quality
  3. The response includes a "Top Priority" field identifying the single most important thing to fix
  4. All findings in the response use plain English with no programming jargon
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Schema, chatStructured client function, and review system prompt
- [ ] 01-02-PLAN.md — POST /api/review endpoint with structured output + chat fallback

### Phase 2: Tone Unification
**Goal**: Every mode in the application speaks with a consistent friendly-teacher persona using analogies and zero jargon, with simplified labels a non-technical user understands
**Depends on**: Nothing (independent of Phase 1; can run in parallel)
**Requirements**: TONE-01, TONE-02, TONE-03, TONE-04, TONE-05, UX-02
**Success Criteria** (what must be TRUE):
  1. All modes (explain, bugs, refactor, translate, review) use a consistent friendly-teacher tone with analogies and encouragement
  2. Explain mode produces output understandable by someone who has never written code
  3. Bugs mode describes issues in terms of "what will actually break" with plain-English severity
  4. Refactor mode outputs "what to ask your AI to change" framing instead of technical refactoring advice
  5. All mode labels, navigation items, and UI text use non-technical language
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Report Card UI
**Goal**: Users can see their code review as a visual report card with color-coded grades, click into conversational deep-dives, and feed code through any input method
**Depends on**: Phase 1
**Requirements**: REVW-05, REVW-07, REVW-08, REVW-09
**Success Criteria** (what must be TRUE):
  1. Report card displays color-coded letter grades (green for A through red for F) for each category
  2. User can click any grade category to enter a streaming conversational deep-dive about that category's issues
  3. User sees a friendly loading state ("Grading your code...") while the review processes
  4. User can feed code into review via paste, file upload, or file browser — all paths produce the same report card
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Actionable Guidance
**Goal**: Reviews become reusable and actionable — every finding has a copy-pasteable prompt for the user's AI tool, past reviews are saved, and the app warns when a model may produce poor results
**Depends on**: Phase 3
**Requirements**: REVW-06, REVW-10, UX-05
**Success Criteria** (what must be TRUE):
  1. Each finding includes a "What to ask your AI to fix" copy-pasteable prompt the user can paste into Cursor/ChatGPT
  2. Completed reviews are saved and can be revisited from history with the full report card intact
  3. When a user selects a small model unlikely to produce quality reviews, a gentle warning appears before the review starts
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Onboarding and Help
**Goal**: A first-time user understands what Code Companion does, how to use it, and can get help with any technical term they encounter — all while knowing their code stays private
**Depends on**: Phase 2 (tone must be set before onboarding text is written)
**Requirements**: UX-01, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. A first-time user sees an onboarding flow that explains what Code Companion does and walks them through their first review
  2. Hovering over or clicking a technical term anywhere in the app shows a plain-English definition
  3. The UI displays clear privacy messaging ("Your code never leaves your computer") visible without hunting for it
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: Desktop App
**Goal**: Code Companion runs as a self-contained Electron desktop application on macOS and Linux, with native window management, auto-free port detection, cross-platform IDE launchers, and distributable installers
**Depends on**: Phase 5 (all features complete before packaging)
**Requirements**: DESK-01, DESK-02, DESK-03, DESK-04, DESK-05
**Success Criteria** (what must be TRUE):
  1. App launches as a native desktop window (no manual terminal commands or browser required)
  2. Express server starts automatically on a free port inside the Electron process
  3. IDE launcher buttons work on both macOS and Linux (platform-detected commands)
  4. Distributable installers produced: .dmg for macOS, .AppImage for Linux
  5. App data (config, history, logs) stored in OS-appropriate user data directory
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6
(Phases 1 and 2 have no dependency on each other and could execute in either order)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Review Engine | 0/0 | Not started | - |
| 2. Tone Unification | 0/0 | Not started | - |
| 3. Report Card UI | 0/0 | Not started | - |
| 4. Actionable Guidance | 0/0 | Not started | - |
| 5. Onboarding and Help | 0/0 | Not started | - |
| 6. Desktop App | 0/0 | Not started | - |
