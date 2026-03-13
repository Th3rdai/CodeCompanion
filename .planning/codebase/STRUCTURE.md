# Codebase Structure

**Analysis Date:** 2026-03-13

## Directory Layout

```
AIApp-CodeCompanion/
├── server.js                   # Express backend entry point (793 lines)
├── mcp-server.js              # MCP server for CLI/stdio transport
├── package.json               # Dependencies, build/dev scripts
├── index.html                 # Vite HTML entry point
├── vite.config.js             # Vite build config
├── playwright.config.js       # E2E test config
├── .cc-config.json            # User config (Ollama URL, project folder)
│
├── src/                        # React frontend source
│   ├── main.jsx              # React entry: Effects3DProvider + App
│   ├── App.jsx               # Main app component (664 lines) — mode logic, chat, history
│   ├── index.css             # Tailwind + custom styles
│   │
│   ├── components/           # React components by feature
│   │   ├── Sidebar.jsx       # Conversation list, search, archive
│   │   ├── MessageBubble.jsx # User/assistant message display
│   │   ├── MarkdownContent.jsx  # Markdown rendering with syntax highlighting
│   │   ├── Toast.jsx         # Notification popups
│   │   ├── RenameModal.jsx   # Conversation rename dialog
│   │   ├── SettingsPanel.jsx # Ollama URL, GitHub token config
│   │   ├── CreateWizard.jsx  # ICM project scaffolding UI
│   │   ├── DashboardPanel.jsx # Analytics, mode/model usage
│   │   ├── FileBrowser.jsx   # Project file tree, file reading
│   │   ├── GitHubPanel.jsx   # Clone repos, browse GitHub
│   │   ├── McpClientPanel.jsx # MCP client connection UI
│   │   ├── McpServerPanel.jsx # MCP server HTTP endpoint status
│   │   ├── ContextMenu.jsx   # Right-click menus
│   │   ├── ui/
│   │   │   └── Splite.jsx    # Splittable panel component
│   │   └── 3d/               # Three.js + Spline 3D effects
│   │       ├── SplashScreen.jsx    # Animated intro screen
│   │       ├── HeaderScene.jsx     # Animated header with geometry
│   │       ├── EmptyStateScene.jsx # Idle screen animation
│   │       ├── FloatingGeometry.jsx # Floating 3D cubes/shapes
│   │       ├── ParticleField.jsx   # Background particle effect
│   │       ├── ParticleBurst.jsx   # Burst animation on send
│   │       ├── TypingIndicator3D.jsx # 3D typing indicator
│   │       ├── TokenCounter.jsx    # Token usage display
│   │       ├── OrbitingBadge.jsx   # Orbiting badge element
│   │       ├── SplineScene.jsx     # Spline design loader
│   │       └── Spline3DError.jsx   # Fallback for Spline errors
│   │
│   └── contexts/
│       └── Effects3DContext.jsx # Context for 3D effect state/controls
│
├── lib/                        # Backend business logic modules
│   ├── ollama-client.js       # Ollama REST API client (80 lines)
│   │   └── Exports: listModels, checkConnection, chatStream, chatComplete
│   ├── history.js             # Conversation CRUD with JSON files (71 lines)
│   │   └── Exports: initHistory, listConversations, getConversation, saveConversation, deleteConversation
│   ├── config.js              # Config file I/O (52 lines)
│   │   └── Exports: initConfig, getConfig, updateConfig
│   ├── logger.js              # Custom logger with timestamps (49 lines)
│   │   └── Exports: createLogger
│   ├── file-browser.js        # File tree building, text file detection (110 lines)
│   │   └── Exports: buildFileTree, readProjectFile, isTextFile, TEXT_EXTENSIONS, IGNORE_DIRS
│   ├── github.js              # GitHub API client, git clone wrapper (311 lines)
│   │   └── Exports: cloneRepo, deleteClonedRepo, listClonedRepos, listUserRepos, validateToken
│   ├── icm-scaffolder.js      # ICM project template scaffolding (317 lines)
│   │   └── Exports: scaffoldProject
│   ├── tool-call-handler.js   # TOOL_CALL parsing and MCP execution (84 lines)
│   │   └── Exports: ToolCallHandler class with parseToolCalls, executeTool, buildToolsPrompt
│   ├── mcp-client-manager.js  # MCP client lifecycle and registry (125 lines)
│   │   └── Exports: McpClientManager class
│   ├── mcp-api-routes.js      # MCP HTTP routes (176 lines)
│   │   └── Exports: createMcpApiRoutes, recordToolCall
│   └── prompts.js             # System prompts for each mode (90 lines)
│       └── Exports: SYSTEM_PROMPTS object
│
├── public/                    # Static assets (legacy, overridden by dist/)
│   ├── favicon.png
│   ├── apple-touch-icon.png
│   └── ...
│
├── dist/                      # Vite production build output (optional)
│   ├── index.html
│   └── assets/
│
├── history/                   # Conversation storage (created at runtime)
│   ├── {uuid}.json           # Each conversation as JSON file
│   └── ...
│
├── logs/                      # Server logs (created if DEBUG enabled)
│   └── ...
│
├── mcp/                       # MCP server configuration and tools
│   └── tools/                # Tool definitions (if any bundled)
│
├── test/                      # Test suite
│   ├── unit/
│   │   └── icm-scaffolder.test.js
│   └── e2e/
│       └── create-mode.spec.js
│
├── MAKER_framework/           # Unrelated external framework (generated, not part of core)
│
├── .planning/                 # GSD phase planning documents
│   ├── codebase/             # Analysis docs (ARCHITECTURE.md, STRUCTURE.md, etc.)
│   └── phases/               # Phase execution plans
│
└── !ARCHIVES/                # Archived/legacy code (pre-Vite build)
```

