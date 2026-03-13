# Codebase Structure

**Analysis Date:** 2026-03-13

## Directory Layout

```
code-companion/
├── src/                        # Frontend React source code
│   ├── App.jsx                # Root component (516 lines, monolithic)
│   ├── main.jsx               # Entry point (14 lines) — mounts React to DOM
│   ├── index.css              # Global Tailwind + custom styles
│   ├── components/            # 15+ reusable React components
│   │   ├── 3d/               # Three.js and visual effects (11 components)
│   │   ├── ui/               # Base UI components (Splite split pane)
│   │   └── *.jsx             # Domain components (Chat, Settings, FileBrowser, etc.)
│   └── contexts/             # Global state providers
│       └── Effects3DContext.jsx # Toggle for 3D visual effects
├── public/                     # Static assets
│   ├── favicon.png
│   ├── icon-192.png
│   ├── logo.svg
│   └── apple-touch-icon.png
├── lib/                        # Backend Node.js modules (service layer)
│   ├── ollama-client.js        # Ollama REST API wrapper
│   ├── mcp-client-manager.js   # MCP connection lifecycle
│   ├── tool-call-handler.js    # Parse/execute tool calls from LLM
│   ├── prompts.js              # System prompts for each mode
│   ├── config.js               # App config persistence
│   ├── history.js              # Conversation history CRUD
│   ├── file-browser.js         # Project file system navigation
│   ├── github.js               # GitHub integration (clone, auth, browse)
│   ├── mcp-api-routes.js       # Express routes for MCP management
│   ├── logger.js               # Logging to files
│   ├── icm-scaffolder.js       # Project template scaffolding
│   └── tool-call-handler.js    # Tool call parsing and execution
├── mcp/                        # MCP server implementation
│   ├── tools.js                # Tool definitions for MCP server
│   └── schemas.js              # Zod schemas for MCP config
├── server.js                   # Express backend entry point (651 lines)
├── vite.config.js              # Vite build configuration
├── package.json                # Node.js dependencies and scripts
├── .cc-config.json             # Application config (Ollama URL, GitHub token, MCP clients)
├── .env                        # Environment variables (not committed)
├── dist/                       # Vite production build output
├── history/                    # Conversation history JSON files (created on first chat)
├── logs/                       # Application and debug logs
├── github-repos/               # Cloned GitHub repositories (created on first clone)
├── node_modules/               # Dependencies (npm install)
└── test/                       # Test files (minimal, reference only)
```

## Directory Purposes

**`src/`:**
- Purpose: Frontend React application source code
- Contains: Components, styles, contexts, entry points
- Key files: `App.jsx` (main logic container), `main.jsx` (DOM mount), `index.css` (global styles)
- Build artifact: Vite compiles to `dist/` for production

**`src/components/`:**
- Purpose: Reusable React components organized by feature domain
- Contains: 25+ components including UI panels, dialogs, 3D visuals, message bubbles
- Key directories: `3d/` (11 Three.js/Spline visual components), `ui/` (base UI primitives)
- Pattern: Each component is a single .jsx file using React hooks

**`src/contexts/`:**
- Purpose: Global state providers accessible via hooks
- Contains: Effects3DContext for toggling 3D visual effects on/off
- Key exports: `Effects3DProvider` (wraps app), `use3DEffects()` hook

**`lib/`:**
- Purpose: Backend service modules (Express middleware, domain logic)
- Contains: 11 self-contained modules, each handling one domain concern
- Imports: Mostly standalone; some depend on other lib modules (e.g., tool-call-handler imports from mcp-client-manager)
- Pattern: CommonJS modules with clear exports (functions, classes, objects)
- No database ORM; direct file I/O and API calls

**`mcp/`:**
- Purpose: MCP (Model Context Protocol) server implementation
- Contains: Tool definitions exposed to external clients
- Key file: `tools.js` (registerAllTools function registers all built-in capabilities)
- Exports: Schemas and tool registrations for MCP HTTP server

**`public/`:**
- Purpose: Static web assets (images, icons)
- Served: Via Express.static in server.js, copied to dist on build
- Contains: Favicon, app icon, logo SVG

**`dist/`:**
- Purpose: Vite-compiled production frontend build
- Generated: By `npm run build`, checked into git
- Served: As static files by Express if present; fallback to public/

**`history/`:**
- Purpose: Persistent storage for conversation history
- Created: Automatically on first conversation save
- Contents: JSON files named by conversation UUID (e.g., `abc-123-def.json`)
- Not committed: Listed in .gitignore

**`logs/`:**
- Purpose: Application runtime logs
- Contents: `app.log` (info/error), `debug.log` (debug-level when DEBUG=1)
- Not committed: Listed in .gitignore
- Viewable: Via GET `/api/logs` endpoint in Settings panel

