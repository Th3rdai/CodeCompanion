# Features v2 - UX Simplification Plan

## Goal

Make the feature set intuitive by shifting from a mode-centric UI to a goal-centric experience with progressive disclosure.

Success means users can:

1. Pick the right tool in under 10 seconds.
2. Complete common workflows without hunting through "More."
3. Understand what each feature does from plain-language labels.

---

## Current Problems (v1)

- Too many top-level choices (17+ features/modes).
- Discovery split across tabs, More menu, and command palette.
- Labels are partly internal/tooling-oriented vs user-intent-oriented.
- Emoji-first iconography reduces professional scanability.
- No clear "start here" path for new users.

---

## Information Architecture (v2)

## Top-Level Navigation (Goal Buckets)

1. **Understand**
   - Chat
   - Explain This
   - Code -> Plain English
   - Diagram

2. **Improve**
   - Review
   - Clean Up
   - Safety Check
   - Security

3. **Build**
   - Create
   - Build
   - Planner
   - Agentic
   - Prompting
   - Skillz

4. **Operate**
   - Validate
   - Experiment
   - Terminal

---

## Primary Header Actions (Always Visible)

Keep only high-frequency actions visible:

- `Chat`
- `Review`
- `Build`
- `Security`
- `All Tools` (opens searchable launcher/drawer)

Everything else moves behind `All Tools`.

---

## Feature Mapping (v1 -> v2)

| v1 Mode        | v2 Bucket  | v2 Label              | Visibility |
| -------------- | ---------- | --------------------- | ---------- |
| chat           | Understand | Chat                  | Primary    |
| explain        | Understand | Explain Code          | All Tools  |
| translate-tech | Understand | Code to Plain English | All Tools  |
| diagram        | Understand | Diagram               | All Tools  |
| review         | Improve    | Code Review           | Primary    |
| refactor       | Improve    | Clean Up Code         | All Tools  |
| bugs           | Improve    | Safety Check          | All Tools  |
| pentest        | Improve    | Security Scan         | Primary    |
| create         | Build      | Create Project        | All Tools  |
| build          | Build      | Build Project         | Primary    |
| planner        | Build      | Plan Work             | All Tools  |
| agentic        | Build      | Agent Designer        | All Tools  |
| prompting      | Build      | Prompt Builder        | All Tools  |
| skillz         | Build      | Skill Builder         | All Tools  |
| validate       | Operate    | Validate Project      | All Tools  |
| experiment     | Operate    | Experiment Loop       | All Tools  |
| terminal       | Operate    | Terminal              | All Tools  |

---

## UX Behavior Changes

### 1) Progressive Disclosure

- Show 4 buckets + 4 primary actions.
- Show advanced tools only when user asks (`All Tools`).

### 2) Tool Launcher

- Search-first modal/drawer.
- Sections:
  1. Recently Used
  2. Pinned
  3. By Bucket
- Each item includes:
  - Name
  - One-line "Best for..."
  - Optional "Takes 1-5 min" hint

### 3) Context Helper

After selecting a tool, show:

- "You're in **Code Review**"
- "Best for grading quality and actionable fixes"
- 1 starter prompt/button

### 4) Professional Iconography

- Replace emoji icons with consistent SVG set (Lucide/Heroicons).
- Keep icon semantics stable across buckets.

### 5) Accessibility Baseline

- Touch targets >= 44x44
- Visible focus rings for all actionable controls
- Keyboard navigation parity with visual order
- Contrast >= 4.5:1 for body text
- `prefers-reduced-motion` support

---

## Phased Rollout Plan

## Phase 0 - Foundation (No behavior changes yet)

- [ ] Finalize v2 IA map and labels.
- [ ] Define icon library + token mapping.
- [ ] Define telemetry events for discoverability funnel.

Deliverable:

- Approved IA + naming + event schema.

## Phase 1 - Navigation Simplification

