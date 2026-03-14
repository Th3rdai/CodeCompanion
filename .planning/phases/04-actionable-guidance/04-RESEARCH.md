# Phase 4: Actionable Guidance - Research

**Researched:** 2026-03-14
**Domain:** Review UX enhancements (fix prompts, history persistence, model warnings)
**Confidence:** HIGH

## Summary

Phase 4 adds three capabilities to the existing review system: (1) LLM-generated "fix prompts" as natural-language instructions users paste into their AI tool, (2) full review history with report card persistence and deep-dive message saving, and (3) an enhanced model capability warning system with a hardcoded tier list and smart suggestions. All three features build directly on existing code with clear integration points.

The codebase is well-structured for these additions. The review schema (`lib/review-schema.js`) needs one new field (`fixPrompt`) per finding. The history system (`lib/history.js`) already saves arbitrary JSON with UUIDs -- review data is already being saved via `handleSaveReview` in App.jsx. The model warning system (`getModelCapabilityWarning` in ReviewPanel.jsx) needs to be upgraded from regex-based parameter detection to a tier list lookup with installed-model awareness.

**Primary recommendation:** Extend the existing schema, history, and warning systems rather than building parallel infrastructure. All three features are additive to working code.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Fix prompts are natural-language prompts (NOT code snippets) -- transform findings into "Ask your AI to fix:" instructions
- Generic tool reference ("your AI tool"), not tool-specific
- LLM-generated during review -- add `fixPrompt` field to review JSON schema
- Include file/function context when available; fall back to generic for pasted code
- Sidebar integration -- saved reviews appear in existing sidebar history list, filterable by mode
- Full report card JSON saved (grades, findings, fixPrompts, topPriority) plus original code and file name
- Auto-save on review completion with toast confirmation; user can delete from history
- Resume deep-dive conversations -- save deep-dive messages with report card
- Enhanced pre-review warning -- keep existing amber text + suggest a better model with "Continue anyway" / "Switch" buttons
- Empirical tier list -- hardcoded known strong/adequate/weak models; parameter-based fallback for unknown
- Auto-switch on click -- "Switch" button changes model selector to suggested model
- Review-mode only warnings
- Post-review hint -- if weak-tier model returns all A's with few findings, show soft banner suggesting larger model
- Best-available suggestion logic -- check installed models against tier list
- One-click copy per finding AND bulk "Copy All Fix Prompts" button at top
- Fix prompt in visually distinct block (highlighted box like blockquote) with copy button
- Action-oriented toast: "Copied! Paste this into your AI tool to fix it."
- Bulk copy format: numbered list ordered by priority
- Toast auto-dismiss after 3-5 seconds

### Claude's Discretion
- Exact layout spacing and padding for fix prompt blocks
- How to integrate review history into existing sidebar data model
- Whether to store reviews in same history directory or separate reviews directory
- Deep-dive message serialization format
- Tier list initial model entries (based on current Ollama ecosystem knowledge)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REVW-06 | Each finding includes a "What to ask your AI to fix" copy-pasteable prompt | Schema extension (fixPrompt field), system prompt update, FindingCard UI block, copy mechanics |
| REVW-10 | Review history saves structured report card data for revisiting past reviews | History system already saves review JSON; needs deep-dive persistence, sidebar grade badge, restore flow |
| UX-05 | Model capability warnings -- gentle guidance when a small model may give poor review results | Tier list system, installed-model lookup, pre-review warning UI, post-review suspicion banner |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 18 | 18.x | UI framework | Already in project |
| Tailwind CSS | 3.x | Styling | Already in project |
| Zod | 4.x | Schema validation | Already used for review schema |
| Lucide React | latest | Icons (Copy, Clipboard, AlertTriangle) | Phase 3 decision -- all icons use Lucide |
| uuid | latest | History entry IDs | Already used in lib/history.js |

### No New Dependencies Required

This phase requires zero new npm packages. All features are built on existing infrastructure:
- Schema: Zod (already installed)
- History: fs + JSON (already implemented)
- Clipboard: `navigator.clipboard.writeText()` (browser API)
- Model list: Ollama `/api/tags` (already called)

## Architecture Patterns

### Recommended Changes by Feature

#### Feature 1: Fix Prompts (REVW-06)

**Backend changes:**
```
lib/review-schema.js   -- Add fixPrompt to FindingSchema
lib/prompts.js         -- Update review system prompt to instruct LLM to generate fixPrompt
```

**Frontend changes:**
```
src/components/ReportCard.jsx  -- Add FixPromptBlock to FindingCard, CopyAllButton to header
```

#### Feature 2: Review History (REVW-10)

