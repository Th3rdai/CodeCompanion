# Technology Stack

**Analysis Date:** 2026-03-14

## Languages

**Primary:**

- JavaScript (ESM + CommonJS) - Frontend (React), backend (Node.js), Electron main process
- JSX - React components in `src/`

**Secondary:**

- None (no TypeScript)

## Runtime

**Environment:**

- Node.js (version from package.json engines not specified; project uses modern Node features)

**Package Manager:**

- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**

- React 19.2.4 - UI framework
- Express 4.18.2 - Backend API server
- Vite 7.3.1 - Build tool and dev server
- Electron 41.0.2 - Desktop packaging

**Testing:**

- Playwright 1.58.2 - E2E and UI tests
- Node.js built-in `node:test` - Unit tests (rate-limit, mcp-security, tone-validation, etc.)

**Build/Dev:**

- @vitejs/plugin-react 5.1.4 - React Fast Refresh
- @tailwindcss/vite 4.2.1 - Tailwind CSS v4 integration
- electron-builder 26.8.1 - Desktop app packaging

## Key Dependencies

**Critical:**

- `@modelcontextprotocol/sdk` ^1.27.1 - MCP server (stdio + HTTP) and client support
- `zod` ^4.3.6 - Schema validation for builder scoring and MCP tools
- `marked` ^17.0.4 - Markdown rendering
- `dompurify` ^3.3.3 - XSS sanitization for user content
- `highlight.js` ^11.11.1 - Code syntax highlighting

**Infrastructure:**

- `archiver` ^7.0.1 - Data export (ZIP)
- `extract-zip` ^2.0.1 - Data import
- `uuid` ^9.0.0 - Conversation IDs
- `electron-log` ^5.4.3 - Desktop logging
- `electron-updater` ^6.8.3 - Auto-updates

**UI:**

- `@headlessui/react` ^2.2.9 - Accessible components
- `lucide-react` ^0.577.0 - Icons
- `three` ^0.183.2 - 3D effects (SplashScreen, ParticleField, etc.)
- `@splinetool/react-spline` ^4.1.0 - Spline 3D scenes
- `class-variance-authority` ^0.7.1, `clsx` ^2.1.1, `tailwind-merge` ^3.5.0 - Styling utilities

## Configuration

**Environment:**

- `PORT` - Server port (default 3000)
- `CC_DATA_DIR` - Data root for config, history, logs (default: project root)
- `DEBUG` - Set to `1` or `true` for verbose logging
- `RATE_LIMIT_*` - Rate limit tuning (window, max per endpoint)

**Build:**

- `vite.config.js` - Vite config, `@` alias to `./src`, proxy `/api` and `/mcp` to backend
- `electron-builder.config.js` - Mac (dmg/zip), Windows (nsis/zip), Linux (AppImage/zip)

## Platform Requirements

**Development:**

- Node.js 18+ (for `node:test`, fetch, AbortController)
- Ollama running locally (optional for full functionality)
- npm or compatible package manager

**Production:**

- Web: Static files served from `dist/` by Express
- Desktop: Electron bundles `dist/`, `lib/`, `mcp/`, `server.js`, `mcp-server.js`, `electron/`, `resources/`

---

_Stack analysis: 2026-03-14_
