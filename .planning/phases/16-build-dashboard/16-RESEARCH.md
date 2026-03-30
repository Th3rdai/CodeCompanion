# Phase 16: Build Dashboard (Phases 2-5) - Research

**Researched:** 2026-03-15
**Domain:** React dashboard UI, Express SSE endpoints, Ollama AI integration, file editing with security
**Confidence:** HIGH

## Summary

Phase 16 Phases 2-5 extend the existing Build Dashboard (Phase 1 already complete with registry, GSD bridge, and BuildPanel) into a full project management interface. The work divides cleanly into four sub-phases: Simple View (status header + "What's Next" AI card), AI Research/Planning (SSE endpoints that call Ollama for research and planning), Advanced View (phase accordion with file viewer/editor), and Handoff + Polish (Claude Code command generation, UX improvements).

The existing codebase provides strong foundations: `lib/gsd-bridge.js` for reading project state, `lib/ollama-client.js` with `chatComplete`/`chatStructured`/`chatStream` functions, and established SSE patterns in the `/api/chat`, `/api/review`, and `/api/score` endpoints. The `BuildPanel.jsx` component already has project list, dashboard, and phase detail views with auto-refresh. All new work builds on these patterns -- no new libraries needed.

**Primary recommendation:** Use the existing `chatComplete` for the next-action endpoint (Phase 2), add SSE streaming via `chatStream` for research/planning endpoints (Phase 3), add file read/write endpoints with strict filename whitelist (Phase 4), and generate copy-pasteable GSD slash commands for Claude Code handoff (Phase 5).

## Standard Stack

### Core (Already in Project)

| Library         | Version | Purpose       | Why Standard                                                             |
| --------------- | ------- | ------------- | ------------------------------------------------------------------------ |
| React 18        | ^18     | UI components | Already used throughout                                                  |
| Express         | ^4      | API server    | Already used, all routes follow same pattern                             |
| Tailwind CSS    | ^3      | Styling       | Already used, glass/neon design system in place                          |
| Ollama REST API | v0.5+   | AI responses  | `chatComplete`, `chatStructured`, `chatStream` in `lib/ollama-client.js` |
| Lucide React    | ^0.400  | Icons         | Project convention per ui-ux-pro-max skill (no emojis)                   |

### Supporting (Already in Project)

| Library   | Version | Purpose            | When to Use                                          |
| --------- | ------- | ------------------ | ---------------------------------------------------- |
| marked    | ^12     | Markdown rendering | MarkdownContent component already used in BuildPanel |
| DOMPurify | ^3      | HTML sanitization  | Already integrated in MarkdownContent                |

### Alternatives Considered

| Instead of                    | Could Use                | Tradeoff                                                                                                 |
| ----------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| Custom file editor            | CodeMirror/Monaco        | Overkill for viewing/editing planning markdown files -- plain textarea with monospace font is sufficient |
| WebSocket for streaming       | SSE (Server-Sent Events) | SSE is the project standard; every AI endpoint uses it                                                   |
| React Query for data fetching | Manual fetch + useState  | Project convention is manual fetch; adding React Query for one panel creates inconsistency               |

**Installation:** No new packages required.

## Architecture Patterns

### Recommended Component Structure

```
src/components/
  BuildPanel.jsx           # EXISTING — add view routing for simple/advanced
  BuildHeader.jsx          # NEW — status badge, progress bar, simple/advanced toggle
  BuildSimpleView.jsx      # NEW — "What's Next" AI card, quick action buttons
  BuildAdvancedView.jsx    # NEW — phase accordion, file viewer
  PlanningFileViewer.jsx   # NEW — read/edit .planning/ files with save
  ClaudeCodeHandoff.jsx    # NEW — copy-pasteable GSD commands
```

### Pattern 1: View Toggle in BuildPanel

**What:** BuildPanel already has `view` state (`list`, `dashboard`, `phase`). Extend with `viewMode` state for simple vs advanced toggle within the dashboard view.
**When to use:** When user switches between Simple View and Advanced View.
**Example:**

```jsx
// In BuildPanel.jsx — add viewMode alongside existing view state
const [viewMode, setViewMode] = useState(() => {
  return localStorage.getItem('cc_build_view_mode') || 'simple';
});

// Persist toggle
const toggleViewMode = (mode) => {
  setViewMode(mode);
  localStorage.setItem('cc_build_view_mode', mode);
};

// In dashboard view rendering:
{viewMode === 'simple' ? (
  <BuildSimpleView project={currentProject} projectData={projectData} ... />
) : (
  <BuildAdvancedView project={currentProject} projectData={projectData} ... />
)}
```

### Pattern 2: SSE Endpoint for AI Operations (Phase 3)