**`github-repos/`:**
- Purpose: Cache for cloned GitHub repositories
- Created: On first GitHub clone operation
- Contents: Full git repositories checked out to local folder
- Not committed: Listed in .gitignore
- Managed: DELETE `/api/github/repos/:dirName` removes clone

**`node_modules/`:**
- Purpose: npm dependencies
- Managed: `npm install` from package.json and package-lock.json
- Not committed

**`test/`:**
- Purpose: Test files (reference only, not actively maintained)
- Contains: Minimal test setup
- Status: Not part of CI/CD pipeline in current codebase

## Key File Locations

**Entry Points:**

- `server.js`: Backend server main — initializes config, logger, routes, MCP clients, listens on port 3000
- `src/main.jsx`: Frontend entry — imports App, mounts React to #root DOM element
- `src/App.jsx`: Root React component — 516 lines managing all frontend state, modes, UI panels
- `vite.config.js`: Build configuration for Vite dev server and production build

**Configuration:**

- `.cc-config.json`: Runtime configuration (Ollama URL, projectFolder, GitHub token, MCP client definitions)
- `package.json`: Node.js dependencies, scripts (start, dev, build, mcp, preview)
- `vite.config.js`: Vite build settings (React plugin, Tailwind integration, API proxying for dev)
- `.env.example`: Environment variable template (PORT, DEBUG, Ollama URL)

**Core Logic:**

**Backend (Server Layer):**
- `server.js`: 651 lines — all Express routes, middleware, initialization (monolithic)

**Backend (Service Layer):**
- `lib/ollama-client.js`: Ollama REST wrapper (listModels, chatStream, chatComplete)
- `lib/mcp-client-manager.js`: MCP connection lifecycle (connect, disconnect, callTool)
- `lib/tool-call-handler.js`: Tool call parsing (`TOOL_CALL:` regex), execution, system prompt injection
- `lib/prompts.js`: System prompts for 7 modes (chat, explain, bugs, refactor, translate-tech, translate-biz, create)
- `lib/config.js`: Config file read/write (initConfig, getConfig, updateConfig)
- `lib/history.js`: Conversation CRUD (getConversation, saveConversation, listConversations, deleteConversation)
- `lib/file-browser.js`: File system navigation (buildFileTree, readProjectFile, isTextFile, TEXT_EXTENSIONS)
- `lib/github.js`: GitHub integration (cloneRepo, deleteClonedRepo, listClonedRepos, listUserRepos, validateToken)
- `lib/mcp-api-routes.js`: MCP management endpoints (connect/disconnect/list clients)
- `lib/icm-scaffolder.js`: Project scaffold generation for Create mode
- `lib/logger.js`: File-based logging (createLogger, log, debug)

**Frontend (Components):**
- `src/App.jsx`: Main component — state management (516 lines), mode selection, message rendering
- `src/components/Sidebar.jsx`: Conversation history navigation
- `src/components/SettingsPanel.jsx`: Config UI (Ollama URL, project folder, GitHub token, MCP client management)
- `src/components/FileBrowser.jsx`: Project file tree browser
- `src/components/GitHubPanel.jsx`: GitHub repo browser and clone UI
- `src/components/MessageBubble.jsx`: Individual chat message rendering
- `src/components/MarkdownContent.jsx`: Markdown rendering with syntax highlighting
- `src/components/CreateWizard.jsx`: Multi-step project scaffolding UI
- `src/components/McpClientPanel.jsx`: MCP client connection management
- `src/components/McpServerPanel.jsx`: MCP server status display

**Frontend (3D/Visual):**
- `src/components/3d/SplashScreen.jsx`: Spline 3D welcome screen
- `src/components/3d/HeaderScene.jsx`: Header visual effect (Three.js or Spline)
- `src/components/3d/EmptyStateScene.jsx`: Empty chat state visual
- `src/components/3d/ParticleField.jsx`: Background particle animation
- `src/components/3d/FloatingGeometry.jsx`: Floating geometric shapes
- `src/components/3d/TypingIndicator3D.jsx`: 3D typing indicator
- `src/components/3d/ParticleBurst.jsx`: Particle burst on send
- `src/components/3d/TokenCounter.jsx`: Token usage visualization
- `src/components/3d/OrbitingBadge.jsx`: Badge with orbit animation

**Frontend (Contexts & Utils):**
- `src/contexts/Effects3DContext.jsx`: Global 3D effects toggle (provider + hook)
- `src/components/ui/Splite.jsx`: Split pane component
- `src/index.css`: Global Tailwind styles and custom CSS

**Testing:**

- `test/`: Directory with minimal test setup (reference only)

## Naming Conventions

**Files:**

