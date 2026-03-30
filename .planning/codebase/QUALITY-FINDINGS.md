# Quality Findings

**Analysis Date:** 2026-03-14

## Code Quality Summary

- **Strengths:** Clear separation of lib/API/frontend; consistent naming; Zod validation for critical paths
- **Gaps:** No linting, no TypeScript, large components, duplicate test layout

## Positive Patterns

**Validation:**

- Zod schemas in `lib/builder-schemas.js`, `mcp/schemas.js` for structured output
- Manual validation in route handlers (model, messages, mode, etc.)
- Path safety: `isWithinBasePath`, `isUnderRoot` in file operations

**Security:**

- Config sanitization: `sanitizeConfigForClient` masks tokens and env vars
- MCP config validation: rejects shell chars, invalid env keys, non-http URLs
- Rate limiting on chat, create, review, score, github clone, MCP test

**Error Handling:**

- Try/catch with logging in async routes
- SSE error events before `[DONE]`
- Graceful Ollama offline (503, connected: false)

**UI Consistency:**

- Shared components: MarkdownContent, Toast, LoadingAnimation
- Builder modes use BaseBuilderPanel with config-driven fields
- Tailwind + glass/input-glow classes for visual consistency

## Quality Gaps

**No Linting:**

- No ESLint; unused vars, implicit globals, inconsistent patterns possible
- Recommendation: Add eslint-config-react-app or similar

**No Formatting:**

- No Prettier; manual style
- Recommendation: Add Prettier, format on save

**Large Components:**

- `App.jsx` (771 lines), `ReviewPanel.jsx` (825), `GitHubPanel.jsx` (811)
- Recommendation: Extract hooks (useChat, useModels), split panels into subcomponents

**Sparse JSDoc:**

- Lib functions rarely documented
- Recommendation: Add JSDoc for public exports in lib/

**Test Layout Duplication:**

- `tests/test/` mirrors `tests/unit` and `tests/e2e`
- Recommendation: Consolidate; remove tests/test/

## Maintainability

**Adding a New Mode:** Straightforward — MODES array, SYSTEM_PROMPTS, optional component
**Adding a Builder Mode:** Clear — BaseBuilderPanel config, schema, prompt
**Adding an API Route:** Clear — server.js, optional lib module
**Adding an MCP Tool:** Clear — schemas.js, tools.js register()

---

_Quality findings: 2026-03-14_
