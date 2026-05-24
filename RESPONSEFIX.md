# RESPONSEFIX — Remediation Plan for "Thoughts-Only" Chat Replies

> **Plan-review iteration (2026-05-24):** Phase 1 has shipped and been committed
> (`7d20709 feat(RESPONSEFIX): Phase 1 - Centralize output sanitization`). This
> revision re-baselines the plan against the **current HEAD** (not the pre-fix
> state): Phase 1 is reduced to its one remaining gap (export the sanitizers),
> Phase 2 (stateful stream-safe filtering) is promoted to the primary remaining
> code change, and Phase 3's single-finalization work is pinned to the real
> `done`/`[DONE]` emission sites. See the **Plan Review Log** at the bottom.

## Incident Summary

Observed behavior: a completed chat response rendered internal reasoning text and stopped without a user-facing answer.
Example transcript (`/Users/james/Desktop/response-2026-05-24.md`) ends with `</thought>` and contains only meta-reasoning. Note the trailing tag is an **unterminated** `<thought>` block — the regex sanitizer (which requires a closing tag) does not catch this case.

## Goals

1. Prevent internal reasoning tags (`<think>`, `<thought>`) from appearing in user-visible chat output — including across chunk boundaries and for unterminated blocks.
2. Ensure every completed response path yields either:
   - meaningful user-facing assistant content, or
   - an explicit, actionable error/recovery message.
3. Add regression coverage so this cannot silently reappear in alternate streaming paths.

## Current Codebase State (verified against HEAD `7d20709`, 2026-05-24)

Phase 1 is **already implemented and committed**. Verified line references below are current as of `7d20709`; an implementer should `grep` to confirm before editing (line numbers drift).

- **Sanitizers exist and are wired** in `lib/chat-post-handler.js`:
  - `sanitizeAssistantChunk(input, state = {})` at `:83` — pure regex; **ignores `state`** (docstring: "Reserved for Phase 2 state machine (unused in Phase 1)"). Strips complete `<think>…</think>` / `<thought>…</thought>` only.
  - `sanitizeAssistantFinal(input)` at `:97` — same regex plus `.trim()`.
  - Wired on all three paths: tool_final at `:2123` (`sanitizeAssistantFinal(finalText)` before word-split), fallback_stream at `:2182` and `:2213`, standard_stream at `:2424` and `:2463`.
- **Sanitizers are NOT exported.** `module.exports` (`:2614`) lists `buildEmptyAssistantReplyMessage` but not the two sanitizers; `routes/chat.js` re-exports only `buildEmptyAssistantReplyMessage`. Tests cannot import the sanitizers yet.
- **`sendEvent(data)` at `:899`** is the single JSON-event writer (`{token}`/`{done}`/`{error}`/`{notice}`) and guards on `res.writableEnded`. **`[DONE]` frames bypass it** — all are raw `res.write("data: [DONE]\n\n")`. There is **no** request-scoped `finalized` boolean.
- **Completion-frame inventory:** 5 `done: true` sites (fallback `:2192`/`:2223`, tool_final `:2271`, standard `:2434`/`:2477`) and 12 `[DONE]` sites (`:1132`, `:1229`, `:1348`, `:1839` abort/error; `:2274` tool_final; `:2402` standard pre-stream error; `:2447`, `:2481`, `:2498`, `:2542` standard end/abort/error; `:2559`, `:2609` outer catch). `total_duration`/`eval_count` are present only on the 4 stream-driven `done` events (sourced from `parsed.total_duration`/`parsed.eval_count`); the tool_final `done` legitimately has no upstream frame and omits them.
- **Empty-output handling is asymmetric.** Fallback path emits `sendEvent({ error: buildEmptyAssistantReplyMessage(model) })` on zero tokens (`:2253`); the **standard path has no such guard** and relies entirely on the client fallback.
- **Frontend (`src/hooks/useChat.js`):** `assistantContent += parsed.token` at `:647-648`; client empty-response fallback at `:802-806` (`if (!assistantContent.trim() && assistantImages.length === 0)`); `parsed.notice` handler at `:677-701` maps only `tool_call_*` kinds to specific markers (`tool_call_recovery_mode` → 🚑 at `:687`); all other kinds fall through to a generic `⚠️` marker.

## Root Cause Hypothesis

