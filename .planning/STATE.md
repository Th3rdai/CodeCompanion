---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: milestone
status: unknown
stopped_at: Completed 18-03-PLAN.md
last_updated: "2026-03-29T12:00:00.000Z"
last_activity: 2026-03-29 — **MCP image generation fixes** (hallucination stripping, base64 context bloat, const crash, placeholder leak, vision fallback, historical image arrays); **auto-model per mode**; **chat latency** optimizations; **integration tests** fixed. 3 commits pushed (`b78c0fe`, `6092e83`, `afd4da8`). **Next:** pre-release checklist.
progress:
  total_phases: 24
  completed_phases: 15
  total_plans: 29
  completed_plans: 23
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13)

**Core value:** A vibe coder can paste, upload, or point to their AI-generated code and get a clear, honest assessment of whether it's safe to ship — explained in language they actually understand.
**Current focus:** All 24 phases complete (15 delivered, 7 deferred). Validate mode, enhanced Security, deployment hardening, stability fixes shipped.

## Current Position

All 24 phases complete (15 delivered, 7 deferred). All tests passing (Playwright UI/E2E, node:test unit, **`npm run test:integration`** for API+images).
Last activity: 2026-03-29 — **MCP image generation fixes** (6 issues: hallucination stripping, base64 bloat, const crash, placeholder leak, vision fallback locked to llava:7b, historical image arrays causing 400s); **auto-model per mode** (`lib/auto-model.js`); **chat latency** optimizations; **integration tests** aligned with current API. 3 commits: `b78c0fe`, `6092e83`, `afd4da8`. Next: pre-release checklist; optional CLIPLAN Phase 4.

### Build Dashboard Phase 1 Details (completed 2026-03-14)

**Bug fix:** `isWithinBasePath` — function was imported and used in `server.js` (line 1024) but never defined or exported from `lib/file-browser.js`. Added the function and exported it.

**New export:** `getAppRoot()` added to `lib/config.js` — exposes the private `_appRoot` variable for modules (like `build-scaffolder.js`) that need the app data directory path without passing it through every call.

