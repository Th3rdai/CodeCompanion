# Plan: Voice dictation across Code Companion

**Plan review:** `docs/VOICE-DICTATION-plan-review.md` — **Pass 3 (final)** signed off; helper stub: `src/lib/dictationAppend.js` (`joinAppend`).

**Goal:** Add microphone dictation (same UX as Create wizard) to **every user-facing text field** where speaking is useful — especially **Prompting / Skillz / Agentic / Planner** (`BaseBuilderPanel`), **main chat**, and mode panels that only have keyboards today.

**Existing building blocks**

| Asset                              | Role                                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/components/DictateButton.jsx` | Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`), `continuous: true`, appends via `onResult(text)`     |
| `CreateWizard.jsx`                 | ✅ Dictation on step 1–2 fields, output path; ❌ **Step 3 stage name / purpose** (two `<input>`s per row) — **no mic** |
| `BuildWizard.jsx`                  | ✅ Same pattern as Create (verify parity with Create step 3)                                                           |
| `ReviewPanel.jsx`                  | ✅ Dictation on **Paste code** textarea only                                                                           |

**Browsers:** Chromium & Safari (webkit) generally; Firefox limited. Requires **secure context** (HTTPS or localhost). Electron uses Chromium — OK.

---

## 1. Inventory — where dictation is missing

### High priority (matches your screenshot / daily use)

| Area              | File(s)                | Fields                                                                                                                       |
| ----------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Builder modes** | `BaseBuilderPanel.jsx` | All `config.fields` **`textarea`** and **`text`**; **`TagInput`** inner `<input>`; **revision** `<textarea>` (`reviseInput`) |
| **Main chat**     | `App.jsx`              | `#chat-input` textarea                                                                                                       |
| **Create wizard** | `CreateWizard.jsx`     | Step 3 **stage name** + **stage purpose** per row                                                                            |

### Medium priority (other modes / tools)

| Area                   | File(s)                                    | Notes                                                                                                                             |
| ---------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **Review (full pass)** | `ReviewPanel.jsx`                          | Grep **all** `textarea` and relevant `input type="text"` (not only “Paste code”); deep-dive / other tabs may lack dictation today |
| **Security**           | `SecurityPanel.jsx`                        | Pentest / paste / folder text areas and text inputs                                                                               |
| **Validate**           | `ValidatePanel.jsx`                        | Path / command text inputs                                                                                                        |
| **GitHub**             | `GitHubPanel.jsx`                          | Repo name, path, description-style fields                                                                                         |
| **MCP**                | `McpClientPanel.jsx`, `McpServerPanel.jsx` | URL, name, args (multiline) where free text                                                                                       |
| **Build**              | `BuildPanel.jsx`, `BuildWizard.jsx`        | Free-text fields not yet covered                                                                                                  |
| **Settings**           | `SettingsPanel.jsx`                        | Long text (allowlists, env) — optional; skip **secrets** (tokens)                                                                 |
| **Sidebar**            | `Sidebar.jsx` (or search component)        | Conversation search — optional (short queries)                                                                                    |
| **Tutorial / handoff** | `ClaudeCodeHandoff.jsx`, etc.              | If any multi-line instructions                                                                                                    |

### Low priority / skip

- **`type="password"`**, **`type="file"`**, numeric-only ports, pure toggles.
- **Read-only** code viewers (dictation would not apply).
- **Select** / **dropdown** — no dictation unless product asks for “speak to search” later.

---

## 2. UX pattern (standardize)

Use the **same layout as Create wizard**:

```jsx
<div className="flex gap-2 items-start">
  <textarea className="flex-1 min-w-0 ..." ... />
  <DictateButton
    onResult={chunk => appendToField(field.name, chunk)}
    disabled={...}
  />
</div>
```

- **`BaseBuilderPanel`** already keeps **`formDataRef.current`** in sync with `formData`. Implement **`appendToField(name, chunk)`** as:
  - **`setFormData(prev => ({ ...prev, [name]: joinAppend(prev[name], chunk) }))`**, **or**
  - read **`formDataRef.current[name]`**, compute `joinAppend(...)`, then **`updateField(name, merged)`** (both avoid stale closure if `ref` is updated).
- **Canonical helper:** **`src/lib/dictationAppend.js`** — export **`joinAppend(current, chunk)`** (trim, single-space join). Import in **`BaseBuilderPanel`**, **`App.jsx`** (chat), **Create/Build wizards**, and panels for consistent behavior with **local `setState((prev) => …)`** patterns.

- **`items-start`** so the mic aligns to the top for tall textareas.
- **Append** with a space (existing convention in Create/Review).
- **`disabled`** when the field is disabled (e.g. `!connected`, streaming).

**`TagInput` v1:** **One tag per recognition result** — trim transcript; **do not** split on commas unless you add a v2 spec and tests.

