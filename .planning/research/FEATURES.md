# Feature Landscape

**Domain:** Beginner-friendly code review and explanation tools for non-technical users (vibe coders)
**Researched:** 2026-03-13
**Confidence:** MEDIUM (training data + codebase analysis; web search unavailable for competitor verification)

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature                                                                     | Why Expected                                                                 | Complexity | Notes                                                                         |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| Visual report card with letter grades (A-F)                                 | Core value prop. At-a-glance code quality for non-technical users.           | Medium     | Structured output via Ollama `format` parameter with JSON Schema.             |
| Category breakdown (Bugs, Security, Readability, Completeness, Performance) | Users need to know which dimensions have problems.                           | Low        | Array of grade objects in the JSON schema.                                    |
| Overall grade                                                               | Without a single summary, users cannot answer "is this code okay?"           | Low        | Single field in schema.                                                       |
| Plain-English findings (no jargon)                                          | Vibe coders cannot parse "race condition" or "SQL injection."                | Low        | Prompt engineering in system prompt. Define audience as zero-code-experience. |
| One-click deep dive on any category                                         | After seeing a grade, users want to ask "why?"                               | Medium     | Click grade card -> triggers streaming chat with report card as context.      |
| Loading state during review                                                 | Structured output takes 3-8 seconds. Users must know something is happening. | Low        | "Grading your code..." spinner with friendly messaging.                       |
| Paste-and-review flow                                                       | Vibe coders copy from AI tools and paste. Must be zero-friction.             | Low        | Reuse existing `attachedFiles` and `buildUserContent`.                        |
| File upload for review                                                      | Many vibe coders work in files.                                              | Low        | Already exists. Wire to Review mode.                                          |
| Friendly-teacher tone across ALL modes                                      | Vibe coders are intimidated by technical tools. Warmth changes everything.   | Low        | System prompt rework. No code changes beyond prompt text.                     |
| Conversation history for reviews                                            | Users revisit past reviews.                                                  | Low        | Reuse existing `saveConversation` with structured data.                       |
| Graceful Ollama-offline handling                                            | Clear guidance, not cryptic errors.                                          | Low        | Already exists.                                                               |

## Differentiators

Features that set this apart.

| Feature                                             | Value Proposition                                                                                               | Complexity | Notes                                                                            |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------- |
| Report card with conversational deep-dive           | Scannable overview THEN drill-down chat. Not a wall of text (ChatGPT) or a list of warnings (SonarQube).        | High       | Key differentiator. Structured output -> visual card -> streaming follow-up.     |
| "Top Priority" single callout                       | Reduces overwhelm. One thing to fix first.                                                                      | Low        | Single field in JSON schema. Rendered prominently.                               |
| "What to ask your AI to fix" prompts                | Vibe coders don't fix code -- they tell Cursor/ChatGPT to fix it. Copy-pasteable prompts are uniquely valuable. | Medium     | Generate prompts like "Ask your AI to: Add input validation to the email field." |
| Color-coded grade visualization                     | A=green, B=blue, C=yellow, D=orange, F=red. Instant visual feedback.                                            | Low        | Tailwind utility classes. Pure presentation.                                     |
| Privacy-first messaging                             | "Your code never leaves your computer." Trust signal against cloud alternatives.                                | Low        | UI copy. Zero implementation cost.                                               |
| Severity-based prioritization with effort estimates | "Fix these 2 things first (5 min each)." Respects limited patience for iteration.                               | Low        | Prompt engineering.                                                              |
| Export review as shareable report                   | PDF/Markdown report card for sharing.                                                                           | Medium     | Extend existing export infrastructure with report-card templates.                |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature                       | Why Avoid                                                                                               | What to Do Instead                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Auto-fix / code rewriting          | Bypasses vibe coder workflow (tell AI to fix). Removes learning. LLM fixes unreliable without tests.    | Generate "ask your AI to fix" prompts they copy-paste.                            |
| Line-by-line annotations           | Vibe coders don't read code line-by-line. Line numbers are meaningless to them.                         | Reference code by what it DOES ("the login handler") not WHERE it is ("line 47"). |
| Numeric scores (0-100)             | False precision. LLMs cannot reliably distinguish 72 from 75. Letter grades have the right granularity. | A/B/C/D/F letter grades only.                                                     |
| Linter/static-analysis integration | "Expected semicolon" means nothing to a vibe coder. Adds setup complexity.                              | Let the LLM catch issues and explain in plain English.                            |
| IDE/editor embedding               | Vibe coders use Cursor/Replit, not VS Code. Standalone web app is more accessible.                      | Stay as web app.                                                                  |
| Multi-file project review (v1)     | Requires chunking, aggregation, context window management. Complex and slow on local Ollama.            | Review one file/snippet at a time. Defer to v2+.                                  |
| Before/after comparison (v1)       | Needs review storage, diffing, trend viz. Premature.                                                    | Reviews save to history for manual comparison. Defer to v2+.                      |
| Comparison to "ideal" code         | Implies user's code is "bad" -- discouraging. "Ideal" is subjective.                                    | Frame as improvements: "Here's how this could be even better."                    |

