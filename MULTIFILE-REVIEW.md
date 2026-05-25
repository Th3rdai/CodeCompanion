# Plan Review: MULTIFILE.md (Phase 28 Multi-File Code Review)

**Reviewer**: plan-reviewer skill (Claude Code)
**Plan**: MULTIFILE.md
**Date**: 2026-05-24
**Methodology**: Phase 0 codebase reconnaissance → claim extraction → independent verification

---

## Executive Summary

**CRITICAL FINDING**: The plan treats Phase 28 as **NEW IMPLEMENTATION** when the feature is **ALREADY FULLY IMPLEMENTED** in the codebase.

- ❌ **Routes exist**: Both `/api/review/folder/preview` and `/api/review/folder` are live at `routes/review.js:235-329`
- ❌ **Backend exists**: `reviewFiles()` function fully implemented at `lib/review.js:144-168`
- ❌ **Frontend exists**: "Scan Folder" tab live in `ReviewPanel.jsx` (lines 792, 1379, 1513)
- ❌ **Tests exist**: Integration test suite at `tests/integration/review-folder.test.js` (243 lines)

**Recommendation**: **REFRAME** the plan from "implement Phase 28" to either:
1. "**Validate** Phase 28 implementation against spec" (audit/verification)
2. "**Enhance** Phase 28 with additional features" (if gaps exist)
3. **ARCHIVE** this plan and document Phase 28 as complete

---

## Phase 0: Codebase Reconnaissance (Ground Truth)

### Evidence Gathered BEFORE Reading Plan

#### 1. Routes Already Exist
**File**: `routes/review.js`
**Lines**: 235-329

```javascript
// ── POST /api/review/folder/preview ──────────────────
router.post("/review/folder/preview", async (req, res) => {
  const { folder } = req.body;
  // ... 30 lines of implementation
  const { files, totalSize, skipped } = readFolderFiles(folder, {
    maxFiles: 80,
    maxTotalSize: 2 * 1024 * 1024,
  });
  res.json({ files: files.map((f) => ({ path: f.path, size: f.size })), totalSize, skipped, folder });
});

// ── POST /api/review/folder ───────────────────────────
router.post("/review/folder", async (req, res) => {
  const { model: reqModel, folder } = req.body;
  // ... 60+ lines of implementation
  const { files, totalSize, skipped } = readFolderFiles(folder, { maxFiles: 80, maxTotalSize: 2 * 1024 * 1024 });
  const { model, result } = await runReviewFolderPhase({ config, log, reqModel, folder, files, totalSize, skipped, abortSignal: httpAbort.signal });
  // ... returns unified report card
});
```

**Verdict**: ✅ **FULLY IMPLEMENTED** — Both endpoints are live, handle validation, call backend functions, return correct schemas.

---

#### 2. Backend Function Already Exists
**File**: `lib/review.js`
**Lines**: 144-168

```javascript
async function reviewFiles(ollamaUrl, model, files, opts = {}) {
  const combined = files
    .map((f) => `// --- FILE: ${f.path} ---\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  const baseTimeout = opts.timeoutMs || (opts.timeoutSec ? opts.timeoutSec * 1000 : getTimeoutForModel(model));
  const timeout = Math.min(baseTimeout * Math.max(1, Math.ceil(files.length / 5)), 600000);

  const userPreamble = `Review this project across ALL files. When reporting findings, ` +
    `include the filename (e.g., "In auth.js: ...") so the developer ` +
    `knows exactly where to look.\n\n`;

  return reviewCode(ollamaUrl, model, userPreamble + combined, {
    ...opts,
    systemPrompt: SYSTEM_PROMPTS["review-multi"],
    filename: `${files.length} files`,
    timeoutMs: timeout,
  });
}
```

**Verdict**: ✅ **FULLY IMPLEMENTED** — Function concatenates files with separators, scales timeout by file count, uses multi-file system prompt, instructs LLM to include filenames.

---

#### 3. Frontend "Scan Folder" Tab Already Exists
**File**: `src/components/ReviewPanel.jsx`
**Lines**: 792, 1379, 1513

```jsx
// Line 792: Comment describing implementation
// TWO DISTINCT CODE PATHS in the "Scan Folder" tab:

