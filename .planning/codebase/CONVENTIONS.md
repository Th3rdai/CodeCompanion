# Coding Conventions

**Analysis Date:** 2026-03-13

## Naming Patterns

**Files:**
- React components: PascalCase with `.jsx` extension (e.g., `MessageBubble.jsx`, `SettingsPanel.jsx`, `FileBrowser.jsx`)
- Node.js modules: kebab-case with `.js` extension (e.g., `ollama-client.js`, `mcp-client-manager.js`, `logger.js`)
- Utility modules: kebab-case with descriptive names (e.g., `file-browser.js`, `tool-call-handler.js`)
- Context files: PascalCase with "Context" suffix (e.g., `Effects3DContext.jsx`)
- 3D components: `src/components/3d/[ComponentName].jsx` (PascalCase, subdirectory)

**Functions:**
- React components: PascalCase (e.g., `function MessageBubble()`, `export default function FileBrowser()`)
- Utility functions: camelCase (e.g., `slugify()`, `normalizeStages()`, `checkConnection()`)
- Event handlers: camelCase prefixed with "handle" (e.g., `handleValidateGhToken()`, `handleAttach()`)
- Private/internal functions: underscore prefix (e.g., `_parseArgs()`, `_parseArgs()` in `ToolCallHandler`)
- Async helpers: camelCase, no special prefix (e.g., `fetchConfig()`, `fetchModels()`, `fetchHistory()`)

**Variables:**
- State variables: camelCase (e.g., `const [models, setModels] = useState([])`)
- Constants: UPPER_SNAKE_CASE for module-level constants (e.g., `TOOL_CALL_PATTERN`, `MAX_ROUNDS`, `TEXT_EXTENSIONS`, `IGNORE_DIRS`)
- Configuration objects: camelCase (e.g., `const defaults = { ollamaUrl: '...', icmTemplatePath: '' }`)
- Booleans: descriptive names (e.g., `connected`, `streaming`, `dragging`, `showSettings`, `splashDismissed`)

**Types/Classes:**
- No TypeScript used; vanilla JavaScript with JSDoc for documentation
- Class names: PascalCase (e.g., `class McpClientManager`, `class ScaffolderError`, `class ToolCallHandler`)
- Error classes: PascalCase with "Error" suffix

## Code Style

**Formatting:**
- No explicit linting config (no `.eslintrc` or `.prettierrc` detected)
- Vite configured in `vite.config.js` with React and Tailwind plugins
- 2-space indentation throughout
- Semicolons used consistently
- Trailing commas in multi-line objects/arrays

**Linting:**
- No ESLint or automated code linting configured
- Style maintained through convention and code review

**Indentation & Spacing:**
- 2-space indentation in all files (server.js, lib/, src/)
- Consistent spacing around operators
- Ternary operators: inline or split with proper indentation

**Tailwind CSS:**
- Utility-first approach for all styling
- Custom CSS classes: `glass`, `glass-neon`, `glass-heavy`, `fade-in`, `neon-glow-sm`, `typing-dot`
- Dark theme dominant (slate, indigo, amber palette)
- Responsive design: mobile-first, minimal breakpoint-specific classes

## Import Organization

**Backend (Node.js) Order:**
1. Built-in modules (`const fs = require('fs')`, `const path = require('path')`)
2. Third-party packages (`const express = require('express')`, `const { Client } = require('@modelcontextprotocol/sdk/...')`)
3. Local lib modules (`const { createLogger } = require('./lib/logger')`)
4. Comments as section separators: `// ── Lib imports ──────────────`

**Frontend (React) Order:**
1. React hooks/core (`import { useState, useEffect, ... } from 'react'`)
2. React Router/context imports
3. Component imports (local or relative)
4. Context provider imports
5. Style/CSS imports
6. Utilities/helpers

**Example from server.js:**
```javascript
const express = require('express');
const fs = require('fs');
const path = require('path');

// ── Lib imports ──────────────────────────────────────
const { createLogger } = require('./lib/logger');
const { initConfig, getConfig, updateConfig } = require('./lib/config');
const { initHistory, listConversations, getConversation, saveConversation } = require('./lib/history');
// ... more local imports
```

**Path Aliases:**
- Vite configured with `@` alias: `path.resolve(__dirname, './src')` in `vite.config.js`
- Rarely used in codebase; relative imports preferred: `./components/`, `../contexts/`

## Error Handling

**Patterns:**
- **Synchronous operations:** throw custom `ScaffolderError` with `code`, `message`, and `status`
- **Async operations:** try-catch with logging via custom logger
- **React components:** try-catch with silent failures (`catch {}`) for non-critical operations
- **Result objects:** return `{ success: true, result }` or `{ success: false, error: msg }`
- **Critical paths:** re-throw errors after logging