## Feature Dependencies

```
[Paste-and-review flow]
    |
    v
[Report card grading] --requires--> [Category-based review]
    |                                       |
    v                                       v
[Conversational deep-dive] --requires--> [Friendly-teacher tone in prompts]
    |
    v
["What to ask your AI to fix" suggestions]

[File upload] --feeds--> [Report card grading]
[GitHub clone] --feeds--> [Report card grading]

[Contextual jargon glossary] --enhances--> [All modes] (independent, add anytime)
[Beginner onboarding wizard] --independent--> (build anytime)
[Export review report] --requires--> [Report card grading]
```

## MVP Recommendation

Prioritize:

1. **Report card with structured grades** -- Without this, no Review mode exists.
2. **Deep-dive follow-up chat** -- Makes the report card actionable.
3. **Friendly-teacher tone for all modes** -- High impact, low effort. Changes entire product feel.
4. **"What to ask your AI to fix" prompts** -- Unique value for vibe coders.

Defer:

- **Beginner onboarding wizard**: Add after core review is validated.
- **Contextual jargon glossary**: Add incrementally based on user confusion signals.
- **Export review report**: Extend existing export after MVP.
- **Multi-file review / before-after comparison**: V2+ after single-file review is proven.

## Feature Prioritization Matrix

| Feature                              | User Value | Effort | Priority |
| ------------------------------------ | ---------- | ------ | -------- |
| Report card grading (Review mode)    | HIGH       | MEDIUM | P1       |
| Friendly-teacher tone (all modes)    | HIGH       | LOW    | P1       |
| Conversational deep-dive             | HIGH       | MEDIUM | P1       |
| "Ask your AI to fix" prompts         | HIGH       | LOW    | P1       |
| Reworked explain/bugs/refactor modes | HIGH       | LOW    | P1       |
| Top Priority callout                 | HIGH       | LOW    | P1       |
| Color-coded grade cards              | MEDIUM     | LOW    | P1       |
| Beginner onboarding wizard           | MEDIUM     | MEDIUM | P2       |
| Contextual jargon glossary           | MEDIUM     | MEDIUM | P2       |
| Export review report                 | MEDIUM     | LOW    | P2       |
| Before/after comparison              | MEDIUM     | HIGH   | P3       |
| Multi-file project review            | HIGH       | HIGH   | P3       |

## Competitive Positioning

The gap is NOT "another code review tool." The gap is a code review tool that **assumes zero coding knowledge** and **fits the vibe coder workflow** (generate with AI -> review here -> tell AI to fix).

- **Generic AI chatbots** (ChatGPT, Claude): Can review but produce unstructured text. Require prompt skill.
- **Developer review tools** (SonarQube, CodeRabbit): Assume the user IS the developer who will fix things.
- **Code Companion's niche**: The safety net between AI code generation and deployment, for people who will never write code manually.

_Note: Competitor analysis based on training data. LOW-MEDIUM confidence. Verify specific claims._

## Sources

- Codebase analysis: `lib/prompts.js`, `server.js`, `src/App.jsx`
- Ollama API docs (verified): structured output with JSON schema
- Domain knowledge from training data (MEDIUM confidence)
