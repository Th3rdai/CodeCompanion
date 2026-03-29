<original_task>
Extended session covering multiple feature areas for Code Companion — Vibe Coder Edition:
1. Multi-PAT GitHub support with active account switching
2. InputToolbar (Paste, Copy, Markdown, Export, Clear, Dictate) across all modes
3. Inline review chat with "Ask AI to Fix" and write_file tool
4. Review Revision auto-reload workflow
5. Builder modes (Prompting, Skillz, Agentic, Planner) parity with Review
6. Cloud model structured JSON fix (markdown fence stripping)
7. Scoring prompts: no positive observations as findings/suggestions
8. File Browser: collapsed by default, .Trash exclusion from folder search
9. Apple Developer ID signing + notarization
10. Auto-model selection per mode (implemented 2026-03-28)
</original_task>

<work_completed>
ALL tasks 1-9 are complete and committed. Key commits:

**Multi-PAT GitHub (8d15b8a)**
- `lib/github.js` — `resolveToken()`, `getAllTokens()`, dedup by label
- `server.js` — multi-token endpoints, active account switcher, all operations resolve by active account
- `src/components/GitHubPanel.jsx` — header dropdown, account selector
- `src/components/SettingsPanel.jsx` — add/remove multiple PATs with labels/avatars

**InputToolbar + Inline Review Chat (244e275, c666c97)**
- `src/components/ui/InputToolbar.jsx` (NEW) — reusable toolbar component
- `src/components/ReviewPanel.jsx` — inline chat on report card, deep-dive, fallback phases
- `src/components/ReportCard.jsx` — "Ask AI to Fix", "Review Revision" buttons
- `src/components/builders/BaseBuilderPanel.jsx` — toolbar + inline chat on scored/revising phases

**write_file Tool + System Prompt Fixes (c666c97)**
- `lib/builtin-agent-tools.js` — `write_file` tool with auto-backup, path validation
- `server.js` — skip default system prompt when client sends its own (fixes duplicate system messages)
- ReviewPanel system prompt: includes full code, mandatory write_file call, no "can't access files"
- BaseBuilderPanel revise prompt: tells AI it has file/terminal access

**Cloud Model JSON Fix (9c4b880)**
- `lib/ollama-client.js` line 225 — strip ```json``` fences before JSON.parse
- Fixes kimi-k2:1t-cloud, minimax-m2:cloud, glm-4.6:cloud structured reviews

**Scoring Prompts (244e275)**
- `lib/prompts.js` — all 6 modes (review, bugs, prompting, skillz, agentic, planner)
- findings/suggestions = problems only; positive observations in summary field

**File Browser (244e275, 9c4b880)**
- `src/components/FileBrowser.jsx` — all directories collapsed by default
- `server.js` — FOLDER_SEARCH_SKIP excludes .Trash, Library, node_modules; added ~/Docker to search roots

**Apple Signing + Notarization (earlier commits)**
- `electron-builder.config.js` — Developer ID Application: JAIME AVILA (9LRPX62LGN)
- Notarization via APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD
- GitHub Secrets set on both repos for CI

**Other**
- `src/lib/clipboard.js` — improved fallback for self-signed HTTPS
- `.cc-config.json` — agent terminal allowlist (58+ commands including vi, vim, tee, sed, cp)
- PM tools (Jira/Trello/Asana) — clear buttons added
- `MODELS.sh` (AgentZ) — auto-target A0_volume for container settings

**Task 10 — Auto-model per mode (2026-03-28)**  
- `lib/auto-model.js` — defaults, `mergeAutoModelMap`, `resolveAutoModel` (token + cloud/local heuristics; vision preference when images attached on chat).  
- `lib/config.js` — `autoModelMap` in `.cc-config.json`.  
- `server.js` — resolve `model === 'auto'` on chat, review, pentest (+remediate/folder), score, validate generate, build next-action/research/plan, tutorial-suggestions, git review, history memory extraction; SSE `resolvedModel` / JSON `resolvedModel` where applicable.  
- `src/App.jsx` — toolbar **Auto (best per mode)**; `localStorage` `cc-selected-model`; hint `→ <model>` after first streamed meta.  
- `src/components/SettingsPanel.jsx` — collapsible **Auto model map** + reset.  
- `src/lib/auto-model-modes.js` — mode labels for Settings (keep aligned with `lib/auto-model.js`).  
- Tests: `tests/unit/auto-model.test.js`. Docs: **CLAUDE.md**, **docs/ENVIRONMENT_VARIABLES.md**, **CHANGELOG [Unreleased]**.