## Directory Purposes

**src/**
- Purpose: React frontend source code
- Contains: JSX components, CSS, context providers
- Key files: `App.jsx` (main logic), `main.jsx` (entry)

**lib/**
- Purpose: Backend business logic and utilities
- Contains: API clients, data access, domain logic
- Key files: `ollama-client.js`, `history.js`, `file-browser.js`, `github.js`

**public/**
- Purpose: Static assets served by Express
- Contains: Images, fonts, favicon
- Note: Overridden by `dist/` if Vite build exists

**dist/**
- Purpose: Vite production build output
- Contains: Minified HTML, JS, CSS, assets
- Generated: `npm run build`
- Served: If exists, takes precedence over `public/`

**history/**
- Purpose: Conversation history storage
- Contains: `{uuid}.json` files, one per conversation
- Generated: At runtime when user saves conversations
- Structure: `{ id, title, mode, model, messages, createdAt, archived }`

**test/**
- Purpose: Automated tests
- Contains: Unit tests (`test/unit/`), E2E tests (`test/e2e/`)
- Key files: `icm-scaffolder.test.js`, `create-mode.spec.js`

**mcp/**
- Purpose: MCP server configuration
- Contains: Tool registrations, MCP server setup
- Key files: Managed by MCP SDK

## Key File Locations

**Entry Points:**

- `index.html`: HTML document root. Loads Vite entry and Tailwind fonts.
- `src/main.jsx`: React entry point. Sets up Effects3DProvider, mounts App.
- `server.js`: Express server entry. Initializes modules, mounts routes, starts listening.

**Configuration:**

- `.cc-config.json`: User config (Ollama URL, project folder, GitHub token, MCP settings)
- `vite.config.js`: Build config, React plugin, Tailwind integration
- `playwright.config.js`: E2E test runner config
- `package.json`: Dependencies, scripts

**Core Logic:**

- `server.js`: Main API router with `/api/chat`, `/api/history`, `/api/files`, `/api/github`, `/api/create-project`
- `src/App.jsx`: Main React component with mode switching, message handling, UI orchestration
- `lib/ollama-client.js`: Ollama API integration (models, chat stream, completion)
- `lib/history.js`: Conversation persistence (list, get, save, delete)
- `lib/file-browser.js`: Project file tree building and text file detection

**Testing:**

- `test/unit/icm-scaffolder.test.js`: Unit tests for project scaffolding
- `test/e2e/create-mode.spec.js`: Playwright E2E tests for create wizard

**System Prompts:**

- `lib/prompts.js`: SYSTEM_PROMPTS object with prompts for each mode (chat, explain, bugs, refactor, translate-tech, translate-biz, dashboard, create)

## Naming Conventions

**Files:**

- Components: `PascalCase.jsx` (e.g., `Sidebar.jsx`, `MessageBubble.jsx`)
- Libraries: `kebab-case.js` (e.g., `ollama-client.js`, `file-browser.js`)
- Tests: `*.test.js` or `*.spec.js` (e.g., `icm-scaffolder.test.js`)
- Config: lowercase with extension (e.g., `.cc-config.json`, `vite.config.js`)

**Directories:**

- Components: lowercase (e.g., `components/`, `components/3d/`)
- Features: lowercase plural (e.g., `components/`, `contexts/`)
- Tests: `test/` with subdirs by type (e.g., `test/unit/`, `test/e2e/`)

**Variables & Functions:**

- React components: `PascalCase` (e.g., `function App() {}`, `export default Sidebar`)
- Functions/hooks: `camelCase` (e.g., `fetchConfig()`, `showToast()`, `useCallback`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `TEXT_EXTENSIONS`, `IGNORE_DIRS`, `SYSTEM_PROMPTS`)
- State variables: `camelCase` (e.g., `const [messages, setMessages]`, `const [streaming, setStreaming]`)

**Routes:**

- API endpoints: `/api/{resource}/{action}` (e.g., `/api/chat`, `/api/history/:id`, `/api/files/tree`)
- RESTful verbs: GET (read), POST (create/execute), DELETE (remove), no PUT
- Suffixes: Action-specific (e.g., `/api/github/clone`, `/api/github/token`)

## Where to Add New Code

**New Feature (Chat Mode):**
- Primary code: Add mode to `MODES` array in `src/App.jsx` (line 23), add system prompt to `lib/prompts.js`
- UI panel: Create `src/components/NewModePanel.jsx` if custom UI needed
- Backend route: Add handler in `server.js` if special processing needed
- Tests: Add case in `test/e2e/` for user flow

**New Component:**
- Implementation: `src/components/{FeatureName}.jsx`
- Import in `src/App.jsx` and render conditionally based on mode/state
- Use Tailwind CSS classes for styling (no separate CSS files)
- Export as default: `export default function ComponentName() {}`

**New Backend Utility:**
- Implementation: `lib/{domain}.js` with clear exports
- Initialize in `server.js` lines 5-19 if stateful
- Export named functions, not default
- Example: `module.exports = { func1, func2 }`

**3D Effect:**
- Implementation: `src/components/3d/{EffectName}.jsx`
- Use Three.js or @splinetool/react-spline
- Integrate with `Effects3DContext` for shared state
- Import and use in layout components (Sidebar, header sections)

**Test:**
- Unit: `test/unit/{module}.test.js` using Jest
- E2E: `test/e2e/{feature}.spec.js` using Playwright
- Run: `npm test` (if configured) or `npx playwright test`

**Styling:**
- Use Tailwind CSS utility classes directly in JSX
- No CSS modules or separate stylesheets
- Custom utilities in `src/index.css` if needed
- Design tokens: indigo/slate color palette, glass-morphism effects

## Special Directories

**history/**
- Purpose: Conversation storage
- Generated: Yes (created at runtime when user saves)
- Committed: No (.gitignore excludes)
- Structure: JSON files, named by UUID

**dist/**
- Purpose: Vite production build output
- Generated: Yes (`npm run build`)
- Committed: No (.gitignore excludes)
- Note: Served by Express if present, fallback to `public/`

**logs/**
- Purpose: Debug logs
- Generated: Yes (when DEBUG=1)
- Committed: No (.gitignore excludes)
- Structure: Timestamped log files

**node_modules/**
- Purpose: Installed dependencies
- Generated: Yes (`npm install`)
- Committed: No (.gitignore excludes)

**MAKER_framework/**
- Purpose: External framework (unrelated to core app)
- Generated: Yes (external tool)
- Committed: Yes (but separate from src/)
- Note: Not part of Code Companion codebase structure

**!ARCHIVES/**
- Purpose: Archived legacy code (pre-Vite)
- Generated: No (manually organized)
- Committed: Yes
- Note: Reference only, not used in running app

---

*Structure analysis: 2026-03-13*
