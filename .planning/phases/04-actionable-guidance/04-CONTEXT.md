# Phase 4: Actionable Guidance - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Reviews become reusable and actionable. Every finding has a copy-pasteable prompt for the user's AI tool, past reviews are saved with full report card data, and the app warns when a model may produce poor results. This phase does NOT add new review categories, multi-file review, or before/after comparisons.

</domain>

<decisions>
## Implementation Decisions

### Fix Prompt Format
- Natural-language prompts, NOT code snippets — transform findings into "Ask your AI to fix:" instructions the user pastes into Cursor/ChatGPT/Replit
- Generic tool reference ("your AI tool"), not tool-specific — no settings needed
- LLM-generated during review — add `fixPrompt` field to the review JSON schema so the LLM writes context-aware natural-language prompts
- Include file/function context when available — if user uploaded a file or browsed a folder, the prompt references it ("In your server.js file, please fix..."); falls back to generic for pasted code

### Review History
- Sidebar integration — saved reviews appear in the existing sidebar history list, filterable by mode; clicking reopens the full report card
- Full report card JSON saved — complete structured data (grades, findings, fixPrompts, topPriority) plus original code and file name
- Auto-save on review completion — save immediately when report card loads; toast confirmation; user can delete from history
- Resume deep-dive conversations — save deep-dive messages; when reopened, user sees report card AND can continue asking questions

### Model Warning Behavior
- Enhanced pre-review warning — keep existing amber text + suggest a better model from user's installed Ollama models with "Continue anyway" / "Switch" buttons
- Empirical tier list — maintain a hardcoded list of known strong/adequate/weak models; falls back to parameter-based detection for unknown models
- Auto-switch on click — "Switch" button immediately changes the model selector to the suggested model
- Review-mode only — warnings only appear in Review mode (other modes work fine with small models via streaming)
- Post-review hint — if a weak-tier model returns suspiciously good grades (all A's, few findings), show a soft banner below the report card suggesting a larger model with a "Try it" button
- Best-available suggestion logic — check user's installed models against tier list, suggest highest-tier available; if none strong, suggest best adequate; if none, just warn without switch button

### Copy/Action Mechanics
- One-click copy per finding AND bulk "Copy All Fix Prompts" button at top of report card
- Fix prompt in visually distinct block — highlighted box (like blockquote) below finding explanation with copy button; clear visual separation
- Action-oriented toast — "Copied! Paste this into your AI tool to fix it." (friendly-teacher tone, guides next step)
- Bulk copy format — numbered list ordered by priority: "Fix these issues in my code:\n1. Please add input validation...\n2. Please add error handling..."
- Toast auto-dismiss after 3-5 seconds per UX guidelines

### Claude's Discretion
- Exact layout spacing and padding for fix prompt blocks
- How to integrate review history into existing sidebar data model
- Whether to store reviews in same history directory or separate reviews directory
- Deep-dive message serialization format
- Tier list initial model entries (based on current Ollama ecosystem knowledge)

</decisions>

<specifics>
## Specific Ideas

- Fix prompts should follow the pattern already established in Phase 2's refactor mode ("Here's What to Tell Your AI" section)
- The post-review banner for weak models should feel like a gentle suggestion, not a judgment — "For a deeper review, try qwen3:latest" not "Your model is too small"
- Copy All button should be prominent near the top of the report card, not buried below findings

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CopyFixButton` component in ReportCard.jsx — already copies suggestedFix to clipboard; can be extended to copy fixPrompt instead
- `getModelCapabilityWarning()` in ReviewPanel.jsx — already detects small models by parameter count; needs tier list upgrade
- `lib/history.js` — full conversation history system with save/load/list/archive; saves JSON files with UUID, title, mode, model, timestamps
- `Toast` component — already shows notifications; supports the action-oriented copy confirmation
- `FindingCard` component in ReportCard.jsx — has expandable details, severity pills; needs fixPrompt block added
- Existing report card export (Markdown + JSON) — can inform how saved reviews are structured

### Established Patterns
- State machine in ReviewPanel.jsx: 'input' | 'loading' | 'report' | 'fallback' | 'deep-dive' — saved reviews would restore to 'report' state
- Sidebar.jsx shows conversation history filtered by mode — review history follows same pattern
- Structured JSON schema with Zod validation (Phase 1) — fixPrompt field adds to existing schema
- Lucide React icons throughout (Phase 3 decision) — use for copy/clipboard icons

### Integration Points
- `/api/review` endpoint — must include fixPrompt in structured JSON schema response
- `lib/review.js` — review system prompt needs fixPrompt generation instructions
- `lib/history.js` — needs to handle review-type conversations with reportCard data
- Sidebar history list — needs to show grade badge for review entries
- ReviewPanel state machine — needs 'saved-report' or similar state for loaded reviews

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-actionable-guidance*
*Context gathered: 2026-03-14*