**Custom Error Class:**
```javascript
class ScaffolderError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ScaffolderError';
    this.code = code;
    this.status = status;
  }
}

// Usage:
throw new ScaffolderError('PATH_OUTSIDE_ROOT', 'Output location is outside allowed roots.', 403);
```

**Backend Error Logging:**
```javascript
try {
  const result = await chatComplete(...);
} catch (err) {
  log('ERROR', `Ollama chatComplete failed (round ${round + 1})`, { error: err.message });
  sendEvent({ error: `Ollama error: ${err.message}` });
}
```

**React Silent Failures:**
```javascript
async function fetchConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    setOllamaUrl(data.ollamaUrl || '');
  } catch {}  // Silent, UI shows default state
}
```

## Logging

**Framework:** Custom `createLogger()` in `lib/logger.js` (not console-based)

**API:**
```javascript
const { log, debug, logDir } = createLogger(appRoot, { debugEnabled: true });
log('INFO', 'Message', { data: 'optional' });
debug('Debug message', { details: 'optional' });
```

**Log Levels:** `INFO`, `ERROR`, `DEBUG`

**Output:**
- File: `logs/app.log` (info/errors), `logs/debug.log` (debug entries)
- Console: conditional based on log level and debug flag
- Format: `[ISO-8601-timestamp] [LEVEL] message [JSON data]`

**When to Log:**
- INFO: Request/response lifecycle, connection status changes, file operations completed
- ERROR: Exceptions, validation failures, external service errors
- DEBUG: Tool calls, stream states, parsing details (only if debug enabled)

**Example:**
```javascript
log('INFO', `Chat request: model=${model} mode=${mode} messages=${messages.length}`);
debug('Tool-call round ${round + 1}/${MAX_ROUNDS}');
log('ERROR', `Cannot reach Ollama at ${url}`, { error: err.message });
```

## Comments

**When to Comment:**
- Complex algorithms (regex patterns, path validation logic)
- Non-obvious heuristics (tool-call parsing fallbacks)
- Section dividers in large files

**Style:**
- Single-line `//` comments
- Section headers: `// ── Label ──────────────────────────────`
- No multi-line block comments (`/* ... */`)

**JSDoc/TSDoc:**
- Minimal JSDoc observed
- When used: documents function purpose and usage
- Example from `lib/logger.js`:
```javascript
/**
 * lib/logger.js — Logging module with stderr mode for MCP stdio transport.
 *
 * Usage:
 *   const { createLogger } = require('./lib/logger');
 *   const { log, debug } = createLogger(__dirname, { debugEnabled: true });
 */
```

## Function Design

**Size:** Generally 5–50 lines; larger functions (50–100+ lines) handle complex workflows (e.g., API route handlers, streaming logic)

**Parameters:**
- Use destructuring for options objects:
```javascript
function createLogger(appRoot, options = {}) {
  const { stderrMode = false, debugEnabled = false } = options;
}
```
- Keep to 2–4 parameters; group related values into objects
- Default values used for optional params

**Return Values:**
- Result objects: `{ success: true, result }` or `{ success: false, error }`
- Data structures: arrays, objects
- Promises for async operations
- Avoid null; use empty arrays `[]`, empty strings `''`, or false instead

## Module Design

**Exports (CommonJS):**
```javascript
module.exports = {
  initConfig,
  getConfig,
  updateConfig,
  loadConfig,
  saveConfig
};
```

**Exports (ES6 - React):**
```jsx
export function Effects3DProvider({ children }) { /* ... */ }
export function use3DEffects() { /* ... */ }
export default function MessageBubble({ role, content }) { /* ... */ }
```

**Barrel Files:**
- Not extensively used; direct imports preferred
- Most components imported directly from their file

**Class Patterns:**
- Used for stateful managers: `McpClientManager`, `ToolCallHandler`
- Constructor accepts logger or options object
- Internal state as instance properties: `this.connections = new Map()`

## State Management

**React:**
- `useState` for local component state
- Context API (`Effects3DContext`) for cross-component shared state
- No Redux/Zustand

**Backend Singleton Pattern:**
```javascript
let _config = null;
let _appRoot = null;

function initConfig(appRoot) {
  _appRoot = appRoot;
  _config = loadConfig(appRoot);
  return _config;
}

function getConfig() {
  if (!_config) throw new Error('Config not initialized. Call initConfig(appRoot) first.');
  return _config;
}
```

## Async/Await

- Async functions used throughout for API calls, file I/O
- Promises returned from async functions
- No callback-based patterns (except legacy streaming with readers)
- Timeouts implemented with `AbortController` for fetch requests

**Example:**
```javascript
async function chatComplete(ollamaUrl, model, messages, timeoutMs = 120000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
    return await response.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}
```

---

*Convention analysis: 2026-03-13*
