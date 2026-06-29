# CodeCompanion Harness — CLAUDE.md

> **Read this first** when working in the CodeCompanion harness.

## Project Identity

CodeCompanion is a desktop AI code review and security analysis app built with Electron + React + Vite. It helps vibe coders paste, upload, or point to their AI-generated code and get a clear, honest assessment of whether it's safe to ship.

## Tech Stack

- **Frontend:** React + Vite (TypeScript/JSX)
- **Desktop:** Electron + electron-builder
- **Backend:** Node.js (Express server)
- **LLM:** Ollama (local models) + OpenRouter (cloud fallback)
- **MCP:** Crawl4AI, Google AI Studio, nano-banana, Stitch, Archon
- **Code Intelligence:** GitNexus

## Harness Navigation

1. **Orientation:** Read `CONTEXT.md` → `FRAMEWORK.md`
2. **Foundation:** Check `agents/` → `configs/`
3. **Domain:** Use `skills/` → `prompts/` → `models/`
4. **Execution:** Follow `stages/` → log to `runs/`
5. **Reference:** Evaluate with `evals/` → track with `telemetry/`

## Conventions

- **Configs:** YAML for harness configs (human-readable, supports comments)
- **Skills:** Markdown with YAML frontmatter (name, description)
- **Agents:** Markdown with IN SCOPE / OUT OF SCOPE / Tools sections
- **Prompts:** Versioned (v1, v2, ...) with registry in `prompts/registry.md`
- **Runs:** Timestamped markdown files in `runs/`

## Safety

- Default autonomy mode: **cautious** (auto-approve LOW/MEDIUM, prompt HIGH, block CRITICAL)
- Tool policies enforced per agent (see `configs/tools.yaml`)
- MCP servers validated for safety (see `configs/autonomy.yaml`)

## Quick Links

- [Framework](FRAMEWORK.md)
- [Context](CONTEXT.md)
- [Agent Contracts](agents/)
- [Routing Config](configs/routing.yaml)
- [Skills](skills/)
- [Migration Mapping](docs/migration-mapping.md)
