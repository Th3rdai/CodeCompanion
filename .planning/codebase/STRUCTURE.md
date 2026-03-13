# Codebase Structure

**Analysis Date:** 2026-03-13

## Directory Layout

```
code-companion/
├── src/                        # Frontend React source (entry for build)
│   ├── App.jsx                # Root component (29KB, monolithic state container)
│   ├── main.jsx               # Entry point (14 lines) — ReactDOM mount
│   ├── index.css              # Global Tailwind + custom glass morphism styles
│   ├── components/            # 24 React components
│   │   ├── 3d/               # Visual effects (11 components)
│   │   │   ├── SplashScreen.jsx
│   │   │   ├── HeaderScene.jsx
│   │   │   ├── EmptyStateScene.jsx
│   │   │   ├── SplineScene.jsx
│   │   │   ├── TypingIndicator3D.jsx
│   │   │   ├── ParticleField.jsx
│   │   │   ├── FloatingGeometry.jsx
│   │   │   ├── ParticleBurst.jsx
│   │   │   ├── OrbitingBadge.jsx
│   │   │   ├── TokenCounter.jsx
│   │   │   └── Spline3DError.jsx
│   │   ├── ui/                # UI kit
│   │   │   └── Splite.jsx     # Split pane divider component
│   │   ├── MessageBubble.jsx  # Chat message renderer
│   │   ├── Sidebar.jsx        # Conversation list with search/archive
│   │   ├── SettingsPanel.jsx  # Config UI (Ollama URL, project folder, GitHub)
│   │   ├── FileBrowser.jsx    # Project file tree explorer
│   │   ├── GitHubPanel.jsx    # Clone/browse repos UI
│   │   ├── McpServerPanel.jsx # MCP server connection manager
│   │   ├── McpClientPanel.jsx # MCP client external tools UI
│   │   ├── CreateWizard.jsx   # Project scaffolder UI
│   │   ├── RenameModal.jsx    # Conversation rename dialog
│   │   ├── ContextMenu.jsx    # Right-click menu
│   │   ├── MarkdownContent.jsx # Render AI markdown responses
│   │   ├── Toast.jsx          # Notifications
│   │   └── (others)           # Additional UI components
│   └── contexts/              # Global state
│       └── Effects3DContext.jsx # 3D effects toggle provider
├── lib/                        # Backend service layer (Node.js modules)
│   ├── ollama-client.js        # Ollama REST API wrapper (listModels, chatStream, chatComplete)
│   ├── mcp-client-manager.js   # MCP connection lifecycle (connect, disconnect, callTool)
│   ├── tool-call-handler.js    # Parse TOOL_CALL patterns, execute tools
│   ├── prompts.js              # System prompts for each mode (chat, explain, bugs, etc.)
│   ├── config.js               # Config persistence (.cc-config.json)
│   ├── history.js              # Conversation CRUD (JSON files in history/)
│   ├── file-browser.js         # Project file navigation (buildFileTree, readProjectFile)
│   ├── github.js               # GitHub integration (cloneRepo, listUserRepos, validateToken)
│   ├── mcp-api-routes.js       # Express routes for MCP management (/api/mcp/*)
│   ├── logger.js               # Structured logging (app.log, debug.log)
│   └── icm-scaffolder.js       # Project template scaffolding (Create mode)
├── mcp/                        # MCP server implementation
│   ├── tools.js                # Tool definitions and registration
│   └── schemas.js              # Zod validation schemas for MCP config
├── server.js                   # Express backend entry point (651 lines)
├── vite.config.js              # Vite build & dev config (alias: @, proxy to backend)
├── playwright.config.js        # E2E test configuration
├── package.json                # Dependencies, scripts, version info
├── package-lock.json           # Dependency lock file
├── .cc-config.json             # Runtime config (Ollama URL, GitHub token, MCP servers)
├── .env                        # Environment variables (not committed, contains secrets)
├── .env.example                # Template for .env
├── .gitignore                  # Git ignore rules
├── CLAUDE.md                   # Project AI assistant instructions
├── README.md                   # Project overview and setup
├── dist/                       # Vite production build output (created by npm run build)
├── history/                    # Conversation history (created on first chat)
│   └── {uuid}.json            # One JSON file per conversation
├── logs/                       # Application logs (created on startup)
│   ├── app.log                # INFO level logs
│   └── debug.log              # DEBUG level logs
├── github-repos/               # Cloned GitHub repositories (created on first clone)
│   └── {owner}-{repo}/        # One directory per cloned repo
├── node_modules/               # npm dependencies (gitignored)
└── test/                       # Test files (minimal, reference only)
    ├── unit/                  # Unit test stubs
    └── e2e/                   # E2E test stubs
```

