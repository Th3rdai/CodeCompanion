# Codebase Structure

**Analysis Date:** 2026-03-14

## Directory Layout

```
AIApp-CodeCompanion/
├── server.js                   # Express backend entry point
├── mcp-server.js               # MCP stdio server (Cursor, Claude Code)
├── package.json                # Dependencies, scripts (electron:dev, electron:build)
├── index.html                  # Vite HTML entry
├── vite.config.js              # Vite + React + Tailwind, proxy /api /mcp → 3000
├── electron-builder.config.js  # Electron packaging config
│
├── electron/                   # Electron main process
│   ├── main.js                 # App lifecycle, spawn server, BrowserWindow, IPC
│   ├── preload.js              # contextBridge → window.electronAPI
│   ├── data-manager.js         # resolveDataDirectory, migrateDevData, export/import
│   ├── window-state.js         # loadWindowState, saveWindowState
│   ├── menu.js                 # createMenu (File, Edit, View, Help)
│   ├── updater.js              # initAutoUpdater
│   ├── ollama-setup.js         # checkOllamaRunning, installOllama, pullModel
│   ├── ide-launcher.js         # launchIDE (cursor, windsurf, opencode, claude-code)
│   └── splash.html             # Splash screen before app load
│
├── src/                        # React frontend
│   ├── main.jsx                # React entry: Effects3DProvider + App
│   ├── App.jsx                 # Main app: mode routing, chat, history, panels
│   ├── index.css               # Tailwind + custom styles
│   │
│   ├── components/
│   │   ├── Sidebar.jsx         # Conversation list, archive, mode filter
│   │   ├── MessageBubble.jsx   # User/assistant message display
│   │   ├── MarkdownContent.jsx  # Markdown + syntax highlighting (highlight.js)
│   │   ├── Toast.jsx           # Notification popup
│   │   ├── RenameModal.jsx     # Conversation rename
│   │   ├── SettingsPanel.jsx   # Ollama URL, project folder, GitHub, MCP
│   │   ├── CreateWizard.jsx    # ICM project scaffolding UI
│   │   ├── ReviewPanel.jsx     # Review mode: upload/paste/browse, ReportCard
│   │   ├── ReportCard.jsx      # Report card display (grades, findings)
│   │   ├── FileBrowser.jsx     # Project file tree, attach to chat
│   │   ├── GitHubPanel.jsx     # Clone, browse, open repo
│   │   ├── McpClientPanel.jsx  # MCP client connection UI (in Settings)
│   │   ├── McpServerPanel.jsx  # MCP server status (in Settings)
│   │   ├── OnboardingWizard.jsx # First-time onboarding
│   │   ├── OllamaSetup.jsx     # Ollama install/pull wizard (Electron)
│   │   ├── JargonGlossary.jsx  # Glossary panel
│   │   ├── PrivacyBanner.jsx   # Privacy notice
│   │   ├── ConnectionDot.jsx   # Connection status indicator
│   │   ├── LoadingAnimation.jsx
│   │   ├── DictateButton.jsx
│   │   ├── ContextMenu.jsx
│   │   ├── ui/Splite.jsx       # Animated beam accent
│   │   ├── builders/           # Builder mode panels
│   │   │   ├── BaseBuilderPanel.jsx
│   │   │   ├── PromptingPanel.jsx
│   │   │   ├── SkillzPanel.jsx
│   │   │   ├── AgenticPanel.jsx
│   │   │   └── BuilderScoreCard.jsx
│   │   └── 3d/                 # Three.js / Spline effects
│   │       ├── SplashScreen.jsx
│   │       ├── HeaderScene.jsx
│   │       ├── EmptyStateScene.jsx
│   │       ├── FloatingGeometry.jsx
│   │       ├── ParticleField.jsx
│   │       ├── ParticleBurst.jsx
│   │       ├── TypingIndicator3D.jsx
│   │       ├── TokenCounter.jsx
│   │       ├── OrbitingBadge.jsx
│   │       ├── SplineScene.jsx
│   │       └── Spline3DError.jsx
│   │
│   └── contexts/
│       └── Effects3DContext.jsx
│
├── lib/                        # Backend modules
│   ├── config.js               # initConfig, getConfig, updateConfig → .cc-config.json
│   ├── history.js              # initHistory, listConversations, getConversation, saveConversation, deleteConversation
│   ├── logger.js               # createLogger
│   ├── ollama-client.js        # listModels, checkConnection, chatStream, chatComplete, chatStructured
│   ├── prompts.js              # SYSTEM_PROMPTS (chat, explain, bugs, refactor, translate-*, review, review-fallback, create)
│   ├── review.js               # reviewCode (structured + fallback)
│   ├── review-schema.js        # ReportCardSchema, reportCardJsonSchema (Zod)
│   ├── builder-score.js        # scoreContent (prompting, skillz, agentic)
│   ├── builder-schemas.js      # PromptScoreSchema, SkillScoreSchema, AgentScoreSchema
│   ├── file-browser.js         # buildFileTree, readProjectFile, isWithinBasePath, TEXT_EXTENSIONS, IGNORE_DIRS
│   ├── github.js               # cloneRepo, deleteClonedRepo, listClonedRepos, listUserRepos, validateToken
│   ├── icm-scaffolder.js       # scaffoldProject
│   ├── mcp-client-manager.js   # McpClientManager (connect, disconnect, callTool, getAllTools)
│   ├── mcp-api-routes.js       # createMcpApiRoutes (MCP server/client CRUD)
│   ├── tool-call-handler.js    # ToolCallHandler (parseToolCalls, executeTool, buildToolsPrompt)
│   └── maker-skill.js          # Maker skill (builder support)
│
├── mcp/                        # MCP server tools and schemas
│   ├── tools.js                # registerAllTools (6 mode + 5 utility tools)
│   └── schemas.js              # modeToolSchema, browseFilesSchema, readFileSchema, etc. (Zod)
│
├── public/                     # Static assets (fallback if dist/ missing)
├── dist/                       # Vite build output (served by Express when present)
├── resources/                  # Electron icons, data-readme.txt
├── github-repos/               # Cloned repos (created at runtime)
│
├── tests/                      # Playwright tests
│   ├── ui/                     # Component tests (JargonGlossary, OnboardingWizard, etc.)
│   ├── e2e/                    # E2E (review-workflow.spec.js)
│   └── test/                   # Unit (icm-scaffolder), E2E (create-mode)
│
├── .planning/
│   └── codebase/               # ARCHITECTURE.md, STRUCTURE.md, STACK.md, etc.
│
└── !ARCHIVES/                  # Archived legacy code
```

