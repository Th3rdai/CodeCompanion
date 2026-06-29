# CocoHarness — Adapt VIRA's Agent Development Harness for CodeCompanion

**Status:** REVIEWED (plan-reviewer, 3 iterations — all findings resolved)
**Created:** 2026-06-28
**Reviewed:** 2026-06-28 (3 rounds)
**Author:** Coco (Code Companion)
**Priority:** High
**Feature:** harness-architecture

---

## Review History

| Round | Key Findings                                                                                                                                                                           | Resolution                                                                                                                                                      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Model profiles used Claude defaults but CodeCompanion is Ollama-based; Python orchestrator doesn't fit Node/Electron stack; 7-stage lifecycle mismatched CodeCompanion's mode-based UI | Rewrote model profiles for Ollama/OpenRouter; explicitly excluded Python orchestrator; replaced 7-stage lifecycle with 5-mode mapping                           |
| 2     | No GitNexus integration; .planning/ 28-phase history unmapped; config format mismatch (YAML vs JSON); no minimal-viable path; generic acceptance criteria                              | Added GitNexus as knowledge layer; mapped .planning/ migration; chose YAML for harness configs with rationale; added MVP path; specific file-existence criteria |
| 3     | Routing should map UI modes not VIRA stages; no "what NOT to do"; no rollback; MCP tools unmapped; no commit strategy                                                                  | Rewrote routing as mode→agent mapping; added exclusions section; added rollback; mapped MCP servers in tools.yaml; commit-per-phase                             |

---

## Goal

Bring VIRA's proven AI Agent Development Harness architecture to CodeCompanion — giving the project a structured, plain-text, model-agnostic framework for designing, evaluating, and improving AI-powered code review workflows, agent contracts, skills, prompts, and evaluation rubrics.

## Why This Matters

CodeCompanion already has rich infrastructure:

- `.claude/skills/` with **6 working skills** (`change-execution-checklist`, `code-companion-conventions`, `gitnexus`, `plan-reviewer`, `release-desktop`, `ui-ux-pro-max`)
- `.claude/agents/` with **2 agent definitions** (`security-pass`, `mcp-contract-check`)
- `.claude/commands/` with **9 slash commands** (`validate-project`, `whats-next`, `summarize`, etc.)
- `.claude/hooks/` for safety guards (`block-sensitive-files.sh`, `run-unit-tests.sh`)
- `.planning/` with **28 completed phases**, research, design, codebase analysis docs
- Multi-IDE support (12+ environments: Claude, Cursor, Codex, Continue, Gemini, etc.)
- GitNexus code intelligence integration (active skill)
- MCP server integrations: Crawl4AI, Google AI Studio, nano-banana, Stitch, Archon
- **Tech stack:** Node.js backend (`server.js`), React/Vite frontend (`src/`), Electron desktop (`electron/`), Ollama local LLMs
- **Version:** 1.7.4 (`package.json`)

**What's missing:** A unified framework that ties these pieces together with:

- Explicit agent contracts (roles, permissions, handoffs)
- A mode→agent routing model (Chat, Review, Security, Build, Plan → which agent, which skill)
- Model profiles that reflect the actual Ollama/OpenRouter stack
- Evaluation rubrics and test cases as first-class artifacts
- Run logging and telemetry for auditability
- A 5-layer navigation model for progressive context loading

VIRA's harness solves all of this. This plan adapts it for CodeCompanion's context as an **Electron desktop AI code review app** — not a voice agent system.

---

## What This Plan Will NOT Do

> Added in review round 3 — explicit exclusions to prevent scope creep and tech mismatch.

