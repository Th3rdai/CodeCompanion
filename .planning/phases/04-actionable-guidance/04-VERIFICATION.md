---
phase: 04-actionable-guidance
verified: 2026-03-14T18:00:00Z
status: passed
score: 10/10 must-haves verified
gaps: []
human_verification:
  - test: "Copy individual fix prompt from a FindingCard"
    expected: "Button text changes to 'Copied! Paste into your AI tool' for ~3 seconds, then reverts. Text is in clipboard."
    why_human: "Clipboard API and animated state change cannot be verified programmatically without a browser."
  - test: "Copy All Fix Prompts from the report card header"
    expected: "Numbered list sorted by severity copied to clipboard. Button text changes to 'Copied! Paste into your AI tool'."
    why_human: "Clipboard write and transient UI state require browser interaction."
  - test: "Select a weak model (e.g. llama3.2:3b) and open Review mode"
    expected: "Amber warning banner appears with tier-appropriate message and 'Switch' button suggesting a stronger installed model."
    why_human: "Requires Ollama running with multiple models installed to confirm suggestion logic end-to-end."
  - test: "Submit a review with a weak model that returns all-A grades"
    expected: "Post-review suspicion banner appears below the report card with 'Try it' button to switch model."
    why_human: "Requires weak model producing suspiciously good output, which depends on Ollama runtime."
  - test: "Reopen a saved review from sidebar"
    expected: "Full report card renders. Any prior deep-dive conversation messages are restored."
    why_human: "Requires actual saved history files with deepDiveMessages populated."
---

# Phase 4: Actionable Guidance Verification Report

**Phase Goal:** Reviews become reusable and actionable — every finding has a copy-pasteable prompt for the user's AI tool, past reviews are saved, and the app warns when a model may produce poor results
**Verified:** 2026-03-14T18:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Success Criteria (from ROADMAP.md)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Each finding includes a "What to ask your AI to fix" copy-pasteable prompt | VERIFIED | `FindingCard` in `ReportCard.jsx` renders a FixPromptBlock for every finding (line 113-129). Fallback generated from `title+explanation` when LLM omits `fixPrompt`. |
| 2 | Completed reviews are saved and can be revisited with full report card intact | VERIFIED | `handleSaveReview` in `App.jsx` persists `reportData`, `deepDiveMessages` restored from `conv.reviewData.deepDiveMessages` on load (lines 166-170). `handleUpdateReviewDeepDive` incrementally saves deep-dive messages. |
| 3 | When a small model is selected, a gentle warning appears before review starts | VERIFIED | `showModelWarning = modelTier === 'weak' \|\| modelTier === 'adequate'` renders amber banner with tier-specific message and optional "Switch" button in the input phase (lines 789-813 of ReviewPanel). |

---

### Observable Truths — Plan 01 (REVW-06)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Each review finding displays a "What to ask your AI to fix" copy-pasteable prompt | VERIFIED | FixPromptBlock renders in `FindingCard` (expanded state). Shows `finding.fixPrompt` or fallback string. Label: "What to ask your AI to fix" with `Clipboard` Lucide icon. |
| 2 | User can copy an individual fix prompt with one click | VERIFIED | `CopyFixButton` with `navigator.clipboard.writeText(text)` on click. Shows `toastMessage` in copied state ("Copied! Paste into your AI tool"). |
| 3 | User can copy all fix prompts as a numbered list with one click | VERIFIED | `buildBulkFixPrompts` aggregates across all categories sorted by severity. "Copy All Fix Prompts" button calls `navigator.clipboard.writeText(bulkPrompts)`. |
| 4 | Copy action shows an action-oriented toast that auto-dismisses in 3-5 seconds | VERIFIED | `CopyFixButton` uses `setTimeout(() => setCopied(false), 3000)`. Toast component now has configurable `duration` prop defaulting to 3000ms. |
| 5 | Fix prompts are natural-language instructions, not code snippets | VERIFIED | LLM prompt instructs: "Write it as a direct request starting with 'Please' or 'In [filename],'". Fallback: "Please fix this issue in my code: ${title}. ${explanation}". |