**What:** POST endpoint that streams AI response via SSE, following the exact pattern of `/api/chat` and `/api/review`.
**When to use:** For research and planning endpoints that call Ollama.
**Example:**

```javascript
// In server.js — follows existing /api/chat SSE pattern exactly
app.post("/api/build/projects/:id/research", async (req, res) => {
  const project = _resolveBuildProject(req, res);
  if (!project) return;

  const { model, phaseNumber } = req.body;
  const config = getConfig();
  const bridge = new GsdBridge(project.path);

  // Gather context from project files
  const state = bridge.getState();
  const roadmap = bridge.getRoadmap();

  // Set up SSE (same as /api/chat)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  function sendEvent(data) {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  // Build messages and call chatStream or chatComplete
  const messages = [
    {
      role: "system",
      content: buildResearchPrompt(state, roadmap, phaseNumber),
    },
    { role: "user", content: `Research phase ${phaseNumber} for planning.` },
  ];

  try {
    // Use chatComplete for structured output, then stream result
    const result = await chatComplete(
      config.ollamaUrl,
      model,
      messages,
      180000,
    );
    // Send as SSE tokens for progressive display
    const words = result.split(/(\s+)/);
    for (const word of words) {
      sendEvent({ token: word });
    }
    sendEvent({ done: true });
  } catch (err) {
    sendEvent({ error: err.message });
  }
  res.write("data: [DONE]\n\n");
  res.end();
});
```

### Pattern 3: File Whitelist Security (Phase 4)

**What:** Only allow reading/writing specific `.planning/` files by filename, not arbitrary paths.
**When to use:** For the file viewer/editor endpoints.
**Example:**

```javascript
// Strict whitelist of editable planning files
const PLANNING_FILE_WHITELIST = [
  "ROADMAP.md",
  "REQUIREMENTS.md",
  "STATE.md",
  "CONTEXT.md",
  "PROJECT.md",
  "config.json",
];

app.get("/api/build/projects/:id/files/:filename", (req, res) => {
  const project = _resolveBuildProject(req, res);
  if (!project) return;

  const { filename } = req.params;
  if (!PLANNING_FILE_WHITELIST.includes(filename)) {
    return res.status(403).json({ error: "File not in whitelist" });
  }

  const filePath = path.join(project.path, ".planning", filename);
  // Use isWithinBasePath for additional path traversal protection
  if (!isWithinBasePath(path.join(project.path, ".planning"), filePath)) {
    return res.status(403).json({ error: "Path traversal detected" });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }
  res.json({ content: fs.readFileSync(filePath, "utf-8") });
});
```

### Pattern 4: Next Action AI Card (Phase 2)

**What:** A single non-streaming endpoint that returns a short AI-generated "What's Next" recommendation based on project state.
**When to use:** For the Simple View's primary card.
**Example:**

