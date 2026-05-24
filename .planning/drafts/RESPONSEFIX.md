# RESPONSEFIX — Remediation Plan for "Thoughts-Only" Chat Replies

## Incident Summary

Observed behavior: a completed chat response rendered internal reasoning text and stopped without a user-facing answer.  
Example transcript (`/Users/james/Desktop/response-2026-05-24.md`) ends with `</thought>` and contains only meta-reasoning.

## Goals

1. Prevent internal reasoning tags (`<think>`, `<thought>`) from appearing in user-visible chat output.
2. Ensure every completed response path yields either:
   - meaningful user-facing assistant content, or
   - an explicit, actionable error/recovery message.
3. Add regression coverage so this cannot silently reappear in alternate streaming paths.

## Codebase Ground Truth (Verified Before Planning)

- In `lib/chat-post-handler.js`, reasoning cleanup currently exists only in the tool-call final-text branch via:
  - `replace(/<think>[\s\S]*?<\/think>/gi, "")`
  - `replace(/<thought>[\s\S]*?<\/thought>/gi, "")`
- In the same file, fallback streaming and standard streaming paths forward `parsed.message.content` directly as tokens without reasoning cleanup.
- `src/hooks/useChat.js` appends streamed `parsed.token` directly into `assistantContent`, so any leaked reasoning from backend reaches UI immediately.
- Empty-response handling is split today:
  - server-side fallback exists in tool-call and fallback-stream branches (`buildEmptyAssistantReplyMessage`)
  - client-side fallback exists in `src/hooks/useChat.js` when no assistant content arrives
  - standard stream path does not consistently emit a server-side empty-reply error on zero-token outcomes.

## Root Cause Hypothesis

Primary issue: sanitization is path-specific instead of centralized.  
When execution uses fallback or standard stream paths, reasoning-tagged output can bypass cleanup and be rendered as normal assistant text.

Secondary issue: cleanup depends on complete tag matching and does not protect against chunk-split or malformed tag boundaries while streaming.

## Remediation Plan

## Phase 1 — Centralize Output Sanitization

### Changes

- Add a shared sanitizer utility in backend chat handling (same module or helper module), for example:
  - `sanitizeAssistantChunk(input, state)`
  - `sanitizeAssistantFinal(input)`
- Use this sanitizer before every `sendEvent({ token })` call in:
  - tool-call final-text path
  - fallback streaming path
  - standard streaming path

### Implementation Notes

- Preserve user-visible markdown and tool text; remove only reasoning/meta wrappers.
- Keep existing user-facing error behavior (`buildEmptyAssistantReplyMessage`) as a fallback if sanitization produces no displayable content.

### Acceptance Criteria

- No `<think>` or `<thought>` content appears in SSE `token` events across any chat path.
- Existing non-reasoning responses render unchanged.

## Phase 2 — Add Stream-Safe Stateful Filtering

### Changes

- Implement a small state machine to handle tag fragments across chunk boundaries:
  - tracks whether parser is currently inside reasoning block
  - buffers partial tag fragments between chunks
  - emits only safe text segments
- Final flush on stream completion to avoid leaking partial leftovers.

### Implementation Notes

- Do not rely on regex alone for chunked streams.
- Handle case-insensitive tags and malformed closing boundaries defensively.

### Acceptance Criteria

- Chunk-split tags (e.g. `<tho` + `ught>`) are fully filtered.
- Unterminated reasoning blocks do not leak raw reasoning text.

## Sanitization Path Matrix

| Path | Token source | Sanitization hook | Empty-output action | Finalization order |
|---|---|---|---|---|
| `tool_final` | `finalText` split to token words | `sanitizeAssistantFinal()` then emit | `buildEmptyAssistantReplyMessage(model)` | `token* -> done -> [DONE]` |
| `fallback_stream` | NDJSON `parsed.message.content` | `sanitizeAssistantChunk(chunk, state)` per chunk + final flush | `buildEmptyAssistantReplyMessage(model)` | `token* -> done -> [DONE]` |
| `standard_stream` | NDJSON `parsed.message.content` | `sanitizeAssistantChunk(chunk, state)` per chunk + final flush | `buildEmptyAssistantReplyMessage(model)` | `token* -> done -> [DONE]` |

Implementation rule: each request must pass through a single finalization gate so `done` and `[DONE]` are emitted once.

## Phase 3 — Final Answer Quality Gate + Recovery