**Task 11 — MCP image generation + tool-call fixes (2026-03-28/29)**
- `server.js` — Strip hallucinated content after `TOOL_CALL:` before feeding back to message loop; replace base64 image embedding in AI context with `[Image generated successfully]` placeholder (images still stream to frontend via SSE `toolImage`); fix `const` reassignment crash on `messages` variable (renamed to `cleanedMessages`).
- `server.js` — Remove `(called tools)` placeholder that models parroted back; skip empty assistant messages.
- `server.js` — Fix `preferVision` triggered by historical images (locked follow-ups to llava:7b); strip `images` arrays from older messages so cloud models don't get 400 errors.
- `lib/tool-call-handler.js` — Updated system prompt: explicit instruction to STOP after TOOL_CALL lines, never fabricate results.
- Diagnosed Nano Banana `gemini-2.5-flash-image` Gemini API quota (429 RESOURCE_EXHAUSTED) as external issue.

**Task 12 — Image UX, tool schemas, revision flow, batch delete (2026-03-29)**
- `src/components/MarkdownContent.jsx` — Click-to-preview image lightbox (full-size modal, Escape to close).
- `src/index.css` — 1080px min-width for chat images, pointer cursor, hover feedback.
- `lib/tool-call-handler.js` — Compact tool parameter schemas in system prompt (required params + enum values); 8.5 KB vs 23.7 KB.
- `server.js` — IMAGE_DELIVERED marker for revision flow; non-mimicable historical placeholders; `POST /api/history/batch-delete` for bulk deletion (single request, no rate limiting).
- `src/App.jsx` — `bulkDeleteConversations` uses batch endpoint instead of N individual DELETEs.

**Test Status:** 136+ unit tests; **`npm run test:integration`** (spawned server, chat/review/pentest/remediate + images); E2E as before; build clean.

**Commits (2026-03-28/29):** `b78c0fe` (auto-model + MCP image fixes), `6092e83` (placeholder leak), `afd4da8` (vision fallback + historical images), `6b34e00` (lightbox + schemas + latency).
**Releases:** v1.5.3 through v1.5.14 pushed during prior sessions; next release should include Tasks 10-12 + doc updates.

</work_completed>

<work_remaining>

**Pre-release checklist:**
- [ ] Bump version (currently 3 commits ahead of last release v1.5.14)
- [ ] Build signed + notarized installer
- [ ] Update Google Drive (Mac/Windows/Linux, archive old versions)
- [ ] Push to both GitHub remotes

**Backlog (not requested this session but noted):**
- [ ] MCP parallel task execution (Code Companion MCP server)
- [ ] Agent terminal audit logging to file
- [ ] Playwright E2E for agent terminal
- [ ] Phase 4 confirm-before-run modal
- [ ] Dependabot vulnerabilities (8 on origin, 6 on th3rdai)
- [ ] Optional: re-test **minimax-m2:cloud** for structured review post–fence fix; tune **DEFAULT_AUTO_MODEL_MAP** in `lib/auto-model.js` if results are good
</work_remaining>

<context>
**Implementation reference:** `.claude/commands/whats-next.md` (Claude Code workflow).

**Critical Design Decisions:**
- Root layout MUST use `fixed inset-0` — never h-screen/h-dvh
- Docling default port 5002, NOT 5001 (macOS AirPlay conflict)
- Agent terminal default OFF, empty allowlist = deny all
- Server skips default system prompt when client sends its own (line 761 server.js, `clientHasSystem`) — prevents duplicate system messages that confuse models
- Cloud models wrap JSON in ```json``` fences — ollama-client.js strips them
- write_file tool auto-creates .backup before overwriting
- Folder search skips .Trash, Library, node_modules, .git, .cache, .npm, .nvm
- MCP tool images stream via SSE `toolImage` events; AI context gets text placeholder only (no base64)
- Tool-call loop strips model text after first `TOOL_CALL:` to prevent hallucinated results in feedback
- Both GitHub PATs for 3rdAI-bill authenticate as same user — dedup by label not username
- kimi-k2:1t-cloud: fast (7s review), good structured JSON after fence fix
- qwen2.5:32b: too slow for chat (timeouts at 5min), only use for review if needed
- minimax-m2:cloud: fast but can't do structured review (falls back to chat)
- The user wants the Code Companion MCP server to be leveraged for parallel task execution

**Port Assignments:**
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
- GitHub Secrets set on both repos (APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID)

**Key Files:**
- `lib/builtin-agent-tools.js` — write_file + terminal tools
- `lib/ollama-client.js:225` — JSON fence stripping
- `src/components/ui/InputToolbar.jsx` — reusable toolbar
- `src/components/ReviewPanel.jsx` — inline chat, system prompt with code
- `server.js:761` — client system prompt detection (`clientHasSystem`)
- `server.js:2239` — FOLDER_SEARCH_SKIP + findFolderByName
- `lib/github.js:24` — resolveToken by label
- `lib/prompts.js` — scoring prompts (findings = problems only)
- `lib/auto-model.js` — Auto model resolution; `autoModelMap` user overrides in `.cc-config.json`

**Google Drive Release Path:**
`~/Library/CloudStorage/GoogleDrive-admin@th3rdai.com/My Drive/_TH3RDAI.INC/CodeCompanion/{Mac,Windows,Linux}`
Keep only last 2 versions in archive folders.
</context>
