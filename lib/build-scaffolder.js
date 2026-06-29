/**
 * Build scaffolder — th3rdai-harness project.
 * Scaffolds a project with .planning/ (roadmap, state, phases) and working
 * folders for building apps/tools with the th3rdai-harness framework
 * (7-stage lifecycle + 5 agent roles). https://github.com/3rdAI-admin/th3rdai-harness
 */
const fs = require("fs");
const path = require("path");
const {
  slugify,
  resolveOutputRoot,
  getWritableRoots,
  isUnderRoot,
  normalizeStages,
} = require("./icm-scaffolder");
const { addProject } = require("./build-registry");
const { getAppRoot, getConfig } = require("./config");
const { buildBrandScaffoldFile } = require("./brand-context");

const DEFAULT_STAGES = [
  {
    order: 1,
    name: "Research",
    slug: "research",
    purpose: "Gather and organize source material",
  },
  {
    order: 2,
    name: "Draft",
    slug: "draft",
    purpose: "Create first draft from research findings",
  },
  {
    order: 3,
    name: "Review",
    slug: "review",
    purpose: "Quality check, edit, and produce final version",
  },
];

function buildProjectMd(name, description) {
  const now = new Date().toISOString().slice(0, 10);
  return `# ${name}

## What This Is

${description || "A project built with the th3rdai-harness framework — a unified, model-agnostic agent development harness (7-stage lifecycle + 5 agent roles)."}

## Core Value

Deliver working software through the th3rdai-harness lifecycle: Task Definition → Agent Design → Prompt Design → Tool Integration → Evaluation → Iteration → Release.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Define and validate first milestone
- [ ] Complete research phase for initial scope
- [ ] Ship first deliverable

### Out of Scope

- (Add boundaries as you go)

## Context

- Harness: Use .planning/ for roadmap, phases, and state (see skills/harness-workflows.md).
- Working folders: Use research/, draft/, review/ under stages/ for in-progress work.
- Shared: _config/, shared/, skills/.

## Constraints

- (Add as needed)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| (Add as you go) | | |

---
*Last updated: ${now} — scaffold*
`;
}

function buildRoadmapMd(name) {
  return `# Roadmap: ${name}

## Overview

Build this project using the th3rdai-harness 7-stage lifecycle. Each phase maps to a harness stage and is driven by one or more of the 5 agent roles (Researcher, Planner, Builder, Reviewer, Evaluator). Start with Phase 1, or run \`/harness:research 1\` in Claude Code / Cursor.

## Phases

- [ ] **Phase 1: Task Definition** — Define the task, gather context, set scope (Researcher, Planner)
- [ ] **Phase 2: Agent Design** — Choose agents and the handoff sequence (Planner, Reviewer)
- [ ] **Phase 3: Prompt Design** — Design and version the agent prompts (Planner, Reviewer)
- [ ] **Phase 4: Tool Integration** — Wire up MCP + builtin tools, validate policies (Builder, Reviewer)
- [ ] **Phase 5: Evaluation** — Score prompts, tools, and workflow against rubrics (Evaluator, Reviewer)
- [ ] **Phase 6: Iteration** — Loop back based on evaluation feedback (Planner, Builder, Evaluator)
- [ ] **Phase 7: Release** — Finalize, commit, update docs, prepare to ship (Reviewer)

## Phase Details

### Phase 1: Task Definition
**Goal**: Establish what to build, for whom, and the success criteria.
**Depends on**: Nothing
**Success Criteria**:
  1. PROJECT.md has clear What This Is and Core Value
  2. Key requirements and out-of-scope items listed
  3. Context and constraints documented

### Phase 2: Agent Design
**Goal**: Decide which agents do the work and how they hand off.
**Depends on**: Phase 1
**Success Criteria**:
  1. Agent roles selected for the task
  2. Handoff sequence / workflow sketched

### Phase 3: Prompt Design
**Goal**: Design and version the prompts each agent will use.
**Depends on**: Phase 2
**Success Criteria**:
  1. Prompts drafted for each agent role
  2. Prompts versioned and recorded

### Phase 4: Tool Integration
**Goal**: Integrate the tools agents need and validate safety policies.
**Depends on**: Phase 3
**Success Criteria**:
  1. Required MCP + builtin tools identified and wired
  2. Tool policies validated

### Phase 5: Evaluation
**Goal**: Score the prompts, tools, and workflow against rubrics.
**Depends on**: Phase 4
**Success Criteria**:
  1. Evaluation run with pass/fail summary
  2. Improvement recommendations captured

### Phase 6: Iteration
**Goal**: Apply evaluation feedback and re-run as needed.
**Depends on**: Phase 5
**Success Criteria**:
  1. Revisions applied to prompts/tools
  2. Updated evaluation shows improvement

### Phase 7: Release
**Goal**: Finalize, commit, and prepare for deployment.
**Depends on**: Phase 6
**Success Criteria**:
  1. Deliverables reviewed
  2. Final commit + release notes ready for handoff
`;
}

