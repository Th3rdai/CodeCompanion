# Phase 2: Tone Unification - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewrite all system prompts in `lib/prompts.js` and mode labels in `src/App.jsx` to serve vibe coders (non-technical AI-assisted developers) instead of Product Managers. Transform the friendly-teacher tone from PM-focused to vibe-coder-focused — removing team/stakeholder language, adjusting analogies and explanations for someone who has never written code manually, and updating UI labels to be universally clear.

</domain>

<decisions>
## Implementation Decisions

### Tone Approach

- **Mode-specific flavors** — Each mode has its own personality (explain is patient teacher, bugs is protective friend, refactor is helpful coach) rather than unified tone everywhere
- **Refactor mode behavior** — Show the improved code PLUS explain what to ask the user's AI tool to change. Don't skip the code — it's a reference. But add "Here's what to tell your AI" prompts that are copy-pasteable
- **Clean code celebration** — Warm but measured. "This looks solid! All green across the board." Positive without being over the top. Not "This is AMAZING!!!" — keep it encouraging but grounded

### Audience Shift

- **Remove team references** — "your dev team" becomes "your AI coding tool" or similar. Vibe coders work solo with AI, not managing engineering teams
- **Remove PM-specific phrases** — "your product roadmap", "tell your manager", "leadership update" → reframe for solo builders working on projects
- **Direct "you" without assumptions** — Address the user directly but don't assume PM context. "You can paste code here" not "your dev team can review this"

### Mode Label Updates

- **Translation modes need renaming** — "Tech → Biz" and "Biz → Tech" are PM jargon
- **Keep generic translation framing** — Something like "Code → Plain English" and "Idea → Code Spec" or similar clear transformation language
- **Other labels mostly fine** — "Chat", "Explain This", "Safety Check", "Clean Up", "Review", "Create" already work for vibe coders

### Claude's Discretion

- Exact mode label format (arrow style vs action verbs — "Code → English" vs "Explain to Others")
- Other mode label tweaks beyond translation modes
- Explain mode patience level (very patient vs patient-but-not-patronizing)
- Bugs mode tone specifics (protective friend vs honest doctor framing)
- Analogy usage strategy (all modes vs review-only, everyday life vs pop culture style)
- Technical term handling (inline-only vs inline + glossary with existing JargonGlossary.jsx)
- Error messaging tone (friendly-and-helpful vs clear-and-calm)
- Non-code input handling (respond conversationally vs redirect to correct usage)
- Encouragement level (celebrate wins vs matter-of-fact)
- Prompt structure consistency (uniform sections vs mode-specific formats)
- Placeholder text patterns in mode input boxes

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- **lib/prompts.js** — 8 mode prompts currently exist, all PM-focused but with good friendly-teacher baseline
- **MODE_GUARDRAIL** — Already handles non-code input gracefully (respond conversationally instead of forcing structured output)
- **src/components/JargonGlossary.jsx** — Glossary component exists if we want inline + hover definitions
- **Review mode prompts** — Just created in Phase 1 with protective-parent tone, good reference for other modes

### Established Patterns

- PM-focused language throughout: "your dev team", "your product", "stakeholders", "leadership updates"
- Friendly-teacher tone already present but aimed at technical PMs who manage dev teams
- Some mode labels already vibe-coder friendly: "Safety Check" (bugs), "Clean Up" (refactor)
- Explain/bugs/refactor prompts use structured sections (## What This Does, ## How It Works, etc.)

### Integration Points

- Mode labels defined in `src/App.jsx` MODES array — update 2 labels (translate modes)
- System prompts in `lib/prompts.js` SYSTEM_PROMPTS object — rewrite 7 prompts (all except review)
- Review mode prompts (REVIEW_SYSTEM_PROMPT, REVIEW_FALLBACK_PROMPT) may need minor vibe-coder adjustments
- Placeholders in MODES array also need updating from PM language

</code_context>

<specifics>
## Specific Ideas

- The shift from PM to vibe coder is about removing the "you manage a team" assumption — vibe coders ARE the builders, working with AI tools directly
- Translation modes should describe the transformation clearly since "Tech/Biz" means nothing to someone outside PM world
- Analogies and plain English were always the goal — now it's for someone with zero coding background instead of a PM with dev-team familiarity
- MODE_GUARDRAIL already handles "what if they say hi?" — leverage this pattern, don't fight it

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 02-tone-unification_
_Context gathered: 2026-03-13_
