# Agent Development Harness — Framework

## Purpose

This harness is a plain-text, model-agnostic framework for designing, evaluating, and improving AI-powered code review and development workflows within CodeCompanion.

It uses structured context, reusable skills, versioned prompts, explicit agent contracts, model profiles, and evaluation rubrics so AI-assisted work can be repeated, inspected, and improved over time.

## Operating Model

The harness is **agent-driven, not engine-driven**: agents are role contracts (markdown files) and skills are procedures a capable AI agent follows. Routing (`configs/routing.yaml`) maps CodeCompanion's UI modes to the appropriate agent/stage combination.

No Python orchestrator is needed — CodeCompanion's existing Node.js/Electron architecture handles orchestration through its mode system and chat loop.

## 5-Layer Navigation Model

```text
┌─────────────────────────────────────────────────────┐
│ Layer 1: ORIENTATION (CONTEXT.md, this file)       │
│ "Where am I? What's my role? Where do I start?"   │
│ ~800 tokens                                         │
└─────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────┐
│ Layer 2: FOUNDATION (FRAMEWORK.md, agents/)        │
│ "What are the concepts? Who does what?"            │
│ ~2,000 tokens (targeted)                           │
└─────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────┐
│ Layer 3: DOMAIN (skills/, prompts/, models/)       │
│ "How do I perform this specific task?"             │
│ ~1,000-3,000 tokens per skill                       │
└─────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────┐
│ Layer 4: DETAIL (configs/, stages/, evals/)        │
│ "What are the exact parameters and criteria?"     │
│ ~500-2,000 tokens per config                        │
└─────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────┐
│ Layer 5: EVIDENCE (runs/, telemetry/)              │
│ "What happened last time? What did we learn?"     │
│ Variable — load on demand                           │
└─────────────────────────────────────────────────────┘
```

## Mode-to-Agent Mapping

CodeCompanion's UI modes map to harness agents:

| UI Mode  | Primary Agent | Secondary Agent | Skill Area                   |
| -------- | ------------- | --------------- | ---------------------------- |
| Chat     | Builder       | Researcher      | General development          |
| Review   | Reviewer      | Evaluator       | Code review                  |
| Security | Reviewer      | Evaluator       | Security scanning            |
| Builder  | Builder       | Planner         | Prompt/skill/agentic scoring |
| Planner  | Planner       | Reviewer        | Plan creation & scoring      |
| Create   | Planner       | Builder         | Project scaffolding          |
| Build    | Builder       | Evaluator       | Build & validation           |

## Agent Roles

### Researcher

Gathers context, reads codebases, finds relevant documentation. Output: structured research notes.

### Planner

Creates structured implementation plans with clear steps, dependencies, and acceptance criteria. Output: plan document ready for review.

### Builder

Implements approved plans safely, following repository conventions. Output: code changes + validation results.

### Reviewer

Reviews plans and code for quality, completeness, and safety. Output: review report with letter grades and actionable findings.

### Evaluator

Assesses outcomes against rubrics and acceptance criteria. Output: evaluation report with pass/fail and improvement notes.

## Skill Lifecycle

1. **Define** — Write a SKILL.md describing the procedure
2. **Test** — Create test cases in `evals/cases/`
3. **Execute** — Run the skill against real input
4. **Evaluate** — Score results against rubrics in `evals/rubrics/`
5. **Iterate** — Refine the skill based on evaluation
6. **Release** — Ship the improved skill

## Model Profiles

The harness is model-agnostic. Model profiles in `configs/models.yaml` bind agents to provider/model settings. CodeCompanion defaults to:

- **Ollama** for local models (privacy-first, offline-capable)
- **OpenRouter** for cloud models when more capability is needed

See `models/model-matrix.md` for selection guidance.

## What This Harness Is NOT

- Not a replacement for CodeCompanion's existing `.claude/` skills or `.planning/` docs
- Not a Python orchestrator or separate runtime
- Not a build system or CI pipeline
- Not a replacement for the existing UI mode system

This harness is an **additive layer** that gives structure and repeatability to AI-assisted work within CodeCompanion.