function buildStateMd(_name) {
  const now = new Date().toISOString().slice(0, 10);
  return `# Project State

## Project Reference

See: .planning/PROJECT.md (updated ${now})

**Core value:** Deliver working software through the th3rdai-harness lifecycle.
**Current focus:** Phase 1 — Task Definition

## Current Position

Phase: 1 of 7 (Task Definition)
Status: Ready to plan
Last activity: ${now} — Project scaffolded by Code Companion Build mode

Progress: [░░░░░░░░░░] 0%

## Session Continuity

Last session: (none)
Stopped at: (start here)
Resume file: None
`;
}

function buildRequirementsMd() {
  return `# Requirements

## Validated

(None yet)

## Active

- [ ] REQ-01: Project scope and value defined in PROJECT.md
- [ ] REQ-02: Roadmap phases and success criteria in ROADMAP.md
- [ ] REQ-03: First deliverable produced through the harness lifecycle

## Out of Scope

(Add as needed)
`;
}

function buildPlanningConfigJson() {
  return JSON.stringify(
    {
      mode: "interactive",
      granularity: "standard",
      workflow: {
        research: true,
        plan_check: true,
        verifier: true,
        auto_advance: false,
      },
      planning: { commit_docs: true, search_gitignored: false },
      gates: {
        confirm_project: true,
        confirm_phases: true,
        execute_next_plan: true,
      },
    },
    null,
    2,
  );
}

/**
 * Build the core project instructions content (tool-agnostic).
 * Written to CLAUDE.md, .cursorrules, .windsurfrules, and .opencode/instructions.md.
 */
function buildProjectInstructions(name, _description) {
  return `# ${name} — th3rdai-harness Build

## Identity

You are an AI assistant for this project. Help the user build software using the th3rdai-harness framework: a 7-stage lifecycle (Task Definition → Agent Design → Prompt Design → Tool Integration → Evaluation → Iteration → Release) driven by 5 agent roles (Researcher, Planner, Builder, Reviewer, Evaluator).

## Folder Map

| Folder | Purpose |
|--------|---------|
| .planning/ | PROJECT.md, ROADMAP.md, STATE.md, phases (harness lifecycle) |
| stages/ | Working folders: research → draft → review |
| _config/ | Brand voice, style rules |
| shared/ | Cross-phase resources |
| skills/ | Harness workflow refs and reusable patterns |

## Workflows

- **Lifecycle**: Use .planning/ROADMAP.md to move through the 7 harness phases. See skills/harness-workflows.md.
- **Working folders**: Use stages/01-research, 02-draft, 03-review with CONTEXT.md for in-progress work.
- Read CONTEXT.md first to choose the right entry point.

## Rules

- Complete one phase before jumping to the next
- Save deliverables to a working folder's output/ or as specified in plans
- Ask for review at checkpoints
`;
}

function buildRootContextMd() {
  return `# Routing — th3rdai-harness

## If you want to...

| Goal | Go to |
|------|-------|
| Plan the project (phases, roadmap) | .planning/ — read PROJECT.md, ROADMAP.md |
| Research or gather information | stages/01-research/ |
| Write or create a draft | stages/02-draft/ |
| Review, edit, or finalize | stages/03-review/ |

## Shared Resources

| Resource | Location |
|----------|----------|
| Brand voice & style | _config/brand-voice.md |
| Shared references | shared/ |
| Harness workflows & skills | skills/ |

Read the CONTEXT.md in the working folder or .planning/ before proceeding.
`;
}

