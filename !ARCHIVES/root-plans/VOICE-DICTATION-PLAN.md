# Voice Dictation Plan — Complete Coverage

**Status:** Implemented — all acceptance criteria met
**Created:** 2026-03-20
**Scope:** Add DictateButton to all remaining input surfaces; improve UX for unsupported browsers

---

## 1. Goal

Extend the existing DictateButton (Web Speech API, browser-native) to every text input surface in Code Companion. Currently only ReviewPanel, CreateWizard, and BuildWizard have it. Chat mode, SecurityPanel, and Builder panels are missing.

**Non-goals:**

- Whisper/Ollama offline transcription (future enhancement)
- Multi-language support (future — currently en-US only)
- Continuous listening / always-on mode

---

## 2. Current State

| Component                                      | Has Dictation | Notes                                                    |
| ---------------------------------------------- | :-----------: | -------------------------------------------------------- |
| `src/components/DictateButton.jsx`             |     Core      | 81 lines, Web Speech API, `onResult(text)` callback      |
| `src/components/ReviewPanel.jsx`               |      Yes      | Import L7, handler L575, rendered in paste tab           |
| `src/components/CreateWizard.jsx`              |      Yes      | 6 instances on form fields                               |
| `src/components/BuildWizard.jsx`               |      Yes      | 5 instances on form fields                               |
| `src/App.jsx` (Chat)                           |    **NO**     | Main textarea, toolbar has Upload/Paste/Clear but no mic |
| `src/components/SecurityPanel.jsx`             |    **NO**     | Code paste area, same pattern as ReviewPanel             |
| `src/components/builders/BaseBuilderPanel.jsx` |    **NO**     | Shared textarea for all 4 builder modes                  |

---

## 3. Implementation Plan

### 3.1 App.jsx — Chat Input (PRIMARY)

**What:** Add DictateButton to the chat toolbar, next to the existing Upload/Paste/Copy/Markdown/Save/Clear buttons.

**How:**

1. Import DictateButton: `import DictateButton from './components/DictateButton';`
2. Add dictation handler:
   ```javascript
   function handleDictation(text) {
     setInput((prev) => (prev ? prev + " " + text : text));
     textareaRef.current?.focus();
   }
   ```
3. Add button in the toolbar row (after the Clear button, before the spacer):
   ```jsx
   <DictateButton
     onResult={handleDictation}
     disabled={!connected || streaming}
   />
   ```

**Files:** `src/App.jsx`
**Lines:** L1678-1701 (toolbar area — search for `📎 Upload` to find exact location)

### 3.2 SecurityPanel.jsx — Code Paste Area

**What:** Add DictateButton to SecurityPanel's paste/upload tab, matching ReviewPanel's pattern.

**How:**

1. Import: `import DictateButton from './DictateButton';`
2. Add handler:
   ```javascript
   function handleDictation(text) {
     setCode((prev) => (prev ? prev + " " + text : text));
   }
   ```
3. Render next to existing paste/upload controls in the "Paste Code" tab.

**Files:** `src/components/SecurityPanel.jsx`
**Lines:** Textarea at L1498-1506, buttons at L1508-1517. Insert DictateButton after the Clear button (~L1517).

### 3.3 BaseBuilderPanel.jsx — All Builder Modes

**What:** Add DictateButton to the shared textarea in BaseBuilderPanel. This automatically gives dictation to Prompting, Skillz, Agentic, and Planner modes.

**How:**

1. Import: `import DictateButton from '../DictateButton';` (note: relative path from builders/)
2. Textarea is dynamically rendered inside a field loop at L772-783 (`field.type === 'textarea'` conditional). Add DictateButton **inside** this conditional block, after the `</textarea>` tag.
3. Use a generic handler that works for any field name:
   ```jsx
   <DictateButton
     onResult={(text) =>
       updateField(
         field.name,
         (formData[field.name] || "") +
           (formData[field.name] ? " " : "") +
           text,
       )
     }
     disabled={phase !== "input"}
   />
   ```

**Files:** `src/components/builders/BaseBuilderPanel.jsx`
**Lines:** L772-783 (inside `field.type === 'textarea'` conditional)

### 3.4 DictateButton.jsx — Unsupported Browser Tooltip

**What:** When the browser doesn't support Web Speech API, show a helpful tooltip instead of silently disabling.

**What:** DictateButton already has a `title` attribute at L70 for listening/idle states, but it doesn't handle the `!supported` case — showing "Start dictation" even when the button is disabled due to missing browser API.

**How:**

1. Change the existing `title` at L70 from:
   `title={listening ? 'Stop dictation' : 'Start dictation'}`
   to:
   `title={!supported ? 'Voice dictation requires Chrome or Edge' : listening ? 'Stop dictation' : 'Start dictation'}`
2. Optionally add `cursor-not-allowed` when `!supported`

**Files:** `src/components/DictateButton.jsx`

---

## 4. Edge Cases

| Case                                         | Handling                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Browser doesn't support Speech API (Firefox) | Button disabled with tooltip explaining requirement                                                     |
| User denies microphone permission            | `onerror` handler already catches this, logs warning                                                    |
| Dictation while streaming AI response        | Button disabled when `streaming` or `!connected`                                                        |
| Multiple DictateButtons on same page         | Each gets own SpeechRecognition instance (existing pattern in CreateWizard works fine with 6 instances) |
| Empty transcription result                   | `onResult` only fires with non-empty `transcript` (existing guard in DictateButton L36-47)              |
| User clicks dictate then immediately types   | Text appended — no conflict, both inputs coexist                                                        |

---

## 5. Testing Strategy

| Test                            | Method                                                 |
| ------------------------------- | ------------------------------------------------------ |
| Chat dictation renders          | Visual: mic button appears in toolbar                  |
| SecurityPanel dictation renders | Visual: mic button appears in paste tab                |
| Builder dictation renders       | Visual: mic button appears next to textarea            |
| Unsupported browser tooltip     | Open in Firefox → hover disabled mic → see tooltip     |
| Dictation appends text          | Click mic → speak → verify text appended to input      |
| Disabled when offline           | Disconnect Ollama → verify mic button disabled in Chat |

---

## 6. Files to Modify

| File                                           | Change                                                | Effort  |
| ---------------------------------------------- | ----------------------------------------------------- | ------- |
| `src/App.jsx`                                  | Import DictateButton, add handler + button in toolbar | Small   |
| `src/components/SecurityPanel.jsx`             | Import DictateButton, add handler + button            | Small   |
| `src/components/builders/BaseBuilderPanel.jsx` | Import DictateButton, add to form textarea            | Small   |
| `src/components/DictateButton.jsx`             | Add tooltip for unsupported browsers                  | Trivial |

**Total effort:** ~30 minutes, all changes are additive (no refactoring).
**Dependencies:** None — DictateButton already exists and is proven in 3 components.
**New npm packages:** None.

---

## 7. Acceptance Criteria

- [x] Chat mode (App.jsx) has a mic button in the toolbar that appends dictated text to the input
- [x] SecurityPanel has a mic button in the code input area
- [x] All 4 builder modes (Prompting, Skillz, Agentic, Planner) have mic buttons on their primary textarea
- [x] Unsupported browsers show a tooltip on the disabled mic button
- [x] No regressions in existing DictateButton usage (ReviewPanel, CreateWizard, BuildWizard)
- [x] Build passes with no errors
