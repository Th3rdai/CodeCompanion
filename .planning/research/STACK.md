# Stack Research

**Domain:** AI-powered code review with structured grading for beginner users
**Researched:** 2026-03-13
**Confidence:** MEDIUM-HIGH (Ollama structured output verified via official API docs on GitHub; existing deps verified from codebase)

## Existing Stack (Do Not Change)

These are already in the project and working. Listed for context only.

| Technology                  | Version  | Purpose             |
| --------------------------- | -------- | ------------------- |
| Express                     | ^4.18.2  | REST API backend    |
| React                       | ^19.2.4  | Frontend UI         |
| Vite                        | ^7.3.1   | Build tool          |
| Tailwind CSS                | ^4.2.1   | Styling             |
| marked                      | ^17.0.4  | Markdown rendering  |
| highlight.js                | ^11.11.1 | Syntax highlighting |
| zod                         | ^4.3.6   | Schema validation   |
| @modelcontextprotocol/sdk   | ^1.27.1  | MCP integration     |
| lucide-react                | ^0.577.0 | Icons               |
| uuid                        | ^9.0.0   | ID generation       |
| clsx + tailwind-merge + cva | various  | CSS utilities       |

## Recommended Stack for Review Mode

### Core Technologies

| Technology                                 | Version                    | Purpose                                       | Why Recommended                                                                                                                                                                                                                                                                 |
| ------------------------------------------ | -------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ollama `format` parameter with JSON Schema | (API feature, Ollama 0.5+) | Structured JSON output from LLM               | Ollama's `/api/chat` endpoint accepts a `format` field with a full JSON Schema object (not just `"json"`). This constrains the model via constrained decoding to output valid JSON matching the schema. **Verified from official Ollama API docs on GitHub.** Confidence: HIGH. |
| Zod (already installed)                    | ^4.3.6                     | Validate LLM output server-side               | Already in `package.json`. Use as safety net after Ollama's schema-constrained output.                                                                                                                                                                                          |
| zod-to-json-schema                         | ^3.24                      | Convert Zod schemas to JSON Schema for Ollama | Bridges Zod definitions to Ollama's `format` parameter. Single source of truth for both validation and LLM constraint. Lightweight. **Confidence: MEDIUM** -- verify Zod v4 compat at install time.                                                                             |

### Supporting Libraries (Optional, Defer to Polish Phase)

| Library       | Version | Purpose                         | When to Use                                                                                                                                                    |
| ------------- | ------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| recharts      | ^2.15   | Visual grade charts (radar/bar) | Only if text-only grade cards feel insufficient. Letter grades with color coding (A=green, F=red) work without any chart library for MVP. Add in polish phase. |
| framer-motion | ^12     | Animated grade reveals          | Only if the existing 3D aesthetic demands motion. CSS transitions handle basic fade-in. Defer unless visual consistency requires it.                           |

### Backend Additions (No New Dependencies for Core Feature)

| Capability              | Implementation                                       | Notes                                                                      |
| ----------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| Structured Ollama calls | New `chatCompleteStructured()` in `ollama-client.js` | Passes JSON Schema via `format` param. Non-streaming. Returns parsed JSON. |
| Report card schema      | New module `lib/review-schemas.js`                   | Zod schema + JSON Schema export via zod-to-json-schema.                    |
| Review orchestration    | New module `lib/review-service.js`                   | Builds prompt, calls structured endpoint, validates, handles fallback.     |
| Review API endpoint     | New `POST /api/review-report` in `server.js`         | Separate from `/api/chat`. Returns JSON, not SSE stream.                   |

## How Structured Output Works with Ollama

The key architectural discovery: Ollama supports not just `format: "json"` (generic JSON) but `format: { type: "object", properties: {...} }` with a full JSON Schema. This uses constrained decoding at the model level -- the model literally cannot produce output that violates the schema.

**Verified from Ollama API docs (raw GitHub):**

```
Advanced parameters (optional):
- `format`: the format to return a response in. Format can be `json` or a JSON schema
```

And from the structured output example:

```json
{
  "model": "llama3.1:8b",
  "prompt": "...",
  "stream": false,
  "format": {
    "type": "object",
    "properties": {
      "age": { "type": "integer" },
      "available": { "type": "boolean" }
    },
    "required": ["age", "available"]
  }
}
```

**This is the approach to use.** The response content is guaranteed valid JSON matching the schema. No regex parsing, no post-hoc extraction, no hoping the model follows instructions.

**Implementation in ollama-client.js:**

```javascript
async function chatCompleteStructured(
  ollamaUrl,
  model,
  messages,
  schema,
  timeoutMs = 120000,
) {
  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      format: schema, // Full JSON Schema object
      stream: false,
    }),
  });
  if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
  const data = await response.json();
  return JSON.parse(data.message?.content || "{}");
}
```

**Zod schema for report card:**