function buildStageContextMd(stage) {
  const _id = `${String(stage.order).padStart(2, "0")}-${stage.slug}`;
  return `# Stage: ${stage.name}

## Purpose

${stage.purpose}

## Inputs

- User's request or prior stage output
- _config/brand-voice.md for audience and tone

## Process

1. Read inputs
2. Complete the work for this stage
3. Save deliverables to \`output/\`
4. Pause for human review before next stage

## Outputs

Save to \`output/\` in this folder.

## Checkpoint

Pause and ask the user to review before proceeding to the next stage.
`;
}

function buildBrandVoiceMd(audience, tone) {
  return `# Brand voice

## Target audience

${audience || "General"}

## Tone

${tone || "Professional"}

## Style rules

- Clear and concise
- Appropriate for the audience above
`;
}

function buildReadmeMd(name, description) {
  return `# ${name}

${description || "Project scaffold built with the th3rdai-harness framework — created with Th3rdAI Code Companion Build mode."}

## Quick start

1. **Plan (lifecycle)**: Open \`.planning/PROJECT.md\` and \`.planning/ROADMAP.md\`. Use \`/harness:plan\` and \`/harness:build\` in Claude Code.
2. **Working folders**: Open \`CONTEXT.md\` to route to Research, Draft, or Review. Work in \`stages/01-research\`, \`02-draft\`, \`03-review\`.
3. **Shared**: \`_config/\` for brand voice, \`shared/\` for references, \`skills/\` for harness workflow docs.

## Structure

- \`.planning/\` — project context, roadmap, state (7-stage harness lifecycle)
- \`stages/01-research\`, \`02-draft\`, \`03-review\` — working folders
- \`skills/harness-workflows.md\` — How to run harness commands
`;
}

const HARNESS_WORKFLOWS_MD = `# Harness Workflows

This project is set up for the **th3rdai-harness** framework. Run these in Claude Code or Cursor from the **project root**. The commands are plain-text agent routes — no external CLI to install.

## Commands

| Command | Purpose |
|---------|---------|
| \`/harness:new-project\` | (Already done — project scaffolded by Build mode) |
| \`/harness:research {N}\` | Research a phase (Researcher agent) |
| \`/harness:plan {N}\` | Create a plan for a phase (Planner agent) |
| \`/harness:build {N}\` | Execute the plan for a phase (Builder agent) |
| \`/harness:review {N}\` | Verify a phase's work (Reviewer agent) |

## Flow (7-stage lifecycle)

1. **Research** (Phase 1): \`/harness:research 1\` or work in \`stages/01-research\`.
2. **Plan** (Phases 2–3): Update \`.planning/ROADMAP.md\`, then \`/harness:plan 1\`.
3. **Build** (Phase 4): \`/harness:build 1\` to execute the plan.
4. **Evaluate & Review** (Phases 5–6): \`/harness:review 1\`, then iterate.
5. **Release** (Phase 7): Finalize and ship.

State is tracked in \`.planning/STATE.md\`. The Build dashboard reads \`.planning/\` directly.
`;

/**
 * Scaffold a th3rdai-harness project (.planning/ + working folders).
 * @param {object} options - { name, description, outputRoot, audience, tone, overwrite }
 * @param {object} config - App config (getConfig()) for writable roots
 * @returns { { success: boolean, projectPath?: string, files?: string[], errors?: string[], code?: string } }
 */
