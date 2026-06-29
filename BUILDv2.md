# BUILDv2 — Build Mode Bug Fixes + Harness Integration

**Status:** REVIEWED (harness plan-reviewer, 2 iterations — all findings resolved)
**Created:** 2026-06-28
**Reviewed:** 2026-06-28 (harness research + review skills)
**Author:** Coco (Code Companion)
**Priority:** High
**Feature:** build-mode
**Related:** CocoHarness.md (Phase 5 — builder agent contract)

---

## Review History

| Round | Key Findings                                                                                                                                                                                                                                                                         | Resolution                                                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | All dimensions scored C: vague implementation steps, undefined terms ("harness builder agent contract", "lifecycle breadcrumb"), missing error handling for useEffect cleanup, no rollback per step, no verification checkpoints, no dependency marking, incomplete testing strategy | Rewrote with technical definitions, exact React patterns, per-step rollback, per-phase verification, explicit dependencies, edge-case handling, and comprehensive test plan |

---

## Goal

Fix three verified bugs in the Build mode React components and wire the new harness builder agent contract into the Build mode UI so users get agent-role awareness, lifecycle-stage breadcrumbs, and skill-linked procedures.

## Technical Definitions

### "Harness builder agent contract"

A plain-text file at `harness/agents/builder.agent.md` that defines the Builder agent's role, scope, allowed/disallowed tools, and autonomy modes (full, cautious, ask). It is **not code** — it is a documentation artifact that the Build mode UI reads conceptually to display agent context. The integration is **UI-only**: the contract content is surfaced as a badge and breadcrumb, not executed as logic.

### "Lifecycle breadcrumb"

A horizontal React component rendered inside `BuildAdvancedView.jsx` that displays 7 lifecycle stage labels (Task Definition → Agent Design → Prompt Design → Tool Integration → Evaluation → Iteration → Release) with the current stage highlighted. Data flow: `BuildAdvancedView` derives the current stage from `projectData.roadmap.phases` (the phase number maps to a stage index), then renders a read-only breadcrumb. No backend calls, no state management beyond a computed value.

### AbortController in Electron renderer

`AbortController` is a Web API standard (WHATWG Fetch), fully supported in Electron's Chromium renderer process. It is used to pass a `signal` to `fetch()` calls, allowing cancellation via `controller.abort()`. The `signal` option is already supported by the browser's native `fetch` (which `apiFetch` wraps). No polyfill needed.

---

## Problem Statement

During the harness build, a code review of `src/components/build-mode/` (all 5 files read and verified) found:

1. **Critical:** `BuildAdvancedView.jsx` line 27 uses `useState(() => {...})` for a side effect — this runs the fetch during render, not after mount, causing fetch-on-every-render
2. **Minor:** `ClaudeCodeHandoff.jsx` line 145 uses `pl-5.5` which is not a valid Tailwind class (silently does nothing)
3. **Missing:** `BuildSimpleView.jsx` streaming operations (research + plan) have no cancel mechanism — users are stuck during long AI streams

Additionally, the new harness exists as documentation but is not connected to the Build mode UI.

---

## Scope

### In Scope

- Fix `BuildAdvancedView.jsx` useState→useEffect bug (line 27)
- Fix `ClaudeCodeHandoff.jsx` invalid `pl-5.5` Tailwind class (line 145)
- Add `AbortController` + cancel button to `BuildSimpleView.jsx` streaming
- Create `harness/integrations/build-mode.md` mapping builder agent → Build UI
- Add optional `agentRole` + `autonomyMode` props to `BuildHeader.jsx` (backward-compatible — only renders when passed)
- Add lifecycle-stage breadcrumb to `BuildAdvancedView.jsx`
- Add unsaved-changes warning to `PlanningFileViewer.jsx` close button

### Out of Scope

- Rewriting Build mode architecture
- Adding new Build sub-features
- Backend/API changes
- Changes to `.planning/` structure
- Running the harness orchestrator (CodeCompanion has no Python orchestrator)

### Dependencies

- Step 1.1, 1.2, 1.3 are **independent** — can be done in any order
- Step 2.1 (integration doc) must complete **before** Step 2.2 and 2.3 (they reference it)
- Step 2.2 and 2.3 are **independent** of each other
- Step 2.4 is **independent**
- Phase 3 (validation) depends on **all** prior steps