```javascript
app.post("/api/build/projects/:id/next-action", async (req, res) => {
  const project = _resolveBuildProject(req, res);
  if (!project) return;

  const { model } = req.body;
  const config = getConfig();
  const bridge = new GsdBridge(project.path);

  const state = bridge.getState();
  const progress = bridge.getProgress();

  const messages = [
    {
      role: "system",
      content: `You are a friendly project coach. Given the project state, suggest the single most important next action. Be concise (2-3 sentences). Use encouraging, non-technical language.`,
    },
    {
      role: "user",
      content: `Project state:\n${JSON.stringify(state, null, 2)}\n\nProgress:\n${JSON.stringify(progress, null, 2)}`,
    },
  ];

  try {
    const result = await chatComplete(config.ollamaUrl, model, messages, 30000);
    res.json({ action: result, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### Anti-Patterns to Avoid

- **Arbitrary file paths in API:** Never accept raw file paths from the client. Use filename-only with whitelist + `isWithinBasePath` double-check.
- **Blocking AI calls without timeout:** Always use the timeout parameter on `chatComplete` (existing pattern uses 120000ms default). For next-action, use shorter timeout (30s) since it should be a quick response.
- **Creating new SSE infrastructure:** Reuse the exact `sendEvent` + `res.setHeader` pattern from existing endpoints. Do not introduce a helper library.
- **Auto-writing AI output to files without validation:** Phase 3 must validate AI-generated content before writing to ROADMAP.md or other planning files. At minimum, check it parses as valid markdown and is not empty.

## Don't Hand-Roll

| Problem               | Don't Build                  | Use Instead                                                        | Why                                                       |
| --------------------- | ---------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------- |
| Markdown rendering    | Custom parser                | `MarkdownContent` component (already exists)                       | Already handles code blocks, mermaid, DOMPurify           |
| Path security         | Custom path checks           | `isWithinBasePath` from `lib/file-browser.js` + filename whitelist | Battle-tested, already used in server.js                  |
| SSE streaming         | WebSocket or custom protocol | Express SSE pattern from `/api/chat`                               | Project standard, client already handles it               |
| Project state reading | Direct file reads            | `GsdBridge` class methods                                          | Handles `@file:` references, error handling, JSON parsing |
| Rate limiting         | Custom middleware            | `createRateLimiter` (already imported in server.js)                | Consistent with all other endpoints                       |

**Key insight:** Every infrastructure piece needed already exists in the codebase. This phase is purely about composing existing patterns into new endpoints and UI components.

## Common Pitfalls

### Pitfall 1: Ollama Offline During AI Operations

**What goes wrong:** User clicks "What's Next" or "Research" but Ollama is not running.
**Why it happens:** Ollama is a local service that may not auto-start.
**How to avoid:** Check `checkConnection()` before AI calls. Return a friendly error: "Ollama is offline. Start it to use AI features." Disable AI buttons when connection check fails.
**Warning signs:** Fetch timeout errors, ECONNREFUSED in logs.

### Pitfall 2: Large Project State Overwhelming Small Models

**What goes wrong:** `chatComplete` with full roadmap/state JSON produces garbage output from small models (<7B).
**Why it happens:** Small models have limited context windows and reasoning ability.
**How to avoid:** Truncate context sent to AI. For next-action, send only current phase + progress summary, not full roadmap. For research/planning, include only the target phase details. STATE.md note mentions: "Small model (<7B) structured output quality is LOW confidence."
**Warning signs:** AI returns generic advice or hallucinated project details.

### Pitfall 3: File Write Race Conditions

**What goes wrong:** Two simultaneous writes to the same planning file corrupt it.
**Why it happens:** Multiple browser tabs or rapid save clicks.
**How to avoid:** Use the atomic write pattern from `build-registry.js` (write to `.tmp.PID`, then rename). For the PUT endpoint, use `fs.writeFileSync` to temp file + `fs.renameSync`.
**Warning signs:** Truncated files, JSON parse errors on reload.

### Pitfall 4: SSE Connection Cleanup

**What goes wrong:** SSE connections hang open after client navigates away.
**Why it happens:** Browser closes the EventSource but server keeps writing.
**How to avoid:** Check `res.writableEnded` before every `res.write()` (already in existing pattern). Add `req.on('close', ...)` handler to abort any pending Ollama requests.
**Warning signs:** Memory leaks, server log errors about writing to closed connections.

### Pitfall 5: localStorage Key Collisions

**What goes wrong:** Advanced/simple toggle state conflicts between projects.
**Why it happens:** Using a generic key like `cc_build_view_mode` instead of per-project keys.
**How to avoid:** Use a single global key for view mode preference (simple vs advanced is a user preference, not per-project). If per-project state is needed later, use `cc_build_${projectId}_key` pattern.
**Warning signs:** Switching projects unexpectedly changes view mode.

## Code Examples

### Existing SSE Pattern (from server.js /api/chat)

```javascript
// Source: server.js lines 305-314
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");
res.flushHeaders();

