---
phase: 28
slug: multi-file-code-review
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-09
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (unit), Playwright (E2E) |
| **Config file** | package.json scripts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test && npm run test:integration` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test && npm run test:integration`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 28-01-01 | 01 | 1 | reviewFiles() function | unit | `npm test -- --grep reviewFiles` | ❌ W0 | ⬜ pending |
| 28-01-02 | 01 | 1 | /api/review/folder/preview endpoint | integration | `npm run test:integration` | ❌ W0 | ⬜ pending |
| 28-01-03 | 01 | 1 | /api/review/folder endpoint | integration | `npm run test:integration` | ❌ W0 | ⬜ pending |
| 28-02-01 | 02 | 2 | Scan Folder tab renders | manual | — | — | ⬜ pending |
| 28-02-02 | 02 | 2 | Drag-drop file/folder | manual | — | — | ⬜ pending |
| 28-02-03 | 02 | 2 | Preview step shows file list | manual | — | — | ⬜ pending |
| 28-02-04 | 02 | 2 | Unified report card renders | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/review-files.test.js` — unit stubs for reviewFiles() with separator concatenation
- [ ] `tests/integration/review-folder.test.js` — integration stubs for /api/review/folder routes

*If Wave 0 is impractical given the project's test setup, mark tasks as manual verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scan Folder tab renders with correct indigo accent | CONTEXT: tab design | UI appearance | Open Review mode, verify 2 tabs: Single File + Scan Folder with indigo-500 border |
| Drag-drop accepts files and folders | CONTEXT: input methods | Requires browser interaction | Drag a folder onto the Scan Folder drop zone, verify files listed |
| Preview step shows file count + sizes | CONTEXT: preview step | Requires full server stack | Submit folder path, verify preview renders before final submit |
| >20 files warning appears | CONTEXT: file limits | Requires test folder | Create folder with 21+ files, verify warning message shown |
| Unified report card covers cross-file findings | CONTEXT: report card format | Requires Ollama running | Submit 3+ JS files, verify report card mentions multiple files |
| Deep Dive and export work after folder review | CONTEXT: post-review actions | Requires full flow | Complete folder review, test Deep Dive chat + export button |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