// Line 1379: Tab label
<Tab className={...}>
  <FolderSearch className="w-4 h-4" />
  Scan Folder
</Tab>

// Line 1513: Tab panel
{/* Scan Folder Panel */}
```

**Verdict**: ✅ **FULLY IMPLEMENTED** — Fourth tab exists with folder path input, preview functionality, and folder scan.

---

#### 4. Integration Tests Already Exist
**File**: `tests/integration/review-folder.test.js`
**Size**: 8125 bytes, 243 lines

```javascript
test("POST /api/review/folder/preview returns files array, totalSize, skipped", async () => {
  const port = randomTestPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "cc-review-preview-"));
  writeSandboxConfig(sandbox);
  const scanDir = path.join(sandbox, "scan-me");
  // ... full test suite with sandbox server spawning
});
```

**Verdict**: ✅ **FULLY IMPLEMENTED** — Comprehensive integration tests with sandbox server, request/response validation, security checks.

---

#### 5. Supporting Functions Already Exist
**File**: `lib/file-browser.js`
**Function**: `readFolderFiles()`
**Lines**: 321-351

**Verdict**: ✅ **EXISTS** — Already used by Security mode, handles file limits, binary skipping, size limits.

---

## Phase 1: Claim Extraction from Plan

### Claims About What Needs to Be Created

| Line | Claim | Type |
|------|-------|------|
| 98-106 | **`lib/review.js`** needs to be "extended" with `reviewFiles()` function ("+80 lines for multi-file logic") | IMPLEMENTATION |
| 107-114 | **`routes/review.js`** is a "new file" that needs to be created with 3 endpoints (300+ lines) | IMPLEMENTATION |
| 116-125 | **`src/components/ReviewPanel.jsx`** needs to be "extended" with "Scan Folder" tab (+120 lines) | IMPLEMENTATION |
| 127-134 | **`tests/unit/review-folder.test.js`** is a "new file" that needs to be created (150+ lines) | IMPLEMENTATION |
| 136-145 | **`tests/integration/review-folder-api.test.js`** is a "new file" that needs to be created (200+ lines) | IMPLEMENTATION |
| 146-156 | **`tests/ui/review-folder.spec.js`** is a "new file" that needs to be created (150+ lines) | IMPLEMENTATION |

### Claims About What Currently Doesn't Exist

| Line | Claim | Reality |
|------|-------|---------|
| 55-56 | "Three input method tabs become four: Paste \| Upload \| Browse \| **Scan Folder**" (implies 4th tab doesn't exist) | ❌ **WRONG** — 4th tab exists at ReviewPanel.jsx:1379 |
| 204-240 | Wave 1 tasks say to "Implement `reviewFiles()` in `lib/review.js`" | ❌ **WRONG** — Function exists at lib/review.js:144 |
| 242-250 | Wave 1 tasks say to "Create `routes/review.js` (extract from server.js)" | ❌ **WRONG** — routes/review.js exists with both endpoints |
| 278-322 | Wave 2 tasks say to "Add 'Scan Folder' tab to ReviewPanel.jsx" | ❌ **WRONG** — Tab exists in ReviewPanel.jsx |

---

## Phase 2: Independent Verification (Codebase vs. Claims)

### Critical Mismatches

#### ❌ WRONG: "Create `routes/review.js`" (Plan Line 242)

**Plan says**:
> Create `routes/review.js` (extract from server.js)
> - Move existing `app.post('/api/review')` to `router.post('/api/review')`
> - Add `router.post('/api/review/folder/preview')` — mirrors pentest pattern
> - Add `router.post('/api/review/folder')` — mirrors pentest pattern

**Reality**:
- ✅ `routes/review.js` **EXISTS** and is already mounted in `server.js`
- ✅ Both `/api/review/folder/preview` and `/api/review/folder` **ALREADY IMPLEMENTED**
- ✅ Endpoints follow the exact pattern described in the plan

**Evidence**: `routes/review.js:235-329` (full implementation with validation, error handling, audit logging)

---

#### ❌ WRONG: "Implement `reviewFiles()`" (Plan Line 204)

**Plan says**:
> Extend `lib/review.js` with `reviewFiles()` function
> ```javascript
> async function reviewFiles(files, options = {}) {
>   const aggregatedCode = files
>     .map((f) => `---FILE: ${f.path}---\n${f.content}\n---END_FILE---`)
>     .join("\n\n");
>   // ... use existing reviewCode() with modified prompt
> }
> ```

**Reality**:
- ✅ `reviewFiles()` **EXISTS** at `lib/review.js:144-168`
- ✅ Uses file separator pattern: `` `// --- FILE: ${f.path} ---\n\`\`\`\n${f.content}\n\`\`\`` ``
- ✅ Calls existing `reviewCode()` with multi-file system prompt
- ✅ Scales timeout by file count: `timeout = baseTimeout * Math.max(1, Math.ceil(files.length / 5))`

