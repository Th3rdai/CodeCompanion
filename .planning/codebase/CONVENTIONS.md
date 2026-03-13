# Coding Conventions

**Analysis Date:** 2026-03-13

## Naming Patterns

**Files:**
- React components: PascalCase with `.jsx` extension (e.g., `MessageBubble.jsx`, `SettingsPanel.jsx`, `FileBrowser.jsx`)
- Node.js modules: camelCase with `.js` extension (e.g., `ollama-client.js`, `mcp-client-manager.js`, `logger.js`)
- Utility modules: camelCase with descriptive names (e.g., `file-browser.js`, `tool-call-handler.js`)
- Context files: PascalCase with "Context" suffix (e.g., `Effects3DContext.jsx`)

**Functions:**
- React components: PascalCase (e.g., `function MessageBubble()`, `export default function FileBrowser()`)
- Utility functions: camelCase (e.g., `slugify()`, `normalizeStages()`, `checkConnection()`)
- Event handlers: camelCase prefixed with "handle" (e.g., `handleValidateGhToken()`, `handleAttach()`, `handleFileClick()`)
- Hooks/Custom hooks: camelCase prefixed with "use" (e.g., `use3DEffects()`, `useContext()`)

**Variables:**
- State variables: camelCase (e.g., `const [models, setModels] = useState([])`, `const [enabled, setEnabled] = useState()`)
- Constants: UPPER_SNAKE_CASE for module-level constants (e.g., `const STORAGE_KEY = 'th3rdai_3d_effects'`, `const MODES = [...]`, `const DEBUG = process.env.DEBUG === '1'`)
- Configuration objects: camelCase (e.g., `const defaults = { ollamaUrl: '...', icmTemplatePath: '' }`)

**Types:**
- No TypeScript used; JSDoc occasionally used for documentation
- Class names: PascalCase (e.g., `class McpClientManager`, `class ScaffolderError`)

## Code Style

**Formatting:**
- No explicit formatter detected (no `.prettierrc` or ESLint config found)
- Vite build tool configured in `vite.config.js` with React and Tailwind plugins
- Components use inline styles with Tailwind classes
- Code generally follows modern ES6+ conventions

**Linting:**
- No ESLint or code linting configuration detected
- Code follows manual style consistency without automated enforcement

**Indentation & Spacing:**
- 2-space indentation observed throughout server code and modules
- Consistent spacing around operators and function parameters
- Ternary operators on same line or split across lines with indentation

## Import Organization

**Order:**
1. Node.js built-in modules (e.g., `const fs = require('fs')`, `const path = require('path')`)
2. Third-party packages (e.g., `const express = require('express')`, `const { Client } = require('@modelcontextprotocol/sdk/...')`)
3. Local modules (e.g., `const { createLogger } = require('./lib/logger')`)

**Example from server.js:**
```javascript
const express = require('express');
const fs = require('fs');
const path = require('path');

// Lib imports
const { createLogger } = require('./lib/logger');
const { initConfig, getConfig, updateConfig } = require('./lib/config');
// ... more local imports
```

**React Import Order:**
1. React/hooks imports
2. Component imports (local or relative)
3. Context imports
4. Style/utility imports

**Example from SettingsPanel.jsx:**
```jsx
import { useState, useEffect } from 'react';
import McpServerPanel from './McpServerPanel';
import McpClientPanel from './McpClientPanel';
import { use3DEffects } from '../contexts/Effects3DContext';
```

**Path Aliases:**
- Vite path alias `@` resolves to `src/` directory (configured in `vite.config.js`: `alias: { '@': path.resolve(__dirname, './src') }`)
- Not heavily used in current codebase; relative imports (`../contexts/`, `./components/`) preferred

## Error Handling

**Patterns:**
- Try-catch blocks around async operations and API calls
- Silent error handling with fallback defaults: `try { ... } catch {}` (e.g., in `Effects3DContext.jsx` localStorage access, `SettingsPanel.jsx` fetch calls)
- Error propagation in critical paths: `catch (err) { throw err; }` (e.g., in `ollama-client.js` for critical Ollama operations)
- Custom error classes for domain-specific errors: `ScaffolderError` with status codes and error codes
- Error objects include properties: `code`, `status`, `message` (e.g., `err instanceof ScaffolderError && err.code === 'PATH_OUTSIDE_ROOT' && err.status === 403`)