- [ ] Reduce top visible actions to 4 + `All Tools`.
- [ ] Group features by bucket.
- [ ] Keep command palette as power-user path.

Deliverable:

- New header nav in place.
- Legacy mode strip removed/de-emphasized.

## Phase 2 - Tool Launcher (Core Discoverability)

- [ ] Build searchable `All Tools` launcher.
- [ ] Add "Recently Used."
- [ ] Add "Pinned."
- [ ] Add one-line "Best for..." descriptions.

Deliverable:

- Launcher replaces "More" dropdown for most users.

## Phase 3 - Contextual Guidance

- [ ] Add per-tool helper cards.
- [ ] Add starter actions/prompts.
- [ ] Add empty-state "What do you want to do?" cards.

Deliverable:

- First-task success rate improves for new users.

## Phase 4 - Visual and Accessibility Pass

- [ ] Replace emojis with SVG icons.
- [ ] Tune spacing, density, and responsive behavior.
- [ ] Validate focus/keyboard/contrast/touch targets.

Deliverable:

- UI polish and WCAG-friendly interactions.

## Phase 5 - Measure and Iterate

- [ ] Track time-to-tool-selection.
- [ ] Track launcher search success.
- [ ] Track fallback to wrong tools + quick switches.
- [ ] Refine labels/order based on usage.

Deliverable:

- Data-informed v2.1 refinements.

## Telemetry Event Contract (Phase 0 Gate Artifact)

| Event Name                     | Trigger                                       | Required Payload Fields                                          | Success Threshold                                 | Rollback Threshold                                     |
| ------------------------------ | --------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------ |
| `v2_all_tools_opened`          | User opens `All Tools` launcher               | `timestamp`, `sessionId`, `entrySurface` (`header`/`shortcut`)   | Baseline established before Phase 1               | Missing baseline by Phase 1 freeze                     |
| `v2_tool_selected`             | User selects a tool from launcher/nav         | `timestamp`, `sessionId`, `toolId`, `bucket`, `entrySurface`     | Median time-to-selection <= 10s by Phase 2 review | Median time-to-selection worsens by >= 20% vs baseline |
| `v2_launcher_search_executed`  | User enters search query in launcher          | `timestamp`, `sessionId`, `queryLength`, `resultCount`           | Search success >= 85% (resultCount > 0)           | No-result rate >= 20% for 3 consecutive days           |
| `v2_launcher_no_result`        | Launcher returns zero matches                 | `timestamp`, `sessionId`, `queryLength`, `fallbackActionUsed`    | No-result rate <= 10% by end of Phase 2           | No-result rate >= 20% post-launch                      |
| `v2_wrong_tool_switch_30s`     | User changes tools within 30 seconds of entry | `timestamp`, `sessionId`, `fromToolId`, `toToolId`, `fromBucket` | Wrong-tool switches <= baseline + 5%              | Wrong-tool switches >= baseline + 15%                  |
| `v2_task_completion_by_bucket` | User completes primary flow in a bucket       | `timestamp`, `sessionId`, `bucket`, `completionType`             | Completion rate improves by bucket in Phase 5     | Any primary bucket drops >= 10% vs baseline            |

## Telemetry Payload Hygiene (PII Exclusion)

- Never capture raw prompt/query text in telemetry payloads.
- Use only non-content metadata fields (`queryLength`, counts, mode/tool IDs).
- Use ephemeral or hashed session identifiers; do not log usernames, emails, tokens, or file contents.
- Any future payload expansion requires reviewer sign-off in Phase 0 gate notes.

## Launcher Failure and Fallback Policy

- If launcher search returns no results, always show fallback actions:
  - open `Chat`,
  - show top 3 closest tools by bucket,
  - show recently used tools,
  - keep keyboard focus in launcher for immediate retry.
- If launcher fails to open, preserve a compatibility path via existing mode entry surfaces until issue is resolved.
- Failure incidents and fallback usage must be included in phase gate evidence.

---

## Compatibility Matrix (Required Before Phase 1)

