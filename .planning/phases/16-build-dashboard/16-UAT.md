---
status: testing
phase: 16-build-dashboard
source: Phase 1 implementation (this session)
started: 2026-03-14T23:00:00Z
updated: 2026-03-14T23:00:00Z
---

## Current Test

number: 1
name: Build Project List Loads
expected: |
  Switch to Build mode. If projects exist, see a list of project cards with name, path, last activity, and status badges (MISSING if folder gone, NO PLANNING if .planning/ absent). If no projects, see empty state with "New Project" button.
awaiting: user response

## Tests

### 1. Build Project List Loads
expected: Switch to Build mode. If projects exist, see a list of project cards with name, path, last activity, and status badges (MISSING if folder gone, NO PLANNING if .planning/ absent). If no projects, see empty state with "New Project" button.
result: [pending]

### 2. New Project → BuildWizard
expected: From project list, click "+ New Project". BuildWizard appears. Complete the wizard. After success, project appears in the project list and dashboard opens for that project.
result: [pending]

### 3. Auto-Registration After Scaffold
expected: After creating a project via BuildWizard, the project automatically appears in the project list without manual registration. Refresh the browser — the project persists in the list.
result: [pending]

### 4. Dashboard View Opens
expected: Click a project card in the list. Dashboard view opens showing project name, path, "All Projects" back link, Refresh button, and View Files button. Phase list loads from GSD roadmap (or shows "No phases found" with /gsd:new-project hint).
result: [pending]

### 5. Import Existing Project
expected: In terminal, create a test folder with a .planning/ directory: `mkdir -p /tmp/test-import/.planning && echo "test" > /tmp/test-import/.planning/STATE.md`. In the app, use the import feature (POST /api/build/projects with path). The project appears in the list.
result: [pending]

### 6. Import Auto-Scaffolds Planning
expected: Create a folder WITHOUT .planning/: `mkdir -p /tmp/test-no-planning`. Import it via POST /api/build/projects. The import succeeds and auto-creates .planning/ with PROJECT.md, ROADMAP.md, STATE.md, REQUIREMENTS.md, config.json.
result: [pending]

### 7. Remove Project from List
expected: From project list, click the Remove button on a project card. Project disappears from the list. The project folder still exists on disk (only unregistered, not deleted).
result: [pending]

### 8. isWithinBasePath Blocks Traversal
expected: In browser DevTools console, run: `fetch('/api/build/projects/fake/state').then(r=>r.json()).then(console.log)`. Should return 404 "Project not found", not a server crash. The isWithinBasePath function prevents path traversal in GitHub repo file reads.
result: [pending]

### 9. Rate Limiting on Build Routes
expected: Rapidly send 15+ POST requests to /api/build/projects in quick succession (via DevTools or curl). After exceeding the limit, responses return 429 "Too many requests" with a Retry-After header.
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0

## Gaps

[none yet]
