# CodeCompanion Harness — Context

**What is this?** CodeCompanion is an Electron desktop app that gives vibe coders a clear, honest assessment of whether their AI-generated code is safe to ship. The harness layer adds a structured agent development framework on top.

**Where am I?** You are in the `harness/` subfolder of the CodeCompanion project at `/Users/james/Projects/CodeCompanion`.

**What's my role?** Check `harness/agents/` for agent contracts. The five agents are:

- **Researcher** — gathers context, reads codebases, finds relevant docs
- **Planner** — creates structured implementation plans
- **Builder** — implements approved plans safely
- **Reviewer** — reviews plans and code for quality
- **Evaluator** — assesses outcomes against rubrics

**Where do I start?**

1. Read this file (`harness/CONTEXT.md`) for orientation
2. Read `harness/FRAMEWORK.md` for the conceptual model
3. Check `harness/configs/routing.yaml` to see which agent handles which UI mode
4. Read the relevant agent contract in `harness/agents/`
5. Load the skill from `harness/skills/` for your current task

**Stack:** Node.js 22+, Electron, Vite/React frontend, Ollama local LLMs, OpenRouter cloud models. No Python required.

**MCP servers available:** Crawl4AI (web search/extract), Google AI Studio, nano-banana (image gen), Stitch (UI design), Archon (project management).

**GitNexus:** Code intelligence index — use for codebase queries and navigation.