| Surface                     | Current Contract                                            | v2 Rule                                                                  | Validation                                                |
| --------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| Frontend mode identity      | `MODES[].id` in `src/App.jsx`                               | Keep IDs stable through phases 0-4                                       | Unit check for unchanged ID set                           |
| Header/selectors            | `data-testid="mode-tab-{id}"` and `mode-tab-more`           | Preserve existing selectors or provide aliases during transition         | UI/E2E selector smoke suite                               |
| Backend prompt routing      | `SYSTEM_PROMPTS` and `VALID_MODES` keys in `lib/prompts.js` | Every frontend mode value must map to backend prompt keys                | Unit assertion: frontend mode IDs subset of `VALID_MODES` |
| Persisted conversation mode | `conv.mode` saved/reloaded in `src/hooks/useChat.js`        | Existing conversations must open in intended tool after nav updates      | History reload tests across representative conversations  |
| Legacy secondary entry path | Existing "More" access pattern and helpers                  | Keep compatibility bridge until telemetry confirms safe removal          | Transitional E2E tests for legacy and launcher entry      |
| Palette/tool launcher entry | Existing mode palette trigger path                          | New `All Tools` launcher must expose equivalent destination reachability | E2E parity test by mode/bucket                            |

## Regression Test Matrix (Must Pass Per Phase)

| Area                   | Required Checks                                                           | Phase Gate |
| ---------------------- | ------------------------------------------------------------------------- | ---------- |
| Navigation selectors   | All existing `mode-tab-*` selectors resolve and open correct tool         | Phase 1    |
| Launcher parity        | `All Tools` opens, search works, select opens expected mode               | Phase 2    |
| Legacy compatibility   | Secondary tools reachable from compatibility path during transition       | Phase 1-2  |
| Mode persistence       | Save/reload conversation preserves intended mode behavior                 | Phase 1-3  |
| Prompt compatibility   | Mode selected in UI always resolves to valid backend system prompt        | Phase 1-4  |
| Zero-result fallback   | Launcher no-result state offers usable escape paths (Chat, closest tools) | Phase 2    |
| Keyboard/accessibility | Keyboard navigation parity, focus order, visible focus state              | Phase 1-4  |
| Responsive/touch       | Core nav and launcher usable at mobile/tablet/desktop breakpoints         | Phase 4    |

## Transition Policy (Labels vs IDs)

- Labels and descriptions may change in any phase to improve clarity.
- Mode IDs remain stable through phases 0-4.
- If ID changes are ever required, they must ship in a dedicated migration phase with:
  - explicit alias map (old -> new),
  - persisted history compatibility path,
  - updated prompt routing compatibility tests,
  - coordinated test selector migration plan.
- "More" removal is telemetry-gated, not schedule-gated:
  - remove only after launcher adoption and error metrics meet thresholds.

---

## Tracking Board

## Status Legend

- `todo`
- `doing`
- `review`
- `done`

## Tasks

- [ ] (todo) P0-1 Finalize IA and naming
- [ ] (todo) P0-2 Telemetry event schema
- [ ] (todo) P1-1 Header simplification
- [ ] (todo) P1-2 Bucket grouping
- [ ] (todo) P2-1 Tool launcher shell
- [ ] (todo) P2-2 Search + recents + pinned
- [ ] (todo) P3-1 Context helper cards
- [ ] (todo) P3-2 Starter prompts/actions
- [ ] (todo) P4-1 Icon migration
- [ ] (todo) P4-2 Accessibility and responsive pass
- [ ] (todo) P5-1 Metrics dashboard + post-launch review

## Phase Execution Checklist (Owners and Reviewers)

