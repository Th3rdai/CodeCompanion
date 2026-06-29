# CodeCompanion Agent Development Harness

A plain-text, model-agnostic harness for designing, evaluating, and improving AI-powered code review workflows.

## Quick Start

1. **Read** `harness/CONTEXT.md` — Orientation and project identity
2. **Read** `harness/FRAMEWORK.md` — The 5-layer navigation model and mode-based lifecycle
3. **Explore** `harness/agents/` — The 5 agent contracts (researcher, planner, builder, reviewer, evaluator)
4. **Check** `harness/configs/` — Agent routing, model profiles, tool policies, autonomy modes
5. **Browse** `harness/skills/` — The 13 skills available to agents
6. **Review** `harness/stages/` — The 7-stage lifecycle from task definition to release

## Directory Structure

```
harness/
├── CONTEXT.md           # Project identity and entry point
├── FRAMEWORK.md         # 5-layer navigation model
├── _config/             # Project-specific configuration
├── agents/              # 5 agent contracts
├── configs/             # 6 YAML config files
├── docs/                # Documentation and migration mapping
├── evals/               # Evaluation cases and rubrics
├── mcp/                 # MCP server scripts
├── models/              # Model profiles and guidance
├── plans/               # Implementation plans
├── prompts/             # Versioned prompts per agent
├── runs/                # Run logs and telemetry
├── scripts/             # Harness utility scripts
├── shared/              # Shared resources
├── skills/              # 13 skills available to agents
├── stages/              # 7-stage lifecycle contracts
└── telemetry/           # Run logging schema
```

## 5-Layer Navigation Model

1. **Orientation** — `CONTEXT.md`, `FRAMEWORK.md` — "Where am I? What's my role?"
2. **Foundation** — `agents/`, `configs/` — "What are the concepts? Who does what?"
3. **Domain** — `skills/`, `prompts/`, `models/` — "How do I perform this task?"
4. **Execution** — `stages/`, `runs/` — "What's the current state of work?"
5. **Reference** — `evals/`, `telemetry/` — "How did it go? What can we improve?"

## Mode-Based Lifecycle

CodeCompanion's UI modes map to harness agents:

| UI Mode  | Primary Agents               | Description                       |
| -------- | ---------------------------- | --------------------------------- |
| Chat     | researcher, reviewer         | General coding Q&A                |
| Review   | reviewer, evaluator          | AI code review with letter grades |
| Security | reviewer, evaluator          | OWASP security assessment         |
| Builder  | builder, evaluator           | Score AI builder content          |
| Planner  | planner, reviewer            | Score and validate plans          |
| Create   | researcher, planner, builder | Scaffold new projects             |
| Build    | builder, reviewer            | Build with IDE integration        |

## Model Stack

- **Local:** Ollama (qwen3:32b, qwen3:14b)
- **Cloud:** OpenRouter (auto fallback)

## MCP Integrations

- **Crawl4AI** — Web search and content extraction (researcher, reviewer)
- **Google AI Studio** — AI content generation (researcher)
- **nano-banana** — Image generation (builder)
- **Stitch** — UI/screen design (builder)
- **Archon** — Project/task management (planner, builder, evaluator)

## Origin

Adapted from [VIRA's Agent Development Harness](https://github.com/Th3rdai/VIRA) — a proven framework with 18+ skills, 6 MCP servers, and a working orchestrator.

## License

See the project's [LICENSE](../LICENSE) file.