### Observable Truths — Plan 02 (REVW-10, UX-05)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Completed reviews are auto-saved to history with full report card data | VERIFIED | `onSaveReview?.({reportData, filename, code, model})` called on both structured and fallback review completion (ReviewPanel lines 179, 227). |
| 2 | User can click a saved review in the sidebar to reopen the full report card | VERIFIED | `handleLoadConversation` in App.jsx sets `setSavedReview({...conv.reviewData, deepDiveMessages: ...})`. ReviewPanel `useEffect` on `savedReview` prop restores report state and sets `phase='report'`. |
| 3 | Saved reviews show the overall grade badge in the sidebar | VERIFIED | `lib/history.js` `listConversations()` extracts `overallGrade` from `reviewData.reportData.overallGrade`. Sidebar renders colored grade badge for entries where `h.overallGrade` is truthy (lines 87-95). |
| 4 | Deep-dive conversation messages are saved and restored when reopening a review | VERIFIED | `onUpdateReviewDeepDive` called after each deep-dive response (`sendDeepDiveMessage` finally block, line 350-353). Restoration: `if (savedReview?.deepDiveMessages?.length > 0) setDeepDiveMessages(...)` in useEffect. |
| 5 | When a small/weak model is selected, a warning with 'Switch' button appears before review starts | VERIFIED | Pre-review warning block shows for `modelTier === 'weak' \|\| modelTier === 'adequate'`. "Switch" button calls `onSetSelectedModel?.(suggestedModel.name)`. |
| 6 | After a weak-tier model returns suspiciously good grades, a gentle banner suggests trying a larger model | VERIFIED | `isSuspicious` logic checks: `cleanBillOfHealth === true` OR all-A + every category A OR fewer than 2 total findings. Banner renders below ReportCard when `isSuspicious && suggestedModel`. |
| 7 | User can continue or switch models with one click | VERIFIED | "Switch" button in pre-review warning calls `onSetSelectedModel`. "Try it" button in post-review banner calls `onSetSelectedModel?.(suggestedModel.name); setPhase('input')`. |

**Score:** 10/10 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `lib/review-schema.js` | fixPrompt field in FindingSchema | VERIFIED | Line 15: `fixPrompt: z.string().optional()`. `reportCardJsonSchema` auto-generated includes field. |
| `lib/prompts.js` | LLM instructions to generate fixPrompt | VERIFIED | Line 126 of review system prompt contains full `fixPrompt` instruction with example. |
| `src/components/ReportCard.jsx` | FixPromptBlock UI, CopyAllButton, buildBulkFixPrompts | VERIFIED | All three present. `buildBulkFixPrompts` at line 315. "Copy All Fix Prompts" button at line 368. FixPromptBlock IIFE at lines 113-129. |
| `src/components/Toast.jsx` | Configurable duration prop | VERIFIED | Line 3: `export default function Toast({ message, onDone, duration = 3000 })`. Line 5: `setTimeout(onDone, duration)`. |
| `src/components/ReviewPanel.jsx` | MODEL_TIERS, tier system, warnings, deep-dive persistence | VERIFIED | MODEL_TIERS defined at lines 12-37. Pre-review warning lines 789-813. Post-review suspicion banner lines 487-498. Deep-dive save in finally block lines 350-353. |
| `src/components/Sidebar.jsx` | Grade badge for review history entries | VERIFIED | Lines 87-95 render colored badge using `h.overallGrade`. Color mapping A=emerald, B=lime, C=yellow, D=orange, F=red. |
| `src/App.jsx` | Pass models+setSelectedModel to ReviewPanel, deep-dive save callback | VERIFIED | Lines 510-512: `models={models}`, `onSetSelectedModel={setSelectedModel}`, `onUpdateReviewDeepDive={handleUpdateReviewDeepDive}`. `handleUpdateReviewDeepDive` defined at lines 246-259. |
| `lib/history.js` | overallGrade in listConversations for review entries | VERIFIED | Lines 28-30: extracts `data.reviewData?.reportData?.overallGrade` when `mode === 'review'`. |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/review-schema.js` | `lib/prompts.js` | `fixPrompt` field described in both | VERIFIED | Schema has `fixPrompt: z.string().optional()`. Prompt instructs LLM to generate `fixPrompt`. |
| `lib/prompts.js` | `src/components/ReportCard.jsx` | `finding.fixPrompt` rendered in FindingCard | VERIFIED | `finding.fixPrompt` accessed in FindingCard IIFE at line 114. Fallback also provided. |
| `src/components/ReportCard.jsx` | `navigator.clipboard` | `CopyFixButton` calls `writeText` | VERIFIED | Line 61: `navigator.clipboard.writeText(text)` in click handler. Bulk copy line 371: `await navigator.clipboard.writeText(bulkPrompts)`. |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/components/ReviewPanel.jsx` | `src/App.jsx` | ReviewPanel receives `models`, `setSelectedModel`, `onUpdateReviewDeepDive` | VERIFIED | Props destructured in ReviewPanel (lines 88-91). Passed from App.jsx (lines 510-512). |
| `lib/history.js` | `src/components/Sidebar.jsx` | `listConversations` returns `overallGrade`, Sidebar renders badge | VERIFIED | `listConversations` exposes `overallGrade`. Sidebar `h.overallGrade` renders badge. |
| `src/App.jsx` | `src/components/ReviewPanel.jsx` | `handleLoadConversation` restores `reviewData` with `deepDiveMessages` | VERIFIED | Lines 166-170: `setSavedReview({...conv.reviewData, deepDiveMessages: conv.reviewData.deepDiveMessages \|\| []})`. ReviewPanel useEffect at line 109 restores state. |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| REVW-06 | 04-01-PLAN.md | Each finding includes a "What to ask your AI to fix" copy-pasteable prompt | SATISFIED | End-to-end: schema field, LLM prompt instructions, FindingCard FixPromptBlock, CopyFixButton, Copy All. |
| REVW-10 | 04-02-PLAN.md | Review history saves structured report card data for revisiting past reviews | SATISFIED | `handleSaveReview` saves `reportData`, `handleLoadConversation` restores it. Deep-dive messages also persisted. |
| UX-05 | 04-02-PLAN.md | Model capability warnings — gentle guidance when a small model may give poor review results | SATISFIED | MODEL_TIERS tier system, pre-review amber warning banner, post-review suspicion banner, one-click Switch/Try it. |

