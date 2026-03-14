# Phase 2: Tone Unification - Research

**Researched:** 2026-03-13
**Domain:** LLM system prompt engineering, conversational AI tone consistency, plain-language technical communication
**Confidence:** HIGH

## Summary

This phase transforms Code Companion's audience from Product Managers (who manage dev teams) to "vibe coders" (non-technical users who build with AI coding tools). The shift requires rewriting 8 mode prompts in `lib/prompts.js` and updating 2 mode labels in `src/App.jsx`. The technical challenge is maintaining tone consistency across modes while adapting analogies, removing team-management language, and ensuring zero-jargon communication.

Research confirms that explicit tone instructions, example-based prompting, and consistent vocabulary choices are industry-standard approaches for LLM prompt engineering in 2025. The existing codebase already has strong foundations: MODE_GUARDRAIL for conversational handling, JargonGlossary.jsx for inline definitions, and a friendly-teacher baseline tone. The task is audience shift, not tone invention.

**Primary recommendation:** Use explicit tone sections in each prompt, maintain mode-specific personality flavors (patient teacher, protective friend, helpful coach), leverage existing glossary infrastructure for inline jargon explanations, and test prompts with non-technical language validator criteria.

## User Constraints (from CONTEXT.md)

<user_constraints>
### Locked Decisions

**Tone Approach:**
- Mode-specific flavors — Each mode has its own personality (explain is patient teacher, bugs is protective friend, refactor is helpful coach) rather than unified tone everywhere
- Refactor mode behavior — Show the improved code PLUS explain what to ask the user's AI tool to change. Don't skip the code — it's a reference. But add "Here's what to tell your AI" prompts that are copy-pasteable
- Clean code celebration — Warm but measured. "This looks solid! All green across the board." Positive without being over the top. Not "This is AMAZING!!!" — keep it encouraging but grounded

**Audience Shift:**
- Remove team references — "your dev team" becomes "your AI coding tool" or similar. Vibe coders work solo with AI, not managing engineering teams
- Remove PM-specific phrases — "your product roadmap", "tell your manager", "leadership update" → reframe for solo builders working on projects
- Direct "you" without assumptions — Address the user directly but don't assume PM context. "You can paste code here" not "your dev team can review this"

**Mode Label Updates:**
- Translation modes need renaming — "Tech → Biz" and "Biz → Tech" are PM jargon
- Keep generic translation framing — Something like "Code → Plain English" and "Idea → Code Spec" or similar clear transformation language
- Other labels mostly fine — "Chat", "Explain This", "Safety Check", "Clean Up", "Review", "Create" already work for vibe coders

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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TONE-01 | All system prompts rewritten with friendly-teacher persona using analogies and zero jargon | LLM prompt engineering best practices (explicit tone instructions, consistent vocabulary), jargon-free communication strategies (analogies, plain language, inline definitions) |
| TONE-02 | Explain mode reworked for users who have never coded — uses everyday analogies | Plain-language strategies, analogy-based explanations, audience-specific framing techniques |
| TONE-03 | Bugs mode reworked with plain-English severity and "what will actually break" framing | Non-technical communication strategies, severity framing without technical assumptions |
| TONE-04 | Refactor mode reworked as "what to ask your AI to change" with copy-pasteable prompts | Vibe-coder workflow patterns (user tells AI what to fix, not manual code editing), actionable guidance framing |
| TONE-05 | Translate modes reworked to bridge vibe-coder understanding, not PM-developer gap | Audience shift from PM-to-dev translation to non-technical-to-technical translation |
| UX-02 | Simplified mode labels and UI language throughout (no technical jargon in navigation) | UI naming conventions (verb-led commands, clear state indication, brief informative labels) |
</phase_requirements>

## Standard Stack

### Core Libraries (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 18+ | JavaScript runtime for backend | Industry standard for server-side JS, Express ecosystem |
| Express | ^4.18.2 | Web server framework | Most popular Node.js web framework, minimal and flexible |
| React | ^19.2.4 | Frontend UI framework | Already in use, component-based architecture fits mode-specific UI |
| Ollama REST API | N/A | LLM inference | Local-first AI, already integrated, supports streaming |

