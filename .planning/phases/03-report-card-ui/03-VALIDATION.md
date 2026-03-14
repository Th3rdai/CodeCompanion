---
phase: 03
slug: report-card-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.x (E2E + component tests) |
| **Config file** | playwright.config.js (Wave 0 installs if missing) |
| **Quick run command** | `npm run test:ui` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:ui`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | REVW-08 | component | `npm run test:ui` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | REVW-08 | E2E | `npm run test:ui` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 0 | REVW-05, REVW-07, REVW-09 | component | `npm run test:ui` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | REVW-05, REVW-07, REVW-09 | E2E | `npm run test:ui` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/ui/loading-animation.spec.js` — Component test for LoadingAnimation with encouraging messages
- [ ] `tests/ui/report-card-interactions.spec.js` — Component tests for progressive disclosure, deep-dive buttons, color-coded grades
- [ ] `tests/ui/input-methods.spec.js` — Component tests for paste/upload/browse tabs with parity validation
- [ ] `tests/e2e/review-workflow.spec.js` — E2E test for full review workflow (input → loading → report → deep-dive)
- [ ] Playwright installation (if not detected) — `npm install -D @playwright/test @playwright/experimental-ct-react`
- [ ] `playwright.config.js` — Configure component testing + E2E testing

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Encouraging message tone feels friendly | REVW-08 | Subjective tone assessment | Read loading messages in dev tools; confirm friendly-teacher tone matches Phase 2 persona |
| Color-coded grades accessible without color vision | REVW-07 | Requires visual inspection with color filters | Use Chrome DevTools "Emulate vision deficiencies" → Protanopia/Deuteranopia; verify icons + labels + letter badges visible |
| Deep-dive button affordance is obvious | REVW-05 | Subjective UX assessment | Show report card to vibe-coder user; confirm they know how to drill into a category without instructions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
