# Requirements: Code Companion — Vibe Coder Edition

**Defined:** 2026-03-13
**Core Value:** A vibe coder can paste, upload, or point to their AI-generated code and get a clear, honest assessment of whether it's safe to ship — explained in language they actually understand.

## v1 Requirements

### Review Mode

- [ ] **REVW-01**: User can paste code and receive a report card with letter grades (A-F) for bugs, security, readability, and completeness
- [ ] **REVW-02**: Report card shows an overall grade summarizing code quality
- [ ] **REVW-03**: Report card highlights a "Top Priority" — the single most important thing to fix first
- [ ] **REVW-04**: Each category shows plain-English findings with zero jargon
- [ ] **REVW-05**: User can click any grade category to start a conversational deep-dive explaining the issues
- [ ] **REVW-06**: Each finding includes a "What to ask your AI to fix" copy-pasteable prompt
- [ ] **REVW-07**: Report card uses color-coded grades (A=green through F=red) for instant visual feedback
- [ ] **REVW-08**: User sees a friendly loading state ("Grading your code...") while review processes
- [ ] **REVW-09**: User can upload files or use file browser to feed code into review
- [ ] **REVW-10**: Review history saves structured report card data for revisiting past reviews

### Tone & Modes

- [ ] **TONE-01**: All system prompts rewritten with friendly-teacher persona using analogies and zero jargon
- [ ] **TONE-02**: Explain mode reworked for users who have never coded — uses everyday analogies
- [ ] **TONE-03**: Bugs mode reworked with plain-English severity and "what will actually break" framing
- [ ] **TONE-04**: Refactor mode reworked as "what to ask your AI to change" with copy-pasteable prompts
- [ ] **TONE-05**: Translate modes reworked to bridge vibe-coder understanding, not PM-developer gap

### UX & Onboarding

- [ ] **UX-01**: First-time onboarding flow explaining what Code Companion does and how to use it
- [ ] **UX-02**: Simplified mode labels and UI language throughout (no technical jargon in navigation)
- [ ] **UX-03**: Contextual jargon glossary — hover over technical terms for plain-English definitions
- [ ] **UX-04**: Privacy-first messaging visible in UI ("Your code never leaves your computer")
- [ ] **UX-05**: Model capability warnings — gentle guidance when a small model may give poor review results

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
| REVW-01 | — | Pending |
| REVW-02 | — | Pending |
| REVW-03 | — | Pending |
| REVW-04 | — | Pending |
| REVW-05 | — | Pending |
| REVW-06 | — | Pending |
| REVW-07 | — | Pending |
| REVW-08 | — | Pending |
| REVW-09 | — | Pending |
| REVW-10 | — | Pending |
| TONE-01 | — | Pending |
| TONE-02 | — | Pending |
| TONE-03 | — | Pending |
| TONE-04 | — | Pending |
| TONE-05 | — | Pending |
| UX-01 | — | Pending |
| UX-02 | — | Pending |
| UX-03 | — | Pending |
| UX-04 | — | Pending |
| UX-05 | — | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 0
- Unmapped: 20 ⚠️

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 after initial definition*
