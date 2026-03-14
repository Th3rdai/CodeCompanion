---
status: complete
phase: create-mode
source: Create-Mode-Feature-Plan.md
started: 2026-03-13T02:45:00Z
updated: 2026-03-14T05:35:00Z
---

## Current Test

number: 11
name: Works While Ollama is Offline
expected: |
  If the Ollama offline banner is showing (yellow warning bar at top),
  the Create tab and wizard are still fully usable — all steps navigate,
  the Create button submits, and a project is scaffolded.
  The wizard never shows a "connect to Ollama first" error.
awaiting: user response

## Tests

### 1. Create Tab Appears
expected: The mode tab bar shows all 7 tabs in order: Chat, Explain, Bug Hunter, Refactor, Tech → Biz, Biz → Tech, Create. The Create tab has a 🛠️ icon and is clickable.
result: pass

### 2. Clicking Create Shows Wizard
expected: Clicking the Create tab replaces the chat area with a wizard. You see "Create New Project" heading, a 5-step progress indicator (1●—2—3—4—5), and the first step title "Project Info". The normal textarea and Send button are NOT visible.
result: pass

### 3. Step 1 — Project Info Fields
expected: Step 1 shows three fields: Project Name (required), Description (optional), and AI Role (required). Typing in Project Name shows a live slug preview below it (e.g. "My Blog" → slug: my-blog). The Next button is disabled until Name and AI Role are filled.
result: pass

### 4. Step 2 — Audience & Tone
expected: Clicking Next reaches Step 2 "Audience & Tone". There is a Target Audience textarea and a grid of 5 tone preset buttons (Professional, Friendly, Technical, Executive, Custom…). Selecting "Custom…" reveals a text area for a custom tone description. Next is disabled until Audience is filled.
result: pass

### 5. Step 3 — Stages
expected: Step 3 "Stages" shows 3 default stages (Research, Draft, Review), each with a name field and a purpose textarea. There is an "+ Add Stage" button at the bottom. Stages can be removed (✕ button) as long as at least 1 remains.
result: pass

### 6. Step 4 — Output Location
expected: Step 4 "Output Location" shows a text input pre-filled with ~/AI_Dev. Below it, a path preview box shows the full resolved path (e.g. ~/AI_Dev/my-blog-assistant). There is an "Overwrite if project already exists" checkbox.
result: pass

### 7. Step 5 — Review & Create
expected: Step 5 "Review & Create" shows a summary table with all entered values (Project, Role, Audience, Tone, Stages list, Output path). There is a "🛠️ Create Project" button. A "← Back" button is available to go back.
result: pass

### 8. Successful Project Creation
expected: Clicking "Create Project" with valid data shows a loading spinner ("Scaffolding project…"). After completion: the file browser opens on the right side showing the new project folder, a toast notification appears at the top ("Project created at ~/AI_Dev/your-project"), and the project folder is visible in the file tree.
result: pass
notes: Required fix — FileBrowser was not passing folder path to /api/files/tree API, causing race condition. Fixed by passing folder as query param.

### 9. Error — Duplicate Project
expected: If you try to create a project with the same name as an existing folder (without checking Overwrite), the wizard shows an error message inside the Step 5 card ("Project already exists at …") and stays on the Review step — no file browser opens, nothing is deleted.
result: pass
notes: Required fix — added overwrite checkbox to Step 4 and wired state to API call (was hardcoded false). Backend already returned 409 correctly.

### 10. Other Modes Still Work
expected: After using Create mode, clicking the Chat tab shows the normal empty state with chat textarea and Send button. Sending a message works normally. No regressions in existing modes.
result: pass

### 11. Works While Ollama is Offline
expected: If the Ollama offline banner is showing (yellow warning bar at top), the Create tab and wizard are still fully usable — all steps navigate, the Create button submits, and a project is scaffolded. The wizard never shows a "connect to Ollama first" error.
result: pass

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
