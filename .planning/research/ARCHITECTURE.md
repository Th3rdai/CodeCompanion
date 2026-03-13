# Architecture Patterns

**Domain:** AI-powered code review with structured grading, integrated into existing chat-based LLM application
**Researched:** 2026-03-13

## Recommended Architecture

### High-Level Design: Two-Phase Review Flow

The Review mode follows a **structured-then-conversational** pattern:

1. **Phase 1 (Report Card):** User submits code. Backend makes a non-streaming `chatComplete` call with Ollama's `format` parameter set to a JSON schema. This guarantees well-formed structured output. The frontend renders a visual report card from the parsed JSON.

2. **Phase 2 (Deep Dive):** The report card JSON is injected into conversation context. User clicks a grade category or asks a follow-up question. This triggers a normal streaming SSE chat, with the report card as context. The LLM explains the grade in friendly-teacher tone.

This architecture cleanly separates the "grading" concern (needs structured data) from the "explaining" concern (needs freeform streaming text).

```
User submits code
       |
       v
  [Express /api/review]
       |
       v
  [chatComplete() with format: JSON_SCHEMA]  <-- Non-streaming, structured
       |
       v
  [Parse & validate JSON response]
       |
       v
  [Return report card JSON to frontend]
       |
       v
  [Frontend renders ReportCard component]
       |
       v
  User clicks grade category for deep dive
       |
       v
  [Normal /api/chat SSE stream with report card context]
       |
       v
  [Streaming conversational explanation]
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **ReviewService** (backend, `lib/review-service.js`) | Orchestrates review: builds prompt, calls Ollama with JSON schema, validates response, retries on parse failure | `ollama-client.js`, `prompts.js` |
| **ollama-client.js** (existing, extended) | New `chatCompleteStructured(url, model, messages, schema)` function that passes `format` param to Ollama | Ollama API |
| **prompts.js** (existing, extended) | New `review` system prompt + JSON schema definition for report card structure | Used by ReviewService |
| **POST /api/review-report** (new route) | Express endpoint that accepts code + model, returns structured report card JSON | ReviewService |
| **POST /api/chat** (existing) | Unchanged. Handles deep-dive follow-up conversations using existing SSE streaming | ollama-client.js |
| **ReviewPanel** (frontend, `src/components/ReviewPanel.jsx`) | Main Review mode container. Manages two sub-states: report card display and deep-dive chat | ReportCard, chat components |
| **ReportCard** (frontend, `src/components/ReportCard.jsx`) | Renders structured grades as visual cards with letter grades, color coding, progress bars | None (pure presentation) |
| **GradeCard** (frontend, `src/components/GradeCard.jsx`) | Single grade category tile. Clickable to trigger deep-dive on that category | ReviewPanel (via callback) |

### Data Flow

#### Step 1: Code Submission to Report Card

```
Frontend                    Express Server              Ollama
--------                    --------------              ------
POST /api/review-report  -->
  { model, code, filename }
                            Build review prompt
                            with JSON schema     -->
                            chatCompleteStructured()    POST /api/chat
                                                        { model, messages,
                                                          format: REPORT_SCHEMA,
                                                          stream: false }
                                                  <--   { message: { content: "{...}" } }
                            JSON.parse(response)
                            Validate against schema
                      <--   { reportCard: {...} }
Render ReportCard
```

#### Step 2: Deep-Dive Conversation

```
Frontend                    Express Server              Ollama
--------                    --------------              ------
User clicks "Bugs: C"
or types follow-up question

POST /api/chat           -->
  { model, mode: "review",
    messages: [
      { role: "user",
        content: "[code]" },
      { role: "assistant",
        content: "[report card summary]" },
      { role: "user",
        content: "Explain the bugs grade" }
    ] }
                            Use SYSTEM_PROMPTS.review
                            (friendly-teacher tone)
                            chatStream()          -->    POST /api/chat
                                                         { stream: true }
                      <--   SSE stream tokens     <--    streaming chunks
