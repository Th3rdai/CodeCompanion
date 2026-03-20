# Phase 1: Review Engine - Research

**Researched:** 2026-03-13
**Domain:** Ollama structured output API, Express endpoint design, report card schema
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Review Prompt Tone: Protective parent** — prioritize safety warnings. "This could cause real problems if you ship it" over "Nice work, one small thing..."
- **Analogies: For serious issues only** — use everyday analogies for critical/high-severity findings (e.g., "leaving your front door unlocked" for security). Plain language without analogies for minor findings
- **Technical terms: Always explain** — when a technical term is unavoidable, include the term plus a full parenthetical explanation: "SQL injection (when someone tricks your app into running commands on your database)"
- **Finding detail length: Claude's discretion** — adjust length based on severity. Short (2-3 sentences) for minor issues, longer (paragraph with analogy + action) for critical issues
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REVW-01 | User can paste code and receive a report card with letter grades (A-F) for bugs, security, readability, and completeness | Ollama `format` parameter with JSON Schema enforces report card structure; new `/api/review` endpoint receives code |
| REVW-02 | Report card shows an overall grade summarizing code quality | JSON Schema includes `overallGrade` field; grading rubric in system prompt |
| REVW-03 | Report card highlights a "Top Priority" — the single most important thing to fix first | JSON Schema includes `topPriority` object with `category`, `title`, `explanation` fields |
| REVW-04 | Each category shows plain-English findings with zero jargon | System prompt enforces protective-parent tone with analogy rules from CONTEXT.md |
</phase_requirements>

## Summary

Phase 1 builds a new `/api/review` endpoint on the existing Express server that accepts code and returns a structured JSON report card via Ollama's constrained decoding. The existing codebase already has `chatComplete` (non-streaming) and `chatStream` functions in `lib/ollama-client.js`, plus system prompts in `lib/prompts.js`. The new endpoint will use `chatComplete` with the `format` parameter set to a JSON Schema object.

The critical technical finding is that Ollama structured outputs work reliably with `stream: false` but have known issues with `stream: true`. Since the review endpoint needs guaranteed schema compliance, it MUST use non-streaming mode (`chatComplete`). The fallback to chat mode on failure (a locked decision) will use the existing streaming path.

Zod v4 (already installed at `^4.3.6`) has native `z.toJSONSchema()` support, eliminating the need for `zod-to-json-schema`. This is the recommended approach for defining the report card schema.

**Primary recommendation:** Add a new `chatStructured` function to `lib/ollama-client.js` that wraps `chatComplete` with the `format` parameter, define the report card schema with Zod v4 + `z.toJSONSchema()`, and create a `/api/review` POST endpoint that orchestrates the call with proper fallback behavior.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^4.18.2 | HTTP server (already installed) | Existing stack |
| zod | ^4.3.6 | Schema definition + validation (already installed) | Native `z.toJSONSchema()` replaces `zod-to-json-schema`; already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | — | — | All dependencies already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zod `z.toJSONSchema()` | Hand-written JSON Schema | Zod provides runtime validation + schema generation in one place; hand-written is error-prone |
| `zod-to-json-schema` | Zod v4 native | `zod-to-json-schema` is incompatible with Zod v4; use native `z.toJSONSchema()` instead |

**Installation:**
```bash
# No new packages needed — zod ^4.3.6 already installed
```

## Architecture Patterns

### Recommended Changes to Existing Structure
```
lib/
├── ollama-client.js     # ADD: chatStructured(url, model, messages, schema, opts)
├── prompts.js           # ADD: REVIEW_SYSTEM_PROMPT, REVIEW_FALLBACK_PROMPT
├── review-schema.js     # NEW: Zod schema + JSON Schema export for report card
└── review.js            # NEW: reviewCode(ollamaUrl, model, code, opts) orchestrator
server.js                # ADD: POST /api/review endpoint
```

### Pattern 1: Structured Output with Format Parameter
**What:** Pass a JSON Schema object as the `format` parameter to Ollama's `/api/chat` endpoint with `stream: false`
**When to use:** Any time you need guaranteed JSON structure from the LLM
**Example:**
```javascript
// Ollama /api/chat with structured output
const response = await fetch(`${ollamaUrl}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model,
    messages,
    format: jsonSchema,  // JSON Schema object (NOT "json" string)
    stream: false,
    options: { temperature: 0 }
  })
});
const data = await response.json();
const reportCard = JSON.parse(data.message.content);
```

### Pattern 2: Zod v4 Native JSON Schema
**What:** Define schema with Zod, generate JSON Schema with `z.toJSONSchema()`, validate response with `.parse()`
**When to use:** When you need both schema generation for Ollama and runtime validation
**Example:**
```javascript
import { z } from 'zod';

const ReportCardSchema = z.object({
  overallGrade: z.string(),
  categories: z.object({
    bugs: z.object({ grade: z.string(), findings: z.array(z.object({ ... })) }),
    // ...
  }),
  topPriority: z.object({ ... })
});

