# Project Research Summary

**Project:** Code Companion — Review Mode for Vibe Coders
**Domain:** AI-powered code review with structured grading for non-technical users
**Researched:** 2026-03-13
**Confidence:** MEDIUM-HIGH

## Executive Summary

Code Companion is adding a Review Mode targeted at vibe coders — people who generate code with AI tools like Cursor and ChatGPT but have no ability to manually read or fix it. The core challenge is bridging two fundamentally different interaction models: structured, machine-parseable grading data (the report card) and freeform conversational explanation (the deep dive). Research confirms that Ollama's `format` parameter with a full JSON Schema object — not just `format: "json"` — enables constrained decoding at the model level, guaranteeing the LLM outputs a valid, schema-conformant report card every time. This is the architectural cornerstone of the feature and was verified against official Ollama API documentation on GitHub.

The recommended approach is a two-phase flow: a non-streaming POST call to generate the complete report card as structured JSON, followed by a standard SSE streaming conversation for deep-dive follow-ups. This separation is not optional — streaming partial JSON is unparseable and creates a broken UX. The existing codebase has 90% of the required infrastructure already in place: the Ollama client, SSE streaming, file attachment, conversation history, and mode-switching. Only one new dependency (`zod-to-json-schema`) and three new backend modules are required.

The primary risks are not technical but experiential. Vibe coders abandon tools that produce anxiety without action. Grades without copy-pasteable fix prompts, inconsistent tone across modes, small-model failures without graceful warnings, and context window overflows for large files will all drive users away before the feature proves its value. Every grade must include a concrete action. All system prompts must be rewritten in a single batch to establish a unified friendly-teacher persona. Model capability warnings must ship with the report card — not as a v2 polish item.

## Key Findings

### Recommended Stack

The existing stack requires only one addition. Ollama's `/api/chat` endpoint supports `format` as either `"json"` (generic valid JSON) or a full JSON Schema object (constrained decoding to an exact structure). The latter is required for the report card — it constrains every field to the expected type and enum values, eliminating freeform drift. Zod is already installed (^4.3.6) and serves as a server-side validation safety net after parsing. `zod-to-json-schema` bridges the Zod schema definition to Ollama's `format` parameter, creating a single source of truth for both LLM constraint and server validation. Optional polish-phase libraries (recharts, framer-motion) are explicitly deferred from MVP — letter grades with Tailwind color classes ship faster and are sufficient.

**Core technologies:**
- Ollama `format` with JSON Schema: structured report card generation — native constrained decoding, zero post-hoc parsing fragility. Verified from official Ollama API docs.
- Zod ^4.3.6 (already installed): server-side validation safety net — catches edge cases where even constrained output drifts.
- zod-to-json-schema ~^3.24: schema bridge — single Zod definition drives both LLM constraint and server validation. Zod v4 compat needs install-time verification.
- `options: { temperature: 0.3 }` on review calls: deterministic analysis — lower temperature produces consistent grading rather than creative variation.

### Expected Features

The target user cannot read code, cannot interpret "race condition" or "line 47," and will not fix anything manually — they copy-paste prompts to Cursor. The product's niche is the safety net between AI code generation and deployment. Features must be designed for that workflow end-to-end.

**Must have (table stakes):**
- Visual report card with letter grades (A-F) — core value prop, at-a-glance quality signal for non-technical users
- Category breakdown (Bugs, Security, Readability, Completeness, Performance) — users need dimensional context
- Overall grade — single answer to "is this code okay?"
- Plain-English findings with zero jargon — "race condition" means nothing to this audience
- One-click deep dive on any category — grades without explanation create anxiety, not confidence
- Loading state during review — structured output takes 3-8 seconds, users must see something is happening
- Paste-and-review zero-friction flow — vibe coders copy from AI tools and paste
- "Top Priority" single callout — reduces overwhelm to one actionable item
- Friendly-teacher tone across ALL modes — tone consistency shapes entire product perception

