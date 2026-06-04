# Development path (canonical)

**Last updated:** 2026-06-04 · **Trunk:** `origin/master`

## Decision

| Choice                                 | Rationale                                                                                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Single trunk: `master`**             | REORGPLAN (Phases 1–6), OpenRouter, v1.7.4, and spawn/tool fixes are merged via PR #2. All new work branches from `master` and merges back via PR. |
| **Abandon `feature/create-mode-mvp`**  | PM delivery-console experiment (`aff6eb6`); months behind trunk. No unique commits worth rebasing.                                                 |
| **Abandon `archon/thread-*` branches** | Valuable deltas were ported to `master` (see below); branches are archival only.                                                                   |
| **No long-lived `main`**               | Remote `main` removed; `master` is default.                                                                                                        |

## What ships next

1. **Stabilization on `master`** — small, reviewable commits (memory leak, review guards, rate-limit config).
2. **Release** — cut **v1.7.5** from `CHANGELOG` [Unreleased] when ready (privacy messaging, post-REORGPLAN layout); tag → GitHub Releases for Electron auto-update.
3. **Backlog** (not scheduled phases) — Playwright flakes, File Browser edge cases, history timestamps (see `.planning/STATE.md`).

## Optional later

- **REORGPLAN Phase 5 (full)** — subfolders under `lib/` only if a module grows painful; flat `lib/` is fine for now.
- **Archon / GSD** — use for task tracking; do not keep parallel git branches for the same work.

## Branch hygiene

```bash
# After confirming no unpushed work you need:
git worktree remove ~/.cursor/worktrees/AIApp-CodeCompanion/ypw  # if present
git branch -D feature/create-mode-mvp archon/thread-0def3517 archon/thread-d5857fde
git push origin --delete feature/create-mode-mvp   # if remote still exists
```

## Ported from abandoned branches (2026-06-04)

| Source                               | On `master`                                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `archon/thread-0def3517` (`05d9787`) | SSE `pendingConfirmations` cleanup; configurable `cmdRateLimit` / `cmdRateWindowMs` (image enrichment already via `messagesWithImagesOnLastUser`) |
| `archon/thread-d5857fde` (`a8e1038`) | Review folder 50MB body limit (`startsWith`), multi-file fallback filename instruction, route WARN logs, `folder-guards` integration tests        |