- **NO Python runtime** — CodeCompanion is a Node.js/Electron project. VIRA's Python orchestrator (`scripts/orchestrate.py`) is NOT ported. If orchestration is needed later, it will be written in Node.js.
- **NO new dependencies** — The harness is plain-text markdown + YAML configs only. No npm packages, no Python venvs.
- **NO replacement of existing infrastructure** — `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, and `.planning/` are NOT deleted. The harness sits alongside them and references them.
- **NO Electron build changes** — The harness is documentation and config only. It does not modify `electron/main.js`, `server.js`, or the build pipeline.
- **NO auto-updater impact** — The harness has no executable code. It won't affect `electron/updater.js` or release distribution.
- **NO forced adoption** — The harness is opt-in. Existing workflows continue to work without it. It adds value; it doesn't block.

---

## Scope

### In Scope

- Create a `harness/` subfolder in CodeCompanion (sibling to `.claude/` and `.planning/`)
- Adapt VIRA's 5-layer navigation model for CodeCompanion's identity (code review + security + desktop app)
- Create 5 agent contracts tailored to CodeCompanion's workflows (reconciling with existing 2 agents)
- Port and tailor configs as YAML: `agents.yaml`, `routing.yaml`, `models.yaml`, `tools.yaml`, `autonomy.yaml`
- Map CodeCompanion's 5 UI modes (Chat, Review, Security, Build, Plan) to agents and skills
- Create evaluation rubrics for code review quality (not agent quality — different from VIRA)
- Migrate existing `.planning/` content into harness structure (28 phases → `plans/archive/`)
- Integrate GitNexus as the harness knowledge layer
- Map MCP server integrations in `tools.yaml`

### Out of Scope

- Porting VIRA's Python orchestrator CLI
- Modifying CodeCompanion's Electron build process
- Creating new npm dependencies
- Replacing the existing `.claude/` or `.planning/` structures
- Auto-generating agent code (contracts are markdown, not executable)

---

## Architecture: VIRA vs CodeCompanion

| Aspect            | VIRA                                                             | CodeCompanion (adapted)                                            |
| ----------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Product**       | Voice AI agent system                                            | Electron desktop code review app                                   |
| **Stack**         | Python, FastAPI, WebSocket                                       | Node.js, React/Vite, Electron                                      |
| **LLM**           | Ollama + OpenRouter                                              | Ollama (primary) + OpenRouter (cloud)                              |
| **Workflow**      | 7-stage lifecycle (task→agent→prompt→tools→eval→iterate→release) | 5 UI modes (Chat, Review, Security, Build, Plan)                   |
| **Routing**       | Stage→Agent mapping                                              | Mode→Agent mapping                                                 |
| **Skills**        | 18 skills (research, plan, build, eval, security, etc.)          | 6 existing skills + new harness skills                             |
| **Agents**        | 5 (researcher, planner, builder, reviewer, evaluator)            | 5 adapted (analyst, reviewer, security-engineer, builder, planner) |
| **Orchestrator**  | Python CLI (`orchestrate.py`)                                    | None (modes serve as routing)                                      |
| **Config format** | YAML                                                             | YAML (same — human-readable, comments)                             |
| **Knowledge**     | Memory vault (facts, wiki, sessions)                             | GitNexus index + `.planning/` docs                                 |

---

## Implementation Phases

### Minimal Viable Harness (MVP Path)

> Added in review round 2 — 80% of the value with 20% of the effort.

If you only do **Phase 1 + Phase 2**, you get:

- The harness directory structure
- Orientation docs (`CLAUDE.md`, `CONTEXT.md`, `FRAMEWORK.md`) adapted for CodeCompanion
- The 5-layer navigation model

This alone gives you a repeatable onboarding framework. Phases 3–6 add depth but aren't required for initial value.

---

### Phase 1 — Scaffold the Directory Tree (~1 hr)

**Goal:** Create the `harness/` directory structure matching VIRA's proven layout.

**Directory tree to create:**

```
harness/
  _config/           # Project-specific overlays
    project-notes.md
    security-baseline.md
    brand-voice.md
  agents/            # Agent contracts (markdown)
    README.md
  configs/           # YAML configs
    agents.yaml
    routing.yaml
    models.yaml
    tools.yaml
    autonomy.yaml
    execution.yaml
  docs/              # Harness-level docs
    QUICK-REFERENCE.md
  evals/             # Evaluation rubrics and test cases
    cases/
    rubrics/
    README.md
  models/            # Model selection guidance
    providers.md
    model-matrix.md
    local-models.md
  plans/             # Implementation plans (active + archive)
    archive/         # Migrated .planning/phases/ content
    INDEX.md
  prompts/           # Versioned prompt templates
    registry.md
  runs/              # Run logs (agent execution records)
    .gitkeep
  skills/            # Skill stubs (reference existing .claude/skills/)
    README.md
  stages/            # Stage contracts (adapted from VIRA's 7-stage model)
    README.md
  telemetry/         # Telemetry schema docs
    run-log-schema.md
  CLAUDE.md          # Layer 1: Orientation
  CONTEXT.md         # Layer 1: Orientation
  FRAMEWORK.md       # Layer 2: Foundation
  README.md          # Entry point
