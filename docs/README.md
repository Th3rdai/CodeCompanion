# Code Companion — documentation index

Maintainer and user docs for the app. Root stubs (`CLIPLAN.md`, `CLOUDAPI.md`) point here for one release cycle.

## Core operations

| Doc                                                    | Purpose                                             |
| ------------------------------------------------------ | --------------------------------------------------- |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)             | Failed to fetch, MCP, Ollama, logs, desktop crashes |
| [CC-CONFIG.md](./CC-CONFIG.md)                         | `.cc-config.json` shape, secrets, Electron data dir |
| [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) | Env overrides (`CC_DATA_DIR`, bind, API key, …)     |
| [TESTING.md](./TESTING.md)                             | Unit, integration, Playwright, validation commands  |
| [RELEASES-AND-UPDATES.md](./RELEASES-AND-UPDATES.md)   | GitHub Releases, `electron-updater`, tagging        |
| [DOCKER-DEPLOY.md](./DOCKER-DEPLOY.md)                 | Container deployment                                |

## AI, providers, agents

| Doc                                                                      | Purpose                                              |
| ------------------------------------------------------------------------ | ---------------------------------------------------- |
| [PROVIDERS.md](./PROVIDERS.md)                                           | Ollama, OpenRouter, cloud models, provider selection |
| [CLOUDAPI.md](./CLOUDAPI.md)                                             | Multi-provider execution checklist (P0–P7)           |
| [CLIPLAN.md](./CLIPLAN.md)                                               | Agent terminal spec (`builtin.run_terminal_cmd`)     |
| [TERMINALFEATURE.md](./TERMINALFEATURE.md)                               | Electron PTY terminal (integrated shell)             |
| [AGENT-READINESS.md](./AGENT-READINESS.md)                               | Project checklist for agent workflows                |
| [AGENT-APP-CAPABILITIES-ROADMAP.md](./AGENT-APP-CAPABILITIES-ROADMAP.md) | Planned phases 25–27                                 |
| [AGENT-LOOP-IMPROVEMENTS.md](./AGENT-LOOP-IMPROVEMENTS.md)               | Tool-call loop design notes                          |
| [SESSION-PROGRESS.md](./SESSION-PROGRESS.md)                             | Global “Working” strip during SSE                    |

## Features & UX

| Doc                                                    | Purpose                                   |
| ------------------------------------------------------ | ----------------------------------------- |
| [JARGON-GLOSSARY.md](./JARGON-GLOSSARY.md)             | Glossary panel UX and term reference      |
| [PRIVACY-MESSAGING.md](./PRIVACY-MESSAGING.md)         | Local vs cloud privacy copy               |
| [EXPORT-CHAT.md](./EXPORT-CHAT.md)                     | Chat export formats and office generation |
| [DOCLING-AUTO-START.md](./DOCLING-AUTO-START.md)       | Docling-serve OCR / complex layouts       |
| [BUILDER-MARKDOWN-LOAD.md](./BUILDER-MARKDOWN-LOAD.md) | Builder modes file load parsers           |
| [DASHBOARD-STATUS.md](./DASHBOARD-STATUS.md)           | See Home → dashboard ship status          |
| [IMAGES.md](./IMAGES.md)                               | Vision attachments and limits             |
| [MULTI-FILE-REVIEW.md](./MULTI-FILE-REVIEW.md)         | Multi-file review mode                    |

## MCP & integrations

| Doc                                                                        | Purpose                      |
| -------------------------------------------------------------------------- | ---------------------------- |
| [ARCHON-MCP.md](./ARCHON-MCP.md)                                           | Archon task/knowledge MCP    |
| [CRAWL4AI-RAG-MCP.md](./CRAWL4AI-RAG-MCP.md)                               | Crawl4AI RAG MCP setup       |
| [MCP-SANDBOX-PATTERNS.md](./MCP-SANDBOX-PATTERNS.md)                       | MCP sandbox patterns         |
| [MCP-PARALLEL-EXECUTION-RESEARCH.md](./MCP-PARALLEL-EXECUTION-RESEARCH.md) | Parallel MCP research        |
| [IDE_COMMANDS.md](./IDE_COMMANDS.md)                                       | Scaffolded IDE command files |

## Install & security

| Doc                                                                                                  | Purpose                            |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------- |
| [INSTALL-MAC.md](./INSTALL-MAC.md)                                                                   | macOS install, Gatekeeper, signing |
| [INSTALL-WINDOWS.md](./INSTALL-WINDOWS.md)                                                           | Windows install                    |
| [SECURITY-OPERATIONS.md](./SECURITY-OPERATIONS.md)                                                   | Security ops practices             |
| [PENTEST-REPORT-CodeCompanion-Static-Analysis.md](./PENTEST-REPORT-CodeCompanion-Static-Analysis.md) | Static pentest report              |

## Planning & meta

| Doc                                                      | Purpose                               |
| -------------------------------------------------------- | ------------------------------------- |
| [REORGPLAN.md](./REORGPLAN.md)                           | File reorganization plan (Phases 1–6) |
| [CLAUDE-CODE-AUTOMATION.md](./CLAUDE-CODE-AUTOMATION.md) | Hooks, skills, agents in `.claude/`   |

## Plan reviews & runbooks

| Doc                                                                  | Purpose                                           |
| -------------------------------------------------------------------- | ------------------------------------------------- |
| [CLIPLAN-plan-review.md](./CLIPLAN-plan-review.md)                   | CLIPLAN plan review                               |
| [TERMINALFIX-plan-review.md](./TERMINALFIX-plan-review.md)           | Terminal fix plan review                          |
| [VOICE-DICTATION-PLAN.md](./VOICE-DICTATION-PLAN.md)                 | Voice dictation plan                              |
| [runbooks/PDF-REVIEW-RECOVERY.md](./runbooks/PDF-REVIEW-RECOVERY.md) | PDF review recovery                               |
| [troubleshooting/](./troubleshooting/)                               | MCP certs, Google Workspace, PCI connection notes |