## Directory Purposes

**`src/`:** Frontend source code
- Purpose: React SPA compiled by Vite
- Contains: Components, styling, contexts
- Key files: `App.jsx` (root state, all modes, chat loop), `main.jsx` (entry)
- Compiled to: `dist/` by Vite build

**`lib/`:** Backend service layer
- Purpose: Domain logic and external integrations
- Contains: Ollama, MCP, GitHub, file system, config, logging
- Pattern: Each module exports functions; no classes except McpClientManager
- Entry point for: `server.js` imports all lib modules

**`mcp/`:** MCP server setup
- Purpose: Register tools that external tools can call
- Contains: Tool definitions and schemas
- Used by: `server.js` when creating MCP server factory
- Related: `lib/mcp-api-routes.js` for client management API

**`dist/`:** Build output
- Purpose: Vite production build (React + Tailwind compiled)
- Generated by: `npm run build`
- Served by: Express.js as static files
- Contents: `index.html`, `assets/` (JS/CSS chunks)

**`history/`:** Conversation storage
- Purpose: Persist conversations between sessions
- Format: One JSON file per conversation (UUID-named)
- Created: On first `POST /api/history`
- Cleanup: Manual deletion or via UI

**`logs/`:** Application logging
- Purpose: Debug and error logging
- Files: `app.log` (INFO), `debug.log` (DEBUG)
- Created: On startup
- Accessed: Via `GET /api/logs` endpoint

**`github-repos/`:** Cloned repositories
- Purpose: Local cache of cloned GitHub repos
- Format: `{owner}-{repo}/` directories
- Created: On first clone via GitHub panel
- Cleanup: Via GitHub UI (delete button)

## Key File Locations

**Entry Points:**

- **Frontend:** `src/main.jsx` (14 lines)
  - Creates ReactDOM root
  - Wraps App with `Effects3DProvider`
  - Mounts to `#root` element

- **Backend:** `server.js` (651 lines)
  - Express app setup
  - Route registration
  - Initialization: config, history, logger, Ollama connection

**Configuration:**

- `.cc-config.json` — Runtime config (Ollama URL, GitHub token, MCP clients)
  - Read by: `lib/config.js` on startup
  - Written by: `POST /api/config`, MCP connection endpoints
  - Example keys: `ollamaUrl`, `projectFolder`, `githubToken`, `mcpClients`

- `.env` — Environment variables (secrets, never committed)
  - Example: `OLLAMA_URL`, `DEBUG`, `PORT`
  - Not used directly; add to `.cc-config.json` if needed

- `vite.config.js` — Build configuration
  - Plugins: React, Tailwind CSS
  - Proxy: `/api/*` → `http://localhost:3000`
  - Alias: `@` → `src/`

**Core Logic:**

- `src/App.jsx` — Main component
  - 516 lines, monolithic state management
  - Manages: modes, chat loop, sidebar, settings, file browser, GitHub panel
  - Calls: `POST /api/chat`, `GET /api/config`, `POST /api/history`, etc.

- `server.js` — Express server
  - Routes: `/api/config`, `/api/models`, `/api/chat`, `/api/history/*`, `/api/files/*`, `/api/github/*`, `/mcp`
  - Middlewares: JSON parsing, static file serving, logging
  - Key logic: Chat streaming loop with tool-call recursion

- `lib/ollama-client.js` — Ollama wrapper
  - 81 lines
  - Exports: `listModels()`, `chatStream()`, `chatComplete()`, `checkConnection()`
  - Pattern: Fetch-based REST calls to Ollama

- `lib/mcp-client-manager.js` — MCP connection manager
  - 126 lines
  - Exports: `connect()`, `disconnect()`, `callTool()`, `getAllTools()`, `getStatuses()`
  - Pattern: Manages Map of connections, supports stdio and HTTP transports

**System Prompts:**

- `lib/prompts.js` — Mode definitions
  - Exports: `SYSTEM_PROMPTS`, `VALID_MODES`
  - Contains: Structured prompts for each mode (explain, bugs, refactor, translate-tech, translate-biz)
  - Pattern: Each mode includes guardrail to handle non-code inputs

