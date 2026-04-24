# Roadmap: Code Companion — Vibe Coder Edition

## Overview

This roadmap transforms Code Companion from a PM-focused code analysis tool into a vibe-coder-friendly code reviewer, then packages it as a self-contained desktop application. The build order is architecturally constrained: the structured review engine must exist before any UI can consume it, tone must be unified before user-facing testing, and the report card UI must be functional before layering on history, fix prompts, and onboarding. Phases 1–7 deliver core v1 (Review, Tone, UX, Desktop, License); Phases 8–14 cover license distribution; Phases 15–18 add Build, Dashboard, Installer, Security; Phases 19–24 cover deployment hardening and new features. **Phases 25–26** extend the **chat agent** with first-party **Validate** and **Planner** capabilities — full requirements and risks: **[`docs/AGENT-APP-CAPABILITIES-ROADMAP.md`](../docs/AGENT-APP-CAPABILITIES-ROADMAP.md)**. Phase 27 (GSD bridge) is deferred.

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
- [ ] ~~**Phase 8: Payment Integration**~~ - Stripe/Paddle checkout, purchase flow (DEFERRED — align with Th3rdAI commercial licensing when needed)
- [ ] ~~**Phase 9: License Batch Generation**~~ - Bulk key generation, lib/license-generator.js (DEFERRED)
- [ ] ~~**Phase 10: License Payment Webhook**~~ - Auto-generate keys on purchase completion (DEFERRED)
- [ ] ~~**Phase 11: License Server API**~~ - Online validation, revocation endpoint (DEFERRED)
- [ ] ~~**Phase 12: License Key Pool**~~ - Pre-generated key pool, claim API (DEFERRED)
- [ ] ~~**Phase 13: License Email Delivery**~~ - Send keys via email with template (DEFERRED)
- [ ] ~~**Phase 14: License Revocation**~~ - Revoke keys, audit log (DEFERRED)
- [x] **Phase 15: Build Mode (GSD + ICM)** - New Build mode next to Create; scaffolds combined GSD + ICM project for apps/tools (approved plan 2026-03-14; implementation complete)
- [x] **Phase 16: Build Dashboard** - Full project dashboard for Build mode: registry + shell, Simple View, AI Research/Planning, Advanced View, Handoff+Polish (completed 2026-03-15)
- [x] **Phase 17: Auto-Update, Portable Mode & Installer Design** - Self-contained portable data directory, auto-update UI with download progress, premium splash screen/DMG/NSIS branding (completed 2026-03-15)
- [x] **Phase 18: Security Pen Test Mode** - OWASP-based web app and API penetration testing agent with Elite Agent skill, added as a mode next to Build (planned) (completed 2026-03-16)
- [x] **Phase 19: Security Enhancements** - Multi-file/folder scanning, drag & drop, export (Copy/MD/CSV/HTML/PDF/JSON), remediation zip download, follow-up chat, Deep Dive conversations (completed 2026-03-19)
- [x] **Phase 20: Validate Mode** - New Validate tab: analyze local folder or GitHub repo, generate project-specific validate.md with phased validation (Lint/Type/Style/Test/E2E), one-click IDE install for Claude Code/Cursor/VS Code/OpenCode, Install All button (completed 2026-03-19)
- [x] **Phase 21: Deployment Hardening** - HTTPS support with self-signed cert auto-generation in deploy.sh, startup.sh protocol-aware health checks, HSTS redirect removal from index.html, configurable server port (default 8900), blank default project folder (completed 2026-03-19)
- [x] **Phase 22: Stability Fixes** - TokenCounter crash fix (blank page prevention), SSE streaming flash fix (debounced updates), increased backend model timeout to 300s, Mermaid diagram rendering without language tag (completed 2026-03-19)
- [x] **Phase 23: Save Chat** - Download entire conversation as markdown file with auto-generated 1-2 word topic filename, available in all modes via toolbar button (completed 2026-03-19)
- [x] **Phase 24: IDE Command Distribution** - Create and Build scaffolders auto-copy IDE command files from IDE_COMMANDS/ into every new project across all 5 IDE paths (.claude/commands/, .cursor/commands/, .cursor/prompts/, .github/prompts/, .opencode/commands/) (completed 2026-03-19)
- [x] **Phase 24.5: Tech Health** — ESLint + Prettier baseline, duplicate test tree consolidation, `lib/history.js` atomic write hardening, `src/App.jsx` hook extraction (`useChat`, `useModels`), `server.js` route decomposition into `routes/`. Zero behavioral changes. **Detail:** [`.planning/phases/24.5-tech-health/24.5-CONTEXT.md`](.planning/phases/24.5-tech-health/24.5-CONTEXT.md) (Plans 01–03). (completed 2026-04-09)
- [x] **Phase 25: Agent — Validate builtins** — Builtin tools so chat can run the same project scan + `validate.md` generation as Validate mode (`lib/validate.js`, `/api/validate/*`); optional save under project folder; Settings gate added. **Detail:** [`docs/AGENT-APP-CAPABILITIES-ROADMAP.md`](../docs/AGENT-APP-CAPABILITIES-ROADMAP.md) (AAP-01–AAP-05). (completed 2026-04-09)
- [x] **Phase 26: Agent — Planner tools** — Builtin(s) so chat can score planner-shaped content via the same `/api/score` path as Planner mode (`PlannerPanel`); Settings gate added. **Detail:** same doc (AAP-06–AAP-10). (completed 2026-04-09)
- [x] **Phase 28: Multi-File Code Review** — Extend Review mode to accept multiple files and whole folders (mirror Security mode's multi-file scanning), producing a unified report card across the full project rather than a single paste. (completed 2026-04-09)
- [ ] ~~**Phase 27 (optional): Agent — GSD bridge builtins**~~ — Thin, allowlisted wrappers around `lib/gsd-bridge.js` for safe planning queries from chat. **Detail:** same doc (AAP-11–AAP-14). (DEFERRED — low value for most users; Build mode already surfaces GSD data; skip unless real demand emerges)

## Post–roadmap enhancements (tracked in repo history)

- [x] **Unified chat export (2026-03-21)** — Toolbar **Export** (`src/components/ExportPanel.jsx`): 11 formats (text, web, documents, spreadsheets, presentations), source = full conversation or last assistant reply, multi-download or ZIP; server `lib/office-generator.js`, `POST /api/generate-office`, `GET /api/export/formats`; builtin agent tool `generate_office_file`; Excel/CSV and cleaned professional Office output (commits through `a6e9e3f` area).
- [x] **Electron GitHub updater fix (2026-03-21)** — `patches/electron-updater+6.8.3.patch` + `electron/updater.js` `allowPrerelease` for GitHub API/Atom behavior (`d475a6f`).

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
   **Plans**: 5 plans
   **Requirements**: P2-01, P2-02, P2-03, P3-01, P4-01, P4-02, P5-01

Plans:

- [x] 16-00-PLAN.md — Wave 0: Test stub files for all phase 16 requirements (Nyquist validation)
- [x] 16-01-PLAN.md — Simple View: BuildHeader, BuildSimpleView, next-action endpoint, localStorage toggle
- [x] 16-02-PLAN.md — AI Research/Planning: SSE research+plan endpoints, streaming UI in Simple View
- [x] 16-03-PLAN.md — Advanced View: BuildAdvancedView, PlanningFileViewer, file read/write whitelist endpoints
- [x] 16-04-PLAN.md — Handoff+Polish: ClaudeCodeHandoff, prop threading, error states, refresh-from-disk

**Notes**: Uses lib/build-registry.js, lib/gsd-bridge.js, BuildPanel.jsx; POST /api/build/projects for import; isWithinBasePath, getAppRoot() added

### Phase 17: Auto-Update, Portable Mode & Installer Design

**Goal**: Self-contained portable app (delete folder = full uninstall), in-app auto-update with UI, premium installer/splash branding
**Depends on**: Phase 6 (desktop app)
**Success Criteria** (what must be TRUE):

1. Data directory stored next to app as sibling folder, not in OS user-data — delete the folder removes everything
2. Auto-migration from legacy OS data location on first run (non-destructive)
3. Settings → General (Electron) shows **Software Updates** with **Upgrade**, download progress, and **Restart to upgrade** (GitHub Releases via electron-updater)
4. OS / electron-updater notifications may appear when an update is available or downloaded (in addition to in-app status)
5. Splash screen uses premium neon/glassmorphism design with animations
6. DMG background and NSIS installer have matching branded visuals
7. electron-builder publish config points to correct GitHub repo
   **Plans**: Ad-hoc (no formal plans — implemented directly)
   **Completed**: 2026-03-15
   **UAT**: 9/9 passed (automated agent verification)

### Phase 18: Security Pen Test Mode

**Goal**: Add a Security mode to Code Companion that enables OWASP-based static code analysis for web application and API security vulnerabilities, with structured vulnerability reports, severity ratings, remediation prompts, and an Elite Agent skill file
**Depends on**: Phase 7 (all core modes complete)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05
**Success Criteria** (what must be TRUE):

1. New "Security" mode appears in mode tabs with OWASP security assessment description
2. Elite Agent skill file (OWASP-pentest-agent.md) with comprehensive web app and API testing methodology
3. Agent uses OWASP Top 10 2021, OWASP ASVS v4.0, WSTG v4.2, and API Security Top 10 2023 as knowledge base
4. Agent can analyze code for vulnerabilities, suggest test cases, and generate structured penetration test reports
5. Mode uses structured output with severity ratings, CVSS-simplified bands, and copy-paste remediation prompts
   **Plans**: 3 plans

Plans:

- [x] 18-01-PLAN.md — Backend: Zod schema, pentestCode() orchestration, system prompts, test scaffolds
- [x] 18-02-PLAN.md — Elite Agent skill file (OWASP-pentest-agent.md) with OWASP methodology
- [x] 18-03-PLAN.md — Frontend: SecurityPanel, SecurityReport, mode registration, server endpoint, human verification

### Phase 19: Security Enhancements

**Goal**: Upgrade Security mode with multi-file/folder scanning, drag & drop input, comprehensive export options, AI-powered remediation with zip download, and follow-up conversation support
**Depends on**: Phase 18
**Completed**: 2026-03-19
**What was built**:

- Multi-file upload and folder drag & drop for security scanning
- Recursive folder scanning via `/api/pentest/folder` endpoint
- Export dropdown: Copy, .md, .csv, .html, PDF, .json (both structured and fallback views)
- Remediate button: sends findings + code to AI, generates fixed files, downloads zip with REMEDIATION-REPORT.md, original/, and remediated/ folders
- Follow-up chat input on fallback (streaming markdown) view
- JSZip for client-side zip generation

### Phase 20: Validate Mode

**Goal**: New Validate tab that analyzes a local project folder or GitHub repo and generates a project-specific validate.md command file with phased validation
**Depends on**: Phase 18 (mode tab pattern)
**Completed**: 2026-03-19
**What was built**:

- ValidatePanel.jsx: two input tabs (Local Folder / GitHub Repo)
- Backend `/api/validate/scan` endpoint using lib/validate.js to discover project tooling
- AI generates phased validation: Lint → Type Check → Style → Unit Tests → E2E
- Structured result display with phase cards and IDE install paths
- One-click install to Claude Code, Cursor, VS Code, OpenCode
- "Install All" button writes to all 4 IDE paths at once
- GitHub repo cloning via `/api/validate/github` endpoint
- Download validate.md, Copy, and New Scan buttons

### Phase 21: Deployment Hardening

**Goal**: Make Code Companion deployable on remote hosts without manual HTTPS/port/folder configuration issues
**Depends on**: Phase 6
**Completed**: 2026-03-19
**What was built**:

- server.js: HTTPS support with auto-detection of cert/server.crt and cert/server.key, fallback to HTTP
- deploy.sh: auto-generates self-signed cert on first deploy via openssl
- startup.sh: protocol-aware health checks (detects HTTPS vs HTTP)
- Removed HTTPS→HTTP redirect script from index.html
- Configurable server port (default 8900, stored in .cc-config.json)
- Blank default project folder (no more hardcoded /Users/you/... path)
- createModeAllowedRoots defaults to user home directory

### Phase 22: Stability Fixes

**Goal**: Eliminate crash-causing bugs and improve reliability of streaming responses
**Depends on**: All prior phases
**Completed**: 2026-03-19
**What was built**:

- TokenCounter.jsx: coerces duration to Number, checks isFinite before .toFixed() — prevents blank page crash
- SSE streaming: debounced state updates to prevent screen flashing
- Backend model timeout increased to 300,000ms (5 min) in lib/review.js getTimeoutForModel()
- Mermaid diagram detection: renders diagrams even without `mermaid` language tag if content matches known patterns

### Phase 23: Save Chat

**Goal**: Allow users to download any conversation as a markdown file
**Depends on**: Phase 5 (chat UI)
**Completed**: 2026-03-19
**What was built**:

- "Save Chat" button in chat toolbar (all modes)
- Generates markdown with conversation metadata (mode, model, date)
- Auto-generated 1-2 word topic filename from first user message
- Downloads as .md file via browser

### Phase 24: IDE Command Distribution

**Goal**: Automatically copy IDE command files into every new project created by Create or Build scaffolders
**Depends on**: Phase 15
**Completed**: 2026-03-19
**What was built**:

- lib/icm-scaffolder.js and lib/build-scaffolder.js: copy files from IDE_COMMANDS/ (app root) into new projects
- Copies to all 5 IDE paths: .claude/commands/, .cursor/commands/, .cursor/prompts/, .github/prompts/, .opencode/commands/
- Falls back to configured template path's Commands/ folder if IDE_COMMANDS/ doesn't exist
- Create wizard result screen: "Open in Build" button for Create→Build handoff

### Phase 25: Agent — Validate builtins

**Goal**: Builtin tools so the chat agent can run the same project scan and `validate.md` generation as Validate mode, via `lib/validate.js` and `/api/validate/*`, with optional save under the project folder and a Settings gate.

**Depends on**: Phase 20 (Validate Mode).

**Requirements**: AAP-01–AAP-05 — see [`docs/AGENT-APP-CAPABILITIES-ROADMAP.md`](../docs/AGENT-APP-CAPABILITIES-ROADMAP.md).

**Plans**: Implemented ad-hoc (completed 2026-04-09).

### Phase 26: Agent — Planner tools

**Goal**: Builtin(s) so the chat agent can score planner-shaped content via the same `/api/score` path as Planner mode (`PlannerPanel`), with a Settings gate.

**Depends on**: Phase 25 (shared gate patterns).

**Requirements**: AAP-06–AAP-10 — see [`docs/AGENT-APP-CAPABILITIES-ROADMAP.md`](../docs/AGENT-APP-CAPABILITIES-ROADMAP.md).

**Plans**: Implemented ad-hoc (completed 2026-04-09).

### Phase 28: Multi-File Code Review

**Goal**: Extend Review mode to accept multiple files and whole folders, producing a unified report card across a full project — mirroring Security mode's multi-file scanning capability applied to the existing review engine.

**Depends on**: Phase 1 (Review Engine), Phase 18/19 (Security multi-file scanning patterns).

**Requirements**: MREV-01.

**Plans**: 3 plans

Plans:

- [ ] 28-00-PLAN.md — Wave 0 test scaffolds: unit stubs for reviewFiles(), integration stubs for folder routes
- [ ] 28-01-PLAN.md — Backend: reviewFiles() in lib/review.js + /api/review/folder/preview and /api/review/folder routes
- [ ] 28-02-PLAN.md — Frontend: Scan Folder tab in ReviewPanel.jsx with folder path input, preview step, and unified report card

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6
(Phases 1 and 2 have no dependency on each other and could execute in either order)

| Phase                         | Plans Complete | Status   | Completed  |
| ----------------------------- | -------------- | -------- | ---------- |
| 1. Review Engine              | 2/2            | Complete | 2026-03-13 |
| 2. Tone Unification           | 2/2            | Complete | 2026-03-13 |
| 3. Report Card UI             | 2/2            | Complete | 2026-03-14 |
| 4. Actionable Guidance        | 2/2            | Complete | 2026-03-14 |
| 5. Onboarding and Help        | 2/2            | Complete | 2026-03-14 |
| 6. Desktop App                | 4/4            | Complete | 2026-03-14 |
| 7. License Gating             | 1/1            | Complete | 2026-03-14 |
| 8. Payment Integration        | —              | Deferred | —          |
| 9. License Batch Generation   | —              | Deferred | —          |
| 10. License Payment Webhook   | —              | Deferred | —          |
| 11. License Server API        | —              | Deferred | —          |
| 12. License Key Pool          | —              | Deferred | —          |
| 13. License Email Delivery    | —              | Deferred | —          |
| 14. License Revocation        | —              | Deferred | —          |
| 15. Build Mode (GSD + ICM)    | 1/1            | Complete | 2026-03-14 |
| 16. Build Dashboard           | 5/5            | Complete | 2026-03-16 |
| 17. Auto-Update & Installer   | ad-hoc         | Complete | 2026-03-16 |
| 18. Security Pen Test Mode    | 3/3            | Complete | 2026-03-16 |
| 19. Security Enhancements     | ad-hoc         | Complete | 2026-03-19 |
| 20. Validate Mode             | ad-hoc         | Complete | 2026-03-19 |
| 21. Deployment Hardening      | ad-hoc         | Complete | 2026-03-19 |
| 22. Stability Fixes           | ad-hoc         | Complete | 2026-03-19 |
| 23. Save Chat                 | ad-hoc         | Complete | 2026-03-19 |
| 24. IDE Command Distribution  | ad-hoc         | Complete | 2026-03-19 |
| 24.5. Tech Health             | 3 plans        | Complete | 2026-04-09 |
| 25. Agent — Validate builtins | ad-hoc         | Complete | 2026-04-09 |
| 26. Agent — Planner tools     | ad-hoc         | Complete | 2026-04-09 |
| 27. Agent — GSD bridge (opt.) | —              | Deferred | —          |
| 28. Multi-File Code Review    | 3/3            | Complete | 2026-04-09 |

## License Distribution Roadmap (Phases 8–14) — DEFERRED

Project is Th3rdAI-licensed (personal/non-commercial; commercial by agreement). These phases are deferred until paid/commercial distribution is prioritized. Plans exist on disk in `.planning/phases/` for future reference.
