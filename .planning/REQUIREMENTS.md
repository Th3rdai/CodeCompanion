# Requirements: Code Companion — Vibe Coder Edition

**Defined:** 2026-03-13
**Core Value:** A vibe coder can paste, upload, or point to their AI-generated code and get a clear, honest assessment of whether it's safe to ship — explained in language they actually understand.

## v1 Requirements

### Review Mode

- [x] **REVW-01**: User can paste code and receive a report card with letter grades (A-F) for bugs, security, readability, and completeness
- [x] **REVW-02**: Report card shows an overall grade summarizing code quality
- [x] **REVW-03**: Report card highlights a "Top Priority" — the single most important thing to fix first
- [x] **REVW-04**: Each category shows plain-English findings with zero jargon
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

- [x] **UX-01**: First-time onboarding flow explaining what Code Companion does and how to use it
- [x] **UX-02**: Simplified mode labels and UI language throughout (no technical jargon in navigation)
- [x] **UX-03**: Contextual jargon glossary — hover over technical terms for plain-English definitions
- [x] **UX-04**: Privacy-first messaging visible in UI ("Your code never leaves your computer")
- [x] **UX-05**: Model capability warnings — gentle guidance when a small model may give poor review results

### License Gating (Phase 7)

- [x] **LIC-01**: Builder modes (Prompting, Skillz, Agentic) and Create mode are gated by license; unlicensed users see upgrade prompts
- [x] **LIC-02**: License model supports independent feature licensing (each mode can be sold separately)
- [x] **LIC-03**: Settings UI allows activating license key, starting trial, viewing status, and deactivating

### Build Mode (Phase 15)

- [x] **BUILD-01**: Build mode appears in mode tabs next to Create; BuildWizard scaffolds a project with `.planning/` (GSD) and `stages/` (ICM)
- [x] **BUILD-02**: Scaffolded project includes CLAUDE.md, CONTEXT.md, skills/gsd-workflows.md; user can use GSD and ICM in Cursor/Claude Code
- [x] **BUILD-03**: API returns 403 for path outside allowed root, 409 for already exists without overwrite; chat input hidden when Build selected

### Build Dashboard (Phase 16)

- [ ] **BDASH-P2-01**: BuildHeader shows status badge and progress bar
- [ ] **BDASH-P2-02**: Simple/advanced toggle persists in localStorage
- [ ] **BDASH-P2-03**: "What's Next" card displays AI recommendation
- [ ] **BDASH-P3-01**: Research and plan endpoints return SSE streams
- [ ] **BDASH-P4-01**: File viewer displays whitelisted planning files
- [ ] **BDASH-P4-02**: File editor saves with atomic write
- [ ] **BDASH-P5-01**: Handoff shows copy-pasteable GSD commands

### Security Pen Test Mode (Phase 18)

- [ ] **SEC-01**: New "Security" mode appears in mode tabs with OWASP security assessment capability
- [ ] **SEC-02**: Elite Agent skill file (OWASP-pentest-agent.md) with comprehensive OWASP web app and API testing methodology
- [ ] **SEC-03**: System prompt and skill file reference OWASP Top 10 2021, API Security Top 10 2023, WSTG v4.2, and ASVS v4.0
- [ ] **SEC-04**: POST /api/pentest endpoint returns structured vulnerability reports with chatStructured, falls back to chatStream
- [ ] **SEC-05**: Structured output includes severity ratings (CVSS-simplified bands), per-category grades, and copy-paste remediation prompts

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
| REVW-01 | Phase 1 | Complete |
| REVW-02 | Phase 1 | Complete |
| REVW-03 | Phase 1 | Complete |
| REVW-04 | Phase 1 | Complete |
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
| UX-01 | Phase 5 | Complete |
| UX-02 | Phase 2 | Complete |
| UX-03 | Phase 5 | Complete |
| UX-04 | Phase 5 | Complete |
| UX-05 | Phase 4 | Complete |
| LIC-01 | Phase 7 | Complete |
| LIC-02 | Phase 7 | Complete |
| LIC-03 | Phase 7 | Complete |
| BUILD-01 | Phase 15 | Complete |
| BUILD-02 | Phase 15 | Complete |
| BUILD-03 | Phase 15 | Complete |
| BDASH-P2-01 | Phase 16 | Planned |
| BDASH-P2-02 | Phase 16 | Planned |
| BDASH-P2-03 | Phase 16 | Planned |
| BDASH-P3-01 | Phase 16 | Planned |
| BDASH-P4-01 | Phase 16 | Planned |
| BDASH-P4-02 | Phase 16 | Planned |
| BDASH-P5-01 | Phase 16 | Planned |
| SEC-01 | Phase 18 | Planned |
| SEC-02 | Phase 18 | Planned |
| SEC-03 | Phase 18 | Planned |
| SEC-04 | Phase 18 | Planned |
| SEC-05 | Phase 18 | Planned |

**Coverage:**
- v1 requirements: 20 total
- License (Phase 7): 3 total
- Build Mode (Phase 15): 3 total
- Build Dashboard (Phase 16): 7 total
- Security Mode (Phase 18): 5 total
- Mapped to phases: 38
- Unmapped: 0

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-15 — Added Security Pen Test Mode (Phase 18) requirements SEC-01 through SEC-05*