Optional later: prop **`mode="append" | "replace"`** for search-like fields.

---

## 3. Implementation phases

### Phase A — One-shot, high leverage (~0.5–1 day)

0. **`src/lib/dictationAppend.js`** — use existing **`joinAppend`**; wire first consumer in step 1.

1. **`BaseBuilderPanel.jsx`**
   - Import `DictateButton` + **`joinAppend`**.
   - For each **`textarea`** / **`text`** field: wrap in `flex gap-2 items-start` + `DictateButton` with **`onResult` → `appendToField(field.name, chunk)`** (implemented via **`setFormData(prev => …)`** + `joinAppend` — **not** a raw `updateField(name, formData[name] + …)` from render closure).
   - **`TagInput`:** show `DictateButton` beside the tag strip; **v1:** each `onResult` adds **one** trimmed tag (push to array if not duplicate — optional).
   - **Revision** textarea: `DictateButton` + **`setReviseInput(prev => joinAppend(prev, chunk))`** (same row as textarea + Send; use **responsive** `flex-wrap` if narrow).

2. **`App.jsx`**
   - Add `DictateButton` beside chat input; **`setInput(prev => joinAppend(prev, chunk))`**; disable when sending/streaming if applicable; **responsive** layout (mic icon-only or second row on small width).

3. **`CreateWizard.jsx`**
   - Step 3: for each stage row, add two `DictateButton`s (or one mic that targets “name” vs “purpose” via small toggle — simpler: **two mics** aligned with each input).

4. **`BuildWizard.jsx`**
   - Diff against Create; add dictation anywhere Create has it but Build does not (especially **stages** step if present).

### Phase B — Other mode panels (~0.5–1 day)

**Deliverable:** PR checklist table — file × field id × done (stops open-ended “identify each” drift).

5. **`SecurityPanel.jsx`** — each user-editable textarea/text input; flex + `DictateButton` + `joinAppend`.

6. **`ValidatePanel.jsx`** — path + extra args fields.

7. **`GitHubPanel.jsx`**, **`McpClientPanel.jsx`**, **`McpServerPanel.jsx`** — free-text only; avoid token fields.

8. **`BuildPanel.jsx`** — remaining text fields. **`BuildWizard`:** Phase A covers **stage parity** with Create; Phase B only if extra Build-only fields remain outside wizard.

### Phase C — Hardening & polish (~0.5 day)

9. **`DictateButton.jsx` enhancements (optional)**
   - **`lang`** prop; read default from config or `navigator.language`.
   - **Single active session:** if user starts a second mic, **stop** the first (module-level or context ref) to avoid overlapping `SpeechRecognition` instances.
   - **`interimResults`:** optional live preview in `aria-live` for accessibility (more work).
   - When unsupported: show **disabled mic with tooltip** instead of `null` (clearer than disappearing control).

10. **Docs**
    - **`BUILD.md`** or **Settings**: one line — “Voice dictation uses the browser speech API; requires microphone permission; works best in Chrome / Edge / Electron.”

11. **Tests**
    - Smoke: render `DictateButton` in jsdom may hide button (`supported` false) — assert **no crash** when `onResult` fires in a unit test with mocked `webkitSpeechRecognition` if desired.

---

## 4. Dependencies & risks

| Risk                           | Mitigation                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| Only one recognition at a time | Stop previous recognition when starting another mic                                           |
| Large forms, many mics         | Same as today — user clicks one field’s mic; optional global “dictating into #id” later       |
| **HTTPS / self-signed**        | Speech API still needs mic permission; unrelated to clipboard fixes                           |
| **Electron / macOS**           | System **microphone** permission may be required once — note in BUILD.md / Settings (Phase C) |
| **Mobile / iOS Safari**        | Speech support varies; **v1 scope: desktop Chrome + Electron** unless explicitly expanded     |
| **i18n**                       | Start with `en-US`; add Settings dropdown later                                               |

---

## 5. Acceptance criteria

- [ ] Prompting / Skillz / Agentic / Planner: every **text** + **textarea** builder field has a visible **🎤** (when API supported) and appends transcript correctly.
- [ ] Builder **revision** box has dictation.
- [ ] **Main chat** input has dictation.
- [ ] **Create** (and **Build**) wizard **stage** rows have dictation for name + purpose.
- [ ] **Review** remains as today (already has dictation on paste field); add dictation to other Review text areas if any.
- [ ] No dictation on passwords or file pickers.
- [ ] Document browser/Electron expectations in `BUILD.md` or Settings tooltip.

---

## 6. Suggested order of work

1. `BaseBuilderPanel.jsx` (fixes the screen in your screenshot).
2. `App.jsx` chat.
3. Create/Build wizard step 3.
4. Security → Validate → GitHub → MCP → Build panel.
5. Polish `DictateButton` + docs.

---

_This plan assumes reuse of `DictateButton`; no new npm dependency required for v1._
