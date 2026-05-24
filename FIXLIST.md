# FIXLIST — Code Companion Improvement Tracking

**Status:** Active
**Created:** 2026-05-24
**Last Updated:** 2026-05-24

## Overview

Master tracking document for planned improvements from `.planning/drafts/`. Total estimated effort: ~21-28 days.

**Implementation order:** Priority-based, low-risk first, with flag-gating for behavioral changes.

---

## 🔴 Priority 1: RESPONSEFIX — Critical Bug Fix

**Source:** `.planning/drafts/RESPONSEFIX.md`
**Severity:** HIGH — Affects every chat interaction
**Total Effort:** 3-5 days
**Assignee:** Claude Code

### Phase 1: Centralize Output Sanitization (1-2 days)

- [ ] Add shared `sanitizeAssistantChunk(input, state)` utility in `lib/chat-post-handler.js`
- [ ] Add shared `sanitizeAssistantFinal(input)` utility
- [ ] Apply sanitizer before every `sendEvent({ token })` in:
  - [ ] Tool-call final-text path
  - [ ] Fallback streaming path
  - [ ] Standard streaming path
- [ ] Acceptance: No `<think>` or `<thought>` in SSE token events
- [ ] Acceptance: Existing non-reasoning responses unchanged

**Tests:**
- [ ] Update `tests/unit/chat-post-handler-phase3-wiring.test.js` for sanitizer coverage
- [ ] Update `tests/unit/chat-empty-response.test.js` for empty-output behavior

### Phase 2: Stream-Safe Stateful Filtering (1 day)

- [ ] Implement state machine for tag fragments across chunk boundaries
- [ ] Track parser state (inside/outside reasoning block)
- [ ] Buffer partial tag fragments between chunks
- [ ] Emit only safe text segments
- [ ] Final flush on stream completion
- [ ] Acceptance: Chunk-split tags (e.g., `<tho` + `ught>`) fully filtered
- [ ] Acceptance: Unterminated reasoning blocks don't leak

**Tests:**
- [ ] Add `tests/unit/chat-post-handler-reasoning-stream.test.js` with:
  - [ ] Fallback path chunk split (`<tho` + `ught>`)
  - [ ] Standard path chunk split
  - [ ] Unterminated blocks
  - [ ] Malformed closing boundaries

### Phase 3: Final Answer Quality Gate (1 day)

- [ ] Track visible token count after sanitization
- [ ] Apply completion contract: flush → check zero → emit error/done/[DONE]
- [ ] Emit `buildEmptyAssistantReplyMessage(model)` on zero visible tokens
- [ ] Single finalization gate per request
- [ ] Recovery pass (tool-call mode only): reuse `generateFinalTextFromToolResults`
- [ ] Acceptance: Server-side empty-output handling (not client fallback)
- [ ] Acceptance: One `done` and one `[DONE]` per request

**Tests:**
- [ ] Zero-token streaming completion scenarios
- [ ] Finalization gate single-emit invariant

---

## 🟡 Priority 2: CTXFIX Phases 4-5 — Quick Wins

**Source:** `.planning/drafts/CTXFIX.md`
**Severity:** MEDIUM — Improves diagnostics
**Total Effort:** 1-2 days
**Assignee:** Cursor

### Phase 4: Better 500 Handling (1 day)

- [ ] Extend `parseOllamaErrMsg` in `lib/ollama-client.js` for JSON parsing
  - [ ] Add `tryExtractJson(s)` helper (4096 char cap, try last `{` first)
  - [ ] Return `{status, detail, code, errType}` with backwards compat
- [ ] Add `model-load-failed` rule in `formatUserOllamaChatError`
  - [ ] Detect: `manifest unknown`, `blob not found`, `failed to load model`, `model not loaded`
  - [ ] Insert between `model-not-found` (line 158) and `gpu-oom` (line 160)
- [ ] Refactor to `tryRule(name, predicate, message)` helper
- [ ] Add optional `{ log }` parameter to `formatUserOllamaChatError`
- [ ] Update 4 call sites in `lib/chat-post-handler.js` to pass `log`
- [ ] Canonical rule names (kebab-case): `network-unreachable`, `context-overflow`, `model-not-found`, `model-load-failed`, `gpu-oom`, `cloud-opaque-500`, `large-payload-500`, `generic`

