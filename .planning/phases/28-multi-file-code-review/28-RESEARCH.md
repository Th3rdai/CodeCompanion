# Phase 28: Multi-File Code Review — Research

**Researched:** 2026-04-09
**Domain:** Express routes, React UI (Headless UI tabs), Ollama structured output, server-side folder scanning
**Confidence:** HIGH — all findings drawn directly from the existing codebase; no external library questions

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- One unified report card for the whole project (not per-file cards)
- The AI sees all files together and produces a single overall grade with cross-file findings
- Files with problems are identified within findings by filename (e.g., "Bug in auth.js: unvalidated input")
- No structural change to the existing ReportCard component — same A-F grades, same categories
- Two tabs in ReviewPanel: **Single File** (existing UI, untouched) and **Scan Folder** (new)
- Scan Folder tab: folder path text input + drag-drop support (files or folder)
- Mirrors SecurityPanel's tab pattern exactly — users already know this layout
- Match Security mode: max 80 files / 2 MB total
- Show a preview step before submitting (folder path → preview shows file count)
- If >20 files, display a warning: "This may take several minutes"
- User can proceed or narrow scope after seeing the preview
- Same post-review actions as single-file: Deep Dive conversation, export, Start Over
- No additional actions needed — report card shape is identical regardless of input

### Claude's Discretion
- None specified — all decisions were locked in the discussion phase

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MREV-01 | User can review an entire project folder with aggregated grades | `readFolderFiles()` in `lib/file-browser.js` + new `/api/review/folder` route + `reviewFiles()` in `lib/review.js` |
| MREV-02 | (GitHub repo by URL — deferred, not in this phase) | Out of scope for Phase 28 |
</phase_requirements>

---

## Summary

Phase 28 extends the existing single-file review mode with folder scanning that mirrors the Security mode's multi-file capability. The entire backend pattern is already proven: `lib/pentest.js` `pentestFolder()` → `routes/pentest.js` `/api/pentest/folder` → `SecurityPanel.jsx` folder tab. The implementation is a disciplined clone-and-adapt of these three layers, replacing `pentest` with `review` semantics throughout.

The backend work is straightforward: add `reviewFiles()` to `lib/review.js` (parallel to `pentestFolder()`), add `/api/review/folder/preview` and `/api/review/folder` to `routes/review.js` (cloned from the pentest equivalents), and register a rate limiter for `/api/review/folder` in `lib/rate-limiters-config.js`. The frontend work adds a fourth tab ("Scan Folder") to `ReviewPanel.jsx`'s existing `Tab.Group` and wires in the same folder state machine SecurityPanel uses.

The only non-trivial design choice is the system prompt: the existing `SYSTEM_PROMPTS["review"]` prompt addresses a single file; for multi-file input the user message will prefix file content with separator comments (`// --- FILE: path/to/file.js ---`) so the LLM can attribute findings to specific files, while the prompt itself needs one sentence added instructing the model to reference filenames in findings.

**Primary recommendation:** Clone `pentestFolder` → `reviewFiles`, clone the pentest folder route → review folder route, add one `Tab` + `Tab.Panel` to ReviewPanel. Total new surface area is small; risk is low because all patterns are proven in production.

---

## Standard Stack

### Core — already in the project, no new installs

| Library / Module | Version | Purpose | Status |
|-----------------|---------|---------|--------|
| `lib/file-browser.js` `readFolderFiles()` | — | Recursive server-side folder reader with size/count limits | Exists, used by pentest |
| `lib/review.js` | — | Review orchestration; gets `reviewFiles()` companion | Exists, needs new export |
| `routes/review.js` | — | Review route module; gets two new endpoints | Exists, needs additions |
| `lib/rate-limiters-config.js` | — | Centralized rate limiter wiring | Exists, needs `/api/review/folder` entry |
| `@headlessui/react` `Tab` | installed | Tab switcher UI (Paste Code / Upload / Browse / Scan Folder) | Already used in ReviewPanel |
| `lucide-react` `FolderSearch` | installed | Icon for Scan Folder tab (same icon SecurityPanel uses) | Already imported in SecurityPanel |
| `apiFetch` (`src/lib/api-fetch.js`) | — | Authenticated API calls from React | Already used in ReviewPanel |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended File Changes