```

**Acceptance criteria (specific — reviewed round 2):**

- [ ] `harness/` directory exists at project root (sibling to `.claude/` and `.planning/`)
- [ ] All 14 subdirectories exist: `_config/`, `agents/`, `configs/`, `docs/`, `evals/`, `models/`, `plans/`, `prompts/`, `runs/`, `skills/`, `stages/`, `telemetry/`
- [ ] `harness/README.md` exists and explains the harness purpose
- [ ] `harness/plans/archive/` exists for .planning/ migration target
- [ ] `harness/runs/.gitkeep` exists so the directory is tracked by git
- [ ] No Python files created (exclusion from round 3)
- [ ] `git status` shows only new `harness/` files (no modifications to existing files)

**Commit:** `feat(harness): scaffold directory tree`

---

### Phase 2 — Orientation Layer (~2 hrs)

**Goal:** Write the Layer 1 and Layer 2 docs that give the harness its identity.

**Files to create:**

#### `harness/CLAUDE.md` — Layer 1: Orientation (~400 tokens)

Adapted from VIRA's CLAUDE.md. Answers: "Where am I? What's my role? Where do I start?"

- Project identity: CodeCompanion is an Electron desktop AI code review app
- Stack: Node.js, React/Vite, Electron, Ollama
- Pointers: CONTEXT.md (project state), FRAMEWORK.md (concepts), agents/ (roles), skills/ (procedures)
- Current version: 1.7.4
- Key rule: harness is documentation-only — no executable code, no new dependencies

#### `harness/CONTEXT.md` — Layer 1: Project State (~300 tokens)

- Roadmap status: 28 phases complete (.planning/STATE.md)
- Current focus: post-roadmap stabilization, tagged patch releases
- Key files: `server.js` (backend), `src/App.jsx` (frontend), `electron/main.js` (desktop)
- MCP servers: Crawl4AI, Google AI Studio, nano-banana, Stitch, Archon
- Test gates: `npm run test:unit`, `npm run validate:static`, Playwright E2E

#### `harness/FRAMEWORK.md` — Layer 2: Foundation (~800 tokens)

Adapted from VIRA's FRAMEWORK.md. Covers:

- The 5-layer navigation model (Orientation → Foundation → Domain → Execution → Assessment)
- The 5-mode workflow (Chat, Review, Security, Build, Plan) replacing VIRA's 7-stage lifecycle
- Agent-driven model: agents are role contracts, skills are procedures
- Config-driven routing: `routing.yaml` maps modes to agents
- No orchestrator — modes serve as routing (difference from VIRA)

**Acceptance criteria:**

- [ ] `harness/CLAUDE.md` exists, mentions CodeCompanion (not VIRA), references correct stack
- [ ] `harness/CONTEXT.md` exists, references `.planning/STATE.md` and `package.json` version
- [ ] `harness/FRAMEWORK.md` exists, describes 5-layer model and 5-mode workflow
- [ ] No mention of Python, FastAPI, or voice pipelines (VIRA-specific concepts removed)
- [ ] All three files reference each other with correct relative paths

**Commit:** `docs(harness): write orientation layer (CLAUDE.md, CONTEXT.md, FRAMEWORK.md)`

---

### Phase 3 — Agent Contracts (~2 hrs)

**Goal:** Create 5 agent contracts adapted for CodeCompanion's code review workflows.

> Reviewed round 1: VIRA's 5 agents (researcher, planner, builder, reviewer, evaluator) don't map 1:1 to CodeCompanion. Renamed and refocused.

**Agents to create:**

| Agent                 | VIRA Equivalent | CodeCompanion Focus                                                   |
| --------------------- | --------------- | --------------------------------------------------------------------- |
| **Analyst**           | Researcher      | Reads code, gathers context, identifies issues via GitNexus           |
| **Reviewer**          | Reviewer        | Performs AI code review (Review mode), generates report cards         |
| **Security Engineer** | Evaluator       | Runs OWASP security scans (Security mode), identifies vulnerabilities |
| **Builder**           | Builder         | Scaffolds new projects (Build mode), generates code from templates    |
| **Planner**           | Planner         | Scores plans (Planner mode), validates implementation approaches      |

Each contract follows VIRA's proven structure:

```markdown
# Agent: [Name]

