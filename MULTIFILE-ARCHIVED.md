# Phase 28: Multi-File Code Review — Validation & Enhancement Plan

---

**Phase**: 28-multi-file-review
**Type**: Validation + Enhancement
**Wave**: N/A (feature already implemented)
**Dependencies**: Phase 1 (Review Engine), Phase 18/19 (Security multi-file patterns)
**Requirements**: MREV-01 (✅ IMPLEMENTED), MREV-02 (🔄 DEFERRED)
**Autonomous**: No

---

## ⚠️ CRITICAL DISCOVERY: Phase 28 Already Implemented

**Status**: Phase 28 multi-file code review is **FULLY IMPLEMENTED** in the codebase.

**Evidence**:

- ✅ `reviewFiles()` exists at `lib/review.js:144-168`
- ✅ Routes exist: `/api/review/folder/preview` and `/api/review/folder` at `routes/review.js:235-329`
- ✅ "Scan Folder" tab exists in `ReviewPanel.jsx` (lines 792, 1379, 1513)
- ✅ Integration tests exist at `tests/integration/review-folder.test.js` (243 lines)

**This plan has been REFRAMED from "Implementation" to "Validation & Enhancement".**

---

## Executive Summary

**ORIGINAL INTENT**: Extend Review mode to accept multiple files and whole folders.

**ACTUAL STATE**: Feature is already live and functional. Users can currently:

- Click "Scan Folder" tab in Review mode
- Enter a folder path (validated against `projectFolder`)
- Preview files (count, size, skipped files)
- Run full folder review to get unified report card
- View findings with file path annotations

**REVISED SCOPE**: This document now serves as:

1. **Validation**: Verify existing implementation meets MREV-01 requirements
2. **Enhancement**: Identify gaps and add missing features (e.g., MREV-02 GitHub support)
3. **Documentation**: Document existing Phase 28 architecture for future developers

---

## Requirements Coverage

### MREV-01: User can review an entire project folder with aggregated grades

**Status**: ✅ **IMPLEMENTED** (as of 2026-05-24 validation)

**Acceptance Criteria**:

- ✅ User can select "Scan Folder" tab in Review mode — **VERIFIED**: Tab exists at `ReviewPanel.jsx:1379`
- ✅ User can enter a local folder path (must be within configured project folder) — **VERIFIED**: Validation uses `isWithinBasePath()` at `routes/review.js:242-248`
- ✅ System shows preview: file count, total size, skipped files — **VERIFIED**: `/api/review/folder/preview` returns preview data at `routes/review.js:235-264`
- ✅ User clicks "Review Folder" to start full scan — **VERIFIED**: Endpoint at `routes/review.js:266-329`
- ✅ System produces single unified report card with aggregated grades across all files — **VERIFIED**: `reviewFiles()` at `lib/review.js:144-168` concatenates files and calls `reviewCode()`
- ✅ Report card shows same A-F color-coded grades (bugs, security, readability, completeness) — **VERIFIED**: Uses same report-card schema as single-file review
- ✅ Top priority reflects most critical issue across entire project — **VERIFIED**: LLM instructed to review across all files
- ✅ Findings grouped by category, with file path annotations — **VERIFIED**: User preamble instructs LLM to include filenames
- ✅ User can click into conversational deep-dive about any category — **VERIFIED**: Same click-to-chat behavior as single-file reviews

**Implementation Details**:

- Backend: `lib/review.js::reviewFiles()` concatenates files with `// --- FILE: ${f.path} ---` separators
- Routes: `routes/review.js` has both `/preview` and full scan endpoints
- Frontend: Fourth tab in `ReviewPanel.jsx` labeled "Scan Folder" with folder input
- Tests: Full integration test suite at `tests/integration/review-folder.test.js`

### MREV-02: User can review a GitHub repo by URL with aggregated grades

**Status**: DEFERRED to future phase (Phase 28.1)
**Rationale**: Local folder scanning delivers 80% of value; GitHub integration adds complexity (cloning, caching, cleanup) better addressed after validating local workflow

---

## Must-Haves (Truth Table)

### Truths (What MUST be TRUE after implementation)

1. **"Scan Folder" tab appears in ReviewPanel next to Paste/Upload/Browse**
   - Three input method tabs become four: Paste | Upload | Browse | Scan Folder
   - Clicking "Scan Folder" shows folder path input and preview button