### Supporting (No New Dependencies Needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| JargonGlossary.jsx | In-app | Inline term definitions | Already implemented for UX-03, can enhance with vibe-coder-specific terms |
| MODE_GUARDRAIL | In-app | Conversational fallback | Already handles non-code input gracefully, no changes needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual prompt editing | LangChain prompt templates | Adds dependency overhead, existing string templates work fine for 8 prompts |
| Static prompts | Dynamic prompt injection | Over-engineered for fixed-mode system, adds complexity without clear benefit |
| Inline definitions only | Separate glossary modal | Already have both (GlossaryPanel + JargonTooltip), no changes needed |

**Installation:**

No new dependencies required. All work is editing existing files:
- `lib/prompts.js` (8 system prompts)
- `src/App.jsx` (2 mode labels, 8 placeholder texts)

## Architecture Patterns

### Recommended Prompt Structure

Industry best practice for tone-consistent LLM prompts (2025):

```javascript
// Pattern: Explicit Identity + Tone + Structure + Guardrail
const SYSTEM_PROMPTS = {
  [mode]: `You are [IDENTITY] — [ROLE DESCRIPTION with personality].

[TONE GUIDANCE — personality traits, language style]

[STRUCTURAL TEMPLATE if mode needs sections]

[GUARDRAIL for edge cases]`
};
```

### Pattern 1: Identity-First Prompting

**What:** Start with explicit identity statement defining persona, role, and audience context
**When to use:** Every mode prompt
**Example:**

```javascript
// Source: Latitude.so "5 Tips for Consistent LLM Prompts" + MIT Sloan effective prompts guide
explain: `You are a friendly, patient teacher helping someone who has never written code understand what code does. Think of yourself as the friend who makes complex things feel simple — never condescating, always encouraging.`
```

### Pattern 2: Mode-Specific Personality Flavors

**What:** Each mode has distinct personality archetype (patient teacher, protective friend, helpful coach) while sharing baseline friendly-teacher tone
**When to use:** Differentiating modes while maintaining consistency
**Example:**

