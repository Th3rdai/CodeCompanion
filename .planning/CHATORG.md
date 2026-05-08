# Plan Review: Chat Organization (Groups/Folders)

## Verdict: READY

## Summary

The codebase is well-positioned for chat folders/groups because conversations are already persisted as JSON objects and routed through centralized history APIs and sidebar rendering. The safest rollout is additive: introduce folder metadata and folder APIs first, then wire UI grouping and move actions, while preserving backward compatibility for existing conversations with no folder assigned.

## Issues Found

### Critical

- None.

### Major

- **No folder schema currently exists on conversation records.**
  - **Impact:** No stable way to group, move, or persist folder assignment across app restarts.
  - **Suggested Fix:** Add `folderId` to conversation records in `lib/history.js` save/list/load paths with automatic fallback to `inbox`.
- **No folder registry exists (name, order, color, collapsed).**
  - **Impact:** Group labels become implicit/fragile if inferred only from conversations.
  - **Suggested Fix:** Add a small folder store (JSON file) and CRUD endpoints under `routes/history.js`.
- **Sidebar currently displays a flat filtered list.**
  - **Impact:** UX cannot represent hierarchical groupings or folder-level actions.
  - **Suggested Fix:** Refactor `src/components/Sidebar.jsx` rendering to grouped sections keyed by `folderId`, with per-folder collapse state.

### Minor

- **Bulk actions do not include "move to folder."**
  - **Impact:** Organizing a large backlog is slow.
  - **Suggested Fix:** Add bulk move operation in `src/hooks/useChat.js` and hook it into sidebar multi-select actions.
- **No metrics for folder adoption/usage.**
  - **Impact:** Harder to evaluate feature value and behavior regressions.
  - **Suggested Fix:** Add lightweight counts to existing dashboard summary (active chats by folder, uncategorized count).

## Improvements Suggested

- Keep `folderId` optional in stored JSON and auto-normalize to `inbox` when missing to avoid risky one-shot migration scripts.
- Introduce immutable system folder `inbox` that cannot be deleted; deleting user folders should re-home conversations to `inbox`.
- Add API-level validation for folder identifiers (`^[a-z0-9-]{2,64}$`) and safe name length limits.
- Add stable display order (`position`) in folder metadata to support drag/drop ordering later without schema churn.
- Persist folder collapse state in folder metadata (or localStorage fallback) to avoid jittery UX between app launches.
- Keep archive semantics independent of folders (`archived` remains orthogonal), so archived chats can still retain their folder assignment.

## Verification Checklist

- [x] All referenced files/APIs exist and match current architecture.
- [x] Dependencies are acyclic and satisfiable.
- [x] Error handling coverage identified for all new CRUD/move operations.
- [x] Security model requirements identified (input validation, path-safe JSON storage).
- [x] Testing strategy defined across unit/integration/UI layers.
- [x] Implementation order respects dependencies.

---

## Implementation Plan (Execution Order)

### Phase 0 — Contract and Data Model (Backend foundations)

- [ ] Define `Conversation.folderId` contract (`string`, default `inbox`).
- [ ] Define `Folder` contract:
  - [ ] `id` (slug)
  - [ ] `name`
  - [ ] `color` (optional token)
  - [ ] `position` (number)
  - [ ] `collapsed` (boolean, optional)
  - [ ] `createdAt`, `updatedAt`
- [ ] Create folder storage module (recommended: `lib/history-folders.js`) using atomic write pattern.
- [ ] Seed system folder `inbox` on init.

### Phase 1 — History API Extensions

- [ ] Add endpoints in `routes/history.js`:
  - [ ] `GET /api/history/folders`
  - [ ] `POST /api/history/folders`
  - [ ] `PATCH /api/history/folders/:id`
  - [ ] `DELETE /api/history/folders/:id` (move chats to `inbox`)
  - [ ] `PATCH /api/history/:id/folder` (single move)
  - [ ] `POST /api/history/batch-move` (bulk move)
- [ ] Enforce validation and conflict handling (duplicate IDs/names, unknown folderId).
- [ ] Ensure delete/move operations preserve conversation integrity and timestamps.

