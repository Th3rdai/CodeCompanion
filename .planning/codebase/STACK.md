# Technology Stack

**Analysis Date:** 2026-03-14

## Languages

**Primary:**
- JavaScript (Node.js) - Backend server, library modules, MCP integration, Electron main process
- JSX - React frontend components and UI logic
- CSS - Styling via Tailwind CSS v4 and custom `src/index.css`

**Secondary:**
- HTML - Single entry point (`index.html`, served via Vite)

**Not used:** TypeScript (no tsconfig, no .ts/.tsx files)

## Runtime

**Environment:**
- Node.js - No version pinned in `package.json` engines; no `.nvmrc` or `.node-version` detected

**Package Manager:**
- npm - Lockfile: `package-lock.json` present (lockfileVersion 3)

## Frameworks

**Core:**
- Express 4.18.2 - REST API backend, static file serving, MCP HTTP transport
- React 19.2.4 - Frontend UI framework
- React Router 7.13.1 - Frontend routing (used in `src/App.jsx`)

**Build/Development:**
- Vite 7.3.1 - Build tool and dev server for React frontend
- @vitejs/plugin-react 5.1.4 - JSX/TSX support for Vite

**Testing:**
- Playwright (@playwright/test 1.58.2) - E2E tests via `playwright.config.js` (base URL http://127.0.0.1:4173)
- @playwright/experimental-ct-react 1.58.2 - Component tests via `playwright-ct.config.js` (port 3100)

**Desktop:**
- Electron 41.0.2 (devDependency) - Desktop app shell; entry: `electron/main.js`
- electron-builder 26.8.1 - Packaging for mac (dmg/zip), win (nsis/zip), linux (AppImage/zip)
- electron-updater 6.8.3 - Auto-updates from GitHub Releases
- electron-log 5.4.3 - Logging in Electron main process

**Styling:**
- Tailwind CSS 4.2.1 - Utility-first CSS via `@tailwindcss/vite` plugin
- @tailwindcss/vite 4.2.1 - Vite plugin (no separate `tailwind.config.js`; Tailwind v4 uses `@theme` in CSS)
- PostCSS 8.5.8 - CSS transformation
- Autoprefixer 10.4.27 - Vendor prefix automation

## Key Dependencies

**Critical:**
- @modelcontextprotocol/sdk 1.27.1 - MCP implementation
  - Server: McpServer, StreamableHTTPServerTransport (HTTP at `/mcp`), StdioServerTransport (stdio in `mcp-server.js`)
  - Client: Client, StdioClientTransport, StreamableHTTPClientTransport (in `lib/mcp-client-manager.js`)
- Ollama REST API - Native fetch to http://localhost:11434 (configurable via `.cc-config.json`)

**UI/Visualization:**
- @splinetool/react-spline 4.1.0 - React wrapper for 3D Spline scenes
- three 0.183.2 - 3D graphics (custom components in `src/components/3d/`)
- lucide-react 0.577.0 - Icon library
- @headlessui/react 2.2.9 - Accessible UI primitives

**Content Processing:**
- marked 17.0.4 - Markdown parser for chat responses
- highlight.js 11.11.1 - Syntax highlighting in code blocks
- dompurify 3.3.3 - XSS sanitization for rendered content

**Utilities:**
- uuid 9.0.0 - Unique conversation IDs
- clsx 2.1.1, tailwind-merge 3.5.0, class-variance-authority 0.7.1 - CSS class utilities
- zod 4.3.6 - Runtime validation (`lib/review-schema.js`, `lib/builder-schemas.js`)
- archiver 7.0.1, extract-zip 2.0.1 - Data export/import (Electron)

**Build:**
- sharp 0.34.5 (devDependency) - Image processing for electron-builder icons

## Configuration

**Environment:**
- `.env` (git-ignored) - Optional; Spline scene URLs via `VITE_SPLINE_*`
- `.env.example` - Template for Spline variables

**Build:**
- `vite.config.js` - React plugin, Tailwind, `@` alias to `./src`, proxy `/api` and `/mcp` to port 3000
- `electron-builder.config.js` - App ID `com.th3rdai.code-companion`, output `release/`, GitHub publish
- `playwright.config.js` - Test dir `./tests`, webServer `PORT=4173 node server.js`
- `playwright-ct.config.js` - Component tests in `./tests/ui`, Chromium only

**Server Config:**
- `.cc-config.json` - Stored at data root (default: project root)
  - `ollamaUrl` - Default http://localhost:11434
  - `icmTemplatePath` - ICM project template path
  - `mcpServer` - httpEnabled, disabledTools
  - `preferredPort` - Port preference for Electron

## Platform Requirements

**Development:**
- Node.js runtime
- Ollama server at configured URL (default http://localhost:11434)
- Spline scene URLs optional (app handles missing scenes)

**Production:**
- Node.js runtime
- Static files from `dist/` (Vite build) or fallback `public/`

**Desktop (Electron):**
- macOS, Windows, or Linux
- Auto-updates via GitHub Releases (th3rdai/code-companion)

---

*Stack analysis: 2026-03-14*
