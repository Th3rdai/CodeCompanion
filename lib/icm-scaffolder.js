const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  getMakerSkillFiles,
  getMakerClaudeInstructions,
} = require("./maker-skill");

const SLUG_MAX_LENGTH = 64;
const CRE8_PATH = path.join(os.homedir(), "AI_Dev", "CRE8");
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

/**
 * Generate a safe folder slug from project name.
 * Same rules as plan: lowercase, hyphens for spaces, strip invalid path chars, collapse/trim, max length.
 */
function slugify(name) {
  if (!name || typeof name !== "string") return "project";
  let s = name
    .toLowerCase()
    .replace(/[\s/]+/g, "-")
    .replace(/[\\:*?"<>|]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (s.length > SLUG_MAX_LENGTH)
    s = s.slice(0, SLUG_MAX_LENGTH).replace(/-$/, "");
  return s || "project";
}

/**
 * Resolve output root: expand ~ and normalize to absolute path.
 */
function resolveOutputRoot(input) {
  if (!input || typeof input !== "string") return null;
  let s = input.trim();
  if (s.startsWith("~/") || s === "~") {
    s = path.join(os.homedir(), s.slice(1));
  }
  return path.resolve(s);
}

/**
 * Get list of allowed writable roots. From config or default [homedir].
 */
function getWritableRoots(config) {
  const roots = config?.createModeAllowedRoots;
  if (Array.isArray(roots) && roots.length > 0) {
    return roots.map((r) =>
      r.startsWith("~/") || r === "~"
        ? path.join(os.homedir(), r.slice(1))
        : path.resolve(r),
    );
  }
  return [os.homedir()];
}

/**
 * Check that dir is under one of the allowed roots. Uses realpath when paths exist to avoid symlink escapes.
 */
function isUnderRoot(dir, allowedRoots) {
  const absDir = path.resolve(dir);
  return allowedRoots.some((root) => {
    try {
      const absRoot = path.resolve(root);
      if (!(absDir === absRoot || absDir.startsWith(absRoot + path.sep)))
        return false;
      if (fs.existsSync(dir)) {
        const realDir = fs.realpathSync(dir);
        const realRoot = fs.existsSync(root) ? fs.realpathSync(root) : absRoot;
        return realDir === realRoot || realDir.startsWith(realRoot + path.sep);
      }
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Normalize stages: ensure order, name, slug, purpose. Slug safe for folder names.
 */
function normalizeStages(stages) {
  const base =
    !Array.isArray(stages) || stages.length === 0 ? DEFAULT_STAGES : stages;
  const seen = new Set();
  return base.map((s, i) => {
    const order = i + 1;
    const name =
      (s.name || s.label || `Stage ${order}`).trim() || `Stage ${order}`;
    let slug = s.slug || slugify(name) || `stage-${order}`;
    const purpose =
      (s.purpose || s.description || "").trim() || "See CONTEXT.md";

    // Ensure slug uniqueness for folder/routing stability.
    const original = slug;
    let n = 2;
    while (seen.has(slug)) {
      slug = `${original}-${n++}`;
    }
    seen.add(slug);

    return { order, name, slug, purpose };
  });
}

function buildClaudeMd(name, role, stages) {
  const folderMap = [
    "| Folder | Purpose |",
    "|--------|---------|",
    "| stages/ | Stage workflows (Research, Draft, Review) |",
    "| _config/ | Brand voice, style rules |",
    "| shared/ | Cross-stage resources |",
    "| skills/ | Reusable patterns |",
  ].join("\n");
  const stageList = stages
    .map(
      (s) =>
        `- **Stage ${String(s.order).padStart(2, "0")}: ${s.name}** — ${s.purpose}`,
    )
    .join("\n");
  return `# ${name} — AI-Assisted Project

## Identity
You are an AI assistant for this project. ${role || "Help the user complete their workflow."}

## Folder Map
${folderMap}

## Stages
${stageList}

## Rules
- Read CONTEXT.md first to find the right stage
- Complete one stage before moving to the next
- Save all work to the stage's output/ folder
- Ask for review at each checkpoint
`;
}

function buildRootContextMd(stages) {
  const routes = stages
    .map((s) => {
      const id = `${String(s.order).padStart(2, "0")}-${s.slug}`;
      return `| ${id} | ${s.name} | stages/${id}/CONTEXT.md |`;
    })
    .join("\n");
  return `# Project routing

| Stage | Name | Contract |
|-------|------|----------|
${routes}

Read the contract for the stage you are in before proceeding.
`;
}

function buildStageContextMd(stage) {
  const id = `${String(stage.order).padStart(2, "0")}-${stage.slug}`;
  return `# Stage: ${stage.name}

## Purpose
${stage.purpose}

## Inputs
- (Define what this stage expects)

## Process
- (Steps to complete this stage)

## Outputs
- Save deliverables to \`output/\`

## Checkpoint
Pause for human review before proceeding to the next stage.
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

function buildReadmeMd(name, description, stages) {
  const stageList = stages
    .map(
      (s) =>
        `- ${String(s.order).padStart(2, "0")}-${s.slug}: ${s.name} — ${s.purpose}`,
    )
    .join("\n");
  return `# ${name}

${description || "Project scaffold generated by Th3rdAI Code Companion."}

## Quick start
1. Open \`CONTEXT.md\` first to choose the active stage.
2. Work stage-by-stage under \`stages/\`.
3. Save deliverables in each stage's \`output/\` folder.
4. Keep shared references in \`shared/\` and reusable patterns in \`skills/\`.

## Stage map
${stageList}

## Quality checklist
- Keep outputs concise and actionable
- Include acceptance criteria where possible
- Request human review at stage checkpoints
`;
}

/**
 * Copy contents of srcDir into destDir (merge). Creates destDir if needed.
 * Uses fs.cpSync when available (Node 16.7+), else recursive readdir/copy.
 */
function copyDirContents(srcDir, destDir) {
  if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) return;
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const ent of entries) {
    const srcPath = path.join(srcDir, ent.name);
    const destPath = path.join(destDir, ent.name);
    if (ent.isDirectory()) {
      copyDirContents(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Copy from template root: Commands -> IDE command paths, ICM-fw -> project root.
 * Commands copy only when icmTemplatePath/Commands exists (no bundled IDE_COMMANDS fallback).
 * No-op for template parts if config.icmTemplatePath is empty or not a directory.
 */
function copyTemplateIntoProject(tempDir, config, filesList) {
  const templateRoot = (config.icmTemplatePath || "").trim();
  let root = templateRoot ? path.resolve(templateRoot) : null;
  if (root && (!fs.existsSync(root) || !fs.statSync(root).isDirectory()))
    root = null;

  // Commands: only from icmTemplatePath/Commands when a template root is configured.
  // (No IDE_COMMANDS fallback — avoids creating .cursor/commands when icmTemplatePath is empty.)
  let commandsSrc = null;
  if (root) {
    const tplCommands = path.join(root, "Commands");
    if (fs.existsSync(tplCommands) && fs.statSync(tplCommands).isDirectory()) {
      commandsSrc = tplCommands;
    }
  }

  if (commandsSrc) {
    // Copy commands to all IDE paths
    const ideTargets = [
      path.join(".claude", "commands"),
      path.join(".cursor", "commands"),
      path.join(".cursor", "prompts"),
      path.join(".github", "prompts"),
      path.join(".opencode", "commands"),
    ];
    for (const target of ideTargets) {
      const commandsDest = path.join(tempDir, target);
      copyDirContents(commandsSrc, commandsDest);
      try {
        const walk = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            const p = path.join(dir, e.name);
            const r = path.relative(tempDir, p);
            if (e.isDirectory()) walk(p);
            else filesList.push(r);
          }
        };
        walk(commandsDest);
      } catch (_) {}
    }
  }

  if (!root) return;
  const icmFwSrc = path.join(root, "ICM-fw");
  if (fs.existsSync(icmFwSrc) && fs.statSync(icmFwSrc).isDirectory()) {
    copyDirContents(icmFwSrc, tempDir);
    try {
      const walk = (dir, baseDir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) walk(p, baseDir);
          else filesList.push(path.relative(baseDir, p));
        }
      };
      walk(icmFwSrc, icmFwSrc);
    } catch (_) {}
  }
}

/**
 * Build INITIAL.md content pre-populated with wizard data for CRE8 workflow.
 */
function buildInitialMd(options) {
  const { name, description, role, audience, tone, stages } = options;
  const stageList = (stages || [])
    .map(
      (s) =>
        `- **${s.name}**: ${s.purpose || "See CONTEXT.md"}`,
    )
    .join("\n");
  return `## FEATURE: ${name || "New Project"}
${description || "[Describe what you want to build - be specific about functionality and requirements]"}

## ROLE
${role || "[Define the AI assistant role for this project]"}

## AUDIENCE
${audience || "[Who will use the output?]"}

## TONE
${tone || "Professional"}

## STAGES
${stageList || "[Define your workflow stages]"}

## EXAMPLES:
[List any example files in the examples/ folder and explain how they should be used]

## DOCUMENTATION:
[Include links to relevant documentation, APIs, or resources]

## OTHER CONSIDERATIONS:
[Mention any gotchas, specific requirements, or things AI assistants commonly miss]
`;
}

/**
 * Copy CRE8 framework files into the scaffolded project.
 * - Creates PRPs/, examples/, journal/ directories
 * - Copies CRE8 command files to all IDE paths
 * - Copies PRP templates
 * - Writes INITIAL.md populated with wizard data
 * - Writes journal/README.md
 */
function copyCre8IntoProject(tempDir, options, filesList) {
  if (!fs.existsSync(CRE8_PATH) || !fs.statSync(CRE8_PATH).isDirectory())
    return;

  // Create CRE8 directory structure
  const cre8Dirs = [
    "PRPs",
    path.join("PRPs", "prompts"),
    path.join("PRPs", "templates"),
    "examples",
    "journal",
  ];
  for (const dir of cre8Dirs) {
    fs.mkdirSync(path.join(tempDir, dir), { recursive: true });
  }

  // Copy CRE8 command files to all IDE paths
  const cre8Commands = path.join(CRE8_PATH, ".claude", "commands");
  if (
    fs.existsSync(cre8Commands) &&
    fs.statSync(cre8Commands).isDirectory()
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
      copyDirContents(cre8Commands, dest);
      try {
        const walk = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walk(p);
            else filesList.push(path.relative(tempDir, p));
          }
        };
        walk(dest);
      } catch (_) {}
    }
  }

  // Copy PRP templates
  const prpTemplatesSrc = path.join(CRE8_PATH, "PRPs", "templates");
  if (
    fs.existsSync(prpTemplatesSrc) &&
    fs.statSync(prpTemplatesSrc).isDirectory()
  ) {
    const prpTemplatesDest = path.join(tempDir, "PRPs", "templates");
    copyDirContents(prpTemplatesSrc, prpTemplatesDest);
    try {
      for (const f of fs.readdirSync(prpTemplatesDest)) {
        const rel = path.join("PRPs", "templates", f);
        if (!filesList.includes(rel)) filesList.push(rel);
      }
    } catch (_) {}
  }

  // Write INITIAL.md
  const initialPath = path.join(tempDir, "INITIAL.md");
  fs.writeFileSync(initialPath, buildInitialMd(options), "utf8");
  filesList.push("INITIAL.md");

  // Write journal/README.md
  const journalReadme = path.join(tempDir, "journal", "README.md");
  fs.writeFileSync(
    journalReadme,
    "# Validation journal index\n\nProgress tracking for `/validate-project`, `/execute-prp`, and `/build-prp`.\nResume after restart or unexpected IDE shutdown by reading the latest entry.\n",
    "utf8",
  );
  filesList.push("journal/README.md");
}

/**
 * Scaffold an ICM project. Writes to a temp directory first, then renames to final path on success.
 * If config.icmTemplatePath is set, copies Commands -> .cursor/commands and ICM-fw -> project root.
 * CRE8 framework files are always integrated when ~/AI_Dev/CRE8 exists.
 * @param {object} options - { name, description, role, audience, tone, stages, outputRoot, overwrite }
 * @param {object} config - App config (getConfig()) for template path and writable roots
 * @returns { { success: boolean, projectPath?: string, files?: string[], errors?: string[], code?: string } }
 */
function scaffoldProject(options, config = {}) {
  const errors = [];
  const files = [];
  const {
    name,
    description,
    role,
    audience,
    tone,
    stages: rawStages,
    outputRoot: outputRootInput,
    overwrite = false,
    makerEnabled = false,
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

  const stages = normalizeStages(rawStages);
  const tempDir = path.join(
    resolvedRoot,
    `.icm-scaffold-${slug}-${Date.now()}`,
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
    let claudeMd = buildClaudeMd(name, role, stages);
    if (makerEnabled) {
      claudeMd += getMakerClaudeInstructions();
    }
    writeRel("CLAUDE.md", claudeMd);
    writeRel("CONTEXT.md", buildRootContextMd(stages));
    writeRel("README.md", buildReadmeMd(name, description, stages));
    writeRel("_config/brand-voice.md", buildBrandVoiceMd(audience, tone));
    writeRel(
      "shared/README.md",
      "# Shared resources\n\nCross-stage assets go here.\n",
    );
    writeRel(
      "skills/README.md",
      "# Skills\n\nReusable workflow definitions.\n",
    );

    if (makerEnabled) {
      for (const file of getMakerSkillFiles()) {
        writeRel(file.relPath, file.content);
      }
    }
    writeRel(
      ".editorconfig",
      "root = true\n\n[*]\ncharset = utf-8\nend_of_line = lf\nindent_style = space\nindent_size = 2\ninsert_final_newline = true\ntrim_trailing_whitespace = true\n",
    );

    for (const stage of stages) {
      const stageId = `${String(stage.order).padStart(2, "0")}-${stage.slug}`;
      writeRel(`stages/${stageId}/CONTEXT.md`, buildStageContextMd(stage));
      writeRel(`stages/${stageId}/output/.gitkeep`, "");
      if (stage.order === 1) {
        writeRel(`stages/${stageId}/references/.gitkeep`, "");
      }
    }

    copyTemplateIntoProject(tempDir, config, files);
    copyCre8IntoProject(tempDir, options, files);

    fs.renameSync(tempDir, projectPath);
    return {
      success: true,
      projectPath,
      projectFolder: projectPath,
      files,
      warnings: [],
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

module.exports = {
  slugify,
  resolveOutputRoot,
  getWritableRoots,
  isUnderRoot,
  normalizeStages,
  scaffoldProject,
};
