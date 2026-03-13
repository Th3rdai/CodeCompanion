# Technology Stack

**Analysis Date:** 2026-03-13

## Languages

**Primary:**
- JavaScript (Node.js) - Server-side backend, configuration, utilities
- JSX/JavaScript - Frontend React components and application code
- CSS - Styling via Tailwind CSS with PostCSS

**Secondary:**
- JSON - Configuration and data files

## Runtime

**Environment:**
- Node.js - Primary runtime for backend (server.js)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (inferred from npm usage)

## Frameworks

**Backend:**
- Express 4.18.2 - HTTP server for API endpoints and static file serving

**Frontend:**
- React 19.2.4 - UI component library
- React Router DOM 7.13.1 - Client-side routing
- React 18+ features used (hooks, contexts)

**3D Graphics:**
- Three.js 0.183.2 - WebGL 3D rendering for custom visual effects
- @splinetool/react-spline 4.1.0 - Spline 3D scene integration (splash, header, empty states)

**Build/Dev:**
- Vite 7.3.1 - Frontend build tool and dev server
- @vitejs/plugin-react 5.1.4 - React JSX plugin for Vite
- Tailwind CSS 4.2.1 - Utility-first CSS framework
- @tailwindcss/vite 4.2.1 - Tailwind CSS Vite plugin
- PostCSS 8.5.8 - CSS transformation
- Autoprefixer 10.4.27 - CSS vendor prefixes

**UI & Styling:**
- class-variance-authority 0.7.1 - Component styling utilities
- clsx 2.1.1 - Utility for conditionally joining classNames
- tailwind-merge 3.5.0 - Merge Tailwind CSS classes intelligently
- lucide-react 0.577.0 - Icon library

**Markdown & Code Highlighting:**
- marked 17.0.4 - Markdown parser and renderer
- highlight.js 11.11.1 - Syntax highlighting for code blocks

**AI/LLM Integration:**
- @modelcontextprotocol/sdk 1.27.1 - MCP (Model Context Protocol) server and client SDKs for external tool integration

**Data & Validation:**
- zod 4.3.6 - TypeScript-first schema validation
- uuid 9.0.0 - UUID generation for conversation IDs

## Key Dependencies

**Critical:**
- @modelcontextprotocol/sdk 1.27.1 - Enables MCP server/client mode for Claude, Cursor, and other tools; allows registering custom tools
- marked 17.0.4 - Essential for rendering markdown responses from Ollama LLMs
- highlight.js 11.11.1 - Code syntax highlighting in responses

**Infrastructure:**
- Express 4.18.2 - Core server framework
- Vite 7.3.1 - Modern build system and dev server
- React 19.2.4 - UI foundation

**3D & Visuals:**
- Three.js 0.183.2 - Custom 3D effects (particle fields, floating geometry, token counters)
- @splinetool/react-spline 4.1.0 - Spline scene loader for pre-built 3D scenes

## Configuration

**Environment:**
- `.env.example` - Template for environment variables
- `.env` - Actual environment file (in `.gitignore`)
- Environment vars: `VITE_SPLINE_SPLASH_SCENE`, `VITE_SPLINE_HEADER_SCENE`, `VITE_SPLINE_EMPTY_STATE_SCENE` (Spline scene URLs)

**Build:**
- `vite.config.js` - Vite configuration with React plugin, Tailwind CSS Vite plugin, path alias (`@/`)
- `package.json` - Main project manifest with dependencies and scripts

**Config Files:**
- `.cc-config.json` - Code Companion config file (saved at runtime, tracked in code)
  - `ollamaUrl` - Ollama server URL (default: `http://localhost:11434`)
  - `projectFolder` - Active project folder for file browser
  - `githubToken` - GitHub PAT for private repo cloning
  - `mcpClients` - Array of MCP client configurations (auto-connect settings)
  - `mcpServer` - MCP HTTP server settings

## Platform Requirements

**Development:**
- Node.js (version not pinned in package.json, but modern version required for async/await)
- npm for dependency management
- Modern browser with ES6+ support and WebGL for 3D effects

**Production:**
- Node.js runtime
- Local Ollama instance at configurable URL (default: `http://192.168.50.7:11424` per instructions, but defaults to `http://localhost:11434` in code)
- Optional: GitHub personal access token for private repo cloning

**Storage:**
- Local filesystem for:
  - Conversation history (`./history/` - JSON files with UUID filenames)
  - Cloned GitHub repos (`./github-repos/` - directrory per clone)
  - Application logs (`./logs/` - `app.log`, `debug.log`)
  - Vite build output (`./dist/` - production build)

## Scripts

**Development:**
- `npm run dev:server` - Start Express server (port 3000)
- `npm run dev:client` - Start Vite dev server (port 5173) with hot reload
- `npm run dev` - Run both server and client in parallel

**Production:**
- `npm run build` - Build frontend with Vite → `dist/`
- `npm run start` - Start Express server serving `dist/`
- `npm run preview` - Build and serve production build

**MCP Mode:**
- `npm run mcp` - Run stdio MCP server (for Claude Desktop, Cursor, etc.)
- `npm run mcp:inspect` - Inspect MCP server with MCP Inspector tool

## Notable Patterns

**No External Database:**
- All data persisted as JSON files locally
- History stored per-conversation as JSON
- Config stored as `.cc-config.json`

**Dual Mode:**
- Web UI (React SPA with Express backend)
- MCP Server mode (for Claude Desktop, Cursor integration)

**Streaming Architecture:**
- Server-Sent Events (SSE) for real-time token streaming from Ollama
- Word-by-word streaming for tool-call responses

**External Tool Integration:**
- MCP clients can connect to external servers (stdio or HTTP)
- Tool results injected back into LLM context (agentic loop)

---

*Stack analysis: 2026-03-13*
