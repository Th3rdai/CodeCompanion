<original_task>
Implement MCP per-tool enable/disable controls (MCPFIX) for Code Companion v1.6.9.
</original_task>

<work_completed>

**Chat timeout + Terminal CWD fixes (2026-04-29)**

- **Chat fetch timeout default raised to 10 min**:
  - `lib/config.js` `chatTimeoutSec` default 120 → 600.
  - `routes/chat.js:412` fallback `(config.chatTimeoutSec || 120)` → `|| 600`.
  - `lib/ollama-client.js` `chatComplete` and `chatStructured` `timeoutMs` defaults 120 000ms → 600 000ms (defense-in-depth — every current caller already passes an explicit timeout, so this only affects future callers).
  - `.cc-config.json.example` `chatTimeoutSec` 120 → 600.
  - Existing user configs continue to take precedence; new defaults only apply to fresh installs (Settings → Chat Timeout slider still scales 30s–600s).
  - Triage: log `POST /chat 200 300928ms` followed by `Ollama chatComplete failed (round 1) {"error":"fetch failed"}` against `qwen3-coder:30b` with ~10K-token context; the 5-min ceiling came from `chatTimeoutSec=300` plus the 600 000ms cap on the auto-bump path.

- **Terminal CWD now tracks the active File Browser folder** (previously always read `cfg.projectFolder` from disk):
  - `electron/main.js` `terminal-start` accepts an optional `requestedCwd` from the renderer, validates with `fs.statSync(p).isDirectory()`, falls back to `cfg.chatFolder` → `cfg.projectFolder` → `$HOME`.
  - `electron/preload.js` `terminal.start(cwd)` passes the path through IPC.
  - `src/components/TerminalPanel.jsx` accepts a `projectFolder` prop and includes it in the `useEffect` deps so changing the File Browser folder respawns the PTY at the new location.
  - `src/App.jsx` passes `projectFolder={chatFolder || projectFolder}` to `TerminalPanel` (matches what `FileBrowser` displays).
  - Server-side `lib/config.js` already constrains `chatFolder` to within `projectFolder` and resets it on `projectFolder` change, so no schema change needed.

- **Docs updated**: `CLAUDE.md` (Terminal Mode section + TERMINALFEATURE doc-index summary), `docs/TERMINALFEATURE.md` (How It Works step 3, Security table, Testing Checklist), `CHANGELOG.md` (Unreleased / Changed).

- **Notes for the next signed release**:
  - Source-side timeout fix means new installs default to 10-min chat budget without needing the Settings slider.
  - Terminal CWD change is renderer + main + preload — one PR's worth of scope.
  - During this session, the *installed* `/Applications/Code Companion.app` was patched in-place to verify the timeout fix; that broke the bundle's notarized signature and the bundle had to be restored from `~/Library/Caches/code-companion-updater/pending/code-companion-1.6.16-arm64.zip`. Lesson: never edit a signed bundle's resources — apply the fix at source, ship a new release. The user is currently using the dev build (`npm run electron:dev`) until the next release ships.

---

**MCP per-tool enable/disable — complete and verified (2026-04-25)**

- **ToolsModal UX** (`src/components/McpClientPanel.jsx`):
  - `SERVICE_LABELS` map + `getGroup()` added at module level (handles Google Workspace verb_service_noun naming; includes plural keys: `calendars`, `tasks`, `contacts`, `forms`).
  - Flat 121-item list replaced with grouped collapsible sections by service.
  - Real-time search input (name + description); auto-expands collapsed groups while typing.
  - Group-level checkbox enables/disables all tools in a group atomically.
  - Modal widened `max-w-lg` → `max-w-2xl`.
  - `useGroups` flag: flat list for ≤10 tools, grouped for larger servers.
  - `enabledCount` computed from visible tool names (stale-name safe).
  - Enable all / Disable all footer unchanged; apply to full tools array.

- **Execution-time denial guard** (`lib/tool-call-handler.js`):
  - Guard inserted before `callTool`: checks `config.mcpClients[serverId].disabledTools`.
  - Returns `{ success: false, error: "...disabled in Settings → MCP Clients..." }`.
  - Logs WARN with `serverId` + `toolName` only.
  - 3 new unit tests; **225 total pass**.

- **Route hardening** (`lib/mcp-api-routes.js` + `lib/mcp-client-manager.js`):
  - `validateAndNormalizeConfig()` normalizes `disabledTools`: trims, de-dupes, type-checks.
  - `PUT /api/mcp/clients/:id` validates before disconnecting; `disabledTools`-only saves skip disconnect entirely.

- **Build + install**: Desktop app rebuilt and installed at `/Applications/Code Companion.app`. Production logs confirm `PUT /mcp/clients/google 200 0ms` (no reconnect on tool toggle); `toolsLength` reduced 30120 → 28417 confirming filtering works.

**Nano Banana reliability + image actions — complete and verified (2026-04-25)**

- **Timeout hardening** (`lib/tool-call-handler.js`):
  - Added per-image timeout support via `MCP_IMAGE_TOOL_TIMEOUT_MS` (default `180000`).
  - `generate_image` now uses `max(MCP_TOOL_TIMEOUT_MS, MCP_IMAGE_TOOL_TIMEOUT_MS)`.
  - Timeout errors are retry-classified with clearer user hints; structured logs include `timeoutMs`.
- **Assistant image UX restore** (`src/hooks/useChat.js`, `src/components/MessageBubble.jsx`):
  - Tool-generated images are now persisted on assistant messages via `images` metadata (not markdown-only rendering).
  - Restored inline **Copy** and **Download** buttons for generated images.
  - Lightbox behavior remains intact for click-to-open image viewing.
- **Verification**:
  - Unit tests for timeout behavior pass (`tests/unit/tool-call-handler.test.js`).
  - Installed desktop app rebuilt/reinstalled; production logs confirm successful `nano-banana.generate_image` calls with `partTypes: ["text","image"]`.

**Chat image-claim guardrail — complete and verified (2026-04-25)**

- **False-success claim filtering** (`src/lib/chat-image-claims.js`, `src/hooks/useChat.js`):
  - Assistant image-success text is sanitized unless a real `toolImage` payload is present on that response.
  - Prevents “Generated image…” / “image is displayed above” false positives when model text claims success without tool output.
- **Verification**:
  - Added focused unit tests (`tests/unit/use-chat-image-claim-guard.test.js`) with claim-removal + pass-through coverage.
  - Guard test passes locally (3/3).

</work_completed>

<work_remaining>

- **Prettier formatting pass** on `AGENTS.md`, `CLAUDE.md`, `lib/tool-call-handler.js` to clear the P1 failure from the 2026-04-24 `/validate-project --thorough` run.
- **Cut next patch release** via CI tag push to ship MCPFIX changes through GitHub Releases + in-app updater.
- **Run `/validate-project --thorough`** after Prettier fix to confirm full green.

</work_remaining>

<context>
**Current version:** 1.6.9
**App install:** `/Applications/Code Companion.app`
**Unit tests:** 225 pass (0 fail)
**MCP clients connected:** Archon (17), Google (121), crawl4ai-rag (5), Stitch (12), nano banana (4)

**Model note:** `qwen3-coder:30b` does not reliably emit `TOOL_CALL` format for complex Google MCP flows — use `bazobehram/qwen3-14b-claude-4.5-opus-high-reasoning` or similar for Google Workspace agentic tasks.

**Archon project ID:** `2c1b9ed7-1ebd-4cac-85a7-275942ae136d`
**MCPFIX Archon task:** `4b7ca017-8205-471b-a025-64b7df8c66d9` (done)
</context>