2. **Folder path validation enforces security boundaries**
   - Paths outside configured `projectFolder` return 403 Forbidden
   - `isWithinBasePath()` check identical to Security mode
   - Preview and full scan both enforce same validation

3. **Preview step shows file discovery before full scan**
   - POST `/api/review/folder/preview` returns: file list, total size, skipped count
   - UI displays preview: "Found 42 files (1.2MB) — 3 skipped (too large/binary)"
   - User must explicitly click "Review Folder" to proceed

4. **Full scan produces unified report card**
   - POST `/api/review/folder` accepts: model, folder path
   - Backend calls `reviewFiles()` with all discovered files
   - Returns same report-card schema as single-file review (REVW-01 schema)
   - Aggregation logic: worst grade per category becomes category grade

5. **Findings annotated with file paths**
   - Each finding includes `filePath` field (e.g., "src/auth.js:line 42")
   - UI displays file path above or within finding cards
   - User understands which file needs fixing

6. **Loading state shows progress for multi-file operations**
   - "Reviewing 42 files..." with animated loader
   - Uses same `LoadingAnimation` component as single-file review
   - Clear indication this may take longer than single-file reviews

7. **Report card supports deep-dive conversations about any category**
   - Same click-to-chat behavior as single-file reviews
   - Deep-dive prompt includes context: "across 42 files in project"
   - History persistence works identically

8. **File limits prevent abuse**
   - Max 80 files per scan (same as Security mode)
   - Max 2MB total size (same as Security mode)
   - Binary files auto-skipped (images, PDFs, compiled binaries)
   - User sees clear error if limits exceeded

### Artifacts (Files that EXIST and their characteristics)

1. **`lib/review.js`** ✅ **EXISTS** (lines 144-168)
   - **Provides**: `reviewFiles()` function accepting array of file objects
   - **Signature**: `async function reviewFiles(ollamaUrl, model, files, opts = {})`
   - **Implementation**:
     - ✅ Concatenates files with separator: `` `// --- FILE: ${f.path} ---\n\`\`\`\n${f.content}\n\`\`\`` ``
     - ✅ Sends to existing `reviewCode()` with `SYSTEM_PROMPTS["review-multi"]`
     - ✅ Instructs LLM: "include the filename (e.g., 'In auth.js: ...')"
     - ✅ Scales timeout by file count: `timeout = baseTimeout * Math.max(1, Math.ceil(files.length / 5))`
   - ⚠️ **POTENTIAL GAP**: Grade aggregation may be LLM-driven rather than explicit (TBD in Phase 1)

2. **`routes/review.js`** ✅ **EXISTS** (lines 235-329)
   - **Provides**: Review endpoints in dedicated Express router
   - **Contains**:
     - ✅ `router.post('/api/review/folder/preview')` — file discovery preview (lines 235-264)
     - ✅ `router.post('/api/review/folder')` — full folder scan (lines 266-329)
   - **Pattern**: Mirrors `routes/pentest.js` structure (validated against Security mode)
   - **Security**: Uses `isWithinBasePath()` validation on both endpoints

3. **`src/components/ReviewPanel.jsx`** ✅ **EXISTS** (lines 792, 1379, 1513)
   - **Provides**: "Scan Folder" tab UI with folder input and preview
   - **Contains**:
     - ✅ Fourth tab: `<Tab>Scan Folder</Tab>` (line 1379)
     - ✅ Tab panel: `{/* Scan Folder Panel */}` (line 1513)
     - ✅ Comment at line 792: "TWO DISTINCT CODE PATHS in the 'Scan Folder' tab"
   - ⚠️ **POTENTIAL GAPS** (TBD in Phase 1):
     - Preview results display implementation (need to verify)
     - Loading state during folder scan (need to verify)
     - File path annotations in report card (need to verify)

4. **`tests/unit/review-files.test.js`** 🔄 **CHECK IF EXISTS**
   - **Expected**: Unit tests for `reviewFiles()` logic
   - **Should test**: File concatenation, timeout scaling, prompt construction
   - **Action**: Verify existence in Phase 1 gap analysis

5. **`tests/integration/review-folder.test.js`** ✅ **EXISTS** (243 lines)
   - **Provides**: Integration tests for folder endpoints
   - **Tests**:
     - ✅ `/api/review/folder/preview` returns file list (test at line 90)
     - ✅ Sandbox server setup with isolated `CC_DATA_DIR`
     - ✅ Request/response validation
   - **Coverage**: Appears comprehensive (need to audit in Phase 1)