## Purpose

[One paragraph — what this agent does in CodeCompanion]

## Inputs

- [What this agent receives]

## Outputs

- [What this agent produces]

## Scope

### IN SCOPE

- [Allowed actions]

### OUT OF SCOPE

- [Disallowed actions]

## Tools Allowed

- [Tools this agent may use]

## Tools Disallowed

- [Tools this agent may not use]

## Mode Binding

- [Which CodeCompanion UI mode(s) this agent serves]

## Autonomy Mode Guidance

- Full / Cautious / Ask mode behavior
```

**Reconciliation with existing agents:**

- `.claude/agents/security-pass.md` → referenced by the Security Engineer contract (not deleted)
- `.claude/agents/mcp-contract-check.md` → referenced by the Analyst contract (not deleted)
- The harness agents are higher-level role contracts; the `.claude/agents/` files are task-specific execution guides

**Acceptance criteria:**

- [ ] 5 agent contract files exist in `harness/agents/`
- [ ] Each contract has: Purpose, Inputs, Outputs, Scope, Tools, Mode Binding, Autonomy
- [ ] No contract references Python, voice, or VIRA-specific concepts
- [ ] Security Engineer contract references `.claude/agents/security-pass.md`
- [ ] Analyst contract references `.claude/agents/mcp-contract-check.md`
- [ ] `harness/agents/README.md` lists all 5 agents with one-line summaries

**Commit:** `feat(harness): create 5 agent contracts for CodeCompanion modes`

---

### Phase 4 — Configs & Routing (~1.5 hrs)

**Goal:** Create YAML configs that map modes to agents and define model/tool policies.

> Reviewed round 1: Model profiles must use Ollama (not Claude). Reviewed round 3: Routing maps UI modes (not VIRA stages).

#### `harness/configs/agents.yaml`

Maps agent names to contract files, default skills, and model profiles.

```yaml
agents:
  analyst:
    contract: agents/analyst.agent.md
    default_skill: skills/research/research.md
    model_profile: analysis

  reviewer:
    contract: agents/reviewer.agent.md
    default_skill: skills/review/review.md
    model_profile: review

  security_engineer:
    contract: agents/security-engineer.agent.md
    default_skill: skills/security/security.md
    model_profile: security

  builder:
    contract: agents/builder.agent.md
    default_skill: skills/build/build.md
    model_profile: building

  planner:
    contract: agents/planner.agent.md
    default_skill: skills/plan/planner.md
    model_profile: planning
```

#### `harness/configs/routing.yaml`

> Reviewed round 3: Maps UI modes (not VIRA's 7 stages) to agents.

```yaml
modes:
  chat:
    agent: analyst
    description: General chat, code questions, context gathering

  review:
    agent: reviewer
    description: AI code review with structured report card

  security:
    agent: security_engineer
    description: OWASP-style security assessment and vulnerability scanning

  build:
    agent: builder
    description: Project scaffolding and code generation from templates

  plan:
    agent: planner
    description: Implementation plan scoring and validation
```

#### `harness/configs/models.yaml`

> Reviewed round 1: Must reflect CodeCompanion's actual Ollama/OpenRouter stack, not VIRA's Claude defaults.

```yaml
# Model profiles for CodeCompanion's Ollama + OpenRouter stack.
# These are defaults — the app's auto-model-selection may override at runtime.
# See models/model-matrix.md for selection guidance.
model_profiles:
  analysis:
    provider: ollama
    model: qwen2.5-coder:14b
    temperature: 0.2
    notes: Code reading and context gathering. Coder model for syntax awareness.

  review:
    provider: ollama
    model: qwen2.5-coder:14b
    temperature: 0.3
    notes: Code review with slightly higher temperature for diverse findings.

  security:
    provider: ollama
    model: qwen2.5-coder:14b
    temperature: 0.2
    notes: Security analysis. Low temperature for consistent vulnerability detection.

  building:
    provider: ollama
    model: qwen2.5-coder:14b
    temperature: 0.4
    notes: Code generation. Higher temperature for creative template filling.

  planning:
    provider: ollama
    model: qwen2.5-coder:32b
    temperature: 0.2
    notes: Plan scoring. Larger model for deeper reasoning and scope analysis.
