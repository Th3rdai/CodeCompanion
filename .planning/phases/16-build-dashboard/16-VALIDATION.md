---
phase: 16
slug: build-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright ^1.58.2 |
| **Config file** | playwright.config (implicit) |
| **Quick run command** | `npx playwright test tests/ui/build-*.spec.js --project=chromium` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test tests/ui/build-*.spec.js --project=chromium`
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | P2-01 | unit | `npx playwright test tests/ui/build-simple-view.spec.js -x` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | P2-02 | unit | `npx playwright test tests/ui/build-simple-view.spec.js -x` | ❌ W0 | ⬜ pending |
| 16-01-03 | 01 | 1 | P2-03 | unit | `npx playwright test tests/ui/build-simple-view.spec.js -x` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 2 | P3-01 | unit | `npx playwright test tests/ui/build-ai-ops.spec.js -x` | ❌ W0 | ⬜ pending |
| 16-03-01 | 03 | 3 | P4-01 | unit | `npx playwright test tests/ui/build-advanced-view.spec.js -x` | ❌ W0 | ⬜ pending |
| 16-03-02 | 03 | 3 | P4-02 | unit | `node --test tests/unit/build-file-ops.test.js` | ✅ W0 | ✅ green |
| 16-04-01 | 04 | 4 | P5-01 | unit | `npx playwright test tests/ui/build-handoff.spec.js -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/ui/build-simple-view.spec.js` — stubs for P2-01, P2-02, P2-03
- [ ] `tests/ui/build-ai-ops.spec.js` — stubs for P3-01
- [ ] `tests/ui/build-advanced-view.spec.js` — stubs for P4-01
- [x] `tests/unit/build-file-ops.test.js` — P4-02 integration tests (whitelist, 403, traversal, atomic write)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI recommendation quality | P2-03 | Depends on Ollama model output | Trigger "What's Next" and verify recommendation is contextual |
| SSE stream renders in real-time | P3-01 | Visual streaming verification | Start research, verify chunks appear progressively |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