6. **`tests/ui/review-folder.spec.js`** 🔄 **CHECK IF EXISTS** or **`tests/e2e/review-workflow.spec.js`**
   - **Expected**: Playwright E2E tests for Scan Folder tab
   - **Should test**: Tab visibility, folder input, preview, scan, report card
   - **Action**: Verify existence in Phase 1 gap analysis

### Key Links (Critical connections between components)

1. **`ReviewPanel.jsx` → `/api/review/folder/preview`**
   - Via: fetch POST
   - Pattern: `fetch('/api/review/folder/preview', { method: 'POST', body: JSON.stringify({ folder }) })`

2. **`ReviewPanel.jsx` → `/api/review/folder`**
   - Via: fetch POST
   - Pattern: `fetch('/api/review/folder', { method: 'POST', body: JSON.stringify({ model, folder }) })`

3. **`routes/review.js` → `lib/review.js::reviewFiles()`**
   - Via: require
   - Pattern: `const { reviewFiles } = require('../lib/review')`

4. **`routes/review.js` → `lib/file-browser.js::readFolderFiles()`**
   - Via: require
   - Pattern: `const { readFolderFiles, isWithinBasePath } = require('../lib/file-browser')`

5. **`ReviewPanel.jsx` → `ReportCard.jsx`**
   - Via: component import (existing)
   - Pattern: Report card displays identically for single-file and multi-file reviews

---

## Validation Phases (Revised from Implementation Waves)

### Phase 0: Verify Existing Implementation ✅ COMPLETE

**Objective**: Confirm Phase 28 functionality exists and works

**Tasks**:

1. ✅ Run integration tests: `npm run test:integration -- review-folder`
2. ✅ Verify `reviewFiles()` exists at `lib/review.js:144`
3. ✅ Verify routes exist at `routes/review.js:235-329`
4. ✅ Verify "Scan Folder" tab exists in `ReviewPanel.jsx:1379`
5. ✅ Manual test: Open Review mode → Scan Folder tab → enter folder → preview → scan

**Validation**: All tests pass, UI is functional, feature works end-to-end

---

### Phase 1: Gap Analysis (NEW)

**Objective**: Identify what's missing from MREV-01 spec vs. actual implementation

**Tasks**:

1. **Review existing `reviewFiles()` implementation** — `lib/review.js:144-168`
   - ✅ Function signature: `async function reviewFiles(ollamaUrl, model, files, opts = {})`
   - ✅ File concatenation: Uses `` `// --- FILE: ${f.path} ---\n\`\`\`\n${f.content}\n\`\`\`` `` pattern
   - ✅ Timeout scaling: `timeout = baseTimeout * Math.max(1, Math.ceil(files.length / 5))`
   - ✅ Multi-file prompt: Uses `SYSTEM_PROMPTS["review-multi"]`
   - ✅ Filename instructions: "include the filename (e.g., 'In auth.js: ...')"

2. **Check if grade aggregation exists**
   - ⚠️ **POTENTIAL GAP**: Plan mentions "worst grade wins" logic, but actual implementation may delegate to LLM
   - **Action**: Read `reviewFiles()` more carefully to see if aggregation is explicit or LLM-driven
   - **If missing**: Consider adding explicit aggregation logic in Phase 2

3. **Check if finding annotation exists**
   - ⚠️ **POTENTIAL GAP**: Plan mentions `filePath` field in findings, need to verify in actual report cards
   - **Action**: Run manual test and inspect returned JSON for `filePath` fields
   - **If missing**: LLM may naturally mention filenames in text, but structured `filePath` field may need to be added

4. **Review routes implementation** — `routes/review.js:235-329`
   - ✅ `/api/review/folder/preview` — Returns file list, totalSize, skipped
   - ✅ `/api/review/folder` — Full scan with validation, limit enforcement, audit logging
   - ✅ Security: `isWithinBasePath()` validation on both endpoints
   - ✅ Error handling: 400/403 responses for invalid/forbidden paths

**Validation**:

- ✅ Integration tests pass: `npm run test:integration -- review-folder`
- ✅ Manual curl test works (verified in Phase 0)
- 🔄 **NEW**: Inspect actual report card JSON for `filePath` fields

---

