# MCP Parallel Task Execution — Research & Design

**Archon task:** `90abbcca-7fba-4c20-95ac-f75e28d7b6f9`
**Status:** Research / design — no implementation yet
**Author:** Claude (2026-04-08)

This is a **research document**, not an implementation plan. It surveys the current state, defines what "parallel task execution" could mean in Code Companion, and sketches 3 design options with honest trade-offs. The goal is to give a human enough to pick a direction before any code is written.

---

## 1. The starting request

From the backlog: *"leverage Code Companion MCP server for parallel task execution. No implementation spec yet — research + design first."*

That phrasing is ambiguous on purpose — the user knows the capability is valuable, but hasn't decided **which layer** should go parallel. This doc's main job is to disambiguate.

## 2. Current state

### 2.1 MCP surface area in this repo

| File | Role | Lines |
|---|---|---|
| `mcp/tools.js` | Registers 11 tools on the built-in `McpServer` instance (6 mode tools + 5 utility tools) | 386 |
| `mcp/schemas.js` | Zod schemas for tool inputs | 50 |
| `lib/mcp-http.js` | `mountMcpHttp(app, { deps })` — **factory-per-request** `McpServer` over streamable HTTP | 78 |
| `mcp-server.js` | stdio transport entry point | — |
| `lib/mcp-client-manager.js` | `McpClientManager` — connects, disconnects, caches tools from external MCP servers (stdio / http / sse) | 412 |
| `lib/mcp-api-routes.js` | `/api/mcp/*` REST routes for Settings → MCP Clients UI | 293 |
| `lib/tool-call-handler.js` | `ToolCallHandler` — parses `TOOL_CALL: server.tool(...)` from LLM output, routes to builtin or MCP client, formats results | 366 |
| `lib/builtin-agent-tools.js` | `run_terminal_cmd`, `generate_office_file`, validate tools, etc. — executed locally without an MCP transport | 1544 |
| `routes/chat.js` | Chat SSE loop that drives multi-round tool calling | 893 |

### 2.2 The current tool-use loop (where parallelism would matter)

`routes/chat.js` runs an **N-round** tool-calling loop per user turn. Inside each round:

```js
// routes/chat.js (simplified)
const toolCalls = toolCallHandler.parseToolCalls(responseText); // ≥ 0 calls
for (const call of toolCalls) {
  if (chatAbortController.signal.aborted) return;
  const result = await toolCallHandler.executeTool(
    call.serverId, call.toolName, call.args,
  );
  // format + accumulate into `toolResults`
}
// feed `toolResults` back to the model as a user message, loop again
```

**Every tool call in a round runs strictly sequentially.** If the model emits three calls — say, `read fileA`, `read fileB`, `read fileC` — they take `t(A) + t(B) + t(C)` instead of `max(t(A), t(B), t(C))`.

The factory-per-request `McpServer` pattern in `lib/mcp-http.js` shows the server side is already **concurrency-safe for inbound MCP requests** (a fresh `McpServer` + transport per HTTP request). The bottleneck is strictly inside Code Companion's own chat loop, **not** in the MCP SDK or the downstream servers.

### 2.3 Client manager: already concurrent-safe

`lib/mcp-client-manager.js` stores one `{ client, transport }` per connected server and exposes `callTool(serverId, toolName, args)`. The MCP SDK's `Client.callTool` is inherently async — two `Promise.all` calls against the same client work fine. The `McpClientManager` does not serialize calls itself.

### 2.4 What *is* already parallel (for context)

- `routes/chat.js:206` — `Promise.all([…, memCtx])` runs memory retrieval alongside the first Ollama call.
- MCP HTTP server creates a fresh `McpServer` per request (`lib/mcp-http.js`) → multiple concurrent external MCP clients can hit our `/mcp` endpoint at once without interference.
- External MCP clients are auto-connected independently at startup (fire-and-forget `.then/.catch` loop in `server.js`).

So the primitives exist — the chat loop just doesn't use them.

## 3. What "parallel task execution" could mean

There are **three distinct layers** where parallelism is a valid feature. They solve different problems and have very different risk profiles.

### Layer A — Intra-round tool fan-out
Inside a single chat round, if the model emits multiple `TOOL_CALL:` lines, execute them in parallel (`Promise.allSettled`) instead of a `for` loop.
**Who benefits:** every chat turn where the model makes > 1 tool call — reading multiple files, searching multiple sources, running multiple validate sub-tools.
**Blast radius:** `routes/chat.js` tool loop only. Small diff.

