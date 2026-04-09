<original_task>
Scope and discuss Phase 28 — Multi-File Code Review — then get it ready for planning.
</original_task>

<work_completed>

**Phase 27 — deferred (2026-04-09)**
- Decided Phase 27 (Agent GSD bridge builtins) is low value — Build mode already surfaces GSD data, tiny audience
- Marked deferred in ROADMAP.md with explanation; Phase 27 task in Archon closed

**Phase 28 added and discussed (2026-04-09)**
- Added Phase 28 (Multi-File Code Review) to ROADMAP.md — phases list + Phase Details section + progress table
- Ran `/gsd:discuss-phase 28` — all four gray areas covered:
  - Report card format → unified (one card, filenames in findings)
  - Input methods → two tabs: Single File | Scan Folder, mirrors SecurityPanel
  - File limits → 80 files / 2 MB, preview step, warn if >20 files
  - Post-review actions → same as single-file
- CONTEXT.md written: `.planning/phases/28-multi-file-code-review/28-CONTEXT.md`
- `plan-reviewer` run — 1 critical, 2 major, 2 minor issues identified (see below)
- Archon project description updated (was stale at v1.6.3); Phase 28 task + spec doc created
- Committed: `b0b0a17` — docs(28): add Phase 28 multi-file review to roadmap + capture context

**Plan-review issues (must address in PLAN.md):**
1. **CRITICAL** — Path traversal: `/api/review/folder` must validate `folder` against `config.projectFolder` via `isWithinBasePath` (from `lib/file-browser.js`). Same gap exists in `/api/pentest/folder` — fix both.
2. **MAJOR** — Drag-drop vs folder path are two distinct code paths in the Scan Folder tab:
   - Drag-drop files (browser File System API) → concatenated client-side → `/api/review` (existing endpoint)
   - Folder path input → `/api/review/folder` (new endpoint, server-side)
3. **MAJOR** — New `SYSTEM_PROMPTS["review-multi"]` needed in `lib/prompts.js`. Existing `"review"` prompt doesn't instruct the model to reference filenames in findings.
4. **MINOR** — Timeout scaling in `reviewFiles()`: `Math.min(baseTimeout * Math.ceil(files.length / 5), 600000)` — same as `pentestFolder`.
5. **MINOR** — Pass `autoAdjustContext: config.autoAdjustContext` through to `reviewFiles()`.

</work_completed>

<work_remaining>

**Ready to plan — run `/gsd:plan-phase 28` in a fresh context.**

The CONTEXT.md is complete and plan-review issues are documented above. All issues should be addressed as explicit tasks in the PLAN.md rather than requiring another discuss-phase cycle.

</work_remaining>

<context>
**Current version:** v1.6.5 (2026-04-09)
**Branch:** master, clean working tree
**GitNexus:** indexed at b0b0a17

**Phase 28 implementation map (verified against codebase):**
- `lib/review.js` → add `reviewFiles(ollamaUrl, model, files, opts)` — mirror `pentestFolder()` in `lib/pentest.js` (lines 80–138); uses `reportCardJsonSchema` + `SYSTEM_PROMPTS["review-multi"]`; export alongside `reviewCode`
- `routes/review.js` → add `POST /api/review/folder/preview` and `POST /api/review/folder` — clone `routes/pentest.js` lines 364–470
- `lib/prompts.js` → add `"review-multi"` key — multi-file variant of `"review"` prompt; instructs model to reference filenames in findings
- `src/components/ReviewPanel.jsx` → tab switcher (Single File | Scan Folder); Scan Folder mines `SecurityPanel.jsx` for folder path state, drag-drop, preview, abort patterns
- `lib/file-browser.js:271` → `readFolderFiles(folder, opts)` — already exported; import in `routes/review.js`

**Rate limiter:** `/api/review/folder` is automatically covered by existing `app.use('/api/review', ...)` in `server.js` — no action needed.

**Key architectural patterns (carry forward):**
- Router factory: `module.exports = function createRouter(appContext) { return express.Router(); }`
- appContext shape: `{ config, requireLocalOrApiKey, log, debug, dataRoot, logDir, toolCallHandler }`
- Rate limiters stay as `app.use()` in server.js — never moved into routers
- `sendSpaIndexHtml` always sets `Cache-Control: no-cache`
- SPA fallback returns 404 for extension paths via `isLikelyAssetRequest()`
- Root layout MUST use `fixed inset-0` — never h-screen/h-dvh
- Docling default port 5002, NOT 5001 (macOS AirPlay conflict)
- Agent terminal default OFF, empty allowlist = deny all
- Cloud models wrap JSON in `json` fences — `lib/ollama-client.js` strips them
- Memory retrieval requires `conversationId` on `POST /api/chat`
- Tool parallel execution default OFF — `toolExec.parallel: false` in config
- `ollamaAuthOpts(config)` + `effectiveOllamaApiKey(config)` for auth
- `resolveAutoModel({ requestedModel, mode, estimatedTokens, config, ollamaUrl })` for auto model
- `config.reviewTimeoutSec` → passed as `timeoutSec` (not `timeoutMs`) to review functions

**Packaging rule (critical — caused v1.6.x crash):**
When adding a new top-level runtime directory, add `"newdir/**/*"` to `files` in `electron-builder.config.js`. Run `node scripts/smoke-test-server.js` to verify before tagging.

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
- GitHub Secrets set on Th3rdai/CodeCompanion

**Google Drive Release Path:**
`~/Library/CloudStorage/GoogleDrive-admin@th3rdai.com/My Drive/_TH3RDAI.INC/CodeCompanion/{Mac,Windows,Linux}`
Keep only last 2 versions in archive folders. Currently: v1.6.4 in archive, v1.6.5 live.

**Archon task ID:** `4cbf91f6-6da7-4697-b0f4-e8a4812fe30f` (Phase 28, status: todo)
**Archon project ID:** `2da275aa-5c61-41a4-ac6d-b9aeebcbe843`
**GitNexus index:** current (indexed at b0b0a17)
</context>