**Testing:**

- `test/unit/` — Unit test stubs (reference only)
- `test/e2e/` — E2E test stubs (reference only)
- Note: Minimal test coverage; primary testing via manual/browser

## Naming Conventions

**Files:**

- **Components:** `ComponentName.jsx` (PascalCase, matches export)
  - Example: `MessageBubble.jsx` exports `MessageBubble`

- **Contexts:** `ContextName.jsx` or `ContextNameContext.jsx`
  - Example: `Effects3DContext.jsx`

- **Services/Utils:** `service-name.js` (kebab-case)
  - Example: `mcp-client-manager.js`, `ollama-client.js`

- **Config/Data:** Descriptive lowercase
  - Example: `.cc-config.json`, `prompts.js`

**Directories:**

- **Feature dirs:** Lowercase plural
  - Example: `components/`, `lib/`, `mcp/`

- **3D effects:** `3d/` (numeric prefix for ordering)

- **Contexts:** `contexts/` (singular purpose)

**Variables & Functions:**

- **React state:** `state` + `setState` (camelCase)
  - Example: `[messages, setMessages]`

- **Functions:** `camelCase`
  - Example: `buildFileTree()`, `chatComplete()`

- **Constants:** `UPPERCASE_SNAKE_CASE`
  - Example: `MODES`, `SYSTEM_PROMPTS`, `TEXT_EXTENSIONS`

- **Private methods:** Prefixed with `_`
  - Example: `_config`, `_historyDir` (module-private)

## Where to Add New Code

**New Chat Feature/Mode:**
1. Add system prompt to `lib/prompts.js` (SYSTEM_PROMPTS dict)
2. Add mode to MODES array in `src/App.jsx`
3. Add placeholder text to mode definition
4. Update guardrail if special format needed

**New Component:**
- Location: `src/components/FeatureName.jsx`
- Pattern: Export default React component with props
- Example: Import in `src/App.jsx`, render based on state

**New Backend Endpoint:**
- Location: `server.js` (or `lib/mcp-api-routes.js` if MCP-related)
- Pattern: `app.get/post/delete('/api/route', handler)`
- Helper function: Extract to `lib/module-name.js` for reusability

**New Service/Lib Module:**
- Location: `lib/service-name.js`
- Pattern: Export functions (no classes except manager patterns)
- Import in: `server.js` or other modules that need it

**New External Integration:**
- Research & client: `lib/service-name.js` (REST/SDK wrapper)
- API endpoint: Add to `server.js` or `lib/*-api-routes.js`
- UI: Component in `src/components/`
- Example: GitHub integration follows this pattern

**New System Utility:**
- Location: `lib/util-name.js` (if backend) or `src/utils/` (if frontend)
- Organize: Group related functions in single file
- Example: `lib/file-browser.js` has `buildFileTree()` and `readProjectFile()`

**New 3D Visual Effect:**
- Location: `src/components/3d/EffectName.jsx`
- Pattern: React component using Three.js or Canvas API
- Toggle: Use `Effects3DContext` for enable/disable
- Example: `ParticleField.jsx`, `FloatingGeometry.jsx`

## Special Directories

**`node_modules/`:**
- Purpose: npm dependency storage
- Generated: By `npm install`
- Committed: No (gitignored)
- Cleanup: Delete if disk space needed; `npm install` restores

**`dist/`:**
- Purpose: Production build output
- Generated: By `npm run build`
- Committed: No (gitignored)
- Served by: Express.js in production
- Contains: Compiled React bundle, CSS, assets

**`history/`:**
- Purpose: Conversation storage
- Generated: On first conversation save
- Committed: No (gitignored, user data)
- Format: `{uuid}.json` with conversation data
- Cleanup: Manual via UI or filesystem

**`logs/`:**
- Purpose: Runtime logging
- Generated: On startup
- Committed: No (gitignored, sensitive)
- Files: `app.log`, `debug.log`
- Accessed: Via `GET /api/logs` endpoint or filesystem

**`github-repos/`:**
- Purpose: Cloned GitHub repos
- Generated: On first clone
- Committed: No (gitignored, large external data)
- Format: `{owner}-{repo}/` subdirectories
- Cleanup: Manual via GitHub UI

---

*Structure analysis: 2026-03-13*