```javascript
// Explain: Patient teacher
explain: `You are a friendly, patient teacher... Think of yourself as the friend who makes complex things feel simple.`

// Bugs: Protective friend
bugs: `You are a thoughtful, supportive safety inspector... Think of yourself as a friendly lookout — you're not here to criticize, you're here to protect.`

// Refactor: Helpful coach
refactor: `You are a supportive coding mentor... Think of yourself as a helpful coach doing a collaborative review — you're building up, not tearing down.`
```

### Pattern 3: Structured Output Sections

**What:** Define explicit output format with section headers for consistency
**When to use:** Modes with predictable structure (explain, bugs, refactor, translate modes)
**Example:**

```javascript
// Source: Voiceflow prompt engineering guide
explain: `Structure your response as:

## What This Code Does
(The "elevator pitch" — explain it like you're telling a friend)

## How It Works
(Step-by-step walkthrough. Use analogies that make it click)

## Why It Matters for Your Project
(Connect the dots: what does this mean for what you're building?)`
```

### Pattern 4: Inline Jargon Definition Strategy

**What:** When technical terms are unavoidable, define them inline in parentheses
**When to use:** All modes, as escape hatch when plain language isn't sufficient
**Example:**

```javascript
// Source: Review prompt (already implemented)
review: `When a technical term is unavoidable, always explain it in parentheses: "SQL injection (when someone tricks your app into running commands on your database)".`
```

### Pattern 5: Conversational Guardrail

**What:** Handle non-code input gracefully without forcing structured format
**When to use:** All modes except review (which expects code)
**Example:**

```javascript
// Source: Existing MODE_GUARDRAIL
const MODE_GUARDRAIL = `
IMPORTANT: If the user sends a greeting, general question, or message that does NOT contain code or technical content, respond conversationally and helpfully — do NOT use the structured format above or invent code to analyze.`;
```

### Anti-Patterns to Avoid

- **Assuming PM context:** Don't reference "your dev team", "stakeholders", "leadership updates", "product roadmap"
- **Technical jargon without explanation:** Never use terms like "API endpoint", "SQL injection", "REST" without inline definitions or relying on glossary
- **Overly formal language:** "Pursuant to your inquiry" → "Here's what I found"
- **False precision:** "This is 73% optimized" → "This is pretty clean"
- **Patronizing tone:** "Let me dumb this down for you" → "Let me explain this in everyday terms"

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Jargon detection & tooltips | Custom regex matcher for tech terms | Existing JargonGlossary.jsx with highlightJargon() | Already implemented, covers 69 terms across 7 categories, handles inline + modal |
| Prompt version control | Manual copy-paste of old prompts | Git commits with descriptive messages | Git already tracks changes, no custom tooling needed |
| Tone consistency validation | Custom LLM prompt analyzer | Manual review + test conversations | 8 prompts total, small enough for human review, over-engineering for scale |
| Non-code input handling | Custom intent classifier | Existing MODE_GUARDRAIL pattern | Already handles greeting/question detection, works well |

**Key insight:** This is a content editing task (rewriting 8 prompts + 2 labels), not a feature build. Resist the urge to add tooling, frameworks, or validation systems. The existing codebase has everything needed.

## Common Pitfalls

### Pitfall 1: Inconsistent Audience Framing

**What goes wrong:** Mixing PM language ("your dev team") with vibe-coder language ("your AI tool") in same prompt creates identity confusion
**Why it happens:** Existing prompts are PM-focused, easy to miss subtle references during editing
**How to avoid:** Search-and-replace pattern: "your dev team" → "your AI coding tool", "stakeholders" → "people using your project", "leadership" → out of scope
**Warning signs:** User confusion about who the tool is for, prompts that reference team management or organizational hierarchy

### Pitfall 2: Over-Simplification Becomes Patronizing

**What goes wrong:** "Dumbing down" language feels condescending ("Let me make this really simple for you")
**Why it happens:** Overcorrecting from technical jargon to treating user as incapable
**How to avoid:** Use everyday analogies without apologizing ("Think of it like a recipe" not "Let me explain this like you're five")
**Warning signs:** Phrases like "don't worry", "it's okay if you don't understand", "let me simplify"

### Pitfall 3: Mode Personality Drift

**What goes wrong:** Explain mode sounds like Bugs mode sounds like Refactor mode — all generic friendly assistant
**Why it happens:** Focusing on baseline tone ("friendly teacher") without preserving mode-specific flavor
**How to avoid:** Each prompt should have distinct personality archetype: patient teacher (explain), protective friend (bugs), helpful coach (refactor), translator (translate modes)
**Warning signs:** All modes using same phrases ("let me help you"), same structural templates, same level of formality

### Pitfall 4: Jargon Leakage Without Inline Definitions

**What goes wrong:** Prompts output technical terms without explaining them, assuming glossary will catch everything
**Why it happens:** JargonGlossary.jsx exists, so prompts rely on it instead of being self-contained
**How to avoid:** Prompts should use inline definitions "(term explanation)" for critical concepts, glossary is backup not primary explanation method
**Warning signs:** LLM outputs "The API endpoint uses CORS" without defining API, endpoint, or CORS

### Pitfall 5: Placeholder Text Mismatch

**What goes wrong:** Mode placeholder text still says "Paste a spec and I'll turn it into something your dev team will love" after prompt rewrite
**Why it happens:** Placeholders live in `src/App.jsx` MODES array, separate from prompts in `lib/prompts.js`
**How to avoid:** Update both files in same commit, verify placeholder language matches prompt audience
**Warning signs:** UI says "your dev team" but LLM says "your AI tool", language inconsistency between input hint and output

## Code Examples

Verified patterns from existing codebase and research:

### Audience Shift: PM → Vibe Coder

```javascript
// Source: lib/prompts.js (before)
translate-biz: `Take the feature request and produce:
## What Needs to Be Built
(Developer-friendly breakdown of the technical work)
## Your Talking Points
(2-3 ready-to-use bullet points for your next leadership update or standup)`

// After (vibe-coder framing)
translate-biz: `Take the idea and produce:
## What Needs to Be Built
(Clear breakdown of the technical work to tell your AI coding tool)
## How to Explain It
(2-3 simple talking points if someone asks what you're building)`
```

### Inline Jargon Definition

```javascript
// Source: Existing review prompt (REVIEW_SYSTEM_PROMPT)
review: `When a technical term is unavoidable, always explain it in parentheses: "SQL injection (when someone tricks your app into running commands on your database)".`
```

### Mode-Specific Personality Preservation

```javascript
// Source: Existing prompts (lib/prompts.js)
// Explain: Patient teacher
explain: `You are a friendly, patient teacher... Think of yourself as the colleague who always makes complex things feel simple — never condescending, always encouraging.`