| Phase                               | Owner                   | Reviewer         | Required Gate(s) Before Merge                                                    | Status |
| ----------------------------------- | ----------------------- | ---------------- | -------------------------------------------------------------------------------- | ------ |
| Phase 0 - Foundation                | Product + Frontend      | PM + QA          | Telemetry gate, naming/IA lock, transition policy sign-off                       | `todo` |
| Phase 1 - Navigation Simplification | Frontend                | QA               | Selector Stability Gate, Mode-ID Stability Gate, legacy compatibility path live  | `todo` |
| Phase 2 - Tool Launcher             | Frontend                | QA + Product     | Prompt Compatibility Gate, launcher parity tests, zero-result fallback checks    | `todo` |
| Phase 3 - Contextual Guidance       | Frontend + Prompt UX    | Product + QA     | Mode persistence checks, helper-card usability checks, starter action validation | `todo` |
| Phase 4 - Visual and Accessibility  | Frontend Design Systems | QA Accessibility | Accessibility gate, responsive/touch gate, reduced-motion behavior checks        | `todo` |
| Phase 5 - Measure and Iterate       | Product Analytics       | PM + Frontend    | Rollback gate, dashboard baseline comparison, post-launch review complete        | `todo` |

## Owner Assignment Defaults

- **Owner role mapping:** Product = IA, naming, success criteria; Frontend = implementation; QA = regression + accessibility validation.
- **Reviewer role mapping:** PM approves release gates; QA signs off functional and a11y checks; Product validates UX intent.
- **Archon workflow rule:** Each phase task moves `todo -> doing -> review -> done` only after gate checks are attached in task notes.

## Gate Evidence Template (Required Per Phase)

Use this exact template in each phase task before moving to `done`:

```markdown
### Gate Evidence

Phase:
Owner:
Reviewer:
Date:

#### Tests Run

- [ ] Unit tests:
- [ ] UI/E2E tests:
- [ ] Accessibility checks:
- [ ] Manual exploratory checks:

#### Results Summary

- Passed:
- Failed:
- Skipped:
- Known exceptions (with rationale):

#### Gate Checklist

- [ ] Required gate(s) for this phase passed
- [ ] Compatibility contracts still valid
- [ ] Rollback criteria reviewed/updated
- [ ] Evidence artifacts linked (test output, screenshots, notes)

#### Reviewer Sign-Off

- Reviewer name:
- Decision: approve / revise
- Notes:
```

---

## Acceptance Criteria

- [ ] User can find any feature in <= 10 seconds.
- [ ] Top-level visible actions <= 5 controls.
- [ ] `All Tools` launcher supports search + recents + pinned.
- [ ] Tool labels are intent-based and plain language.
- [ ] No regressions in existing feature functionality.
- [ ] Accessibility checks pass for key flows.

---

## Risks and Mitigations

- Risk: Existing users rely on current mode strip muscle memory.
  - Mitigation: Keep command palette and provide migration hints.

- Risk: Label changes can briefly confuse teams.
  - Mitigation: Add alias keywords in launcher search.

- Risk: Too much change in one release.
  - Mitigation: Ship Phases 1-2 first, then guidance/polish.

---

## Notes

- Keep backend mode IDs stable initially; this is primarily IA/UX restructuring.
- Avoid feature removals during v2 rollout.
- Prioritize discoverability and task completion over visual novelty.

---

## Plan Review Round 1 - IA and UX Clarity

## Verdict: NEEDS REVISION

## Summary

The strategy is directionally correct and aligns with reducing cognitive load, but the current plan lacks a strict behavior contract for bucket assignment, label consistency, and primary-vs-secondary promotion logic. Without those definitions, implementation risks subjective drift and inconsistent UX.

## Issues Found

### Critical

- None.

### Major

- **Bucket membership rules are not formally defined.**
  - **Impact:** New features may be placed inconsistently, causing taxonomy drift.
  - **Suggested Fix:** Add explicit placement rules (e.g., user intent first, task frequency second, risk third) and require every new feature to pass those rules.
- **Primary action criteria are not deterministic.**
  - **Impact:** Header actions can become politically chosen instead of behavior-driven.
  - **Suggested Fix:** Define thresholds (usage %, completion rate, error rate) that govern promotion to primary actions.