Primary issue (Phase 1, **now fixed**): sanitization was path-specific instead of centralized — fixed by `sanitizeAssistantChunk`/`sanitizeAssistantFinal` wired to all three paths.

Remaining issue (Phase 2, **open**): the chunk sanitizer is stateless and tag-complete-only, so reasoning text still leaks when a tag spans two NDJSON chunks (`<tho` + `ught>`) or when a block is never closed (the observed incident). Plus the standard path can still complete with zero visible server-side tokens and no explicit server error (Phase 3).

## Remediation Plan

## Phase 1 — Centralize Output Sanitization ✅ SHIPPED (`7d20709`)

Centralized `sanitizeAssistantChunk`/`sanitizeAssistantFinal` and wired them before every `sendEvent({ token })` on the tool_final, fallback_stream, and standard_stream paths.

### Remaining gap (do as the first step of Phase 2's PR)

- **Export the two sanitizers** so Phase 4 can unit-test them directly: add `sanitizeAssistantChunk` and `sanitizeAssistantFinal` to the `module.exports` block at `chat-post-handler.js:2614`. (No need to re-export through `routes/chat.js`; tests import from `../../lib/chat-post-handler`.)

### Acceptance Criteria (met)

- No `<think>`/`<thought>` **complete-tag** content appears in SSE `token` events across any path.
- Existing non-reasoning responses render unchanged.

## Phase 2 — Stream-Safe Stateful Filtering (PRIMARY remaining code change)

### Changes

- Make `sanitizeAssistantChunk(input, state)` **consume and mutate `state`** to handle tags spanning chunk boundaries:
  - Track `insideReasoning` (currently inside a `<think>`/`<thought>` block).
  - Buffer a trailing partial-tag fragment (e.g. a chunk ending in `<tho`) and prepend it to the next chunk before matching.
  - Emit only text that is provably outside a reasoning block.
- Add a **final flush** helper (or a `flush` flag on the final call) invoked on stream completion:
  - If the stream ends while `insideReasoning` is true (an **unterminated** block — the observed incident), **drop** the buffered reasoning text rather than emitting it.
  - Emit any safe buffered non-tag fragment.
- Thread one `state` object per request through **both** call sites on each streaming path (fallback `:2182` mid-stream + `:2213` final-buffer; standard `:2424` mid-stream + `:2463` final-buffer share one `state`), and call the flush after each path's read loop ends.
- tool_final needs **no** stateful filtering: `sanitizeAssistantFinal` runs on the fully-assembled string before word-splitting (`:2123`), so tags can't be chunk-split there. Leave it as-is.

### Implementation Notes

- Keep the matcher linear-time; the only buffer is the trailing partial-tag fragment (bounded by the longest tag, ~`</thought>`).
- Case-insensitive tags; tolerate malformed/missing closing boundaries (treat EOF-while-inside as "drop").
- Return shape: have the chunk sanitizer report what it removed (e.g. `{ text, removed }` or increment a counter on `state`) so Phase 5 can populate `reasoning_tokens_removed` without re-running the regex.

### Acceptance Criteria

- Chunk-split tags (e.g. `<tho` + `ught>`) are fully filtered across both streaming paths.
- An **unterminated** reasoning block (open tag, no close, then stream end) yields **empty** output after flush — reproduces and fixes the `response-2026-05-24.md` incident.
- Plain content (no tags) passes through byte-for-byte unchanged.

## Sanitization Path Matrix (current + target)

| Path              | Token source                                                                     | Sanitization hook                                        | Empty-output action                                                                    | Finalization            |
| ----------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------- |
| `tool_final`      | `finalText` → `sanitizeAssistantFinal()` → `split(/(\s+)/)` words (`:2123-2129`) | final-string only (no stateful filter needed)            | `sendEvent({ error: buildEmptyAssistantReplyMessage(model) })`                         | via `finalizeSseOnce()` |
| `fallback_stream` | NDJSON `parsed.message.content` (`:2182`, `:2213`)                               | `sanitizeAssistantChunk(chunk, state)` per chunk + flush | `sendEvent({ error: buildEmptyAssistantReplyMessage(model) })` (exists `:2253`)        | via `finalizeSseOnce()` |
| `standard_stream` | NDJSON `parsed.message.content` (`:2424`, `:2463`)                               | `sanitizeAssistantChunk(chunk, state)` per chunk + flush | `sendEvent({ error: buildEmptyAssistantReplyMessage(model) })` (**new** — see Phase 3) | via `finalizeSseOnce()` |