### Phase 2 — History Persistence Wiring

- [ ] Update `lib/history.js`:
  - [ ] `saveConversation()` sets default `folderId: "inbox"` when absent.
  - [ ] `listConversations()` returns `folderId`.
  - [ ] `getConversation()` normalizes missing `folderId` to `inbox` in-memory.
- [ ] Keep backwards compatibility for existing files without rewrites unless touched.

### Phase 3 — Frontend State + Hooks

- [ ] Extend `src/hooks/useChat.js`:
  - [ ] folder state (`folders`)
  - [ ] fetch/load folder APIs
  - [ ] single move helper
  - [ ] bulk move helper
  - [ ] create/rename/delete folder helpers
- [ ] Ensure existing archive/delete/export flows still work with folders.

### Phase 4 — Sidebar UX

- [ ] Refactor `src/components/Sidebar.jsx` from flat list to grouped render:
  - [ ] Folder headers with count
  - [ ] Collapse/expand toggle
  - [ ] Empty-folder state
- [ ] Add move actions:
  - [ ] Per-chat context menu -> Move to folder
  - [ ] Multi-select bulk move
- [ ] Add folder management UI:
  - [ ] Create folder
  - [ ] Rename folder
  - [ ] Delete folder (with warning + re-home behavior)

### Phase 5 — QA, Regression, and Rollout

- [ ] Unit tests:
  - [ ] folder store module
  - [ ] history normalization defaults
  - [ ] API validation/re-homing behavior
- [ ] Integration tests:
  - [ ] folder CRUD + move endpoints
  - [ ] batch move + archive interaction
- [ ] UI tests:
  - [ ] grouped render
  - [ ] move operations
  - [ ] collapsed folder state behavior
- [ ] Smoke test in Electron packaged app.

---

## Acceptance Criteria

- [ ] User can create, rename, and delete folders.
- [ ] User can move one or many chats between folders.
- [ ] Existing chats without `folderId` appear in `inbox` automatically.
- [ ] Folder organization survives app restart.
- [ ] Archive/unarchive still works exactly as before.
- [ ] No regression in delete/export/history load paths.

---

## Risks and Mitigations

- **Risk:** Silent schema drift across old conversation files.
  - **Mitigation:** Normalize on read and default on save; no destructive migration required.
- **Risk:** Folder deletion can orphan conversations.
  - **Mitigation:** Mandatory re-home to `inbox` in one transactional operation.
- **Risk:** Sidebar complexity regression/perf issues with many folders/chats.
  - **Mitigation:** Memoized grouped selector and incremental rendering patterns already used in sidebar filtering.

---

## Notes for Execution Tracking

- Use this file as the source of truth during implementation.
- Mark checkboxes as work lands.
- Keep phase boundaries intact: do not start Phase 4 UI work before Phase 1/2 API + persistence are merged.

---

## Plan Review Round 2 (Follow-up Analysis)

## Verdict: NEEDS REVISION

## Summary

The plan is structurally sound, but two execution-critical gaps were identified after validating against current route wiring and `useChat` autosave behavior. These must be addressed before implementation, otherwise folder assignment can break at runtime or silently regress during streaming saves.

## Issues Found

### Critical

- **Route shadowing risk for folder endpoints in `routes/history.js`.**
  - **Description:** The existing `GET /history/:id` route is declared early. If `GET /history/folders` is added below it, `"folders"` can be captured as `:id`.
  - **Impact:** Folder list endpoint returns wrong handler behavior (404/invalid conversation), making folder UI fail.
  - **Suggested Fix:** Register `GET /history/folders` (and any static `/history/*` endpoints) before `GET /history/:id`.

- **`useChat.saveConversation()` currently does not preserve unknown persisted fields (e.g., future `folderId`).**
  - **Description:** When saving by `convId`, the hook only reuses `createdAt` and `archived` from existing history entries, not full metadata.
  - **Impact:** Streaming/autosave rounds can unintentionally reset folder assignment (likely back to default) after move operations.
  - **Suggested Fix:** Before save, merge/retain existing conversation metadata (`folderId` minimum) or include `folderId` in all save paths.