```

#### `harness/configs/tools.yaml`

> Reviewed round 3: Maps CodeCompanion's actual MCP server integrations.

```yaml
# MCP server integrations available to harness agents.
# These map to the MCP servers configured in CodeCompanion's Settings.
mcp_servers:
  crawl4ai_rag:
    tools: [search_web, crawl_website, extract_content]
    available_to: [analyst, reviewer, security_engineer]

  google_ai_studio:
    tools: [generate_content]
    available_to: [analyst, reviewer, planner]

  nano_banana:
    tools: [generate_image, upload_file]
    available_to: [builder]

  stitch:
    tools: [create_project, generate_screen_from_text, edit_screens]
    available_to: [builder]

  archon:
    tools: [find_projects, manage_project, find_tasks, rag_search]
    available_to: [planner, analyst]

# Built-in tools (CodeCompanion app features)
builtin_tools:
  review_run:
    available_to: [reviewer]
  pentest_scan:
    available_to: [security_engineer]
  builder_score:
    available_to: [planner]
  score_plan:
    available_to: [planner]
```

#### `harness/configs/autonomy.yaml`

```yaml
# Autonomy levels for harness agents.
# CodeCompanion's agent terminal has full/citous/ask modes.
autonomy:
  default: cautious
  levels:
    full:
      description: All decisions auto-approved. For trusted batch operations.
      allowed_agents: [analyst, reviewer]
    cautious:
      description: Auto-approve LOW/MEDIUM risk, prompt for HIGH, block CRITICAL.
      allowed_agents: [analyst, reviewer, security_engineer, builder, planner]
    ask:
      description: Prompt for all actions. Maximum user control.
      allowed_agents: [security_engineer, builder]
```

#### `harness/configs/execution.yaml`

```yaml
# Execution settings for harness operations.
# No orchestrator — modes serve as routing.
execution:
  dry_run: true
  log_runs: true
  runs_dir: runs/
  telemetry: true
