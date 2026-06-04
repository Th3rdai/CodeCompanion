# SIP — Work In Progress (Coco's proposals inbox)

> **Owner: Coco (the in-app CodeCompanion agent).** This is Coco's own channel for
> recording self-improvement requests. **Other agents/humans: please do not
> overwrite or "simplify" this file** — append review notes under an item instead.
>
> **Relationship to [`SIP.md`](SIP.md):**
>
> - `SIP_WIP.md` (this file) = **proposals & requests awaiting review.** Coco writes here freely.
> - `SIP.md` = the **approved, canonical record.** An item moves here only after sign-off.
>
> A proposal does **not** auto-promote to action. Lifecycle: _Coco drafts in WIP →
> reviewed → promoted to `SIP.md` (Shipped or Open) or declined with a note._

_Last reviewed: 2026-05-25 (plan-reviewer pass against working tree)._

---

## Shipped — already implemented (do not re-build)

These were once open goals; verified present in the codebase. Listed so they are
not re-attempted.

- **Memory retrieval index cache** — `_indexCache` built once per memory version
  and invalidated on change. `lib/memory.js:16`, `lib/memory.js:97-125`,
  `lib/memory.js:83-90`.
  ⚠️ **Built but OFF by default** — gated on `config.memory.indexCache.enabled`
  (`lib/memory.js:94`, `lib/memory.js:1585`), default `false`
  (`lib/config.js:173-175`). See Open item O1.
- **Response-time trims** — project-context cap `PROJECT_CONTEXT_MAX_CHARS = 3000`
  (`lib/chat-post-handler.js:61`, applied `:636`); compact external MCP tool
  descriptions `compactMcpTools: true` (`lib/config.js:163`).
- **Slow-model self-heal** — auto-switch a too-slow auto-resolved model mid-turn
  (`slowModelSwitchSec: 90`, `lib/config.js:105`; loop `lib/chat-post-handler.js:1286-1597`).
  ⚠️ See Open item O2 — landed in commit `600ecf5`, **not yet shipped to users**.
- **Project vs. agent memory separation** — project-identity memories kept unique
  per project (`_projectIdentityName` `lib/memory.js:1317`; dedup fast-path
  `lib/memory.js:1340-1365`); `buildMemoryContext` scopes facts/project/summaries
  via type+source indices.

## Open — concrete, ready to act

Each item needs a measurable acceptance check before it's "done."

- **O1 — Decide whether to enable `indexCache` by default.**
  The speedup mechanism exists but is dormant (`lib/config.js:174` = `false`).
  - _Why it's not already on:_ correctness under concurrent memory writes
    (multi-agent + auto-extract) needs validation — the cache invalidates via
    `_markMemoryCollectionChanged`, which every mutation must call.
  - _Acceptance:_ flip default to `true`; add a test that a write during recall
    invalidates the cache (no stale pool returned); `p50 buildMemoryContext`
    measured via `_logTiming` stays below baseline at 500 memories.
- **O2 — Ship the slow-model self-heal to users.**
  Commit `600ecf5` is **local-only** (HEAD `600ecf5`, `origin/master` `7c0e5c8`,
  ahead 1) and **not** in released v1.6.49. Installed users don't have it.
  - _Acceptance:_ `600ecf5` pushed to `origin/master`; bundled into v1.6.50;
    release workflow green across macOS/Windows/Linux.

## Backlog — ideas, not yet scoped

> Speculative. Promote to Open only after a concrete acceptance check is defined.

- _(none yet — Coco: add ideas here)_

---

### How to log a new request (for Coco)

Append under **Backlog** with: one-line intent, why it matters, and (if known) the
files involved. A reviewer scopes it into **Open** with an acceptance check, or
declines it with a dated note. Approved + verified items graduate to `SIP.md`.
