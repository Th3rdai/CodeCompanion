# Roadmap: Code Companion — Vibe Coder Edition

## Overview

This roadmap transforms Code Companion from a PM-focused code analysis tool into a vibe-coder-friendly code reviewer, then packages it as a self-contained desktop application. The build order is architecturally constrained: the structured review engine must exist before any UI can consume it, tone must be unified before user-facing testing, and the report card UI must be functional before layering on history, fix prompts, and onboarding. Phases 1–7 deliver core v1 (Review, Tone, UX, Desktop, License); Phases 8–14 cover license distribution; Phases 15–16 add Build mode and Build Dashboard.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Review Engine** - Backend structured output endpoint that generates report cards with grades, findings, and top priority (completed 2026-03-13)
- [x] **Phase 2: Tone Unification** - Rewrite all system prompts and mode labels for friendly-teacher vibe-coder persona (completed 2026-03-13)
- [x] **Phase 3: Report Card UI** - Visual report card display with color-coded grades, deep-dive conversation, and all input methods (completed 2026-03-14)
- [x] **Phase 4: Actionable Guidance** - Copy-pasteable fix prompts, review history persistence, and model capability warnings (completed 2026-03-14)
- [x] **Phase 5: Onboarding and Help** - First-time user flow, contextual jargon glossary, and privacy messaging (completed 2026-03-14)
- [x] **Phase 6: Desktop App** - Electron packaging for self-contained macOS, Linux, and Windows desktop application (completed 2026-03-14)
- [x] **Phase 7: License Gating** - Feature-based license model; gate Skillz and Agentic; wire license API and Settings UI (completed 2026-03-14)
- [ ] **Phase 8: Payment Integration** - Stripe/Paddle checkout, purchase flow (planned)
- [ ] **Phase 9: License Batch Generation** - Bulk key generation, lib/license-generator.js (planned)
- [ ] **Phase 10: License Payment Webhook** - Auto-generate keys on purchase completion (planned)
- [ ] **Phase 11: License Server API** - Online validation, revocation endpoint (planned)
- [ ] **Phase 12: License Key Pool** - Pre-generated key pool, claim API (planned)
- [ ] **Phase 13: License Email Delivery** - Send keys via email with template (planned)
- [ ] **Phase 14: License Revocation** - Revoke keys, audit log (planned)
- [x] **Phase 15: Build Mode (GSD + ICM)** - New Build mode next to Create; scaffolds combined GSD + ICM project for apps/tools (approved plan 2026-03-14; implementation complete)
- [ ] **Phase 16: Build Dashboard** - Full project dashboard for Build mode: registry + shell (Phase 1 complete), Simple View, AI Research/Planning, Advanced View, Handoff+Polish (in progress)

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
- [x] 01-01-PLAN.md — Schema, chatStructured client function, and review system prompt
- [x] 01-02-PLAN.md — POST /api/review endpoint with structured output + chat fallback

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
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Test scaffolds + rewrite 7 mode prompts for vibe-coder audience with mode-specific personalities
- [x] 02-02-PLAN.md — Update translation mode labels (Code → Plain English, Idea → Code Spec) and placeholders

### Phase 3: Report Card UI
**Goal**: Users can see their code review as a visual report card with color-coded grades, click into conversational deep-dives, and feed code through any input method
**Depends on**: Phase 1
**Requirements**: REVW-05, REVW-07, REVW-08, REVW-09
**Success Criteria** (what must be TRUE):
  1. Report card displays color-coded letter grades (green for A through red for F) for each category
  2. User can click any grade category to enter a streaming conversational deep-dive about that category's issues
  3. User sees a friendly loading state ("Grading your code...") while the review processes
  4. User can feed code into review via paste, file upload, or file browser — all paths produce the same report card
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — LoadingAnimation component, progressive disclosure toggle, E2E tests
- [x] 03-02-PLAN.md — Input method tabs (paste/upload/browse), explicit deep-dive buttons, E2E tests

