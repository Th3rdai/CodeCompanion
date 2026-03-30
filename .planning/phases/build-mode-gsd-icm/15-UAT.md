---
status: testing
phase: build-mode-gsd-icm
source: DRAFT-PLAN.md, APPROVED.md
started: 2026-03-14T23:00:00Z
updated: 2026-03-14T23:00:00Z
---

## Current Test

number: 1
name: Build Mode Tab Visible
expected: |
Open Code Companion in browser. Mode tab bar shows "Build" with a construction icon (🏗️) next to "Create". Clicking it switches to Build mode.
awaiting: user response

## Tests

### 1. Build Mode Tab Visible

expected: Open Code Companion in browser. Mode tab bar shows "Build" with a construction icon next to "Create". Clicking it switches to Build mode.
result: [pending]

### 2. BuildWizard Step 1 — Project Info

expected: In Build mode, click "New Project". Step 1 shows Project name (required) and "What do you want to build?" textarea. Dictate buttons appear next to both inputs. Entering a name shows slug preview below. "Next" is blocked if name is empty.
result: [pending]

### 3. BuildWizard Step 2 — Audience & Tone

expected: Click Next from Step 1. Step 2 shows Target audience input and Tone dropdown (Friendly, Professional, Technical, Warm, Custom). Selecting "Custom" reveals a text input. Dictate buttons work on inputs.
result: [pending]

### 4. BuildWizard Step 3 — Output Location

expected: Click Next from Step 2. Step 3 shows parent folder input (default ~/AI_Dev/). Path preview shows "Project will be created at: ~/AI_Dev/slug-name". Overwrite checkbox is present.
result: [pending]

### 5. BuildWizard Step 4 — Review & Create

expected: Click Next from Step 3. Step 4 shows all entered values in a summary (Name, Slug, Description, Audience, Tone, Path, Overwrite). "Create Build Project" button is at bottom.
result: [pending]

### 6. Scaffold Creates Combined GSD+ICM Structure

expected: Complete wizard to create a project. Check the created folder on disk. It should contain: .planning/ (PROJECT.md, ROADMAP.md, STATE.md, REQUIREMENTS.md, config.json, phases/), stages/ (01-research, 02-draft, 03-review each with CONTEXT.md and output/), \_config/brand-voice.md, skills/gsd-workflows.md, CLAUDE.md, CONTEXT.md, README.md, .editorconfig.
result: [pending]

### 7. Multi-Tool Convention Files

expected: Check the scaffolded project folder. All four AI tool convention files exist with identical content: CLAUDE.md, .cursorrules, .windsurfrules, .opencode/instructions.md. Each contains the project name, folder map, workflows section, and rules.
result: [pending]

### 8. Chat Input Hidden in Build Mode

expected: Switch to Build mode. The chat input textarea at the bottom should NOT be visible (same as Create and Review modes).
result: [pending]

### 9. Error — Missing Name

expected: In BuildWizard Step 1, leave name empty and click Next. Validation error appears: "Project name is required." Form does not advance.
result: [pending]

### 10. Error — Path Outside Allowed Root

expected: In Step 3, enter an output path outside allowed roots (e.g., /etc/test). Submit the wizard. Error message appears indicating the path is not allowed.
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0

## Gaps

[none yet]
