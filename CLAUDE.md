# Code Companion — Vibe Coder Edition

Web + desktop app that helps **vibe coders** (non-technical users who generate code with AI tools) understand, review, and improve AI-generated code. It connects to locally-hosted **Ollama** LLMs for friendly, jargon-free explanations, A–F report-card reviews, and guided fixes. One Express server runs standalone (web) or embedded in Electron (desktop). The _app's_ user-facing tone is friendly-teacher (analogies, no jargon, patience); keep the UI focused on vibe-coder workflows.

## Commands

| Task                                  | Command                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| Web dev (server + Vite)               | `npm run dev`                                                                 |
| Desktop dev                           | `npm run electron:run` (build + launch) · `npm run electron:dev` (no rebuild) |
| Production build                      | `npm run build`                                                               |
| Full validation — run before commit   | `npm run validate:fast`                                                       |
| Static checks (lint + types + format) | `npm run validate:static`                                                     |
| Unit / integration tests              | `npm run test:unit` · `npm run test:integration`                              |
| Playwright UI / E2E                   | `npm run test:ui` · `npm run test:e2e`                                        |
| Lint / format                         | `npm run lint` · `npm run format`                                             |
| Server-starts smoke test              | `node scripts/smoke-test-server.js`                                           |
| MCP stdio / clients smoke             | `npm run mcp:test` · `npm run mcp:clients:test`                               |

Single unit file: `node --test tests/unit/<name>.test.js`. Testing details in **docs/TESTING.md**.

## Tech Stack

- **Backend**: Node.js + Express, no external DB; JSON files for conversation history and config.
- **Frontend**: React 18 + Tailwind CSS, built with Vite.
- **AI**: Ollama REST API (configurable URL, default `http://localhost:11434`). Cloud models carry a `:cloud` suffix and proxy through the local daemon to ollama.com (needs sign-in or an API key).
- **Streaming**: Server-Sent Events for real-time responses.
- **Desktop**: Electron wraps the Express server — `electron/main.js`.
- **MCP**: built-in server (HTTP + stdio) and **external client** support (stdio, http/streamable, sse; http may auto-fall back to sse). Stdio transports use `lib/spawn-path.js` to extend PATH (Homebrew, `~/.local/bin`, `~/.cargo/bin`, nvm, common Windows paths) so `npx`/`uvx` resolve in Electron's minimal shell.

## Project Structure