### Phase 4: Actionable Guidance
**Goal**: Reviews become reusable and actionable — every finding has a copy-pasteable prompt for the user's AI tool, past reviews are saved, and the app warns when a model may produce poor results
**Depends on**: Phase 3
**Requirements**: REVW-06, REVW-10, UX-05
**Success Criteria** (what must be TRUE):
  1. Each finding includes a "What to ask your AI to fix" copy-pasteable prompt the user can paste into Cursor/ChatGPT
  2. Completed reviews are saved and can be revisited from history with the full report card intact
  3. When a user selects a small model unlikely to produce quality reviews, a gentle warning appears before the review starts
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Fix prompts: schema extension, system prompt update, FindingCard UI blocks, bulk copy
- [x] 04-02-PLAN.md — Review history persistence with sidebar grade badges, deep-dive save/restore, model tier warnings

### Phase 5: Onboarding and Help
**Goal**: A first-time user understands what Code Companion does, how to use it, and can get help with any technical term they encounter — all while knowing their code stays private
**Depends on**: Phase 2 (tone must be set before onboarding text is written)
**Requirements**: UX-01, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. A first-time user sees an onboarding flow that explains what Code Companion does and walks them through their first review
  2. Hovering over or clicking a technical term anywhere in the app shows a plain-English definition
  3. The UI displays clear privacy messaging ("Your code never leaves your computer") visible without hunting for it
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — OnboardingWizard vibe-coder content update with Ollama troubleshooting and Lucide mode icons
- [x] 05-02-PLAN.md — GLOSSARY audit for vibe-coder language, PrivacyBanner verification, test scaffolds

### Phase 6: Desktop App
**Goal**: Code Companion runs as a self-contained Electron desktop application on macOS, Linux, and Windows, with native window management, auto-free port detection, cross-platform IDE launchers, and distributable installers
**Depends on**: Phase 5 (all features complete before packaging)
**Requirements**: DESK-01, DESK-02, DESK-03, DESK-04, DESK-05
**Success Criteria** (what must be TRUE):
  1. App launches as a native desktop window (no manual terminal commands or browser required)
  2. Express server starts automatically on a free port inside the Electron process
  3. IDE launcher buttons work on macOS, Linux, and Windows (platform-detected commands)
  4. Distributable installers produced: .dmg for macOS, .AppImage for Linux, .exe for Windows
  5. App data (config, history, logs) stored in OS-appropriate user data directory
**Plans**: 4 plans

Plans:
- [x] 06-01-PLAN.md — Electron main process, embedded Express with free port, data directory management, window state + last-mode persistence
- [x] 06-02-PLAN.md — Cross-platform IDE launchers, Ollama setup wizard with auto-install and model pull progress
- [x] 06-03-PLAN.md — electron-builder config, auto-updater with pre-update backup, app resources, landing page
- [x] 06-04-PLAN.md — Integration smoke test and human verification of complete desktop app

### Phase 7: License Gating
**Goal**: Wire existing license infrastructure so builder modes (Prompting, Skillz, Agentic) and Create mode are gated. Extend license model to feature-based (independent licensing per mode). Expose license API, filter frontend modes, add License UI in Settings.
**Depends on**: Phase 6 (desktop app complete)
**Requirements**: LIC-01, LIC-02, LIC-03
**Success Criteria** (what must be TRUE):
  1. Unlicensed users cannot access /api/score or /api/create-project (403 upgrade_required)
  2. Frontend shows only licensed modes in mode tabs
  3. Settings has License section: activate key, start trial, view status, deactivate
  4. Feature-based keys support independent Prompting/Skillz/Agentic licensing; legacy tier:pro keys grant all
**Plans**: 1 plan

Plans:
- [x] 07-01-PLAN.md — Feature-based license model, server wiring, frontend filtering, Settings License UI

### Phase 8: Payment Integration
**Goal**: Customers can purchase Pro via Stripe or Paddle; checkout flow integrated
**Depends on**: Phase 7
**Plans**: PLAN.md (planning only)

### Phase 9: License Batch Generation
**Goal**: Generate hundreds or thousands of keys from CSV/JSON; extract shared lib/license-generator.js
**Depends on**: Phase 7
**Plans**: 09-01-PLAN.md

### Phase 10: License Payment Webhook
**Goal**: Auto-generate and deliver keys when purchase completes (Stripe/Paddle webhook)
**Depends on**: Phase 9
**Plans**: 10-01-PLAN.md

### Phase 11: License Server API
**Goal**: Online validation and revocation; admin revoke endpoint
**Depends on**: Phase 9, Phase 10
**Plans**: 11-01-PLAN.md