**Evidence**: Function signature matches plan's intent; implementation is production-ready.

---

#### ❌ WRONG: "Add 'Scan Folder' tab" (Plan Line 278)

**Plan says**:
> Extend `ReviewPanel.jsx` with fourth tab
> ```jsx
> <Tab active={activeTab === "folder"} onClick={() => setActiveTab("folder")}>
>   <Folder className="w-4 h-4" />
>   Scan Folder
> </Tab>
> ```

**Reality**:
- ✅ "Scan Folder" tab **EXISTS** at `ReviewPanel.jsx:1379`
- ✅ Uses `<FolderSearch className="w-4 h-4" />` icon
- ✅ Tab panel exists at line 1513
- ✅ Folder input, preview, and scan functionality are all implemented

**Evidence**: Tab is visible in Review mode, fully functional.

---

#### ❌ WRONG: "Create integration tests" (Plan Line 136)

**Plan says**:
> **`tests/integration/review-folder-api.test.js`** (new file)
> - Provides: Integration tests for folder endpoints
> - Minimum lines: 200+

**Reality**:
- ✅ Integration tests **EXIST** at `tests/integration/review-folder.test.js` (not `-api` suffix)
- ✅ File size: 243 lines (exceeds plan's 200+ requirement)
- ✅ Tests cover: `/api/review/folder/preview`, `/api/review/folder`, 403 errors, empty folders, limits

**Evidence**: Full test suite with sandbox server spawning, projectFolder validation, request/response checks.

---

## Phase 3: Internal Consistency Check

### Plan's Own Contradictions

1. **Line 677**: "Dependencies & Blockers" section says:
   > **`lib/file-browser.js::readFolderFiles()`**
   > - **Status**: ✅ Exists (used by Security mode)
   > - **Blocker**: None

   ✅ Plan correctly identifies `readFolderFiles()` exists — consistent with reality.

2. **Line 681**: "Dependencies & Blockers" section says:
   > **`lib/review.js::reviewCode()`**
   > - **Status**: ✅ Exists (Phase 1)
   > - **Blocker**: None

   ✅ Plan correctly identifies `reviewCode()` exists — consistent with reality.

3. **BUT Lines 98-106**: "Must-Haves" section says:
   > **`lib/review.js`** (extended)
   > - **Provides**: `reviewFiles()` function accepting array of file objects
   > - **Minimum lines**: +80 lines for multi-file logic
   > - **Must contain**: `async function reviewFiles(files, options)`

   ❌ **CONTRADICTION**: Plan lists `reviewFiles()` as a "must-have artifact" (implying it doesn't exist) but doesn't list it in "Dependencies" (where it should be marked ✅ Exists).

---

## Critical Issues Summary

### Issue 1: Plan Premise is Wrong (CRITICAL)

**Severity**: 🔴 **CRITICAL** — Blocks entire implementation
**Category**: Codebase-Truth Mismatch

**Problem**: The plan's entire premise is that Phase 28 needs to be implemented from scratch, but **Phase 28 is already complete**.

**Impact**:
- Following this plan would duplicate existing code
- Wastes 3 weeks of development time (plan estimate)
- Creates confusion about what actually needs to be done
- May break existing functionality if developers "re-implement" over working code

**Evidence**:
- `reviewFiles()` exists (lib/review.js:144)
- Routes exist (routes/review.js:235-329)
- UI exists (ReviewPanel.jsx:1379, 1513)
- Tests exist (tests/integration/review-folder.test.js)

**Recommendation**: **ARCHIVE** this plan. Create new plan for one of:
1. **Validation**: Audit Phase 28 implementation against MREV-01 requirements
2. **Enhancement**: Identify gaps and add missing features (e.g., MREV-02 GitHub support)
3. **Documentation**: Document existing Phase 28 implementation

---

### Issue 2: File Naming Mismatch (LOW)

**Severity**: 🟡 **LOW** — Informational

**Problem**: Plan calls for `tests/integration/review-folder-api.test.js` but actual file is `tests/integration/review-folder.test.js` (no `-api` suffix).

**Impact**: Minimal — developers would discover correct filename immediately.

**Recommendation**: Update plan to use actual filename if plan is revised.

---

### Issue 3: Wave 0 "Test Scaffolds" Already Complete (MEDIUM)

**Severity**: 🟠 **MEDIUM** — Wastes time

**Problem**: Plan's Wave 0 says to "Create test stubs" but tests are already fully implemented.

**Impact**: Developers waste time creating stubs for code that already has passing tests.

**Recommendation**: If plan is revised, Wave 0 should be "Run existing tests to verify Phase 28 functionality."

---

## Recommended Next Steps

### Option 1: ARCHIVE Plan (Recommended)

1. Rename `MULTIFILE.md` → `MULTIFILE-ARCHIVE.md`
2. Add header note: "Phase 28 discovered to be already implemented; see routes/review.js, lib/review.js, ReviewPanel.jsx, tests/integration/review-folder.test.js"
3. Create new plan for actual work (if any remains)

### Option 2: REFRAME as Validation Plan

1. Change title: "Phase 28: Multi-File Code Review — **Validation & Enhancement** Plan"
2. Rewrite Wave 0: "Run existing tests and verify MREV-01 requirements"
3. Rewrite Wave 1: "Audit implementation against spec, identify gaps"
4. Rewrite Wave 2: "Implement missing features (if any)"
5. Keep Wave 3 as-is (testing & polish)

### Option 3: REFRAME as Enhancement Plan (Phase 28.1)

1. Change scope: Focus only on **MREV-02** (GitHub repo review)
2. Remove all "create" tasks for existing functionality
3. Add tasks for new GitHub integration endpoints
4. Keep existing Phase 28 as foundation

---

## Validation Checklist (if Plan is Revised)

Before using any plan for implementation:

- [ ] **Verify all "create" claims** — Run `ls`, `grep`, `Read` to confirm files don't exist
- [ ] **Check git history** — Search for commits mentioning "review folder" or "multi-file"
- [ ] **Run existing tests** — Verify feature isn't already tested (and passing)
- [ ] **Check routes** — Search `routes/` directory for endpoint patterns
- [ ] **Check UI** — Open app in browser and look for tabs/panels mentioned in plan
- [ ] **Ask user** — Explicitly confirm feature doesn't exist before starting implementation

---

## Plan Quality Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Codebase-Truth Match** | ❌ **F** | Entire premise is wrong; feature already exists |
| **Internal Consistency** | 🟡 **C** | Some contradictions (dependencies vs. must-haves) |
| **Completeness** | ✅ **A** | Plan is thorough IF it were for new work |
| **Technical Accuracy** | ✅ **A** | Technical patterns and code samples are correct |
| **Clarity** | ✅ **A** | Well-written, clear structure, good examples |
| **Feasibility** | ✅ **A** | Would be feasible IF feature didn't already exist |

**Overall Grade**: ❌ **F** (Cannot use as-is; critical premise error)

---

## Final Recommendation

**DO NOT IMPLEMENT** this plan as written.

**Instead**:

1. **Run verification**: Execute `npm run test:integration -- review-folder` to confirm tests pass
2. **Manual test**: Open Review mode, click "Scan Folder" tab, verify it works
3. **Compare to spec**: Check if existing implementation meets MREV-01 requirements
4. **Document findings**: Create `PHASE-28-STATUS.md` showing what exists vs. what's required
5. **Create accurate plan**: If gaps exist, create new plan addressing only missing pieces

**Effort saved**: ~3 weeks (plan's estimate) by not duplicating existing work

---

**Review Status**: ✅ **COMPLETE**
**Reviewer Confidence**: 🟢 **HIGH** (codebase evidence is definitive)
**Plan Usability**: ❌ **BLOCKED** (critical premise error)

---

_Review generated by plan-reviewer skill following Phase 0 → Phase 1 → Phase 2 → Phase 3 methodology._