**Example patterns:**
```javascript
// Silent catch with fallback
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === null ? true : saved === 'true';
} catch {
  return true;
}

// Error re-throw
try {
  await client.connect(clientTransport);
  // ...
} catch (err) {
  this.connections.set(id, { error: err.message });
  throw err;
}

// Result object pattern for non-critical operations
async function checkConnection(ollamaUrl) {
  try {
    const response = await fetch(...);
    return { connected: true, modelCount };
  } catch (err) {
    return { connected: false, modelCount: 0 };
  }
}
```

## Logging

**Framework:** Custom logger module (`lib/logger.js`)

**Patterns:**
- Logger created with `const { log, debug, logDir } = createLogger(__dirname, { debugEnabled: DEBUG })`
- Log levels: `INFO`, `ERROR`, `DEBUG`
- Timestamped entries: `[ISO-8601] [LEVEL] message [JSON data]`
- Dual output: file (`logs/app.log`, `logs/debug.log`) and console
- Stderr mode for MCP stdio transport (all output → stderr for protocol compliance)

**Usage examples from server.js:**
```javascript
const { log, debug, logDir } = createLogger(__dirname, { debugEnabled: DEBUG });

// In modules:
this.log('INFO', `Connected to external MCP server: ${serverConfig.name} (${tools.length} tools)`);
this.debug('Stdio transport', { exe, cmdArgs: cmdArgs.join(' ') });
```

## Comments

**When to Comment:**
- Module-level JSDoc for exported functions (e.g., `lib/logger.js` has usage documentation at top)
- Section headers with ASCII visual separators (e.g., `// ── Initialize modules ───────────────────────────────`)
- No extensive inline comments; code is generally self-documenting

**JSDoc/TSDoc:**
- Minimal JSDoc usage observed
- When present, documents function purpose and usage
- Example from `lib/logger.js`:
```javascript
/**
 * lib/logger.js — Logging module with stderr mode for MCP stdio transport.
 *
 * Usage:
 *   const { createLogger } = require('./lib/logger');
 *   const { log, debug } = createLogger(__dirname, { stderrMode: false });
 */
```

## Function Design

**Size:** Functions are generally concise, ranging from 5–50 lines. Larger functions (50–100+ lines) handle complex workflows (e.g., API route handlers, scaffolding logic).

**Parameters:**
- Destructured parameters used for options objects:
```javascript
function createLogger(appRoot, options = {}) {
  const { stderrMode = false, debugEnabled = false } = options;
  // ...
}

async function connect(serverConfig) {
  const { id, transport, command, args, env, url } = serverConfig;
  // ...
}
```
- Keep to 2–4 parameters; use object destructuring for multiple related values

**Return Values:**
- Functions return:
  - Result objects with success/error info: `{ connected: true, modelCount }`
  - Data structures: arrays, objects
  - Promises for async operations
  - Sometimes `null` or empty arrays on error (with silent catch)

## Module Design

**Exports:**
- CommonJS `module.exports` in Node.js modules:
```javascript
module.exports = {
  initConfig,
  getConfig,
  updateConfig,
  loadConfig,
  saveConfig
};
```

- ES6 `export default` and named exports in React components:
```jsx
export function Effects3DProvider({ children }) { /* ... */ }
export function use3DEffects() { /* ... */ }
export default function MessageBubble({ role, content, streaming }) { /* ... */ }
```

**Barrel Files:**
- Not extensively used; direct imports preferred
- Most components imported directly: `import MessageBubble from './components/MessageBubble'`

**Class Definitions:**
- Classes used for stateful managers: `McpClientManager`, `ToolCallHandler`
- Constructor accepts logger object: `constructor(logger)` or `constructor(options)`
- Internal state stored as instance properties: `this.connections = new Map()`

## Tailwind CSS Conventions

**Styling:**
- Utility-first Tailwind CSS for all component styling
- Custom class names for common patterns: `glass`, `glass-neon`, `glass-heavy`, `fade-in`, `neon-glow-sm`, `typing-dot`
- Responsive classes used minimally; most designs are responsive by default
- Dark theme dominant: slate, indigo, and amber color palette

---

*Convention analysis: 2026-03-13*
