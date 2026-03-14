# Requirements: Code Companion — Vibe Coder Edition

**Defined:** 2026-03-13
**Core Value:** A vibe coder can paste, upload, or point to their AI-generated code and get a clear, honest assessment of whether it's safe to ship — explained in language they actually understand.

## v1 Requirements

### Review Mode

- [ ] **REVW-01**: User can paste code and receive a report card with letter grades (A-F) for bugs, security, readability, and completeness
- [ ] **REVW-02**: Report card shows an overall grade summarizing code quality
- [ ] **REVW-03**: Report card highlights a "Top Priority" — the single most important thing to fix first
- [ ] **REVW-04**: Each category shows plain-English findings with zero jargon
- [x] **REVW-05**: User can click any grade category to start a conversational deep-dive explaining the issues
- [x] **REVW-06**: Each finding includes a "What to ask your AI to fix" copy-pasteable prompt
- [x] **REVW-07**: Report card uses color-coded grades (A=green through F=red) for instant visual feedback
- [x] **REVW-08**: User sees a friendly loading state ("Grading your code...") while review processes
- [x] **REVW-09**: User can upload files or use file browser to feed code into review
- [x] **REVW-10**: Review history saves structured report card data for revisiting past reviews

### Tone & Modes

- [x] **TONE-01**: All system prompts rewritten with friendly-teacher persona using analogies and zero jargon
- [x] **TONE-02**: Explain mode reworked for users who have never coded — uses everyday analogies
- [x] **TONE-03**: Bugs mode reworked with plain-English severity and "what will actually break" framing
- [x] **TONE-04**: Refactor mode reworked as "what to ask your AI to change" with copy-pasteable prompts
- [x] **TONE-05**: Translate modes reworked to bridge vibe-coder understanding, not PM-developer gap

### UX & Onboarding

- [ ] **UX-01**: First-time onboarding flow explaining what Code Companion does and how to use it
- [x] **UX-02**: Simplified mode labels and UI language throughout (no technical jargon in navigation)
- [ ] **UX-03**: Contextual jargon glossary — hover over technical terms for plain-English definitions
- [ ] **UX-04**: Privacy-first messaging visible in UI ("Your code never leaves your computer")
- [x] **UX-05**: Model capability warnings — gentle guidance when a small model may give poor review results

## v2 Requirements

### Multi-File Review

- **MREV-01**: User can review an entire project folder with aggregated grades
- **MREV-02**: User can review a GitHub repo by URL with aggregated grades

### Review Intelligence

- **RINT-01**: Before/after comparison showing how code improved between reviews
- **RINT-02**: Export review as shareable PDF or Markdown report

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-fix / code rewriting | Bypasses vibe coder workflow — they tell their AI to fix, not this tool |
| Line-by-line annotations | Vibe coders don't read code line-by-line; line numbers are meaningless |
| Numeric scores (0-100) | False precision — LLMs can't reliably distinguish 72 from 75; letter grades are the right granularity |
| Linter/static-analysis integration | "Expected semicolon" means nothing to a vibe coder; adds setup complexity |
| IDE/editor embedding | Vibe coders use Cursor/Replit, not VS Code; standalone web app is more accessible |
| Multi-user auth | Local-only tool for single user |
| Non-Ollama LLM providers | Ollama-only for now |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| REVW-01 | Phase 1 | Pending |
| REVW-02 | Phase 1 | Pending |
| REVW-03 | Phase 1 | Pending |
| REVW-04 | Phase 1 | Pending |
| REVW-05 | Phase 3 | Complete |
| REVW-06 | Phase 4 | Complete |
| REVW-07 | Phase 3 | Complete |
| REVW-08 | Phase 3 | Complete |
| REVW-09 | Phase 3 | Complete |
| REVW-10 | Phase 4 | Complete |
| TONE-01 | Phase 2 | Complete |
| TONE-02 | Phase 2 | Complete |
| TONE-03 | Phase 2 | Complete |
| TONE-04 | Phase 2 | Complete |
| TONE-05 | Phase 2 | Complete |
| UX-01 | Phase 5 | Pending |
| UX-02 | Phase 2 | Complete |
| UX-03 | Phase 5 | Pending |
| UX-04 | Phase 5 | Pending |
| UX-05 | Phase 4 | Complete |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 after roadmap creation*