**Commit order:**
1. [ ] Add `model-load-failed` rule inline
2. [ ] Extend `parseOllamaErrMsg` for JSON
3. [ ] Refactor to `tryRule` + add `log` parameter

**Tests:**
- [ ] Extend `tests/unit/ollama-error-envelope.test.js` with:
  - [ ] JSON-body fixture (verify `code`, `errType` populated)
  - [ ] `model-load-failed` rule (4 keyword variants)
  - [ ] `matched` rule-name assertion for all 6 existing rules
  - [ ] Malformed/nested-brace string for fail-closed behavior

### Phase 5: MCP Documentation (2 hours)

- [ ] Write `docs/MCP-SANDBOX-PATTERNS.md`
  - [ ] External sandbox/index MCP server patterns
  - [ ] Context management best practices
  - [ ] When to use MCP vs builtin tools
- [ ] No code changes

---

## 🟢 Priority 3: MEMORYFIX Phases 1a-1b — Correctness

**Source:** `.planning/drafts/MEMORYFIX.md`
**Severity:** MEDIUM — Foundation for quality improvements
**Total Effort:** 3 days
**Assignee:** Claude Code

### Phase 1a: Config & Persistence Correctness (2 days)

- [ ] Wire `maxMemories` config key in `lib/config.js`
- [ ] Match defaults to `.cc-config.json.example`
- [ ] Implement `POST /api/memory/reembed` route (Settings UI already calls it)
- [ ] Persist `topics: string[]` field on summary memory records
- [ ] Update `addMemory()` to accept optional `topics` on summaries only
- [ ] Register `flushMemoryToDisk()` on process shutdown in `server.js`
- [ ] Update `docs/ENVIRONMENT_VARIABLES.md` with memory config keys

**Tests:**
- [ ] Config key defaults match example
- [ ] Re-embed API returns 200 with correct behavior
- [ ] `topics` field persists on summary records
- [ ] Process shutdown flushes memory to disk

### Phase 1b: Query & API Correctness (1 day)

- [ ] Filter stale `embeddingModel` in `searchMemories()` (skip mismatched records)
- [ ] Include `id` field in SSE `memoryContext.items` before Phase 3 ships
- [ ] Fix `updateMemory()` `allowedFields` to be complete
- [ ] Debounce `_persistToDisk()` writes
- [ ] Fix hardcoded `500` in `extractAndStore` → read `config.memory.maxMemories`

**Tests:**
- [ ] Stale embedding model records excluded from search
- [ ] SSE memory context includes `id` field
- [ ] `updateMemory()` accepts all valid fields
- [ ] Debounced writes don't lose data

**GitNexus Impact:**
- [ ] Run `gitnexus_impact` on: `extractAndStore`, `buildMemoryContext`, `_persistToDisk`, `searchMemories`

---

## 🔵 Priority 4: CTXFIX Phase 1 — Preflight Banner (Flag-gated)

**Source:** `.planning/drafts/CTXFIX.md`
**Severity:** LOW — Prevents user frustration
**Total Effort:** 2 days
**Assignee:** Cursor
**Flag:** `context.preflightBanner` (default `false`)

### Implementation (2 days)

- [ ] Add `GET /api/model-context` endpoint
  - [ ] Returns `{ contextLength, unit }`
  - [ ] Uses shared `getContextLengthForModel()` (no inline duplication)
- [ ] Add client-side `ctxTarget` computation in chat toolbar
  - [ ] Estimate tokens: `ceil(totalChars / 3.5)`
  - [ ] Banner triggers at 90% of context length
- [ ] Add `<PreflightBanner>` component
  - [ ] Shows when estimated > 90% of model context
  - [ ] Actions: "Shorten conversation" / "Continue anyway"
  - [ ] Dismissible with "Don't show again" (localStorage)
- [ ] Add `context.preflightBanner` config key
- [ ] Wire flag through settings UI

**Tests:**
- [ ] `/api/model-context` returns correct values for common models
- [ ] Banner appears at 90% threshold
- [ ] Banner actions work correctly
- [ ] Flag disables feature when `false`

