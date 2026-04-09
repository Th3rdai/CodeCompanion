<original_task>
v1.6.5 hotfix release — diagnose and fix startup crash affecting all v1.6.x packaged installs.
</original_task>

<work_completed>

**Root cause identified and fixed (2026-04-09)**

The Phase 24.5 server.js refactor (v1.6.0, 2026-04-08) extracted 16 Express route modules into a new `routes/` directory. `electron-builder.config.js` uses explicit glob patterns — `routes/` was never added, so every packaged install from v1.6.0–v1.6.4 crashed at startup with `code=1, signal=null` when `server.js` tried to `require('./routes/...')`. v1.5.27 (last working version) predated the refactor entirely.

**Commits this session:**

- `f9b53e4` — fix(electron): bundle routes/ directory in packaged app (v1.6.5)
- `ac79bd1` — ci: add server startup smoke test before installer builds
- `1bcf57d` — docs: document electron-builder packaging rule to prevent regression
- `58eee73` — chore: journal entry and doc updates for 2026-04-09

**v1.6.5 released:**

- All 4 platform installers published to GitHub Releases (Th3rdai/CodeCompanion)
- Google Drive synced: Mac/Win/Linux folders updated to v1.6.5, v1.6.4 archived, v1.5.15 pruned

**CI smoke test added (`scripts/smoke-test-server.js`):**

- Spawns `node server.js` on port 19876, polls HTTP + HTTPS (self-signed cert allowed)
- Exits 0 if server responds within 20s, 1 if crash or timeout
- Runs as `smoke-test` job in `.github/workflows/build.yml` — all 4 build jobs have `needs: smoke-test`
- Catches missing runtime directories before any installer is uploaded

**Packaging rule documented in 3 places:**

- `BUILD.md` — "Adding a new runtime directory?" section with explicit warning + example
- `docs/RELEASES-AND-UPDATES.md` — step 2 added to pre-release checklist
- `CLAUDE.md` — "Packaging Rule" section so AI agents get it as standing guidance

**Archon tasks completed in this hotfix cycle:**

- fix(electron): bundle routes/ in packaged app — v1.6.5
- ci: server startup smoke test before installer builds
- docs: document electron-builder packaging rule (prevent v1.6.x regression)
- Follow-on situational-awareness items were seeded on 2026-04-09 in Archon notes.

</work_completed>

<work_remaining>

No open tasks for the v1.6.5 hotfix cycle. Broader Archon backlog still contains unrelated TODO items.

**Next planned work (when ready):**

- **Phase 27** — GSD builtins from chat (see `docs/AGENT-APP-CAPABILITIES-ROADMAP.md`)
- Or any new feature work from the backlog

</work_remaining>

<context>
**Current version:** 1.6.5 (2026-04-09)
**Working tree (at hotfix closure):** clean
**Branch (at hotfix closure):** master, up to date with origin

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
Keep only last 2 versions in archive folders. Currently: v1.6.0 + v1.6.4 in archive, v1.6.5 live.

**GitNexus index:** 3,128 nodes | 5,602 edges | 182 flows (indexed 2026-04-09)
</context>
