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
| lib/ | Backend modules (config, ollama-client, prompts, review, builder-score, builder-schemas, file-browser, history, github, icm-scaffolder, mcp-client-manager, tool-call-handler) |
| mcp/ | MCP tool registrations and Zod schemas |
| src/App.jsx | Main React app with 12 modes |
| src/components/ | 25+ React components (ReviewPanel, ReportCard, CreateWizard, FileBrowser, GitHubPanel, SettingsPanel, Sidebar with multi-select, MermaidBlock, etc.) |
| src/components/builders/ | Builder mode panels (BaseBuilderPanel, BuilderScoreCard, PromptingPanel, SkillzPanel, AgenticPanel) |
| src/components/3d/ | Visual effects (SplashScreen, ParticleField, FloatingGeometry, etc.) |
| .planning/ | Project planning docs (ROADMAP.md, REQUIREMENTS.md, STATE.md) |
| test/ | Unit tests and Playwright E2E tests |
| dist/ | Production build output |

## Twelve Modes
Chat, Explain This, Safety Check, Clean Up, Code -> Plain English, Idea -> Code Spec, Diagram, Review, Create, Prompting, Skillz, Agentic

### Diagram Mode
Renders Mermaid.js diagrams inline in AI responses. Any mode can produce `\`\`\`mermaid` code blocks that render as interactive SVG diagrams. Mermaid.js is lazy-loaded on first use (separate Vite chunk). During streaming, mermaid blocks show as raw code; after completion, they render as diagrams. Export buttons (Source/SVG/PNG) appear on each diagram. The `MarkdownContent` component uses a custom `marked` renderer to intercept mermaid blocks and a split-and-render pattern to mix HTML segments with React `MermaidBlock` components.

### Builder Modes (Prompting, Skillz, Agentic)
Three builder modes share a common BaseBuilderPanel architecture with config-driven fields, AI-powered scoring via `/api/score`, and CRUD workflows (create, load, view, revise, score, save, download). Each mode scores content across 4 categories with letter grades (A-F). Revision flow: AI generates improved content in `<revised_prompt>` tags → user clicks "Apply Revision & Re-Score" → formDataRef syncs immediately → re-scoring reads updated content.

**File Loading:** Files can be loaded into builder forms via two paths: (1) File Browser "Load into Form" button routes files through `builderAttachRef` → `loadFileIntoForm()`, or (2) native "Load from File" picker in the builder header. Both call `config.parseLoaded(content)` to deserialize file content into form fields. The `parseLoaded` functions handle YAML frontmatter (`---` delimiters) and fall back to treating the full body as instructions when no structured sections are found.

**Scoring Methodologies:**
- **Prompting**: TÂCHES meta-prompting methodology — evaluates clarity (Golden Rule), specificity, structure (XML tags, success criteria), effectiveness
- **Skillz**: Agent Skills Specification (agentskills.io) — evaluates completeness, format compliance (name format, frontmatter, progressive disclosure), instruction quality (WHY explanations, workflow phases), reusability
- **Agentic**: CrewAI + LangGraph hybrid — evaluates purpose clarity (role/goal/backstory/scope), tool design (schemas, safety annotations), workflow logic (state machine, self-correction loops, termination), safety guardrails (blast radius, confirmation gates, human escalation)

## Rules
- Stream AI responses in real-time (Server-Sent Events)
- Auto-detect available Ollama models on startup
- Handle Ollama being offline gracefully
- Use friendly-teacher tone — analogies, no jargon, patience
- Keep the UI focused on vibe-coder workflows