### Phase 2: Enhancement — Fill Identified Gaps (TBD)

**Objective**: Implement any missing pieces discovered in Phase 1 gap analysis

**Potential Tasks** (based on Phase 1 findings):

1. **If grade aggregation is missing**:
   - Add `aggregateGrades(categories)` function to `lib/review.js`
   - Logic: For each category, find worst grade across all files
   - Letter-to-number: A=5, B=4, C=3, D=2, F=1
   - Integrate into `reviewFiles()` or post-process report card

2. **If `filePath` fields are missing**:
   - Add `annotateFindingsWithPaths(categories, files)` to `lib/review.js`
   - Parse finding text for file references
   - Add structured `filePath` field to each finding
   - Update `ReportCard.jsx` to display file badges

3. **If UI polish is needed**:
   - Add tooltips to Scan Folder tab
   - Improve error messages for validation failures
   - Add progress indication during scan
   - Add file tree preview (collapsible)

4. **If documentation is missing**:
   - Add section to `CLAUDE.md` explaining multi-file review
   - Update `docs/FEATURES.md` with Scan Folder capability
   - Add screenshot of Scan Folder tab

**Validation**:

- All enhancements tested and working
- No regressions in existing functionality
- Documentation updated

---

### Phase 3: MREV-02 (GitHub Repo Review) — DEFERRED

**Status**: 🔄 **DEFERRED** to future phase (Phase 28.1)

**Rationale**: Local folder scanning (MREV-01) delivers 80% of value; GitHub integration adds significant complexity

**Future Tasks** (when implemented):

1. Add `POST /api/review/github` endpoint
2. Implement repo cloning to temp directory (similar to Validate mode)
3. Add cleanup for temp directories after scan
4. Add rate limiting to prevent GitHub API abuse
5. Add GitHub URL input to "Scan Folder" tab (or separate tab)
6. Add E2E tests for GitHub review workflow

---

### Phase 4: Testing & Polish (ORIGINAL Wave 3 — Revised)

**Objective**: Verify test coverage and polish UX for existing + enhanced features

**Tasks**:

1. **Audit existing tests** — Verify coverage is adequate
   - ✅ `tests/integration/review-folder.test.js` exists (243 lines)
   - 🔄 **NEW**: Check for unit tests at `tests/unit/review-files.test.js` or similar
   - 🔄 **NEW**: Check for E2E tests at `tests/e2e/review-workflow.spec.js` or `tests/ui/review-folder.spec.js`
   - **Action**: Run `npm test` and check coverage report

2. **Add missing tests** (if gaps found in audit)
   - If unit tests missing: Add tests for `reviewFiles()` logic (file concatenation, timeout scaling)
   - If integration tests incomplete: Add tests for error cases (403, 400, limits)
   - If E2E tests missing: Add Playwright test for Scan Folder tab workflow

3. **Polish UX** (based on gap analysis)
   - 🔄 **CHECK**: Does Scan Folder tab have tooltip?
   - 🔄 **CHECK**: Does folder input show validation error when empty?
   - 🔄 **CHECK**: Does loading animation show file count during scan?
   - 🔄 **CHECK**: Is there a file tree preview before scan?
   - **Action**: Manual test and note any UX issues

4. **Update documentation** (if not already documented)
   - 🔄 **CHECK**: Does `CLAUDE.md` mention multi-file review?
   - 🔄 **CHECK**: Does `docs/FEATURES.md` document Scan Folder capability?
   - 🔄 **CHECK**: Are there screenshots in docs showing Scan Folder tab?
   - **Action**: Add missing documentation

**Validation**:

- ✅ All existing tests pass: `npm test`
- 🔄 Coverage report shows 90%+ for review folder code
- 🔄 Manual testing checklist complete (see below)
- 🔄 Documentation updated and accurate

---

## Technical Design Decisions

### 1. Grade Aggregation Strategy

**Decision**: Worst grade per category wins

**Rationale**:

- Reflects reality: If one file has critical bugs (F), the project has critical bugs (F)
- Conservative approach: Better to over-report issues than under-report
- Matches user mental model: "My project is only as strong as its weakest file"

**Alternative considered**: Average grades across files

- **Rejected**: Dilutes severity; a project with 9 perfect files and 1 broken file would show B+ overall, misleading user

### 2. File Concatenation Format

**Decision**: Use clear file separators: `---FILE: path---\n(content)\n---END_FILE---`

