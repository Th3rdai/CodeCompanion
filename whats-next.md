<original_task>
Multiple features requested across this session:
1. Add document reading (PDF, PPTX, DOCX, XLSX) via docling-serve integration
2. Add agent terminal — AI can run approved terminal commands in the project folder
3. Fix full-viewport layout on high-res displays
4. Remove document conversion truncation
5. Add plan-reviewer skill
6. Verify gitnexus is working and re-index
</original_task>

<work_completed>
ALL ORIGINAL TASKS COMPLETE. Summary of everything shipped:

**1. Docling Document Reading (PDF, PPTX, DOCX, XLSX)**
- `lib/docling-client.js` (NEW) — REST API wrapper for docling-serve
- `lib/config.js` — `docling` nested config (url, apiKey, ocr, enabled, maxFileSizeMB)
- `lib/file-browser.js` — DOCUMENT_EXTENSIONS, isConvertibleDocument(), documents in file tree
- `server.js` — POST /api/convert-document (50MB limit), GET /api/docling/health, GET /api/files/read-raw
- `src/lib/document-processor.js` (NEW) — client-side conversion helpers
- `src/components/SettingsPanel.jsx` — Docling section (URL, test connection, API key, OCR)
- `src/App.jsx` — document conversion in upload/drop flows + loading indicator
- `src/components/ReviewPanel.jsx` — document upload support
- `src/components/SecurityPanel.jsx` — document upload support
- `src/components/FileBrowser.jsx` — document icon, convert-on-click, quick attach
- E2E tested: PDF (211KB → 8KB markdown in 2.6s) + DOCX conversion confirmed
- Commits: 366f760, c7ab87e (truncation removal)

**2. Agent Terminal — Builtin Tool Execution**
- `lib/builtin-agent-tools.js` (NEW) — tool registry + run_terminal_cmd with 8-layer security
- `lib/tool-call-handler.js` — constructor accepts getConfig, buildToolsPrompt merges builtins, executeTool routes builtin.*
- `lib/mcp-api-routes.js` + `lib/mcp-client-manager.js` — 'builtin' reserved as MCP client ID
- `server.js` — hasAgentTools gate (tool loop works without MCP servers), POST config, clientKey for rate limiting
- `lib/config.js` — agentTerminal defaults (enabled: false, allowlist, blocklist, timeouts)
- `src/components/SettingsPanel.jsx` — Agent Terminal section (toggle, allowlist editor, timeout slider)
- `src/App.jsx` — terminal output indicator in chat during tool execution
- Security: master switch (off), allowlist, blocklist, metachar rejection, cwd lock, env whitelist, rate limit (20/min/IP), remote guard (CC_ALLOW_AGENT_TERMINAL=1)
- 19/19 security unit tests pass
- Commits: 0052603, 243d9a8

**3. Full-Viewport Layout Fix**
- `src/App.jsx` — root container changed to `fixed inset-0` (not h-screen/h-dvh)
- `src/index.css` — html/body/#root: width/height 100%, margin/padding 0, overflow hidden
- CLAUDE.md — Design & Layout Standards section added
- Memory saved: feedback_fullscreen_layout.md
- Commit: 39047c2

**4. Document Truncation Removal**
- `server.js` — removed 100KB MAX_OUTPUT truncation on convert endpoint
- App.jsx, ReviewPanel, SecurityPanel — removed truncation warning alerts
- Commit: c7ab87e

**5. Plan-Reviewer Skill**
- `.claude/skills/plan-reviewer/SKILL.md` — 5-phase workflow for validating implementation plans
- Used successfully on CLIPLAN.md — found 10 issues, all addressed

**6. GitNexus Re-indexed**
- Re-indexed at 243d9a8: 1035 nodes, 2288 edges, 845 embeddings
- AGENTS.md + CLAUDE.md stats updated
- CLI queries and context lookups confirmed working

**7. Planner Builder Mode (added by linter, committed)**
- `src/components/builders/PlannerPanel.jsx` (NEW)
- `lib/builder-schemas.js` — PlannerScoreSchema
- `lib/prompts.js` — Planner system prompts
- Commit: 896d4a3

**Archon Tasks Updated:**
- Docling integration (740227e0) → done
- Agent Terminal (ae9cf717) → done
</work_completed>

<work_remaining>
All original tasks are complete. Remaining backlog items (Phase 3 hardening from CLIPLAN):

- [ ] Agent terminal audit logging to file (currently logs to console only)
- [ ] Playwright E2E smoke test for agent terminal
- [ ] Phase 4 confirm-before-run modal (optional)
- [ ] APPSETUPNOTES.md entry for agent terminal setup
</work_remaining>

<context>
**Port Assignments (no conflicts):**
| Service | Port |
|---------|------|
| App (HTTPS) | 8900 |
| HTTP→HTTPS redirect | 8901 |
| Vite dev server | 8902 |
| Playwright E2E | 4173 |
| Docling-serve | 5002 |
| Ollama | 11434 |

**Critical Design Decisions:**
- Root layout MUST use `fixed inset-0` — never h-screen/h-dvh (memory: feedback_fullscreen_layout.md)
- Docling default port 5002, NOT 5001 (macOS AirPlay conflict)
- Agent terminal default OFF, empty allowlist = deny all
- `shell: true` required for npm/yarn (spawn, not exec), with allowlist+blocklist security
- spawn does NOT accept `timeout` option — use manual setTimeout + process group kill
- Rate limit is intra-SSE (per-IP Map), not HTTP middleware
- Remote deployment requires CC_ALLOW_AGENT_TERMINAL=1 env var
- Tool loop now runs with builtin tools only (no MCP required): hasAgentTools gate
- Builtin tools return MCP-compatible shape: {content: [{type:'text', text:'...'}]}

**Key Files:**
- `.planning/DOCLING_INTEGRATION_PLAN.md` — docling architecture
- `CLIPLAN.md` — agent terminal plan (local only, .gitignored)
- `lib/builtin-agent-tools.js` — terminal execution engine
- `lib/docling-client.js` — document conversion client
- `design-system/DESIGN-STANDARDS.md` — UI layout standards
</context>