**Auto-registration (Plan Risk #5):** `lib/build-scaffolder.js` now calls `addProject()` from `build-registry.js` after successful atomic rename. If registry write fails, scaffold still succeeds (project exists on disk) with a warning. Prevents orphaned projects that exist on disk but don't appear in the dashboard.

**Import route:** Added `POST /api/build/projects` for importing existing projects by folder path. Validates the folder exists and contains a `.planning/` directory before registering. Derives project name from folder basename.

**Rate limiting (Plan Risk #8):** Added `app.use('/api/build/projects', createRateLimiter(...))` for POST/DELETE methods on all build registry routes.

**Multi-tool convention files:** Build scaffolder now generates identical project instructions in all four AI coding tool convention files: `CLAUDE.md` (Claude Code), `.cursorrules` (Cursor), `.windsurfrules` (Windsurf), `.opencode/instructions.md` (OpenCode). Users open the project in any supported tool and get GSD + ICM context automatically.

**Discovery:** Full Build dashboard infrastructure already existed from prior session:
- `lib/build-registry.js` — project registry with atomic writes and path validation
- `lib/gsd-bridge.js` — GSD CLI bridge using `gsd-tools.cjs` (execFileSync, no shell)
- `src/components/BuildPanel.jsx` — full dashboard with project list, phase list, plan viewer, auto-refresh
- Server routes: state/roadmap/progress/phase-detail endpoints
- App.jsx: `buildProjects`, `activeBuildProject`, `showBuildWizard` state management

## Post-v1.0 Enhancements (completed 2026-03-14)

### Builder Mode Implementation
- Three builder modes added: Prompting, Skillz, Agentic
- Shared BaseBuilderPanel with config-driven lifecycle (input → loading → scored → revising)
- `/api/score` endpoint with Zod schema validation and SSE fallback
- Save/download with mode-aware filename and title extraction

### Builder Bug Fixes
- Fixed download filename using wrong field (added `nameField` config)
- Fixed save title always "Untitled" (extract from `formData.skillName|agentName|purpose`)
- Fixed auto-save creating duplicates (removed auto-save on score)
- Fixed score fallback stream (`Readable.fromWeb` approach)
- Fixed browser caching stale HTML (added `Cache-Control: no-cache` headers)
- Fixed mode tabs cut off on small screens (flex-wrap with responsive sizing)

### Scoring Prompt Engineering
- **Prompting**: Rewritten using TÂCHES meta-prompting methodology (clarity Golden Rule, specificity, structure, effectiveness)
- **Skillz**: Rewritten using Agent Skills Specification from agentskills.io (completeness, format compliance, instruction quality, reusability)
- **Agentic**: Rewritten using CrewAI role patterns + LangGraph state machine workflows (purpose clarity, tool design, workflow logic, safety guardrails)

### Revision Flow
- AI generates improved content in `<revised_prompt>` tags
- `applyRevision()` extracts and updates formData via `formDataRef` (synchronous) + `setFormData` (re-render)
- "Apply Revision & Re-Score" button for one-click improvement cycle
- Mode-aware revision prompts: TÂCHES for prompting, Agent Skills Spec for skillz, CrewAI+LangGraph for agentic
- Verified D→B grade improvement across all three modes

### Feature-Based License Gating (completed 2026-03-14)

- Extended tier-only license model to feature-based: `features` array in license state enables independent mode licensing
- `validateKey()` accepts both `{ tier: 'pro' }` (legacy) and `{ features: ['skillz','agentic'] }` (new) payloads
- `isFeatureAllowed()` uses `features !== undefined` semantics — empty `[]` denies all pro features, `undefined` falls through to legacy tier check
- `generate-license-key.js` supports `--features skillz,agentic` flag with validation against known feature names
- `isModeLocked(modeId, licenseInfo)` updated to check features array then tier fallback
- Mode-lock safety `useEffect` resets to chat when current mode becomes locked (deactivation, expiry)
- `loadConversation` guard prevents loading history conversations in locked modes
- SettingsPanel shows enabled features in license status display
- Trial-expired path explicitly clears stale features from config
- Only Skillz and Agentic are pro-gated; Prompting and Create remain free
- `_getProFeatures()` derives pro features dynamically from `FEATURE_TIERS` registry

### Theme Customization (completed 2026-03-14)

- 5 preset color themes: Indigo Night (default), Emerald Matrix, Sunset Blaze, Cherry Blossom, Arctic Blue
- Each theme defines primary/secondary/tertiary colors that cascade through CSS variables
- `Effects3DContext` extended with `THEME_PRESETS`, `applyThemeToDOM()`, and localStorage persistence (`th3rdai_theme`)
- `index.css` refactored: ~15 hardcoded `rgba(99,102,241,...)` replaced with `rgba(var(--color-neon-rgb), ...)` pattern
- Theme picker in SettingsPanel General tab: row of colored circles with active ring indicator
- 3D components updated: FloatingGeometry, TypingIndicator3D, TokenCounter, OrbitingBadge read theme from context
- Sidebar ParticleField and App.jsx ParticleBurst/Splite use `theme.primary`
- Status colors (green=online, red=offline) unchanged — semantic, not decorative
- All 27 UI tests pass, build clean

### Pro Upgrade Module (completed 2026-03-15)

**Session 1 — Backend License System:**
- `lib/license-manager.js` — declarative `FEATURE_TIERS` registry, Ed25519 offline key validation, 14-day trial, app store purchase support
- `lib/license-middleware.js` — `requireTier()` and `requireTierForMode` Express middleware
- `scripts/generate-license-key.js` — Ed25519 keypair generation and license key signing utility
- `server.js` — 4 license API routes, `requireTierForMode` on `/api/chat` and `/api/score`, `requireTier('mode:create')` on `/api/create-project`, `sanitizeConfigForClient` strips license key
- `.gitignore` — added `scripts/.license-private-key` and `scripts/.license-public-key`

**Session 2 — Frontend Integration:**
- `src/constants/tiers.js` — frontend `MODE_TIERS` registry mirroring backend
- `src/components/UpgradePrompt.jsx` — friendly upgrade modal with key activation, 14-day trial, purchase links
- `src/App.jsx` — `tier` property on all MODES, `licenseInfo` state, locked-mode UI with PRO badges, UpgradePrompt modal
- `src/components/SettingsPanel.jsx` — new License tab with tier display, key activation, trial start, deactivation
- `src/components/builders/BaseBuilderPanel.jsx` — 403 upgrade_required handling
- `src/components/CreateWizard.jsx` — friendly upgrade_required error message
- `electron/preload.js` — license IPC bridge methods (getLicenseInfo, activateLicense, purchasePro, restorePurchases)
- `electron/main.js` — license IPC handlers forwarding to server API
- `tests/ui/builder-prompting.spec.js` — license API mock for Pro tier in tests

**Design Decisions:**
- Ed25519 asymmetric keys — public key in app, private key stays on signing server, offline-verifiable
- Declarative FEATURE_TIERS — adding a premium feature = 1 line in backend + 1 line in frontend
- 14-day full-access trial — one-time, tracked by `trialStartedAt`, no data loss on expiry
- Middleware gating at route level keeps handlers clean
- License state persisted in existing `.cc-config.json` via `updateConfig()`

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 110 seconds
- Total execution time: 0.12 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 02 | 2 | 220s | 110s |

**Recent Trend:**
- Last 5 plans: 137s, 83s
- Trend: Improving (faster execution)

*Updated after each plan completion*

| Plan | Duration (s) | Tasks | Files |
|------|--------------|-------|-------|
| Phase 02 P01 | 137 | 2 tasks | 2 files |
| Phase 02 P02 | 83 | 2 tasks | 2 files |
| Phase 03 P01 | 172 | 3 tasks | 4 files |
| Phase 03 P02 | 439 | 4 tasks | 5 files |
| Phase 04 P01 | 141 | 2 tasks | 4 files |
| Phase 04 P02 | 217 | 2 tasks | 4 files |
| Phase 05 P01 | 121 | 2 tasks | 1 files |
| Phase 05 P02 | 136 | 3 tasks | 7 files |
| Phase 06 P01 | 344 | 2 tasks | 11 files |
| Phase 06 P03 | 209 | 2 tasks | 11 files |
| Phase 06 P02 | 389 | 2 tasks | 8 files |
| Phase 06 P04 | 132 | 2 tasks | 0 files |
| Phase 16 P00 | 44 | 1 tasks | 5 files |
| Phase 16 P01 | 141 | 2 tasks | 4 files |
| Phase 16 P03 | 147 | 2 tasks | 4 files |
| Phase 16 P02 | 159 | 2 tasks | 2 files |
| Phase 16 P04 | 116 | 2 tasks | 3 files |
| Phase 18 P01 | 208 | 2 tasks | 5 files |
| Phase 18 P02 | 237 | 1 tasks | 2 files |
| Phase 18 P03 | 535 | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Backend-first build order — structured output endpoint must be verifiable via curl before any UI work
- Roadmap: Tone unification is independent of review engine and can run in parallel
- Roadmap: Research recommends `format: { schema }` with full JSON Schema for Ollama constrained decoding (not `format: "json"`)
- [Phase 02]: Mode-specific personalities preserved (explain=patient teacher, bugs=protective friend, refactor=helpful coach)
- [Phase 02]: Refactor mode enhanced with 'Here's What to Tell Your AI' section for copy-pasteable prompts
- [Phase 02]: Translation mode labels use arrow style (Code → Plain English, Idea → Code Spec) for transformation clarity
- [Phase 02]: Placeholders reference 'AI coding tool' instead of 'dev team' to match vibe-coder audience
- [Phase 03]: LoadingAnimation uses Tailwind animate-bounce with staggered delays instead of custom animations
- [Phase 03]: Progressive disclosure defaults to minimal view (collapsed) with explicit toggle button
- [Phase 03]: Used Headless UI Tab component for accessible input methods instead of manual ARIA implementation
- [Phase 03]: Replaced emoji icons with Lucide React SVG icons per ui-ux-pro-max skill (Bug, Lock, BookOpen, CheckCircle)
- [Phase 03]: Added explicit category-level Learn More buttons for deep-dive entry points
- [Phase 04]: Fallback fix prompts generated from finding title+explanation when LLM omits fixPrompt
- [Phase 04]: Bulk copy sorts prompts by severity (critical first) for prioritized AI fixing
- [Phase 04]: Replaced emoji Copy/Fix icons with Lucide Clipboard/ClipboardCopy per UI skill rules
- [Phase 04]: Empirical MODEL_TIERS object with strong/adequate/weak classifications for review quality warnings
- [Phase 04]: Deep-dive messages persisted incrementally after each assistant response to prevent data loss
- [Phase 05]: Preserved emoji step indicators for friendly tone while using Lucide icons for mode grid
- [Phase 05]: Added Ollama troubleshooting section with 3 common issues for non-technical users
- [Phase 05]: Replaced emoji icons (📖, 🛡️) with Lucide SVG icons (BookOpen, Shield) per ui-ux-pro-max skill
- [Phase 05]: All 70+ GLOSSARY definitions already vibe-coder-friendly with analogies — no definition changes needed
- [Phase 06]: Spawned Express via fork() not require() for IPC and lifecycle management
- [Phase 06]: Used OS user data directory by default with portable mode as future option
- [Phase 06]: Server crash dialog offers View Logs/Restart/Quit (not auto-restart)
- [Phase 06]: Graceful shutdown sends SIGTERM, waits 5s, then SIGKILL
- [Phase 06]: Used Lucide icons (Download, Upload, Settings) in SettingsPanel per ui-ux-pro-max skill
- [Phase 06]: All platforms include ZIP target for 4 distribution formats (DMG, AppImage, exe, zip)
- [Phase 06]: Pre-update backup via createBackup() for safety net before applying updates
- [Phase 06]: SVG source icons with Node.js sharp conversion for version-controllable branding
- [Phase 06]: Landing page with inline CSS and system fonts for zero build step GitHub Pages deployment
- [Phase 06]: Cross-platform IDE launcher with fallback pattern (Electron mode vs dev mode)
- [Phase 06]: Ollama setup wizard as overlay (not error state) with 5 states and friendly messaging
- [Phase 06]: Model pull streams NDJSON progress for real-time UI updates with percentage and download size
- [Phase 06]: Auto-approved checkpoint:human-verify per auto-mode protocol for integration verification
- [Phase 16]: Wave 0 test stubs use test.skip/it.skip so they pass without failing CI
- [Phase 16]: BuildSimpleView View Phases quick action toggles to advanced mode rather than separate navigation
- [Phase 16]: chatComplete 30s timeout and 2000-char state truncation for next-action endpoint
- [Phase 16]: Planning file pills as clickable row for quick access
- [Phase 16]: PlanningFileViewer renders inline (not modal) with atomic write saves
- [Phase 16]: Used chatComplete + word-split progressive delivery for research/plan SSE endpoints
- [Phase 16]: SSE-over-POST pattern with ReadableStream reader in React for POST-based SSE endpoints
- [Phase 16]: Context-aware GSD command list in ClaudeCodeHandoff derived from project phase/plan state
- [Phase 16]: Friendly network error messages with retry buttons and loading skeletons for null state
- [Phase 18]: Pentest getTimeoutForModel uses longer timeouts (90s-240s) than review due to 6-category output complexity
- [Phase 18]: CVSS bands use descriptive strings not numeric scores for vibe-coder accessibility
- [Phase 18]: Pentest system prompt kept under 2000 tokens with compact embedded OWASP reference tables
- [Phase 18]: Agent Skills Spec format with progressive-disclosure OWASP reference tables for pentest skill file
- [Phase 18]: Used emoji icon for Security mode tab to match existing MODES pattern
- [Phase 18]: SecurityPanel/SecurityReport follow exact ReviewPanel/ReportCard architecture for consistency

### Phase 15: Build Mode (GSD + ICM) — Approved and Implemented

- **Approved plan:** `.planning/phases/build-mode-gsd-icm/DRAFT-PLAN.md` (revised for gaps, edge cases, implementation risks; approved 2026-03-14)
- **Implementation:** lib/build-scaffolder.js, POST /api/build-project, BuildWizard.jsx, App.jsx (Build in MODES, handleBuildSuccess), tiers.js and license-manager.js (mode:build free)
- **Scope:** Scaffold combines GSD (.planning/) and ICM (stages/); temp-dir strategy; path safety and error codes; Build reuses createModeAllowedRoots

### Mermaid.js Diagram Rendering (completed 2026-03-15)

- **MermaidBlock.jsx**: New component — lazy-loads mermaid.js, renders SVG with dark theme (indigo colors), error fallback with raw code, export toolbar (Source/SVG/PNG)
- **MarkdownContent.jsx**: Custom `marked` renderer intercepts ` ```mermaid ` blocks, emits `<div data-mermaid-source>` sentinels (survive DOMPurify), split-and-render pattern produces mixed HTML + MermaidBlock React children. Fast path (no mermaid) unchanged.
- **Streaming safety**: `streaming` prop threaded from App.jsx → MessageBubble → MarkdownContent. During streaming, mermaid renders as regular code. After completion, renders as diagram.
- **Diagram mode**: New mode with system prompt tuned for flowcharts, sequence, ER, class, state, Gantt, pie, mindmap diagrams. Works across all modes (any response with mermaid blocks renders diagrams).
- **Vite chunking**: mermaid in separate chunk (~532KB), not loaded until first diagram encounter. Main bundle decreased.
- **Files**: MermaidBlock.jsx (new), MarkdownContent.jsx, MessageBubble.jsx, App.jsx, lib/prompts.js, index.css, vite.config.js

### File Loading for Builder Forms (completed 2026-03-15)

- **File Browser → Builder routing:** Files selected in File Browser now route to builder panels (Prompting, Skillz, Agentic) via `builderAttachRef` pattern (same as existing `reviewAttachRef`)
- **Load from File button:** Native file picker button in BaseBuilderPanel header (input phase) — accepts .md, .txt, .yaml, .yml
- **parseLoaded enhancement:** SkillzPanel and AgenticPanel `parseLoaded()` now handle YAML frontmatter (`---` delimiters), extract description from frontmatter, and fall back to treating entire body as instructions when no `## Instructions` section exists
- **Contextual button labels:** FileBrowser "Attach to Chat" button changes to "Load into Form" in builder modes and "Load for Review" in review mode
- **Files changed:** App.jsx, FileBrowser.jsx, BaseBuilderPanel.jsx, SkillzPanel.jsx, AgenticPanel.jsx

### Pending Todos

- **Phase 16 Phase 2:** Simple View — BuildHeader (status badge, progress bar, advanced toggle), BuildSimpleView ("What's Next" AI card, quick action buttons), POST /api/build/projects/:id/next-action endpoint with chatComplete
- **Phase 16 Phase 3:** AI Research/Planning — POST /api/build/projects/:id/research (SSE, chatStructured), POST /api/build/projects/:id/plan (SSE, chatStructured), write-after-validate to ROADMAP.md, small model fallback
- **Phase 16 Phase 4:** Advanced View — BuildAdvancedView (phase accordion, PlanningFileViewer), GET/PUT /api/build/projects/:id/files/:filename with whitelist security, localStorage toggle persistence
- **Phase 16 Phase 5:** Handoff + Polish — ClaudeCodeHandoff (copy-pasteable commands), import existing project UI polish, refresh-from-disk button, error states

### Future Backlog (lowest priority)

- **Mac App Store receipt validation** — Electron `inAppPurchase` API integration for native purchases
- **Microsoft Store** — Windows app store purchase flow
- **Purchase page** — th3rdai.com/pro landing page for direct license key sales

### Blockers/Concerns

- Ollama version at HOST_IP:11424 must be 0.5.0+ for JSON Schema `format` support — verify in Phase 1
- zod-to-json-schema Zod v4 compatibility unconfirmed — verify at install time
- Small model (<7B) structured output quality is LOW confidence — needs empirical testing in Phase 4

### Completed This Session

- [x] **Deploy & installers (2026-03-17):** `deploy.sh` for one-command install+run; `electron:build*` scripts use `--publish never`; NSIS uses `resources/icon.ico`; `.cc-config.json` and `CodeCompanion-Data` excluded from package (PAT never shipped); macOS/Windows/Linux builds produce DMG, NSIS EXE, AppImage + ZIPs.
- [x] **Remote access & HTTPS:** Server binds `0.0.0.0`, optional HTTPS via `cert/server.crt` + `cert/server.key`, `cert/README.txt` in package, `startup.sh` health check uses HTTPS when certs present; HSTS only cleared when not using HTTPS.
- [x] Fixed `isWithinBasePath` bug (imported but undefined in file-browser.js)
- [x] Exported `getAppRoot()` from config.js
- [x] Auto-register projects in build-registry after scaffold (Plan Risk #5)
- [x] Added `POST /api/build/projects` import route with auto-scaffold of `.planning/`
- [x] Added `scaffoldPlanning()` for importing projects without `.planning/`
- [x] Added rate limiting for `/api/build/*` routes (Plan Risk #8)
- [x] Multi-tool convention files: CLAUDE.md, .cursorrules, .windsurfrules, .opencode/instructions.md
- [x] Committed and pushed to GitHub (afe87c2)
- [x] Multi-select chat history: toggle select mode, checkboxes, select all, bulk export (MD/TXT), bulk archive/unarchive, bulk delete
- [x] **Settings: Configurable review timeout (2026-03-17):** Added `reviewTimeoutSec` config (default 300s), slider in Settings General tab (60s–600s), wired through `server.js` → `review.js`. Fixed TokenCounter crash: `parsed.total_duration` now guarded with `Number()` + `Number.isFinite()` before `.toFixed()` in App.jsx

## Session Continuity

Last session: 2026-03-19
Stopped at: Completed Phases 19-24 (retroactive documentation)
Resume file: None
Next: Phases 8-14 (license distribution) deferred — project uses Th3rdAI personal/non-commercial LICENSE; commercial use requires agreement. All planned features complete. Ready for v5.0 milestone or new feature work.
