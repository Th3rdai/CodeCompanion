# Code Companion — Vibe Coder Edition

## Identity
You are a full-stack developer building **Code Companion**, a web application that helps vibe coders (non-technical users who generate code with AI tools) understand, review, and improve their AI-generated code. It connects to locally-hosted Ollama LLMs to provide friendly, jargon-free explanations, code reviews with report-card grading, and guided fix suggestions.

## Tech Stack
- **Backend**: Node.js with Express, no external DB
- **Frontend**: React 18 + Tailwind CSS, built with Vite
- **AI**: Ollama REST API (configurable URL, default `http://localhost:11434`)
- **Storage**: JSON files for conversation history and config
- **Streaming**: Server-Sent Events for real-time AI responses
- **MCP**: Model Context Protocol server (HTTP + stdio) and client support

## Project Structure
| Path | Purpose |
|------|---------|
| server.js | Express app, API routes, MCP HTTP endpoint |
| mcp-server.js | MCP stdio entry point |
| lib/ | Backend modules (config, ollama-client, prompts, review, builder-score, builder-schemas, file-browser, history, github, icm-scaffolder, build-scaffolder, build-registry, gsd-bridge, maker-skill, pentest, pentest-schema, validate, mcp-client-manager, mcp-api-routes, tool-call-handler) |
| mcp/ | MCP tool registrations and Zod schemas |
| src/App.jsx | Main React app with 16 modes |
| src/components/ | 30+ React components (ReviewPanel, SecurityPanel, SecurityReport, ValidatePanel, CreateWizard, BuildWizard, FileBrowser, GitHubPanel, SettingsPanel, Sidebar, MermaidBlock, etc.) |
| src/components/builders/ | Builder mode panels (BaseBuilderPanel, BuilderScoreCard, PromptingPanel, SkillzPanel, AgenticPanel) |
| src/components/3d/ | Visual effects (SplashScreen, ParticleField, FloatingGeometry, etc.) |
| .planning/ | Project planning docs (ROADMAP.md, REQUIREMENTS.md, STATE.md) |
| tests/ | Unit tests (node:test in tests/unit/, tests/*.test.js) and Playwright tests (tests/ui/, tests/e2e/) |
| dist/ | Production build output |

## Sixteen Modes
Chat, Explain This, Safety Check, Clean Up, Code → Plain English, Idea → Code Spec, Diagram, Security, Validate, Review, Create, Prompting, Skillz, Agentic, Build

### Save Chat
Download entire conversation as a markdown file with auto-generated 1-2 word topic filename. Available via toolbar button in all modes.

### Deployment
- **HTTPS**: Auto-generated self-signed cert via `deploy.sh`, fallback to HTTP if no cert
- **Port**: Configurable (default 8900), stored in `.cc-config.json`
- **Health checks**: Protocol-aware in `startup.sh`

### Diagram Mode
Renders Mermaid.js diagrams inline in AI responses. Any mode can produce `\`\`\`mermaid` code blocks that render as interactive SVG diagrams. Mermaid.js is lazy-loaded on first use (separate Vite chunk). During streaming, mermaid blocks show as raw code; after completion, they render as diagrams. Export buttons (Source/SVG/PNG) appear on each diagram. The `MarkdownContent` component uses a custom `marked` renderer to intercept mermaid blocks and a split-and-render pattern to mix HTML segments with React `MermaidBlock` components.

### Builder Modes (Prompting, Skillz, Agentic)
Three builder modes share a common BaseBuilderPanel architecture with config-driven fields, AI-powered scoring via `/api/score`, and CRUD workflows (create, load, view, revise, score, save, download). Each mode scores content across 4 categories with letter grades (A-F). Revision flow: AI generates improved content in `<revised_prompt>` tags → user clicks "Apply Revision & Re-Score" → formDataRef syncs immediately → re-scoring reads updated content.

**File Loading:** Files can be loaded into builder forms via two paths: (1) File Browser "Load into Form" button routes files through `builderAttachRef` → `loadFileIntoForm()`, or (2) native "Load from File" picker in the builder header. Both call `config.parseLoaded(content)` to deserialize file content into form fields. The `parseLoaded` functions handle YAML frontmatter (`---` delimiters) and fall back to treating the full body as instructions when no structured sections are found.

**Scoring Methodologies:**
- **Prompting**: TÂCHES meta-prompting methodology — evaluates clarity (Golden Rule), specificity, structure (XML tags, success criteria), effectiveness
- **Skillz**: Agent Skills Specification (agentskills.io) — evaluates completeness, format compliance (name format, frontmatter, progressive disclosure), instruction quality (WHY explanations, workflow phases), reusability
- **Agentic**: CrewAI + LangGraph hybrid — evaluates purpose clarity (role/goal/backstory/scope), tool design (schemas, safety annotations), workflow logic (state machine, self-correction loops, termination), safety guardrails (blast radius, confirmation gates, human escalation)

### Security Mode
OWASP security assessment with multi-file and folder scanning. Supports single-file paste/upload, drag-and-drop files or folders, and recursive folder scanning via the "Scan Folder" tab or server-side `/api/pentest/folder` endpoint. Reports include 6 OWASP-mapped categories with letter grades, Deep Dive follow-up conversations, and export as Copy/Markdown/CSV/HTML/PDF/JSON. The **Remediate** button sends findings + code to the AI, generates fixed files, and downloads a zip containing `REMEDIATION-REPORT.md`, `original/`, and `remediated/` folders. Uses JSZip for client-side zip generation.

### Validate Mode
Generates project-specific `validate.md` command files for any local folder or GitHub repo. Workflow: (1) scan project to discover linters, type checkers, test runners, CI configs, and package scripts via `lib/validate.js`, (2) AI generates a phased validation command (Lint → Type Check → Style → Tests → E2E), (3) one-click install to Claude Code (`.claude/commands/`), Cursor (`.cursor/prompts/`), VS Code (`.github/prompts/`), or OpenCode (`.opencode/commands/`). "Install All" writes to all 4 IDEs at once.

### Create → Build Handoff
After project creation in Create mode, an **Open in Build** button registers the project in the Build registry and switches directly to Build mode with it selected.

### IDE Command Files (Create & Build)
Both scaffolders automatically copy IDE command files from `IDE_COMMANDS/` (app root) into every new project across all 5 IDE paths: `.claude/commands/`, `.cursor/commands/`, `.cursor/prompts/`, `.github/prompts/`, `.opencode/commands/`. Falls back to the configured template path's `Commands/` folder if `IDE_COMMANDS/` doesn't exist. Optional **Create template path** in Settings (`icmTemplatePath` in config) also copies `ICM-fw` contents into the project root.

### Tutorial (Create & Build wizards)
- **Tutorial** button toggles step-by-step guidance. Step 1: user fills project info (no prefill). Step 2+: contextual suggestions from **POST /api/tutorial-suggestions** (Ollama) using project name/description/role. **Focus or click** a field to get a suggestion; **double-click** for a new suggestion (step 1 cycles static alternatives; step 2+ re-calls API). Tab or right-click to accept; user can always type manually.

### Settings Panel
Six tabs: General, GitHub, MCP Server, MCP Clients, Memory. General tab includes:
- Ollama Server URL with test connection
- Project Folder with validation
- Create template path (Commands + ICM-fw)
- Brand Assets (label/path/description rows)
- **Review Timeout** slider (60s–600s, step 30s, default 300s) — configurable backend timeout for AI code reviews stored as `reviewTimeoutSec` in `.cc-config.json`, passed through to `reviewCode()` in `lib/review.js`
- 3D Visual Effects toggle
- Color Theme picker (hue slider + 5 presets)
- Welcome Tour restart
- Electron-only: Data Management, Port Configuration, Software Updates

## Rules
- Stream AI responses in real-time (Server-Sent Events)
- Auto-detect available Ollama models on startup
- Handle Ollama being offline gracefully
- Use friendly-teacher tone — analogies, no jargon, patience
- Keep the UI focused on vibe-coder workflows