// Bugs: Protective friend
bugs: `You are a thoughtful, supportive code reviewer... Think of yourself as a friendly safety inspector — you're not here to criticize, you're here to protect.`

// Refactor: Helpful coach
refactor: `You are a supportive coding mentor... Think of yourself as a friendly senior dev doing a collaborative code review — you're building up, not tearing down.`
```

### UI Label Clarity (Mode Labels)

```javascript
// Source: src/App.jsx MODES array (before)
{ id: 'translate-tech', label: 'Tech → Biz', ... }
{ id: 'translate-biz',  label: 'Biz → Tech', ... }

// After (clear transformation language)
{ id: 'translate-tech', label: 'Code → Plain English', ... }
{ id: 'translate-biz',  label: 'Idea → Code Spec', ... }
```

### Placeholder Text Patterns

```javascript
// Source: NN/G UI Copy guidelines (verb-led, clear outcome)
// Before (PM-focused)
{ placeholder: "Paste a technical spec, PR, or code snippet...\nI'll turn it into something anyone can understand." }

// After (vibe-coder-focused, remove "anyone" assumption)
{ placeholder: "Paste code or a technical description...\nI'll explain it in plain English." }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic "helpful AI assistant" prompts | Explicit identity + tone + structure + guardrail | 2024-2025 | LLM behavior more consistent, reduces hallucination, clearer user expectations |
| Single global tone | Mode-specific personality flavors | 2024-2025 | Users get appropriate tone for task (patient for learning, protective for safety checks) |
| Assume technical literacy | Inline jargon definitions + glossary backup | 2023-2025 | Accessible to non-technical users, reduces support questions |
| PM/developer dichotomy | Vibe coder (AI-assisted non-technical builder) | 2024-2025 | New user archetype emerges with Cursor, Replit, Windsurf, Claude Code |
| Manual prompt versioning | Git-based prompt tracking | Always standard | Version control for prompts like any code artifact |

**Deprecated/outdated:**

- **"You are ChatGPT" style prompts:** Generic identity is weak, modern prompts use specific persona with role context
- **Zero-shot prompting for tone:** Research shows example-based prompting (few-shot) produces more consistent tone, but for system prompts, explicit instruction is sufficient
- **Technical terms without explanation:** Pre-2023 assumption that all users understand "API", "endpoint", "CORS" — modern UX assumes zero technical knowledge

## Validation Architecture

