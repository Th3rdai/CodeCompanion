# Domain Pitfalls

**Domain:** AI-powered code review for non-technical users (vibe coders) using local LLMs
**Researched:** 2026-03-13
**Overall confidence:** HIGH (codebase analysis + verified Ollama API capabilities + domain expertise)

---

## Critical Pitfalls

Mistakes that cause rewrites, broken user trust, or fundamental feature failure.

---

### Pitfall 1: Using `format: "json"` Instead of `format: {schema}`

**What goes wrong:** You use Ollama's generic `format: "json"` mode, which only guarantees valid JSON -- not the right structure. The model outputs `{"review": "code looks fine"}` instead of the report card shape with grades, categories, and findings. Your frontend expects `reportCard.categories[0].grade` and crashes on undefined.

**Why it happens:** Many tutorials and older docs show `format: "json"`. The JSON Schema variant (`format: { type: "object", properties: {...} }`) is less well-known. The distinction between "valid JSON" and "JSON matching a specific schema" is subtle.

**Consequences:** Report card renders blank or crashes. User sees broken UI on first use.

**Prevention:**
1. Use Ollama's full JSON Schema support: `format: { type: "object", properties: {...}, required: [...] }`. This constrains the model via constrained decoding to match the exact schema. **Verified in Ollama official API docs.**
2. Validate with Zod as a safety net after parsing
3. Build a graceful fallback: if parsing fails, display raw response as markdown (existing chat rendering)
4. Test with 3-4 different model sizes before shipping

**Detection:** Report card shows "undefined" or missing grades. JSON.parse succeeds but object shape is wrong.

---

### Pitfall 2: Streaming the Report Card Response

**What goes wrong:** You attempt to stream the report card via SSE (reusing the existing `/api/chat` endpoint) and parse JSON progressively. Partial JSON is not parseable. You either buffer the whole response (negating streaming UX benefits) or try incremental parsing (fragile, breaks constantly).

**Why it happens:** The existing app streams everything. The instinct is to reuse the SSE pipeline. The distinction between "needs streaming for UX" (chat) and "needs complete data for rendering" (report card) is an architectural choice that must be made explicitly.

