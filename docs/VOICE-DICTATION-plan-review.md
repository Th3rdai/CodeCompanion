# Voice dictation plan — plan-reviewer output

**Skill:** `.cursor/skills/plan-reviewer`  
**Subject:** `docs/VOICE-DICTATION-PLAN.md`

---

## Pass 2 — 2026-03-20

**Verdict:** **Approved to implement** — prior **major** doc bugs are **fixed in the plan** (§2 `updateField` / stale state; **TagInput v1 = one tag**; Phase A bullet aligned).

| Pass 1 issue                   | Status in plan                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------ |
| §2 wrong `updateField(prev=>)` | **Fixed** — `appendToField` + `setFormData` callback / ref note + `joinAppend` |
| TagInput comma ambiguity       | **Fixed** — explicit v1 one-tag rule in §2 + Phase A                           |

**New / remaining (Pass 2):**

| Sev                   | Item                                                               | Action                                                                                                     |
| --------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Resolved (Pass 3)** | **`appendToField` / helper location**                              | **`src/lib/dictationAppend.js`** — `joinAppend(current, chunk)`; plan header + Phase A step 0 reference it |
| Minor                 | **Sample still abstract** (`appendToField` not defined in snippet) | Acceptable — plan §2 + `dictationAppend.js` document contract; first PR wires consumers                    |
| **Resolved (Pass 3)** | **Phase B overlap** — BuildWizard vs BuildPanel                    | Plan: **Phase A** = Create/Build **stage** parity; **Phase B** = BuildPanel leftovers                      |
| **Resolved (Pass 3)** | **iOS / mobile WebKit**                                            | Plan **Risks**: **v1 desktop Chrome + Electron**                                                           |

**Self-check (Pass 2):** Plan is **executable** without contradicting `BaseBuilderPanel` APIs. Remaining risk is **implementation** (closure correctness) — mitigated by `setFormData(prev=>)` pattern in §2.

---

## Pass 3 — Final (2026-03-16)

**Verdict:** **Signed off — implement Phase A.**

### Plan deltas applied (this session)

| Item             | Change                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **§2 + Phase A** | Phase A step 1 explicitly uses **`appendToField` / `setFormData(prev => …)` + `joinAppend`**; revision uses **`setReviseInput(prev => joinAppend(...))`**; chat uses **`setInput(prev => joinAppend(...))`**. |
| **Helper**       | **`src/lib/dictationAppend.js`** with **`joinAppend`** — first consumer wired in Phase A step 0 → 1.                                                                                                          |
| **ReviewPanel**  | Medium-priority table: **full pass** on all `textarea` / text inputs.                                                                                                                                         |
| **Phase B**      | Deliverable: **PR checklist** (file × field id × done).                                                                                                                                                       |
| **Risks**        | **Electron mic permission**; **v1 desktop** scope (Chrome + Electron).                                                                                                                                        |

### Remaining minors (non-blocking)

- **`DictateButton` a11y** — Phase C: `aria-pressed`, live region (plan § Phase C).
- **Single active recognition** — Phase C if overlapping sessions in QA.
- **BUILD.md** — one line on mic + browser support.

### Next action

Import **`joinAppend`**, add **`appendToField`** in **`BaseBuilderPanel`**, mount **`DictateButton`** on builder fields + revision row, then **`App.jsx`** chat + Create/Build stage rows per Phase A.

---

## Pass 1 — 2026-03-20 (historical)

**Verdict (at time):** **Approved to implement** — solid scope and phasing; fix **§2 code sample** and **TagInput v1 rule** before coding. _(Those fixes are now in `VOICE-DICTATION-PLAN.md`.)_

---

## 1. Plan overview (validated)

**Build:** Reuse `DictateButton` + Web Speech API; add a **consistent** `flex` row (field + mic) across `BaseBuilderPanel` (all builder modes), main chat (`App.jsx`), Create/Build wizard stage rows, then Security / Validate / GitHub / MCP / Build panels. Optional Phase C: single active recognition, `lang`, visible disabled state when unsupported, docs + light tests.

**How:** Phase A (highest ROI) → Phase B (other panels) → Phase C (polish). No new npm dependency for v1.

---

## 2. Issues and gaps

