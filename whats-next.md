<original_task>
Stabilize agent tool behavior and runtime UX in the installed desktop app.
</original_task>

<work_completed>

**Agent + MCP + Playwright stabilization (2026-04-22)**

- Added Playwright MCP client configuration and validated live tool execution (`browser_navigate`, `browser_snapshot`).
- Fixed browser automation deflection behavior across prompt layers:
  - Strengthened tool identity override language in `lib/tool-call-handler.js`.
  - Added browser capability detection (`hasBrowserTool`) and explicit AGENT BROWSER guidance.
  - Updated `routes/chat.js` lead-in to include browser capability messaging even when terminal is also enabled.
- Added server-side fallback retry in `routes/chat.js`:
  - Detects browser refusal text patterns when browser tools are available.
  - Injects one corrective message and retries once to recover into actual `TOOL_CALL` usage.

**Conversation history timestamp fix (2026-04-22)**

- Fixed sidebar `Invalid Date` display by normalizing `createdAt` in:
  - `src/hooks/useChat.js` (before save),
  - `lib/history.js` (save/list + auto-repair),
  - `src/components/Sidebar.jsx` (safe formatting fallback).

**File Browser loading hang mitigation (2026-04-22)**

- Added bounded file-tree scanning in `lib/file-browser.js`:
  - max scan time, max node count, max entries per directory, symlink skip.
  - returns partial/truncated metadata instead of appearing stuck.
- Added frontend tree-request timeout handling in `src/components/FileBrowser.jsx` with friendly timeout message.

**Installed app updates completed**

- Rebuilt/reinstalled `/Applications/Code Companion.app` multiple times during validation.
- Verified installed bundle contains:
  - browser tool guidance/fallback logic,
  - File Browser timeout/guardrail fixes.

</work_completed>

<work_remaining>

- Manually run the 3-step Playwright regression prompts in-app after each release build.
- Optionally cut `v1.6.6` (or next patch version) to ship these fixes through CI/GitHub Releases and updater feeds.
- `routes/chat.js` has unstaged local changes — review before committing.

</work_remaining>

<context>
**Current repo version:** `1.6.5` (next release not cut yet)
**Current app install path:** `/Applications/Code Companion.app`
**Archon project ID:** `2da275aa-5c61-41a4-ac6d-b9aeebcbe843`

**Key current status summary**

- Multi-File Code Review (Phase 28) is complete.
- New follow-on stability fixes (Playwright/browser tooling + File Browser hang + timestamp normalization) are now implemented and locally installed.
- Tool parallel execution remains default-off unless explicitly enabled in config (`toolExec.parallel: false`).
- Git working tree has unstaged changes: `.env.example`, `journal/2026-04-24.md`, `journal/README.md`, `routes/chat.js`. Untracked: `example.com snapshot`, `full-snapshot.md`.

**Recommended immediate next step**

- Create release patch entry and publish via CI tag path so in-app update users get these fixes without local rebuild.
</context>