```
lib/
  review.js           ← add reviewFiles() export (clone of pentestFolder)
  rate-limiters-config.js  ← add /api/review/folder entry

routes/
  review.js           ← add POST /api/review/folder/preview
                      ← add POST /api/review/folder

src/components/
  ReviewPanel.jsx     ← add FolderSearch import from lucide-react
                      ← add folder state variables
                      ← add handleFolderPreview(), handleSubmitFolderReview()
                      ← add 4th Tab + Tab.Panel ("Scan Folder")
```

### Pattern 1: `reviewFiles()` in `lib/review.js`

**What:** Server-side function that builds a concatenated multi-file string and calls `reviewCode()` (or calls `chatStructured` directly with the review schema).
**When to use:** Called by the `/api/review/folder` route.

The cleanest approach: build the combined string and call `reviewCode()` with it, passing a synthetic `filename` of `"project folder"` so the system prompt gets file context. This avoids duplicating the `chatStructured` / fallback / schema logic.

```javascript
// Source: pattern adapted from lib/pentest.js pentestFolder()
async function reviewFiles(ollamaUrl, model, files, opts = {}) {
  // Build combined code block with file separators (matches Security mode format)
  const combined = files
    .map((f) => `// --- FILE: ${f.path} ---\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  // Scale timeout by file count (same formula as pentestFolder)
  const baseTimeout = opts.timeoutMs ||
    (opts.timeoutSec ? opts.timeoutSec * 1000 : getTimeoutForModel(model));
  const timeout = Math.min(
    baseTimeout * Math.max(1, Math.ceil(files.length / 5)),
    600000,
  );

  // Reuse reviewCode with the combined string
  return reviewCode(ollamaUrl, model, combined, {
    ...opts,
    filename: `${files.length} files`,
    timeoutMs: timeout,
  });
}
```

**Key difference from pentest:** `pentestFolder` calls `chatStructured` directly with a custom user message. `reviewFiles` can call `reviewCode()` (which already handles chatStructured + fallback + Zod validation) and just pass the combined string — no duplication of the structured-output machinery.

### Pattern 2: Route endpoints in `routes/review.js`

**What:** Two new routes cloned from `routes/pentest.js` lines 364–552, replacing `pentest` with `review` semantics.

```javascript
// Source: routes/pentest.js lines 364-383 (preview) and 386-552 (folder scan)