### Changes

- Motivation note: standard streaming can currently complete with zero visible tokens and rely on client-side fallback text; this phase closes that gap with explicit server-side empty-output handling.
- Track visible token count after sanitization on each response path.
- Apply one concrete completion contract per path:
  1. run final sanitizer flush
  2. if visible text length is zero, emit `error: buildEmptyAssistantReplyMessage(model)`
  3. emit one `done` frame and one `[DONE]` frame via a single finalization gate.
- Recovery pass in v1 is limited to tool-call mode only:
  - reuse `generateFinalTextFromToolResults(...)`
  - allow at most one recovery attempt
  - never re-enter tool loops during recovery.
- Non-tool streaming paths do not execute a second model query in v1; they return explicit error guidance when empty after sanitization.

### Implementation Notes

- Reuse existing helper/fallback logic where possible to avoid divergent code paths.
- Keep client empty-response fallback in `useChat` as defense in depth, but server now guarantees no reasoning-tag leakage and explicit empty-output behavior across all paths.
- Emit a `notice` event when tool-call recovery is auto-applied for observability and UX transparency.

### Acceptance Criteria

- "Reasoning-only" model output does not reach final user transcript.
- User always gets either a direct answer or a clear error message.

## Phase 4 — Test Coverage and Regression Guards

### Unit Tests

- Add `tests/unit/chat-output-sanitizer.test.js`:
  - complete tags
  - case variants
  - chunk-split tags
  - malformed/unclosed tags
  - plain content pass-through
  - final flush behavior.

### Integration Tests

- Update/add handler path tests:
  - update existing `tests/unit/chat-post-handler-phase3-wiring.test.js` for sanitizer wiring on all token paths
  - update existing `tests/unit/chat-empty-response.test.js` for explicit server empty-output behavior
  - new focused stream test (`tests/unit/chat-post-handler-reasoning-stream.test.js`) that mocks chunk boundaries:
    - fallback path chunk split (`<tho` + `ught>`)
    - standard path chunk split
    - tool-final full-tag cleanup.

### Acceptance Criteria

- New tests fail without remediation and pass with remediation.
- Existing chat streaming tests remain green.
- Required commands:
  - `npm run test:unit -- tests/unit/chat-output-sanitizer.test.js tests/unit/chat-post-handler-reasoning-stream.test.js`
  - `npm run test:unit -- tests/unit/chat-post-handler-phase3-wiring.test.js tests/unit/chat-empty-response.test.js`

## Phase 5 — Observability + Controlled Rollout

### Changes

- Add structured logging counters:
  - `reasoning_tokens_removed`
  - `reasoning_only_detected`
  - `response_recovery_attempted`
  - `response_recovery_failed`
- Include model name + response path (`tool_final`, `fallback_stream`, `standard_stream`) in telemetry fields.
- Emit metrics through existing server logging (`log(...)`) at:
  - per-chunk sanitization remove events (debug/trace aggregated per request)
  - per-request completion summary (info)
  - recovery attempt/failure events (warn).

### Rollout Strategy

- Ship behind a temporary config flag if needed (`chatReasoningFilterV1`).
- Enable in dev/test first; validate logs for false positives.
- Promote to default-on after verification window.

### Acceptance Criteria

- No increased rate of empty-response user errors post-release.
- Leaks of reasoning tags trend to zero in logs.

## Risks and Mitigations

- Risk: over-aggressive filtering removes legitimate text.  
  Mitigation: narrow tag-based filter + unit fixtures for benign edge cases.

- Risk: chunk-state logic introduces regressions in streaming performance.  
  Mitigation: keep parser linear-time, small buffer, and covered by perf sanity checks.

- Risk: recovery loop could hide underlying model quality issues.  
  Mitigation: hard-cap to one retry and instrument counters.

## Verification Checklist

- Reproduce original failure with a fixture resembling `response-2026-05-24.md`.
- Validate token stream cleanliness in all backend output paths.
- Validate frontend transcript no longer persists reasoning-only output.
- Run targeted tests + existing chat unit/integration suites.
- Confirm user-facing error text remains helpful when no answer can be produced.

## Definition of Done

- Shared sanitization is used in all token emission paths.
- Stream-safe filtering handles boundary fragmentation.
- Recovery gate prevents "thoughts-only" final responses.
- Regression tests and observability are in place.
- Plan-review iteration reports no unresolved Critical/Major issues.
