# Technology Stack

**Analysis Date:** 2026-03-13

## Languages

**Primary:**
- JavaScript (Node.js) - Backend server, library modules, MCP integration
- JSX - React frontend components and UI logic
- CSS - Styling via Tailwind CSS and custom index.css

**Secondary:**
- HTML - Single entry point (index.html, served via Vite)

## Runtime

**Environment:**
- Node.js (version not pinned in package.json; check `.nvmrc` or CI config for specifics)

**Package Manager:**
- npm - Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Express 4.18.2 - REST API backend and static file serving
- React 19.2.4 - Frontend UI framework
- React Router 7.13.1 - Frontend routing (used in src/App.jsx)

**Build/Development:**
- Vite 7.3.1 - Build tool and dev server for React frontend
- @vitejs/plugin-react 5.1.4 - JSX/TSX support for Vite

**Testing:**
- Playwright (@playwright/test) - E2E test configuration via playwright.config.js (port 4173)

**Styling:**
- Tailwind CSS 4.2.1 - Utility-first CSS framework
- @tailwindcss/vite 4.2.1 - Vite plugin for Tailwind
- PostCSS 8.5.8 - CSS transformation
- Autoprefixer 10.4.27 - Vendor prefix automation

## Key Dependencies

**Critical:**
- @modelcontextprotocol/sdk 1.27.1 - Model Context Protocol implementation for tool management
  - Server: McpServer, StreamableHTTPServerTransport for hosting MCP endpoints
  - Client: Client, StdioClientTransport, StreamableHTTPClientTransport for connecting to external MCP servers
- Ollama REST API - Used via http (default: http://localhost:11434) for LLM inference

**UI/Visualization:**
- @splinetool/react-spline 4.1.0 - React wrapper for 3D Spline scenes
- three 0.183.2 - 3D graphics library (used by custom 3D components)
- lucide-react 0.577.0 - Icon library

**Content Processing:**
- marked 17.0.4 - Markdown parser for rendering chat responses
- highlight.js 11.11.1 - Syntax highlighting for code blocks in Markdown

**Utilities:**
- uuid 9.0.0 - Generate unique conversation IDs
- clsx 2.1.1 - Conditional CSS class utilities
- tailwind-merge 3.5.0 - Merge Tailwind utility classes without conflicts
- class-variance-authority 0.7.1 - TypeScript-first CSS-in-JS variant system
- zod 4.3.6 - Runtime type validation (optional or minimal use)

## Configuration

**Environment:**
- `.env` file (not tracked) - Spline scene URLs via VITE_SPLINE_* variables
- `.env.example` - Template with required Spline variables:
  - `VITE_SPLINE_SPLASH_SCENE`
  - `VITE_SPLINE_HEADER_SCENE`
  - `VITE_SPLINE_EMPTY_STATE_SCENE`

**Build:**
- `vite.config.js` - Vite configuration with React plugin, Tailwind CSS, and API proxy to http://localhost:3000
- `playwright.config.js` - E2E test configuration for testing at http://127.0.0.1:4173

**Server Config:**
- `.cc-config.json` - Runtime configuration file stored at root
  - `ollamaUrl` - Ollama server URL (default: http://localhost:11434)
  - `icmTemplatePath` - Path to ICM project template (for Create wizard)

## Platform Requirements

**Development:**
- Node.js runtime
- Ollama server running locally at configured URL (default http://localhost:11434)
- Spline design account for 3D scene URLs (optional but app detects missing scenes gracefully)

**Production:**
- Node.js runtime
- Ollama server accessible via configured URL
- Static files served from `dist/` (Vite build output) or fallback to `public/`

---

*Stack analysis: 2026-03-13*