### Major

- **Folder move logic should not rely on full-conversation POST rewrites.**
  - **Impact:** Concurrent autosave + move can race and clobber fields.
  - **Suggested Fix:** Use dedicated partial endpoints (`PATCH /history/:id/folder`, batch move endpoint) and keep folder updates server-authoritative.

- **Plan does not yet define folder behavior for special conversation modes.**
  - **Impact:** Review/Security/Builder save flows in `App.jsx` may save conversations without explicit folder semantics.
  - **Suggested Fix:** Define default folder behavior for all mode-specific save paths and ensure folder is preserved on updates.

### Minor

- **Folder API naming should avoid overlap with existing batch operations.**
  - **Impact:** Inconsistent endpoint layout can confuse maintenance.
  - **Suggested Fix:** Keep a consistent namespace (`/history/folders/*`, `/history/move`, `/history/batch-move`) and document route order constraints.

## Improvements Suggested

- Add a hard requirement in Phase 1: **"Static `/history/folders*` routes must be declared before `/history/:id`."**
- Add a hard requirement in Phase 3: **"`saveConversation()` must preserve `folderId` from existing records."**
- Add integration test case: move a chat to non-default folder, send additional message (autosave path), verify `folderId` remains unchanged.
- Add migration test case: existing conversation without `folderId` is listed as `inbox` and remains stable after first save.

## Verification Checklist (Round 2)

- [x] Route registration order reviewed against existing `routes/history.js`.
- [x] Autosave and update paths reviewed in `src/hooks/useChat.js` and `src/App.jsx`.
- [x] Race/regression risk between move and streaming save identified.
- [x] Concrete fixes added to plan requirements.

---

## Plan Review Round 3 (Security + API Surface Analysis)

## Verdict: NEEDS REVISION

## Summary

Folder/group APIs are additive but increase write-capable surface area under `/api/history`. The current plan needs explicit security and compatibility constraints so new endpoints align with existing local/API-key trust boundaries and do not break MCP/tooling consumers expecting stable history payloads.

## Issues Found

### Critical

- None.

### Major

- **Security policy for new mutating endpoints is not explicitly defined.**
  - **Description:** Existing `/api/history` routes are currently open within the app's established local-first model, but new folder CRUD and move endpoints add more state mutation paths.
  - **Impact:** In LAN-exposed deployments, unclear policy can widen abuse surface and complicate pentest posture.
  - **Suggested Fix:** Explicitly document and enforce the same trust model for all new folder endpoints (either mirror existing history policy intentionally, or gate mutating folder routes with `requireLocalOrApiKey`).

- **MCP/API compatibility requirement is missing for history list shape changes.**
  - **Description:** Existing tools (including MCP `codecompanion_list_conversations`) rely on `listConversations()` output shape.
  - **Impact:** Uncoordinated payload changes can break external tool consumers or UI assumptions.
  - **Suggested Fix:** Treat `folderId` as additive and backward-compatible; do not remove/rename current fields. Add a compatibility check for MCP list-conversations output.

### Minor

- **No explicit endpoint naming/versioning guidance for future extensions.**
  - **Impact:** Later growth (ordering, drag-drop, shared groups) may force breaking route churn.
  - **Suggested Fix:** Reserve a clean namespace now (`/api/history/folders/*`, `/api/history/move`, `/api/history/batch-move`) and document it in `.planning/CHATORG.md`.

## Improvements Suggested

- Add a "Security and Exposure" subsection to Phase 1 with required decisions before coding.
- Add a "Payload Compatibility" subsection to acceptance criteria (all existing consumers still parse history list responses).
- Add integration tests for denied/unauthorized cases if endpoint gating is enabled.

## Verification Checklist (Round 3)

- [x] Route exposure model checked against current server security helpers.
- [x] Existing history endpoint and MCP references inspected for compatibility impact.
- [x] Security/documentation deltas identified with concrete implementation rules.

---