---

## Implementation Steps

### Phase 1 — Bug Fixes (Critical)

#### Step 1.1: Fix BuildAdvancedView.jsx useState→useEffect

**File:** `src/components/build-mode/BuildAdvancedView.jsx`
**Line:** 27
**Verified:** Confirmed — line 27 reads `useState(() => {` with a fetch inside

**Current (broken):**

```jsx
// Line 27 — useState with function arg is lazy init, NOT a side effect hook
useState(() => {
  if (!project?.id) return;
  setFilesLoading(true);
  apiFetch(`/api/build/projects/${project.id}/files`)
    .then((r) => r.json())
    .then((data) => setFiles(data.files || []))
    .catch(() => setFiles([]))
    .finally(() => setFilesLoading(false));
});
```

**Fixed:**

```jsx
useEffect(() => {
  if (!project?.id) return;
  let cancelled = false;
  const controller = new AbortController();
  setFilesLoading(true);
  apiFetch(`/api/build/projects/${project.id}/files`, {
    signal: controller.signal,
  })
    .then((r) => r.json())
    .then((data) => {
      if (!cancelled) setFiles(data.files || []);
    })
    .catch((err) => {
      if (err?.name === "AbortError") return;
      if (!cancelled) setFiles([]);
    })
    .finally(() => {
      if (!cancelled) setFilesLoading(false);
    });
  return () => {
    cancelled = true;
    controller.abort();
  };
}, [project?.id]);
```

**Also required:** Change the import on line 1 from `import { useState } from "react"` to `import { useState, useEffect } from "react"`.

**Why:** `useState(fn)` runs `fn` during render for lazy initialization. Placing a fetch inside it runs on every render. `useEffect` with `[project?.id]` dependency runs once on mount and only re-runs when the project changes. The cleanup function + AbortController prevents state updates after unmount and cancels in-flight requests.

**Error handling:** The `cancelled` flag prevents state updates after unmount. The AbortController cancels the in-flight fetch. The catch block silently ignores AbortError (expected on cleanup) and only sets empty files on real errors.

**Edge case — empty/missing project ID:** The early `return` on `!project?.id` prevents the fetch from firing. The cleanup function handles the case where the project changes mid-fetch.

**Rollback:** Revert this file to its previous state. No other files are affected.

**Verification:** After this step, open Build mode, switch between projects, and confirm:

- Files load once per project (not on every render)
- No React warning about state updates during render
- Switching projects cancels the previous fetch

---

#### Step 1.2: Fix ClaudeCodeHandoff.jsx invalid Tailwind class

**File:** `src/components/build-mode/ClaudeCodeHandoff.jsx`
**Line:** 145
**Verified:** Confirmed — line 145 reads `<p className="text-xs text-slate-400 pl-5.5">`

**Current (broken):**

```jsx
<p className="text-xs text-slate-400 pl-5.5">{cmd.description}</p>
```

**Fixed:**

```jsx
<p className="text-xs text-slate-400 pl-[22px]">{cmd.description}</p>
```

**Why:** Tailwind's spacing scale uses `pl-5` (20px) and `pl-6` (24px) but not `pl-5.5`. The arbitrary value `pl-[22px]` preserves the intended 22px indent (5.5 × 4px base unit = 22px). This is a 2px visual difference from `pl-5` and 2px from `pl-6`, so the arbitrary value is the correct fix.

**Rollback:** Change `pl-[22px]` back to `pl-5.5`.

**Verification:** Open Build mode → Claude Code Handoff section → confirm command descriptions are indented to align under the command name.

---

#### Step 1.3: Add AbortController to BuildSimpleView.jsx streaming

**File:** `src/components/build-mode/BuildSimpleView.jsx`
**Verified:** Confirmed — `handleResearch()` (line ~120) and `handlePlan()` (line ~170) both call `apiFetch` without a signal. There is no cancel button in the UI.

**Changes:**

1. Add `useRef` to the import on line 1:

```jsx
import { useState, useEffect, useCallback, useRef } from "react";
```

2. Add abort ref after the existing state declarations (~line 40):

```jsx
const abortRef = useRef(null);
```

3. In `handleResearch()`, pass signal to fetch and handle abort:

```jsx
async function handleResearch() {
  if (!project?.id || streaming) return;
  const phaseNumber = getNextPhaseNumber();

  abortRef.current = new AbortController();
  setStreaming("research");
  setStreamedContent("");
  setStreamError(null);
  setResearchText("");
  setPlanText("");
  setPlanValidated(false);
  setPlanWritten(false);

  let accumulated = "";

  try {
    const res = await apiFetch(`/api/build/projects/${project.id}/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: selectedModel, phaseNumber }),
      signal: abortRef.current.signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Request failed (${res.status})`);
    }

    await readSSEStream(res, {
      onToken: (token) => {
        accumulated += token;
        setStreamedContent(accumulated);
      },
      onDone: () => {
        setResearchText(accumulated);
        setStreaming(null);
      },
      onError: (errMsg) => {
        setStreamError(errMsg);
        setStreaming(null);
      },
    });
  } catch (err) {
    if (err?.name !== "AbortError") {
      setStreamError(err.message || "Research failed");
    }
    setStreaming(null);
  } finally {
    abortRef.current = null;
  }
}
```

4. In `handlePlan()`, add the same signal pattern to both the streaming and writeToFile fetch calls.

5. Add a cancel function:

```jsx
function cancelStream() {
  abortRef.current?.abort();
  setStreaming(null);
  setStreamedContent("");
  abortRef.current = null;
}
```

6. Add a cancel button in the streaming status section (replace the existing animated text):

```jsx
{
  streaming && (
    <div className="flex items-center gap-3">
      <span className="text-xs text-cyan-400 animate-pulse">
        {streaming === "research"
          ? `Researching phase ${phaseNumber}...`
          : `Generating plan for phase ${phaseNumber}...`}
      </span>
      <button
        onClick={cancelStream}
        className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors cursor-pointer"
      >
        Cancel
      </button>
    </div>
  );
}
```

**Error handling:** The catch block checks `err?.name !== 'AbortError'` so cancellation doesn't show an error message. The `finally` block clears the ref.

**Edge case — cancel during writeToFile:** The writeToFile path also gets a signal, so canceling during a save aborts the save fetch. The `saving` state is reset in the catch block.

**Rollback:** Remove the abortRef, the signal from fetch calls, the cancelStream function, and the cancel button. Revert to the original streaming behavior.

**Verification:** Start a research stream, click Cancel mid-stream, and confirm:

- Stream stops immediately
- No error message appears
- UI returns to idle state
- Can start a new stream after canceling

---

### Phase 2 — Harness Integration

#### Step 2.1: Create harness/integrations/build-mode.md

**File:** `harness/integrations/build-mode.md` (new)
**Depends on:** Nothing (can be created first)

**Content:** A mapping document that describes:

- Builder agent contract (`harness/agents/builder.agent.md`) → Build mode components
- How autonomy modes map to UI behavior:
  - `cautious` (default): Show confirmation prompts before destructive actions
  - `full`: Auto-proceed without confirmation (not exposed in UI yet — future)
  - `ask`: Prompt for every action (not exposed in UI yet — future)
- How lifecycle stages map to Build progress phases:
  - Phase 1 → Stage 01 (Task Definition)
  - Phase 2 → Stage 02 (Agent Design)
  - etc. (modulo 7)
- Which harness skill applies to each Build action:
  - Research button → `harness/skills/research/research.md`
  - Plan button → `harness/skills/plan/planner.md`
  - Save Plan → `harness/skills/build/build.md`
  - View Files → `harness/skills/run/run.md`

**Rollback:** Delete the file.

**Verification:** File exists and contains the mapping table.

---

#### Step 2.2: Add agent-role badge to BuildHeader.jsx

**File:** `src/components/build-mode/BuildHeader.jsx`
**Depends on:** Step 2.1 (references the integration doc)
**Backward compatibility:** The new props are **optional** — if not passed, the badge does not render. Existing callers that don't pass `agentRole` will see no change.

**Changes:**

1. Add `agentRole` and `autonomyMode` to the destructured props:

```jsx
export default function BuildHeader({
  projectName, progress, status, viewMode,
  onToggleViewMode, onRefresh, onBack,
  agentRole, autonomyMode, // NEW — optional
}) {
```

2. Add the badge next to the existing status badge (after the status badge span):