Empty-output is carried on the **`error`** event (matches the existing convention at `:2134`/`:2253`, and useChat's `parsed.error` handler at `:673`), not on `done`. Each request must pass through a single finalization gate so `done` and `[DONE]` are emitted exactly once.

## Phase 3 — Final Answer Quality Gate + Single Finalization

### Changes

- **Introduce `finalizeSseOnce({ error, total_duration, eval_count })`** as the only completion writer:
  - Internally: optionally `sendEvent({ error })`, then `sendEvent({ done: true, total_duration, eval_count })` (omit duration/count fields when undefined), then write the raw `[DONE]` frame, then `res.end()`.
  - Guard with a request-scoped `let finalized = false;` declared next to `sendEvent` (~`:899`); first call sets it, subsequent calls no-op. This replaces the inconsistently-applied `res.writableEnded` checks.
  - **Convert all 17 existing completion sites** to route through it: the 5 `done: true` sites and the 12 raw `[DONE]` sites enumerated in _Current Codebase State_ (including the 6 abort/error `[DONE]` writes at `:1132`/`:1229`/`:1348`/`:1839`/`:2402`/`:2559`/`:2609`, which are easy to miss).
- **Standard-path zero-token guard (the genuinely missing piece):** in the standard `readStream`, before the `[DONE]` at the final-buffer branch (`~:2447`) and before the `return` in the other branch (`~:2484`), if `tokenCount === 0` after the sanitizer flush, pass `error: buildEmptyAssistantReplyMessage(model)` into `finalizeSseOnce`.
- **Recovery (tool-call mode only, v1):**
  - reuse `generateFinalTextFromToolResults(...)` (`:1078`); at most one attempt; never re-enter tool loops.
  - Non-tool streaming paths do **not** issue a second model query in v1 — they finalize with the empty-output `error` after sanitizer flush.
- **Recovery notice:** emit `sendEvent({ notice: { kind: "tool_call_recovery_mode", message: … } })` — **reuse the existing `tool_call_recovery_mode` kind** so useChat renders the 🚑 marker (`:687`). If a new kind is preferred, add it to the marker map at `useChat.js:682-691` in this phase (don't leave it falling through to generic `⚠️`).

### Implementation Notes

- Keep the client empty-response fallback in `useChat` (`:802`) as defense in depth; the server now guarantees an explicit empty-output `error` on every path.

### Acceptance Criteria

- Exactly one `done` and one `[DONE]` per request (enforced by `finalized`).
- "Reasoning-only" / zero-visible-token output never reaches the final user transcript — server emits an explicit `error` instead.
- `done` payload preserves `total_duration`/`eval_count` on the 4 stream-driven sites; tool_final `done` omits them (no upstream frame) — this is correct, not a gap.

## Phase 4 — Test Coverage and Regression Guards

### Unit Tests

- **`tests/unit/chat-output-sanitizer.test.js`** (new) — imports `sanitizeAssistantChunk`/`sanitizeAssistantFinal` from `../../lib/chat-post-handler` (requires the Phase 1 export gap to be closed first):
  - complete tags; case variants; **chunk-split** tags via repeated calls sharing one `state`; **unterminated** tag dropped on flush; plain pass-through; final-flush behavior.

### Integration / Wiring Tests

- **`tests/unit/chat-post-handler-sanitizer-wiring.test.js`** (new) — assert the sanitizer is invoked on all three token paths and that `finalizeSseOnce` is the sole completion writer. Reuse the `fs.readFileSync(...) + assert.match(SRC, /…/)` source-assertion pattern already used by `tests/unit/chat-post-handler-phase3-wiring.test.js` (avoids a live MCP/Ollama round). Keep `chat-post-handler-phase3-wiring.test.js` unchanged.
- **`tests/unit/chat-post-handler-reasoning-stream.test.js`** (new) — mocks chunk boundaries: fallback split (`<tho`+`ught>`), standard split, unterminated-tag flush, tool-final full-tag cleanup.
- **Update `tests/unit/chat-empty-response.test.js`** for explicit server-side empty-output on the standard path. Note it imports from `../../routes/chat`, which re-exports only `buildEmptyAssistantReplyMessage`; import any new symbol directly from `../../lib/chat-post-handler`.
- **`tests/unit/use-chat-empty-stream-fallback.test.js`** (new) — frontend: zero token + no server error → client fallback text; server `error` event surfaced and not overwritten by fallback.

### Acceptance Criteria

- New tests fail without remediation, pass with it; existing chat streaming tests stay green.
- Required commands:
  - `node --test tests/unit/chat-output-sanitizer.test.js tests/unit/chat-post-handler-reasoning-stream.test.js`
  - `node --test tests/unit/chat-post-handler-sanitizer-wiring.test.js tests/unit/chat-empty-response.test.js tests/unit/use-chat-empty-stream-fallback.test.js`
  - optional full sweep: `npm run test:unit`.

## Phase 5 — Observability + Controlled Rollout

### Changes

- Structured counters (depend on Phase 2's chunk sanitizer reporting removals — see Phase 2 return shape):
  - `reasoning_tokens_removed`, `reasoning_only_detected`, `response_recovery_attempted`, `response_recovery_failed`.
- Include model name + response path (`tool_final`/`fallback_stream`/`standard_stream`) in fields. `log`/`debug` are destructured from `appContext` at `:524`; emit via `log(LEVEL, message, details)`:
  - per-request completion summary (info); recovery attempt/failure (warn); aggregated per-request removal count (debug).

### Rollout Strategy

- Phase 1 already shipped default-on (it is a pure narrowing filter). For Phase 2/3, ship behind a temporary config flag `chatReasoningFilterV1`, enable in dev/test first, validate logs for false positives, then promote to default-on after a verification window. (Resolve the "if needed" hedge: the flag **is** used for Phase 2/3.)

### Acceptance Criteria

- No increased rate of empty-response user errors post-release.
- Reasoning-tag leaks trend to zero in logs.

## Risks and Mitigations

- Risk: over-aggressive filtering removes legitimate text. Mitigation: narrow tag-based filter + unit fixtures for benign edge cases (e.g. literal `<thought>` inside fenced code).
- Risk: chunk-state logic regresses streaming. Mitigation: linear-time matcher, bounded partial-tag buffer, perf sanity in tests.
- Risk: converting 17 finalization sites misses one and breaks completion. Mitigation: the wiring test asserts `finalizeSseOnce` is the only writer of `[DONE]`; grep must show zero remaining raw `res.write("data: [DONE]`.
- Risk: recovery loop hides model-quality issues. Mitigation: hard-cap one retry + counters.

## Verification Checklist

- Reproduce original failure with a fixture resembling `response-2026-05-24.md` (unterminated `<thought>`).
- Validate token-stream cleanliness on all three backend paths, including chunk-split and unterminated cases.
- Validate frontend transcript no longer persists reasoning-only output.
- Confirm exactly one `done` + one `[DONE]` per request.
- Run targeted tests + existing chat unit/integration suites.

## Definition of Done

- Phase 1 sanitizers exported and unit-tested.
- Stream-safe stateful filtering handles chunk-boundary fragmentation **and** unterminated blocks.
- `finalizeSseOnce` is the sole completion writer (one `done`/one `[DONE]`), with standard-path zero-token guard.
- Recovery gate prevents "thoughts-only" final responses; recovery notice renders with the correct marker.
- Regression tests and observability counters in place.
- Plan-review iteration reports no unresolved Critical/Major issues.

## Plan Review Log

### Iteration 2026-05-24 (post-Phase-1-commit) — verdict: NEEDS REVISION → addressed

- **Critical:** sanitizers not exported (`:2614`) → Phase 4 tests can't import → added export step to Phase 1 gap.
- **Major:** baseline stale (Phase 1 shipped `7d20709`) → re-baselined Ground Truth + reduced Phase 1 to the export gap.
- **Major:** Phase 2 (stateful filter) is the real remaining work, `state` param unused (`:83`) → promoted to primary change with unterminated-tag drop.
- **Major:** `finalizeSseOnce` must wrap raw `[DONE]` (12 sites) + `done` (5 sites); no `finalized` flag today → enumerated all 17 sites + specified the flag.
- **Major:** standard-path zero-token guard missing → pinned insertion points (`~:2447`, `~:2484`).
- **Minor:** notice-kind mismatch → reuse `tool_call_recovery_mode`; empty-output via `error` event; tool_final needs no stateful filter; Phase 5 counters depend on Phase 2 return shape.
