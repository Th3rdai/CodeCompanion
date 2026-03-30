# Phase 1: Review Engine - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend endpoint that accepts code and returns a structured report card with letter grades (A-F) for bugs, security, readability, and completeness. Includes overall grade, Top Priority callout, and plain-English findings. Uses Ollama's `format` parameter with JSON Schema for constrained decoding. No UI work — this phase is verifiable via curl.

</domain>

<decisions>
## Implementation Decisions

### Review Prompt Tone

- **Framing: Protective parent** — prioritize safety warnings. "This could cause real problems if you ship it" over "Nice work, one small thing..."
- **Analogies: For serious issues only** — use everyday analogies for critical/high-severity findings (e.g., "leaving your front door unlocked" for security). Plain language without analogies for minor findings
- **Technical terms: Always explain** — when a technical term is unavoidable, include the term plus a full parenthetical explanation: "SQL injection (when someone tricks your app into running commands on your database)"
- **Finding detail length: Claude's discretion** — adjust length based on severity. Short (2-3 sentences) for minor issues, longer (paragraph with analogy + action) for critical issues

### Fallback Behavior

- **Bad/incomplete LLM output: Fallback to chat mode** — if structured JSON parsing fails, don't show an error wall. Instead, fall back to streaming chat mode: "Grading didn't work, but I can still explain your code." The user still gets value
- **Small model warning: Warn first, then try** — show a gentle pre-review warning when a small model is selected ("This model may not give accurate grades. Consider using a bigger model.") but let them proceed. If structured output fails, trigger the chat fallback
- **Timeout handling: Claude's discretion** — pick appropriate timeout behavior based on model size and context
- **Clean code (no issues): All A's + celebration** — show all A grades with brief notes on what's good per category, plus a "clean bill of health" banner with encouragement at the top

### Claude's Discretion

- Grading rubric specifics (what constitutes A vs C vs F per category)
- Report card JSON schema field design
- Exact number of findings per category
- System prompt engineering for consistent structured output
- Timeout thresholds per model size

</decisions>

<specifics>
## Specific Ideas

- The protective-parent tone should feel like "I want to make sure this is safe for you to use" not "your code is bad"
- Analogies should be relatable to everyday life, not to other technical concepts
- The chat fallback on failure is important — the user should never hit a dead end with no value

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 01-review-engine_
_Context gathered: 2026-03-13_