```jsx
{
  agentRole && (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 whitespace-nowrap">
      {agentRole}
      {autonomyMode && ` · ${autonomyMode}`}
    </span>
  );
}
```

**Edge case — missing autonomyMode:** The badge renders just the role name without the dot separator. The `agentRole &&` guard prevents rendering when undefined.

**Rollback:** Remove the two new props from the destructuring and delete the badge JSX.

**Verification:** Pass `agentRole="Builder"` and `autonomyMode="cautious"` to BuildHeader and confirm the badge appears. Call BuildHeader without those props and confirm no badge and no error.

---

#### Step 2.3: Add lifecycle-stage breadcrumb to BuildAdvancedView.jsx

**File:** `src/components/build-mode/BuildAdvancedView.jsx`
**Depends on:** Step 2.1 (references the stage mapping)

**Changes:**

1. Add a constant for the 7 lifecycle stages:

```jsx
const LIFECYCLE_STAGES = [
  "Task Definition",
  "Agent Design",
  "Prompt Design",
  "Tool Integration",
  "Evaluation",
  "Iteration",
  "Release",
];
```

2. Derive the current stage from the first incomplete phase:

```jsx
const currentStage = (() => {
  const phases = projectData?.roadmap?.phases || [];
  const incomplete = phases.find(
    (p) => p.status !== "complete" && p.status !== "completed",
  );
  const phaseNum = incomplete?.number || 1;
  return Math.min(phaseNum, 7) - 1; // 0-indexed, capped at 7
})();
```

3. Render the breadcrumb at the top of the component's return, before the Planning Files section:

```jsx
{
  /* Lifecycle Breadcrumb */
}
<div className="flex items-center gap-1 flex-wrap text-[10px]">
  {LIFECYCLE_STAGES.map((stage, idx) => (
    <span key={stage} className="flex items-center gap-1">
      <span
        className={`px-1.5 py-0.5 rounded ${
          idx === currentStage
            ? "bg-indigo-500/30 text-indigo-200 font-semibold"
            : idx < currentStage
              ? "text-slate-500"
              : "text-slate-600"
        }`}
      >
        {stage}
      </span>
      {idx < LIFECYCLE_STAGES.length - 1 && (
        <span className="text-slate-700">→</span>
      )}
    </span>
  ))}
</div>;
```

**Edge case — no phases:** `currentStage` defaults to 0 (Task Definition). No crash.

**Edge case — more than 7 phases:** Capped at 7 via `Math.min`.

**Rollback:** Remove the constant, the `currentStage` computation, and the breadcrumb JSX.

**Verification:** Open Build mode → Advanced view → confirm breadcrumb shows 7 stages with the current one highlighted.

---

#### Step 2.4: Add unsaved-changes warning to PlanningFileViewer.jsx

**File:** `src/components/build-mode/PlanningFileViewer.jsx`
**Depends on:** Nothing (independent)

**Changes:**

1. Add a dirty-state tracker. After the existing state declarations, add:

```jsx
const isDirty = editing && editedContent !== content;
```

2. Modify the close button's onClick to check for unsaved changes:

```jsx
function handleClose() {
  if (isDirty) {
    if (!window.confirm("You have unsaved changes. Discard them?")) return;
  }
  onClose();
}
```

3. Change the close button's `onClick={onClose}` to `onClick={handleClose}`.

**Edge case — not editing:** `isDirty` is `false` when `editing` is `false`, so close works normally.

**Edge case — editing but no changes:** `editedContent === content` means `isDirty` is `false`, so close works without prompt.

**Rollback:** Revert `onClick` to `onClose` and remove `handleClose` + `isDirty`.

**Verification:** Open a planning file, click Edit, make a change, click the X close button → confirm dialog appears. Click Cancel → viewer stays open. Click OK → viewer closes.

---

### Phase 3 — Validation

#### Step 3.1: Run harness validation

**Command:** `bash harness/scripts/validate-harness.sh`
**Expected:** 53/53 passed, 0 failed
**Depends on:** All Phase 1 and Phase 2 steps complete

#### Step 3.2: Run existing unit tests

**Command:** `npm run test:unit`
**Expected:** All tests pass (no new tests needed for these changes — they are UI-only fixes)
**Depends on:** All Phase 1 steps complete