### Layer B — Multi-task batch API
Expose a new MCP tool like `codecompanion_batch({ tasks: [{mode, code, prompt}, ...] })` that runs N mode operations (chat, explain, review, etc.) concurrently against Ollama and returns a combined result. This is what most "parallel task execution" phrasing in the wild actually means — submit a batch of work, get N results back.
**Who benefits:** external MCP clients (other LLMs, IDEs, scripts) that want to fan out work to Code Companion. Also useful internally as a primitive.
**Blast radius:** new tool + concurrency limiter + Ollama client changes. Medium.

### Layer C — Background task runner with status polling
Long-running tasks (e.g. multi-file review, full-project security scan, repo validation) execute in the background on the MCP server; clients get a `taskId` immediately and poll with `codecompanion_task_status(taskId)`. Essentially turning Code Companion into a **task queue**.
**Who benefits:** clients that can't hold an HTTP connection for minutes; true async workflows.
**Blast radius:** persistent task store, cancellation, TTL cleanup, status events, migration of existing tools. Large.

## 4. Design options

### Option 1 — Intra-round tool fan-out (Layer A only)

**What it is:** replace the sequential `for` loop in `routes/chat.js` with `Promise.allSettled` + a concurrency cap. Emit `toolCallRound` events per batch, keep per-call SSE events as today.

**Implementation sketch:**
```js
// Replace the for loop:
const concurrency = Math.min(
  toolCalls.length,
  config.toolExec?.maxConcurrent ?? 4,
);
const results = await runWithLimit(toolCalls, concurrency, async (call) => {
  if (chatAbortController.signal.aborted) return { aborted: true };
  return toolCallHandler.executeTool(call.serverId, call.toolName, call.args);
});
// zip results into toolResults text in the original call order
```

**Pros:**
- Smallest possible diff — only touches `routes/chat.js` (≈ 50 lines) + new `lib/concurrency.js` helper (≈ 30 lines).
- Immediate speedup for any multi-call round (measured in wall clock, not tokens).
- Backwards-compatible: ordering of `toolResults` text is preserved; the model sees the same output.
- No schema changes. No new MCP tools. No new endpoints.
- Works for builtin tools, external MCP tools, and hybrid rounds without special-casing.

**Cons / risks:**
- **Stateful tools need ordering awareness** — e.g. `run_terminal_cmd` sequences matter. Solution: mark tools with `parallelSafe: false` in `getBuiltinTools()` and run those serially (or in a serialized sub-group). Fallback: feature-gate behind `config.toolExec?.parallel === true` until the tool matrix is audited.
- **SSE event interleaving** — `terminalCmd`/`terminalOutput` events from two concurrent terminal calls would interleave in the stream. Either disallow parallel terminal calls (easy) or tag events with `callId` and update the client to demux (harder).
- **Rate limits compound** — four parallel Ollama calls inside `generate_office_file` or `view_pdf_pages` can punch through per-endpoint limiters. Needs a single shared concurrency gate, not per-path limiters.
- **Error semantics change subtly** — today a failing early call doesn't affect later calls in the same round. `Promise.allSettled` keeps that property; `Promise.all` would break it. Must use `allSettled`.

**Effort estimate:** ~1 day to code + write unit tests + feature-flag default off; add ~3 days of real-world usage to flip the flag on.

### Option 2 — Batch API (Layer B only)

**What it is:** add `codecompanion_batch` MCP tool. Input: an array of `{ mode, code, prompt, modelOverride? }` items. Server fans out to N Ollama calls concurrently (with a configurable cap) and returns an ordered array of results. Internal call path reuses `createModeHandler`.

**Pros:**
- Exposes parallelism to **external MCP clients**, which is what the task title literally asks for.
- Natural fit for the existing mode-tool pattern; no changes to the chat loop.
- Stateless — each batch item is an isolated mode invocation with its own prompt and code payload.
- Schema is self-documenting; clients can discover it via `tools/list`.

**Cons / risks:**
- Doesn't help the **internal** chat loop at all — users of the chat UI see no speedup unless Option 1 is also shipped.
- Ollama is the real constraint. Running 5+ concurrent `chatComplete` calls on a local model starves each of tokens/sec. Need a per-model lock or a small queue (`p-limit`) tuned to observed throughput.
- Response size blow-up — a batch of 10 reviews can blow past any reasonable `res.json` limit. Need streaming or chunked results.
- Harder to cancel mid-batch than a single call — but `AbortController` on each sub-call handles it.

**Effort estimate:** ~3 days to code + tests, +1 day to tune concurrency limits empirically against a local model.

### Option 3 — Hybrid: Layer A first, Layer B later (recommended)