> Note: nyquist_validation not explicitly set in .planning/config.json — treating as enabled (default)

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (detected from tests/rate-limit.test.js) |
| Config file | None — using Node.js native test runner |
| Quick run command | `node --test tests/tone-validation.test.js` |
| Full suite command | `node --test tests/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TONE-01 | All prompts use friendly-teacher persona with analogies | unit | `node --test tests/tone-validation.test.js::test_prompt_tone` | Wave 0 |
| TONE-02 | Explain mode uses everyday analogies for non-coders | unit | `node --test tests/tone-validation.test.js::test_explain_analogies` | Wave 0 |
| TONE-03 | Bugs mode uses plain-English severity framing | unit | `node --test tests/tone-validation.test.js::test_bugs_severity` | Wave 0 |
| TONE-04 | Refactor mode includes copy-pasteable AI prompts | unit | `node --test tests/tone-validation.test.js::test_refactor_prompts` | Wave 0 |
| TONE-05 | Translate modes bridge vibe-coder understanding | unit | `node --test tests/tone-validation.test.js::test_translate_audience` | Wave 0 |
| UX-02 | Mode labels use clear non-jargon language | unit | `node --test tests/ui-labels.test.js::test_label_clarity` | Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test tests/tone-validation.test.js` (quick validation of prompt content)
- **Per wave merge:** `node --test tests/` (full suite including UI labels)
- **Phase gate:** Full suite green + manual conversation spot-check before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/tone-validation.test.js` — validates prompt content against vibe-coder criteria (no PM language, inline definitions, analogy usage)
- [ ] `tests/ui-labels.test.js` — validates MODES array labels and placeholders for jargon-free language
- [ ] Framework install: Already available (Node.js native `node:test`)

**Validation Criteria for Prompts (to be tested):**

1. **No PM language:** Prompts must not contain "dev team", "stakeholder", "leadership", "product roadmap", "manager"
2. **Inline definitions:** Technical terms (API, SQL, CORS, etc.) must be defined in parentheses or avoided
3. **Analogy presence:** At least one everyday analogy per prompt (kitchen, library, building, etc.)
4. **Personality archetype:** Each mode prompt clearly establishes distinct personality (teacher, friend, coach, translator)
5. **Guardrail present:** All non-review modes include MODE_GUARDRAIL or equivalent conversational fallback

**Validation Criteria for UI Labels (to be tested):**

1. **Verb-led or transformation-clear:** Labels start with verbs or show clear transformation (Code → Plain English)
2. **No jargon:** Labels avoid PM-specific or technical terms (no "Tech/Biz", "API", "Deploy")
3. **Placeholder alignment:** Placeholder text matches prompt audience (no "your dev team")

## Sources

### Primary (HIGH confidence)

- **Latitude.so Blog (2024-2025):** "5 Tips for Consistent LLM Prompts", "10 Examples of Tone-Adjusted Prompts", "How Examples Improve LLM Style Consistency" — industry best practices for prompt engineering
- **MIT Sloan Teaching & Learning (2025):** "Effective Prompts for AI: The Essentials" — academic guidance on clear, structured prompts
- **Lakera AI Prompt Engineering Guide (2026):** Comprehensive framework for production-grade prompts
- **Nielsen Norman Group (NN/G):** "UI Copy: UX Guidelines for Command Names" — authoritative UI naming conventions
- **Existing codebase:** `lib/prompts.js`, `src/App.jsx`, `src/components/JargonGlossary.jsx` — current implementation patterns

### Secondary (MEDIUM confidence)

- **Voiceflow Blog (2025):** "Prompt Engineering for Chatbot" — role prompting and conversational AI guidance
- **Training Magazine (2024):** "Beyond the Jargon: Effective Communication Strategies for Tech Experts" — jargon-free communication patterns
- **Anthropic Engineering Blog (2024):** "Effective context engineering for AI agents" — prompt structure and organization

### Tertiary (LOW confidence)

- **General web search results:** "Vibe coder" terminology (no established definition found, treating as project-specific term for AI-assisted non-technical builders)

## Metadata

**Confidence breakdown:**

- **Prompt engineering best practices:** HIGH — Multiple authoritative sources (Latitude, MIT Sloan, Lakera) with consistent recommendations for 2025
- **UI naming conventions:** HIGH — NN/G is industry-standard authority for UX patterns
- **Jargon-free communication:** MEDIUM — Good sources but mostly general guidance, not code-specific
- **Vibe coder audience:** LOW — Term appears project-specific, no established industry definition (treating as "non-technical user building with AI coding tools")
- **Existing codebase patterns:** HIGH — Direct inspection of current implementation

**Research date:** 2026-03-13
**Valid until:** 60 days (stable domain — prompt engineering evolves slowly, tone best practices are enduring)

---

## Ready for Planning

Research complete. Key findings:

1. **No new dependencies needed** — all work is editing `lib/prompts.js` and `src/App.jsx`
2. **Strong existing foundations** — MODE_GUARDRAIL, JargonGlossary, friendly-teacher baseline tone already in place
3. **Clear audience shift pattern** — Remove PM-specific language ("dev team", "stakeholders"), add vibe-coder framing ("your AI tool", "your project")
4. **Industry-validated prompt structure** — Identity + Tone + Structure + Guardrail is 2025 best practice
5. **Mode personality preservation critical** — Each mode needs distinct archetype (teacher, friend, coach) while sharing baseline tone
6. **Test infrastructure gap** — Need Wave 0 tests for prompt validation (no PM language, inline definitions, analogies)

Planner can now create task breakdown for:
- Rewrite 8 prompts in `lib/prompts.js`
- Update 2 labels + 8 placeholders in `src/App.jsx`
- Create validation tests in `tests/tone-validation.test.js` and `tests/ui-labels.test.js`