#### Step 3.3: Run UI tests if Build mode is covered

**Command:** `npm run test:ui`
**Expected:** All Build mode tests pass
**Depends on:** All Phase 1 and 2 steps complete

#### Step 3.4: Manual smoke test checklist

- [ ] Open Build mode → files load once (not on every render)
- [ ] No React warnings in console during Build mode usage
- [ ] Start research stream → Cancel button appears → click it → stream stops
- [ ] Claude Code Handoff descriptions are indented correctly
- [ ] Agent-role badge shows in header when props are passed
- [ ] Agent-role badge does NOT show when props are omitted (backward compat)
- [ ] Lifecycle breadcrumb shows in Advanced view with current stage highlighted
- [ ] PlanningFileViewer warns on close with unsaved changes
- [ ] PlanningFileViewer closes normally with no unsaved changes

---

## Acceptance Criteria

| #   | Criterion                                          | Success Measure                                                 | Verification Step           |
| --- | -------------------------------------------------- | --------------------------------------------------------------- | --------------------------- |
| 1   | BuildAdvancedView uses useEffect for file fetching | No `useState(() =>` in file; useEffect with `[project?.id]` dep | Step 3.4 manual test        |
| 2   | ClaudeCodeHandoff uses pl-[22px]                   | No `pl-5.5` in file                                             | Step 3.4 visual check       |
| 3   | BuildSimpleView has working cancel button          | Cancel button visible during streaming; clicking stops stream   | Step 3.4 manual test        |
| 4   | harness/integrations/build-mode.md exists          | File present with mapping table                                 | Step 3.1 harness validation |
| 5   | BuildHeader accepts agentRole + autonomyMode       | Badge renders when passed; no badge when omitted                | Step 3.4 manual test        |
| 6   | BuildAdvancedView shows lifecycle breadcrumb       | 7 stages visible; current highlighted                           | Step 3.4 visual check       |
| 7   | PlanningFileViewer warns on unsaved close          | Confirm dialog appears when dirty                               | Step 3.4 manual test        |
| 8   | All existing unit tests pass                       | `npm run test:unit` exit 0                                      | Step 3.2                    |
| 9   | Harness validation passes                          | 53/53 (or more with new integration file)                       | Step 3.1                    |
| 10  | No console warnings during Build mode              | DevTools console clean                                          | Step 3.4                    |

---

## Risks

| Risk                                                   | Likelihood | Impact   | Mitigation                                                            |
| ------------------------------------------------------ | ---------- | -------- | --------------------------------------------------------------------- |
| React re-render behavior changes with useEffect switch | Low        | Medium   | Test with multiple project switches; cleanup function handles unmount |
| AbortController not supported in Electron renderer     | Very Low   | Low      | AbortController is web-standard, fully supported in Chromium/Electron |
| Agent-role badge adds visual clutter                   | Low        | Low      | Props are optional; only shown when explicitly passed                 |
| Lifecycle breadcrumb takes screen space                | Low        | Low      | Only in Advanced view; uses text-[10px] for compact rendering         |
| isDirty computed on every render                       | Very Low   | Very Low | Simple string comparison; negligible cost                             |
| Existing callers don't pass new BuildHeader props      | None       | None     | Props are optional with `&&` guards — fully backward compatible       |

---

## Estimated Effort

| Phase                         | Time          |
| ----------------------------- | ------------- |
| Phase 1 — Bug Fixes           | 45 min        |
| Phase 2 — Harness Integration | 1.5 hrs       |
| Phase 3 — Validation          | 30 min        |
| **Total**                     | **~2.75 hrs** |

---

## Rollback

Each step is independently revertable:

- **Step 1.1:** Revert BuildAdvancedView.jsx (git checkout)
- **Step 1.2:** Change `pl-[22px]` back to `pl-5.5`
- **Step 1.3:** Remove abortRef, signal, cancelStream, cancel button
- **Step 2.1:** Delete `harness/integrations/build-mode.md`
- **Step 2.2:** Remove the two new props and badge JSX from BuildHeader
- **Step 2.3:** Remove breadcrumb constant, computation, and JSX from BuildAdvancedView
- **Step 2.4:** Revert PlanningFileViewer close button onClick

No database migrations, no config schema changes, no breaking changes, no backend changes.
