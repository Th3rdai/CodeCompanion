<original_task>
Post-v1.6.5 session — tech health cleanup, agent capability settings, and MCP parallel plan compliance.
</original_task>

<work_completed>

**Phase 24.5 Tech Health — retroactive summary (2026-04-09)**

All three plans confirmed complete. Added missing `24.5-01-SUMMARY.md`. ROADMAP updated.

**Phases 25 & 26 — Agent Validate + Planner tools (2026-04-09)**

Tools (`validate_scan_project`, `validate_generate_command`, `score_plan`) were already fully implemented in `lib/builtin-agent-tools.js` with 22 passing unit tests. Added missing Settings UI toggles in `src/components/SettingsPanel.jsx`:
- Agent Validate Tools toggle (default on)
- Agent Planner Scoring toggle (default on)
Both persist to `.cc-config.json` via `POST /api/config`. Phases 25 & 26 marked complete in ROADMAP and `docs/AGENT-APP-CAPABILITIES-ROADMAP.md`.

**MCP Parallel Plan compliance (2026-04-09) — commit `84444f6`**

Three gaps closed against `.planning/MCPParallelPLAN.md`:
1. `toolExec.{parallel,maxConcurrent}` added to `lib/config.js` defaults (`parallel=false`, `maxConcurrent=4`) with deep-merge on load
2. `routes/chat.js` now checks `toolExec.parallel` flag — when false (default), all tools run serially; preserves existing behavior for all current users
3. Unbounded `Promise.all` replaced with worker-pool capped to `maxConcurrent`
4. `write_file` added to explicit `RISKY_BUILTINS` set in `lib/tool-call-handler.js`

All tests pass: 19/19 unit, 3/3 integration.

**Commits this session:**
- `4dc07b1` — feat(settings): add agent validate and planner tool toggles
- `84444f6` — feat(tool-exec): complete MCP parallel plan spec compliance

</work_completed>

<work_remaining>

**Phase 27 — Agent GSD bridge builtins (optional)**
- No plans yet — needs `/gsd:discuss-phase 27` or `/gsd:plan-phase 27`
- Thin allowlisted wrappers around `lib/gsd-bridge.js` for read-only GSD queries from chat
- Default off, Settings gate required
- See `docs/AGENT-APP-CAPABILITIES-ROADMAP.md` (AAP-11–AAP-14)

**MCP Parallel — to enable for users**
- Set `toolExec.parallel: true` in `.cc-config.json` (or add Settings toggle when ready)
- Currently default off — no behavior change for existing users

</work_remaining>

<context>
**Current version:** 1.6.5 (2026-04-09)
**Working tree:** clean
**Branch:** master, up to date with origin

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

**GitNexus index:** current (indexed after commit 84444f6)
</context>