function scaffoldBuildProject(options, config = {}) {
  const errors = [];
  const files = [];
  const warnings = [];
  const {
    name,
    description,
    outputRoot: outputRootInput,
    audience,
    tone,
    overwrite = false,
  } = options || {};

  if (!name || !outputRootInput) {
    return {
      success: false,
      errors: ["name and outputRoot are required"],
      code: "MISSING_FIELDS",
    };
  }

  const slug = slugify(name);
  const resolvedRoot = resolveOutputRoot(outputRootInput);
  if (!resolvedRoot) {
    return {
      success: false,
      errors: ["Invalid output root"],
      code: "INVALID_OUTPUT_ROOT",
    };
  }

  const writableRoots = getWritableRoots(config);
  if (!isUnderRoot(resolvedRoot, writableRoots)) {
    return {
      success: false,
      errors: ["Output location is outside allowed directories"],
      code: "PATH_OUTSIDE_ROOT",
    };
  }

  const projectPath = path.join(resolvedRoot, slug);

  if (fs.existsSync(projectPath)) {
    if (!overwrite) {
      return {
        success: false,
        errors: [
          "Project folder already exists. Choose a different name or enable overwrite.",
        ],
        code: "ALREADY_EXISTS",
      };
    }
    try {
      fs.rmSync(projectPath, { recursive: true, force: true });
    } catch (err) {
      return {
        success: false,
        errors: [`Could not remove existing folder: ${err.message}`],
        code: "CLEANUP_FAILED",
      };
    }
  }

  const stages = normalizeStages(DEFAULT_STAGES);
  const tempDir = path.join(
    resolvedRoot,
    `.build-scaffold-${slug}-${Date.now()}`,
  );

  try {
    fs.mkdirSync(tempDir, { recursive: true });
  } catch (err) {
    return {
      success: false,
      errors: [`Could not create temp directory: ${err.message}`],
      code: "TEMP_CREATE_FAILED",
    };
  }

  function writeRel(relPath, content) {
    const full = path.join(tempDir, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, "utf8");
    files.push(relPath);
  }

  try {
    // .planning/ — harness lifecycle (roadmap, state, phases)
    writeRel(".planning/PROJECT.md", buildProjectMd(name, description));
    writeRel(".planning/ROADMAP.md", buildRoadmapMd(name));
    writeRel(".planning/STATE.md", buildStateMd(name));
    writeRel(".planning/REQUIREMENTS.md", buildRequirementsMd());
    writeRel(".planning/config.json", buildPlanningConfigJson());
    writeRel(".planning/phases/.gitkeep", "");

    // stages/ — working folders (research/draft/review)
    for (const stage of stages) {
      const stageId = `${String(stage.order).padStart(2, "0")}-${stage.slug}`;
      writeRel(`stages/${stageId}/CONTEXT.md`, buildStageContextMd(stage));
      writeRel(`stages/${stageId}/output/.gitkeep`, "");
      if (stage.order === 1) {
        writeRel(`stages/${stageId}/references/.gitkeep`, "");
      }
    }

    // Shared
    writeRel("_config/brand-voice.md", buildBrandVoiceMd(audience, tone));
    {
      const cfg = getConfig();
      const brandAssetsMd = buildBrandScaffoldFile(cfg.brandAssets);
      if (brandAssetsMd) writeRel("_config/brand-assets.md", brandAssetsMd);
    }
    writeRel(
      "shared/README.md",
      "# Shared resources\n\nCross-stage assets go here.\n",
    );
    writeRel(
      "skills/README.md",
      "# Skills\n\nReusable workflow definitions. See harness-workflows.md for harness commands.\n",
    );
    writeRel("skills/harness-workflows.md", HARNESS_WORKFLOWS_MD);

    // Root — AI tool convention files (same content, each tool's expected path)
    const instructions = buildProjectInstructions(name, description);
    writeRel("CLAUDE.md", instructions);
    writeRel(".cursorrules", instructions);
    writeRel(".windsurfrules", instructions);
    writeRel(".opencode/instructions.md", instructions);
    writeRel("CONTEXT.md", buildRootContextMd());
    writeRel("README.md", buildReadmeMd(name, description));
    writeRel(
      ".editorconfig",
      "root = true\n\n[*]\ncharset = utf-8\nend_of_line = lf\nindent_style = space\nindent_size = 2\ninsert_final_newline = true\ntrim_trailing_whitespace = true\n",
    );

    // Copy IDE commands: IDE_COMMANDS (primary), template path Commands (fallback)
    try {
      const config = getConfig();
      let commandsSrc = path.join(__dirname, "..", "IDE_COMMANDS");
      if (
        !fs.existsSync(commandsSrc) ||
        !fs.statSync(commandsSrc).isDirectory()
      ) {
        commandsSrc = null;
        const templateRoot = (config.icmTemplatePath || "").trim();
        if (templateRoot) {
          const candidate = path.join(path.resolve(templateRoot), "Commands");
          if (
            fs.existsSync(candidate) &&
            fs.statSync(candidate).isDirectory()
          ) {
            commandsSrc = candidate;
          }
        }
      }
      if (
        commandsSrc &&
        fs.existsSync(commandsSrc) &&
        fs.statSync(commandsSrc).isDirectory()
      ) {
        const ideTargets = [
          path.join(".claude", "commands"),
          path.join(".cursor", "commands"),
          path.join(".cursor", "prompts"),
          path.join(".github", "prompts"),
          path.join(".opencode", "commands"),
        ];
        // Recursively copy command files, preserving subdirectories so
        // namespaced commands (e.g. IDE_COMMANDS/harness/plan.md) land at
        // .claude/commands/harness/plan.md → invokable as `/harness:plan`.
        const copyCommandTree = (srcDir, destDir, relBase) => {
          fs.mkdirSync(destDir, { recursive: true });
          for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
            const src = path.join(srcDir, entry.name);
            const rel = path.join(relBase, entry.name);
            if (entry.isDirectory()) {
              copyCommandTree(src, path.join(destDir, entry.name), rel);
            } else if (entry.isFile()) {
              fs.copyFileSync(src, path.join(destDir, entry.name));
              files.push(rel);
            }
          }
        };
        for (const target of ideTargets) {
          copyCommandTree(commandsSrc, path.join(tempDir, target), target);
        }
      }
    } catch (err) {
      warnings.push(`Template copy failed: ${err.message}`);
    }

    fs.renameSync(tempDir, projectPath);

    // Auto-register in Build project registry
    try {
      addProject(getAppRoot(), { name, projectPath });
    } catch (err) {
      // Registry write failure is non-fatal — project exists on disk
      warnings.push(
        `Project created but registry update failed: ${err.message}`,
      );
    }

    return {
      success: true,
      projectPath,
      projectFolder: projectPath,
      files,
      warnings,
    };
  } catch (err) {
    errors.push(err.message);
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      errors.push(`Cleanup failed: ${e.message}`);
    }
    return { success: false, errors, code: "SCAFFOLD_FAILED" };
  }
}

