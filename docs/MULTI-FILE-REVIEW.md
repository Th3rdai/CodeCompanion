# Multi-File Code Review

**Phase**: 28
**Status**: ✅ Production (Shipped)
**Category**: Code Quality

---

## Overview

Review mode supports reviewing entire project folders at once, producing a unified report card that assesses code quality across all files. Instead of reviewing files one at a time, point Review mode at your project folder and get a single, cohesive quality assessment.

**Key Benefits**:
- **Unified assessment** — Single report card across entire project
- **Time savings** — Review dozens of files in one operation
- **Project-wide insights** — See patterns and issues across the codebase
- **Same familiar UX** — Report cards, grades, deep-dive conversations

---

## How to Use

### 1. Open Review Mode

Click the **Review** tab in the mode selector (sidebar or toolbar).

### 2. Select "Scan Folder" Tab

Review mode has four input methods:
- **Paste** — Paste code directly
- **Upload** — Upload a single file
- **Browse** — Select file from File Browser
- **Scan Folder** — Review entire folder (⭐ this one)

Click the **Scan Folder** tab.

### 3. Enter Folder Path

**⌨️ Option A: Type the folder path**
- Enter the full path to your project folder
- Example: `/Users/you/myproject` or `C:\Users\you\myproject`

**🖱️ Option B: Drag and drop**
- Drag a folder from Finder/Explorer directly into the input area
- Visual feedback shows when folder is ready to drop

⚠️ **Security Note**: Folder must be within your configured **Project Folder** (Settings → General → Project Folder). Paths outside this boundary will return a 403 Forbidden error.

### 4. Preview Files

Click the **Preview Files** button to see what will be reviewed:
- File count (e.g., "42 files found")
- File list with paths and sizes
- Total size across all files
- Number of skipped files (binary, too large, etc.)

⚠️ **Warning**: If more than 20 files are detected, you'll see a warning that the review may take several minutes. You can proceed or narrow your scope by selecting a subfolder.

### 5. Review Folder

Once you've confirmed the preview looks correct, click **Review {N} File(s)** to start the scan.

**What happens**:
1. Server reads all discovered files (up to 80 files, 2MB total)
2. Files are concatenated with separators: `// --- FILE: path ---`
3. Combined content is sent to the LLM with instruction to review across all files
4. Timeout is scaled by file count: `baseTimeout * Math.ceil(files.length / 5)` (max 10 min)
5. LLM produces unified report card with grades for: bugs, security, readability, completeness

**Progress**: Loading animation shows while the review is in progress. Multi-file reviews typically take longer than single-file reviews (30s–2min for 20–40 files).

### 6. Review Report Card

Report card displays identically to single-file reviews:
- **Overall grade** (A–F)
- **Category grades** (bugs, security, readability, completeness)
- **Top priority** — Most critical issue across entire project
- **Findings** — Organized by category

**File attribution**: The LLM is instructed to include filenames in findings. Look for phrases like:
- "In auth.js, line 42: Missing input validation..."
- "The calculateTotal function in utils/math.js could be simplified..."

### 7. Deep-Dive Conversations

Click into any category (bugs, security, readability, completeness) to start a deep-dive conversation about that specific area. The AI understands the context is across the entire project.

Example prompts:
- "Which files have the most critical security issues?"
- "Show me all the readability findings in the auth module"
- "What's the best way to refactor the duplicate code you found?"

---

## File Limits

To prevent token overflow and ensure timely reviews, the following limits are enforced:

| Limit | Value | Why |
|-------|-------|-----|
| **Max files** | 80 files | Prevents context window overflow |
| **Max total size** | 2MB | ~500K tokens at 3.5 chars/token |
| **Per-file size** | 200KB (soft) | Larger files may be skipped |
| **Max timeout** | 10 minutes | Scaled by file count, capped at 600s |

**Note**: These limits match Security mode's folder scanning limits. See [CLAUDE.md Security Mode](../CLAUDE.md#security-mode) for comparison with OWASP security scanning.

**Binary files** are automatically skipped:
- Images (`.png`, `.jpg`, `.gif`, etc.)
- PDFs, DOC/DOCX files
- Compiled binaries (`.exe`, `.dll`, `.so`, etc.)
- Archives (`.zip`, `.tar.gz`, etc.)