## Plan Review Round 4 (Performance + Data Integrity Analysis)

## Verdict: NEEDS REVISION

## Summary

The plan needs additional safeguards for scaling and integrity. Current history listing is synchronous file scanning, and folder delete/re-home operations may touch many files. Without explicit operational constraints, UI grouping features could become sluggish on large histories.

## Issues Found

### Critical

- None.

### Major

- **Potential high-cost folder delete/re-home operation is not bounded.**
  - **Description:** Deleting a folder requires updating every conversation assigned to it.
  - **Impact:** Large history sets may block event loop and degrade UX/API responsiveness.
  - **Suggested Fix:** Define batch-safe re-home strategy with atomic write discipline and progress-safe error handling (all-or-report-failed), reusing existing temp-file rename pattern.

- **Grouped sidebar rendering may amplify existing sync list cost.**
  - **Description:** `GET /api/history` currently performs synchronous JSON file reads; folder grouping adds extra client-side processing and re-renders.
  - **Impact:** Noticeable lag with larger history directories.
  - **Suggested Fix:** Add memoized grouped selectors in sidebar and avoid repeated re-grouping on unrelated state changes. Consider server-side lightweight folder counts later if needed.

### Minor

- **No explicit folder position conflict policy.**
  - **Impact:** Order can become unstable if duplicate `position` values occur.
  - **Suggested Fix:** Normalize positions on create/update and define deterministic secondary sort (`createdAt` or `name`).

## Improvements Suggested

- Add performance budget notes to Phase 5 (e.g., sidebar remains responsive with N conversations).
- Add failure-mode behavior for re-home operations (partial-failure response shape and retry guidance).
- Add explicit "atomic writes only" rule for folder metadata and conversation rewrites.

## Verification Checklist (Round 4)

- [x] Current history I/O behavior reviewed for scaling implications.
- [x] Folder delete/re-home write-path risks analyzed.
- [x] Concrete performance/data-integrity mitigations added.

---

## Plan Review Round 5 (UX Consistency + Test Completeness Analysis)

## Verdict: NEEDS REVISION

## Summary

The plan is close, but UX behavior matrix and regression coverage are still under-specified. Folder organization intersects with archive mode, multi-select operations, and mode-specific save flows. These interactions need explicit expected behavior before implementation starts.

## Issues Found

### Critical

- None.

### Major

- **Archive-vs-folder behavior matrix is not fully specified.**
  - **Description:** Sidebar currently toggles active/archived views; grouped folders introduce additional state combinations.
  - **Impact:** Ambiguous behavior can produce inconsistent filtering and hard-to-debug UI bugs.
  - **Suggested Fix:** Define matrix explicitly: when `showArchived=false`, only non-archived chats grouped by folder; when `showArchived=true`, archived chats grouped by their existing folder assignment.

- **Mode-specific save flows are not explicitly included in regression checklist.**
  - **Description:** `App.jsx` saves review/pentest/builder conversations through custom flows.
  - **Impact:** These paths may miss folder assignment preservation.
  - **Suggested Fix:** Add acceptance tests for each save path to ensure `folderId` persists after create/update/autosave.

### Minor

- **Context menu UX for move-to-folder in collapsed sidebar not defined.**
  - **Impact:** Feature may be inaccessible or inconsistent in compact layouts.
  - **Suggested Fix:** Define fallback interaction (modal/select sheet) independent of expanded row affordances.

## Improvements Suggested

- Add a "Behavior Matrix" section to plan (active/archived x grouped/ungrouped x single/bulk move).
- Add explicit e2e scenarios:
  - move chat, send new message, reload app, verify folder unchanged
  - archive/unarchive chat preserves folder
  - bulk move mixed archived/non-archived chats applies expected filtering rules
- Add UX copy specs for folder delete confirmation and re-home messaging.

## Verification Checklist (Round 5)

- [x] Sidebar filtering logic reviewed for archive interaction risk.
- [x] Custom save flows in `App.jsx` and `useChat` reviewed for persistence gaps.
- [x] Test matrix gaps identified and translated into concrete scenarios.