**Should have (competitive):**
- "What to ask your AI to fix" copy-pasteable prompts — uniquely matches the vibe coder workflow; key differentiator
- Color-coded grade visualization (A=green, F=red) — instant visual feedback with zero implementation cost (Tailwind classes)
- Model capability tiers with gentle warnings — prevents first-impression failure on small models
- "Clean bill of health" state — explicit positive confirmation that analysis ran when code is fine
- Privacy-first messaging — trust signal against cloud alternatives; zero implementation cost

**Defer (v2+):**
- Multi-file project review — requires chunking, aggregation, context window management
- Before/after comparison — needs review storage, diffing, trend visualization
- Beginner onboarding wizard — add after core review is validated
- Contextual jargon glossary — add incrementally based on user confusion signals
- Export review as PDF/Markdown — extend existing export infrastructure post-MVP

### Architecture Approach

The architecture follows a structured-then-conversational two-call pattern. Call 1: `POST /api/review-report` (new endpoint, non-streaming) calls a new `chatCompleteStructured()` function with the JSON Schema in the `format` parameter and returns parsed JSON. Call 2: `POST /api/chat` (existing SSE endpoint, unchanged) receives the report card serialized as prior assistant context and streams conversational explanation. These two paths must never be merged — they have incompatible requirements. The frontend follows the existing mode-switching pattern: `ReviewPanel` replaces the chat area the same way `CreateWizard` and `DashboardPanel` already do.

**Major components:**
1. `chatCompleteStructured()` in `ollama-client.js` — new function adding `format` param support; extension of the existing non-streaming `chatComplete` call
2. `lib/review-schemas.js` — Zod schema defining report card shape plus JSON Schema export via `zod-to-json-schema`
3. `lib/review-service.js` — orchestrates prompt building, structured Ollama call, Zod validation, three-tier fallback (schema -> prompt-only -> default report)
4. `POST /api/review-report` in `server.js` — new non-streaming route accepting `{ model, code, filename }`, returning `{ reportCard: {...} }`
5. `ReviewPanel.jsx` — state machine managing four states: code input, loading, report card display, deep-dive chat
6. `ReportCard.jsx` / `GradeCard.jsx` — pure presentation components, independently testable with mock data
7. System prompts rewrite — all 7 entries in `lib/prompts.js` `SYSTEM_PROMPTS` updated with unified friendly-teacher vibe-coder persona

### Critical Pitfalls

1. **Using `format: "json"` instead of `format: { schema }`** — Generic JSON mode does not constrain structure. The model outputs arbitrary JSON shapes that crash `reportCard.categories[0].grade`. Use the full JSON Schema object with Ollama's constrained decoding. Validate with Zod as safety net.

2. **Streaming the report card response** — Partial JSON is not parseable. Attempting to stream structured output either blocks rendering or breaks constantly. The report card endpoint must be non-streaming. Only the deep-dive follow-up uses SSE streaming.

3. **Partial system prompt rewrite** — If only Review mode gets a friendly-teacher persona while existing modes keep "senior code reviewer" language, users experience jarring tone shifts. Rewrite all 7 prompts in a single batch before any user-facing testing.

4. **Grades without actionable next steps** — For vibe coders, a grade without a copy-pasteable fix prompt produces helplessness, not confidence. Every category must include a concrete finding, an action, and a "what to tell your AI" prompt. The `topPriority` field in the schema must be prominent.

5. **Small models failing silently** — Models under 7B often cannot produce coherent structured output even with schema constraints. Add model capability tiers using `details.parameter_size` from the Ollama API. Show a gentle pre-review warning, not a post-failure error.

## Implications for Roadmap

Based on combined research, the build order is architecturally constrained bottom-up: backend foundation before service layer, service layer before UI, UI before full integration. The system prompt rewrite is independent and can run as a parallel track or standalone phase.

### Phase 1: Backend Foundation

**Rationale:** The structured output mechanism is the technical cornerstone of the entire feature. Nothing else can be built or tested until `chatCompleteStructured()` with JSON Schema works end-to-end. All components in this phase can be validated via curl before any frontend work begins.
**Delivers:** `chatCompleteStructured()` in `ollama-client.js`, `lib/review-schemas.js` with Zod schema + JSON Schema export, `review` system prompt with grading rubric (A-F definitions) and temperature set to 0.3.
**Addresses:** Structured grading output, Zod validation safety net, calibrated grading rubric.
**Avoids:** Pitfall 1 (wrong `format` mode), Pitfall 6 (inconsistent grading without rubric), Pitfall 12 (wrong temperature).