**Large projects**: If your project exceeds limits, review subdirectories separately (e.g., scan `src/` and `tests/` as two operations).

---

## Technical Details

### Backend

**Function**: `reviewFiles(ollamaUrl, model, files, opts)`
- Location: `lib/review.js:144-168`
- Concatenates files with separators: `` `// --- FILE: ${f.path} ---\n\`\`\`\n${f.content}\n\`\`\`` ``
- Scales timeout: `timeout = baseTimeout * Math.max(1, Math.ceil(files.length / 5))`
- Uses system prompt: `SYSTEM_PROMPTS["review-multi"]`
- Instructs LLM: "include the filename (e.g., 'In auth.js: ...')"

**Routes**:
- `POST /api/review/folder/preview` — Returns file list, totalSize, skipped count
- `POST /api/review/folder` — Runs full review and returns unified report card
- Both routes: `isWithinBasePath()` validation, file limits enforced, audit logging

**Security**:
- Paths outside `projectFolder` return 403 Forbidden
- File limit enforcement (80 files, 2MB)
- Binary files automatically skipped
- Abort signal support for cancellation

### Frontend

**Component**: `ReviewPanel.jsx:1513-1643`
- Fourth tab labeled "Scan Folder" with `<FolderSearch />` icon
- Folder path input with real-time validation
- Drag-and-drop support with visual feedback
- Preview button triggers `/api/review/folder/preview`
- Review button triggers `/api/review/folder`
- Loading states, error display, file list preview
- Warning for large folders (>20 files)

### Grade Aggregation

**Design**: LLM-driven aggregation (not explicit "worst wins" code)

The LLM receives all files in a single request with the instruction: "Review this project across ALL files." The model naturally produces unified grades considering the entire codebase.

**Why LLM-driven**:
- More intelligent than mechanical rules
- Allows nuanced judgment (e.g., 1 minor bug in 40 files might still yield B overall)
- Simpler implementation (less code to maintain)
- More flexible (handles edge cases better)

### File Attribution

**Design**: Natural language attribution via LLM instructions

The user preamble includes: "When reporting findings, include the filename (e.g., 'In auth.js: ...') so the developer knows exactly where to look."

The LLM naturally mentions filenames in findings. No structured `filePath` field is added to the report card schema.

**Why natural language**:
- More flexible (can reference multiple files in one finding)
- Easier to implement (no parsing/matching logic)
- More readable for users (natural language is clearer)

---

## Troubleshooting

### "Folder is outside the configured project folder"

**Error**: 403 Forbidden
**Cause**: The folder you entered is not within Settings → Project Folder
**Fix**:
1. Go to Settings → General → Project Folder
2. Update to a parent directory that contains your target folder
3. Retry the scan