- React components: PascalCase (e.g., `App.jsx`, `SettingsPanel.jsx`, `ParticleField.jsx`)
- Backend modules: kebab-case (e.g., `ollama-client.js`, `mcp-client-manager.js`)
- Styles: `index.css` (global), no component-scoped CSS files (Tailwind inline)
- Config: `.cc-config.json`, `.env`

**Directories:**

- Feature domain: PascalCase groupings by concern (e.g., `3d/`, `ui/`, `components/`)
- Lowercase for generic: `src/`, `lib/`, `mcp/`, `public/`, `dist/`, `history/`, `logs/`, `github-repos/`

**Functions/Exports:**

- Async API calls: camelCase with verb (e.g., `listModels()`, `chatStream()`, `validateToken()`)
- Factory functions: lowercase with Factory suffix (e.g., `createMcpServer()`, `createLogger()`)
- Class constructors: PascalCase (e.g., `McpClientManager`, `ToolCallHandler`)
- Hooks: `use` prefix (e.g., `use3DEffects()`)
- Context providers: `PascalCase` + `Provider` suffix (e.g., `Effects3DProvider`)

**Constants:**

- All caps with underscores (e.g., `SYSTEM_PROMPTS`, `MODES`, `TEXT_EXTENSIONS`, `TOOL_CALL_PATTERN`, `STORAGE_KEY`)
- Default values: Prefix with underscore if private (e.g., `MAX_ROUNDS`)

## Where to Add New Code

**New Feature (e.g., new chat mode):**

1. **System Prompt:**
   - Add to `SYSTEM_PROMPTS` object in `lib/prompts.js`
   - Key: mode ID (e.g., `'my-mode'`)
   - Value: prompt text with expected format

2. **Frontend Mode:**
   - Add to `MODES` array in `src/App.jsx` (id, label, icon, desc, placeholder)

3. **Handler (if needed):**
   - Add mode-specific logic in `server.js` POST `/api/chat` if needed (currently mode just changes system prompt)

4. **Tests (optional):**
   - Add test case in `test/` directory

**New Component:**

1. **Implementation:** `src/components/ComponentName.jsx`
2. **Import:** Add to `src/App.jsx` imports
3. **Usage:** Render in App.jsx JSX
4. **Styling:** Use Tailwind classes inline; no separate CSS file
5. **State:** Lift to App.jsx if needs to be shared, use local useState if component-scoped
6. **Context:** Use `use3DEffects()` hook if needs 3D effects toggle

**New Backend Service:**

1. **Module:** `lib/service-name.js` (kebab-case filename)
2. **Exports:** Clear named exports or default export
3. **Imports:** Require in `server.js` if needs API exposure
4. **Tests:** Add to `test/` if complex logic

**New Backend Route:**

1. **Handler:** Add to `server.js` (app.get/post/delete/put)
2. **Path:** Follow REST convention `/api/{resource}` or `/api/{resource}/{id}`
3. **Logging:** Call `log('INFO', message, context)` for important operations
4. **Error handling:** Return appropriate status code (400, 404, 500) with error JSON
5. **Response format:** Return `{ success: true, data }` or `{ error: message }`

**New Utilities:**

- Small helpers: Inline in component or `src/components/` file
- Reusable utilities: `lib/util-name.js` (backend) or `src/utils/` (frontend if created)

**New 3D Component:**

1. **File:** `src/components/3d/ComponentName.jsx`
2. **Dependency:** Use Three.js, Spline, or Babylon.js
3. **Conditional render:** Use `use3DEffects()` hook to allow toggle
4. **Integration:** Render in App.jsx conditionally based on context

## Special Directories

**`dist/`:**
- Purpose: Production-ready frontend build
- Generated: `npm run build` (Vite)
- Committed: Yes, checked into git for easy deployment
- Never edit manually; regenerate via npm run build

**`history/`:**
- Purpose: Persistent conversation storage
- Generated: Automatically on first conversation
- Committed: No (.gitignore)
- Structure: UUID-named JSON files per conversation
- Cleanup: Manual delete or via DELETE API route

**`logs/`:**
- Purpose: Runtime diagnostics
- Generated: Automatically on server start
- Committed: No (.gitignore)
- Retention: App logs roll over; check last 50 lines via Settings panel
- Debug: Enable with DEBUG=1 environment variable

**`github-repos/`:**
- Purpose: Cache for cloned repositories
- Generated: On first clone operation (POST `/api/github/clone`)
- Committed: No (.gitignore)
- Structure: `owner-repo/` directories containing full .git clone
- Cleanup: Via DELETE `/api/github/repos/:dirName` route

**`.env` (local only):**
- Purpose: Local overrides (port, debug, Ollama URL)
- Committed: No (.gitignore, but .env.example committed as template)
- Contains: Secrets (GitHub token may be stored via Settings UI instead)
- Template: See `.env.example`

---

*Structure analysis: 2026-03-13*