### Phase 2: Review API Service

**Rationale:** The non-streaming `/api/review-report` endpoint must be confirmed working end-to-end before any UI is built against it. Token counting and context warnings belong here, not in Phase 4, because they are backend concerns.
**Delivers:** `lib/review-service.js` with three-tier fallback, `POST /api/review-report` route, token estimate check with context window warning for large files, install and verification of `zod-to-json-schema`.
**Uses:** `chatCompleteStructured()` from Phase 1.
**Implements:** Non-streaming review endpoint (ARCHITECTURE.md Layer 2).
**Avoids:** Pitfall 2 (streaming report card), Pitfall 7 (context window overflow silently truncating input).

### Phase 3: System Prompt Unification

**Rationale:** High-impact, low-effort, and must happen before user-facing testing. Tone inconsistency discovered mid-testing is expensive to fix because it requires re-testing all modes. Doing it upfront in a single session costs less than fixing it later.
**Delivers:** Unified friendly-teacher vibe-coder persona across all 7 `SYSTEM_PROMPTS` in `lib/prompts.js`. Updated mode labels and descriptions in the frontend `MODES` array. Shared persona preamble all prompts inherit.
**Addresses:** Friendly-teacher tone (FEATURES.md highest-value/lowest-effort P1 item), audience-appropriate language across all modes.
**Avoids:** Pitfall 3 (inconsistent tone across modes).

### Phase 4: Report Card UI

**Rationale:** `GradeCard` and `ReportCard` are pure presentation components that can be built with mock data while Phase 2 is being finalized. `ReviewPanel` requires the endpoint to exist for wiring, but visual development can proceed in parallel.
**Delivers:** `GradeCard.jsx` (single grade tile with color coding and click handler), `ReportCard.jsx` (full report with overall grade, top priority callout, category grid, clean-bill-of-health state), `ReviewPanel.jsx` (state machine: input -> loading -> report card -> deep dive).
**Addresses:** Visual report card, color-coded grades, "Top Priority" callout, loading state with friendly messaging, grades with actionable next steps, "clean bill of health" state.
**Avoids:** Pitfall 4 (grades without actions), Pitfall 8 (rendering review as chat bubbles), Pitfall 9 (no positive state for clean code).

### Phase 5: Integration and Model Guidance

**Rationale:** Wire all layers together, connect the deep-dive flow to the existing SSE infrastructure, and validate the full end-to-end path across multiple model sizes before shipping.
**Delivers:** `review` mode wired into `App.jsx` mode switching, deep-dive conversation connected to `/api/chat` with report card context injection (`buildDeepDiveMessages()`), model capability tiers (basic/recommended/best) based on `details.parameter_size` from Ollama `/api/tags`, gentle small-model warning in the review UI.
**Implements:** Context injection pattern (ARCHITECTURE.md Pattern 2), mode-based component switching (Pattern 4).
**Avoids:** Pitfall 5 (small models producing garbage reviews without warning).

### Phase 6: History and "Ask Your AI" Prompts

**Rationale:** Two additive features that make reviews reusable and actionable. History storage must carry structured JSON or the report card cannot re-render on reload. "Ask your AI" prompts are the key differentiator for the vibe coder workflow.
**Delivers:** Review history saving `reportCard` JSON alongside conversation messages, `type: "review"` field on history entries, history renderer that detects entry type and uses appropriate renderer, "What to ask your AI to fix" copy-pasteable prompts generated per finding.
**Addresses:** "Ask your AI to fix" prompts (FEATURES.md key differentiator), conversation history for reviews (FEATURES.md table stakes).
**Avoids:** Pitfall 10 (losing structured review data in history).

### Phase Ordering Rationale