// Generate JSON Schema for Ollama format parameter
const jsonSchema = z.toJSONSchema(ReportCardSchema);

// Validate response
const validated = ReportCardSchema.parse(JSON.parse(llmResponse));
```

### Pattern 3: Graceful Fallback to Chat Mode
**What:** If structured output fails (parse error, validation error, timeout), fall back to streaming chat with a modified prompt
**When to use:** Locked decision from CONTEXT.md — always implement this fallback
**Example:**
```javascript
async function reviewCode(ollamaUrl, model, code) {
  try {
    const result = await chatStructured(ollamaUrl, model, messages, schema);
    return { type: 'report-card', data: result };
  } catch (err) {
    // Fallback: stream a conversational review instead
    return { type: 'chat-fallback', stream: chatStream(ollamaUrl, model, fallbackMessages) };
  }
}
```

### Anti-Patterns to Avoid
- **Using `format: "json"` instead of full schema:** The string `"json"` only ensures valid JSON, not the correct structure. Always use the full JSON Schema object.
- **Streaming with structured output:** `stream: true` + `format: {schema}` has known reliability issues. Use `stream: false` for the structured call.
- **Skipping Zod validation after parse:** Even with constrained decoding, always validate with `ReportCardSchema.parse()` — the LLM could produce valid JSON that violates semantic constraints.
- **Building schema by hand:** Use Zod as single source of truth for both validation and schema generation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema generation | Manual schema objects | `z.toJSONSchema(ZodSchema)` | Schema stays in sync with validation; less error-prone |
| Response validation | Manual field checking | `ZodSchema.parse(data)` | Type-safe, descriptive errors, handles edge cases |
| Grade validation | String comparison | `z.enum(['A', 'B', 'C', 'D', 'F'])` | Zod enforces allowed values at parse time |

**Key insight:** Zod v4 is already installed and provides both schema generation and validation — using it eliminates an entire class of schema-drift bugs.

## Common Pitfalls

### Pitfall 1: Streaming + Structured Output Incompatibility
**What goes wrong:** Using `stream: true` with `format: {schema}` produces unreliable output — schema may not be enforced, chunks may be malformed.
**Why it happens:** Ollama's constrained decoding works at the full-response level, not per-token.
**How to avoid:** Always use `stream: false` for structured output calls. The review endpoint should use `chatComplete`-style (non-streaming) requests.
**Warning signs:** Partial JSON in response, missing required fields, response cut off mid-object.

### Pitfall 2: Zod v4 `z.toJSONSchema()` vs `zod-to-json-schema`
**What goes wrong:** `zod-to-json-schema` package throws import errors with Zod v4 (`ZodFirstPartyTypeKind doesn't exist`).
**Why it happens:** Zod v4 changed internal APIs that `zod-to-json-schema` depended on.
**How to avoid:** Use Zod v4's native `z.toJSONSchema(schema)` — do NOT install `zod-to-json-schema`.
**Warning signs:** Build errors referencing `ZodFirstPartyTypeKind`.

### Pitfall 3: LLM Producing Valid JSON That Fails Semantic Validation
**What goes wrong:** Ollama returns JSON matching the schema shape but with nonsensical content (e.g., grade "X", empty findings arrays, copy-pasted schema field names as values).
**Why it happens:** Small models lack the capacity for reliable structured output; even large models occasionally hallucinate field values.
**How to avoid:** Always validate with Zod `.parse()` after JSON.parse(). Implement the chat fallback for validation failures.
**Warning signs:** Grades outside A-F range, findings with no meaningful content, repeated boilerplate text.

### Pitfall 4: System Prompt Must Describe the Schema
**What goes wrong:** Model produces technically valid but semantically poor output when only the `format` parameter constrains it.
**Why it happens:** The `format` parameter constrains structure, but the system prompt constrains meaning. Without prompt guidance, the model fills in the schema mechanically.
**How to avoid:** Include the schema description in natural language in the system prompt. Ollama docs explicitly recommend this: "It is ideal to also pass the JSON schema as a string in the prompt to ground the model's response."
**Warning signs:** Grammatically correct but meaningless findings, generic placeholder text.

### Pitfall 5: Timeout on Large Code Inputs
**What goes wrong:** Non-streaming structured output with large code blocks takes a long time, especially with smaller models.
**Why it happens:** `stream: false` means the entire response must be generated before returning. Large inputs = more processing time.
**How to avoid:** Implement model-size-aware timeout thresholds. Small models (<7B): 60s. Medium (7-14B): 120s. Large (>14B): 180s. The existing `chatComplete` already accepts a `timeoutMs` parameter.
**Warning signs:** AbortController timeout errors, no response for extended periods.

## Code Examples

