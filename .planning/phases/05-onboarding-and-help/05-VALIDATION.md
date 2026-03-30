---
phase: 05
slug: onboarding-and-help
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-14
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                           |
| ---------------------- | --------------------------------------------------------------- |
| **Framework**          | Playwright 1.58.2 (E2E + Component Testing)                     |
| **Config file**        | playwright.config.js (E2E), playwright-ct.config.js (Component) |
| **Quick run command**  | `npm run test:ui`                                               |
| **Full suite command** | `npm test`                                                      |
| **Estimated runtime**  | ~45 seconds                                                     |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:ui`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement         | Test Type       | Automated Command                              | File Exists | Status     |
| -------- | ---- | ---- | ------------------- | --------------- | ---------------------------------------------- | ----------- | ---------- |
| 05-01-01 | 01   | 1    | UX-01, UX-04        | component       | `npm run test:ui -- OnboardingWizard.spec.jsx` | ❌ W0       | ⬜ pending |
| 05-01-02 | 01   | 1    | UX-01               | manual          | Manual localStorage verification               | N/A         | ⬜ pending |
| 05-02-01 | 02   | 1    | UX-03               | component       | `npm run test:ui -- JargonGlossary.spec.jsx`   | ❌ W0       | ⬜ pending |
| 05-02-02 | 02   | 1    | UX-01, UX-03, UX-04 | E2E + component | `npm test -- tests/ui/`                        | ❌ W0       | ⬜ pending |
| 05-02-03 | 02   | 1    | UX-04               | E2E             | `npm test -- tests/ui/privacy-banner.spec.js`  | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `tests/ui/onboarding.spec.js` — E2E test for first-launch onboarding display (UX-01)
- [ ] `tests/ui/OnboardingWizard.spec.jsx` — Component tests for wizard behavior and keyboard navigation (UX-01)
- [ ] `tests/ui/JargonGlossary.spec.jsx` — Component tests for tooltip and panel behavior (UX-03)
- [ ] `tests/ui/glossary.spec.js` — E2E test for glossary panel open/close/search (UX-03)
- [ ] `tests/ui/privacy-banner.spec.js` — E2E test for banner visibility and dismissal (UX-04)

_Framework install: None needed — Playwright 1.58.2 already installed (package.json)_

---

## Manual-Only Verifications

| Behavior                                | Requirement | Why Manual                                      | Test Instructions                                                                                                                                                                         |
| --------------------------------------- | ----------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Onboarding localStorage persistence     | UX-01       | localStorage state inspection requires DevTools | 1. Clear localStorage via Console: `localStorage.removeItem('th3rdai_onboarding_complete')` 2. Refresh browser 3. Complete wizard 4. Refresh again 5. Verify wizard does NOT reappear     |
| Privacy banner localStorage persistence | UX-04       | localStorage state inspection requires DevTools | 1. Clear localStorage via Console: `localStorage.removeItem('th3rdai_privacy_banner_dismissed')` 2. Refresh browser 3. Dismiss banner 4. Refresh again 5. Verify banner does NOT reappear |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-14
