# Coding Conventions

**Analysis Date:** 2026-03-14

## Naming Patterns

**Files:**
- Backend modules (Node.js): lowercase with hyphens, e.g., `logger.js`, `mcp-client-manager.js`, `icm-scaffolder.js`
- React components: PascalCase, e.g., `App.jsx`, `SettingsPanel.jsx`, `FileBrowser.jsx`, `MessageBubble.jsx`
- Test files: descriptive names with `.test.js` or `.spec.js` suffix, e.g., `icm-scaffolder.test.js`, `create-mode.spec.js`

**Functions:**
- JavaScript/Node.js: camelCase for regular functions and methods, e.g., `createLogger()`, `buildFileTree()`, `fetchConfig()`, `handleSend()`
- React hooks: camelCase starting with "use", e.g., `useState()`, `useEffect()`, `useCallback()`, `useRef()`
- Helper functions: descriptive camelCase, e.g., `sendEvent()`, `computeCpuPercent()`, `percentile()`, `slugify()`
- Event handlers: camelCase starting with "handle", e.g., `handleSave()`, `handleFileUpload()`, `handleDrop()`, `handleSend()`
- Async operations: camelCase starting with "fetch" or "load", e.g., `fetchModels()`, `loadConversation()`, `loadTree()`

**Variables:**
- Local variables: camelCase, e.g., `streaming`, `selectedModel`, `projectFolder`, `messages`
- State variables (React): camelCase, e.g., `models`, `splashDismissed`, `showSettings`, `activeConvId`
- Constants: UPPER_SNAKE_CASE, e.g., `DEBUG`, `PORT`, `MAX_ROUNDS`, `DEFAULT_STAGES`
- Private/internal: camelCase prefixed with underscore (convention), e.g., `_config`
- Abbreviations in variables: preserved as-is, e.g., `ollamaUrl`, `ghToken`, `mcpServer`

**Types & Classes:**
- Error classes: PascalCase, e.g., `ScaffolderError`
- Custom error subclasses: define code, message, and status properties

## Code Style

**Formatting:**
- Indentation: 2 spaces
- Line endings: LF
- No semicolons (implicit in most cases, added where necessary for clarity)
- Trailing commas in multiline objects/arrays (where applicable)
- String quotes: double quotes for JSX attributes, consistent throughout

**Linting:**
- No ESLint, Prettier, or Biome config detected — linting relies on code review standards
- Import organization follows Node.js conventions (built-in first, then npm, then local)
- No automated format-on-save or pre-commit hooks for style consistency

**Type Safety:**
- No TypeScript — codebase is JavaScript only (`.js`, `.jsx`)
- No JSDoc type annotations for function signatures or complex objects
- Zod used for runtime validation in `lib/builder-schemas.js`, `lib/review.js` — schema-driven validation where structured output is critical

**Comments:**
- JSDoc-style for module exports and public APIs, e.g., `/** module description */`
- Inline comments for complex logic, but sparingly
- Comment header sections with consistent formatting: `// ── Section Name ────────────────────`

## Import Organization

**Order:**
1. Built-in Node.js modules: `require('fs')`, `require('path')`
2. External npm packages: `require('express')`, `require('@modelcontextprotocol/sdk')`
3. Local modules: `require('./lib/logger')`, `require('./lib/config')`
4. React imports: `import React from 'react'`, `import { useState } from 'react'`

**Path Aliases:**
- Frontend: `@` maps to `./src` (defined in `vite.config.js`)
- No backend aliases used; relative paths with `require()` are standard

**Module Structure:**
- Barrel files: minimal usage; components export directly from their files
- Mixed CommonJS (backend) and ES modules (frontend) throughout codebase
- Frontend uses ES6 imports; backend uses CommonJS `require()`

## Error Handling

**Patterns:**
- **Custom error class**: `ScaffolderError` in `lib/icm-scaffolder.js` includes `code`, `message`, and `status` properties
  ```javascript
  class ScaffolderError extends Error {
    constructor(code, message, status = 400) {
      super(message);
      this.name = 'ScaffolderError';
      this.code = code;
      this.status = status;
    }
  }
  ```
- **Try-catch blocks**: Used for synchronous file I/O and validation in `lib/file-browser.js`
  ```javascript
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
  ```
- **Async error handling**: Express route handlers wrap logic in try-catch, log errors, and respond with appropriate HTTP status
  ```javascript
  try {
    // operation
  } catch (err) {
    log('ERROR', 'Failed to read file', { path: filePath, error: err.message });
    res.status(500).json({ error: `Cannot read file: ${err.message}` });
  }
  ```
- **Silent failures**: Some async operations use empty catch blocks (`catch (err) { }`) for non-critical fetches
- **Frontend error handling**: Try-catch with fallback UI states; errors often trigger toast notifications or silent UI updates

## Logging

**Framework:** Custom logger in `lib/logger.js` using file streams

