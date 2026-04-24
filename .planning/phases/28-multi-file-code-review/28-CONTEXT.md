# Phase 28: Multi-File Code Review - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend Review mode to accept multiple files and whole folders, producing a unified report card across the full project. The existing single-file review UX stays untouched — this phase adds a "Scan Folder" tab alongside it. Deep Dive follow-up, export, and all other post-review actions are unchanged.

</domain>

<decisions>
## Implementation Decisions

### Report card format

- One unified report card for the whole project (not per-file cards)
- The AI sees all files together and produces a single overall grade with cross-file findings
- Files with problems are identified within findings by filename (e.g., "Bug in auth.js: unvalidated input")
- No structural change to the existing ReportCard component — same A-F grades, same categories

### Input methods

- Two tabs in ReviewPanel: **Single File** (existing UI, untouched) and **Scan Folder** (new)
- Scan Folder tab: folder path text input + drag-drop support (files or folder)
- Mirrors SecurityPanel's tab pattern exactly — users already know this layout

### File limits

- Match Security mode: max 80 files / 2 MB total
- Show a preview step before submitting (folder path → preview shows file count)
- If >20 files, display a warning: "This may take several minutes"
- User can proceed or narrow scope after seeing the preview

### Post-review actions

- Same as single-file: Deep Dive conversation, export (Copy/MD/CSV/HTML/PDF/JSON), Start Over
- No additional actions needed — report card shape is identical regardless of input

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- `readFolderFiles(folder, { maxFiles, maxTotalSize })` in `lib/pentest.js` — recursive folder reader with filtering; reuse directly (or extract to shared lib)
- `/api/pentest/folder/preview` in `routes/pentest.js` — folder preview endpoint pattern; clone for `/api/review/folder/preview`
- `/api/pentest/folder` in `routes/pentest.js` — full multi-file submit endpoint pattern; clone for `/api/review/folder`
- `SecurityPanel.jsx` — complete multi-file UI: tabs, folder path state, drag-drop, preview step, abort; mine for component patterns
- `routes/review.js` — existing single-file `POST /api/review`; add new `/api/review/folder` route alongside it
- `lib/review.js` → `reviewCode(ollamaUrl, model, code, opts)` — needs a companion `reviewFiles(ollamaUrl, model, files, opts)` function

### Established Patterns

- Auto-model resolution with `estimatedTokens` already used in both review and pentest routes — carry forward for folder route
- `ollamaAuthOpts(config)` + `effectiveOllamaApiKey(config)` — standard auth pattern, apply to new route
- Folder file limits: `{ maxFiles: 80, maxTotalSize: 2 * 1024 * 1024 }` — match Security's values
- Review timeout from `config.reviewTimeoutSec` — pass through to `reviewFiles()` the same way `reviewCode()` uses it

### Integration Points

- `ReviewPanel.jsx` gets a tab switcher; Scan Folder tab is a new sub-component (or inline state)
- New route `/api/review/folder` registered in `routes/review.js` (same module as single-file review)
- `lib/review.js` gets `reviewFiles()` exported alongside `reviewCode()`
- The unified code string sent to `reviewCode()` is built by concatenating files with separator comments (e.g., `// --- FILE: path/to/file.js ---`)

</code_context>

<specifics>
## Specific Ideas

- Concatenate files with clear separator comments before sending to the LLM — keeps the single-model-call approach simple and reuses `reviewCode()` unchanged (or with minimal prompt tweak to mention multiple files)
- The folder preview step should show the file list the same way Security's preview does — a compact list with file paths and sizes

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

_Phase: 28-multi-file-code-review_
_Context gathered: 2026-04-09_