- Backend before frontend is mandated by the structured output mechanism — there is no mock substitute for validating schema-constrained Ollama calls on real models.
- System prompt rewrite is placed early because tone changes affect all modes and inconsistency discovered in user testing cannot be patched without re-testing everything.
- Pure presentation components (GradeCard, ReportCard) can be developed with mock data during Phase 2, but the full `ReviewPanel` state machine requires the endpoint.
- History and "ask your AI" prompts are last because the core feature is fully functional without them — unlike all prior phases.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Integration / Model Guidance):** Model capability detection via `details.parameter_size` from Ollama `/api/tags` needs verification against the version deployed at `http://HOST_IP:11424`. Structured output behavior on models under 7B is LOW confidence — requires hands-on testing with models users actually run (llama3.2:3b, phi3, gemma2).
- **Phase 6 (History):** Current `saveConversation` format needs inspection to confirm the correct extension pattern for structured review data. Read the existing history schema before designing the new `type` field.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Backend Foundation):** Ollama `format` with JSON Schema is verified from official docs. Implementation pattern is fully specified in STACK.md and ARCHITECTURE.md. Proceed directly to build.
- **Phase 3 (System Prompts):** Pure prompt engineering. No technical unknowns. One focused session.
- **Phase 4 (Report Card UI):** Pure React component work following established codebase patterns. GradeCard and ReportCard are presentation-only with no novel architecture.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Ollama `format` with JSON Schema verified from official API docs on GitHub. Existing deps confirmed from `package.json`. Only gap: `zod-to-json-schema` Zod v4 compat needs install-time check. |
| Features | MEDIUM | Feature list derived from codebase analysis and domain expertise. Competitor analysis (ChatGPT, SonarQube positioning) is training data only — not independently verified. Core feature set is unambiguous. |
| Architecture | HIGH | Two-call pattern is well-supported by existing codebase. Non-streaming Ollama calls already present in `server.js` (git review route, lines 704-745). Build order is unambiguous. Component boundaries are clear. |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls derived from direct codebase inspection and verified Ollama API behavior. Small-model structured output under 7B is LOW confidence — needs empirical testing. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **zod-to-json-schema + Zod v4 compatibility:** Project uses Zod ^4.3.6. Verify at `npm install zod-to-json-schema` time. If incompatible: hand-write the JSON Schema directly (it is a single static object — not an ongoing maintenance burden).
- **Small model structured output quality:** Must be tested empirically with models users actually run on local hardware. No desk research substitutes for hands-on testing. Establish pass/fail criteria before shipping model capability tiers.
- **Ollama version on deployment host:** Structured output with full JSON Schema requires Ollama 0.5.0+. Verify the version at `http://HOST_IP:11424` before relying on the `format: { schema }` path.
- **recharts + React 19 compatibility:** MEDIUM confidence from training data. Deferred from MVP entirely to eliminate the risk.

## Sources

### Primary (HIGH confidence)
- Ollama API documentation — `github.com/ollama/ollama/blob/main/docs/api.md` — `format` parameter accepts full JSON Schema on both `/api/generate` and `/api/chat`. Constrained decoding confirmed in official structured output examples.
- Existing codebase — `server.js`, `lib/ollama-client.js`, `lib/prompts.js`, `src/App.jsx`, `src/components/GitHubPanel.jsx` — direct inspection confirming existing patterns, dependency versions, and mode-switching architecture.

### Secondary (MEDIUM confidence)
- zod-to-json-schema ^3.24 — Zod v4 compatibility from training data. Verify at install time.
- Domain expertise — vibe coder UX patterns, local LLM structured output reliability, non-technical user mental models. Multiple consistent signals across training data.
- recharts ^2.15 + React 19 compatibility — training data only. Deferred from MVP.

### Tertiary (LOW confidence)
- Competitor analysis (ChatGPT, SonarQube, CodeRabbit positioning) — training data only. Verify specific claims before using in marketing copy.
- Small model (<7B) behavior with Ollama constrained decoding — LOW confidence. Requires empirical testing on target hardware before finalizing fallback strategy.

---
*Research completed: 2026-03-13*
*Ready for roadmap: yes*
