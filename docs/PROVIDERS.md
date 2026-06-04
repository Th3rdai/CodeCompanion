# LLM Providers — Ollama & OpenRouter

Code Companion talks to exactly **one** LLM provider at a time. Ollama is the
default; OpenRouter is an optional toggle. This document is the developer's map
of how that toggle works — what changes, what deliberately doesn't, and where to
look when adding a third provider or debugging a routing issue.

> **TL;DR** — A single function, `ollamaAuthOpts(config)`, is the universal seam.
> Every AI call passes its return value down. For Ollama it returns the legacy
> `{ apiKey }` shape; for OpenRouter it returns a **sentinel bag** that the core
> client functions detect and re-dispatch to `lib/openrouter-client.js`. The
> default (Ollama-only) code path is byte-for-byte unchanged.

---

## 1. The mental model

```
                        config.provider
                       ┌──────┴───────┐
                   "ollama"      "openrouter"
                       │               │
           ollamaAuthOpts(config) returns…
                       │               │
              { apiKey: "…" }   { __ccProvider: "openrouter",
                       │           __ccOpenrouterApiKey, __ccOpenrouterUrl }
                       │               │
   chatStream / chatComplete / chatStructured / listModels / checkConnection
                       │               │
        (original Ollama code)   wantsOpenrouter(opts) === true
                       │               │
                  Ollama REST    → orClient().<same fn>()  →  OpenRouter API
                                        (OpenAI-compatible)
```

There is **no** parallel "OpenRouter mode" wired through the 19 app modes.
Feature parity is automatic precisely because everything funnels through the one
seam. Add a mode and it works for both providers for free.

---

## 2. Config keys

Defined in [`lib/config.js`](../lib/config.js) (defaults shown):

| Key                | Default                          | Notes                                                                  |
| ------------------ | -------------------------------- | ---------------------------------------------------------------------- |
| `provider`         | `"ollama"`                       | Toggle, **not** additive. Only the literal `"openrouter"` routes away. |
| `openrouterApiKey` | `""`                             | Secret. Prefer the `OPENROUTER_API_KEY` env var (see below).           |
| `openrouterUrl`    | `"https://openrouter.ai/api/v1"` | Base URL. Validated + trailing-slash-stripped in `routes/config.js`.   |
| `ollamaUrl`        | `"http://localhost:11434"`       | Unchanged.                                                             |
| `ollamaApiKey`     | `""`                             | Unchanged (Ollama Cloud Bearer key).                                   |

**Fail-safe defaulting** — `effectiveProvider(config)` in
[`lib/ollama-client.js`](../lib/ollama-client.js) returns `"openrouter"` _only_
for the exact string `"openrouter"`; anything else (missing key, typo, legacy
config) resolves to `"ollama"`. A malformed config can never accidentally route
to OpenRouter.

**Secret precedence** — `effectiveOpenrouterApiKey(config)`:
`process.env.OPENROUTER_API_KEY` **wins** over `config.openrouterApiKey`, so the
key can stay out of `.cc-config.json`. The API never returns the raw key —
`routes/config.js` masks it and exposes a boolean `openrouterApiKeyConfigured`
instead. See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md).

---

## 3. The dispatch seam

All in [`lib/ollama-client.js`](../lib/ollama-client.js):

```js
// The one seam (~55 call sites across server.js, lib/review.js, lib/pentest.js,
// lib/chat-post-handler.js, lib/auto-model.js, …).
function ollamaAuthOpts(cfg) {
  if (effectiveProvider(cfg) === "openrouter") {
    return {
      __ccProvider: "openrouter",
      __ccOpenrouterApiKey: effectiveOpenrouterApiKey(cfg),
      __ccOpenrouterUrl:
        (cfg && cfg.openrouterUrl) || "https://openrouter.ai/api/v1",
    };
  }
  const k = effectiveOllamaApiKey(cfg);
  return k ? { apiKey: k } : {};
}

const wantsOpenrouter = (opts) =>
  !!(opts && opts.__ccProvider === "openrouter");

// Lazy require: the Ollama-only path never pays the cost, and the two modules
// can reference each other without a load-time cycle.
let _orClient = null;
const orClient = () => (_orClient ||= require("./openrouter-client"));
```