**Note:** Banner is client-side heuristic and may underestimate vs server's `fullMessages`

---

## 🟣 Priority 5: MEMORYFIX Phase 2 — Recall Quality

**Source:** `.planning/drafts/MEMORYFIX.md`
**Severity:** MEDIUM — Improves conversation context
**Total Effort:** 2 days
**Assignee:** Claude Code

### Implementation (2 days)

- [ ] Multi-turn query embedding in `buildMemoryContext()`
  - [ ] Combine last 2-3 user messages into query
  - [ ] Weight recent messages higher
- [ ] Scored ranking with Reciprocal Rank Fusion (RRF)
  - [ ] Combine BM25 keyword + semantic vector scores
  - [ ] Return top-k by fused score
- [ ] Add `nearMisses` field to SSE memory context (optional, for debugging)
- [ ] Update memory prompt injection with scored context

**Tests:**
- [ ] Multi-turn query produces different results than single-turn
- [ ] RRF ranking improves over single-method ranking
- [ ] Near-misses field present when configured

**Risk:** Medium - changes recall behavior, but flag can gate if needed

---

## 🟠 Priority 6: CTXFIX Phase 3 — Tool Output Cap (Flag-gated)

**Source:** `.planning/drafts/CTXFIX.md`
**Severity:** MEDIUM — Prevents token blowup
**Total Effort:** 2 days
**Assignee:** Cursor
**Flag:** `context.toolExternalize` (default `false`)

### Implementation (2 days)

- [ ] Add 100KB per-round cap on `toolResults` text
- [ ] Externalize large outputs to temp files under `config.projectFolder`
  - [ ] Use relative paths compatible with `readProjectFile`
  - [ ] Files readable by MCP `codecompanion_read_file`
- [ ] Replace large content with placeholder: `[Output saved to tools/output_TIMESTAMP.txt]`
- [ ] Externalize BEFORE wrapping in `loopMessages` and `toolContextForHistory`
- [ ] Add `context.toolExternalize` config key
- [ ] Wire flag through settings UI

**Tests:**
- [ ] Large tool output (>100KB) externalized to file
- [ ] Placeholder includes correct relative path
- [ ] Externalized content readable via `readProjectFile`
- [ ] Flag disables feature when `false`
- [ ] Integration test asserts placeholder path format

**Scope:** Covers `toolResults` text only; `toolResultMsg.images` (PDF rasters) out of scope for v1

---

## 🔴 Priority 7: CTXFIX Phase 2 — History Compaction (Flag-gated, HIGH RISK)

**Source:** `.planning/drafts/CTXFIX.md`
**Severity:** HIGH — Changes conversation behavior
**Total Effort:** 3-4 days
**Assignee:** Claude Code
**Flag:** `context.compaction` (default `false`)

**Note:** Plan explicitly says "ship last because highest behavioral impact"

### Implementation (3-4 days)

- [ ] Add `context.windowPolicy` config key (e.g., `8000` chars)
- [ ] Trigger compaction when `totalChars > windowPolicy`
- [ ] Run compaction AFTER existing totalChars measurement (~782-786)
- [ ] Run compaction BEFORE auto-bump (~793)
- [ ] Server-side conversation summarization via `chatComplete`
  - [ ] Summarize oldest messages
  - [ ] Inject as single system message
- [ ] Recompute `totalChars` / `estimatedTokens` in place after compaction
- [ ] SSE notices (snake_case):
  - [ ] `compaction_summary`: success, chars saved
  - [ ] `compaction_fallback`: LLM failed, manual truncate used
  - [ ] `compaction_skipped`: user opted out or flag disabled
- [ ] Add `context.compaction` config key
- [ ] Wire flag through settings UI
- [ ] Grep `fullMessages` for stale closures after implementation

**Tests:**
- [ ] Compaction triggers at policy threshold
- [ ] Summary preserves conversation coherence
- [ ] Fallback truncation works when LLM unavailable
- [ ] Token count decreases after compaction
- [ ] Flag disables feature when `false`
- [ ] Manual test: dual `role: "system"` messages in rebuilt transcript

**Risk:** HIGH - fundamentally changes how conversation context works

---

## 🟢 Priority 8: MEMORYFIX Phases 3-5 — Polish & Performance (Optional)