function sendEvent(data) {
  if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
}
```

### Existing GsdBridge Usage (from server.js)

```javascript
// Source: server.js lines 1099-1108
app.get("/api/build/projects/:id/state", (req, res) => {
  const project = _resolveBuildProject(req, res);
  if (!project) return;
  try {
    const bridge = new GsdBridge(project.path);
    res.json(bridge.getState());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### Existing chatComplete Usage

```javascript
// Source: lib/ollama-client.js lines 44-73
async function chatComplete(ollamaUrl, model, messages, timeoutMs = 120000) {
  // Non-streaming, returns full text response
  // Used for tool-call loop in /api/chat, can be used for next-action
}
```

### Existing BuildPanel View Routing

```javascript
// Source: src/components/BuildPanel.jsx lines 9-16
const [view, setView] = useState(activeProject ? "dashboard" : "list");
// Views: 'list' | 'dashboard' | 'phase'
// Extend with viewMode: 'simple' | 'advanced' within dashboard view
```

### Existing Rate Limiter Pattern

```javascript
// Source: server.js line 183
app.use(
  "/api/build/projects",
  createRateLimiter({
    name: "build-registry",
    max: CREATE_RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    methods: ["POST", "DELETE"],
  }),
);
// Add rate limiting to new AI endpoints (POST methods)
```

## State of the Art

| Old Approach                | Current Approach                  | When Changed            | Impact                                               |
| --------------------------- | --------------------------------- | ----------------------- | ---------------------------------------------------- |
| WebSocket for streaming     | SSE (text/event-stream)           | Project standard        | Simpler, unidirectional, sufficient for AI responses |
| Structured JSON output only | chatStructured with chat fallback | Phase 1 (review engine) | Handles model capability gracefully                  |
| Global file browser         | Per-project file whitelist        | Phase 16 P4             | Security: only .planning/ files accessible           |

## Open Questions

1. **Model selection for AI endpoints**
   - What we know: Client sends `model` in request body for all AI endpoints (chat, review, score)
   - What's unclear: Should the dashboard AI features use the user's selected model or a hardcoded default?
   - Recommendation: Use the user's selected model (consistent with all other AI features). Frontend already has model selection state.

2. **Write-after-validate for ROADMAP.md (Phase 3)**
   - What we know: STATE.md mentions "write-after-validate to ROADMAP.md"
   - What's unclear: What validation is sufficient? Full markdown parse? Schema check?
   - Recommendation: Check non-empty, check starts with `#` (markdown heading), check length > 100 chars. Do not attempt full schema validation -- markdown is too flexible.

3. **Small model fallback (Phase 3)**
   - What we know: STATE.md mentions "small model fallback" for research/planning
   - What's unclear: What constitutes "small" and what's the fallback behavior?
   - Recommendation: Use the existing MODEL_TIERS pattern from Phase 4 (review mode). If model is "weak" tier, show a warning but still attempt. If output fails validation, return error with suggestion to use a larger model.

## Validation Architecture

### Test Framework

| Property           | Value                                             |
| ------------------ | ------------------------------------------------- |
| Framework          | Playwright ^1.58.2                                |
| Config file        | playwright.config (implicit)                      |
| Quick run command  | `npx playwright test tests/ui --project=chromium` |
| Full suite command | `npx playwright test`                             |

### Phase Requirements -> Test Map

| Req ID | Behavior                                        | Test Type | Automated Command                                             | File Exists? |
| ------ | ----------------------------------------------- | --------- | ------------------------------------------------------------- | ------------ |
| P2-01  | BuildHeader shows status badge and progress     | unit      | `npx playwright test tests/ui/build-simple-view.spec.js -x`   | No - Wave 0  |
| P2-02  | Simple/advanced toggle persists in localStorage | unit      | `npx playwright test tests/ui/build-simple-view.spec.js -x`   | No - Wave 0  |
| P2-03  | "What's Next" card displays AI recommendation   | unit      | `npx playwright test tests/ui/build-simple-view.spec.js -x`   | No - Wave 0  |
| P3-01  | Research endpoint returns SSE stream            | unit      | `npx playwright test tests/ui/build-ai-ops.spec.js -x`        | No - Wave 0  |
| P4-01  | File viewer displays whitelisted files          | unit      | `npx playwright test tests/ui/build-advanced-view.spec.js -x` | No - Wave 0  |
| P4-02  | File editor saves with atomic write             | unit      | `node --test tests/unit/build-file-ops.test.js`               | No - Wave 0  |
| P5-01  | Handoff shows copy-pasteable GSD commands       | unit      | `npx playwright test tests/ui/build-handoff.spec.js -x`       | No - Wave 0  |

### Sampling Rate

- **Per task commit:** `npx playwright test tests/ui/build-*.spec.js --project=chromium`
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/ui/build-simple-view.spec.js` -- covers P2-01, P2-02, P2-03
- [ ] `tests/ui/build-ai-ops.spec.js` -- covers P3-01
- [ ] `tests/ui/build-advanced-view.spec.js` -- covers P4-01
- [x] `tests/unit/build-file-ops.test.js` -- covers P4-02 (atomic write + whitelist; integration)
- [ ] `tests/ui/build-handoff.spec.js` -- covers P5-01

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `lib/ollama-client.js`, `lib/gsd-bridge.js`, `lib/build-registry.js`, `lib/file-browser.js`
- Direct codebase inspection: `server.js` (lines 271-380 SSE pattern, lines 1042-1141 build routes)
- Direct codebase inspection: `src/components/BuildPanel.jsx` (full component, 378 lines)
- Direct codebase inspection: `src/App.jsx` (build state management)
- Direct codebase inspection: `.planning/STATE.md` (Phase 16 pending todos, existing infrastructure)

### Secondary (MEDIUM confidence)

- `.planning/ROADMAP.md` Phase 16 success criteria and notes
- `.claude/skills/ui-ux-pro-max/SKILL.md` UI conventions (Lucide icons, no emojis, cursor-pointer, accessible)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - every pattern directly observed in existing codebase
- Pitfalls: HIGH - derived from actual codebase patterns and STATE.md notes about small model quality
- Validation: MEDIUM - test file structure follows existing patterns but new files needed

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- no external dependencies changing)
