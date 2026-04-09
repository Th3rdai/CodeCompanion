# MCP Parallel Tool Execution Plan (Implementation-Ready)

## Goal

Reduce chat-round latency by parallelizing only independent tool calls while preserving semantic correctness and existing tool result ordering.

## Scope

- In scope: intra-round tool execution in the chat loop (`routes/chat.js`) using ordered batching windows.
- In scope: tool safety classification for builtins and external MCP tools.
- In scope: runnable `node:test` coverage for segmentation and execution ordering.
- Out of scope: new public MCP batch APIs, background job queues, or transport-level protocol changes.

## Correctness Model (Critical)

The execution algorithm must preserve the model-emitted call order across a round.

### Why this matters

A global split (all safe reads parallel, then all risky serial) is incorrect because it can reorder dependent calls from the same response (example: `write_file` then `read_file`).

### Required algorithm: ordered batching windows

1. Parse tool calls in original order.
2. Classify each call as `parallel-safe` or `risky`.
3. Build segments in-order:
   - contiguous `parallel-safe` calls become one `parallel` segment
   - each `risky` call becomes its own `serial` segment in-place
4. Execute segments sequentially:
   - `parallel` segment: run calls with `Promise.allSettled`
   - `serial` segment: run one call with `await`
5. Store results by original call index and format tool results in original order.

This keeps dependency order while still parallelizing independent runs.

## Tool Safety Policy

Default policy:
- builtins are `parallel-safe` unless explicitly marked risky
- unknown external MCP tools are treated as `risky` by default

Explicit risky builtins for phase 1:
- `run_terminal_cmd` (stateful terminal side effects and stream ordering)
- `generate_office_file` (filesystem writes and larger resource footprint)
- `write_file` (filesystem mutation)

Optional future audit additions can move tools between categories with explicit test updates.

## Implementation Plan

### 1) Segmentation + execution primitives

- Add or finalize segmentation helper in `lib/tool-call-handler.js`:
  - `segmentToolCalls(toolCalls)` producing ordered `parallel`/`serial` segments
  - include `originalIndex` on each call
- Ensure execution path in `routes/chat.js` processes segments sequentially and fills a `resultsByOriginalIndex` array.

### 2) Builtin metadata

- In `lib/builtin-agent-tools.js`, expose `parallelSafe` metadata per builtin.
- Mark risky builtins explicitly (`run_terminal_cmd`, `generate_office_file`, `write_file`).

### 3) Config + safety gates

- Add/confirm config keys in `lib/config.js`:
  - `toolExec.parallel` (default `false`)
  - `toolExec.maxConcurrent` (default `4`)
- When parallel mode is disabled, preserve existing serial behavior.

### 4) SSE/event behavior

- Keep existing per-call event structure.
- Do not interleave terminal stream semantics by ensuring `run_terminal_cmd` remains serial.

## Runnable Test Plan (`node:test`)

Use `node:test` + `node:assert/strict` only (no Jest globals).

### Unit/Integration tests

- `tests/integration/parallel-tools.test.js`
  - verify parallel segment is faster than equivalent serial execution
  - verify one failed call in `Promise.allSettled` does not block other calls
  - verify segment execution preserves original index/result mapping

- `tests/unit/tool-call-handler.test.js` (or existing equivalent)
  - segmentation cases:
    - all safe calls -> single parallel segment
    - mixed safe/risky -> ordered alternating segments
    - consecutive risky calls -> separate serial segments in-order

- `tests/unit/concurrency.test.js` (if helper exists)
  - max concurrency cap respected
  - deterministic ordering of returned slots by original index

### Command

Run:

`npm test -- tests/integration/parallel-tools.test.js`

and full suite as part of normal validation.

## Pre-Implementation Validation Checklist

Before coding:

- Confirm no existing global split logic that reorders calls in `routes/chat.js`.
- Confirm current parser output includes stable tool-call order per round.
- Confirm existing tests run under `node:test` conventions in this repo.
- Confirm no stale file paths in test references.

After coding:

- Validate serial fallback path unchanged when feature flag is off.
- Validate mixed sequences (`safe -> risky -> safe`) preserve semantic order.
- Validate risky builtins are never parallelized.

## Acceptance Criteria

- Mixed dependency sequences remain correct (`write` before dependent `read`).
- Independent safe calls in one contiguous window execute concurrently.
- Tool result formatting remains in original model-emitted order.
- Tests pass and cover segmentation, error isolation, and order preservation.
- Feature is behind config flag for initial rollout.

## Risks and Mitigations

- Risk: hidden side-effect tools classified as safe.
  - Mitigation: default unknown to risky and require explicit opt-in to safe.
- Risk: event confusion under concurrency.
  - Mitigation: keep stateful/streaming tools serial in phase 1.
- Risk: flaky timing assertions in tests.
  - Mitigation: use tolerant thresholds and deterministic delays.

## Next Step After This Plan

Implement in a small PR:
1) segmentation correctness,
2) chat loop execution wiring,
3) test coverage,
4) flag-off default rollout.