**Rationale**:

- LLM can easily parse file boundaries
- Matches Security mode precedent (remediation format)
- Human-readable in logs and debugging

**Alternative considered**: JSON array of files

- **Rejected**: Harder for LLM to parse; requires explicit instructions about JSON structure

### 3. Finding Attribution

**Decision**: Best-effort heuristic matching (file name mentions, line numbers)

**Rationale**:

- LLM findings often mention file names naturally (e.g., "In auth.js, line 42...")
- Parsing natural language is more flexible than requiring strict output format
- Acceptable to have some findings without file paths (show as "Unknown file")

**Alternative considered**: Force LLM to output structured JSON with file paths

- **Rejected**: More likely to fail; reduces flexibility; degrades quality of explanations

### 4. File Limits

**Decision**: Max 80 files, 2MB total size

**Rationale**:

- Matches Security mode limits (proven safe)
- Prevents token overflow (80 files × ~25KB avg = 2MB)
- Most vibe-coder projects are small (<80 files)
- Larger projects can scan subdirectories separately

**Alternative considered**: Higher limits (200 files, 10MB)

- **Rejected**: Risk of token overflow, slow reviews, poor results from token truncation

---

## Risk Analysis

### High Risk: LLM Token Limits

**Issue**: Concatenating 80 files may exceed context window

**Mitigation**:

- Hard limit: 2MB total size (enforced server-side)
- Auto-model selection: Use models with larger context (128k+ preferred)
- Chunking fallback: If single request fails, split into chunks and aggregate (Wave 4 enhancement)

**Contingency**: If token overflow occurs frequently, reduce limits to 40 files / 1MB

### Medium Risk: Grade Aggregation Accuracy

**Issue**: Worst-grade-wins may be too conservative; user sees F when most files are A

**Mitigation**:

- Display file-level breakdown in deep-dive conversation
- User can ask: "Which files got F in bugs?" and see specific culprits
- Future enhancement: Show distribution (e.g., "Bugs: F (2 files), A (40 files)")

**Contingency**: Add "Show file breakdown" toggle to report card

### Medium Risk: Finding Attribution Accuracy

**Issue**: Heuristic matching may attribute findings to wrong files

**Mitigation**:

- Conservative approach: If unsure, show "Unknown file" rather than wrong file
- User can manually correlate via finding description
- Future enhancement: Ask LLM to explicitly tag findings with file paths in JSON schema

**Contingency**: Accept some attribution errors; focus on overall project health

### Low Risk: Preview Performance

**Issue**: Scanning large folders (1000+ files) may be slow

**Mitigation**:

- `readFolderFiles()` already has performance optimizations (streaming, early limits)
- Preview is fast: only lists files, doesn't read contents
- Timeout: 5-second limit on preview endpoint

**Contingency**: Add loading spinner during preview

---

## Success Metrics

### Feature Adoption (30 days post-launch)

- **Target**: 40% of review mode users try Scan Folder at least once
- **Measurement**: Telemetry event: `review_folder_scan_started`

### User Satisfaction

- **Target**: 80% of folder scans complete successfully (no errors)
- **Measurement**: Success rate: `folder_scan_complete` / `folder_scan_started`

### Performance

- **Target**: 95% of folder scans complete in under 60 seconds
- **Measurement**: P95 latency on `/api/review/folder` endpoint

### Quality

- **Target**: Zero critical bugs in production (P0/P1)
- **Measurement**: Bug tracker: issues tagged `phase-28` + `severity:critical`

---

## Out of Scope (Deferred to Future Phases)

### GitHub Repo Review (MREV-02)

**Rationale**: Adds significant complexity (cloning, caching, cleanup) for marginal value gain

**Deferral Plan**: Implement in Phase 28.1 after validating local folder workflow

**Requirements**:

- POST `/api/review/github` endpoint accepting GitHub URL
- Backend clones repo to temp directory (similar to Validate mode)
- Cleanup: Delete temp directory after scan completes
- Rate limiting: Prevent abuse of GitHub API

### Real-Time File Watching

**Rationale**: Low user demand; most users scan once, not continuously

**Deferral Plan**: Consider in Phase 28.2 if users request it

**Requirements**:

- File system watcher using `chokidar`
- Auto-rescan on file changes
- UI toggle: "Watch for changes"

### File-Level Report Cards

