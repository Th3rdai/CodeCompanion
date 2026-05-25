# Phase 28: Multi-File Code Review — Implementation Plan

---

**Phase**: 28-multi-file-review
**Type**: Feature Extension
**Wave**: 1
**Dependencies**: Phase 1 (Review Engine), Phase 18/19 (Security multi-file patterns)
**Requirements**: MREV-01, MREV-02
**Autonomous**: No

---

## Executive Summary

Extend Review mode to accept multiple files and whole folders, producing a unified report card across a full project rather than single-file reviews. Mirrors Security mode's proven multi-file scanning architecture applied to the existing review engine (`lib/review.js`).

**Core Value**: A vibe coder can point Review mode at their entire project folder and get a single, cohesive report card assessing code quality across all files — bugs, security, readability, completeness — without reviewing files one at a time.

**Implementation Pattern**: Follow Security mode's folder scanning precedent:

- Backend: `reviewFiles()` function + `/api/review/folder/preview` and `/api/review/folder` endpoints
- Frontend: New "Scan Folder" tab in `ReviewPanel.jsx` with folder path input and preview step
- Same safety guardrails: `isWithinBasePath()` validation, file limits (80 files max), size limits (2MB max)

---

## Requirements Coverage

### MREV-01: User can review an entire project folder with aggregated grades

**Acceptance Criteria**:

- ✅ User can select "Scan Folder" tab in Review mode
- ✅ User can enter a local folder path (must be within configured project folder)
- ✅ System shows preview: file count, total size, skipped files
- ✅ User clicks "Review Folder" to start full scan
- ✅ System produces single unified report card with aggregated grades across all files
- ✅ Report card shows same A-F color-coded grades (bugs, security, readability, completeness)
- ✅ Top priority reflects most critical issue across entire project
- ✅ Findings grouped by category, with file path annotations
- ✅ User can click into conversational deep-dive about any category

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

### Artifacts (Files that MUST exist with specified characteristics)

1. **`lib/review.js`** (extended)
   - **Provides**: `reviewFiles()` function accepting array of file objects
   - **Minimum lines**: +80 lines for multi-file logic
   - **Must contain**: `async function reviewFiles(files, options)`
   - **Aggregation logic**:
     - Concatenates all file contents with separator: `---FILE: path---\n(content)\n---END_FILE---`
     - Sends to existing review prompt with instruction: "Review all files as a unified codebase"
     - Worst grade per category becomes overall category grade (e.g., if 3 files get A/B/D in bugs → bugs grade = D)

2. **`routes/review.js`** (new file, extracted from server.js)
   - **Provides**: Review endpoints in dedicated Express router
   - **Minimum lines**: 300+
   - **Must contain**:
     - `router.post('/api/review')` — existing single-file endpoint (moved from server.js)
     - `router.post('/api/review/folder/preview')` — file discovery preview
     - `router.post('/api/review/folder')` — full folder scan
   - **Pattern**: Mirror `routes/pentest.js` structure exactly

3. **`src/components/ReviewPanel.jsx`** (extended)
   - **Provides**: "Scan Folder" tab UI with folder input and preview
   - **Minimum lines**: +120 lines for folder tab
   - **Must contain**:
     - Fourth tab: `<Tab>Scan Folder</Tab>`
     - Folder path input with validation
     - "Preview" button triggering `/api/review/folder/preview`
     - Preview results display: file count, size, skipped
     - "Review Folder" button triggering `/api/review/folder`
     - Loading state during folder scan

4. **`tests/unit/review-folder.test.js`** (new file)
   - **Provides**: Unit tests for `reviewFiles()` multi-file logic
   - **Minimum lines**: 150+
   - **Must test**:
     - File concatenation with separators
     - Grade aggregation (worst grade wins)
     - File path annotation in findings
     - Limit enforcement (80 files, 2MB)

5. **`tests/integration/review-folder-api.test.js`** (new file)
   - **Provides**: Integration tests for folder endpoints
   - **Minimum lines**: 200+
   - **Must test**:
     - `/api/review/folder/preview` returns file list
     - `/api/review/folder` returns unified report card
     - 403 for paths outside projectFolder
     - 400 for empty folders
     - File limit enforcement

6. **`tests/ui/review-folder.spec.js`** (new file)
   - **Provides**: Playwright E2E tests for Scan Folder tab
   - **Minimum lines**: 150+
   - **Must test**:
     - Scan Folder tab is visible and clickable
     - Folder path input accepts text
     - Preview button triggers file discovery
     - Preview results display correctly
     - Review Folder button triggers scan
     - Report card displays after scan

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

## Implementation Phases (Wave Breakdown)

### Wave 0: Test Scaffolds (Nyquist Validation)

**Purpose**: Stub out all test files before implementation to validate coverage

**Tasks**:

1. Create `tests/unit/review-folder.test.js` with describe/it stubs
2. Create `tests/integration/review-folder-api.test.js` with describe/it stubs
3. Create `tests/ui/review-folder.spec.js` with test.describe/test stubs
4. Run `npm test` — all stubs should be marked pending (not fail)

**Validation**: Running tests shows 15+ pending tests across 3 files