```

**Acceptance criteria:**

- [ ] 6 YAML config files exist in `harness/configs/`
- [ ] `agents.yaml` references all 5 agent contracts with correct relative paths
- [ ] `routing.yaml` maps 5 UI modes (chat, review, security, build, plan) to agents
- [ ] `models.yaml` uses `provider: ollama` (not `claude`) — verified by grep
- [ ] `tools.yaml` lists all 5 MCP servers (crawl4ai_rag, google_ai_studio, nano_banana, stitch, archon)
- [ ] `autonomy.yaml` defines 3 levels (full, cautious, ask)
- [ ] All YAML files are valid (parse without error)

**Commit:** `feat(harness): add configs for agents, routing, models, tools, autonomy`

---

### Phase 5 — Skills, Stages & Evals (~2 hrs)

**Goal:** Create skill stubs, stage contracts, and evaluation rubrics for code review quality.

#### Skills (`harness/skills/`)

Create stubs that reference existing `.claude/skills/` where applicable:

| Skill                  | References                              | Purpose                                       |
| ---------------------- | --------------------------------------- | --------------------------------------------- |
| `review/review.md`     | (new)                                   | AI code review procedure (Review mode)        |
| `security/security.md` | `.claude/agents/security-pass.md`       | OWASP security scan procedure (Security mode) |
| `build/build.md`       | (new)                                   | Project scaffolding procedure (Build mode)    |
| `plan/planner.md`      | `.claude/skills/plan-reviewer/SKILL.md` | Plan scoring procedure (Planner mode)         |
| `research/research.md` | (new)                                   | Code reading and context gathering procedure  |
| `gitnexus/gitnexus.md` | `.claude/skills/gitnexus/SKILL.md`      | GitNexus code intelligence queries            |

#### Stages (`harness/stages/`)

> Reviewed round 1: CodeCompanion doesn't use VIRA's 7-stage lifecycle. Stages are lightweight workflow descriptions for each mode.

| Stage          | Mode                   | Flow                                                   |
| -------------- | ---------------------- | ------------------------------------------------------ |
| `01-intake`    | All                    | User provides code/file/project → agent receives input |
| `02-analysis`  | Review, Security       | Agent reads code, identifies issues                    |
| `03-scoring`   | Review, Plan           | Agent generates grades/scores                          |
| `04-reporting` | Review, Security, Plan | Agent produces structured output                       |
| `05-iteration` | Build                  | Agent refines output based on user feedback            |

Each stage is a short markdown file (~50 lines) describing inputs, outputs, and the agent responsible.

#### Evals (`harness/evals/`)

> Reviewed round 2: VIRA's evals are for agent quality. CodeCompanion needs evals for review quality — different focus.

Create:

- `harness/evals/rubrics/review-quality.md` — What makes a good code review? (accuracy, completeness, clarity, actionability)
- `harness/evals/rubrics/security-scan-quality.md` — What makes a good security scan? (OWASP coverage, severity accuracy, remediation clarity)
- `harness/evals/rubrics/plan-score-quality.md` — What makes a good plan score? (calibration, reasoning, usefulness)
- `harness/evals/cases/` — 3-5 sample code snippets with known issues for testing review quality
- `harness/evals/README.md` — How to run evals and interpret results

**Acceptance criteria:**

- [ ] 6 skill stub files exist in `harness/skills/`
- [ ] `security/security.md` references `.claude/agents/security-pass.md`
- [ ] `plan/planner.md` references `.claude/skills/plan-reviewer/SKILL.md`
- [ ] `gitnexus/gitnexus.md` references `.claude/skills/gitnexus/SKILL.md`
- [ ] 5 stage files exist in `harness/stages/`
- [ ] 3 rubric files exist in `harness/evals/rubrics/`
- [ ] `harness/evals/README.md` exists and explains eval methodology
- [ ] No skill or stage file references Python or voice concepts

**Commit:** `feat(harness): add skills, stages, and evaluation rubrics`

---

### Phase 6 — Migration & Knowledge Layer (~2 hrs)

**Goal:** Migrate existing `.planning/` content into the harness and integrate GitNexus.

> Reviewed round 2: Must map all 28 phases. Reviewed round 2: GitNexus is a first-class knowledge layer.

#### .planning/ Migration

| Source                                   | Destination                              | Action                                                                             |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `.planning/phases/15.md` through `27.md` | `harness/plans/archive/phase-15.md` etc. | Copy (don't move — .planning/ stays for backward compat)                           |
| `.planning/STATE.md`                     | `harness/CONTEXT.md` (reference)         | Already referenced in Phase 2                                                      |
| `.planning/PROJECT.md`                   | `harness/_config/project-notes.md`       | Summarize key info                                                                 |
| `.planning/ROADMAP.md`                   | `harness/plans/INDEX.md`                 | Create index from roadmap                                                          |
| `.planning/research/`                    | `harness/models/` and `harness/docs/`    | Research docs about stack/architecture go to docs/; model research goes to models/ |
| `.planning/codebase/`                    | `harness/docs/`                          | Architecture, structure, conventions docs                                          |
| `.planning/design/`                      | `harness/_config/`                       | Design decisions                                                                   |
| `.planning/drafts/`                      | `harness/plans/archive/drafts/`          | Draft plans                                                                        |

**Important:** Do NOT delete `.planning/`. Copy relevant content into the harness. `.planning/` remains the source of truth for historical phases; the harness references it.

#### GitNexus Integration

Create `harness/docs/gitnexus-integration.md`:

- How harness agents use GitNexus for code intelligence
- Query patterns: "find all files that import X", "show me the call graph for function Y"
- How GitNexus index stats inform the Analyst agent's context gathering
- Reference: `.claude/skills/gitnexus/SKILL.md`

#### Run Logging

Create `harness/telemetry/run-log-schema.md`:

- Schema for run logs (JSONL format, one entry per agent invocation)
- Fields: timestamp, mode, agent, model, input_summary, output_summary, duration_ms, grades
- Example entries based on CodeCompanion's review/security/plan outputs
- Location: `harness/runs/` (gitignored except for examples)

**Acceptance criteria:**

- [ ] `harness/plans/archive/` contains at least 5 migrated phase files (not all 28 required for this phase)
- [ ] `harness/plans/INDEX.md` exists and lists migrated plans
- [ ] `harness/_config/project-notes.md` exists with summary from `.planning/PROJECT.md`
- [ ] `harness/docs/gitnexus-integration.md` exists and references `.claude/skills/gitnexus/SKILL.md`
- [ ] `harness/telemetry/run-log-schema.md` exists with JSONL schema
- [ ] `.planning/` directory is unchanged (no files deleted or moved)
- [ ] `git status` shows no modifications to `.planning/` files

**Commit:** `feat(harness): migrate .planning/ content and integrate GitNexus knowledge layer`

---

## Rollback Strategy

> Added in review round 3 — safety net if the harness doesn't add value.

The harness is purely additive — it creates a `harness/` directory and doesn't modify any existing files. To roll back:

```bash
# Remove the harness directory
git rm -r harness/
git commit -m "revert: remove harness directory (rollback)"
```

That's it. No existing files are affected. The `.claude/`, `.planning/`, `src/`, `electron/`, and `server.js` are untouched throughout all 6 phases.

If you want to keep the harness docs but remove the configs:

```bash
git rm harness/configs/*.yaml
git commit -m "revert: remove harness configs (keeping docs)"
```

---

## Commit Strategy

> Added in review round 3 — each phase is one commit for clean history.

| Phase | Commit Message                                                                     |
| ----- | ---------------------------------------------------------------------------------- |
| 1     | `feat(harness): scaffold directory tree`                                           |
| 2     | `docs(harness): write orientation layer (CLAUDE.md, CONTEXT.md, FRAMEWORK.md)`     |
| 3     | `feat(harness): create 5 agent contracts for CodeCompanion modes`                  |
| 4     | `feat(harness): add configs for agents, routing, models, tools, autonomy`          |
| 5     | `feat(harness): add skills, stages, and evaluation rubrics`                        |
| 6     | `feat(harness): migrate .planning/ content and integrate GitNexus knowledge layer` |

Total: 6 commits, ~10.5 hours of work.

---

## Risks & Mitigations

| Risk                                                | Severity | Mitigation                                                                                                                                           |
| --------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Harness docs become stale and unused                | MEDIUM   | MVP path (Phase 1+2 only) gives value without maintenance burden. Skills reference existing `.claude/skills/` so updates propagate.                  |
| Config formats inconsistent (YAML vs JSON)          | LOW      | YAML chosen for harness configs (comments, human-readable). Consistent with VIRA's proven format. `.claude/settings.json` stays JSON — no conflict.  |
| Agent contracts duplicate `.claude/agents/` content | LOW      | Harness contracts are higher-level role definitions. `.claude/agents/` are task-specific execution guides. They reference each other, not duplicate. |
| Migration copies create duplicate content           | LOW      | `.planning/` is source of truth. Harness references it. Copies in `harness/plans/archive/` are for harness-internal navigation only.                 |
| Solo developer maintenance burden                   | MEDIUM   | Minimal viable harness (Phase 1+2) is ~3 hours and self-contained. Phases 3-6 are optional depth.                                                    |

---

## Validation

After all 6 phases:

```bash
# Verify harness structure
ls harness/  # Should show 14+ entries

# Verify configs are valid YAML
python3 -c "import yaml; yaml.safe_load(open('harness/configs/agents.yaml'))"
# (one-time check — Python is NOT added as a dependency)

# Verify no Python files in harness
find harness/ -name "*.py"  # Should return nothing

# Verify .planning/ untouched
git diff .planning/  # Should show no changes

# Verify no existing files modified
git diff --stat  # Should show only harness/ additions
```

---

## Summary

| Item                  | Value                                                      |
| --------------------- | ---------------------------------------------------------- |
| **Total effort**      | ~10.5 hours                                                |
| **MVP path**          | ~3 hours (Phase 1 + 2)                                     |
| **New files**         | ~30 markdown + 6 YAML                                      |
| **Modified files**    | 0 (purely additive)                                        |
| **New dependencies**  | 0                                                          |
| **Commits**           | 6 (one per phase)                                          |
| **Rollback**          | `git rm -r harness/`                                       |
| **Based on**          | VIRA's proven harness (18 skills, 6 MCP servers, 30+ runs) |
| **Review iterations** | 3 (all findings resolved)                                  |