- **Terminology style guide is missing.**
  - **Impact:** Labeling quality degrades over time and reintroduces internal jargon.
  - **Suggested Fix:** Add naming rules (verb-noun, <= 3 words, no internal acronyms, "Best for..." line required).

### Minor

- **No default sort order for tools in launcher sections.**
  - **Impact:** "All Tools" may feel random and harder to scan.
  - **Suggested Fix:** Define deterministic ordering (Pinned > Recents > bucket alphabetical/frequency hybrid).

## Improvements Suggested

- Add a compact "IA Governance Rules" section with mandatory rules for placement, naming, and visibility tiers.
- Add "anti-patterns" list (no emoji-only identities, no duplicate labels, no unlabeled advanced actions).

## Verification Checklist

- [x] Existing mode taxonomy examined against current app architecture.
- [ ] Bucket placement rules defined as hard constraints.
- [ ] Primary action promotion rules defined with metrics.
- [ ] Naming convention guide added and enforceable.

---

## Plan Review Round 2 - Engineering Feasibility and Dependency Safety

## Verdict: NEEDS REVISION

## Summary

The phased model is sound, but it is still too high-level for low-risk execution. The plan needs explicit file-level implementation scope and compatibility gates tied to current structures (`MODES`, `PRIMARY_MODE_IDS`, `MORE_MENU_GROUPS`, `showModePalette` flows in `src/App.jsx`).

## Issues Found

### Critical

- **No explicit backward-compatibility contract for existing mode IDs in persisted history/config behavior.**
  - **Impact:** Mode switching, saved conversation behavior, and analytics continuity can regress.
  - **Suggested Fix:** Add a "mode ID stability contract": do not rename/remove IDs until post-v2 migration with aliases.

### Major

- **Phase tasks do not map to concrete files/components.**
  - **Impact:** Implementation may fragment across contributors and miss key touchpoints.
  - **Suggested Fix:** Add file-scope matrix by phase:
    - `src/App.jsx` (navigation surfaces and launcher entry)
    - `src/hooks/useChat.js` (mode persistence touchpoints where needed)
    - `src/components/*` supporting header/tool entry UX
    - docs/changelog update points
- **No fallback behavior defined when launcher search returns no result.**
  - **Impact:** Dead-end states reduce trust and completion rate.
  - **Suggested Fix:** Add zero-state actions (show closest tools, "open Chat", "report missing tool").
- **No migration guidance for existing "More" usage patterns.**
  - **Impact:** Existing users may perceive feature removal.
  - **Suggested Fix:** Keep temporary compatibility entry ("More (legacy)") during Phase 1 rollout, remove after telemetry confirms stability.

### Minor

- **No explicit keyboard shortcut harmonization policy.**
  - **Impact:** Search modal and mode flows may conflict with existing shortcuts.
  - **Suggested Fix:** Document shortcut ownership and conflict resolution in Phase 1.

## Improvements Suggested

- Add a "File-Level Implementation Matrix" section to each phase.
- Add "Compatibility Gates" before merging each phase.

## Verification Checklist

- [x] Current navigation implementation points validated in `src/App.jsx`.
- [ ] File-scope mapping added for each rollout phase.
- [ ] Mode ID compatibility contract documented.
- [ ] Legacy-to-v2 transition behavior defined.

---

## Plan Review Round 3 - Measurement, Rollout, and Operational Readiness

## Verdict: READY FOR IMPLEMENTATION (GATED)

## Summary

With two prerequisite additions (go/no-go gates and telemetry definitions), the plan is ready to execute. The core strategy is strong and can ship incrementally if measurement and rollback criteria are formalized before Phase 1.

## Issues Found

### Critical

- None, pending gates below.

### Major