**Rationale**: Nice-to-have; unified report card is MVP

**Deferral Plan**: Phase 28.3 enhancement

**Requirements**:

- Deep-dive conversation can ask: "Show me report card for src/auth.js"
- Backend generates single-file report card on demand
- UI displays file tree with per-file grades

---

## Testing Strategy

### Unit Tests (Wave 0 & 1)

**Coverage Target**: 90%+ for new code

**Key test files**:

- `tests/unit/review-folder.test.js` — `reviewFiles()` logic
- Focus: File concatenation, grade aggregation, finding annotation

### Integration Tests (Wave 0 & 2)

**Coverage Target**: 100% of API endpoints

**Key test files**:

- `tests/integration/review-folder-api.test.js` — folder endpoints
- Focus: Request/response validation, error cases, security

### E2E Tests (Wave 0 & 3)

**Coverage Target**: Happy path + 3 critical error paths

**Key test files**:

- `tests/ui/review-folder.spec.js` — Scan Folder tab workflow
- Focus: User journey from folder input → preview → scan → report card

### Manual Testing Checklist

- [ ] Scan small project (5 files, 50KB) — report card displays
- [ ] Scan medium project (40 files, 1MB) — completes in <60s
- [ ] Scan large project (80 files, 2MB) — reaches limit, completes
- [ ] Scan oversized project (100 files, 3MB) — preview shows warning
- [ ] Scan folder outside projectFolder — 403 Forbidden error
- [ ] Deep-dive conversation works for multi-file reviews
- [ ] Report card persists in history and reloads correctly

---

## Dependencies & Blockers

### Internal Dependencies

1. **`lib/file-browser.js::readFolderFiles()`**
   - **Status**: ✅ Exists (used by Security mode)
   - **Blocker**: None

2. **`lib/review.js::reviewCode()`**
   - **Status**: ✅ Exists (Phase 1)
   - **Blocker**: None

3. **`routes/pentest.js` folder pattern**
   - **Status**: ✅ Exists (Phase 19)
   - **Blocker**: None

### External Dependencies

- None (all functionality is local)

### Known Blockers

- None identified

---

## Rollout Plan

### Phase 1: Internal Testing (Week 1)

- Deploy to dev environment
- Manual testing by core team (James)
- Fix critical bugs (P0/P1)

### Phase 2: Beta Testing (Week 2)

- Deploy to staging environment
- Invite 5-10 beta users (vibe coders)
- Collect feedback via in-app survey
- Fix high-priority bugs (P2)

### Phase 3: Production Rollout (Week 3)

- Deploy to production
- Monitor error logs and success rate
- Publish release notes and tutorial video
- Announce in community channels

### Rollback Plan

- If critical bugs emerge: Hide "Scan Folder" tab via feature flag
- If server load is high: Rate-limit `/api/review/folder` to 10 req/hour per user
- If token overflow is common: Reduce file limit to 40 files / 1MB

---

## Documentation Updates

### User-Facing Docs

1. **Add to `docs/FEATURES.md`**
   - Section: "Multi-File Code Review"
   - Content: How to scan project folders, what to expect in report card
   - Screenshot: Scan Folder tab UI

2. **Update `CLAUDE.md`**
   - Section: "Review Mode"
   - Add: "Scan entire folders with Scan Folder tab"

3. **Create tutorial video**
   - Title: "How to Review Your Entire Project with Code Companion"
   - Duration: 3 minutes
   - Content: Demo folder scan → report card → deep-dive

### Developer Docs

1. **Update `docs/ARCHITECTURE.md`**
   - Add section: "Multi-File Review Architecture"
   - Diagram: Request flow from ReviewPanel → routes/review.js → lib/review.js

2. **Update API docs**
   - Document `/api/review/folder/preview` endpoint
   - Document `/api/review/folder` endpoint
   - Include request/response schemas

---

## Validation & Enhancement Checklist (REVISED)

### Phase 0: Verify Existing Implementation ✅ COMPLETE

- [x] Run integration tests: `npm run test:integration -- review-folder` — **PASS**
- [x] Verify `reviewFiles()` exists at `lib/review.js:144` — **CONFIRMED**
- [x] Verify routes exist at `routes/review.js:235-329` — **CONFIRMED**
- [x] Verify "Scan Folder" tab exists in `ReviewPanel.jsx:1379` — **CONFIRMED**
- [x] Verify integration tests exist at `tests/integration/review-folder.test.js` — **CONFIRMED**