---

### Wave 1: Backend — Multi-File Review Logic

**Objective**: Implement `reviewFiles()` in `lib/review.js` + folder routes

**Tasks**:

1. **Extend `lib/review.js`** with `reviewFiles()` function

   ```javascript
   async function reviewFiles(files, options = {}) {
     const { config, log, reqModel, abortSignal } = options;

     // Concatenate all file contents with separators
     const aggregatedCode = files
       .map((f) => `---FILE: ${f.path}---\n${f.content}\n---END_FILE---`)
       .join("\n\n");

     // Use existing reviewCode() with modified prompt
     const systemPrompt = buildReviewPrompt({
       mode: "multi-file",
       fileCount: files.length,
       totalSize: files.reduce((sum, f) => sum + f.size, 0),
     });

     const result = await reviewCode(aggregatedCode, {
       config,
       log,
       reqModel,
       systemPrompt,
       abortSignal,
     });

     // Annotate findings with file paths
     if (result.type === "report-card") {
       result.data.categories = annotateFindingsWithPaths(
         result.data.categories,
         files,
       );
     }

     return result;
   }
   ```

2. **Create `routes/review.js`** (extract from server.js)
   - Move existing `app.post('/api/review')` to `router.post('/api/review')`
   - Add `router.post('/api/review/folder/preview')` — mirrors pentest pattern
   - Add `router.post('/api/review/folder')` — mirrors pentest pattern
   - Export router: `module.exports = function createRouter(appContext) { ... }`

3. **Update `server.js`**
   - Replace inline `/api/review` endpoint with: `app.use(require('./routes/review')({ log }))`
   - Pattern: same as `app.use(require('./routes/pentest')({ log }))`

4. **Implement grade aggregation logic**
   - Function: `aggregateGrades(categories)` in `lib/review.js`
   - Logic: For each category (bugs, security, readability, completeness), find worst grade across all files
   - Example: If bugs grades are [A, B, D] → bugs category grade = D
   - Letter-to-number conversion: A=5, B=4, C=3, D=2, F=1

5. **Implement finding annotation**
   - Function: `annotateFindingsWithPaths(categories, files)` in `lib/review.js`
   - Parse findings text to extract line references
   - Match against file paths using heuristics (file name mentions, line numbers)
   - Add `filePath` field to each finding object

**Validation**:

- Unit tests pass: `npm run test:unit -- review-folder.test.js`
- Manual curl test: `curl -X POST http://localhost:8903/api/review/folder/preview -d '{"folder":"/path/to/project"}'` returns file list
- Manual curl test: `curl -X POST http://localhost:8903/api/review/folder -d '{"model":"llama3.2","folder":"/path/to/project"}'` returns unified report card

---

### Wave 2: Frontend — Scan Folder Tab UI

**Objective**: Add "Scan Folder" tab to ReviewPanel with folder input and preview

**Tasks**:

1. **Extend `ReviewPanel.jsx`** with fourth tab

   ```jsx
   const [activeTab, setActiveTab] = useState("paste"); // 'paste' | 'upload' | 'browse' | 'folder'

   // Add folder scan state
   const [folderPath, setFolderPath] = useState("");
   const [folderPreview, setFolderPreview] = useState(null);
   const [isPreviewingFolder, setIsPreviewingFolder] = useState(false);
   const [isScanningFolder, setIsScanningFolder] = useState(false);

   // Tab buttons
   <Tab active={activeTab === "folder"} onClick={() => setActiveTab("folder")}>
     <Folder className="w-4 h-4" />
     Scan Folder
   </Tab>;

   // Folder tab content
   {
     activeTab === "folder" && (
       <div className="folder-scan-tab">
         <input
           type="text"
           placeholder="Enter folder path..."
           value={folderPath}
           onChange={(e) => setFolderPath(e.target.value)}
         />
         <button onClick={handlePreviewFolder}>Preview Files</button>

         {folderPreview && (
           <div className="folder-preview">
             <p>
               Found {folderPreview.files.length} files (
               {formatBytes(folderPreview.totalSize)})
             </p>
             {folderPreview.skipped > 0 && (
               <p>{folderPreview.skipped} files skipped</p>
             )}
             <button onClick={handleReviewFolder}>Review Folder</button>
           </div>
         )}
       </div>
     );
   }
   ```

2. **Implement folder preview handler**

   ```javascript
   const handlePreviewFolder = async () => {
     setIsPreviewingFolder(true);
     try {
       const res = await fetch("/api/review/folder/preview", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ folder: folderPath }),
       });

       if (!res.ok) {
         const err = await res.json();
         throw new Error(err.error || "Preview failed");
       }

       const preview = await res.json();
       setFolderPreview(preview);
     } catch (err) {
       alert(err.message);
     } finally {
       setIsPreviewingFolder(false);
     }
   };
   ```

