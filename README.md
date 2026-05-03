<p align="center">
  <img src="resources/th3rdai-logo-sm.png" alt="Th3rdAI" width="200" />
</p>

<h1 align="center">Code Companion — Vibe Coder Edition</h1>

<p align="center">
  <em>by <a href="https://github.com/Th3rdai">Th3rdAI</a></em>
</p>

A locally-hosted AI code reviewer that helps vibe coders (non-technical users who generate code with AI tools) understand, review, and improve their AI-generated code. Powered by [Ollama](https://ollama.com) LLMs — no API keys, no cloud, full privacy.

Th3rdAI Code Companion also implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io), acting as both an **MCP server** (exposing its tools to other AI agents) and an **MCP client** (connecting to external MCP servers like GitHub, Archon, etc.).

## Features

- **Fifteen specialized modes** — Chat, Explain This, Safety Check, Clean Up, Code → Plain English, Idea → Code Spec, Diagram, Security, Validate, Review, Create, Prompting, Skillz, Agentic, Build
- **Image & vision model support** — upload screenshots, diagrams, and error messages via drag-and-drop, file picker, or clipboard paste. Automatic security hardening (EXIF stripping, script destruction), smart duplicate detection, thumbnail gallery with lightbox viewer. Works in Chat, Code Review, and Security modes with any Ollama vision model (llava, bakllava, minicpm-v)
- **Security mode** — OWASP security assessment with multi-file/folder scanning, drag-and-drop folders, export (Copy/MD/CSV/HTML/PDF/JSON), follow-up conversations, and **Remediate** button that generates a zip with fixed files. Attach error screenshots for visual context
- **Validate mode** — scan a local folder or GitHub repo, AI generates a project-specific `validate.md` command, one-click install to Claude Code, Cursor, VS Code, and OpenCode
- **Code Review with Report Card** — color-coded letter grades (A-F) for bugs, security, readability, and completeness with conversational deep-dives. Attach bug screenshots to provide visual evidence
- **Prompt Builder** — craft, score, revise, and download AI prompts with quality grades for clarity, specificity, structure, and effectiveness
- **Skill Builder** — create, score, and export SKILL.md files for Claude Code with grades for completeness, format, instructions, and reusability
- **Agent Designer** — design, score, and download AI agent definitions with grades for purpose, tool design, workflow logic, and safety guardrails
- **Friendly-teacher tone** — analogies, zero jargon, patience across all modes
- **Create mode** — 5-step wizard to scaffold new AI-assisted projects with ICM/MAKER framework support, then **Open in Build** to continue in Build mode. IDE command files from `IDE_COMMANDS/` are automatically copied to all IDE paths (Claude Code, Cursor, VS Code, OpenCode)
- **Build mode** — GSD+ICM project scaffolding and dashboard with automatic IDE command file installation across all supported IDEs
- **Tutorial for Build & Create** — Step-by-step walkthrough: click **Tutorial** for explanations; focus or click an empty field to get a suggestion (step 2+ uses AI-generated suggestions from your project info). Double-click a field to get a different suggestion; right-click to accept. **Fill with example** prefills the current step.
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
- **Model persistence** — selected model remembered across page refreshes (including **Auto (best per mode)**, which picks a concrete model per mode via **`lib/auto-model.js`** and Settings → **Auto model map**)
- **Quick rebuild** — `rebuild.sh` script for fast frontend rebuild and server restart
- **Conversation history** — auto-saved, searchable, with archive and per-conversation export
- **Chat export** — toolbar **Export**: 11 formats (Markdown, HTML, JSON, PDF, Word, Excel, CSV, PowerPoint, OpenDocument, plain text, etc.), full chat or last reply only, multi-file or ZIP; server-side generation via `/api/generate-office`
- **Tool-call loop** — Ollama can autonomously call external tools up to 5 rounds per request

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Ollama](https://ollama.com) running locally with at least one model pulled
- **Optional**: Vision model for image support (e.g., `ollama pull llava`)

### Install & Run

**Option A — One command (install + build + start):**

```bash
cd AIApp-CodeCompanion
./deploy.sh
```

**Option B — Manual steps:**

```bash
cd AIApp-CodeCompanion
npm install
npm run build
./startup.sh
```

(For development with hot reload, use `npm run dev` instead of `npm run build` + `./startup.sh`.)

Open [http://localhost:8900](http://localhost:8900) in your browser. **SSL errors on localhost?** Use [http://127.0.0.1:8900](http://127.0.0.1:8900) or clear HSTS for `localhost` (Chrome: `chrome://net-internals/#hsts`). **Optional HTTPS:** Add `cert/server.crt` and `cert/server.key` (see `cert/README.txt`) and restart; then use `https://localhost:8900` and accept the self-signed cert in the browser.

**Desktop installers:** For a packaged app (no Node/npm required), use the [downloads page](https://th3rdai.com/downloads/) or install from [GitHub Releases](https://github.com/th3rdai/CodeCompanion/releases). **Maintainers:** ship new versions via CI — see **[Releasing](#releasing-maintainers)** below. To build installers locally for testing only: `npm run electron:build` (see [BUILD.md](BUILD.md)) — DMG (macOS), EXE (Windows), AppImage (Linux). **Release signing** (optional): macOS Developer ID, Windows Authenticode (`.pfx` / store), Linux GPG signatures for AppImage — see [BUILD.md](BUILD.md) and [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md).

**Network binding (security default):** The server **defaults to `127.0.0.1`** (localhost-only). To accept connections from other devices on the LAN, set **`CC_BIND_ALL=1`** or **`HOST=0.0.0.0`** before starting (see [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md)). On startup, when bound to all interfaces, the server logs a **Remote access:** URL (e.g. `http://192.168.1.5:8900`). Sensitive Settings/API routes accept requests from **loopback** only unless you set **`CC_API_SECRET`** on the server and (for browser UIs opened by IP) **`VITE_CC_API_KEY`** at build time to match — see [SECURITY.md](SECURITY.md) and [docs/PENTEST-REPORT-CodeCompanion-Static-Analysis.md](docs/PENTEST-REPORT-CodeCompanion-Static-Analysis.md). Use **http** (not https) unless you added `cert/` files — otherwise `https://` will cause SSL errors. Clear HSTS for the host if the browser forces HTTPS (Chrome: `chrome://net-internals/#hsts`). Ensure the host firewall allows inbound TCP on your chosen port (default **8900** unless overridden).

**Remote access not working?**

1. **From the other device** run: `curl -s -o /dev/null -w "%{http_code}" http://HOST_IP:8900/api/config` (replace `HOST_IP` with the Mac's IP, e.g. `192.168.1.5`). If you get `200`, the server is reachable; if connection refused or timeout, the host is blocking it.
2. **On the Mac (host):** macOS Firewall often blocks incoming connections. Open **System Settings → Network → Firewall → Options**, then either add **Node** to “Allow incoming connections” or turn firewall off temporarily to test. If Node isn’t listed, run once: `./scripts/allow-remote-access.sh` (or the `socketfilterfw --add` command in that script), then in Firewall Options set that app to “Allow incoming” and restart the app.
3. Use **http://** (not https) and the exact URL from the server’s “Remote access:” line.

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
npm test             # All Playwright tests
npm run test:e2e      # Playwright E2E tests (browser + API)
npm run test:ui       # Playwright UI tests
npm run test:unit       # Node unit tests (node:test — builder, pentest, rate-limit, etc.)
npm run audit:security  # npm audit — fails on critical advisories (same gate as CI)
```

### Releasing (maintainers)

**Official desktop installers** (GitHub Releases + in-app **Software Updates**) are built and published by **[GitHub Actions](.github/workflows/build.yml)** when you push a **version tag** `v*` that matches **`package.json`** on the **publish** repository (`th3rdai` / `CodeCompanion` — see `electron-builder.config.js`).

1. Bump **`version`** in `package.json`, commit, and push to the branch you release from.
2. Create and push the tag: `git tag vX.Y.Z` → `git push <remote> vX.Y.Z` (use the remote that points at the publish repo).
3. Watch **Actions** until **Build Desktop Installers** finishes; confirm `latest-mac.yml` and other feeds on the release.

Full checklist, fork vs canonical repo, and **emergency** local `electron:publish:*` (CI broken only): **[docs/RELEASES-AND-UPDATES.md](docs/RELEASES-AND-UPDATES.md)**. Local **`npm run electron:build`** / per-platform scripts are for **development and packaging smoke tests** — see **[BUILD.md](BUILD.md)**.

### More documentation

| Doc                                                                                                          | Contents                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [SECURITY.md](SECURITY.md)                                                                                   | How to report vulnerabilities; security and privacy design                                                                                          |
| [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md)                                               | `HOST`, **`CC_BIND_ALL`**, **`CC_API_SECRET`**, **`VITE_CC_API_KEY`**, CORS, rate limits, Playwright `BASE_URL`, etc.                               |
| [docs/SECURITY-OPERATIONS.md](docs/SECURITY-OPERATIONS.md)                                                   | Network binding, API protection, SPA `apiFetch`, CSP nonces, **`npm audit`** CI, pentest report, release signing                                    |
| [docs/TESTING.md](docs/TESTING.md)                                                                           | Unit vs Playwright, folder layout, `BASE_URL` tips, validate-project HTTPS notes                                                                    |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)                                                           | “Failed to fetch”, MCP clients / `.cc-config.json` paths, log files, Ollama errors in logs                                                          |
| [docs/IDE_COMMANDS.md](docs/IDE_COMMANDS.md)                                                                 | What `IDE_COMMANDS/` is and pointer to full README there                                                                                            |
| [docs/RELEASES-AND-UPDATES.md](docs/RELEASES-AND-UPDATES.md) ([PDF](docs/RELEASES-AND-UPDATES.pdf))          | Versioning, tag-based CI releases, manual publish, Software Updates / electron-updater                                                              |
| [docs/PENTEST-REPORT-CodeCompanion-Static-Analysis.md](docs/PENTEST-REPORT-CodeCompanion-Static-Analysis.md) | OWASP-oriented static pen-test report (network/API risks, findings, remediations)                                                                   |
| [docs/AGENT-APP-CAPABILITIES-ROADMAP.md](docs/AGENT-APP-CAPABILITIES-ROADMAP.md)                             | **Planned (Phases 25–27):** chat agent builtins for Validate + Planner (+ optional GSD); linked from [`.planning/ROADMAP.md`](.planning/ROADMAP.md) |
| [docs/AGENT-READINESS.md](docs/AGENT-READINESS.md)                                                           | **Chat agent checklist:** Ollama, project/File Browser, agent terminal allowlist, optional validate/planner/browser/MCP — idea → running software   |

## User Guide

### Modes at a glance

| Mode                     | What it does                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Chat**                 | General conversation about code, building with AI, or anything else.                                                                                                                                                                 |
| **Explain This**         | Paste code and get a step-by-step walkthrough in plain English.                                                                                                                                                                      |
| **Safety Check**         | Spot potential bugs and security issues before they cause trouble.                                                                                                                                                                   |
| **Clean Up**             | Get refactoring suggestions and copy-pasteable prompts to improve code.                                                                                                                                                              |
| **Code → Plain English** | Turn code or technical text into language anyone can understand.                                                                                                                                                                     |
| **Idea → Code Spec**     | Describe what you want built and get clear instructions for your AI coding tool.                                                                                                                                                     |
| **Diagram**              | Describe a system, process, or relationship and get a Mermaid diagram (flowchart, sequence, ER, etc.). Export as Source, SVG, or PNG.                                                                                                |
| **Security**             | OWASP-style static code analysis. Paste or upload code (or point at a file/folder), get a structured report with severity bands and remediation. Export as Copy, .md, .html, or **PDF** (opens print dialog — choose “Save as PDF”). |
| **Review**               | Full code report card with letter grades (A–F) for bugs, security, readability, and completeness. Export as Markdown or JSON.                                                                                                        |
| **Prompting**            | Craft and score AI prompts (TÂCHES methodology). Load from file, revise with AI, download.                                                                                                                                           |
| **Skillz**               | Build and score SKILL.md files for Claude Code (Agent Skills Spec). Load, revise, export.                                                                                                                                            |
| **Agentic**              | Design and score AI agent definitions (CrewAI/LangGraph style). Load, revise, export.                                                                                                                                                |
| **Create**               | 5-step wizard to scaffold a new project with ICM/MAKER framework support. Voice dictation on fields.                                                                                                                                 |
| **Build**                | Start a GSD+ICM project: scaffold planning and stages, then manage it from the Build dashboard.                                                                                                                                      |

### Tutorial (Build & Create)

In **Create** or **Build** mode, click **Tutorial** above the wizard to open the step-by-step guide. For each step you get a short explanation and a **Fill with example** button that prefills the current step. With the tutorial on, **focus or click** an empty field to get a suggestion (Tab or right-click to accept). **Double-click** a field to get a different suggestion (step 1 cycles static examples; step 2+ requests new AI suggestions from your project info). Use **Previous** / **Next** in the tutorial to move through steps; the wizard stays in sync so you can edit and continue.

### Using Image Support

Code Companion supports image uploads in **Chat**, **Review**, and **Security** modes when using an Ollama vision model (llava, bakllava, minicpm-v, etc.).

**Getting Started:**

1. Install a vision model: `ollama pull llava`
2. Select the vision model from the dropdown in Code Companion
3. Upload images via drag-and-drop, file picker (📎), or clipboard paste (Cmd+V / Ctrl+V)

**Features:**

- **Automatic security hardening** — EXIF metadata (GPS, timestamps) stripped, embedded scripts destroyed
- **Smart processing** — Images auto-resize to 2048px, compress, generate thumbnails
- **Duplicate detection** — SHA-256 hashing prevents accidental duplicate uploads
- **Gallery viewer** — Click thumbnails to open full-size lightbox with zoom and navigation
- **Privacy warning** — First-time upload shows privacy notice (don't upload sensitive info)

**Use Cases:**

- **Chat mode**: Share screenshots of bugs, design mockups, error messages, or code snippets for AI analysis
- **Review mode**: Attach screenshots showing visual bugs alongside your code for comprehensive reviews
- **Security mode**: Include error logs, configuration screenshots, or vulnerability proof-of-concept images

**Settings:**
Configure image support in Settings → Image Support:

- Enable/disable image uploads
- Max file size (1-50 MB, default 25MB)
- Max images per message (1-20, default 10)
- Compression quality (50%-100%, default 90%)

**Supported formats:** PNG, JPEG, GIF (first frame only for animated GIFs)

### File Browser and "Load into Form"

- Open **Files** in the toolbar to browse your project. You can **Load into Form** in Prompting, Skillz, or Agentic to pull a file’s content into the current builder. In Review or Security, use **Load for Review** to attach code for review or scan.
- **Share with AI** copies your project structure (tree) so you can paste it into chats or other tools.

### Conversation history

- Conversations are saved automatically. Use the sidebar to search, open, or delete them.
- **Multi-select:** Turn on select mode (checkbox), then select multiple conversations to **Export** (Markdown or text), **Archive**, or **Delete** in bulk.

### Security report export (PDF)

- In **Security** mode, after a scan you’ll see Copy, .md, .html, and **PDF**. **PDF** opens the report in a new tab and triggers the browser’s print dialog — choose “Save as PDF” (or your system’s equivalent) to download a real PDF. If the popup is blocked, the app falls back to downloading the report as HTML and reminds you to open it and use Print → Save as PDF.

### Diagram export

- In **Diagram** mode (or any mode where the AI returns a Mermaid diagram), each diagram has export buttons: **Source** (raw Mermaid), **SVG**, and **PNG**.

### Optional HTTPS and remote access

- **HTTPS:** Put `server.crt` and `server.key` in the `cert/` folder (see `cert/README.txt` for a self-signed example). Restart the app and use `https://localhost:8900` (accept the self-signed cert once).
- **Remote access:** The server binds to all interfaces by default. Use the "Remote access:" URL from the startup log (e.g. `http://192.168.1.5:8900`). Use **http** unless you've enabled HTTPS. If the browser still forces https, clear HSTS for that host.

### Themes and settings

- **Settings → General:** Pick a color theme (Indigo Night, Emerald Matrix, Sunset Blaze, Cherry Blossom, Arctic Blue). Your choice is saved.
- **Settings → General** also includes **Create template path**: a folder that contains `Commands` and `ICM-fw` subfolders (e.g. `/Users/you/AI_Dev/_AI-IDEs`). When set, new Create projects copy `Commands` into `.cursor/commands` and `ICM-fw` contents into the project root. Settings also covers Ollama URL, project folder, license (if applicable), MCP clients, and data export/import.

### Desktop installers

- Installers (DMG on macOS, EXE on Windows, AppImage on Linux) include the app, **startup.sh**, **deploy.sh**, and **rebuild.sh**. Your settings and history live in a data folder (see the data readme in the app). GitHub PAT and other secrets in Settings are never packaged.
- **In-app updates (packaged app only):** Settings → General → **Software Updates** — **Upgrade** checks **GitHub Releases** for a newer published build; when a download finishes, use **Restart to upgrade**. This does not replace local development (pull/rebuild from the repo). Running the app unpackaged (`electron:dev`) disables **Upgrade** and explains that updates apply to the installed app.

## MCP Server

Th3rdAI Code Companion exposes 11 tools via MCP that other AI agents can use:

| Tool                               | Description                                        |
| ---------------------------------- | -------------------------------------------------- |
| `codecompanion_chat`               | General PM conversational mode                     |
| `codecompanion_explain`            | Explain code in plain English                      |
| `codecompanion_find_bugs`          | Review code for bugs and security issues           |
| `codecompanion_refactor`           | Suggest refactoring improvements                   |
| `codecompanion_tech_to_biz`        | Translate technical content to business language   |
| `codecompanion_biz_to_tech`        | Translate business requirements to technical specs |
| `codecompanion_list_models`        | List available Ollama models                       |
| `codecompanion_get_status`         | Check connection status and config                 |
| `codecompanion_browse_files`       | List project file tree                             |
| `codecompanion_read_file`          | Read a file from the project folder                |
| `codecompanion_list_conversations` | List saved conversation history                    |

### HTTP Transport

Any MCP client can connect to `http://localhost:8900/mcp` using the Streamable HTTP transport.

### Stdio Transport

```bash
node mcp-server.js
```

Or use the MCP Inspector to test interactively:

```bash
npm run mcp:inspect
```

Quick **stdio** smoke test (no browser; lists 11 tools if OK):

```bash
npm run mcp:test
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
├── .cc-config.json.example # Safe config template (copy to .cc-config.json — gitignored)
├── lib/
│   ├── config.js             # Config getter/setter (.cc-config.json)
│   ├── logger.js             # File + stderr logging
│   ├── ollama-client.js      # Ollama API client (stream + complete)
│   ├── prompts.js            # System prompts for all modes
│   ├── review.js             # Review orchestration (structured output + fallback)
│   ├── review-schema.js      # Report card JSON schema
│   ├── builder-score.js      # Builder mode scoring orchestration
│   ├── builder-schemas.js    # Zod schemas for prompt/skill/agent scoring
│   ├── icm-scaffolder.js     # Create mode workspace scaffolding engine
│   ├── build-scaffolder.js   # Build mode GSD+ICM project scaffolding
│   ├── build-registry.js     # Build dashboard project registry
│   ├── gsd-bridge.js         # GSD CLI bridge for build mode
│   ├── maker-skill.js        # MAKER framework integration
│   ├── pentest.js            # Security (OWASP) assessment orchestration
│   ├── pentest-schema.js     # Pentest report Zod schema
│   ├── file-browser.js       # Project file tree + reader
│   ├── history.js            # Conversation persistence
│   ├── github.js             # GitHub repo cloning + management
│   ├── mcp-client-manager.js # External MCP server connections
│   ├── mcp-api-routes.js     # MCP management REST API
│   └── tool-call-handler.js  # Tool-call parsing + execution loop
├── mcp/
│   ├── tools.js           # 11 MCP tool registrations
│   └── schemas.js         # Zod input schemas
├── src/                   # React frontend (Vite)
│   ├── App.jsx            # Main app with 14 modes
│   └── components/
│       ├── builders/
│       │   ├── BaseBuilderPanel.jsx  # Shared builder lifecycle component
│       │   ├── BuilderScoreCard.jsx  # Score display with grade badges
│       │   ├── PromptingPanel.jsx    # Prompt builder config
│       │   ├── SkillzPanel.jsx       # Skill builder config
│       │   └── AgenticPanel.jsx      # Agent designer config
│       ├── ReviewPanel.jsx       # Code review input (paste/upload/browse tabs)
│       ├── ReportCard.jsx        # Color-coded grade display + export
│       ├── SecurityPanel.jsx     # Security (OWASP) scan input and fallback report
│       ├── SecurityReport.jsx    # Structured security report with export (MD, HTML, PDF)
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
├── tests/
│   ├── unit/              # Node unit tests (node:test)
│   ├── ui/                # Playwright UI tests
│   └── e2e/               # Playwright end-to-end tests
├── playwright.config.js   # Playwright test runner configuration
├── startup.sh             # Production-style server start (see Quick Start)
├── fix_cache.html         # Optional: open locally to clear browser localStorage (troubleshooting)
└── dist/                  # Production build output
```

## Configuration

Settings are stored in **`.cc-config.json`**. That file often includes **tokens, API keys, and personal paths** — it is **gitignored**; **do not commit** it unless you intentionally strip secrets. Full guidance: **[docs/CC-CONFIG.md](docs/CC-CONFIG.md)**.

To start from a **safe template** (committed, no secrets): **`cp .cc-config.json.example .cc-config.json`**, then edit or use **Settings**. See **`.cc-config.json.example`** for the full shape; the snippet below is illustrative only.

```json
{
  "ollamaUrl": "http://localhost:11434",
  "icmTemplatePath": "/Users/you/AI_Dev/_AI-IDEs",
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
    },
    {
      "id": "archon",
      "name": "Archon",
      "transport": "http",
      "url": "http://127.0.0.1:8051/mcp",
      "autoConnect": true
    }
  ]
}
```

- **icmTemplatePath**: Optional. Folder that contains `Commands` and `ICM-fw` subfolders (e.g. your IDE templates). When set, **Create** mode copies `Commands` → `.cursor/commands` and `ICM-fw` contents into the project root for each new project. Set in **Settings → General** as "Create template path".

## Environment Variables

Code Companion works out of the box with no environment variables. These are optional overrides:

| Variable                  | Default      | Purpose                                                   |
| ------------------------- | ------------ | --------------------------------------------------------- |
| `PORT`                    | `8900`       | Server port                                               |
| `HOST`                    | `0.0.0.0`    | Bind address                                              |
| `DEBUG`                   | off          | Set `DEBUG=1` for verbose console output                  |
| `FORCE_HTTP`              | off          | Set `FORCE_HTTP=1` to disable HTTPS even when certs exist |
| `CC_DATA_DIR`             | project root | Data directory (set automatically in Electron)            |
| `CC_ALLOW_AGENT_TERMINAL` | off          | Allow agent terminal tools on network-exposed servers     |

All settings (Ollama URL, project folder, MCP clients, etc.) are configured in the Settings panel and persisted to `.cc-config.json`.

## Security

**Security reporting:** Report vulnerabilities **privately** — email [james@th3rdai.com](mailto:james@th3rdai.com) or use the repo [Security](https://github.com/th3rdai/CodeCompanion/security) tab (**Report a vulnerability** when available). Full policy, response expectations, and design notes: **[SECURITY.md](SECURITY.md)**.

## Testing

| Command             | What it runs                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm test`          | All Playwright tests (UI + E2E)                                                                              |
| `npm run test:unit` | Node.js unit tests (`node:test`) — builder scoring, pentest schemas, rate limiting, spawn-path, MCP security |
| `npm run test:ui`   | Playwright UI component tests — onboarding, glossary, report card, input methods, builders                   |
| `npm run test:e2e`  | Playwright E2E tests — full review workflow with browser + server                                            |

Test files are in `tests/` organized by type:

- `tests/unit/` — Pure logic tests (no browser)
- `tests/ui/` — Playwright browser tests for individual components
- `tests/e2e/` — Full user journey tests
- `tests/*.test.js` — Standalone unit tests (MCP security, tone, labels, rate limiting)

## IDE Commands

The `IDE_COMMANDS/` directory contains slash commands that are automatically copied into new projects created via Create or Build mode. They're installed to all supported IDEs:

| IDE         | Install path                               |
| ----------- | ------------------------------------------ |
| Claude Code | `.claude/commands/`                        |
| Cursor      | `.cursor/commands/` and `.cursor/prompts/` |
| VS Code     | `.github/prompts/`                         |
| OpenCode    | `.opencode/commands/`                      |

Use **Install All** in Validate mode to install `validate.md` across all IDEs at once.

## License

**Th3rdAI — personal & non-commercial use only.**
You may use Code Companion for personal learning and non-commercial projects. **Commercial use** (business use, paid services, redistribution for profit, etc.) **requires a separate written agreement** from Th3rdAI.

- Full terms: see [`LICENSE`](LICENSE) in this repository.
- Commercial licensing: **james@th3rdai.com** · **https://www.th3rdai.com**