Each core function re-dispatches as its **first statement** when it sees the bag:

| Function          | Guard                                                                       |
| ----------------- | --------------------------------------------------------------------------- |
| `chatStream`      | `if (wantsOpenrouter(ollamaOptions)) return orClient().chatStream(...)`     |
| `chatComplete`    | `if (wantsOpenrouter(ollamaOptions)) return orClient().chatComplete(...)`   |
| `chatStructured`  | `if (wantsOpenrouter(ollamaOptions)) return orClient().chatStructured(...)` |
| `listModels`      | `if (wantsOpenrouter(opts)) return orClient().listModels(opts)`             |
| `checkConnection` | `if (wantsOpenrouter(opts)) return orClient().checkConnection(opts)`        |

`invalidateListModelsCache()` cascades to the OpenRouter client's cache too.

### Why a sentinel bag instead of passing `config` everywhere?

The opts object already threads through all ~55 call sites (it used to carry just
`{ apiKey }`). Reusing it means **zero signature changes** to the call chain —
the provider decision rides along on data that was already in flight. Callers
that forward opts manually (e.g. `lib/review.js`, `lib/pentest.js`) just forward
the three `__cc*` fields beside the existing `apiKey` line.

---

## 4. The OpenRouter client

[`lib/openrouter-client.js`](../lib/openrouter-client.js) is an
OpenAI-compatible client that **presents the same interface as the Ollama
client** so the dispatch guards are drop-in.

- **SSE → NDJSON adapter** (`makeSseToNdjsonStream`): OpenRouter streams OpenAI
  Server-Sent Events (`data: {choices:[{delta:{content}}]}`); the rest of the
  app expects Ollama-shaped NDJSON (`{"message":{"content":"…"},"done":false}`).
  A `TransformStream` converts on the fly — skips `:` keep-alives, buffers
  partial lines, drops `delta.reasoning`, and emits one terminal
  `{…,"done":true}` chunk on `[DONE]`/flush. This is why streaming, Stop/abort,
  and the SSE plumbing in `server.js` need no provider-specific code.
- **Minimal request bodies**: only `model`, `messages`, `stream`, and optionally
  `temperature` / `response_format` are sent. **Never** `num_ctx`, `max_tokens`,
  `tools`, `tool_choice`, or `functions` (see guardrail §6).
- **Catalog** (`listModels`): fetches OpenRouter's full live model list and maps
  each entry to the Ollama-ish shape the UI consumes
  (`{ name, family, size:0, paramSize, supportsVision, contextLength }`), sorted
  largest-context-first, cached ~45s. Throws on non-200.
- **Errors** (`formatUserOpenrouterChatError`): maps 401 / 402 / 429 / 404 /
  context-length / network / generic to friendly copy, preserving the
  `OpenRouter error: NNN — detail` prefix so `server.js` can parse the status it
  never otherwise sees.

---

## 5. Auto-model resolution

[`lib/auto-model.js`](../lib/auto-model.js) resolves `model: "auto"` per mode and
is **provider-aware**:

- `DEFAULT_AUTO_MODEL_MAP` (Ollama) and `DEFAULT_AUTO_MODEL_MAP_OPENROUTER`
  (Claude Sonnet for reasoning/agentic modes, GPT-4o-mini for lighter ones).
- `FALLBACK_BASE = { ollama: "qwen3-32k", openrouter: "anthropic/claude-sonnet-4.5" }`
  — the OpenRouter fallback is verified present in the live catalog
  (`claude-3.5-sonnet` was retired; relying on it made Auto silently fall to the
  largest-context model).
- `mergeAutoModelMap(saved, provider = "ollama")` — back-compatible second
  param; single-arg callers keep the Ollama base.
- `isOpenrouterToolCapable(id)` — prefix allowlist
  (`anthropic/`, `openai/`, `google/gemini`, `mistralai/`, `qwen/`, plus
  `meta-llama/` ≥ 8B) for models that reliably follow the inline `TOOL_CALL:`
  protocol. Needed because an OpenRouter id matches none of the Ollama
  `TOOL_CALL_CAPABLE` tiers.