| Path                        | Purpose                                                                                                                                                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server.js`                 | Express app, API routes, MCP HTTP endpoint                                                                                                                                                                                                                                                                                            |
| `mcp-server.js`             | MCP stdio entry point                                                                                                                                                                                                                                                                                                                 |
| `electron/`                 | Electron main process, IPC, `docling-manager`, `updater`, `data-manager` (data dir + dev→packaged migration)                                                                                                                                                                                                                          |
| `lib/`                      | Backend modules — see list below                                                                                                                                                                                                                                                                                                      |
| `mcp/`                      | MCP tool registrations and Zod schemas                                                                                                                                                                                                                                                                                                |
| `src/App.jsx`               | Main React app, 18 modes                                                                                                                                                                                                                                                                                                              |
| `src/components/`           | 30+ components: ReviewPanel, SecurityPanel, JargonGlossary (`GlossaryPanel`), FileBrowser, GitHubPanel, SettingsPanel, Sidebar, ExportPanel, MermaidBlock, TerminalPanel, `ui/ChatSessionProgress` (global "Working" strip during SSE — **docs/SESSION-PROGRESS.md**)                                                                 |
| `src/components/dashboard/` | DashboardView, FeatureGrid, RecentWork, analytics, CollapsibleSection, **dashboard-section-defaults.js** (layout v2 defaults)                                                                                                                                                                                                         |
| `src/components/builders/`  | Builder panels: BaseBuilderPanel, BuilderScoreCard, Prompting/Skillz/Agentic/Planner; load/save markdown per **docs/BUILDER-MARKDOWN-LOAD.md**                                                                                                                                                                                        |
| `src/components/3d/`        | Visual effects (SplashScreen, ParticleField, FloatingGeometry, …)                                                                                                                                                                                                                                                                     |
| `src/lib/`                  | Client helpers — `api-fetch.js` (`apiFetch` adds `X-CC-API-Key` when `VITE_CC_API_KEY` is set, must match server `CC_API_SECRET`; for off-loopback `/api` calls), `clipboard.js` (`navigator.clipboard` + `execCommand` fallback for self-signed HTTPS), `*-parse-loaded.js` + `builder-markdown-standards.js` (builder file parsers) |
| `tests/`                    | `node:test` in `tests/unit/`; integration in `tests/integration/`; Playwright in `tests/ui/`, `tests/e2e/`                                                                                                                                                                                                                            |
| `.planning/`                | ROADMAP.md, REQUIREMENTS.md, STATE.md                                                                                                                                                                                                                                                                                                 |
| `.claude/`                  | `settings.json` hooks, `skills/`, `agents/`, `commands/` — **docs/CLAUDE-CODE-AUTOMATION.md**                                                                                                                                                                                                                                         |
| `IDE_COMMANDS/`             | IDE command files copied into scaffolded projects (Create & Build)                                                                                                                                                                                                                                                                    |
| `dist/`                     | Production build output                                                                                                                                                                                                                                                                                                               |

**`lib/` modules**: config, ollama-client, chat-post-handler, prompts, review, **auto-model** (per-mode default model when toolbar = Auto), builder-score, builder-schemas, file-browser, history, github, icm-scaffolder, build-scaffolder (th3rdai-harness 7-stage scaffold), build-registry, **harness-bridge** (Build project `.planning/` state reader — in-process, replaced a removed external planning-CLI bridge), maker-skill, pentest, pentest-schema, validate, mcp-client-manager, mcp-api-routes, resolve-mcp-test-config-root (`npm run mcp:clients:test` path), tool-call-handler, **security-helpers** (loopback/API-key gate, CORS, path allowlists), **client-errors** (generic 5xx/SSE messages), builtin-agent-tools, docling-client, docling-starter, builtin-doc-converter, **office-generator** (chat/office export), memory, spawn-path.

## Critical Rules & Invariants

- **Config precedence (footgun)**: the Electron app reads `.cc-config.json` from its **data dir** (`app.getPath('userData')`, e.g. macOS `~/Library/Application Support/code-companion/`), **not** the repo `.cc-config.json`. `CC_DATA_DIR` overrides; logs live in `<dataDir>/logs/app.log`. The repo `.cc-config.json` only applies to bare `node server.js`. See **docs/TROUBLESHOOTING.md**, **docs/CC-CONFIG.md**.
- **Packaging**: when adding a **new top-level runtime directory** (e.g. `routes/`, `workers/`), you **must** add `"newdir/**/*"` to the `files` array in `electron-builder.config.js` — Electron ships only what's listed; a missing dir crashes every installer (`code=1`). After any structural change run `node scripts/smoke-test-server.js` before committing.
- **Streaming + abort**: stream all AI responses via SSE. **Stop** in chat aborts `fetch('/api/chat')` (`AbortController` in `App.jsx`); the server then drops the SSE connection and aborts Ollama + agent tool rounds (`chatAbortController` in `server.js`, `abortSignal` in `lib/ollama-client.js`).
- **Route order**: register API routes (especially `/api/git/*`) **before** the SPA `app.get('*')` fallback in `server.js`, or they 404 into `index.html`. `GitHubPanel` uses `parseApiJson()` so HTML error pages surface readably.
- **Network/API security**: server **defaults to `127.0.0.1`**; use `CC_BIND_ALL=1` or `HOST=0.0.0.0` for LAN. Sensitive routes require **loopback or `X-CC-API-Key`** (`lib/security-helpers.js`, **docs/ENVIRONMENT_VARIABLES.md**, **docs/PENTEST-REPORT-CodeCompanion-Static-Analysis.md**).
- **Ollama resilience**: auto-detect available models on startup; handle Ollama offline gracefully. The model **never receives HTTP status codes** — chat claims about "413", Docling, or a "conversion service" may be hallucinations unless the user pasted a real error; verify in `logs/app.log` (`POST /api/convert-document`).
- **Secrets**: never commit `.cc-config.json` (tokens, API keys). `.cc-config.json.example` is the safe committed template; prefer `.env` overrides (**docs/ENVIRONMENT_VARIABLES.md**).

## Root Container & Layout (do not break)

- **Root**: `fixed inset-0 flex mesh-gradient overflow-hidden`. NEVER use `h-screen`, `h-dvh`, or viewport units on the root — `fixed inset-0` is the only reliable full-window fill across sizes/DPI/browser-chrome. Use inner `max-w-*` rails for readable content width.
- **CSS base**: `html, body, #root` → `width:100%; height:100%; margin:0; padding:0; overflow:hidden`.
- Design docs: **design-system/README.md** (index), **design-system/DESIGN-STANDARDS.md** (colors, glass system, width rails).

## The 19 Modes

See Home → · Chat · Explain This · Safety Check · Clean Up · Code → Plain English · Idea → Code Spec · Diagram · Security · Validate · Experiment · Review · Create · Prompting · Skillz · Agentic · Planner · Build · Terminal

The toolbar model selector resolves `model: "auto"` server-side via per-mode defaults in `autoModelMap` (defaults in `lib/auto-model.js`); the first SSE may include `resolvedModel`. Live tool-calling (chat-style modes through `lib/chat-post-handler.js`) needs a `TOOL_CALL_CAPABLE` model; builder modes (below) only generate/score text.

- **See Home →** (Dashboard): default landing when Settings → **Show dashboard on startup** is on (`localStorage` `cc-show-dashboard-on-startup`). `src/components/dashboard/` — feature grid (Lucide icons), Recent Work, client-side analytics (`src/lib/analytics.js`), collapsible sections (`CollapsibleSection`), 7-day activity chart, CSV/JSON export, widget visibility toggles (`DashboardSettings`). **Default section state (layout v2):** Recent Work + Feature Grid expanded; Settings + analytics sections collapsed (`dashboard-section-defaults.js`, `cc.dashboard.layoutVersion`). No chat input. Status: **`docs/DASHBOARD-STATUS.md`**.
- **Terminal** (Electron-only): interactive PTY (`node-pty`) spawned in `electron/main.js`, rendered by `xterm.js` (`@xterm/xterm` + `addon-fit`) in `TerminalPanel.jsx`. CWD follows the active File Browser folder (`chatFolder`, validated as an existing dir), falling back to `cfg.chatFolder` → `cfg.projectFolder` → `$HOME`; changing the folder respawns the PTY. One PTY per window, killed on close; browser users see a desktop-only state. **docs/TERMINALFEATURE.md**. Agent terminal (builtin `run_terminal_cmd`, `TOOL_CALL` + `builtin.*`) lives in `lib/builtin-agent-tools.js` — **docs/CLIPLAN.md**.
- **Review**: single/multi-file + **Scan Folder**; A–F report cards across bugs/security/readability/completeness. `reviewFiles()` in `lib/review.js`; routes `/api/review/folder[/preview]`. Limits: 80 files, 2 MB total; `isWithinBasePath()` validation. Multi-file concatenates with separators and scales timeout by file count (max 10 min); timeout floor via `reviewTimeoutSec`.
- **Security**: OWASP assessment, 6 mapped categories, single-file + recursive folder (`/api/pentest/folder`). **Remediate** sends findings+code to the AI and downloads a zip (`REMEDIATION-REPORT.md`, `original/`, `remediated/`) via JSZip. Same 80-file/2 MB limits as Review.
- **Validate**: scans a folder/GitHub repo for linters, type checkers, test runners, CI, scripts (`lib/validate.js`), AI-generates a phased `validate.md` (Lint → Type Check → Style → Tests → E2E), one-click installs to Claude Code / Cursor / VS Code / OpenCode (or all 4).
- **Builder modes** (Prompting, Skillz, Agentic, Planner): share `BaseBuilderPanel` — config-driven fields, AI scoring via `/api/score` (`lib/builder-score.js`, **no live tools**), CRUD + revise/re-score across 4 A–F categories. Revision flow: AI returns `<revised_prompt>` → "Apply Revision & Re-Score" → `formDataRef` syncs → re-score. Files load via File Browser "Load into Form" (`builderAttachRef` → `loadFileIntoForm()`) or the header picker; both call `config.parseLoaded()`. Methodologies: Prompting = TÂCHES meta-prompting (clarity/specificity/structure/effectiveness); Skillz = Agent Skills Spec (agentskills.io); Agentic = CrewAI + LangGraph hybrid (purpose/tools/workflow/guardrails); Planner = implementation-plan quality.
- **Diagram**: any mode emitting a ` ```mermaid ` block renders interactive SVG (Mermaid lazy-loaded as its own Vite chunk; raw during stream, rendered after). Per-diagram zoom/fullscreen/source/theme/export (SVG/PNG with robust raster fallbacks for Electron). `MarkdownContent` uses a custom `marked` renderer + split-and-render to mix HTML with React `MermaidBlock`.
- **Create → Build**: after Create, **Open in Build** registers the project in the Build registry and switches to Build. Both scaffolders copy `IDE_COMMANDS/` into 5 IDE paths (`.claude/commands/`, `.cursor/commands/`, `.cursor/prompts/`, `.github/prompts/`, `.opencode/commands/`); optional Create template path (`icmTemplatePath`) also copies `ICM-fw` into the project root.
- **Tutorial** (Create & Build wizards): toggles step-by-step guidance; step 2+ pulls contextual field suggestions from `POST /api/tutorial-suggestions` (focus/click = suggest, double-click = new, Tab/right-click = accept).

## Header right panels

Toolbar buttons **📖 Glossary**, **🐙 GitHub**, and **📂 Files** each toggle a **320px (`w-80`) right-side panel** in `App.jsx`. Only one panel is open at a time. **Glossary** — searchable jargon reference (`GlossaryPanel` in `JargonGlossary.jsx`); **GitHub** — clone/browse repos (`GitHubPanel`); **Files** — project file tree (`FileBrowser`). See **`docs/JARGON-GLOSSARY.md`** for glossary UX. After frontend changes, rebuild `dist/` before Electron (`npm run build` or `npm run electron:run`).

## Privacy UX

Bottom **PrivacyBanner** + onboarding step “Your Data Stays Here” explain **Ollama = local by default** and **OpenRouter = optional cloud** (Settings → General → AI provider). See **`docs/PRIVACY-MESSAGING.md`**. Dismissal: `th3rdai_privacy_banner_dismissed`; reset from Settings → General.

## Chat, Export & Documents

- **Save Chat**: toolbar button (all modes) downloads the conversation as markdown with an auto-named 1–2 word topic file.
- **Export**: `ExportPanel` → full chat or last response → one+ of **11 formats** (Markdown, Plain Text, HTML, JSON, PDF, DOCX, ODT, XLSX, ODS, CSV, PPTX); multi-select downloads separate files or a ZIP. Server: `POST /api/generate-office` (rate-limited, `lib/office-generator.js`); `GET /api/export/formats` for capabilities. Builtin agent tool `generate_office_file` shares the generator and accepts `sourcePath` (a file under Settings → Project folder) to `convertBuiltin` then export (e.g. project CSV/PDF → `.xlsx`). **docs/EXPORT-CHAT.md**.
- **Document conversion** (two-tier): built-in converters handle common formats; Docling-serve adds OCR / complex layouts when available. Built-in — PDF (pdf-parse), DOCX (mammoth), DOC (word-extractor), XLSX/CSV (read-excel-file); PPTX/PPT/ODT/ODS/ODP/RTF (officeparser; `file-type` pinned via npm overrides + `patches/officeparser+6.0.4.patch`). Legacy `.xls` not supported built-in. Generation: XLSX via ExcelJS, ODS via JSZip + ODF XML (`office-generator.js`). Docling-only: EPUB, LaTeX, TEX. `/api/convert-document` tries Docling first (when enabled) then built-in; response carries `converter: 'docling'|'builtin'`. Docling auto-starts on **port 5002** (not 5001 — macOS AirPlay), managed by `lib/docling-starter.js` (web) / `electron/docling-manager.js` (Electron); config `docling:{ url, apiKey, enabled, ocr }`; install `uv tool install "docling-serve[ui]"`. Prompts in `lib/tool-call-handler.js` / `lib/builtin-agent-tools.js` steer the agent to `generate_office_file` + `sourcePath` for project PDFs. **docs/DOCLING-AUTO-START.md**.

## Settings & Config Keys

Tabs: General, GitHub, MCP Server, MCP Clients, Memory.

- **Ollama connection**: server URL (local or `https://ollama.com`), optional Ollama Cloud API key (Bearer; stored `ollamaApiKey`, env `OLLAMA_API_KEY` when empty), test button.
- **Auto model map**: per-mode model when toolbar = "Auto (best per mode)" (`autoModelMap`; defaults `lib/auto-model.js`). Resolved on chat/review/security/score/validate/build APIs.
- **Memory** (`memory` in config): optional embedding memory; retrieval is **per conversation** — client sends `conversationId` on `POST /api/chat` so `buildMemoryContext()` injects only memories whose `source` matches (`lib/memory.js`).
- **Review Timeout** `reviewTimeoutSec` (60–600s) → `reviewCode()`. Also on General: Project Folder, Agent Readiness checklist (**docs/AGENT-READINESS.md**), Create template path (Commands + ICM-fw), Brand Assets, 3D effects, color theme, welcome tour.
- **Electron-only**: Data Management, Port Configuration (default 8900), **Software Updates** — `electron-updater` against GitHub Releases (`publish` in `electron-builder.config.js`); unpackaged dev disables Upgrade. Ship via GitHub Actions (tag push); local `electron:publish:*` is emergency-only. `getLatestTagName` patched via `patches/electron-updater+6.8.3.patch`; `allowPrerelease` in `electron/updater.js`. **docs/RELEASES-AND-UPDATES.md**, **BUILD.md** (incl. macOS signing: ad-hoc vs `MAC_CODESIGN_IDENTITY` / `:release`).
- Config keys reference: **docs/ENVIRONMENT_VARIABLES.md**; task history in **whats-next.md**.

## Deployment

HTTPS via auto-generated self-signed cert (`deploy.sh`, falls back to HTTP); configurable port (default 8900, in `.cc-config.json`); protocol-aware health checks in `startup.sh`.

## Key Docs

`docs/TROUBLESHOOTING.md` ("Failed to fetch", MCP / `CC_DATA_DIR` vs repo config, Ollama `fetch failed`) · `docs/CC-CONFIG.md` · `docs/TESTING.md` · `docs/JARGON-GLOSSARY.md` · `docs/PRIVACY-MESSAGING.md` · `docs/PROVIDERS.md` · `docs/BUILDER-MARKDOWN-LOAD.md` · `docs/TERMINALFEATURE.md` · `docs/CLIPLAN.md` · `docs/EXPORT-CHAT.md` · `docs/DOCLING-AUTO-START.md` · `docs/AGENT-READINESS.md` · `docs/AGENT-APP-CAPABILITIES-ROADMAP.md` (planned Phases 25–27) · `docs/RELEASES-AND-UPDATES.md` · `BUILD.md` · `design-system/`. Plan-reviewer skill output: `docs/CLIPLAN-plan-review.md`, `docs/VOICE-DICTATION-*` (also `.cursor/skills/plan-reviewer/`).

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **CodeCompanion** (12595 symbols, 17604 relationships, 242 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource                                       | Use for                                  |
| ---------------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/CodeCompanion/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/CodeCompanion/clusters`       | All functional areas                     |
| `gitnexus://repo/CodeCompanion/processes`      | All execution flows                      |
| `gitnexus://repo/CodeCompanion/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->