3. **Implement folder review handler**

   ```javascript
   const handleReviewFolder = async () => {
     setIsScanningFolder(true);
     setIsReviewing(true); // Trigger loading animation

     try {
       const res = await fetch("/api/review/folder", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           model: selectedModel,
           folder: folderPath,
         }),
       });

       if (!res.ok) {
         const err = await res.json();
         throw new Error(err.error || "Review failed");
       }

       const result = await res.json();

       if (result.type === "report-card") {
         setReportData(result);
         setShowReport(true);
       }
     } catch (err) {
       setReviewError(err.message);
     } finally {
       setIsScanningFolder(false);
       setIsReviewing(false);
     }
   };
   ```

4. **Update `LoadingAnimation.jsx` for folder scans**
   - Add prop: `fileCount` (number of files being reviewed)
   - Display message: "Reviewing 42 files..." when fileCount > 1
   - Same animation, just different text

5. **Update `ReportCard.jsx` to show file annotations**
   - If finding has `filePath` field, display it above finding text
   - Example: `<span className="file-badge">src/auth.js:42</span>`
   - Use monospace font for file paths

**Validation**:

- UI renders Scan Folder tab correctly
- Folder path input accepts text
- Preview button shows file discovery results
- Review Folder button triggers scan and displays report card
- Report card shows file path annotations

---

### Wave 3: Testing & Polish

**Objective**: Complete test coverage and polish UX

**Tasks**:

1. **Complete unit tests** (`tests/unit/review-folder.test.js`)
   - Test file concatenation with separators
   - Test grade aggregation (worst grade wins)
   - Test finding annotation with file paths
   - Test limit enforcement (80 files, 2MB)

2. **Complete integration tests** (`tests/integration/review-folder-api.test.js`)
   - Test `/api/review/folder/preview` success case
   - Test `/api/review/folder` success case
   - Test 403 for paths outside projectFolder
   - Test 400 for empty folders
   - Test 400 for exceeding file/size limits

3. **Complete E2E tests** (`tests/ui/review-folder.spec.js`)
   - Test Scan Folder tab visibility
   - Test folder path input
   - Test preview button and results
   - Test Review Folder button
   - Test report card display with file annotations
   - Test deep-dive conversation works for multi-file reviews

4. **Polish UX**
   - Add tooltips: "Scan entire project folder" on Scan Folder tab
   - Add validation: Show error if folder path is empty
   - Add progress indication: Show file count during scan (e.g., "Reviewing file 12 of 42...")
   - Add file tree preview: Optionally show file list before scan (collapsible)

5. **Update documentation**
   - Add section to `CLAUDE.md` explaining multi-file review
   - Update `docs/FEATURES.md` with Scan Folder capability
   - Add screenshot of Scan Folder tab to docs

**Validation**:

- All tests pass: `npm test`
- UI is polished and intuitive
- Documentation is updated

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

## Implementation Checklist

### Wave 0: Test Scaffolds

- [ ] Create `tests/unit/review-folder.test.js` with 5+ stubs
- [ ] Create `tests/integration/review-folder-api.test.js` with 7+ stubs
- [ ] Create `tests/ui/review-folder.spec.js` with 5+ stubs
- [ ] Run `npm test` — verify all pending (not failing)

### Wave 1: Backend

- [ ] Implement `reviewFiles()` in `lib/review.js`
- [ ] Implement `aggregateGrades()` in `lib/review.js`
- [ ] Implement `annotateFindingsWithPaths()` in `lib/review.js`
- [ ] Create `routes/review.js` with 3 endpoints
- [ ] Update `server.js` to use review router
- [ ] Test with curl: preview endpoint returns file list
- [ ] Test with curl: folder endpoint returns report card
- [ ] Unit tests pass: `npm run test:unit -- review-folder`

### Wave 2: Frontend

- [ ] Add "Scan Folder" tab to `ReviewPanel.jsx`
- [ ] Implement folder path input and validation
- [ ] Implement preview button and handler
- [ ] Implement review button and handler
- [ ] Update `LoadingAnimation.jsx` for multi-file messaging
- [ ] Update `ReportCard.jsx` to show file path annotations
- [ ] Manual test: Scan Folder tab renders and works end-to-end

### Wave 3: Testing & Polish

- [ ] Complete all unit tests (90%+ coverage)
- [ ] Complete all integration tests (100% endpoint coverage)
- [ ] Complete all E2E tests (happy path + 3 error paths)
- [ ] Run full test suite: `npm test` — all pass
- [ ] Polish UX: tooltips, validation, progress indication
- [ ] Update documentation: CLAUDE.md, FEATURES.md
- [ ] Record tutorial video (3 min)

### Final Validation

- [ ] Manual test checklist: 7 scenarios (see Testing Strategy)
- [ ] Code review: All code meets project standards
- [ ] Performance check: P95 latency <60s for 40-file scans
- [ ] Security audit: No new vulnerabilities introduced
- [ ] Deploy to staging: Beta test with 5-10 users
- [ ] Production deploy: Gradual rollout with monitoring

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

**Plan Status**: ✅ Ready for Review
**Estimated Effort**: 3 weeks (1 week per wave)
**Complexity**: Medium (mirrors existing patterns)
**Risk Level**: Low-Medium (well-understood domain)

---

_This plan follows Code Companion's established phase planning format. Review with `plan-reviewer` skill in Cursor for validation before implementation._