All three phase requirements are satisfied. No orphaned requirements found.

---

## Anti-Patterns Found

| File | Lines | Pattern | Severity | Impact |
|------|-------|---------|----------|--------|
| `src/components/ReviewPanel.jsx` | 147-157 | Debug `console.log` block with `=== REVIEW SUBMIT DEBUG ===` | Warning | Not a functional issue. Produces noisy console output in production builds. Does not block goal achievement. |

---

## Human Verification Required

### 1. Copy individual fix prompt

**Test:** Run a code review, expand a finding, click the "Copy Fix" button in the "What to ask your AI to fix" section.
**Expected:** Button text changes to "Copied! Paste into your AI tool" for ~3 seconds, then reverts to "Copy Fix". The copied text is the natural-language fix prompt.
**Why human:** Clipboard API and transient button state require browser interaction.

### 2. Copy All Fix Prompts

**Test:** Complete a code review with at least one finding. Click "Copy All Fix Prompts" in the report card header.
**Expected:** Button shows "Copied! Paste into your AI tool". Clipboard contains a numbered list starting with "Fix these issues in my code:" sorted by severity (critical first).
**Why human:** Clipboard write and button state require browser interaction.

### 3. Weak model warning with Switch button

**Test:** Select a known weak model (e.g. llama3.2:3b or qwen3:4b) in the model selector and switch to Review mode.
**Expected:** Amber warning banner appears: "This model is very small and will likely struggle..." If a stronger model is installed, a "Switch" button suggests it by name. Clicking "Switch" immediately changes the model selector.
**Why human:** Requires Ollama running with multiple models installed, including at least one weak-tier model.

### 4. Post-review suspicion banner

**Test:** Run a code review with a weak model that returns an all-A report card (or very few findings).
**Expected:** Below the report card, an amber banner appears: "For a deeper review, try [stronger model] — larger models catch more subtle issues." Clicking "Try it" resets to input phase with the stronger model selected.
**Why human:** Requires specific runtime behavior from a weak Ollama model.

### 5. Reopen saved review with deep-dive restored

**Test:** Run a review, click into a deep-dive, ask one follow-up question, then navigate away and click the same review in the sidebar.
**Expected:** Report card reopens. The "Saved review" label with History icon appears at the top. Prior deep-dive messages are restored and visible in the conversation.
**Why human:** Requires actual history files on disk with deep-dive messages populated.

---

## Build Status

Production build passes without errors: `npx vite build` completed in 2.98s with no compilation errors.

Schema verification:
- `fixPrompt` present in `reportCardJsonSchema` (node check passed)
- `fixPrompt` present in `REVIEW_SYSTEM_PROMPT` (node check passed)

---

## Gaps Summary

No gaps. All 10 observable truths are verified in the codebase. All 8 required artifacts exist and are substantive. All 6 key links are wired. All 3 phase requirements (REVW-06, REVW-10, UX-05) are satisfied.

One warning-level anti-pattern: debug `console.log` block left in `ReviewPanel.jsx` lines 147-157. This should be removed before production release but does not block phase goal achievement.

Five items require human verification in a running browser with Ollama connected. All automated checks confirm the implementation is structurally complete and wired correctly.

---

_Verified: 2026-03-14T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