**Backend changes:**
```
lib/history.js         -- No changes needed (already generic JSON save)
server.js              -- No changes needed (history API already works)
```

**Frontend changes:**
```
src/App.jsx            -- Already has handleSaveReview; needs deep-dive message persistence
src/components/ReviewPanel.jsx  -- Save/restore deep-dive messages on history load
src/components/Sidebar.jsx      -- Show grade badge for review-mode entries
```

#### Feature 3: Model Warnings (UX-05)

**Frontend changes:**
```
src/components/ReviewPanel.jsx  -- Replace getModelCapabilityWarning with tier-list system
                                -- Add pre-review modal/banner with Switch button
                                -- Add post-review suspicion banner
src/App.jsx                     -- Pass models list and setSelectedModel to ReviewPanel
```

### Pattern: Fix Prompt Schema Extension

Add `fixPrompt` as optional string to FindingSchema (optional because LLM may not always produce it):

```javascript
// lib/review-schema.js
const FindingSchema = z.object({
  title: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  explanation: z.string(),
  analogy: z.string().optional(),
  suggestedFix: z.string().optional(),
  fixPrompt: z.string().optional()   // <-- NEW
})
```

Keep `fixPrompt` optional in the Zod schema so validation does not break if the LLM omits it. The JSON Schema sent to Ollama `format` param will include it, guiding the LLM to generate it.

### Pattern: System Prompt Update for Fix Prompts

The review system prompt in `lib/prompts.js` must instruct the LLM to generate fixPrompt fields. Add to the schema description section:

```
- optionally "fixPrompt" (a natural-language instruction the user can paste into their AI tool to fix this issue. Write it as a direct request: "In [filename], please [specific fix]. The current code [problem description]." Make it specific enough that an AI coding tool can act on it without seeing the original code review.)
```

Key insight: The fixPrompt must reference the filename when available (passed in the user content as `File: ${filename}`). The system prompt should instruct the LLM to use the filename in fix prompts when it appears in the user message.

### Pattern: Review History Data Model

Reviews are already being saved to history. The current `handleSaveReview` in App.jsx saves:
```javascript
{
  id: uuid,
  title: "Review: server.js",
  mode: "review",
  model: "qwen3:14b",
  messages: [],           // empty for reviews
  reviewData: {
    reportData: { ... },  // full report card
    filename: "server.js",
    code: "...",
    model: "qwen3:14b"
  },
  createdAt: "2026-03-14T..."
}
```

**Recommendation for deep-dive persistence:** Add a `deepDiveMessages` array to the reviewData object. When the user does a deep dive, save messages back to history. When reopening, restore both reportData and deepDiveMessages.

**Recommendation for storage:** Use the SAME history directory. The existing system already handles arbitrary JSON. Adding a separate directory would require new API endpoints and sidebar logic for no benefit. The `mode: "review"` field already distinguishes review entries.

### Pattern: Sidebar Grade Badge

The sidebar currently shows mode icon + title + model + date. For review entries, add the overall grade as a colored badge:

```jsx
// In Sidebar.jsx, inside the history item render
{h.mode === 'review' && h.reviewData?.reportData?.overallGrade && (
  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${gradeColorClass}`}>
    {h.reviewData.reportData.overallGrade}
  </span>
)}
```

Note: `listConversations()` in `lib/history.js` only returns `{ id, title, mode, model, createdAt, archived }`. To show the grade in the sidebar without loading full conversation data, either:
1. Add `overallGrade` to the list summary (lightweight -- just read one extra field), OR
2. Load it client-side from the full conversation data

**Recommendation:** Option 1 -- modify `listConversations()` to include `overallGrade` when `mode === 'review'`. This keeps the sidebar fast without extra API calls.

### Pattern: Model Tier List

```javascript
// Hardcoded tier list for review quality
const MODEL_TIERS = {
  strong: [
    'qwen3:32b', 'qwen3:30b', 'qwen2.5:32b',
    'llama3:70b', 'llama3.1:70b', 'llama3.3:70b',
    'deepseek-r1:32b', 'deepseek-r1:70b',
    'codellama:34b', 'codellama:70b',
    'mixtral:8x22b', 'command-r-plus',
    'qwq:32b', 'gemma3:27b'
  ],
  adequate: [
    'qwen3:14b', 'qwen3:8b', 'qwen2.5:14b', 'qwen2.5:7b',
    'llama3:8b', 'llama3.1:8b', 'llama3.2:8b',
    'deepseek-r1:14b', 'deepseek-r1:8b',
    'codellama:13b', 'codellama:7b',
    'gemma3:12b', 'mistral:7b', 'mixtral:8x7b',
    'phi4:14b'
  ],
  weak: [
    'qwen3:4b', 'qwen3:1.7b', 'qwen3:0.6b',
    'qwen2.5:3b', 'qwen2.5:1.5b', 'qwen2.5:0.5b',
    'llama3.2:3b', 'llama3.2:1b',
    'deepseek-r1:1.5b', 'deepseek-r1:7b',
    'gemma3:4b', 'gemma3:1b',
    'phi4-mini:3.8b', 'tinyllama:1.1b'
  ]
};
```

**Matching logic:** Strip tag suffixes (`:latest`, `:q4_K_M`, etc.) and match against tier list. For unknown models, fall back to parameter-count regex detection (the existing approach).

**Best-available suggestion:** When warning about a weak model, iterate through `strong` tier first, then `adequate`, checking which are in the user's installed models list. Suggest the first match.

### Pattern: Post-Review Suspicion Detection

After a weak-tier model returns results, check for suspiciously good output:
- All categories grade A
- Fewer than 2 total findings
- `cleanBillOfHealth: true`

If triggered AND model is in weak tier, show a gentle banner.

### Anti-Patterns to Avoid

- **Do NOT make fixPrompt required in the schema.** The LLM may occasionally omit it. Make it optional and handle gracefully in UI (hide the block if missing).
- **Do NOT create a separate review history API.** The existing `/api/history` endpoints work perfectly for reviews.
- **Do NOT block the review if the user ignores the model warning.** It is a suggestion, not a gate.
- **Do NOT use emoji for copy/clipboard icons.** Use Lucide React icons per Phase 3 decision (Copy, ClipboardCopy, etc.).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clipboard API | Custom clipboard polyfill | `navigator.clipboard.writeText()` | Browser API works in all modern browsers, already used in CopyFixButton |
| JSON Schema generation | Manual schema writing | `z.toJSONSchema(schema)` | Already used for reportCardJsonSchema, keeps schema in sync |
| UUID generation | Custom ID generator | `uuid` package | Already imported in lib/history.js |
| Toast notifications | Custom notification system | Existing Toast component | Already works, just needs longer timeout (currently 2500ms, need 3000-5000ms) |

## Common Pitfalls

### Pitfall 1: Fix Prompt Quality with Small Models
**What goes wrong:** Small models (7B and under) generate vague or unhelpful fix prompts like "Please fix the code."
**Why it happens:** Generating context-aware natural language requires more capability than generating code snippets.
**How to avoid:** Make fixPrompt optional in the schema. In the UI, if fixPrompt is empty or too short (< 20 chars), fall back to a generic prompt constructed from the finding title + explanation.
**Warning signs:** Fix prompts that are identical across findings, or that repeat the explanation verbatim.

### Pitfall 2: History Data Size
**What goes wrong:** Saving full source code + report card + deep-dive messages creates large JSON files.
**Why it happens:** Users may review large files (1000+ lines) and have extended deep-dive conversations.
**How to avoid:** This is acceptable for a local-only tool with JSON file storage. No immediate concern, but worth noting for future optimization if history directory grows large.

### Pitfall 3: Stale Model List for Tier Matching
**What goes wrong:** User's Ollama models have custom tags (`:myfinetune`, `:q4_0`) that don't match tier list entries.
**Why it happens:** Ollama model names include version/quantization tags.
**How to avoid:** Normalize model names before matching: strip everything after the parameter count tag, or match by base name + parameter size. Example: `qwen3:14b-q4_K_M` should match `qwen3:14b`.

### Pitfall 4: Toast Timing
**What goes wrong:** Current Toast auto-dismisses at 2500ms. The decision calls for 3-5 seconds.
**Why it happens:** Toast component has hardcoded timeout.
**How to avoid:** Add a `duration` prop to Toast component, defaulting to 3000ms. Pass 4000ms for copy confirmations.

### Pitfall 5: Deep-Dive Restore Losing Context
**What goes wrong:** When restoring a deep-dive conversation from history, the context message (original code + finding) is lost.
**Why it happens:** The context is constructed dynamically in `handleDeepDive` and stored as a message with `role: 'context'`.
**How to avoid:** Save the full deepDiveMessages array including context messages. On restore, rehydrate the messages array and set phase to 'deep-dive' or 'report' (user chooses which to view).

### Pitfall 6: Model Name Matching Edge Cases
**What goes wrong:** Models like `deepseek-r1:7b` could be matched as adequate but actually perform poorly on structured JSON.
**Why it happens:** Parameter count alone doesn't determine structured output quality.
**How to avoid:** The tier list is empirical, not parameter-based. When a model is unknown, the parameter-count fallback is conservative (warn for < 13B). The tier list can be updated over time.

## Code Examples

### Fix Prompt Block in FindingCard
```jsx
// Inside FindingCard, after suggestedFix block
{finding.fixPrompt && (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-indigo-400 flex items-center gap-1.5">
        <Clipboard className="w-3.5 h-3.5" />
        What to ask your AI to fix
      </span>
      <CopyFixButton text={finding.fixPrompt} toastMessage="Copied! Paste this into your AI tool to fix it." />
    </div>
    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-lg px-3 py-2.5 text-sm text-indigo-200/90 leading-relaxed">
      {finding.fixPrompt}
    </div>
  </div>
)}
```

### Bulk Copy All Fix Prompts
```jsx
function buildBulkFixPrompts(categories) {
  const prompts = [];
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  for (const [key, cat] of Object.entries(categories)) {
    for (const finding of (cat.findings || [])) {
      if (finding.fixPrompt) {
        prompts.push({ severity: finding.severity, prompt: finding.fixPrompt });
      }
    }
  }

  prompts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  if (prompts.length === 0) return null;

  return "Fix these issues in my code:\n" +
    prompts.map((p, i) => `${i + 1}. ${p.prompt}`).join('\n');
}
```

### Model Tier Matching
```javascript
function getModelTier(modelName, tiers) {
  if (!modelName) return 'unknown';
  const normalized = modelName.toLowerCase().replace(/:latest$/, '');

  // Try exact match first
  for (const [tier, models] of Object.entries(tiers)) {
    if (models.some(m => normalized === m || normalized.startsWith(m + '-') || normalized.startsWith(m + ':'))) {
      return tier;
    }
  }

  // Fallback: match base name + param size
  // Extract base and params: "qwen3:14b-q4_K_M" -> "qwen3:14b"
  const baseMatch = normalized.match(/^([^:]+):(\d+(?:\.\d+)?b)/);
  if (baseMatch) {
    const base = `${baseMatch[1]}:${baseMatch[2]}`;
    for (const [tier, models] of Object.entries(tiers)) {
      if (models.includes(base)) return tier;
    }
  }

  // Parameter-count fallback (existing logic)
  if (/(?:^|[^0-9])(?:0\.5b|1b|1\.5b|2b|3b|4b)(?:$|[^0-9])/.test(normalized)) return 'weak';
  if (/(?:^|[^0-9])(?:7b|8b)(?:$|[^0-9])/.test(normalized)) return 'adequate';
  return 'unknown'; // Don't warn for unknown models
}
```

### Best-Available Model Suggestion
```javascript
function suggestBetterModel(currentModel, installedModels, tiers) {
  const currentTier = getModelTier(currentModel, tiers);
  if (currentTier === 'strong') return null;

  // Check installed models for better options
  for (const targetTier of ['strong', 'adequate']) {
    if (targetTier === currentTier) continue;
    for (const model of installedModels) {
      if (getModelTier(model.name, tiers) === targetTier) {
        return { name: model.name, tier: targetTier };
      }
    }
  }

  return null; // No better model available
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `suggestedFix` (code snippet) | `fixPrompt` (natural language) | Phase 4 | Users paste into AI tool instead of manually applying code |
| Regex param detection for warnings | Empirical tier list + fallback | Phase 4 | More accurate model quality predictions |
| No review persistence | Full report card + deep-dive saved | Phase 4 | Reviews become reusable reference artifacts |

## Open Questions

1. **Deep-dive message save timing**
   - What we know: Auto-save on review completion is decided. Deep-dive messages accumulate after initial save.
   - What's unclear: Should deep-dive messages be saved after each message, or only when user navigates away from deep-dive?
   - Recommendation: Save after each assistant response completes (same pattern as chat mode auto-save). This prevents data loss if user closes browser.

2. **Tier list maintenance**
   - What we know: Hardcoded list will become stale as new models release.
   - What's unclear: How often will this need updating?
   - Recommendation: Keep the list in a dedicated constant/config object that is easy to update. The parameter-count fallback handles new models reasonably.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all relevant files (review-schema.js, review.js, prompts.js, ReviewPanel.jsx, ReportCard.jsx, Sidebar.jsx, App.jsx, history.js, ollama-client.js, server.js, Toast.jsx)
- CONTEXT.md locked decisions from user discussion

### Secondary (MEDIUM confidence)
- Ollama model ecosystem knowledge for tier list entries (training data, may be slightly stale)
- Clipboard API browser compatibility (well-established, HIGH effective confidence)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing code examined
- Architecture: HIGH - clear integration points identified in actual codebase
- Pitfalls: HIGH - derived from examining real code patterns and data flow

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable -- existing codebase patterns unlikely to change)
