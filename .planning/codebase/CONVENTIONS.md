# Coding Conventions

**Analysis Date:** 2026-03-14

## Naming Patterns

**Files:**

- React components: PascalCase, e.g. `ReportCard.jsx`, `BaseBuilderPanel.jsx`
- Lib modules: kebab-case, e.g. `file-browser.js`, `mcp-client-manager.js`
- Entry points: kebab-case, e.g. `mcp-server.js`

**Functions:**

- camelCase: `getConfig`, `saveConversation`, `createRateLimiter`
- Handlers: `handleKeyDown`, `onRemove`, `onToast`

**Variables:**

- camelCase: `selectedModel`, `formData`, `scoreData`
- Constants: UPPER_SNAKE_CASE or PascalCase for objects: `GRADE_COLORS`, `MODES`, `SYSTEM_PROMPTS`

**Types:**

- No TypeScript; JSDoc used sparingly
- Zod schemas in `mcp/schemas.js`, `lib/builder-schemas.js` for runtime validation

## Code Style

**Formatting:**

- No Prettier config detected
- Indentation: 2 spaces (observed in source)
- Semicolons: Used

**Linting:**

- No ESLint config detected
- No biome.json or other linter config

## Import Organization

**Order:**

1. React / external libs first
2. Local components
3. Contexts / utilities

**Example from `src/App.jsx`:**

```javascript
import { useState, useEffect, useRef, useCallback } from "react";
import MarkdownContent from "./components/MarkdownContent";
import MessageBubble from "./components/MessageBubble";
// ...
```

**Path Aliases:**

- `@` → `./src` (in `vite.config.js`)

## Error Handling

**Patterns:**

- API: `try/catch` with `log('ERROR', ...)` and `res.status(500).json({ error })`
- Async: `await assert.rejects()` in tests
- Ollama: Check `response.ok`, parse error body, return 503 for connection failure

## Logging

**Framework:** Custom `lib/logger.js` (file + optional console)

**Patterns:**

- `log('INFO', message)` for important events
- `debug(message, obj)` for verbose (when `DEBUG=1`)
- No `console.log` in production paths (use `log`/`debug`)

## Comments

**When to Comment:**

- Section headers with `// ── Section Name ──`
- Complex logic (e.g. rate limiter, tool-call loop)
- JSDoc for exported functions in lib (sparse)

**JSDoc/TSDoc:**

- Used in `mcp/tools.js` for `createModeHandler`, `resolveModel`
- Not consistently applied across lib

## Function Design

**Size:** No strict limit; some handlers are 50+ lines (e.g. chat SSE loop)

**Parameters:** Object destructuring for components: `{ selectedModel, connected, onToast }`

**Return Values:**

- API: `res.json(...)` or `res.status(...).json(...)`
- Lib: Return plain objects or throw

## Module Design

**Exports:**

- CommonJS: `module.exports = { ... }` in lib, server, mcp
- ESM: `import`/`export` in React (Vite handles both)

**Barrel Files:** Not used; direct imports from component files

---

_Convention analysis: 2026-03-14_