**Related**: For more on project folder configuration and security boundaries, see [Settings Panel](../CLAUDE.md#settings-panel).

### "No reviewable text files found in folder"

**Error**: 400 Bad Request
**Cause**: Folder contains only binary files or is empty
**Fix**:
- Verify the folder path is correct
- Check that the folder contains source code files
- Review the preview to see what files were discovered

### "Too many files or folder too large"

**Warning**: Preview shows warning about file count or size
**Cause**: Folder exceeds limits (80 files or 2MB)
**Fix**:
- Narrow scope by scanning a subdirectory (e.g., `src/` instead of root)
- Remove generated files from scan (`dist/`, `node_modules/`, `.git/`)
- Review in multiple operations

### Review times out after 10 minutes

**Error**: Request timeout
**Cause**: Review is taking longer than maximum allowed time
**Fix**:
- Reduce number of files (scan subdirectories separately)
- Use a faster model in Settings → General → Auto Model Map → Review
- Increase timeout in Settings → General → Review Timeout (max 600s)

### Files missing from preview

**Observation**: Some files don't appear in preview
**Cause**: Files are skipped if:
- Binary format (images, PDFs, compiled binaries)
- Too large (>200KB per file)
- Hidden files starting with `.` (except `.env`, `.gitignore`, etc.)
- In ignored directories (`node_modules/`, `.git/`, `dist/`, `build/`)

**Fix**: This is by design. Only reviewable text files are included.

---

## Comparison: Single-File vs. Multi-File

| Aspect | Single-File Review | Multi-File Review (Scan Folder) |
|--------|-------------------|--------------------------------|
| **Input** | Paste, Upload, or Browse | Folder path or drag-and-drop |
| **Scope** | One file at a time | Up to 80 files, 2MB total |
| **Report card** | Grades for that file | Unified grades across all files |
| **Findings** | Specific to one file | Include file paths (e.g., "In auth.js:") |
| **Timeout** | Default (300s) | Scaled by file count (max 600s) |
| **Deep-dive** | Conversation about one file | Conversation about entire project |
| **Use case** | Quick spot check | Comprehensive project assessment |

---

## Best Practices

### When to Use Multi-File Review

✅ **Good use cases**:
- Initial project assessment — Get overall quality snapshot
- After major refactor — Verify changes across entire codebase
- Pre-release quality gate — Final review before shipping
- Onboarding new developers — Understand project-wide patterns
- Code audit — Comprehensive security/quality review

❌ **Not ideal for**:
- Debugging specific issues — Use single-file review or Debug mode
- Large codebases (>80 files) — Break into modules and review separately
- Real-time feedback while coding — Use single-file review for quick iterations

### How to Get Best Results

1. **Clean up first**: Remove generated files, dependencies, build artifacts
2. **Start small**: Review one module/directory at a time
3. **Use preview**: Always preview before scanning to verify scope
4. **Read warnings**: Heed warnings about large folders (may timeout)
5. **Follow up**: Use deep-dive conversations to explore specific issues
6. **Iterate**: After fixes, re-scan to verify improvements

### Organizing Large Projects

For projects exceeding file limits:

**Strategy 1**: Review by directory
```
/myproject/src/          ← Scan this first
/myproject/tests/        ← Then this
/myproject/lib/          ← Then this
```

**Strategy 2**: Review by feature
```
/myproject/src/auth/     ← Authentication module
/myproject/src/api/      ← API endpoints
/myproject/src/db/       ← Database layer
```

**Strategy 3**: Review by priority
```
Critical files first (main entry points, core logic)
Then supporting files (helpers, utilities)
Then tests
```

---

## Related Features

- **Security Mode** — OWASP security assessment with folder scanning (6 categories)
- **Validate Mode** — Generate project validation commands (linters, tests, type checkers)
- **File Browser** — Browse and attach files from project folder
- **Export** — Export report cards to multiple formats (MD, PDF, DOCX, etc.)

---

## Implementation History

**Phase**: 28
**Status**: ✅ Shipped (production-ready as of 2026-05-24)

**Key commits**:
- Routes: `/api/review/folder/preview` and `/api/review/folder` in `routes/review.js`
- Backend: `reviewFiles()` function in `lib/review.js`
- Frontend: "Scan Folder" tab in `ReviewPanel.jsx`
- Tests: Unit tests in `tests/unit/review-files.test.js`, integration tests in `tests/integration/review-folder.test.js`

**Design decisions**:
- LLM-driven aggregation (not explicit "worst wins" code) — More intelligent, flexible
- Natural language file attribution (not structured fields) — More readable, easier to implement
- Drag-and-drop support — Enhanced UX beyond original plan
- Warning for large folders — Proactive user guidance

---

## Further Reading

- **CLAUDE.md** — Main project documentation (includes Review Mode section)
- **PHASE-28-GAP-ANALYSIS.md** — Comprehensive gap analysis confirming feature completeness
- **MULTIFILE-REVIEW.md** — Plan-reviewer findings (feature already implemented)
- **MULTIFILE-ARCHIVED.md** — Original implementation plan (archived after discovery)
- **lib/review.js** — Backend implementation (reviewFiles function)
- **routes/review.js** — API endpoints (preview and full scan)
- **src/components/ReviewPanel.jsx** — Frontend implementation (Scan Folder tab)

---

**Last Updated**: 2026-05-24
**Maintainer**: Code Companion Development Team
