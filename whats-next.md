<original_task>
Ship v1.6.0 of Code Companion. The session covered:
1. Phase 24.5 Tech Health (ESLint baseline, App.jsx hook extraction, server.js decomposition)
2. Diagnosing and fixing a blank-page bug caused by missing lib extractions and stale-asset caching
3. Committing all in-progress work cleanly
4. Executing the v1.6.0 release checklist
</original_task>

<work_completed>

**Phase 24.5-01 — ESLint baseline + test consolidation (786e8e7)**
- ESLint config (`eslint.config.mjs`) established: 0 errors, 148 warnings (acceptable)
- `tests/test/unit/icm-scaffolder.test.js` migrated to `tests/unit/` (depth fixed: `../../lib/...`)
- `tests/test/` directory removed
- `lib/history.js` — atomic write via tmp+rename pattern

**Phase 24.5-02 — App.jsx hook extraction (999771e)**
- `src/hooks/useModels.js` (new, 73 lines) — models, connection, selectedModel, isVisionModel, refreshModels
- `src/hooks/useChat.js` (new, 723 lines) — all chat/history state and handlers
- `src/hooks/useImageAttachments.js` (new, 341 lines) — image/doc attach pipeline, lightbox
- `src/App.jsx` — 2,954 → 1,873 lines (target was <2000) ✓

**Phase 24.5-03 — server.js decomposition (dfc5e26, 23d0b31, 95dd1f5, 875969e)**
- 15 route modules under `routes/`: chat, config, convert, files, git, github, history, launch, memory, office, pentest, projects, review, score, validate, build
- `lib/rate-limiter.js` — createRateLimiter factory + getClientAddress helper
- `lib/rate-limiters-config.js` — registerRateLimiters(app) centralizing 15 rate-limiter wirings
- `lib/mcp-http.js` — mountMcpHttp(app, deps) with factory-per-request McpServer
- `server.js` — 5,169 → 507 lines (target was <800) ✓
- Fix: `routes/convert.js` was created but never mounted; inline duplicate removed (95dd1f5)
- Fix: lib extractions were missing from initial commit; added separately (875969e)

**Stale-asset hardening (e7960c3)**
- `sendSpaIndexHtml` — adds `Cache-Control: no-cache, no-store, must-revalidate`
- `isLikelyAssetRequest()` — SPA fallback returns 404 (not index.html) for `/assets/*` or extension paths
- `GET /api/debug/static-asset` — gated diagnostics endpoint to verify asset existence

**Draggable modals (7433b91)**
- `src/components/ImagePrivacyWarning.jsx`, `JargonGlossary.jsx`, `OllamaSetup.jsx`, `RenameModal.jsx`
- All four modals support pointer-drag repositioning, viewport-clamped

**Electron: mac codesign helper (c0381d4)**
- `lib/mac-codesign-identity.js` — normalizeMacCodesignIdentity() strips "Developer ID Application:" prefix
- `tests/unit/mac-codesign-identity.test.js` — 3 test cases

**Verified state (2026-04-08):**
- App loads at https://localhost:8900 ✓
- 163 unit tests pass (includes new mac-codesign-identity tests) ✓
- All API routes return 200 ✓
- Working tree clean ✓
- GitNexus re-indexed: 3,059 nodes, 5,454 edges, 178 flows ✓
- Archon: Phase 24.5-02 and 24.5-03 marked done ✓

**Commits in this session (newest first):**
- `27998d2` — chore: update GitNexus index stats in docs
- `c0381d4` — feat(electron): mac codesign identity normalizer + unit test
- `7433b91` — feat(ui): draggable modals
- `e7960c3` — fix(server): harden stale-asset handling and add diagnostics endpoint
- `875969e` — feat(24.5-03): add lib extractions missing from server.js decomposition
- `95dd1f5` — fix(server): mount routes/convert.js and remove orphaned inline handler
- `999771e` — tech(24.5-02): extract useModels, useChat, useImageAttachments from App.jsx
- `23d0b31` — refactor(24.5-03): slim server.js to bootstrap-only
- `dfc5e26` — feat(24.5-03): extract 15 route modules from server.js into routes/
- `786e8e7` — tech(24.5-01): lint baseline, test consolidation, atomic history write

</work_completed>

<work_remaining>

