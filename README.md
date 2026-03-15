# Th3rdAI Code Companion — Vibe Coder Edition

A locally-hosted AI code reviewer that helps vibe coders (non-technical users who generate code with AI tools) understand, review, and improve their AI-generated code. Powered by [Ollama](https://ollama.com) LLMs — no API keys, no cloud, full privacy.

Th3rdAI Code Companion also implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io), acting as both an **MCP server** (exposing its tools to other AI agents) and an **MCP client** (connecting to external MCP servers like GitHub, Archon, etc.).

## Features

- **Eleven specialized modes** — Chat, Explain This, Safety Check, Clean Up, Code -> Plain English, Idea -> Code Spec, Review, Create, Prompting, Skillz, Agentic
- **Code Review with Report Card** — color-coded letter grades (A-F) for bugs, security, readability, and completeness with conversational deep-dives
- **Prompt Builder** — craft, score, revise, and download AI prompts with quality grades for clarity, specificity, structure, and effectiveness
- **Skill Builder** — create, score, and export SKILL.md files for Claude Code with grades for completeness, format, instructions, and reusability
- **Agent Designer** — design, score, and download AI agent definitions with grades for purpose, tool design, workflow logic, and safety guardrails
- **Friendly-teacher tone** — analogies, zero jargon, patience across all modes
- **Create mode** — 5-step wizard to scaffold new AI-assisted projects with ICM/MAKER framework support
- **23+ Ollama models** supported locally — no API keys, no cloud, full privacy
- **MCP Server** — exposes 11 tools via HTTP and stdio transports for other AI agents to use
- **MCP Client** — connects to external MCP servers (GitHub, Archon, etc.) and lets Ollama use their tools automatically
- **File browser** — navigate project files, launch Claude Code, Cursor, Windsurf, or OpenCode directly
- **GitHub integration** — clone repos and browse them in-app
- **Voice dictation** — built-in mic buttons on Create Wizard fields using the Web Speech API
- **Report card export** — download reviews as Markdown or JSON
- **Onboarding wizard** — first-time user flow explaining what the app does
- **Jargon glossary** — searchable plain-English definitions for technical terms
- **Privacy banner** — "Your code never leaves your computer" messaging
- **3D visual effects** — splash screen, particle fields, floating geometry, holographic token counter
- **Model persistence** — selected model remembered across page refreshes
- **Quick rebuild** — `rebuild.sh` script for fast frontend rebuild and server restart
- **Conversation history** — auto-saved, searchable, with archive and export
- **Tool-call loop** — Ollama can autonomously call external tools up to 5 rounds per request

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Ollama](https://ollama.com) running locally with at least one model pulled

### Install & Run

```bash
cd AIApp-CodeCompanion
npm install
./startup.sh
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Quick Rebuild

After making code changes, rebuild the frontend and restart the server in one step:

```bash
./rebuild.sh         # Stop → rebuild dist/ → restart server → status check
```

### Development Mode

```bash
npm run dev          # Vite dev server + Express backend
npm run build        # Production build
npm run preview      # Build + serve
```

### Automated Tests

```bash
npm run test:unit    # Node unit tests (scaffolder and backend logic)
npm run test:e2e     # Playwright browser + API end-to-end tests
npm test             # Run unit + e2e suites
```

## MCP Server

Th3rdAI Code Companion exposes 11 tools via MCP that other AI agents can use:

| Tool | Description |
|------|-------------|
| `codecompanion_chat` | General PM conversational mode |
| `codecompanion_explain` | Explain code in plain English |
| `codecompanion_find_bugs` | Review code for bugs and security issues |
| `codecompanion_refactor` | Suggest refactoring improvements |
| `codecompanion_tech_to_biz` | Translate technical content to business language |
| `codecompanion_biz_to_tech` | Translate business requirements to technical specs |
| `codecompanion_list_models` | List available Ollama models |
| `codecompanion_get_status` | Check connection status and config |
| `codecompanion_browse_files` | List project file tree |
| `codecompanion_read_file` | Read a file from the project folder |
| `codecompanion_list_conversations` | List saved conversation history |

### HTTP Transport

Any MCP client can connect to `http://localhost:3000/mcp` using the Streamable HTTP transport.

### Stdio Transport

```bash
node mcp-server.js
```

Or use the MCP Inspector to test interactively:

```bash
npm run mcp:inspect
```

### Add to Claude Desktop

Add this to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "code-companion": {
      "command": "node",
      "args": ["/path/to/AIApp-CodeCompanion/mcp-server.js"]
    }
  }
}
```

## MCP Clients (External Tools)

Th3rdAI Code Companion can connect to external MCP servers and let Ollama use their tools during chat. Configure these in **Settings → MCP Clients**.

### Adding GitHub

1. Create a [GitHub Personal Access Token](https://github.com/settings/tokens) with the scopes you need
2. In Settings → MCP Clients → Add Server:
   - **Name:** `Github`
   - **Transport:** Stdio
   - **Command:** `npx -y @modelcontextprotocol/server-github`
   - **Env vars:** `GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here`
3. Click Save — the server connects automatically

### Adding Other MCP Servers

Any MCP server that supports stdio or HTTP transport can be added. For HTTP servers (like Archon), use the HTTP transport and enter the server URL.

### How Tool Calling Works

When external MCP servers are connected, Th3rdAI Code Companion enriches the Ollama system prompt with available tool descriptions. The model can then call tools using a `TOOL_CALL:` pattern, which Th3rdAI Code Companion parses and executes automatically — up to 5 rounds per request. The flexible parser handles both JSON and Python-style argument formats that small models tend to produce.

## Project Structure

```
├── server.js              # Express app, API routes, MCP HTTP endpoint
├── mcp-server.js          # MCP stdio entry point
├── startup.sh             # Launch script with health checks
├── rebuild.sh             # Quick rebuild + restart script
├── lib/
│   ├── config.js          # Config getter/setter (.cc-config.json)
│   ├── logger.js          # File + stderr logging
│   ├── ollama-client.js   # Ollama API client (stream + complete)
│   ├── prompts.js         # System prompts for all 11 modes
│   ├── review.js          # Review orchestration (structured output + fallback)
│   ├── review-schema.js   # Report card JSON schema
│   ├── builder-score.js   # Builder mode scoring orchestration
│   ├── builder-schemas.js # Zod schemas for prompt/skill/agent scoring
│   ├── icm-scaffolder.js  # Create mode workspace scaffolding engine
│   ├── maker-skill.js     # MAKER framework integration
│   ├── file-browser.js    # Project file tree + reader
│   ├── history.js         # Conversation persistence
│   ├── github.js          # GitHub repo cloning + management
│   ├── mcp-client-manager.js  # External MCP server connections
│   ├── mcp-api-routes.js      # MCP management REST API
│   └── tool-call-handler.js   # Tool-call parsing + execution loop
├── mcp/
│   ├── tools.js           # 11 MCP tool registrations
│   └── schemas.js         # Zod input schemas
├── src/                   # React frontend (Vite)
│   ├── App.jsx            # Main app with 11 modes
│   └── components/
│       ├── builders/
│       │   ├── BaseBuilderPanel.jsx  # Shared builder lifecycle component
│       │   ├── BuilderScoreCard.jsx  # Score display with grade badges
│       │   ├── PromptingPanel.jsx    # Prompt builder config
│       │   ├── SkillzPanel.jsx       # Skill builder config
│       │   └── AgenticPanel.jsx      # Agent designer config
│       ├── ReviewPanel.jsx       # Code review input (paste/upload/browse tabs)
│       ├── ReportCard.jsx        # Color-coded grade display + export
│       ├── LoadingAnimation.jsx  # Animated review loading state
│       ├── CreateWizard.jsx      # 5-step project creation wizard
│       ├── FileBrowser.jsx       # File tree + IDE launchers
│       ├── GitHubPanel.jsx       # GitHub repo browser + clone
│       ├── SettingsPanel.jsx     # Settings with 3 tabs
│       ├── McpServerPanel.jsx    # MCP server management UI
│       ├── McpClientPanel.jsx    # MCP client management UI
│       ├── DashboardPanel.jsx    # Usage analytics + report exports
│       ├── OnboardingWizard.jsx  # First-time user experience
│       ├── JargonGlossary.jsx    # Searchable tech term glossary
│       ├── PrivacyBanner.jsx     # Privacy messaging banner
│       ├── MarkdownContent.jsx   # Rendered markdown with code blocks
│       ├── Sidebar.jsx           # Conversation history sidebar
│       ├── DictateButton.jsx     # Voice input button
│       └── 3d/                   # Visual effects (SplashScreen, etc.)
├── test/
│   ├── unit/              # Node unit tests
│   └── e2e/               # Playwright end-to-end tests
├── playwright.config.js   # Playwright test runner configuration
└── dist/                  # Production build output
```

## Configuration

Settings are stored in `.cc-config.json`:

```json
{
  "ollamaUrl": "http://localhost:11434",
  "icmTemplatePath": "/Users/you/AI_Dev/ICM_FW/ICM-Framework-Template",
  "createModeAllowedRoots": ["/Users/you/AI_Dev"],
  "projectFolder": "/path/to/your/project",
  "mcpClients": [
    {
      "id": "github",
      "name": "Github",
      "transport": "stdio",
      "command": "npx -y @modelcontextprotocol/server-github",
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..." },
      "autoConnect": true
    }
  ]
}
```

## License

MIT