Render in chat area
```

### The Report Card Schema

This is the JSON schema passed to Ollama's `format` parameter. Ollama uses constrained decoding to guarantee the output matches this structure.

```javascript
const REPORT_CARD_SCHEMA = {
  type: "object",
  properties: {
    overallGrade: {
      type: "string",
      enum: ["A", "B", "C", "D", "F"]
    },
    summary: {
      type: "string",
      description: "2-3 sentence plain-English summary"
    },
    categories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            enum: ["Bugs", "Security", "Readability", "Completeness", "Performance"]
          },
          grade: {
            type: "string",
            enum: ["A", "B", "C", "D", "F"]
          },
          emoji: {
            type: "string"
          },
          finding: {
            type: "string",
            description: "One sentence finding in friendly language"
          },
          details: {
            type: "string",
            description: "2-3 sentence explanation"
          }
        },
        required: ["name", "grade", "finding", "details"]
      }
    },
    topPriority: {
      type: "string",
      description: "The single most important thing to fix, in plain English"
    }
  },
  required: ["overallGrade", "summary", "categories", "topPriority"]
};
```

**Why this schema shape:**
- `overallGrade` as enum constrains to valid letter grades -- no "B+" or "7/10" drift
- `categories` as array allows the frontend to map/render each grade card independently
- `finding` (one sentence) drives the card subtitle; `details` drives the deep-dive context
- `topPriority` gives the user one clear action item without reading every category
- Schema is deliberately flat -- Ollama's constrained decoding works most reliably with simple structures

**Confidence: HIGH** -- Ollama's `format` parameter with JSON schema is documented in official API docs (verified via raw GitHub docs). The `/api/chat` endpoint supports the same `format` parameter as `/api/generate`.

## Patterns to Follow

### Pattern 1: Structured-Then-Stream (Two-Call Pattern)

**What:** Make a non-streaming `chatComplete` call with JSON schema for structured data, then use standard streaming for follow-up conversation.

**When:** Any time you need machine-parseable data from the LLM that will also feed into a conversational flow.

**Why not stream structured output:** Streaming JSON is fragile. You would need to accumulate the full response before parsing. The UX is also wrong -- you cannot progressively render a report card from partial JSON. Better to show a loading spinner for 3-5 seconds, then reveal the complete report card.

**Example (backend):**

```javascript
// lib/ollama-client.js - new function
async function chatCompleteStructured(ollamaUrl, model, messages, schema, timeoutMs = 120000) {
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
        format: schema,  // Ollama's JSON schema support
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Ollama error: ${response.status}`);

    const data = await response.json();
    const content = data.message?.content || '';
    return JSON.parse(content);  // Already guaranteed valid JSON by Ollama
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}
```

### Pattern 2: Context Injection for Deep Dives

**What:** After generating the report card, serialize it as a readable summary and inject it as a prior assistant message in the conversation history. This gives the LLM context for follow-up questions without re-analyzing the code.

**When:** User clicks a grade category or asks a follow-up question about the review.

**Example (frontend message construction):**

```javascript
// When user clicks "Explain Bugs grade" on the report card
function buildDeepDiveMessages(originalCode, reportCard, question) {
  return [
    { role: 'user', content: `Review this code:\n\`\`\`\n${originalCode}\n\`\`\`` },
    { role: 'assistant', content: formatReportCardAsText(reportCard) },
    { role: 'user', content: question }
  ];
}

function formatReportCardAsText(reportCard) {
  let text = `## Code Report Card: ${reportCard.overallGrade}\n\n`;
  text += `${reportCard.summary}\n\n`;
  reportCard.categories.forEach(cat => {
    text += `**${cat.name}: ${cat.grade}** - ${cat.finding}\n`;
  });
  text += `\nTop priority: ${reportCard.topPriority}`;
  return text;
}
```

### Pattern 3: Graceful Schema Fallback

**What:** If Ollama returns malformed JSON despite the schema constraint (rare but possible with some models), fall back to prompt-based extraction rather than showing an error.

**When:** JSON parse fails on the structured response.

**Example:**

```javascript
async function getReportCard(ollamaUrl, model, code) {
  try {
    // Attempt 1: structured output with schema
    return await chatCompleteStructured(ollamaUrl, model, messages, REPORT_CARD_SCHEMA);
  } catch (parseErr) {
    // Attempt 2: plain chatComplete with strong prompt instructions
    const fallbackResponse = await chatComplete(ollamaUrl, model, [
      ...messages,
      { role: 'user', content: 'Respond ONLY with valid JSON matching the report card format. No other text.' }
    ]);

    // Try to extract JSON from the response
    const jsonMatch = fallbackResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);

    // Attempt 3: return a default "could not grade" report
    return buildDefaultReport('Unable to generate structured review. Try a different model.');
  }
}
```

### Pattern 4: Mode-Based Component Switching (Existing Pattern)

**What:** The app already switches between `CreateWizard`, `DashboardPanel`, and the chat interface based on `mode`. Review mode follows this same pattern.

**When:** Adding any new mode with custom UI.

**Example (in App.jsx):**

```jsx
{mode === 'review' ? (
  <ReviewPanel
    model={selectedModel}
    onAttachFile={attachFile}
    attachedFiles={attachedFiles}
    connected={connected}
  />
) : mode === 'create' ? (
  <CreateWizard ... />
) : mode === 'dashboard' ? (
  <DashboardPanel ... />
) : (
  // existing chat UI
)}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Streaming JSON for Report Cards

**What:** Attempting to stream the structured report card response and parse it progressively.

**Why bad:** Partial JSON is not parseable. You would need to buffer the entire response before rendering, defeating the purpose of streaming. The UX is also confusing -- a half-rendered report card with missing grades is worse than a 3-second loading spinner followed by a complete card.

**Instead:** Use non-streaming `chatComplete` with `format: schema`. Show a loading state with friendly messaging ("Grading your code...") while waiting.

### Anti-Pattern 2: Client-Side JSON Parsing of Freeform LLM Output

**What:** Sending a freeform prompt asking the LLM to "respond in JSON" and then parsing the result with regex or heuristics on the frontend.