// POST /api/review/folder/preview
router.post("/review/folder/preview", async (req, res) => {
  const { folder } = req.body;
  if (!folder) return res.status(400).json({ error: "Missing folder" });
  try {
    const { files, totalSize, skipped } = readFolderFiles(folder, {
      maxFiles: 80,
      maxTotalSize: 2 * 1024 * 1024,
    });
    res.json({
      files: files.map((f) => ({ path: f.path, size: f.size })),
      totalSize,
      skipped,
      folder,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/review/folder
router.post("/review/folder", async (req, res) => {
  const { model: reqModel, folder } = req.body;
  // ... clone of pentest/folder with reviewFiles() and result.type === "report-card"
});
```

**Auto-model mode string:** Use `mode: "review"` (not `"pentest"`) in `resolveAutoModel` so the user's configured auto-model for review is respected.

**Result type check:** The pentest route checks `result.type === "security-report"`. The review folder route checks `result.type === "report-card"` (matching `reviewCode`'s return value).

### Pattern 3: Rate limiter wiring in `lib/rate-limiters-config.js`

The existing `/api/review` limiter (line 67–72) covers only the exact path. The new endpoints are at `/api/review/folder` and `/api/review/folder/preview` — these must be registered separately. The natural place is immediately after the existing `mount("/api/review", ...)` block.

```javascript
// Source: lib/rate-limiters-config.js existing pattern
mount("/api/review/folder", {
  name: "review-folder",
  max: REVIEW_RATE_LIMIT_MAX,  // reuse existing env var
  windowMs: RATE_LIMIT_WINDOW_MS,
  methods: ["POST"],
});
```

Note: The existing `/api/review` mount uses `methods: ["POST"]` so it does NOT automatically cover `/api/review/folder` even though it's a longer path — Express rate limiter path matching is exact or prefix depending on how `app.use` is called; since it's an exact string `"/api/review"` the sub-paths need their own entry.

### Pattern 4: ReviewPanel tab addition

**What:** Add a 4th `Tab` + `Tab.Panel` to ReviewPanel's existing `Tab.Group` (currently has 3: Paste Code, Upload File, Browse Files).
**When:** Only during `phase === "input"` — same as the existing tabs.

The Scan Folder tab UI structure is directly borrowed from SecurityPanel lines 1835–1847 (tab button) and lines 1971–2090 (tab panel with folder path input, Preview button, file list, warning, and scan button).

Key state additions to ReviewPanel:
```javascript
// Mirror SecurityPanel lines 156-160
const [folderPath, setFolderPath] = useState("");
const [folderPreview, setFolderPreview] = useState(null);
const [folderLoading, setFolderLoading] = useState(false);
const [folderError, setFolderError] = useState("");
```

Abort support: SecurityPanel uses two separate `useAbortable()` instances (`singleAbort` + `folderAbort`). ReviewPanel currently uses a single shared `{ startAbortable, abort, isAborted, clearAbortable }`. For the folder route the cleanest approach is to add a second `useAbortable()` for folder scans, matching SecurityPanel's pattern exactly.

### Pattern 5: System prompt — multi-file context

The existing `SYSTEM_PROMPTS["review"]` prompt ends with: "Review the code thoroughly across all four categories."

For multi-file input, the user message already includes file separators (`// --- FILE: path/to/file.js ---`). One sentence should be added to the prompt (or appended to the user message) instructing the model to reference filenames in its findings:

**Recommended approach:** Append to the user message (not the system prompt) so single-file reviews are unaffected:

```javascript
// In reviewFiles(), the user message content:
const userContent = `Review this project across ALL files. When reporting findings, include the filename (e.g., "In auth.js: ...") so the developer knows exactly where to look.\n\n${combined}`;
```

This keeps `SYSTEM_PROMPTS["review"]` unchanged and avoids any risk to single-file behavior.

### Anti-Patterns to Avoid

- **Modifying `reviewCode()`:** Do not change `reviewCode()` for the folder case. Add `reviewFiles()` as a peer export.
- **Rewriting the SSE fallback stream loop:** The fallback stream reading loop in routes is identical across review and pentest — copy it verbatim; do not abstract it (premature abstraction of async stream readers causes subtle bugs).
- **Using the browser File System API for folder scan:** SecurityPanel has a client-side `readEntriesRecursive()` function using the browser's `webkitGetAsEntry` API. This is used for drag-drop folder input to the single-file textarea. The Scan Folder tab uses a server-side path (`readFolderFiles`) — do NOT mix these up.
- **Forgetting the `cursor` prop on tab buttons:** Headless UI `Tab` does not apply `cursor-pointer` by default — SecurityPanel's tabs all include `cursor-pointer` in the className. ReviewPanel's existing tabs are missing this; add it to all tabs when adding the 4th (or match existing styling exactly and add only to the new tab).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recursive folder reading | Custom `fs.readdir` walk | `readFolderFiles()` in `lib/file-browser.js` | Already handles IGNORE_DIRS, BINARY_EXTENSIONS, per-file size cap, total size cap, depth limit, dotfile allowlist |
| Rate limiting | Manual request counting | `lib/rate-limiters-config.js` `registerRateLimiters` | Centralized, env-configurable, already tested |
| Structured output + Zod validation | Custom JSON parsing | `chatStructured()` + `ReportCardSchema.parse()` via `reviewCode()` | Handles Ollama format param, fallback on parse failure, schema coercion |
| Tab UI | Custom active-tab state | `@headlessui/react` `Tab` | Keyboard navigation, accessibility, already installed |
| API fetch with auth key | `fetch()` directly | `apiFetch()` from `src/lib/api-fetch.js` | Injects `X-CC-API-Key` header when `VITE_CC_API_KEY` is set |

---

## Common Pitfalls

### Pitfall 1: Rate limiter path not covering sub-paths

**What goes wrong:** Adding `/api/review/folder` routes without a corresponding `mount("/api/review/folder", ...)` entry in `rate-limiters-config.js`. The existing `mount("/api/review", ...)` entry uses `methods: ["POST"]` — it may or may not cover sub-paths depending on Express middleware matching semantics, but the comment in the route file says "Rate limiter applied as app.use('/api/pentest', ...) in server.js" and the pentest limiter covers `/api/pentest` while the pentest folder endpoints work. Verify the behavior: if `app.use("/api/pentest", ...)` covers `/api/pentest/folder` then `app.use("/api/review", ...)` also covers `/api/review/folder`. **Check this at wire-up time** — if the existing pattern covers it, no new entry is needed; if not, add one.

**How to avoid:** Read `lib/rate-limiter.js` to confirm whether `app.use(path, ...)` uses prefix matching. Since it uses Express's built-in `app.use` path prefix semantics, `"/api/pentest"` matches `/api/pentest`, `/api/pentest/folder`, `/api/pentest/folder/preview`. Therefore `"/api/review"` already covers `/api/review/folder` — no new rate limiter entry is needed.

**Warning signs:** 429 errors on `/api/review/folder` when rate limit is not exceeded (wrong limiter config), or no rate limiting on folder endpoint at all.

### Pitfall 2: Timeout scaling for large folders

**What goes wrong:** Using the same flat timeout as single-file review for a 40-file folder scan. A 14B model on 80 files could legitimately need 8-10 minutes.

**How to avoid:** Apply the `pentestFolder` scaling formula: `timeout = Math.min(baseTimeout * Math.ceil(files.length / 5), 600000)`. Already captured in the `reviewFiles()` pattern above.

**Warning signs:** SSE connection dropped mid-stream, client shows "Connection failed" for large folders.

### Pitfall 3: `result.type` mismatch in route handler

**What goes wrong:** Copying the pentest folder route and forgetting to change `result.type === "security-report"` to `result.type === "report-card"`. The route then falls through to the SSE fallback path for every successful structured review.

**How to avoid:** Grep for `"security-report"` in any cloned code before committing.

### Pitfall 4: `onSaveReview` history shape for folder scans

**What goes wrong:** Calling `onSaveReview` with `code: files.content` (combined string, potentially megabytes) instead of a summary string, bloating history storage.

**How to avoid:** Match SecurityPanel's pattern — pass a human-readable summary: `code: \`Scanned ${meta.fileCount} files (${(meta.totalSize / 1024).toFixed(1)}KB)\``.

### Pitfall 5: `useAbortable` not supporting concurrent abort targets

**What goes wrong:** Reusing the same `useAbortable` instance for both the single-file and folder scan submit handlers. If a single-file scan is aborted and then a folder scan starts, the stale abort state may immediately cancel the folder request.

**How to avoid:** Add a second `useAbortable()` instance (`folderAbort`) as SecurityPanel does on line 216. Each submit handler uses its own abort instance.

### Pitfall 6: Missing `FolderSearch` import in ReviewPanel

**What goes wrong:** The `FolderSearch` icon from `lucide-react` is imported in `SecurityPanel.jsx` but NOT in `ReviewPanel.jsx`. The current ReviewPanel only imports `FileText`, `Upload`, `FolderOpen`, `AlertTriangle`, `History`.

**How to avoid:** Add `FolderSearch` to the Lucide import at the top of ReviewPanel.jsx when adding the Scan Folder tab.

---

## Code Examples

### `readFolderFiles()` signature (from `lib/file-browser.js` line 271)

```javascript
// Source: lib/file-browser.js lines 267-344
function readFolderFiles(folder, opts = {}) {
  // opts: { maxFiles, maxTotalSize, maxFileSize, maxDepth }
  // Returns: { files: [{ path, content, size }], totalSize, skipped }
}
```

Called in the route exactly as in pentest:
```javascript
const { files, totalSize, skipped } = readFolderFiles(folder, {
  maxFiles: 80,
  maxTotalSize: 2 * 1024 * 1024,
});
```

### Timeout scaling formula (from `lib/pentest.js` lines 102-105)

```javascript
// Source: lib/pentest.js lines 102-105
const baseTimeout = opts.timeoutMs || getTimeoutForModel(model);
const timeout = Math.min(
  baseTimeout * Math.max(1, Math.ceil(files.length / 5)),
  600000,
);
```

### Auto-model resolution for folder route (from `routes/pentest.js` lines 408-429)

```javascript
// Source: routes/pentest.js lines 408-429, adapted for review mode
if (model === "auto") {
  try {
    const totalChars = files.reduce((s, f) => s + (f.content?.length || 0), 0);
    const estimatedTokens = Math.ceil(totalChars / 3.5);
    const r = await resolveAutoModel({
      requestedModel: model,
      mode: "review",          // ← "review" not "pentest"
      estimatedTokens,
      config,
      ollamaUrl: config.ollamaUrl,
      ollamaOpts: ollamaAuthOpts(config),
    });
    model = r.resolved;
  } catch (err) {
    const m = mergeAutoModelMap(config.autoModelMap);
    model = m.review || m.chat || "llama3.2";  // ← review fallback chain
  }
}
```

### Folder preview response shape (from `routes/pentest.js` lines 370-382)

```javascript
// Source: routes/pentest.js lines 370-382
res.json({
  files: files.map((f) => ({ path: f.path, size: f.size })),
  totalSize,
  skipped,
  folder,
});
```

### Folder scan result with meta (from `routes/pentest.js` lines 441-450)

```javascript
// Source: routes/pentest.js lines 441-450
const payload = {
  ...result,
  meta: { fileCount: files.length, totalSize, skipped, folder },
};
if (reqModel === "auto") payload.resolvedModel = model;
return res.json(payload);
```

### ReviewPanel Tab.Group existing structure (from `ReviewPanel.jsx` lines 1198-1236)

Current tabs: Paste Code (index 0), Upload File (index 1), Browse Files (index 2).
New tab: Scan Folder (index 3) — inserted after Browse Files.

Tab button pattern (indigo accent, matching existing):
```jsx
// Source: ReviewPanel.jsx lines 1200-1211
<Tab
  className={({ selected }) =>
    `flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
      selected
        ? "border-b-2 border-indigo-500 text-white -mb-px"
        : "text-slate-400 hover:text-slate-300"
    }`
  }
>
  <FolderSearch className="w-4 h-4" />
  Scan Folder
</Tab>
```

Note: SecurityPanel uses `border-orange-500` accent. ReviewPanel uses `border-indigo-500`. Use indigo for ReviewPanel to stay consistent with its existing tabs.

### >20 file warning (from SecurityPanel, lines ~2010-2025)

```jsx
{folderPreview && folderPreview.files.length > 20 && (
  <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
    <p className="text-sm text-amber-300">
      This may take several minutes with {folderPreview.files.length} files.
      You can proceed or narrow your scope.
    </p>
  </div>
)}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Single-file review only | Multi-file folder scan (new) | Addresses MREV-01 |
| Manual combined string in client | Server-side `readFolderFiles` + concatenation in `reviewFiles()` | Files never transferred to client, respects 2MB cap, skips binaries |

---

## Open Questions

1. **Does `app.use("/api/review", ...)` in rate-limiters-config.js cover `/api/review/folder`?**
   - What we know: Express `app.use(path, middleware)` uses prefix matching — `/api/review` would match `/api/review/folder`. The pentest limiter `mount("/api/pentest", ...)` successfully rate-limits `/api/pentest/folder` with no separate entry.
   - What's unclear: Whether `createRateLimiter` wraps Express `app.use` or `app.all` with an exact path.
   - Recommendation: Read `lib/rate-limiter.js` at plan/implementation time to confirm. If prefix matching, no extra entry needed. If exact matching, add one.

2. **Should `reviewFiles()` call `reviewCode()` internally, or replicate the chatStructured call?**
   - What we know: Calling `reviewCode()` is DRY — reuses all the num_ctx/autoAdjustContext logic. Direct `chatStructured` call gives more control over the user message.
   - Recommendation: Call `reviewCode()` with the combined string. The only thing lost is a custom user message preamble — which can be included in the combined string itself before the file blocks.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (E2E, `tests/e2e/`), node:test (unit, `tests/unit/`) |
| Config file | `playwright.config.js` (root) |
| Quick run command | `node --test tests/unit/*.test.js` |
| Full suite command | `npm run test:integration && npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MREV-01 | `POST /api/review/folder/preview` returns file list | integration | `npm run test:integration` (add case) | ❌ Wave 0 |
| MREV-01 | `POST /api/review/folder` returns `report-card` JSON | integration | `npm run test:integration` (add case) | ❌ Wave 0 |
| MREV-01 | `reviewFiles()` builds correct combined string format | unit | `node --test tests/unit/review-files.test.js` | ❌ Wave 0 |
| MREV-01 | ReviewPanel renders Scan Folder tab in input phase | e2e | `npx playwright test tests/e2e/review-workflow.spec.js` | ✅ (extend existing) |
| MREV-01 | Folder preview API call and file list displayed | e2e | `npx playwright test tests/e2e/review-workflow.spec.js` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test tests/unit/*.test.js`
- **Per wave merge:** `npm run test:integration`
- **Phase gate:** Full E2E suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/review-files.test.js` — unit tests for `reviewFiles()` combined-string format and timeout scaling
- [ ] Integration test cases in `tests/integration/` — mock Ollama, call `/api/review/folder/preview` and `/api/review/folder`, assert shapes
- [ ] E2E: extend `tests/e2e/review-workflow.spec.js` with Scan Folder tab visibility and folder preview mock

---

## Sources

### Primary (HIGH confidence)

All findings are drawn from direct codebase reads — no external sources required for this phase.

| File | What Was Verified |
|------|------------------|
| `lib/pentest.js` | `pentestFolder()` function signature, file concatenation format, timeout scaling formula |
| `lib/review.js` | `reviewCode()` signature, return types (`report-card` / `chat-fallback`), timeout handling |
| `routes/pentest.js` | Preview + folder endpoints, auto-model flow, SSE fallback pattern, meta payload shape |
| `routes/review.js` | Existing single-file route structure, auth opts pattern, rate limiter comment |
| `lib/file-browser.js` | `readFolderFiles()` signature, opts shape, return shape |
| `lib/rate-limiters-config.js` | Existing `/api/review` limiter registration, `mount()` helper pattern |
| `src/components/SecurityPanel.jsx` | Tab structure, folder state variables, `handleFolderPreview`, `handleSubmitFolderScan`, dual `useAbortable` pattern, file list UI, warning banner |
| `src/components/ReviewPanel.jsx` | Existing 3-tab structure, state shape, `useAbortable` usage, `onSaveReview` call signature |
| `lib/prompts.js` | `SYSTEM_PROMPTS["review"]` content — confirmed no multi-file instruction present |
| `lib/review-schema.js` | `ReportCardSchema` shape — confirmed same schema used for folder review |
| `lib/auto-model.js` | `review` mode key confirmed in `DEFAULT_AUTO_MODEL_MAP` |

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already installed, all patterns already in production
- Architecture: HIGH — direct clone of proven pentest/folder pattern, documented line references
- Pitfalls: HIGH — identified from code diff between SecurityPanel (has folder tab) and ReviewPanel (doesn't yet)

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable internal codebase; no external dependencies)