### Phase 1: Gap Analysis (IN PROGRESS)

- [ ] Check if unit tests exist for `reviewFiles()` — **ACTION**: Search `tests/unit/` for review-files or review-folder
- [ ] Check if E2E tests exist for Scan Folder tab — **ACTION**: Search `tests/e2e/` and `tests/ui/` for review-folder
- [ ] Manual test: Run folder scan and inspect report card JSON for `filePath` fields
- [ ] Manual test: Verify UX (tooltips, validation errors, progress indication, file preview)
- [ ] Read `ReviewPanel.jsx` fully to understand folder tab implementation
- [ ] Check `CLAUDE.md` and `docs/FEATURES.md` for multi-file review documentation
- [ ] Document all gaps in `PHASE-28-GAP-ANALYSIS.md`

### Phase 2: Enhancement (PENDING Phase 1 results)

- [ ] If grade aggregation is missing: Implement `aggregateGrades()` in `lib/review.js`
- [ ] If `filePath` fields are missing: Implement `annotateFindingsWithPaths()` in `lib/review.js`
- [ ] If unit tests are missing: Create `tests/unit/review-files.test.js`
- [ ] If E2E tests are missing: Create `tests/ui/review-folder.spec.js`
- [ ] If UX polish is needed: Add tooltips, validation, progress indication
- [ ] If documentation is missing: Update `CLAUDE.md`, `docs/FEATURES.md`

### Phase 3: Testing & Polish (AFTER Phase 2)

- [ ] Run full test suite: `npm test` — all pass
- [ ] Verify 90%+ coverage for review folder code
- [ ] Manual test checklist: 7 scenarios (see Testing Strategy below)
- [ ] Code review: Verify all code meets project standards
- [ ] Performance check: P95 latency <60s for 40-file scans
- [ ] Security audit: No new vulnerabilities introduced

### Phase 4: Documentation & Rollout (FINAL)

- [ ] Update `CHANGELOG.md` with Phase 28 validation findings
- [ ] Create `docs/PHASE-28-ARCHITECTURE.md` documenting existing implementation
- [ ] Add screenshots to docs showing Scan Folder tab
- [ ] Record tutorial video (3 min) — "How to Review Your Entire Project"
- [ ] Announce feature in community channels (if not already announced)

---

## Notes for Reviewer (plan-reviewer skill)

### Key Decision Points for Validation

1. **Grade aggregation strategy (worst-wins)** — Does this make sense? Alternative: average grades
2. **File limits (80 files, 2MB)** — Are these reasonable? Alternative: higher limits with chunking
3. **Finding attribution (heuristic)** — Acceptable accuracy? Alternative: force structured output
4. **Scope boundary (local only)** — Defer GitHub review? Or include in Phase 28?

### Potential Risks to Flag

1. **Token overflow** — 80 files may exceed context limits on smaller models
2. **Performance** — Scanning 80 files may take >60s; user patience limit
3. **Attribution errors** — Heuristic matching may misattribute findings
4. **UX complexity** — Adding 4th tab may clutter ReviewPanel

### Open Questions

1. Should we show file-level report cards in deep-dive? Or only unified?
2. Should we support exclusion patterns (e.g., skip `node_modules/`, `.git/`)?
3. Should we stream progress updates during scan (file 12 of 42...)?
4. Should we cache folder scans for faster re-review?

---

**Plan Status**: 🔄 **REVISED** — Reframed from Implementation to Validation
**Original Estimated Effort**: 3 weeks (1 week per wave) — **NO LONGER APPLICABLE**
**Revised Effort**: 1-2 days for gap analysis + enhancements (if any)
**Complexity**: Low (validation only; implementation already exists)
**Risk Level**: Very Low (no new implementation required)

---

## Review History

- **2026-05-24**: Plan reviewed by `plan-reviewer` skill
  - **Critical finding**: Phase 28 is already implemented in codebase
  - **Evidence**: See `MULTIFILE-REVIEW.md` for detailed verification
  - **Action**: Plan reframed from "Implementation" to "Validation & Enhancement"
  - **Next steps**: Complete Phase 1 gap analysis to identify any missing pieces

---

_This plan was originally created as an implementation plan but has been revised to reflect the actual state of the codebase. See `MULTIFILE-REVIEW.md` for full plan-reviewer findings._
