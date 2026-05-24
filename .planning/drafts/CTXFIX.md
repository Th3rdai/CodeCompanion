# CTXFIX — Implementation plan for Code Companion context handling

**Status:** iteration 17 — adds six implementer hardening notes: (1) Phase 1 `/api/model-context` and Phase 2 `ctxTarget` share a single `getContextLengthForModel` (no inline duplication); (2) banner is a client-side heuristic and can under-estimate vs the server's `fullMessages`; (3) Phase 3 char cap covers `toolResults` text only — `toolResultMsg.images` (PDF page rasters) are out of scope for v1; (4) `sanitizeConvIdForFilename` lives in a shared module so writer + GC can't drift; (5) `getContextLengthForModel` return shape spelled out (`number`, `0` = unknown); (6) Phase 2 manual-test note for the dual `role: "system"` rebuilt transcript.
**Source:** [CTXREVIEW.md](CTXREVIEW.md) "Suggested directions" + "Risks and gaps"
**Target release:** v1.7.0 (Phases 4–5 unflagged; Phases 1–3 flag-gated, default off)

**Implementation gate (read before coding)**

- [ ] New SSE notice `kind` strings are **snake_case** only (see Cross-cutting table — must match grep of existing kinds in `lib/chat-post-handler.js`).
- [ ] Tool externalization paths are under `config.projectFolder` and use a **relative path** that [`readProjectFile`](lib/file-browser.js#L248) accepts (same as MCP `codecompanion_read_file`).
- [ ] Phase 4 lands in the **three commit slices** listed in Phase 4 (model-load-failed → JSON parse → tryRule + `log`).

**Iteration 11 edits (Cursor / plan-reviewer, for parallel review with Claude)**

- Grounded **MCP `codecompanion_read_file`** on **`readProjectFile`** + [`lib/file-browser.js`](lib/file-browser.js) (removed incorrect `validateProjectFilePath` attribution); clarified distinction from **builtin** path validation.
- Normalized **new** SSE `kind` values to **snake_case** everywhere (`compaction_summary`, `compaction_fallback`, `compaction_skipped`) and fixed Cross-cutting table drift (was kebab-case).
- Phase 3: **`pushToolResult` helper dropped** (iter 12) — externalize `toolResults` _before_ wrapping so wrapper text is preserved at both push sites. The same `externalizedToolResults` is interpolated into the live `loopMessages` wrapper (~1849-1853) AND the persisted `toolContextForHistory` wrapper (1871-1874). Integration test must assert the placeholder is a `readProjectFile`-compatible relative path.
- Phase 2: **implementer note** — run compaction **after** the existing `totalChars` / `estimatedTokens` block at ~782-786 (the first measurement is the trigger) and **before** the auto-bump at ~793; recompute `totalChars` / `estimatedTokens` in place; grep `fullMessages` for stale closures.
- Phase 4 tests: require **malformed JSON** fixture for `tryExtractJson` fail-closed behavior.

---

## Goals

Reduce context-window failures and improve diagnostics. Each phase is independently shippable; ship order is **4 → 5 → 1 → 3 → 2** (low-risk first; compaction last because highest behavioral impact).

1. **Preflight banner** — warn before sending a request that won't fit.
2. **History compaction** — server-side window + summary when over policy.
3. **Cumulative tool-output cap** — bound total tool bytes across rounds.
4. **Better 500 handling** — JSON-body parsing + one new pattern.
5. **Optional MCP doc** — recommend external sandbox/index MCP servers; no code.

**Out of scope:** telemetry; bundling third-party MCP servers; replacing the `ceil(totalChars / 3.5)` token estimate with a real tokenizer; agent narration suppression; applying compaction to `lib/review.js` (parallel auto-bump path is left untouched in v1).

---

## Phase 4 — Better 500 handling (ship first; no flag)

**Already done:** [`formatUserOllamaChatError`](lib/ollama-client.js#L123) currently has **6 active matching rules** (pre-PR, in priority order): `network-unreachable`, `context-overflow`, `model-not-found`, `gpu-oom`, **`cloud-opaque-500`** (added 2026-05-08, see [lib/ollama-client.js:181](lib/ollama-client.js#L181) — the `ref:<uuid>` Ollama Cloud rule, paired with auto-mode demote in [lib/chat-post-handler.js](lib/chat-post-handler.js)), and `large-payload-500` ([:185](lib/ollama-client.js#L185)). After this PR adds `model-load-failed`, the count becomes **7 active rules + `generic` fallback**. Two regression tests in [tests/unit/ollama-error-envelope.test.js](tests/unit/ollama-error-envelope.test.js) lock the cloud-opaque-500 behavior.

**Remaining work**

- Extend [`parseOllamaErrMsg`](lib/ollama-client.js#L108) so when `err.message` contains a JSON object substring, it `JSON.parse`-es it (try/catch) and returns `{status, detail, code, errType}` where:
  - `detail` = `parsed.error.message` if present, else the original raw string (preserves backwards compat).
  - `code` = `parsed.error.code` if present, else `undefined`.
  - `errType` = `parsed.error.type` if present, else `undefined`.

  **Robust JSON extraction** (avoid greedy capture across multi-JSON or noisy bodies):

  ```js
  function tryExtractJson(s) {
    if (typeof s !== "string" || s.length === 0) return null;
    const slice = s.length > 4096 ? s.slice(0, 4096) : s; // cap input
    // Try last `{` first (Ollama appends JSON after a status line); fall back to first.
    for (const start of [slice.lastIndexOf("{"), slice.indexOf("{")]) {
      if (start < 0) continue;
      const end = slice.lastIndexOf("}");
      if (end <= start) continue;
      try {
        return JSON.parse(slice.slice(start, end + 1));
      } catch {
        /* try next */
      }
    }
    return null;
  }
  ```

  Existing callers using only `{status, detail}` continue to work unchanged.

- New rule in `formatUserOllamaChatError`, **between current `model-not-found` ([:151](lib/ollama-client.js#L151)) and `gpu-oom` ([:160](lib/ollama-client.js#L160))** — insert at the blank line ([line 159](lib/ollama-client.js#L159)) immediately after the `model-not-found` block closes at [line 158](lib/ollama-client.js#L158), before the `gpu-oom` `if (` at [line 160](lib/ollama-client.js#L160). If detail mentions `manifest unknown` / `blob not found` / `failed to load model` / `model not loaded`, return `"The model failed to load. Try \`ollama pull <model>\` or pick a different model. Details: <tail>"`. Canonical name: `model-load-failed`.
- Refactor each rule into a small internal `tryRule(name, predicate, message)` helper that returns `{matched: name, message}` or `null`. The outer function iterates rules, and on match calls a logger before returning. **Function signature change** (the only API impact): `formatUserOllamaChatError` accepts a new optional `{ log }` parameter:

  ```js
  function formatUserOllamaChatError({ status, detail, totalChars = 0, log }) {
    // ...iterate rules, on match:
    if (typeof log === "function") {
      log("INFO", "ollama-chat-error", { matched: name, status, totalChars });
    }
    return message;
  }
  ```

  Existing **4** call sites in [lib/chat-post-handler.js](lib/chat-post-handler.js#L1207) ([:1207](lib/chat-post-handler.js#L1207), [:2056](lib/chat-post-handler.js#L2056), [:2184](lib/chat-post-handler.js#L2184), [:2250](lib/chat-post-handler.js#L2250)) gain `log` in the destructured argument; behavior preserved when `log` is omitted. Each site already has `log` available from `appContext.log` (destructured at [lib/chat-post-handler.js:483](lib/chat-post-handler.js#L483)). `log` signature confirmed at [lib/logger.js:29](lib/logger.js#L29) — `(level, msg, data)` — created via `createLogger(appRoot)` and threaded through `appContext`. **Final canonical rule names** (post-refactor, logged as `matched` — **kebab-case** is fine here): `network-unreachable`, `context-overflow`, `model-not-found`, `model-load-failed` (new), `gpu-oom`, `cloud-opaque-500`, `large-payload-500`, `generic`. **Do not confuse** with SSE `notice.kind` strings (those are **snake_case** per Cross-cutting). **No PII**: `detail` is intentionally omitted from the log meta.

  **Recommended commit order** (so the file's tested invariants don't shift in one giant diff): (a) add `model-load-failed` rule first as a small inline check; (b) extend `parseOllamaErrMsg` for JSON; (c) refactor to `tryRule` + add `log` parameter. Each is independently revertable.

**Tests**

- Extend existing [tests/unit/ollama-error-envelope.test.js](tests/unit/ollama-error-envelope.test.js) — add cases for: JSON-body fixture (verify `code` and `errType` populated), the new `model-load-failed` rule (4 keyword variants), and a `matched` rule-name assertion for each of the existing 6 rules (network-unreachable, context-overflow, model-not-found, gpu-oom, cloud-opaque-500, large-payload-500) to lock the canonical names. Add at least one **malformed / nested-brace** string so `tryExtractJson` fails closed into the legacy regex path (no throw).

**Risk:** low — pure additions; no behavior change for current matched cases.

---

## Phase 5 — Optional MCP documentation (ship second; no flag)

**Files**

- New: [docs/MCP-SANDBOX-PATTERNS.md](docs/MCP-SANDBOX-PATTERNS.md).
- Cross-link from [docs/CC-CONFIG.md](docs/CC-CONFIG.md) and [.cc-config.json.example](.cc-config.json.example).

**Content**

- Pattern: "execute code in a sandbox, return only artifacts" — pseudocode with stdio MCP.
- Pattern: "indexed search over project files" — pseudocode with HTTP MCP.
- License vetting checklist before adopting any third-party server.
- **Do not** bundle third-party servers in the installer.

No code, no tests, no flag.

---

## Phase 1 — Preflight banner

**Files**

- New: [src/lib/context-budget.js](src/lib/context-budget.js) — exports `estimateTokens(text)` (`Math.ceil(totalChars / 3.5)`) and `estimateMessageTokens(messages)` (sums `estimateTokens(m.content || "")` across the array). Imported by client AND server. The helper itself **never** adds response-headroom — call sites add it explicitly so each caller's existing behavior is preserved exactly:
  - [lib/chat-post-handler.js:786](lib/chat-post-handler.js#L786) — was `const estimatedTokens = Math.ceil(totalChars / 3.5);` → `const estimatedTokens = estimateMessageTokens(fullMessages);` (no `+ 2048` here — chat handler adds headroom later at [:796](lib/chat-post-handler.js#L796) where `needed = estimatedTokens + 2048`).
  - [lib/review.js:94-99](lib/review.js#L94-L99) — was `const estimatedTokens = Math.ceil(totalChars / 3.5) + 2048;` → `const estimatedTokens = estimateMessageTokens(messages) + 2048;` (the `+ 2048` headroom stays at the call site to preserve current `numCtx` selection).

  Output values are byte-identical to the prior inline formulas on all current inputs. Covered by a unit test that asserts parity against the old inline formula on 5 fixtures (with and without the `+ 2048` callsite addend).

- New endpoint in [server.js](server.js): `GET /api/model-context?name=<modelName>` → `{ contextLength: number|null, source: "show"|"cloud-hint"|"unknown" }`. For `auto` mode: `GET /api/model-context?auto=1&estimatedTokens=<N>` → `{ contextLength: number|null, source, resolvedModel: string }` (extra `resolvedModel` field). **Security:** gate via existing [`requireLocalOrApiKey`](lib/security-helpers.js#L28) middleware (created via `createRequireLocalOrApiKey` in [server.js:80](server.js#L80) and reused for other Ollama-touching routes). Implementation:
  - **Use the same `getContextLengthForModel(name, ollamaUrl, apiKey)` helper that Phase 2 introduces** (in `lib/auto-model.js` — see Phase 2 step 2). Do NOT inline `isCloudModelName` / `fetchContextLength` calls in the route handler — that would let the API route's behavior drift from the chat handler's `ctxTarget` resolution. The route then maps the helper's `number` return into the API surface: `>0` → `{contextLength, source: "show"|"cloud-hint"}` (use `isCloudModelName` only to label the source, not to gate the lookup); `0` → `{contextLength: null, source: "unknown"}`.
  - Cache responses in a per-server `Map<string, {at: number, value: object}>` with TTL `5 * 60 * 1000` ms keyed by `${ollamaUrl}|${name}` for the per-name path. For the `auto` path, key by `${ollamaUrl}|auto|${bucket}` where the bucket uses **hysteresis** to avoid flicker near boundaries:
    ```js
    // Current bucket = floor(estimatedTokens / 4096); but only switch to a new
    // bucket when crossing the boundary by ≥256 tokens to absorb keystroke noise.
    const STEP = 4096;
    const HYSTERESIS = 256;
    function bucketFor(prevBucket, estimatedTokens) {
      const raw = Math.floor(estimatedTokens / STEP);
      if (prevBucket == null) return raw;
      if (raw === prevBucket) return prevBucket;
      const boundary = (raw > prevBucket ? raw : prevBucket) * STEP;
      const dist = Math.abs(estimatedTokens - boundary);
      return dist >= HYSTERESIS ? raw : prevBucket;
    }
    ```
    Track `prevBucket` per `${ollamaUrl}` in the same module-scoped Map. Distinct from the singleton-shaped existing [`_listModelsCache`](lib/ollama-client.js#L206) but uses the same TTL pattern.
- [src/hooks/useChat.js](src/hooks/useChat.js) — when `selectedModel` OR `ollamaUrl` changes, fire `apiFetch('/api/model-context?name=…')`; store result in a `useRef` Map keyed by `${ollamaUrl}|${model}` so stale entries from a prior server don't bleed across. Recompute `estimatedTokens` whenever `messages` or `pendingInput` changes.
- [src/App.jsx](src/App.jsx) — banner is a thin strip rendered **immediately above the chat input region** (search for the input render block; render banner conditionally just before it). Visible iff `enablePreflightBanner === true` AND `effectiveContext != null` AND `estimatedTokens > 0.8 * effectiveContext`. Banner shows: `~{est}K of ~{ctx}K tokens used. Approaching limit.` where K = 1000 (display convention; tokens not bytes).

  **Gate the effects, not just the render (default-off = zero cost):** the `/api/model-context` fetch effect AND the debounced token-estimate effect must each early-return when `enablePreflightBanner` is falsy (and list it in their dependency arrays), so an install with the flag off — the default — never polls `/api/model-context` on model change and never recomputes tokens per keystroke. Gating only the JSX (`visible={... && enablePreflightBanner}`) leaves the effects running for every user; the flag must short-circuit the work, not just hide the strip.

  **Heuristic disclaimer (document in [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)):** the banner estimates from client-visible `messages` + `pendingInput` only. The server-side `fullMessages` ([lib/chat-post-handler.js:761-779](lib/chat-post-handler.js#L761-L779)) additionally prepends the enriched system prompt (persona, tool list, brand assets, project context up to ~8 KB), the memory-context preamble, and tool-call schemas. Real submission size is therefore **larger** than the banner shows, especially when memory is enabled or many tools are active. The 0.8 threshold deliberately leaves headroom for this; it is a "you're approaching the limit" hint, not a budget oracle.

  Buttons:
  - **New thread** — always rendered; calls existing new-conversation handler.
  - **Compact now** — rendered **only** when Phase 2 has shipped AND `config.enableHistoryCompaction === true`. In a Phase-1-only build, this button is not in the DOM at all (don't render with `disabled` — render conditionally so DOM querytests don't find it).

  Debounce token re-estimation to 200 ms on `pendingInput` change to avoid O(N) message walks per keystroke; recompute immediately on `messages` change.

**`auto` model handling**

`auto` is the default, so the banner must work for it. When `selectedModel === "auto"`:

- Client calls `GET /api/model-context?auto=1&estimatedTokens=<N>` instead of `?name=…`.
- Server implementation:

  ```js
  const r = await resolveAutoModel({
    requestedModel: "auto",
    mode: "chat",
    estimatedTokens,
    config,
    ollamaUrl: config.ollamaUrl,
    ollamaOpts: ollamaAuthOpts(config),
  });
  const resolvedModel = r.resolved;
  // Recurse into the per-name path to find that model's context:
  const inner = isCloudModelName(resolvedModel)
    ? {
        contextLength: guessCloudContext(resolvedModel) || null,
        source: "cloud-hint",
      }
    : await fetchContextLength(
        config.ollamaUrl,
        resolvedModel,
        config.ollamaApiKey,
      ).then((len) => ({
        contextLength: len || null,
        source: len ? "show" : "unknown",
      }));
  return { ...inner, resolvedModel };
  ```

  This intentionally does **not** lock in the resolver decision — final resolution still happens at chat-send time. The banner shows the preview model's context plus a small "may auto-switch" subtitle (rendered in muted text below the main banner copy, e.g. `<p className="text-xs text-slate-400 mt-1">Auto mode may pick a different model at send time.</p>`). Reuses [`resolveAutoModel`](lib/auto-model.js#L198), [`guessCloudContext`](lib/ollama-client.js#L234), and [`fetchContextLength`](lib/ollama-client.js#L241).

**Cloud detection**

Reuses [`isCloudModelName`](lib/auto-model.js#L103) (substring `"cloud"` match). Documented limitation in [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md): custom OpenAI-compatible endpoints named without "cloud" will be treated as local.

**Edge cases**

- Endpoint returns `null` → banner hidden. Logged once per session.
- Streaming response in flight → banner reflects pending payload only; does not block submit.
- Rapid model swap → cache entry stays in `useRef` Map across swaps; TTL handles eviction.

**Config**

- [lib/config.js](lib/config.js) — add `enablePreflightBanner: false` near [line 98](lib/config.js#L98) (`autoAdjustContext`). Document in [docs/CC-CONFIG.md](docs/CC-CONFIG.md) and [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md).

**Tests**

- Unit: `tests/unit/context-budget.test.js` — `estimateTokens` parity with the prior in-line formula across 5 sample inputs.
- Integration: `tests/integration/model-context-api.test.js` — endpoint returns advertised length for a known local model, cloud-hint length for `gpt-4o:cloud`, and `null` for an unknown name.
- UI: `tests/ui/preflight-banner.spec.js` (Playwright). Land in two parts to match phase shipping:
  - **With Phase 1**: a single test case for the Phase-1-only build (`enablePreflightBanner: true`, `enableHistoryCompaction: false`): paste an oversized blob; banner appears; **New thread** button visible and clears messages on click; **Compact now** is **not in the DOM** (`expect(page.getByRole('button', { name: /Compact now/ })).toHaveCount(0)`).
  - **Add when Phase 2 ships** (not now): second test case for the Phases 1+2 build (both flags on): same paste; both buttons present; **Compact now** triggers a `/api/chat` round that emits a `compaction_summary` SSE notice (`kind` must match Cross-cutting). The Phase 2 PR adds this test case alongside the compactor.

**Risk:** medium — touches client and server, but all default-off behind flag.

---

## Phase 3 — Cumulative tool-output cap

**Problem**

Per-round cap [`TOOL_RESULTS_FINALIZER_MAX_CHARS = 30000`](lib/chat-post-handler.js#L45) caps a single finalizer step. Across many rounds, accumulated tool stdout grows unbounded in `loopMessages`.

**Constraint discovered during review (codebase-verified)**

The agent reads externalized tool output via the MCP tool **`codecompanion_read_file`**, registered at [mcp/tools.js:340](mcp/tools.js#L340). That handler calls **[`readProjectFile(projectFolder, filePath)`](lib/file-browser.js#L248)** — **not** [`validateProjectFilePath`](lib/builtin-agent-tools.js#L413) (that helper is for **builtin** `read_file` / agent terminal paths). `readProjectFile` resolves `path.resolve(projectFolder, relativePath)` and rejects traversal (`lib/file-browser.js` ~249–252).

**Therefore:** externalized files MUST live under **`config.projectFolder`** (e.g. `.codecompanion/tool-results/…`) with a **safe relative path** the model can pass to `codecompanion_read_file`. OS temp is **rejected** because reads outside `projectFolder` fail the same boundary check.

**Fix**

In [lib/chat-post-handler.js](lib/chat-post-handler.js) tool loop:

- Track `const cumulativeRef = { value: 0 }` at the start of the request handler (boxed into an object so it can be passed by reference through the `ctx` parameter). **Ownership rule (single writer):** `maybeExternalizeToolOutput` **reads** `cumulativeRef.value` for the threshold check (`cumulativeRef.value + content.length > MAX`) and MUST NOT mutate it. The **caller** is the sole writer — it does `cumulativeRef.value += externalizedToolResults.length` after the call. This avoids double-counting and keeps the increment site grep-able. Reset semantics: **per `/api/chat` POST**, surviving across SSE rounds within that request. Not persisted between requests. The cap bounds **bytes in the LLM-bound message stream**, not on-disk bytes — disk usage is bounded by GC. After externalization, `cumulativeRef.value` is incremented by the placeholder length (~80 B), not the original (e.g. 200 KB), which is intentional: the cap protects the prompt, the GC protects the disk.
- **Consolidation note (verified by grep of `loopMessages\.push` in the file):** the **only** `role: "user"` push that carries tool-result content is at [lib/chat-post-handler.js:1863](lib/chat-post-handler.js#L1863) — `loopMessages.push(toolResultMsg)`. The associated assistant push at [:1830-1831](lib/chat-post-handler.js#L1830-L1831) is `role: "assistant"` and out of scope. **All other `loopMessages.push({role: "user", …})` sites in this file (L890 recovery-mode, L991 file-write-blocked, L1342 blocked-file-write retry, L1371 file-write-meta retry, L1398 permission-deflection retry, L1421 browser-deflection retry, L1442 browser-continuation retry, L1481 auto-continue, L1535 no-TOOL_CALL retry, etc.) are correction-retry / continuation prompts and MUST be left as direct `loopMessages.push` — they do not carry tool output and externalizing them would corrupt the retry flow.**

- **Externalize before wrapping** (preserves the wrapper text the model relies on — `"Tool results:\n"`, `"Present these results to the user…"`, the browser variant, and the persisted `[Tool: …]` prefix). Insert immediately **before `const toolResultMsg = {`** at [:1848-1854](lib/chat-post-handler.js#L1848-L1854); externalize the raw `toolResults` string once and re-use it in both wrappers:

  ```js
  // Insert immediately before the `const toolResultMsg = {` line at ~1849.
  // `round` is the existing loop counter at lib/chat-post-handler.js:1053
  // (`for (let round = 0; round < MAX_ROUNDS; round++)`); it is passed as
  // `roundIdx` to keep the helper signature stable across future call sites.
  const externalizedToolResults = maybeExternalizeToolOutput(toolResults, {
    config,
    conversationId,
    reqSuffix, // generated once at top of handleChatPost
    roundIdx: round, // existing loop counter at :1053
    cumulativeRef,
  });
  cumulativeRef.value += externalizedToolResults.length;

  // L1849-1853 — wrapper now wraps the (possibly externalized) stdout:
  const toolResultMsg = {
    role: "user",
    content: _executedBrowserTool
      ? `Tool results:\n${externalizedToolResults}\n\n⚡ BROWSER TASK IN PROGRESS — …`
      : `Tool results:\n${externalizedToolResults}\n\nPresent these results to the user …`,
  };
  // …
  loopMessages.push(toolResultMsg); // L1863 — unchanged

  // L1871-1874 — persisted form wraps the SAME externalized content
  // so saved conversations don't balloon:
  toolContextForHistory.push({
    role: "user",
    content: `[Tool: ${toolCalls.map((c) => `${c.serverId}.${c.toolName}`).join(", ")}]\n${externalizedToolResults}`,
  });
  ```

  `maybeExternalizeToolOutput(content, ctx)` is the new helper (added in [lib/chat-post-handler.js](lib/chat-post-handler.js) or a small new module — implementer's choice). Contract: returns `content` unchanged if `cumulativeRef.value + content.length <= cumulativeToolOutputMaxChars`; otherwise writes to `<projectFolder>/.codecompanion/tool-results/<safeId>-<reqSuffix>-<roundIdx>.txt` (when `config.projectFolder && config.externalizeToolOutput`) and returns the placeholder `"Tool output saved to .codecompanion/tool-results/<file> (~<N> KB). Use codecompanion_read_file to inspect."`. When no project folder OR flag off, returns `content.slice(-5000) + "[truncated — set Settings → Project folder to externalize]"`. **The previously proposed `pushToolResult(loopMessages, msg, ctx)` helper is dropped** — it would have replaced the wrapped `msg.content` (wrapper + stdout) with the placeholder, losing the "Present these results" instruction.

- When a new tool result of length `L` would cause `cumulativeRef.value + L > CUMULATIVE_TOOL_OUTPUT_MAX_CHARS = 100000` (configurable: `cumulativeToolOutputMaxChars`):
  - **If `config.projectFolder` is set** → write full result to `<projectFolder>/.codecompanion/tool-results/<safeId>-<reqSuffix>-<roundIdx>.txt`, where:
    - `conversationId` is the existing field at [lib/chat-post-handler.js:489](lib/chat-post-handler.js#L489) (already passed in request body).
    - **Sanitize before path concatenation** to block path traversal / NUL / slash injection. **Place `sanitizeConvIdForFilename` in a small new shared module** — `lib/tool-result-artifacts.js` — so the **three** call sites (chat handler write, history-delete GC in [lib/history.js](lib/history.js), startup sweep in [server.js](server.js)) all import the same function and can never drift. Without sharing, history.js could sanitize differently from the writer and every delete leaves orphan files. The module exports:
      ```js
      // lib/tool-result-artifacts.js
      function sanitizeConvIdForFilename(id) {
        const s = String(id || "")
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .slice(0, 64);
        return (
          s || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        );
      }
      function generateReqSuffix() {
        return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      }
      module.exports = { sanitizeConvIdForFilename, generateReqSuffix };
      ```
      Top of `handleChatPost` (runs unconditionally, regardless of whether externalization ever fires this request):
      ```js
      const {
        sanitizeConvIdForFilename,
        generateReqSuffix,
      } = require("./tool-result-artifacts");
      const safeId = sanitizeConvIdForFilename(conversationId);
      // Per-request disambiguator — prevents two concurrent /api/chat requests
      // for the same conversationId from overwriting each other's round files.
      // Generated once per request; reused for every round so GC can match
      // `<safeId>-<reqSuffix>-*.txt`.
      const reqSuffix = generateReqSuffix();
      ```
      `lib/history.js` (delete-GC) and `server.js` (startup sweep) require the same module and call `sanitizeConvIdForFilename(conversationId)` to construct their glob.
      Empty / missing / fully-stripped IDs fall through to the same request-scoped fallback as before. The `reqSuffix` is independent of the safeId fallback — both apply.
    - On first creation of `<projectFolder>/.codecompanion/`, also write `.codecompanion/.gitignore` with content:
      ```
      tool-results/
      ```
      (narrow rule — ignores only the externalization subfolder, leaves the `.gitignore` file itself trackable so users don't need `git add -f`.)

    Replace the inline tool result (both in the message sent to the LLM AND in the saved conversation history) with `Tool output saved to .codecompanion/tool-results/<file> (~<N> KB). Use codecompanion_read_file to inspect.` — full output exists only on disk.

  - **If no project folder** → fall back to truncating to last 5K chars + suffix `[truncated — set Settings → Project folder to externalize]`. Externalization to OS temp is **rejected** because the agent cannot read it back through the validated path.

- The existing per-round `TOOL_RESULTS_FINALIZER_MAX_CHARS = 30000` cap stays — it bounds a single finalizer step. Cumulative cap is in addition.
- **GC** runs at three trigger points:
  1. End of each chat request — `setImmediate(() => deleteOlderThan(dir, 7 * 24 * 3600 * 1000))`. Non-blocking; failure tolerated silently.
  2. Conversation deletion — when [lib/history.js](lib/history.js) deletes a conversation, also remove `<projectFolder>/.codecompanion/tool-results/<safeId>-*-*.txt` where `safeId = sanitizeConvIdForFilename(conversationId)` (same helper as the write path — without sanitizing on lookup, conversations whose IDs contain slashes/dots produce orphan files). The trailing `-*-*` matches both the per-request `<reqSuffix>` and the per-round index, sweeping every file ever written for that conversation across all in-flight or past requests.
  3. Server startup — one-shot sweep of `<config.projectFolder>/.codecompanion/tool-results/` only (not arbitrary folders), removing files older than 7 days. Run from [server.js](server.js) after config load. No-op when `config.projectFolder` is unset.

**Edge cases**

- Filesystem write fails (EACCES, disk full) → fall back to in-place truncation per the no-project-folder branch.
- Concurrent chats writing to the same dir — filenames `<safeId>-<reqSuffix>-<roundIdx>.txt` are unique even when two `/api/chat` requests share a `conversationId`, because each request generates its own `reqSuffix` at the top of `handleChatPost`; no lock needed.
- **Vision images NOT covered by this cap (v1 acceptable, follow-up tracked):** the cap counts characters in `toolResults` only. The same tool round can attach `toolResultMsg.images` ([lib/chat-post-handler.js:1856-1857](lib/chat-post-handler.js#L1856-L1857) — PDF page rasters from `view_pdf_pages`). Those base64 payloads are **not** included in `cumulativeRef.value` and remain in the LLM-bound message. Acceptable for v1 because (a) image attachments are a small minority of tool rounds and (b) base64 size is bounded by the existing `imageSupport.maxSizeMB` config. Open as a follow-up: extend the cap to count attached image bytes once we have telemetry showing it's a real cause of overflow.

**Config**

- `cumulativeToolOutputMaxChars: 100000`
- `externalizeToolOutput: false` (DEFAULT OFF in v1.7.0 to avoid surprising existing tests/users; flip to `true` in v1.7.1 after dogfood)

**Tests**

- Integration: simulate 5 tool calls each producing 30K of stdout with flag on + project folder set; assert files appear in `<projectFolder>/.codecompanion/tool-results/`; assert subsequent agent round can read them via `codecompanion_read_file` using the **exact relative path** echoed in the placeholder (must succeed through `readProjectFile`); assert GC removes old files. Also test the no-project-folder branch returns truncated inline content.

**Risk:** medium — interacts with security path validation; tested.

---

## Phase 2 — Server-side history compaction

**Trigger and order of operations**

In [lib/chat-post-handler.js](lib/chat-post-handler.js), the existing flow at [:761-806](lib/chat-post-handler.js#L761-L806) is: build `fullMessages` (~761-779), compute `totalChars` / `estimatedTokens` (~782-786), then auto-bump `effectiveNumCtx` / `effectiveTimeoutMs` (~793+). Compaction inserts **between** the first `estimatedTokens` and the auto-bump:

```
1. Build fullMessages (existing, ~761-779)
2. Compute totalChars / estimatedTokens (existing, ~782-786) — this is the
   trigger measurement; do NOT move it.
3. If config.enableHistoryCompaction && estimatedTokens > 0.9 × ctxTarget:
     a. Run compactor → produces compactedFullMessages
     b. Replace fullMessages = compactedFullMessages
     c. Re-compute totalChars / estimatedTokens against the new fullMessages
        (overwrite, do not branch)
4. Continue with the existing auto-bump / num_ctx logic (~793+) — it now
   reads the post-compaction estimatedTokens.
```

`ctxTarget` resolution, in order:

1. If `effectiveNumCtx > 0` after the user-set override → use it.
2. Else `await getContextLengthForModel(model, ollamaUrl, apiKey)` — **new helper to add** in [lib/auto-model.js](lib/auto-model.js) (NOT `ollama-client.js`). Reason: the helper needs both `isCloudModelName` ([lib/auto-model.js:103](lib/auto-model.js#L103)) AND `guessCloudContext` / `fetchContextLength` from ollama-client. Since `auto-model.js` already requires ollama-client at [:6](lib/auto-model.js#L6) (`const { listModels } = require("./ollama-client")`), placing the helper in auto-model keeps the dependency strictly one-way. Putting it in ollama-client would force `require("./auto-model")` from there and create a circular dep.

   Implementation in `lib/auto-model.js`:

   ```js
   const { guessCloudContext, fetchContextLength } = require("./ollama-client");
   async function getContextLengthForModel(name, ollamaUrl, apiKey) {
     if (isCloudModelName(name)) return guessCloudContext(name) || 0;
     return await fetchContextLength(ollamaUrl, name, apiKey);
   }
   module.exports = { ..., getContextLengthForModel };
   ```

   **Return-shape contract:** always `number`. `>0` = a real advertised context length; `0` = unknown / lookup failed. Never `null`, `undefined`, or `NaN`. Both wrapped helpers ([`guessCloudContext`](lib/ollama-client.js#L234) and [`fetchContextLength`](lib/ollama-client.js#L241)) already follow this convention (they return `0` on miss/error). Callers like Phase 2's `ctxTarget` resolution rely on `0` being falsy so the `||` fallback chain works (`effectiveNumCtx || (await getContextLengthForModel(...)) || config.numCtx || 8192`). The `/api/model-context` route is the only caller that converts `0` → `null` for the JSON response — that translation lives in the route handler, not in the helper.

3. Else `config.numCtx || 8192`.

**Compactor — new module**

[lib/history-compaction.js](lib/history-compaction.js) exports `compactHistory({ messages, systemMessage, model, ollamaUrl, apiKey, keepRecent, summarizerModel, maxSummaryChars, log })`.

**Input/output contract:**

- `messages` — the user/assistant/tool slice **excluding** the chat handler's enriched system prompt. Caller supplies `cleanedMessages` — already built and assembled into `fullMessages` at [lib/chat-post-handler.js:761-779](lib/chat-post-handler.js#L761-L779) (the system-prompt prepend is in that same block; line 786 is where `estimatedTokens` is computed, NOT where messages are assembled).
- `systemMessage` — the existing enriched system prompt object (`{ role: "system", content: "..." }`). The compactor returns it untouched as the first element of `rebuiltMessages`. The compactor never re-summarizes the system prompt.
- Returned `rebuiltMessages` shape: `[systemMessage, { role: "system", content: <summary>, _kind: "compaction_summary" }, ...messages.slice(splitIdx)]`. The chat handler assigns this to `fullMessages` directly.

  **Two consecutive `role: "system"` messages — manual test required before flag flip.** The codebase has never sent dual system messages to Ollama before this PR (the existing handler always builds exactly one enriched system prompt at [:761-779](lib/chat-post-handler.js#L761-L779)). Most Ollama backends concatenate consecutive system messages with `\n\n`, but a small number of community-built models or custom modelfiles drop the second one. Before flipping `enableHistoryCompaction: true` in v1.7.2+, run the manual test in **Verification** (paste 500K chars → confirm summary actually appears in the model's response context) against each cloud-allowed model in `historyCompactSummarizerModelLocal` and the top-3 local models in production use. If a model ignores the summary, document it and either (a) merge the two system messages into one with a separator, or (b) prepend the summary to the first user message instead.

  **Run this in parallel via sub-agents.** Each `(model, prompt)` pair is independent — spawn one sub-agent per model (typically 5-7 agents in a single tool-call batch). Each agent: paste the 500K-char fixture, submit, report PASS/FAIL on whether the summary's key facts appear in the response, cap report at ~250 words. Aggregate into a PASS/FAIL table before flipping. Sequential is ~10-15 min total; parallel finishes in one, and matches the established "N domains × 1 min each" pattern used elsewhere in this project for multi-model smoke tests.

Strategy:

- **Message-shape note (re-verified against [lib/chat-post-handler.js:1822-1874](lib/chat-post-handler.js#L1822-L1874) — the actual tool-result push site, NOT the correction-retry pushes at 1340-1421):** Code Companion does NOT use OpenAI-style `role: "tool"` messages. Crucially, the assistant message pushed alongside a tool result has `TOOL_CALL:` **stripped** — see [:1825-1828](lib/chat-post-handler.js#L1825-L1828) (`cleanedResponse = responseText.slice(0, firstToolIdx).trim()` before the assistant push at [:1830-1831](lib/chat-post-handler.js#L1830-L1831)). The literal string `TOOL_CALL:` does **not** appear in the assistant message of stored history.

  The pair pattern, by storage site:

  | Site                                                  | Assistant content                                                                              | User content                                                                                |
  | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
  | `loopMessages` (live, in-request)                     | `<cleanedResponse>` (TOOL_CALL stripped at [:1825-1828](lib/chat-post-handler.js#L1825-L1828)) | starts with `Tool results:\n…` ([:1853](lib/chat-post-handler.js#L1853))                    |
  | `toolContextForHistory` → persisted conversation file | same `<cleanedResponse>` ([:1866-1869](lib/chat-post-handler.js#L1866-L1869))                  | starts with `[Tool: <serverId>.<toolName>, …]\n…` ([:1873](lib/chat-post-handler.js#L1873)) |

  The split-walk must avoid bisecting this pair AND avoid leaving a synthetic `role: "user"` tool-result message at the start of the kept window without its triggering assistant message.

  **Compaction operates on the saved conversation messages array** (delivered in the chat request body and assembled into `fullMessages` at [:761-779](lib/chat-post-handler.js#L761-L779); the first `estimatedTokens` measurement that triggers compaction is at [:782-786](lib/chat-post-handler.js#L782-L786)) — i.e. the `toolContextForHistory` shape with the `[Tool: ` prefix. The detector keys off the **user** message prefix, not the assistant content.

- **Find safe split point** at index `splitIdx = messages.length - keepRecent`, then walk **backwards**:

  ```
  // Stable contract emitted by chat-post-handler.js:1873 for persisted history.
  const TOOL_RESULT_USER_PREFIX = /^\[Tool:\s/;
  // Live-loop fallback (only relevant if compaction ever runs against `loopMessages`).
  const LIVE_TOOL_RESULT_USER_PREFIX = /^Tool results:\n/;

  while splitIdx > 0:
    cur = messages[splitIdx]
    // A "user" message at the boundary that starts with the tool-result prefix
    // is a synthetic tool-result, not a genuine user turn — it must not become
    // the first kept message without its triggering assistant turn preceding it.
    isToolResultPseudoUser = (
      cur?.role === "user" &&
      typeof cur.content === "string" &&
      (TOOL_RESULT_USER_PREFIX.test(cur.content) ||
       LIVE_TOOL_RESULT_USER_PREFIX.test(cur.content))
    )
    if isToolResultPseudoUser:
      splitIdx--   // step back past the synthetic user (tool result)
      splitIdx--   // and past the assistant that triggered it
      if splitIdx < 0: { splitIdx = 0; break }   // floor clamp — never slice from negative
    else:
      break
  ```

  Bounded — terminates at `splitIdx <= 0` (whole history kept verbatim, no compaction needed). Genuine user turns (no `[Tool: ` prefix) are valid split boundaries.

- Summarize messages `[0, splitIdx)` via a single Ollama chat call. Build the request as: **summarizer system message** = `"You summarize prior conversations for context. Preserve task goals, decisions, file paths, unresolved questions. ≤500 words. Output plain text only."`, followed by the original user/assistant/tool messages from `[0, splitIdx)` as-is. **Do not** include the chat handler's normal system prompt (persona, tools, brand) — only the summarizer's instruction.
- Return `{ summary: string, summarizedRange: [firstIdx, splitIdx-1], rebuiltMessages: [systemMsg, summaryAsSystem, ...messages.slice(splitIdx)] }`.
- On successful compaction, emit `sendEvent({ notice: { kind: "compaction_summary", originalCount: messages.length, keptRecent: keepRecent, summarizedRange, summaryChars: summary.length } })` from the chat handler. Lets the UI surface a "compacted N messages" badge in the next turn. **Naming:** every existing SSE `kind` in [lib/chat-post-handler.js](lib/chat-post-handler.js) is **snake_case** (`context_overflow`, `cloud_model_demoted`, `tool_call_retry`, `round_limit`, etc.) — new kinds MUST follow that convention (no kebab-case).

**Cache**

- Cache key: `sha256(messages.slice(0, splitIdx).map(m => `${m.role}:${(m.content||"").length}:${(m.content||"").slice(0,64)}`).join("|"))` — content-fingerprint, not ID-based, because [lib/history.js](lib/history.js) message IDs aren't guaranteed stable across reloads.
- Stored in conversation file under `conversation.compactionSummaries: [{ keyHash, summary, range, createdAt }]`. Persisted via [`saveConversation`](lib/history.js#L129).
- On load, reuse a cached summary iff there exists `entry` in `compactionSummaries[]` whose `entry.keyHash === currentKeyHash` AND `entry.range[1] === splitIdx - 1`. Otherwise compute fresh.

**Summarizer model selection**

- Default: same as active model (`summarizerModel: "active"`).
- If active is cloud AND `historyCompactCloudAllowed === false` → fall back to a local model named in `historyCompactSummarizerModelLocal` config (default: empty → first local model returned by `/api/models`).
- If no local model available → skip compaction; emit `{kind: "compaction_skipped", reason: "no-local-summarizer"}` SSE notice.

**Edge cases**

- Summary call fails (timeout, error) → skip compaction, fall back to **truncating to last K messages** lossy. Emit SSE notice `{kind: "compaction_fallback", reason}`.
- Summary itself is large → cap at `historyCompactMaxSummaryChars` (default 2000), trim with `…[truncated]`. Log WARN.
- User clears history mid-conversation → `compactionSummaries[]` are stored inside the conversation file itself, so they are deleted atomically when [lib/history.js](lib/history.js) deletes the conversation. No additional cleanup hook needed.
- Conversation file size — cap `compactionSummaries` array length at **5** (oldest evicted FIFO). With `historyCompactMaxSummaryChars: 2000`, worst-case overhead is ~10 KB per conversation file.
- `keepRecent` larger than `messages.length` → no-op, no compaction needed.

**Config**

- `enableHistoryCompaction: false`
- `historyCompactKeepRecent: 10`
- `historyCompactCloudAllowed: false`
- `historyCompactMaxSummaryChars: 2000`
- `historyCompactSummarizerModelLocal: ""` (empty = auto-pick)

**Tests**

- Unit: `tests/unit/history-compaction.test.js` —
  - 50-message synthetic history, `keepRecent=10` → split at index 40.
  - **Tool-result pair at boundary (persisted shape — must match actual stored history)**: build messages where `messages[40]` is `{role:"user", content:"[Tool: builtin.run_terminal_cmd]\n<results>"}` preceded by `messages[39]` `{role:"assistant", content:"<cleanedResponse — no TOOL_CALL token>"}` — assert split moves backward by 2 to land at index 38 (a genuine user turn or system message). The assistant content does **not** contain `TOOL_CALL:`; the detector keys off the user `[Tool: ` prefix.
  - **Tool-result pair at boundary (live-loop shape)**: build with `messages[40].content = "Tool results:\n<output>"` — assert same backward step.
  - **Floor clamp**: build a 3-message history `[assistant, user-tool-result, user-tool-result]` with `keepRecent=1`, `splitIdx=2`. After two `--` decrements `splitIdx` would reach `-1`; assert it is clamped to `0` and the loop terminates without negative slicing.
  - **Genuine user message at boundary** (`messages[40].content = "Hi, can you help with X?"` — no `[Tool: ` prefix) → split stays at 40.
  - Cache key reproducible across two calls with identical prefix; differs when prefix differs.
- Integration: `tests/integration/history-compaction.test.js` —
  - `/api/chat` with oversized history + flag on; assert `compaction_summary` appears in saved conversation; assert second send reuses cached summary.

**Risk:** high — modifies the prompt sent to the model. Default off; needs internal dogfood before flip.

---

## Cross-cutting

### New config keys (summary)

| Key                                  | Default  | Phase |
| ------------------------------------ | -------- | ----- |
| `enablePreflightBanner`              | `false`  | 1     |
| `cumulativeToolOutputMaxChars`       | `100000` | 3     |
| `externalizeToolOutput`              | `false`  | 3     |
| `enableHistoryCompaction`            | `false`  | 2     |
| `historyCompactKeepRecent`           | `10`     | 2     |
| `historyCompactCloudAllowed`         | `false`  | 2     |
| `historyCompactMaxSummaryChars`      | `2000`   | 2     |
| `historyCompactSummarizerModelLocal` | `""`     | 2     |

All documented in [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) and [docs/CC-CONFIG.md](docs/CC-CONFIG.md).

### New SSE notice kinds

All values are **snake_case** (consistent with `context_overflow`, `cloud_model_demoted`, etc.).

| `kind`                | Source                        | Phase |
| --------------------- | ----------------------------- | ----- |
| `compaction_summary`  | server, after compactor       | 2     |
| `compaction_fallback` | server, on summarizer failure | 2     |
| `compaction_skipped`  | server, no local summarizer   | 2     |

Existing `context_overflow` ([lib/chat-post-handler.js:629](lib/chat-post-handler.js#L629)) is unchanged. New `cloud_model_demoted` ([lib/chat-post-handler.js](lib/chat-post-handler.js), shipped 2026-05-08) emits when auto-mode demotes a cloud model after an opaque 500.

### Post-compaction invariant (Phase 2)

After Phase 2 step 3(c) replaces `fullMessages` with the compacted array, **any subsequent code in the chat handler that counts or injects from messages MUST read the post-compaction array**. Specifically: experiment bookkeeping and the `totalChars` reduce at [:782](lib/chat-post-handler.js#L782) all consume `fullMessages`, so re-using the same variable is sufficient — but no parallel `messages.length` or pre-compaction snapshots may be retained.

**Memory retrieval timing (open question, decide during Phase 2 implementation):** `buildMemoryContext` is invoked at [:579-586](lib/chat-post-handler.js#L579-L586) (the call) with `.catch` at [:587](lib/chat-post-handler.js#L587) — this is **before** `fullMessages` is built (at [:761-779](lib/chat-post-handler.js#L761-L779)) and well before compaction would run. Therefore memory retrieval today operates on the raw incoming `messages`, not on `fullMessages`, and is **unaffected by compaction** in the simple wiring. The Phase 2 implementer must explicitly choose: (a) leave memory retrieval pre-compaction (current behavior, cheaper — retrieval uses the client's full pre-compaction history; the trade-off is that the memories injected may not match what the model sees after compaction summarizes earlier turns); or (b) re-fire `buildMemoryContext` with post-compaction `fullMessages` (more accurate, doubles the embedding cost on compaction-trigger turns only). Default: **(a)** — keeps cost stable and matches current behavior for non-compacted turns. Document the choice in the PR.

**Implementer:** insert compaction **after** the existing `totalChars` / `estimatedTokens` block at [:782-786](lib/chat-post-handler.js#L782-L786) (the first measurement is the trigger) and **before** the auto-bump / `num_ctx` block at [:793+](lib/chat-post-handler.js#L793).

**`const → let` refactor required:** today both `totalChars` ([:782](lib/chat-post-handler.js#L782)) and `estimatedTokens` ([:786](lib/chat-post-handler.js#L786)) are declared `const`. Phase 2 needs to recompute them in place after compaction, so change both declarations to `let` as part of the same edit. Without this, the recompute step fails with "Assignment to constant variable".

After replacing `fullMessages` and recomputing, **auto-bump and the existing `totalChars` reduce read post-compaction values** (because they consume the same `fullMessages` / `let` bindings). **Memory retrieval is the explicit exception** — `buildMemoryContext` was already invoked at [:579-587](lib/chat-post-handler.js#L579-L587), well before `fullMessages` exists, and its retrieval is governed by the memory-timing decision documented above (default option (a): pre-compaction). Do NOT silently re-fire memory unless option (b) is explicitly chosen and recorded in the PR.

`ctxTarget` is computed inside the compaction step from `effectiveNumCtx` / `getContextLengthForModel` / `config.numCtx`; this runs **before** the auto-bump touches `effectiveNumCtx`, so `ctxTarget` reflects the user-set / model-advertised value, not the auto-boosted value. Documented behavior — the auto-bump is intended as a fallback when compaction declines, not a precondition.

Grep the handler for `fullMessages` after editing; any reassignment or closure over the pre-compaction array is a bug.

### Migration / backward compat

- New `conversation.compactionSummaries[]` field is optional; old conversations remain valid.
- No data migration script needed.
- [tests/integration/parallel-tools.test.js](tests/integration/parallel-tools.test.js) and similar — verify they don't trip the cumulative cap by accident. Default `externalizeToolOutput: false` keeps them green.

### Rollout order

1. **v1.7.0** — Phase 4, Phase 5 (no flags). Phases 1, 2, 3 land flag-gated default off.
2. **v1.7.0 → v1.7.1 dogfood window** — internal users opt in via config.
3. **v1.7.1** — flip `enablePreflightBanner` and `externalizeToolOutput` to `true`. Leave `enableHistoryCompaction: false` until further validation.
4. **v1.7.2+** — flip `enableHistoryCompaction` after one full release cycle of dogfood.

### Rollback procedure

If any flagged feature regresses in production:

1. Set the offending flag(s) back to `false` in `.cc-config.json` (or env override) — no restart-on-fail behavior, the flag is read each request.
2. Optionally clean up artifacts:
   - Phase 3: `rm -rf <projectFolder>/.codecompanion/tool-results/` (safe — files are git-ignored and not referenced from anywhere else after the flag flips off).
   - Phase 2: existing `conversation.compactionSummaries[]` entries become inert when `enableHistoryCompaction: false`; no cleanup required, but they can be stripped from `*.json` conversation files if disk-space matters.
3. Phase 1: no artifacts — the banner simply stops rendering.

### Verification

- `npm run test:unit` — node:test unit suite (extended [tests/unit/ollama-error-envelope.test.js](tests/unit/ollama-error-envelope.test.js); new `tests/unit/context-budget.test.js`, `tests/unit/history-compaction.test.js`).
- `npm run test:integration` — includes new `tests/integration/model-context-api.test.js` and `tests/integration/history-compaction.test.js`; assert externalization round-trip via `codecompanion_read_file`.
- `npm test` — Playwright UI suite (includes new `tests/ui/preflight-banner.spec.js`).
- `node scripts/smoke-test-server.js` — server boots in both flag states (default-off AND with all flags flipped on via env vars).
- Manual: paste 500K chars → flagged build shows banner → submit → confirm compaction in server log → confirm tool externalization with a `run_terminal_cmd` producing 200KB → confirm `codecompanion_read_file` reads the externalized file back.

---

## Resolved review questions

| Question (iter 1)                    | Resolution                                                                                                                                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compaction in handler vs middleware? | **In-handler.** Middleware can't easily emit SSE notices for compaction status.                                                                                                                                                   |
| Tool externalization location?       | **`<projectFolder>/.codecompanion/tool-results/`.** OS temp rejected because MCP **`codecompanion_read_file`** uses **`readProjectFile(projectFolder, …)`** — paths outside `projectFolder` are not readable back into the agent. |
| Banner UX — above-input vs toast?    | **Above-input.** More discoverable; persistent until the condition clears.                                                                                                                                                        |
| Auto-mode banner behavior?           | **Implemented** via `?auto=1&estimatedTokens=N` parameter — server runs the resolver to get an effective context.                                                                                                                 |
| Cloud effective-context source?      | **Existing `guessCloudContext`** at [lib/ollama-client.js:234](lib/ollama-client.js#L234) — already populated for major cloud providers.                                                                                          |
| Apply to `lib/review.js` too?        | **No.** Out of scope for v1; documented above.                                                                                                                                                                                    |

---

## Known limitations

- Char-based token estimate still wrong for code/non-English/images. Replacing it is its own initiative.
- `isCloudModelName` substring match misclassifies custom OpenAI-compatible endpoints. Documented in [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md); not fixed here.
- Compaction-fallback to truncation is lossy. Acceptable for v1; revisit if telemetry (out of scope) shows frequent fallback.