**What it is:** ship Option 1 now (biggest ratio of value to effort), then add Option 2 in a follow-up phase once the intra-round concurrency primitive is battle-tested.

**Why this order:**
- Option 1's `runWithLimit` helper becomes the concurrency primitive that Option 2 reuses — zero waste.
- Option 1 forces an honest audit of which tools are parallel-safe; that audit is required for Option 2 anyway.
- Option 1 ships visible user-facing speedup immediately (every multi-tool round in chat).
- Option 2 can be released as a capability advertisement to external clients without disrupting the chat UI.

**What we explicitly defer:** Layer C (background task runner). That's a different product — it implies persistent state, auth, TTLs, GC, and UI for task lists. It solves a problem no user has reported yet. Park it until someone hits "I want to kick off a scan and come back in 30 minutes."

## 5. Open questions for the human

Before any code gets written, these need answers:

1. **Which layer does the original request mean?** If the answer is "all of the above eventually, start with the biggest win", then Option 3 is the plan. If it's specifically "other MCP clients should be able to fan out to us", Option 2 is the starting point.
2. **Is there a concrete use case driving this?** (e.g. "the security scan takes 2 minutes because it reads 30 files sequentially"). A concrete case dictates which tools must be in the parallel-safe set for the first release.
3. **Where should the concurrency limit live?** Options: `.cc-config.json` under `toolExec.maxConcurrent`, env var `CC_TOOL_PARALLEL`, or hardcoded with a sensible default (4).
4. **Should the parallel loop be opt-in or opt-out?** Feature-flagged default-off is safest for the first release. Flipping to default-on after a release cycle is easy.
5. **How do we handle Ollama backpressure?** With local models, N parallel chat calls don't linearly scale — they degrade. Need either a per-model semaphore or empirical throttle (start with 2 concurrent chat completions, tune from there).

## 6. Recommendation

**Start with Option 1 (intra-round tool fan-out), feature-flagged off, default concurrency cap of 4, with a `parallelSafe: false` mark on `run_terminal_cmd`, `generate_office_file`, and any future stateful tool.**

Ship it behind `config.toolExec.parallel = true` for one release so anyone who opts in can verify real workloads. Flip default-on in the next release if no regressions appear. Then spec Option 2 as a follow-up Archon task.

**Rejected:** shipping Option 2 first. The chat loop is where users live; Option 2 doesn't help them. Shipping Option 2 without Option 1 means the batch tool races on Ollama while the chat UI still crawls sequentially.

**Deferred:** Option 3 (background tasks). No user has asked for it. Revisit if it becomes a pain point.

## 7. Files that would change in Option 1 (for planning purposes only — not a commit)

| File | Change |
|---|---|
| `routes/chat.js` | Replace the `for (const call of toolCalls)` loop with a `runWithLimit` call; ensure `toolResults` is assembled in original order; wire `chatAbortController` into each concurrent call |
| `lib/concurrency.js` (new) | Export `runWithLimit(items, concurrency, fn)` — small p-limit-style helper, ~30 lines |
| `lib/builtin-agent-tools.js` | Add `parallelSafe` boolean to tool metadata emitted by `getBuiltinTools()`; default `true`, flip `false` for terminal + office + any future stateful tool |
| `lib/tool-call-handler.js` | Partition incoming tool calls into parallel-safe and serial buckets based on tool metadata; run the parallel bucket concurrently, serial bucket sequentially |
| `lib/config.js` | Add `toolExec: { parallel: false, maxConcurrent: 4 }` default config |
| `src/components/SettingsPanel.jsx` | Optional: expose the toggle under General → Performance |
| `tests/unit/concurrency.test.js` (new) | Unit-test `runWithLimit` (ordering, cap, error propagation, abort) |
| `tests/unit/tool-call-handler.test.js` | Add tests for parallel vs serial partitioning |
| `tests/e2e/tool-parallel.spec.js` (new) | One e2e spec that mocks two slow tool calls and asserts total wall-clock < 2× slowest |
| `CHANGELOG.md` | Note the new flag and default |

No changes to the MCP SDK integration, tool schemas, or wire format. The parallelism lives entirely inside Code Companion.

---

**Next steps (if this plan is approved):**
1. Human picks Option 1 / 2 / 3 and answers §5 questions.
2. Create an Archon implementation task with the chosen option's file list.
3. Write unit tests first (`runWithLimit` + partition logic).
4. Wire the chat loop, feature-flag off by default.
5. Run real-world chat scenarios with the flag on; measure wall-clock speedup.
6. Flip the default in the following release if clean.