- **Metrics are listed but not operationally defined.**
  - **Impact:** Teams cannot determine success/failure objectively.
  - **Suggested Fix:** Define exact event names, formulas, and thresholds:
    - Time-to-first-tool-selection (median, p90)
    - Wrong-tool switch rate within 30 seconds
    - Launcher no-result rate
    - Task completion rate by bucket
- **No rollback trigger criteria per phase.**
  - **Impact:** Risky releases may persist despite regressions.
  - **Suggested Fix:** Add rollback thresholds (e.g., +X% wrong-tool rate, +Y% abandonment, severe accessibility regression).

### Minor

- **No ownership model per phase.**
  - **Impact:** Work can stall between design, frontend, and QA.
  - **Suggested Fix:** Add owner and reviewer roles per phase in the tracking board.

## Improvements Suggested

- Add a "Go/No-Go Gates" section before Phase 0 and before each production rollout.
- Add "Release Checklist" section:
  - telemetry wired
  - accessibility pass complete
  - keyboard and responsive QA complete
  - fallback/rollback validated

## Go/No-Go Gates (Required)

- [ ] **Telemetry gate:** Event schema, dashboard queries, and baseline capture completed before Phase 1.
- [ ] **Compatibility gate:** Existing mode IDs unchanged and legacy entry paths preserved during transition.
- [ ] **Accessibility gate:** Focus, keyboard, touch target, and contrast checks pass on new navigation surfaces.
- [ ] **Rollback gate:** Quantitative rollback thresholds defined and documented.

## Verification Checklist

- [x] Plan objective and phased execution are coherent and implementable.
- [x] Major dependency points identified in current code architecture.
- [ ] Telemetry and baseline definitions finalized.
- [ ] Rollback criteria documented and approved.
- [ ] Phase owners/reviewers assigned in tracking board.

---

## Plan Review Round 4 - Deep Dependency and Regression Analysis

## Verdict: READY FOR IMPLEMENTATION (GATED, with added hard constraints)

## Summary

An additional deep pass against runtime and test dependencies confirms the strategy is viable, but two hidden coupling points must be promoted to explicit rollout constraints: (1) mode test-id contract stability and (2) mode-ID/prompt compatibility across backend and saved history behavior.

## Issues Found

### Critical

- **Mode selector test-id contract is heavily coupled to current navigation IDs and flows.**
  - **Evidence:** Existing UI/E2E tests target `data-testid="mode-tab-{id}"`, `mode-tab-more`, and mode placement assumptions (including "More" open behavior).
  - **Impact:** Refactoring navigation can silently break broad test coverage and CI confidence.
  - **Suggested Fix:** Add a "test-id compatibility contract" in Phase 1:
    - preserve `mode-tab-{id}` IDs even if visual IA changes
    - preserve a stable launcher test-id namespace for new surfaces
    - provide temporary alias selectors for transition period.

### Major

- **Backend mode/prompt compatibility risk is under-specified.**
  - **Evidence:** prompt routing relies on current mode IDs (`SYSTEM_PROMPTS` / `VALID_MODES`), while frontend persists and reloads `conv.mode` from history.
  - **Impact:** Any ID rename/removal can break prompt selection, conversation reload behavior, or fallback defaults.
  - **Suggested Fix:** Treat mode IDs as immutable through v2 rollout. If label changes are needed, perform display-label migration only; defer ID migration behind explicit alias map and compatibility tests.

- **Legacy "More" interaction is encoded in helper tests/workflows.**
  - **Evidence:** E2E helpers explicitly call `openMoreModesMenu` before selecting secondary tools.
  - **Impact:** Immediate removal of "More" can regress tests and user muscle memory simultaneously.
  - **Suggested Fix:** During transition, keep a compatibility path (`All Tools` plus optional hidden/legacy trigger), and migrate tests in a controlled phase.

- **No explicit non-chat mode entry fallback is defined for launcher-first UX.**
  - **Evidence:** Current flow assumes direct tab entry patterns in many scenarios.
  - **Impact:** Users may fail to reach non-primary tools if launcher ranking/search degrades.
  - **Suggested Fix:** Add deterministic backup paths:
    - bucket quick-links
    - keyboard shortcut open state
    - recent tool chips.