**The original task — v1.6.0 release — is NOT YET COMPLETE. Release checklist (Archon task `69f72625`):**

1. [ ] **Version bump** — update `package.json` version to `1.6.0`; move CHANGELOG `[Unreleased]` → `[1.6.0]`; commit
2. [ ] **QA smoke** — `npm run test:unit` (163 tests); `npm run build`; quick UI check (chat, review, terminal, settings)
3. [ ] **Tag** — `git tag v1.6.0`; push tag to trigger CI
4. [ ] **Build artifacts** — signed + notarized macOS via CI (APPLE_* secrets already set); Win/Linux artifacts
5. [ ] **GitHub Release** — CI green; release page has platform binaries + `latest-*.yml` updater metadata
6. [ ] **Feed check** — verify `latest-mac.yml` has correct version + artifact URLs
7. [ ] **Google Drive** — upload to `~/Library/CloudStorage/GoogleDrive-admin@th3rdai.com/My Drive/_TH3RDAI.INC/CodeCompanion/{Mac,Windows,Linux}`; keep only last 2 versions in archive

**After release — Phase 25 CLIPLAN backlog (Archon tasks exist):**
- `fa907a58` — Streaming terminal SSE
- `6d12ffe8` — Confirm-before-run modal
- `f736b74f` — Agent terminal audit logging + Playwright E2E
- `90abbcca` — MCP server parallel task execution
- `955424a4` — Dependabot/npm audit triage (8 vulns on origin, 6 on th3rdai)

</work_remaining>

<context>
**Current version in package.json:** check before bumping — last release was v1.5.26 (terminal PTY feature)

**What's in v1.6.0:**
- Phase 24.5 Tech Health: App.jsx hooks (3 new hooks, App down to 1873 lines), server.js route decomposition (15 modules, server down to 507 lines), ESLint baseline
- Stale-asset hardening (Cache-Control + 404 guard)
- Draggable modals (4 components)
- Mac codesign identity normalizer
- Fix: routes/convert.js was mounted but orphaned handler left in server.js (now removed)

**Key architectural patterns established in this session:**
- Router factory: `module.exports = function createRouter(appContext) { return express.Router(); }`
- appContext shape: `{ config, requireLocalOrApiKey, log, debug, dataRoot, logDir, toolCallHandler }`
- Rate limiters stay as `app.use()` in server.js — never moved into routers
- `sendSpaIndexHtml` always sets `Cache-Control: no-cache`
- SPA fallback returns 404 for extension paths (not index.html) via `isLikelyAssetRequest()`

**Browser access note:** Use `https://localhost:8900`, NOT the LAN IP (`192.168.50.7:8900`). The self-signed cert is issued for `localhost` only; Chrome will block subresource (JS/CSS) loads from the LAN IP.

**Port assignments:**
| Service | Port |
|---------|------|
| App (HTTPS) | 8900 |
| HTTP→HTTPS redirect | 8901 |
| Vite dev server | 8902 |
| Playwright E2E | 4173 |
| Docling-serve | 5002 |
| Ollama | 11434 |

**Apple Signing:**
- Certificate: Developer ID Application: JAIME AVILA (9LRPX62LGN)
- Apple ID: jm.avila@comcast.net (NOT james@th3rdai.com)
- Team ID: 9LRPX62LGN
- GitHub Secrets set on both repos

**Google Drive Release Path:**
`~/Library/CloudStorage/GoogleDrive-admin@th3rdai.com/My Drive/_TH3RDAI.INC/CodeCompanion/{Mac,Windows,Linux}`
Keep only last 2 versions in archive folders.

**Archon release task ID:** `69f72625-3266-4a81-b7b7-7d98d0cb8e81` (project: CodeCompanion, status: doing)

**Critical Design Decisions (carry forward from prior sessions):**
- Root layout MUST use `fixed inset-0` — never h-screen/h-dvh
- Docling default port 5002, NOT 5001 (macOS AirPlay conflict)
- Agent terminal default OFF, empty allowlist = deny all
- Cloud models wrap JSON in `json` fences — `lib/ollama-client.js:225` strips them
- Memory retrieval requires `conversationId` on `POST /api/chat`; only memories with `source` matching that id are injected
- Agent terminal: builtin `run_terminal_cmd` must be advertised for terminal preamble + AGENT TERMINAL line
</context>