| Severity  | Description                                                                                                                                | Impact                                    | Suggested fix                                                                                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Major** | **§2 JSX sample** uses `updateField(prev => …)` but **`BaseBuilderPanel`** uses **`updateField(name, value)`** — not a functional updater. | Copy-paste bug during implementation      | Use a small **`appendToField(name, chunk)`** helper (reads latest `formData` via `setFormData` callback or ref) **or** `onResult={t => updateField(field.name, [formData[field.name], t].filter(Boolean).join(' '))}` with careful closure handling |
| **Major** | **`TagInput`** strategy is ambiguous: “split on commas **or** push single tag”.                                                            | Inconsistent UX; double commas break tags | **v1 rule:** append **one tag** per final utterance (trim); if transcript contains commas, **either** split on comma **or** single tag — pick **one** in code comment; recommend **single tag** for v1 (simplest)                                   |
| **Minor** | **`ReviewPanel.jsx`** has **≥2** textareas (e.g. deep-dive / paste paths per grep); plan only calls out paste field explicitly.            | Missed fields in Phase B                  | Add checklist item: grep `ReviewPanel` for **all** `textarea` + `input type="text"`                                                                                                                                                                 |
| **Minor** | **Explain / Clean Up / Idea / Diagram** modes: inputs may live outside listed panels; plan’s “mode panels” is slightly vague.              | Small gaps                                | Phase B: `rg textarea src/components` filtered by mode-specific components, or accept “all \*Panel.jsx`” as definition of done                                                                                                                      |
| **Minor** | **Chat row layout** (`App.jsx`): toolbar already dense; mic + Send + textarea needs **responsive** layout (wrap or icon-only mic).         | Cramped UI on narrow width                | Specify in Phase A: mic **inside** input row (right) or below on `sm:` breakpoint                                                                                                                                                                   |
| **Minor** | **Electron / macOS**: first mic use may need **system** microphone permission — not just browser prompt.                                   | User confusion                            | Add one line to BUILD.md / Settings (Phase C)                                                                                                                                                                                                       |
| **Minor** | **Phase B** “identify each field” is open-ended.                                                                                           | Schedule slip                             | Deliverable: table or checklist in PR description per file (field id + done)                                                                                                                                                                        |

---

## 3. Improvements (beyond the written plan)

- **DRY helper:** Add `appendTranscript(current, chunk) =>` in `src/lib/` or next to `DictateButton` to avoid repeating `prev ? prev + ' ' + text : text` and reduce stale-state bugs.
- **`DictateButton`:** Add **`aria-pressed={listening}`**, **`aria-label`** (not only `title`) for a11y; Phase C already mentions visible disabled state — good.
- **Single-flight recognition (Phase C):** Implement early if QA hears **overlapping** sessions; cheap module-level `let activeRecognition = null`.
- **Performance:** No concern for v1 (speech is user-paced).

---

## 4. Implementation steps (numbered, execution order)

1. Add **`appendToFormField`** (or equivalent) used by builder + wizards for consistent append semantics.
2. **`BaseBuilderPanel.jsx`:** For `field.type === 'textarea' | 'text'`, wrap control + `DictateButton`; wire `updateField` correctly.
3. **`TagInput`:** Mic beside strip; **v1:** one tag per `onResult` (trimmed transcript).
4. **Revision** textarea: `DictateButton` + `setReviseInput` append.
5. **`App.jsx`:** Chat `textarea` + `DictateButton` → `setInput`; layout for small screens.
6. **`CreateWizard.jsx` / `BuildWizard.jsx`:** Stage name + purpose rows — two mics or documented alternative.
7. **Phase B:** `SecurityPanel` → `ValidatePanel` → `GitHubPanel` → `McpClientPanel` / `McpServerPanel` → `BuildPanel`; **ReviewPanel** all text fields.
8. **Phase C:** `DictateButton` polish, BUILD.md / Settings note, optional unit test with mocked `webkitSpeechRecognition`.
9. **Acceptance:** Run through checklist in original plan §5; manual mic test in **Electron** + **Chrome**.

---

## 5. Dependencies

- **Prerequisite:** `DictateButton.jsx` (exists); secure context (HTTPS/localhost).
- **Ordering:** `BaseBuilderPanel` before scattered panels (validates pattern).
- **External:** None.

---

## 6. Error handling

| Failure                               | Behavior                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| API unsupported                       | Phase C: show disabled mic + tooltip; v1: `null` (current) — acceptable short-term             |
| User denies mic                       | `onerror` / browser UI; `DictateButton` already logs — optional toast via `onToast` prop later |
| `not-allowed` / `service-not-allowed` | Stop listening; surface short message (toast) — optional Phase C                               |
| Stale closure on append               | Fix via helper or functional state update in parent                                            |

---

## 7. Testing strategy

| Layer      | Focus                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Manual     | Each phase: Chrome + **Electron** build; one builder mode + chat + Create step 3                            |
| Unit       | Mock `webkitSpeechRecognition`; fire `onresult`; assert `onResult` called (optional)                        |
| Regression | Snapshot or RTL: builder field still renders when `SpeechRecognition` undefined (button absent or disabled) |

---

## 8. Risk assessment

| Risk                                | Mitigation                                            |
| ----------------------------------- | ----------------------------------------------------- |
| Multiple simultaneous recognitions  | Phase C single-flight                                 |
| Wrong append on rapid updates       | Central `append` helper + correct React state pattern |
| Token fields in GitHub/MCP Settings | Plan already says skip secrets — enforce in review    |

---

## 9. Self-check (plan-reviewer)

1. **Implementer questions:** Resolved if **TagInput v1** and **§2 `updateField`** are fixed in plan or this doc.
2. **Beginning / middle / end:** Yes — phases A→C.
3. **Edge cases:** Mic permission, unsupported browser, layout — covered.
4. **Feasible:** Yes; estimates (~0.5–1 day per phase) reasonable if Phase B stays grep-driven.

---

_Generated with the **plan-reviewer** skill workflow._
