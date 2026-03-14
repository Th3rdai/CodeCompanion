---
phase: 02
slug: tone-unification
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-13
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.js |
| **Quick run command** | `npm test -- tests/tone-validation.test.js` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/tone-validation.test.js`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | TONE-01 | unit | `npm test -- tests/tone-validation.test.js` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | UX-02 | unit | `npm test -- tests/ui-labels.test.js` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | TONE-01 | regex | `npm test -- tests/tone-validation.test.js` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | TONE-02,03,04,05 | regex | `npm test -- tests/tone-validation.test.js` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | UX-02 | regex | `npm test -- tests/ui-labels.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/tone-validation.test.js` — validates no PM language in prompts
- [ ] `tests/ui-labels.test.js` — validates mode labels are jargon-free

*Wave 0 creates test infrastructure for automated tone validation*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vibe-coder comprehension | TONE-02,03,04 | Subjective understanding check | Paste sample output to non-technical user, ask "what does this mean?" |
| Friendly-teacher tone consistency | TONE-01 | Qualitative tone assessment | Read 3 mode outputs, verify consistent warmth/patience |

*Some aspects require human judgment beyond regex validation*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