- `resolveAutoModel` derives the provider from
  `ollamaOpts.__ccProvider || effectiveProvider(config)`, with early OpenRouter
  forks for `preferVision` (largest-context vision model — OR vision models
  genuinely ingest images, unlike the Ollama cloud proxy) and
  `preferToolCapable`.
- `getContextLengthForModel(name, ollamaUrl, apiKeyOrOpts)` reads the OpenRouter
  catalog when the opts bag carries `__ccProvider === "openrouter"`.

---

## 6. Guardrails (do not break)

1. **One provider at a time.** `provider` is a toggle, never additive. Don't add
   logic that mixes Ollama + OpenRouter calls in one request.
2. **Default path stays unchanged.** With no OpenRouter config, behavior must be
   identical to before this feature. `effectiveProvider` defaulting and the lazy
   `orClient()` require enforce this — keep it that way.
3. **Inline `TOOL_CALL:` text protocol only — never native function-calling.**
   Do not send `tools` / `tool_choice` / `functions` to OpenRouter. The app's
   agent loop parses an inline `TOOL_CALL:` convention from the text stream
   (`lib/chat-post-handler.js`, `lib/tool-call-handler.js`); native OpenAI
   tool-calling would bypass it and break every agentic mode.
4. **Memory/embeddings stay Ollama-bound by design.** `embed` never dispatches
   to OpenRouter — embedding memory always uses the local Ollama daemon
   regardless of `provider` (`lib/memory.js`). If you add OpenRouter embeddings,
   it must be a separate, explicit decision, not a silent dispatch.
5. **Never log or return the API key.** `routes/config.js` masks it; only the
   `openrouterApiKeyConfigured` boolean leaves the server.

---

## 7. Frontend

- **Settings** ([`src/components/SettingsPanel.jsx`](../src/components/SettingsPanel.jsx)):
  a radiogroup toggle (Ollama | OpenRouter) shows the matching connection block;
  Test button posts the active provider + its fields.
- **Model picker** ([`src/App.jsx`](../src/App.jsx) +
  [`src/hooks/useModels.js`](../src/hooks/useModels.js)): `/api/models` returns
  `provider`; a searchable filter input renders for OpenRouter's large catalog.
  When the persisted model isn't in the new provider's catalog, selection resets
  to `auto`. The vision toast branches on the active provider.

---

## 8. Adding a third provider — checklist

1. Add config keys + defaults in `lib/config.js`; validate/mask in `routes/config.js`.
2. Add `effectiveProvider` handling and a sentinel bag branch in `ollamaAuthOpts`.
3. Write `lib/<provider>-client.js` exposing the same interface
   (`chatStream`/`chatComplete`/`chatStructured`/`listModels`/`checkConnection`),
   adapting its stream to Ollama-shaped NDJSON.
4. Add a `wantsX` guard + lazy require + dispatch line to each of the five core
   functions in `lib/ollama-client.js`.
5. Add a default auto-model map + tool-capable allowlist + `resolveAutoModel`
   fork in `lib/auto-model.js`.
6. Add the Settings toggle option + model-picker handling.
7. Respect all guardrails in §6 (especially #2 and #3).

---

## 8. User-facing privacy copy

When OpenRouter is available, UI copy must **not** claim “100% private” or “nothing sent to the cloud” globally. Surfaces:

- **`PrivacyBanner.jsx`** — bottom strip; dismissable
- **`OnboardingWizard.jsx`** — welcome, Ollama connect, and privacy steps

Canonical wording and test commands: **`docs/PRIVACY-MESSAGING.md`**.

---

## See also

- [PRIVACY-MESSAGING.md](./PRIVACY-MESSAGING.md) — banner + onboarding disclosure for Ollama vs OpenRouter
- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) — `OPENROUTER_API_KEY` and config keys
- [CC-CONFIG.md](./CC-CONFIG.md) — config file precedence (data dir vs repo)
- [CLOUDAPI.md](./CLOUDAPI.md) — Ollama Cloud (`:cloud`) proxy details
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — connection / "Failed to fetch" issues