**Patterns:**
- **Log levels**: INFO, ERROR, DEBUG
- **Usage**:
  ```javascript
  log('INFO', `Chat request: model=${model} mode=${mode}`);
  log('ERROR', 'Cannot reach Ollama', { error: err.message });
  debug('Building file tree', { folder, maxDepth });
  ```
- **Output**: logs written to `logs/app.log` and `logs/debug.log` files
- **Console output**: INFO goes to stdout, ERROR goes to stderr
- **MCP mode**: stderr mode available for stdio transport (all output to stderr)
- **Timestamp**: ISO 8601 format automatically prepended to all log entries
- **Debug mode**: Controlled by `DEBUG` environment variable; debug logs only printed if enabled

## Function Design

**Size:** Generally keep functions under 100 lines; larger functions in `server.js` (chat streaming, tool-call loop) are complex but focused on single concerns

**Parameters:**
- Destructured objects for options, e.g., `{ ollamaUrl, projectFolder }`
- Config objects passed by reference rather than individual params
- React components receive props as object and destructure in parameters

**Return Values:**
- Functions return meaningful data: objects with `success`, `error`, `code`, `status` properties
- Async functions return promises (implicitly in async/await, or explicitly with `Promise`)
- Void functions used for side effects (state updates, API calls, logging)

**Error states:**
- Functions returning result objects include error information, e.g., `{ success: false, error: message, code: 'ERROR_CODE' }`

## Module Design

**Exports:**
- Node.js modules: `module.exports = { function1, function2, Class }` at end of file
- React components: `export default function ComponentName() { }`
- Named exports where multiple exports from one file

**Barrel Files:**
- Minimal usage; most components export directly
- `lib/logger.js` exports `{ createLogger }` for singleton use across app

**Internal state management:**
- Backend: Config stored in JSON files (no database), accessed via `lib/config.js`
- Frontend: React `useState` for component-level state, no global state manager (Redux, Zustand, etc.)
- Conversation history: JSON files in `history/` directory, loaded/saved via Express API

## Async/Await

**Patterns:**
- Prefer async/await over `.then()` chains
- Error handling via try-catch (not `.catch()`)
- Example (server.js):
  ```javascript
  async function handleDashboardRefresh() {
    await Promise.all([fetchHistory(), fetchSystemMetrics()]);
    showToast('Dashboard refreshed');
  }
  ```

## Frontend-Specific Conventions

**Component structure:**
- Functional components with hooks (React 18+)
- State management: `useState` for component state, `useEffect` for side effects
- Refs for direct DOM access: `useRef()`
- Custom hook for 3D effects context: `use3DEffects()` in `src/contexts/Effects3DContext.jsx`

**Event handling:**
- Inline arrow functions for simple handlers, e.g., `onClick={() => setShowSettings(true)}`
- Named handler functions for complex logic, e.g., `handleSend()`, `handleFileUpload()`

**Styling:**
- Tailwind CSS utility classes for all styling
- Custom CSS variables in CSS files (e.g., for animations)
- Responsive classes using Tailwind breakpoints (sm, lg, etc.)
- Custom glass/neon effects via CSS classes: `glass`, `glass-heavy`, `neon-glow-sm`, `btn-neon`

**Accessibility:**
- ARIA labels: `aria-label`, `aria-expanded`, `aria-live`
- Semantic HTML: `<button>`, `<main>`, `<aside>`, `<header>`
- Role attributes for custom widgets: `role="log"`, `role="treeitem"`, `role="group"`
- Skip link for accessibility: `<a href="#chat-input" className="skip-link">`

## Backend-Specific Conventions

**Express routes:**
- Route handlers defined inline with `app.get()`, `app.post()`, `app.delete()`
- Middleware applied with `app.use()`
- Request/response logging in middleware

**File I/O:**
- Synchronous operations (fs.readFileSync) for small files
- Path validation before reading to prevent traversal attacks
- Error messages include full context for debugging

**Streaming:**
- Server-Sent Events (SSE) for real-time chat responses
- Response headers set before streaming: `Content-Type: text/event-stream`, `Cache-Control: no-cache`
- SSE format: `data: ${JSON.stringify(data)}\n\n`

---

## Builder Mode Conventions

**Config-driven panels:**
- Builder modes (Prompting, Skillz, Agentic) use `BaseBuilderPanel` in `src/components/builders/BaseBuilderPanel.jsx` with a config object
- Each mode defines a config with `modeId`, `fields`, `endpoint`, and `title` — see `src/components/builders/PromptingPanel.jsx`, `SkillzPanel.jsx`, `AgenticPanel.jsx`
- Schemas live in `lib/builder-schemas.js` (Zod); scoring logic in `lib/builder-score.js`

**Field types:**
- Supported: `text`, `textarea`, `tags`
- Tag inputs use `TagInput` component (inline in BaseBuilderPanel)

*Convention analysis: 2026-03-14*