### Minor

- **`useChat` conversation fallback to `explain` when mode missing can skew post-migration behavior.**
  - **Impact:** Legacy or malformed conversations may open in an unexpected destination.
  - **Suggested Fix:** Add explicit migration fallback policy and test for unknown/legacy mode IDs.

## Improvements Suggested

- Add a **Compatibility Matrix** section to the plan:
  - frontend mode IDs
  - backend `SYSTEM_PROMPTS` mode keys
  - persisted `conv.mode`
  - test-id selectors.
- Add a **Regression Test Matrix** section with mandatory checks:
  - all `mode-tab-*` selectors
  - launcher open/select flow
  - saved conversation reload per mode.
- Add a **Transition Policy** section:
  - labels may change, IDs do not (until explicit migration phase).

## Additional Go/No-Go Constraints

- [ ] **Selector Stability Gate:** Existing `mode-tab-*` selectors or aliases remain valid during transition.
- [ ] **Mode-ID Stability Gate:** No mode ID renames/removals in v2 phases 0-4.
- [ ] **Prompt Compatibility Gate:** `VALID_MODES` remains compatible with all frontend-emitted `mode` values.
- [ ] **History Reload Gate:** Legacy conversations open correctly under unchanged mode IDs.

## Verification Checklist

- [x] Deep pass completed against current navigation state and test coupling.
- [x] Hidden dependency surfaces identified (test IDs, prompt mode keys, persisted mode values).
- [x] Compatibility matrix added to execution sections.
- [x] Regression matrix expanded with selector/prompt/history cases.
- [ ] Transition policy approved before Phase 1 implementation.

---

## Plan Review Round 5 - Final Validation Before Execution

## Verdict: READY FOR IMPLEMENTATION (GATED)

## Summary

The plan is now execution-ready with strong dependency controls, compatibility contracts, and phase ownership. Remaining gaps are operational rather than architectural: telemetry definitions must be concretized into exact event contracts, and gate evidence collection must be standardized so phase sign-off is objective and repeatable.

## Issues Found

### Critical

- None.

### Major

- **Telemetry gate still lacks exact event dictionary and threshold table in the plan body.**
  - **Impact:** Teams may implement inconsistent tracking, making success/rollback decisions subjective.
  - **Suggested Fix:** Add a compact "Event Contract" table under Phase 0 with:
    - event name,
    - trigger condition,
    - required payload fields,
    - success threshold,
    - rollback threshold.

- **Gate evidence format is implied but not standardized.**
  - **Impact:** Reviewers may accept uneven evidence quality across phases.
  - **Suggested Fix:** Add a single required gate evidence template for each phase task:
    - tests run,
    - pass/fail summary,
    - known exceptions,
    - reviewer sign-off.

### Minor

- **Tracking board phase statuses are all `todo` and not synchronized to live Archon task IDs.**
  - **Impact:** Manual drift risk between plan file and task system.
  - **Suggested Fix:** Add Archon task ID references beside each phase task line, or maintain a linked appendix with canonical task IDs.

## Improvements Suggested

- Add a short "Definition of Done (Per Phase)" subsection that requires:
  - gate checklist complete,
  - evidence attached,
  - reviewer explicitly named.
- Add a release note stub format for each phase to reduce deployment ambiguity.
- Add one cross-phase integration checkpoint after Phase 2 to validate combined navigation + launcher behavior before Phase 3 UX layering.

## Verification Checklist

- [x] All referenced files/APIs exist and match current code structure.
- [x] Dependencies are acyclic and satisfiable.
- [x] Error handling/fallback behavior is fully specified for all launcher failure modes.
- [x] Security model for telemetry payload hygiene (PII exclusion) is explicitly documented.
- [x] Testing strategy now covers compatibility and regression gates.
- [x] Implementation order respects dependencies.
