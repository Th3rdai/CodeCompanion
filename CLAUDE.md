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
| src/App.jsx | Main React app with 11 modes |
| src/components/ | 25+ React components (ReviewPanel, ReportCard, CreateWizard, FileBrowser, GitHubPanel, SettingsPanel, etc.) |
| src/components/builders/ | Builder mode panels (BaseBuilderPanel, BuilderScoreCard, PromptingPanel, SkillzPanel, AgenticPanel) |
| src/components/3d/ | Visual effects (SplashScreen, ParticleField, FloatingGeometry, etc.) |
| .planning/ | Project planning docs (ROADMAP.md, REQUIREMENTS.md, STATE.md) |
| test/ | Unit tests and Playwright E2E tests |
| dist/ | Production build output |

## Eleven Modes
Chat, Explain This, Safety Check, Clean Up, Code -> Plain English, Idea -> Code Spec, Review, Create, Prompting, Skillz, Agentic

### Builder Modes (Prompting, Skillz, Agentic)
Three builder modes share a common BaseBuilderPanel architecture with config-driven fields, AI-powered scoring via `/api/score`, and CRUD workflows (create, load, view, revise, score, save, download). Each mode scores content across 4 categories with letter grades (A-F). Revision flow: AI generates improved content in `<revised_prompt>` tags → user clicks "Apply Revision & Re-Score" → formDataRef syncs immediately → re-scoring reads updated content.

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