## Directory Purposes

**electron/**
- Purpose: Desktop app shell, data isolation, IDE launching
- Key: main.js spawns server, preload.js exposes IPC; data in userData/CodeCompanion-Data

**src/components/builders/**
- Purpose: Builder mode panels (prompting, skillz, agentic) with score cards
- Extends BaseBuilderPanel; uses BuilderScoreCard for display

**lib/**
- Purpose: Backend business logic, schemas, API clients
- review.js + review-schema.js: Review mode structured output
- builder-score.js + builder-schemas.js: Builder mode scoring

**mcp/**
- Purpose: MCP tool definitions shared by HTTP and stdio transports
- tools.js: registerAllTools with createModeHandler for 6 modes
- schemas.js: Zod schemas for tool parameters

## Key File Locations

**Entry Points:**
- `server.js`: Express app, route mounting, MCP HTTP at `/mcp`
- `src/main.jsx`: React bootstrap
- `electron/main.js`: Electron app, server spawn, window management
- `mcp-server.js`: MCP stdio server

**Persistence:**
- Config: `{dataRoot}/.cc-config.json` — ollamaUrl, projectFolder, githubToken, mcpClients, mcpServer, preferredPort, lastActiveMode
- History: `{dataRoot}/history/{uuid}.json`
- Logs: `{dataRoot}/logs/app.log`, `logs/debug.log`
- Dev dataRoot: `CC_DATA_DIR` or `__dirname`
- Electron dataRoot: `app.getPath('userData')/CodeCompanion-Data`

**Shared Schemas:**
- `lib/review-schema.js`: ReportCardSchema (overallGrade, topPriority, categories)
- `lib/builder-schemas.js`: PromptScoreSchema, SkillScoreSchema, AgentScoreSchema
- `mcp/schemas.js`: modeToolSchema, browseFilesSchema, readFileSchema

**Mode Routing:**
- `src/App.jsx`: MODES array (line ~31), BUILDER_MODES (line 44)
- Conditional render: review → ReviewPanel; BUILDER_MODES → PromptingPanel/SkillzPanel/AgenticPanel; create → CreateWizard; else → chat area

## API Routes Summary

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/config | Get sanitized config |
| POST | /api/config | Update ollamaUrl, projectFolder |
| GET | /api/models | List Ollama models |
| POST | /api/chat | SSE chat (streaming or tool-call loop) |
| POST | /api/review | Structured report card or SSE fallback |
| POST | /api/score | Builder score card or SSE fallback |
| GET/POST/DELETE | /api/history, /api/history/:id | Conversation CRUD |
| GET | /api/files/tree, /api/files/read | File browser |
| POST | /api/files/upload | Inline file upload |
| POST | /api/create-project | ICM scaffold |
| POST/GET/DELETE | /api/github/* | Clone, repos, token, browse |
| POST | /api/launch-{cursor,windsurf,opencode,claude-code} | IDE launcher |
| GET | /api/logs | Debug log viewer |
| * | /mcp | MCP HTTP transport |
| GET/POST | /api/mcp/server/* | MCP server toggle, tools, stats |
| GET/POST/PUT/DELETE | /api/mcp/clients/* | MCP client CRUD, connect, disconnect |

## Where to Add New Code

**New Chat Mode:**
- Add to MODES in `src/App.jsx`
- Add SYSTEM_PROMPTS key in `lib/prompts.js`
- Optionally add MCP tool in `mcp/tools.js` via createModeHandler

**New Builder Mode:**
- Add to MODES and BUILDER_MODES in `src/App.jsx`
- Add schema in `lib/builder-schemas.js` (SCORE_SCHEMAS)
- Add panel in `src/components/builders/`
- Add case in `server.js` POST /api/score validModes
- Add score logic in `lib/builder-score.js`

**New API Route:**
- Add handler in `server.js` or mount router from `lib/`
- Add rate limiter if needed (see createRateLimiter pattern)

**New Electron IPC:**
- Add handler in `electron/main.js` ipcMain.handle
- Expose in `electron/preload.js` contextBridge

## Special Directories

**history/** (under dataRoot)
- Generated at runtime
- Not committed (.gitignore)
- One JSON file per conversation

**github-repos/**
- Created when user clones repos
- Sibling to app root
- Path: `path.resolve(__dirname, 'github-repos')`

**dist/**
- Generated by `npm run build`
- Served by Express when present; fallback to public/

---

*Structure analysis: 2026-03-14*