/**
 * Scaffold just the .planning/ directory into an existing project folder.
 * Used when importing a Create-mode or GitHub-cloned project into Build mode.
 */
function scaffoldPlanning(projectPath, name, description) {
  const planningDir = path.join(projectPath, ".planning");
  if (fs.existsSync(planningDir)) return; // Already has planning

  fs.mkdirSync(planningDir, { recursive: true });
  fs.mkdirSync(path.join(planningDir, "phases"), { recursive: true });

  // Try to read description from existing README if not provided
  if (!description) {
    try {
      const readme = fs.readFileSync(
        path.join(projectPath, "README.md"),
        "utf-8",
      );
      const firstParagraph = readme
        .split("\n")
        .filter((l) => l.trim() && !l.startsWith("#"))
        .slice(0, 3)
        .join(" ");
      if (firstParagraph.length > 10)
        description = firstParagraph.slice(0, 300);
    } catch {}
  }

  fs.writeFileSync(
    path.join(planningDir, "PROJECT.md"),
    buildProjectMd(name, description || ""),
  );
  fs.writeFileSync(path.join(planningDir, "ROADMAP.md"), buildRoadmapMd(name));
  fs.writeFileSync(path.join(planningDir, "STATE.md"), buildStateMd(name));
  fs.writeFileSync(
    path.join(planningDir, "REQUIREMENTS.md"),
    buildRequirementsMd(),
  );
  fs.writeFileSync(
    path.join(planningDir, "config.json"),
    buildPlanningConfigJson(),
  );
}

module.exports = {
  scaffoldBuildProject,
  scaffoldPlanning,
};