### Report Card Zod Schema (Recommended Design)
```javascript
const { z } = require('zod');

const GradeEnum = z.enum(['A', 'B', 'C', 'D', 'F']);

const FindingSchema = z.object({
  title: z.string().describe('Short name for the issue'),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  explanation: z.string().describe('Plain-English explanation, no jargon'),
  analogy: z.string().optional().describe('Everyday analogy for critical/high severity only'),
});

const CategorySchema = z.object({
  grade: GradeEnum,
  summary: z.string().describe('One-sentence category summary'),
  findings: z.array(FindingSchema),
});

const ReportCardSchema = z.object({
  overallGrade: GradeEnum.describe('Overall code quality grade'),
  topPriority: z.object({
    category: z.string(),
    title: z.string(),
    explanation: z.string().describe('Why this is the #1 thing to fix, plain English'),
  }).describe('The single most important thing to fix'),
  categories: z.object({
    bugs: CategorySchema,
    security: CategorySchema,
    readability: CategorySchema,
    completeness: CategorySchema,
  }),
});

// For Ollama format parameter:
const reportCardJsonSchema = z.toJSONSchema(ReportCardSchema);
```

### chatStructured Function (New Addition to ollama-client.js)
```javascript
async function chatStructured(ollamaUrl, model, messages, jsonSchema, timeoutMs = 120000) {
  const url = `${ollamaUrl}/api/chat`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        format: jsonSchema,
        stream: false,
        options: { temperature: 0 }
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return JSON.parse(data.message?.content || '{}');
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}
```

### Review Endpoint Pattern
```javascript
app.post('/api/review', async (req, res) => {
  const { model, code, filename } = req.body;
  if (!model || !code) return res.status(400).json({ error: 'Missing model or code' });

  const config = getConfig();
  const messages = [
    { role: 'system', content: REVIEW_SYSTEM_PROMPT },
    { role: 'user', content: `Review this code:\n\n\`\`\`\n${code}\n\`\`\`` }
  ];

  try {
    const result = await chatStructured(
      config.ollamaUrl, model, messages,
      reportCardJsonSchema,
      getTimeoutForModel(model)
    );
    const validated = ReportCardSchema.parse(result);
    res.json({ type: 'report-card', data: validated });
  } catch (err) {
    // Fallback to chat mode (locked decision)
    // Set up SSE and stream conversational review
    res.setHeader('Content-Type', 'text/event-stream');
    // ... stream fallback response
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `format: "json"` (unstructured) | `format: {jsonSchema}` (constrained) | Ollama 0.5.0+ (2024) | Guaranteed output structure, not just valid JSON |
| `zod-to-json-schema` package | `z.toJSONSchema()` native | Zod v4 (2025) | No external dependency, better compatibility |
| Streaming + post-parse | Non-streaming structured output | Ongoing (2025) | Reliable schema enforcement requires `stream: false` |

**Deprecated/outdated:**
- `zod-to-json-schema`: Incompatible with Zod v4, replaced by native `z.toJSONSchema()`
- `format: "json"` (string): Still works but provides no schema enforcement; use full schema object

## Open Questions

1. **Ollama version at HOST_IP:11424**
   - What we know: Must be 0.5.0+ for JSON Schema `format` support
   - What's unclear: Actual installed version
   - Recommendation: Add version check to `/api/review` endpoint startup or first call; fail gracefully with clear error if < 0.5.0

2. **Which models are available and their structured output quality**
   - What we know: Small models (<7B) have LOW confidence for structured output quality
   - What's unclear: Which specific models are installed on the target Ollama instance
   - Recommendation: The endpoint should work with any model; quality warnings are Phase 4 (UX-05)

3. **`z.toJSONSchema()` output compatibility with Ollama**
   - What we know: Zod v4 generates standard JSON Schema; Ollama accepts JSON Schema in `format`
   - What's unclear: Whether Ollama handles all JSON Schema features Zod v4 might emit (e.g., `$ref`, `$defs`)
   - Recommendation: Test the generated schema with a simple call during development; if needed, simplify the schema to avoid advanced features

## Sources

### Primary (HIGH confidence)
- [Ollama Structured Outputs Docs](https://docs.ollama.com/capabilities/structured-outputs) — format parameter syntax, examples, best practices
- [Ollama API Reference](https://github.com/ollama/ollama/blob/main/docs/api.md) — endpoint parameters, streaming behavior
- [Zod v4 Release Notes](https://zod.dev/v4) — native `z.toJSONSchema()` support

### Secondary (MEDIUM confidence)
- [Ollama Structured Outputs Blog](https://ollama.com/blog/structured-outputs) — JavaScript/Zod integration examples
- [zod-to-json-schema incompatibility issue](https://github.com/vercel/ai/issues/7189) — confirmed Zod v4 breaking changes

### Tertiary (LOW confidence)
- [Ollama streaming + structured output issue #14440](https://github.com/ollama/ollama/issues/14440) — streaming reliability concerns (needs validation with current Ollama version)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing dependencies, well-documented APIs
- Architecture: HIGH — clear pattern (non-streaming structured call + fallback), follows existing codebase conventions
- Pitfalls: HIGH — streaming incompatibility well-documented, Zod v4 migration path clear

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (30 days — stable domain, unlikely to change rapidly)