**Consequences:** Either (a) blank screen during buffering (users think it's frozen), (b) parse errors on partial JSON, or (c) unnecessary complexity in the streaming pipeline.

**Prevention:**
1. Create a separate `POST /api/review-report` endpoint that uses `chatComplete` (non-streaming) and returns parsed JSON
2. Design a loading UX: "Grading your code..." with animated phases
3. Keep streaming for the deep-dive follow-up conversation (separate concern)
4. Never try to unify structured output and streaming in one code path

**Detection:** Planning docs mention "streaming the report card" or "reusing /api/chat for review."

---

### Pitfall 3: Inconsistent Tone After Partial Prompt Rewrite

**What goes wrong:** The new Review mode uses "friendly teacher" persona, but existing modes (Explain, Bug Hunter, Refactor) keep the PM-focused "senior code reviewer" persona. Users switching modes experience jarring tone shifts. Product feels like two apps stitched together.

**Why it happens:** Rewriting existing prompts feels risky. "They already work." Teams plan to "align later" -- which never happens.

**Consequences:** Users perceive the product as inconsistent and unpolished. Trust erodes through inconsistency.

**Prevention:**
1. Rewrite ALL system prompts at once. The `SYSTEM_PROMPTS` object has 7 prompts -- this is one session's work.
2. Create a shared persona preamble all prompts inherit: tone, audience definition, jargon rules
3. Extend the existing `MODE_GUARDRAIL` pattern to include tone/persona
4. Test by having a non-technical person use all modes in sequence

**Detection:** New prompts mention "vibe coder" or "friendly teacher" while old prompts say "senior code reviewer" or "PM who leads a development team."

---

### Pitfall 4: Grades Without Actionable Next Steps

**What goes wrong:** Report card shows "Security: C" and the user thinks "...now what?" For a developer, "C" triggers a mental checklist. For a vibe coder, it triggers helplessness. Grades without actions produce anxiety, not help.

**Why it happens:** Grading feels like a complete feature to developers. "We showed the grade, done." But for vibe coders, the grade is the START of the interaction.

**Consequences:** Users see problems but cannot act on them. They either ignore the tool or blindly ask their AI to "fix security" without context.

**Prevention:**
1. Every grade MUST include: what drove the grade, a concrete action, and a copy-pasteable prompt for their AI tool
2. Design the report card as a conversation starter: "Security: C -- click to learn more and get fix suggestions"
3. Include "Copy fix prompt" buttons per finding
4. The `topPriority` field in the schema gives one clear first action

**Detection:** Report card mockups show grades without expand/action areas.

---

### Pitfall 5: Small Models Producing Garbage Reviews

**What goes wrong:** User selects a 3B model (the only one their hardware runs). The model fails to produce coherent structured output even with schema constraints. Report card has nonsensical findings. User blames the app.

**Why it happens:** Developers test with 14B+ models. Users run whatever is fast. "Fast" and "good at structured output" are inversely correlated.

**Consequences:** First impression is terrible. User never returns.

**Prevention:**
1. Add model capability tiers: tag models as "basic" (< 7B), "recommended" (7B-14B), "best" (> 14B) using `details.parameter_size` from Ollama API
2. Show gentle warning for small models: "Smaller models work great for chat, but code review works best with 7B+ parameters"
3. If review fails, suggest a larger model before showing an error
4. Use simpler schema (fewer categories) for small models as fallback

**Detection:** Testing only with one model. Model selector has no quality indicators.

---

## Moderate Pitfalls

---

### Pitfall 6: Inconsistent Severity Grading Across Models

**What goes wrong:** Different models produce wildly different grades for the same code. A 7B model flags everything as Critical. A 70B model is generous. Users who switch models (or compare with friends) see grades as arbitrary.

**Why it happens:** LLMs have no calibrated severity sense. Without rubrics and few-shot examples, each model invents its own interpretation.

**Prevention:**
1. Include a grading rubric in the system prompt: "A = no issues, B = minor style issues only, C = 1-2 functional concerns, D = multiple bugs or security issues, F = code is broken or dangerous"
2. Add 1-2 few-shot examples per grade level
3. Consider computing grades in application code based on the findings list rather than asking the LLM to assign grades directly

---

### Pitfall 7: Context Window Overflow on Large Files

**What goes wrong:** Vibe coder pastes a 500-line file. Local models have 2K-8K token context windows by default. Model truncates input silently or hallucinates reviews of code it never saw.

**Why it happens:** Cloud LLMs have 128K+ context, so developers never think about this. Local models default much smaller.

**Prevention:**
1. Estimate tokens before sending (chars / 4 for code)
2. Warn if input is large: "This file is large. I'll review the most important sections."
3. Offer chunked review for large files
4. Pass `options: { num_ctx: 8192 }` (or higher) to Ollama for review tasks

---

### Pitfall 8: Building Review as Chat Bubbles Instead of a Dedicated Panel

**What goes wrong:** You add Review as another mode rendering in the chat message stream. But a report card is not a conversation -- it needs structured UI (cards, grades, expandable sections). Chat bubbles cannot render this well.

**Why it happens:** The mode-based chat pattern is the path of least resistance. But `CreateWizard` and `DashboardPanel` already demonstrate the dedicated-panel pattern.

**Prevention:**
1. Follow the `CreateWizard` / `DashboardPanel` precedent: render `ReviewPanel` as its own component replacing the chat area
2. The routing pattern already exists: `mode === 'create' ? <CreateWizard /> : mode === 'dashboard' ? <DashboardPanel /> : ...`
3. Allow a "discuss this review" action that opens a chat conversation with review context

---

### Pitfall 9: No "Clean Bill of Health" State

**What goes wrong:** User pastes code that is fine. Report card shows all A's with no findings. User thinks the tool did not actually analyze anything.

**Prevention:**
1. Design a positive "clean review" state: "No issues found! Here's what I checked..."
2. Include positive observations in the schema: "Good error handling," "Consistent naming"
3. Show that the review ran and inspected the code, even when nothing is wrong

---

## Minor Pitfalls

---

### Pitfall 10: Losing Structured Data in History

**What goes wrong:** Reviews save as plain message text. When loading from history, the report card cannot re-render because structured grade data is lost.

**Prevention:**
1. Save report card JSON alongside conversation messages in history
2. Add a `type` field to history entries: `"chat"` vs `"review"`
3. On history load, detect type and use appropriate renderer

---

### Pitfall 11: Grading Scale Bikeshedding

**What goes wrong:** Weeks debating A-F vs 1-10 vs traffic lights vs descriptive labels.

**Prevention:** Use A-F letter grades. Universally understood. Maps cleanly to colors (A=green, F=red). Pick it, ship it, iterate. Easiest thing to change later.

---

### Pitfall 12: Ignoring Ollama `options` Parameter

**What goes wrong:** Review uses default temperature (often 0.7-0.8), producing creative/variable output when you want deterministic analysis.

**Prevention:** Set `options: { temperature: 0.3 }` for review tasks. Lower creativity = more consistent grading.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Ollama client extension | Using `format: "json"` instead of full JSON Schema | Use `format: { type: "object", ... }` with schema (Pitfall 1) |
| Review API endpoint | Streaming structured output | Separate non-streaming endpoint (Pitfall 2) |
| System prompt rewrite | Updating only new modes, not existing | Rewrite all prompts in one batch (Pitfall 3) |
| Report card UI | Grades without actions | Every grade needs finding + action + copy-paste prompt (Pitfall 4) |
| Model selection UX | Small models producing garbage | Capability tiers + gentle warnings (Pitfall 5) |
| Prompt calibration | Inconsistent grades across models | Rubric in prompt + few-shot examples (Pitfall 6) |
| Large file review | Context window overflow | Token counting + chunking (Pitfall 7) |
| Review component architecture | Chat bubble rendering | Dedicated panel like CreateWizard (Pitfall 8) |
| History storage | Losing structured review data | Save JSON alongside messages (Pitfall 10) |

## Pitfall Prevention Build Order

Address in this order. Each layer depends on the one above:

```
1. Ollama client: chatCompleteStructured with JSON Schema format -- Pitfall 1
   |
   v
2. Review endpoint: non-streaming, returns JSON -- Pitfall 2
   |
   v
3. System prompts: all modes rewritten with unified tone -- Pitfall 3
   |
   v
4. Prompt calibration: rubrics, few-shot, temperature -- Pitfalls 6, 12
   |
   v
5. Review UI: dedicated panel with actions on every grade -- Pitfalls 4, 8, 9
   |
   v
6. Model guidance: capability tiers + warnings -- Pitfall 5
   |
   v
7. History: structured review storage -- Pitfall 10
```

## Sources

- Codebase: `server.js`, `lib/ollama-client.js`, `lib/prompts.js`, `src/App.jsx` (direct inspection)
- Ollama API: `format` parameter with JSON Schema verified from official docs on GitHub. Confidence: HIGH.
- Domain expertise: structured LLM output patterns, local model capabilities, non-technical user UX. Confidence: MEDIUM-HIGH.
- Ollama `format` behavior with very small models (< 3B): LOW confidence -- needs testing on target hardware.