```javascript
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");

const ReviewCategory = z.object({
  name: z.enum([
    "Bugs",
    "Security",
    "Readability",
    "Completeness",
    "Performance",
  ]),
  grade: z.enum(["A", "B", "C", "D", "F"]),
  finding: z.string(),
  details: z.string(),
});

const ReportCard = z.object({
  overallGrade: z.enum(["A", "B", "C", "D", "F"]),
  summary: z.string(),
  categories: z.array(ReviewCategory),
  topPriority: z.string(),
});

const reportCardJsonSchema = zodToJsonSchema(ReportCard);
// Pass reportCardJsonSchema as the `format` parameter to Ollama
```

**Why this approach (not alternatives):**

1. Ollama enforces the schema at generation time -- no post-hoc parsing failures
2. Zod validates on the server as a safety net for edge cases
3. The frontend receives a guaranteed-shape object
4. Schema is defined once (Zod), used for LLM constraint (JSON Schema) + validation (Zod)

**Important:** Structured output with `format` disables streaming. This is correct for review -- the report card must arrive complete. The subsequent conversational deep-dive uses streaming normally.

## Installation

```bash
# Only one new dependency needed for core feature
npm install zod-to-json-schema

# Optional polish-phase dependencies
# npm install recharts framer-motion
```

## Alternatives Considered

| Recommended                      | Alternative                            | Why Not                                                                                                                                                               |
| -------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ollama `format` with JSON Schema | `format: "json"` (generic)             | Generic JSON mode does not constrain structure. Model might output `{"answer": "code is fine"}` instead of the report card shape. Full schema constrains every field. |
| Ollama `format` with JSON Schema | Prompt-only JSON extraction with regex | Fragile. Local models wrap JSON in markdown fences, add commentary, hallucinate extra fields. Schema-constrained decoding eliminates all of this.                     |
| `zod-to-json-schema`             | Hand-write JSON Schema                 | Zod already in project. Hand-written schemas drift from validation logic. Single source of truth is better.                                                           |
| Zod validation (safety net)      | No validation                          | Schema-constrained output is reliable but not infallible. Small models may still produce unexpected results. Belt-and-suspenders.                                     |
| Text-only grade cards (MVP)      | recharts radar/bar charts              | Ship faster. Letter grades with Tailwind color classes are simpler, lighter, and sufficient for MVP. Charts are polish.                                               |
| CSS transitions (MVP)            | framer-motion animations               | Ship faster. The report card is a reveal, not a data visualization. CSS handles this fine.                                                                            |

## What NOT to Use

| Avoid                      | Why                                                                              | Use Instead                                       |
| -------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------- |
| LangChain.js               | Massive dependency for what is a single `fetch` call. Ollama client is 80 lines. | Direct Ollama API via existing `ollama-client.js` |
| OpenAI SDK / Anthropic SDK | Project is Ollama-only. Cloud APIs break local-first architecture.               | Ollama REST API                                   |
| ESLint / static analysis   | Adds massive complexity. The LLM IS the analyzer for this audience.              | Ollama LLM analysis via structured prompts        |
| JSON5 / relaxed parsers    | Masks broken output. With `format: schema`, output is valid by construction.     | Ollama structured output + Zod validation         |
| D3.js directly             | Low-level, requires imperative React code.                                       | recharts (if charts needed) or text-only cards    |

## Fallback Strategy (Model Capability Tiers)

Not all models handle structured output equally well.

**If the model does not support `format` with JSON Schema (older Ollama versions):**

1. Fall back to `format: "json"` (generic JSON mode)
2. Include the desired structure in the system prompt
3. Validate with Zod; if invalid, retry once
4. If still invalid, display raw markdown response as fallback

**If the model is very small (< 7B params):**

1. Show a gentle warning: "Smaller models work great for chat, but code review works best with 7B+ parameter models"
2. Use simpler schema (fewer fields) to reduce model confusion
3. Lower temperature (`options: { temperature: 0.3 }`) for more deterministic output

## Version Compatibility

| Package                     | Compatible With          | Notes                                                                                                          |
| --------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| zod ^4.3.6                  | zod-to-json-schema ^3.24 | Verify Zod v4 support at install time. If incompatible, pin zod-to-json-schema to a compatible version.        |
| Ollama structured output    | Ollama 0.5.0+            | `format` with JSON Schema introduced in 0.5. Earlier versions only support `format: "json"`. Check at runtime. |
| recharts ^2.15 (if used)    | React ^19.2.4            | recharts 2.13+ reported React 19 compatible. MEDIUM confidence.                                                |
| framer-motion ^12 (if used) | React ^19.2.4            | v12 added React 19 support. MEDIUM confidence.                                                                 |

## Sources

- Ollama API documentation: **Verified** via raw GitHub (`github.com/ollama/ollama/blob/main/docs/api.md`). The `format` parameter accepts both `"json"` and full JSON Schema objects on `/api/generate` and `/api/chat`. Constrained decoding confirmed in examples. Confidence: HIGH.
- Existing codebase: `ollama-client.js` verified current API call patterns. `package.json` verified dependency versions.
- zod-to-json-schema: Training data. MEDIUM confidence -- verify compatibility at install.
- recharts, framer-motion: Training data. MEDIUM confidence -- optional, defer.