### Phase 12: License Key Pool
**Goal**: Pre-generate key pool; optional claim API for post-purchase assignment
**Depends on**: Phase 9
**Plans**: 12-01-PLAN.md

### Phase 13: License Email Delivery
**Goal**: Send license keys via email with branded template (SendGrid, Resend, etc.)
**Depends on**: Phase 9
**Plans**: 13-01-PLAN.md

### Phase 14: License Revocation
**Goal**: Revoke keys (chargebacks, abuse); validation checks revocation
**Depends on**: Phase 10 or 11
**Plans**: 14-01-PLAN.md

### Phase 15: Build Mode (GSD + ICM)
**Goal**: Add a Build mode that scaffolds a new project combining get-shit-done (GSD) and ICM Framework so users can build apps, tools, or software using both methodologies
**Depends on**: Phase 5 (Create mode and wizard patterns exist)
**Requirements**: BUILD-01, BUILD-02, BUILD-03
**Success Criteria** (what must be TRUE):
  1. Build mode appears in mode tabs next to Create; BuildWizard completes and scaffolds a project with `.planning/` (GSD) and `stages/` (ICM)
  2. Scaffolded project has CLAUDE.md, CONTEXT.md, skills/gsd-workflows.md; user can open in Cursor/Claude Code and use GSD and ICM workflows
  3. Path outside allowed root returns 403; already exists without overwrite returns 409; chat input hidden when Build selected
**Plans**: Approved plan in `.planning/phases/build-mode-gsd-icm/` (DRAFT-PLAN.md revised and approved 2026-03-14)

### Phase 16: Build Dashboard
**Goal**: Full project dashboard for Build mode — list projects, view phases/plans, run GSD commands, AI research/planning, advanced view, handoff and polish
**Depends on**: Phase 15 (Build mode and scaffold)
**Success Criteria** (what must be TRUE):
  1. Phase 1 (Registry + Shell): Build projects registered on scaffold; import existing by path; rate-limited API; multi-tool convention files (CLAUDE.md, .cursorrules, .windsurfrules, .opencode/instructions.md)
  2. Phases 2–5: Simple View, AI Research/Planning, Advanced View, Handoff+Polish (as planned)
**Plans**: Phase 1 complete (2026-03-14); Phases 2–5 pending
**Notes**: Uses lib/build-registry.js, lib/gsd-bridge.js, BuildPanel.jsx; POST /api/build/projects for import; isWithinBasePath, getAppRoot() added

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6
(Phases 1 and 2 have no dependency on each other and could execute in either order)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Review Engine | 2/2 | Complete | 2026-03-13 |
| 2. Tone Unification | 2/2 | Complete | 2026-03-13 |
| 3. Report Card UI | 2/2 | Complete | 2026-03-14 |
| 4. Actionable Guidance | 2/2 | Complete | 2026-03-14 |
| 5. Onboarding and Help | 2/2 | Complete | 2026-03-14 |
| 6. Desktop App | 4/4 | Complete | 2026-03-14 |
| 7. License Gating | 1/1 | Complete | 2026-03-14 |
| 8. Payment Integration | 0/1 | Planned | — |
| 9. License Batch Generation | 0/1 | Planned | — |
| 10. License Payment Webhook | 0/1 | Planned | — |
| 11. License Server API | 0/1 | Planned | — |
| 12. License Key Pool | 0/1 | Planned | — |
| 13. License Email Delivery | 0/1 | Planned | — |
| 14. License Revocation | 0/1 | Planned | — |
| 15. Build Mode (GSD + ICM) | 1/1 | Complete | 2026-03-14 |
| 16. Build Dashboard | 1/5 | In progress | Phase 1: 2026-03-14 |

## License Distribution Roadmap (Phases 9–14)

**Suggested execution order:**
1. **Phase 9** (Batch) — Foundation; extract license-generator
2. **Phase 13** (Email) — Needed for any automated delivery
3. **Phase 10** (Webhook) — When adding Stripe/Paddle
4. **Phase 11** (Server API) — When online validation/revocation needed
5. **Phase 14** (Revocation) — When revoking keys required
6. **Phase 12** (Key Pool) — Optional; for pre-generated key campaigns
