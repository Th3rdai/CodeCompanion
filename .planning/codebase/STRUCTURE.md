# Codebase Structure

**Analysis Date:** 2026-03-14

## Directory Layout

```
[project-root]/
├── server.js              # Express app, API routes, MCP HTTP
├── mcp-server.js           # MCP stdio entry point
├── vite.config.js          # Vite build config
├── electron-builder.config.js
├── lib/                    # Backend modules
├── mcp/                    # MCP tool registrations and schemas
├── src/                    # React frontend
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── components/
│   ├── components/3d/      # 3D effects
│   ├── components/builders/# Builder mode panels
│   ├── components/ui/      # Shared UI (Splite)
│   └── contexts/
├── electron/               # Electron main process
├── tests/                  # Playwright + node:test
├── tests/ui/               # UI/E2E specs
├── tests/e2e/              # E2E specs
├── tests/unit/             # Unit tests
├── tests/test/             # Duplicate test layout (unit + e2e)
├── resources/              # Icons, DMG background
├── public/                 # Legacy static (fallback if no dist)
├── dist/                   # Vite build output
├── .planning/              # Planning docs
└── design-system/          # Design docs
```

## Directory Purposes

**lib/:**
- Purpose: Backend business logic
- Contains: `config.js`, `ollama-client.js`, `prompts.js`, `review.js`, `builder-score.js`, `builder-schemas.js`, `history.js`, `file-browser.js`, `github.js`, `icm-scaffolder.js`, `maker-skill.js`, `mcp-client-manager.js`, `tool-call-handler.js`, `mcp-api-routes.js`, `logger.js`, `review-schema.js`
- Key files: `ollama-client.js`, `prompts.js`, `builder-score.js`, `mcp-client-manager.js`

**mcp/:**
- Purpose: MCP tool definitions
- Contains: `tools.js`, `schemas.js`
- Key files: `tools.js` (registerAllTools)

**src/components/:**
- Purpose: React UI components
- Contains: ReviewPanel, ReportCard, CreateWizard, FileBrowser, GitHubPanel, SettingsPanel, OnboardingWizard, JargonGlossary, etc.
- Key files: `ReviewPanel.jsx`, `CreateWizard.jsx`, `builders/BaseBuilderPanel.jsx`

**src/components/3d/:**
- Purpose: 3D visual effects
- Contains: SplashScreen, ParticleField, FloatingGeometry, HeaderScene, EmptyStateScene, TypingIndicator3D, ParticleBurst, TokenCounter, OrbitingBadge, SplineScene, Spline3DError

**src/components/builders/:**
- Purpose: Builder mode panels (Prompting, Skillz, Agentic)
- Contains: BaseBuilderPanel, BuilderScoreCard, PromptingPanel, SkillzPanel, AgenticPanel

**electron/:**
- Purpose: Desktop app
- Contains: main.js, preload.js, menu.js, data-manager.js, window-state.js, updater.js, ollama-setup.js, ide-launcher.js, splash.html

**tests/:**
- Purpose: All tests
- Contains: `*.test.js` (node:test), `ui/*.spec.js`, `e2e/*.spec.js`, `unit/*.spec.js`, `test/unit/*.test.js`, `test/e2e/*.spec.js`

## Key File Locations

**Entry Points:**
- `server.js`: Express server
- `mcp-server.js`: MCP stdio server
- `electron/main.js`: Electron main process
- `src/main.jsx`: React mount

**Configuration:**
- `vite.config.js`: Vite, alias `@` → `./src`
- `electron-builder.config.js`: Desktop packaging
- `playwright.config.js`: Playwright, default `BASE_URL` http://127.0.0.1:4173 (matches `webServer` `FORCE_HTTP=1`), `chromium` project

**Core Logic:**
- `lib/ollama-client.js`: Ollama API
- `lib/prompts.js`: System prompts for all modes
- `lib/review.js`: Code review
- `lib/builder-score.js`: Builder scoring
- `lib/icm-scaffolder.js`: Create mode scaffolding

**Testing:**
- `playwright.config.js`: E2E config
- `tests/rate-limit.test.js`, `tests/mcp-security.test.js`: Node unit tests
- `tests/ui/*.spec.js`, `tests/e2e/*.spec.js`: Playwright specs

## Naming Conventions

**Files:**
- PascalCase for React components: `ReviewPanel.jsx`, `BaseBuilderPanel.jsx`
- kebab-case for lib: `file-browser.js`, `mcp-client-manager.js`
- camelCase for entry: `mcp-server.js`

**Directories:**
- lowercase: `lib`, `mcp`, `src`, `electron`, `tests`, `resources`

## Where to Add New Code

**New API endpoint:**
- Add route in `server.js` (after rate limiters, before SPA fallback)
- Add handler logic in `lib/` if non-trivial

**New mode:**
- Add to MODES in `src/App.jsx`
- Add SYSTEM_PROMPTS entry in `lib/prompts.js`
- Add mode-specific component if needed

**New builder mode:**
- Add panel in `src/components/builders/`
- Add schema in `lib/builder-schemas.js`
- Add SCORE_SCHEMAS and scoreJsonSchemas entry
- Add prompt in `lib/prompts.js`

**New MCP tool:**
- Add schema in `mcp/schemas.js`
- Register in `mcp/tools.js` via `register()`

**New component:**
- `src/components/` for feature components
- `src/components/ui/` for shared primitives

**Utilities:**
- `lib/` for backend
- `src/` inline or small helpers for frontend

## Special Directories

**dist/:**
- Purpose: Vite production build
- Generated: Yes (`npm run build`)
- Committed: No (in .gitignore)

**release/:**
- Purpose: electron-builder output
- Generated: Yes
- Committed: No

**node_modules/:**
- Generated: Yes
- Committed: No

**tests/test/:**
- Purpose: Appears to duplicate tests/unit and tests/e2e layout
- Contains: `test/unit/icm-scaffolder.test.js`, `test/e2e/create-mode.spec.js`
- Consider consolidating with `tests/unit` and `tests/e2e`

---

*Structure analysis: 2026-03-14*
