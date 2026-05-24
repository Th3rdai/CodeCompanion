# Context handling — review brief

**Purpose:** Share this document with teammates or contributors to align on how Code Companion manages LLM context today, where failures show up, and sensible next steps. It reflects the codebase at draft time; verify against [lib/chat-post-handler.js](lib/chat-post-handler.js), [lib/config.js](lib/config.js), [lib/ollama-client.js](lib/ollama-client.js), [lib/review.js](lib/review.js), [lib/auto-model.js](lib/auto-model.js), and [src/hooks/useChat.js](src/hooks/useChat.js) if behavior changes.

---

## Executive summary

Code Companion sends the full conversation (plus system prompt, tools, memory, brand/project hints) to Ollama and can **auto-increase** `num_ctx` for **local** models up to **524,288 tokens**. **Cloud** models do not receive `num_ctx`; their window is fixed by the host. **Large pasted/attached text** is capped on the client and server (**~180 KB** of attachment payload). When Ollama returns HTTP **500** and `totalChars > 30,000`, the UI falls back to a **size-aware error** that hedges between context overflow and GPU/OOM — the formatter can't tell which 500 the user actually hit, so the copy reflects that uncertainty.

---

## How context is built for chat

1. **`fullMessages`** — System message (persona, capabilities, tools, memory, vision hints, project/chat folder) plus the message list from the client after light cleanup (e.g. strip old images, cap attachment blocks).
2. **Estimation** — Token budget is approximated as `ceil(totalChars / 3.5)` across string contents (not a real tokenizer; vision and tool JSON add cost not fully captured here).
3. **`num_ctx` (local Ollama only)** — If `autoAdjustContext` is true (default) and estimated tokens > 4096, `num_ctx` is bumped to `estimatedTokens + 2048`, capped at **524,288**. Cloud model names skip `num_ctx` entirely.
4. **`model: auto`** — Resolver can prefer models whose advertised `context_length` fits estimated need with **20% headroom**, plus tier preference (cloud above ~10K estimated tokens, local below ~2K) — see [lib/auto-model.js:222,304-316](lib/auto-model.js#L222). If nothing fits, user may see a `context_overflow` notice while still using a smaller model.

---

## Documented limits (code references)

| Mechanism                       | Approximate limit                                                                                                                                                                                                       | Notes                                                                                                                                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`num_ctx` ceiling**           | **524,288 tokens**                                                                                                                                                                                                      | Local models when auto-adjust applies; see `lib/chat-post-handler.js`, `lib/review.js`.                                                                                                                                                                 |
| **`numCtx` config**             | User override                                                                                                                                                                                                           | `lib/config.js`: default `0` (model default until auto-adjust raises it).                                                                                                                                                                               |
| **Cloud models**                | Provider-defined                                                                                                                                                                                                        | No `num_ctx` sent; failure = host limit or other 500. Cloud-ness is detected by substring match on the model name (`includes("cloud")`); custom OpenAI-compatible endpoints may be misclassified — see [lib/auto-model.js:103](lib/auto-model.js#L103). |
| **Attached files (server)**     | **180,000 characters** total in ATTACHED FILES block (`SERVER_ATTACHED_FILES_TOTAL_CHAR_CAP`).                                                                                                                          |
| **Attached files (client)**     | **120,000** per file / **180,000** total in `buildUserContent` (`useChat.js`).                                                                                                                                          |
| **Project planning context**    | **8,000 characters** injected block (`PROJECT_CONTEXT_MAX_CHARS`).                                                                                                                                                      |
| **Tool result aggregation cap** | **30,000 characters** per round (`TOOL_RESULTS_FINALIZER_MAX_CHARS`, [lib/chat-post-handler.js:45](lib/chat-post-handler.js#L45)) — distinct from the 30 KB error-message heuristic despite the matching number.        |
| **Browser snapshot floor**      | **4,000 characters** minimum (`BROWSER_CONTENT_FINALIZER_MIN_CHARS`, [lib/chat-post-handler.js:46](lib/chat-post-handler.js#L46)) — a floor, not a cap; ensures browser-content rounds get enough context to be useful. |
| **Error-copy heuristic**        | **`status === 500 && totalChars > 30000`** triggers the size-aware fallback message in [`formatUserOllamaChatError`](lib/ollama-client.js#L175).                                                                        |

**Effective throughput** is always the minimum of: requested `num_ctx`, model’s **real** `context_length`, and what **Ollama + GPU** can load.

---

## User-visible chat errors

All chat-error copy flows through [`formatUserOllamaChatError`](lib/ollama-client.js#L123) (`{status, detail, totalChars}`). It tries pattern matches in order; first match wins:

1. **Network unreachable** ([lib/ollama-client.js:128-136](lib/ollama-client.js#L128-L136)) — `status === 0` plus `fetch failed` / `ECONNRESET` / similar:
   > "Could not reach Ollama. Check that Ollama is running and Settings → General has the correct server URL."
2. **Detail says "context"-ish** ([lib/ollama-client.js:138-149](lib/ollama-client.js#L138-L149)) — error body mentions `context` plus any of `window`, `length`, `exceed`, `token`, `kv cache`, `n_ctx`, `nctx`:
   > "Context window or model limit exceeded. Try a shorter message, less history or tool output, or a model with a larger context."
3. **Model not found** ([lib/ollama-client.js:151-158](lib/ollama-client.js#L151-L158)) — detail mentions `not found` / `unknown` / `pull`.
4. **GPU/OOM** ([lib/ollama-client.js:160-173](lib/ollama-client.js#L160-L173)) — detail mentions `cuda` / `gpu` / `vram` / `out of memory` / `oom` / `mmap`.
5. **Size-aware 500 fallback** ([lib/ollama-client.js:175-181](lib/ollama-client.js#L175-L181)) — `status === 500 && totalChars > 30000`:
   > "The request is large (~${kb} KB of text). Ollama returned an error — often context size or GPU memory. Try fewer messages or attachments. Details: ${tail}"

The size-aware fallback is the **30 KB heuristic** referenced elsewhere in this doc — it deliberately hedges between "context" and "GPU memory" because the formatter can't tell which 500 the user actually hit. Other 500s (VRAM, runner crash, bad request) can still surface this generic message when the payload is large enough.

---

## Comparison to “context-mode” style systems (external)

Projects like [context-mode](https://github.com/mksglu/context-mode) combine:

- **MCP sandbox tools** (execute code, index/search, keep fat output out of the chat),
- **Host hooks** (PreToolUse / PostToolUse / PreCompact / SessionStart) on Claude Code, Cursor, etc.

Code Companion **does not** implement those IDE hooks. It **can** still benefit from **similar ideas** implemented **inside** the pipeline:

- Truncate or **offload** huge **tool results** before the next model round.
- **Sliding window** or **summarize-and-continue** for long threads while keeping full history in the UI store.
- **Stricter preflight** using per-model `context_length` + clearer errors when cloud vs local.

---

## Risks and gaps

1. **Char-based token estimates** underestimate or overestimate real token usage (code, non-English, images).
2. **Tool + MCP rounds** append text to history; large stdout can blow the budget even after attachment caps. The per-round `TOOL_RESULTS_FINALIZER_MAX_CHARS = 30,000` cap mitigates this within a single finalizer step but does not bound cumulative growth across rounds.
3. **Cloud** paths have no `num_ctx` auto-boost—users hit provider ceilings sooner.
4. **Agent "narration without TOOL_CALL"** does not shrink context; it can waste rounds and tokens (separate from raw bytes, but related operational load).
5. **No history compaction today.** Full conversation is sent every round; `num_ctx` auto-bump is the only mitigation. Compaction/windowing are listed under Suggested directions, not implemented.

---

## Suggested directions (for product / eng discussion)

Prioritize based on pain; items are independent.

1. **Preflight banner** — If `estimatedTokens` nears `effectiveContext` (from `/api/show` or heuristics), warn before send; offer “new thread” or “compact.”
2. **Server-side history compression** — Keep full transcript for UI; send model a **window + summary** when over policy.
3. **Tool output policy** — Cap or externalize `run_terminal_cmd` / MCP results with a “read more” / `read_file` path under project folder.
4. **Better 500 handling** — Parse Ollama error body when JSON; only show context hint when message matches known patterns.
5. **Optional MCP** — Users may add external sandbox/index MCP servers via Settings; document patterns; vet licenses before bundling third-party servers.

---

## Review checklist for readers

- [ ] Are the **numeric caps** still accurate in the files cited above?
- [ ] Should **30 KB / 524K** thresholds be **configurable** or **surfaced in Settings**?
- [ ] Is **cloud vs local** behavior clear enough in **user-facing docs** (`docs/TROUBLESHOOTING.md`, etc.)?
- [ ] Do we want **telemetry-free** local stats (session max tokens, truncation events) for support?

---

## License / distribution

This file is **project documentation** for Code Companion contributors. If you excerpt it elsewhere, keep technical claims in sync with the current implementation.