**Source:** `.planning/drafts/MEMORYFIX.md`
**Severity:** LOW — Polish features
**Total Effort:** 5-6 days
**Assignee:** Mix (Claude for 3-4, Cursor for 5)

### Phase 3: Extraction Efficiency (2 days, flag-gated)

**Assignee:** Claude Code
**Flag:** `memory.enhancedRecall` (default `false`)

- [ ] Incremental extraction (only new messages since last extract)
- [ ] Rolling memory summary upserts
- [ ] Track last extraction timestamp per conversation
- [ ] Update extraction to process delta only

**Tests:**
- [ ] Incremental extraction processes only new messages
- [ ] Rolling upserts preserve existing summaries
- [ ] Timestamp tracking accurate

### Phase 4: Performance (1-2 days)

**Assignee:** Claude Code

- [ ] Debounce disk writes (already in 1a, may need tuning)
- [ ] Enhance `compactMemories()` to:
  - [ ] Minify JSON (remove whitespace)
  - [ ] Prune orphaned records (conversations deleted)
  - [ ] Report space saved
- [ ] Add `POST /api/memory/compact` endpoint
- [ ] Wire to Settings UI

**Tests:**
- [ ] Compact removes orphaned records
- [ ] JSON minification reduces file size
- [ ] Compact API returns space saved

### Phase 5: User Trust (2 days)

**Assignee:** Cursor

- [ ] "Forget" button on memory chips in chat
  - [ ] Remove specific memory by `id`
  - [ ] Confirm dialog
- [ ] "Pin" toggle for important memories
  - [ ] Add `pinned: boolean` field
  - [ ] Pinned memories always included (bypass threshold)
- [ ] Memory management in Settings
  - [ ] List all memories with filters
  - [ ] Bulk delete
  - [ ] Export memories as JSON

**Tests:**
- [ ] Forget removes correct memory
- [ ] Pinned memories always recalled
- [ ] Bulk operations work correctly

---

## ⚠️ Not Included in Sequential Implementation

### ❌ SETUPUX
**Status:** Already shipped (v1) ✅
**Source:** `.planning/drafts/SETUPUX.md` says "Status: Shipped"

### ❌ enterprise-privacy-pivot
**Status:** Strategic/architectural change
**Source:** `.planning/drafts/enterprise-privacy-pivot.md`
**Recommendation:** Plan as separate v2.0 milestone with its own roadmap

---

## 📊 Progress Summary

**Total Items:** 8 priorities, ~25 phases/sub-phases
**Total Effort:** 21-28 days
**Completed:** 0 / 8 priorities
**In Progress:** 0 / 8 priorities
**Blocked:** 0 / 8 priorities

### By Priority

- [ ] P1: RESPONSEFIX (3-5 days) — Claude Code
- [ ] P2: CTXFIX P4-P5 (1-2 days) — Cursor
- [ ] P3: MEMORYFIX P1a-1b (3 days) — Claude Code
- [ ] P4: CTXFIX P1 (2 days) — Cursor
- [ ] P5: MEMORYFIX P2 (2 days) — Claude Code
- [ ] P6: CTXFIX P3 (2 days) — Cursor
- [ ] P7: CTXFIX P2 (3-4 days) — Claude Code
- [ ] P8: MEMORYFIX P3-5 (5-6 days) — Mix

---

## 🎯 Recommended First Sprint

**Week 1-2:** Focus on highest-impact, lowest-risk items

1. ✅ RESPONSEFIX (all phases) — 3-5 days — **Claude Code**
2. ✅ CTXFIX P4-P5 — 1-2 days — **Cursor**
3. ✅ MEMORYFIX P1a-P1b — 3 days — **Claude Code**

**Total:** 7-10 days for significant user-facing improvements with minimal risk.

---

## 📝 Notes

- All flag-gated features default to `false` for safety
- GitNexus impact analysis required before modifying memory system
- RESPONSEFIX is highest priority (user-facing bug)
- CTXFIX P2 (compaction) ships last due to high behavioral impact
- Test coverage required for all phases before merge

---

**Next Steps:**

1. Transfer to Archon project management
2. Assign tasks to Claude Code / Cursor agents
3. Begin with P1: RESPONSEFIX