**Why bad:** LLMs produce markdown-wrapped JSON (`\`\`\`json ... \`\`\``), add preamble text, or deviate from the expected schema. This leads to fragile parsing code and frequent failures.

**Instead:** Use Ollama's `format` parameter with a JSON schema. This uses constrained decoding at the model level, guaranteeing valid JSON that matches the schema. No parsing heuristics needed.

### Anti-Pattern 3: Separate Backend for Review

**What:** Creating a separate Express server or microservice for the review functionality.

**Why bad:** This app is a single-server application by design. Adding a separate service creates deployment complexity, CORS issues, and state synchronization problems. The existing architecture (single Express server, mode-based routing) handles this cleanly.

**Instead:** Add a new route (`/api/review-report`) and a new service module (`lib/review-service.js`) within the existing server.

### Anti-Pattern 4: Re-analyzing Code on Every Follow-up

**What:** Sending the full code back to Ollama on every deep-dive question, asking it to re-grade before answering.

**Why bad:** Doubles latency and token usage. The report card already contains the analysis -- the deep dive just needs to explain it.

**Instead:** Inject the report card as prior conversation context (Pattern 2 above). The LLM can reference its own prior analysis without re-running it.

## Build Order (Dependencies)

The components have clear dependency ordering:

### Layer 1: Backend Foundation (build first)

1. **Extend `ollama-client.js`** with `chatCompleteStructured()` -- adds `format` parameter support
2. **Define report card schema** in `lib/review-schemas.js`
3. **Add `review` system prompt** to `lib/prompts.js`

These have zero dependencies on frontend work and can be tested independently via curl.

### Layer 2: Backend Service

4. **Create `lib/review-service.js`** -- orchestrates prompt building, calls `chatCompleteStructured`, handles fallback
5. **Add `POST /api/review-report` route** in `server.js`

Depends on Layer 1. Can be tested with curl or Postman before any frontend exists.

### Layer 3: Frontend Report Card

6. **Create `GradeCard.jsx`** -- single grade tile component (pure presentation)
7. **Create `ReportCard.jsx`** -- assembles grade cards, shows overall grade, top priority
8. **Create `ReviewPanel.jsx`** -- manages review state machine: input -> loading -> report card -> deep dive

Depends on Layer 2 endpoint existing. GradeCard and ReportCard are pure components that can be developed with mock data.

### Layer 4: Integration

9. **Add `review` mode to `MODES` array** in `App.jsx`
10. **Wire `ReviewPanel` into mode switching** in `App.jsx`
11. **Connect deep-dive questions** to existing `/api/chat` SSE flow

Depends on all prior layers.

### Layer 5: Tone Rework (Independent Track)

12. **Update all system prompts** in `lib/prompts.js` for friendly-teacher vibe-coder tone
13. **Update mode labels/descriptions** in frontend `MODES` array

This is independent of the review feature and can be done in parallel or sequentially.

## Scalability Considerations

| Concern | Current (single user) | At 5-10 concurrent users | Notes |
|---------|----------------------|--------------------------|-------|
| Ollama response time for structured output | 3-8 seconds per report card | Queue contention, 10-30 seconds | Ollama processes one request at a time per model. Show clear loading states. |
| Report card generation timeout | 120s default is fine | Same | The schema constraint actually helps -- models produce shorter, more focused output. |
| Memory for conversation context | Negligible | Negligible | Report card JSON is small (~1KB). Conversation history is already managed per-session. |
| Frontend state for review mode | Simple -- one report card per session | Same | No cross-user state needed. Each user's review is independent. |

## Key Architectural Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Structured output mechanism | Ollama `format` parameter with JSON schema | Native constrained decoding. No regex parsing. Documented in official API. |
| Report card delivery | Non-streaming POST returning JSON | Cannot meaningfully stream partial report cards. 3-5s wait with loading state is better UX. |
| Deep-dive mechanism | Existing SSE streaming via `/api/chat` | Reuses existing infrastructure. Report card injected as conversation context. |
| Review mode architecture | New panel component (like DashboardPanel) | Follows existing mode-switching pattern in App.jsx. |
| Backend organization | New service module + route, not new server | Matches existing single-server architecture. |
| Fallback for schema failures | Three-tier: schema -> prompt-only -> default report | Graceful degradation. User always sees something useful. |

## Sources

- Ollama API documentation (verified via raw GitHub: `github.com/ollama/ollama/blob/main/docs/api.md`): `format` parameter supports both `"json"` and full JSON schema objects on both `/api/generate` and `/api/chat` endpoints. Confidence: HIGH.
- Existing codebase analysis: `server.js`, `lib/ollama-client.js`, `lib/prompts.js`, `src/App.jsx`. The `chatComplete` function already calls Ollama with `stream: false`, making the structured output extension minimal.
- Existing `POST /api/git/review` route (server.js lines 704-745) already demonstrates the pattern of non-streaming LLM calls for code review, but uses freeform text. The new approach replaces this with schema-constrained output.
