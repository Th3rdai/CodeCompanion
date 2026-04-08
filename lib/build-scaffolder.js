/**
 * Build scaffolder — GSD + ICM combined project.
 * Scaffolds a project with .planning/ (GSD) and stages/ (ICM) for building apps/tools with get-shit-done and ICM Framework.
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

${description || "A project combining GSD (get-shit-done) planning and ICM stage-based workflow for building software."}

## Core Value

Deliver working software through research → plan → execute (GSD) and stage-by-stage work (ICM).

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

- GSD: Use .planning/ for roadmap, phases, and execution (see skills/gsd-workflows.md).
- ICM: Use stages/ for Research → Draft → Review workflows.
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

Build this project using GSD phases (research → plan → execute) and ICM stages (Research, Draft, Review). Start with /gsd:new-project or work through stages/01-research first.

## Phases

- [ ] **Phase 1: Discovery** — Research scope, requirements, constraints
- [ ] **Phase 2: Plan** — Roadmap and phase plans (use /gsd:plan-phase)
- [ ] **Phase 3: Execute** — Implement (use /gsd:execute-phase)
- [ ] **Phase 4: Review** — Quality and ship

## Phase Details

### Phase 1: Discovery
**Goal**: Understand what to build and for whom.
**Depends on**: Nothing
**Success Criteria**:
  1. PROJECT.md has clear What This Is and Core Value
  2. Key requirements and out-of-scope items listed
  3. Context and constraints documented

### Phase 2: Plan
**Goal**: Break work into phases and plans.
**Depends on**: Phase 1
**Success Criteria**:
  1. ROADMAP.md has phases and success criteria
  2. First phase has at least one plan

### Phase 3: Execute
**Goal**: Implement plans and produce deliverables.
**Depends on**: Phase 2
**Success Criteria**:
  1. Plans executed via /gsd:execute-phase or equivalent
  2. Outputs in stages/*/output/ or as specified in plans

### Phase 4: Review
**Goal**: Quality check and ship.
**Depends on**: Phase 3
**Success Criteria**:
  1. Deliverables reviewed
  2. Ready for handoff or next iteration
`;
}

function buildStateMd(_name) {
  const now = new Date().toISOString().slice(0, 10);
  return `# Project State

## Project Reference

See: .planning/PROJECT.md (updated ${now})

**Core value:** Deliver working software through GSD + ICM.
**Current focus:** Phase 1 — Discovery

## Current Position

Phase: 1 of 4 (Discovery)
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
- [ ] REQ-03: First deliverable produced via stages or GSD execute

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
  return `# ${name} — GSD + ICM Build

## Identity

You are an AI assistant for this project. Help the user build software using both GSD (get-shit-done) and ICM (Interpretable Context Methodology) workflows.

## Folder Map

| Folder | Purpose |
|--------|---------|
| .planning/ | GSD: PROJECT.md, ROADMAP.md, STATE.md, phases |
| stages/ | ICM: Research → Draft → Review |
| _config/ | Brand voice, style rules |
| shared/ | Cross-stage resources |
| skills/ | GSD workflow refs and reusable patterns |

## Workflows

- **GSD**: Use .planning/ for research → plan → execute. See skills/gsd-workflows.md.
- **ICM**: Use stages/01-research, 02-draft, 03-review with CONTEXT.md per stage.
- Read CONTEXT.md first to choose the right entry point.

## Rules

- Complete one stage or phase before jumping to the next
- Save deliverables to stage output/ or as specified in plans
- Ask for review at checkpoints
`;
}

function buildRootContextMd() {
  return `# Routing — GSD + ICM

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
| GSD workflows & skills | skills/ |

Read the CONTEXT.md in the stage or .planning/ before proceeding.
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

${description || "Project scaffold combining GSD and ICM — built with Th3rdAI Code Companion Build mode."}

## Quick start

1. **GSD (planning)**: Open \`.planning/PROJECT.md\` and \`.planning/ROADMAP.md\`. Use \`/gsd:plan-phase\` and \`/gsd:execute-phase\` in Claude Code.
2. **ICM (stages)**: Open \`CONTEXT.md\` to route to Research, Draft, or Review. Work in \`stages/01-research\`, \`02-draft\`, \`03-review\`.
3. **Shared**: \`_config/\` for brand voice, \`shared/\` for references, \`skills/\` for GSD workflow docs.

## Structure

- \`.planning/\` — GSD project context, roadmap, state
- \`stages/01-research\`, \`02-draft\`, \`03-review\` — ICM stage workflows
- \`skills/gsd-workflows.md\` — How to run GSD commands
`;
}

const GSD_WORKFLOWS_MD = `# GSD Workflows

This project is set up for **get-shit-done (GSD)**. Run these in Claude Code or Cursor from the **project root**.

## Commands

| Command | Purpose |
|---------|---------|
| \`/gsd:new-project\` | (Already done — project scaffolded by Build mode) |
| \`/gsd:map-codebase\` | Map existing code (if you add code first) |
| \`/gsd:plan-phase\` | Create a plan for the current phase |
| \`/gsd:execute-phase\` | Execute the next plan in the phase |
| \`/gsd:progress\` | Show current state and progress |

## Prerequisites

- GSD installed (e.g. \`~/.claude/get-shit-done/\`)
- Claude Code or Cursor with GSD workflows available

## Flow

1. **Research**: Use \`stages/01-research\` or GSD research subagents.
2. **Plan**: Update \`.planning/ROADMAP.md\`, then \`/gsd:plan-phase 1\`.
3. **Execute**: \`/gsd:execute-phase\` to run plans.
4. **Review**: Use \`stages/03-review\` for quality check.

State is tracked in \`.planning/STATE.md\`.
`;

/**
 * Scaffold a combined GSD + ICM project.
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
    // GSD .planning/
    writeRel(".planning/PROJECT.md", buildProjectMd(name, description));
    writeRel(".planning/ROADMAP.md", buildRoadmapMd(name));
    writeRel(".planning/STATE.md", buildStateMd(name));
    writeRel(".planning/REQUIREMENTS.md", buildRequirementsMd());
    writeRel(".planning/config.json", buildPlanningConfigJson());
    writeRel(".planning/phases/.gitkeep", "");

    // ICM stages/
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
    writeRel(
      "shared/README.md",
      "# Shared resources\n\nCross-stage assets go here.\n",
    );
    writeRel(
      "skills/README.md",
      "# Skills\n\nReusable workflow definitions. See gsd-workflows.md for GSD commands.\n",
    );
    writeRel("skills/gsd-workflows.md", GSD_WORKFLOWS_MD);

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
        for (const target of ideTargets) {
          const dest = path.join(tempDir, target);
          fs.mkdirSync(dest, { recursive: true });
          const entries = fs.readdirSync(commandsSrc, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isFile()) {
              const src = path.join(commandsSrc, entry.name);
              fs.copyFileSync(src, path.join(dest, entry.name));
              files.push(path.join(target, entry.name));
            }
          }
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
