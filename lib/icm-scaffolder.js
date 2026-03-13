const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_STAGES = [
  { name: 'Research', purpose: 'Gather and organize source material' },
  { name: 'Draft', purpose: 'Create first drafts from research findings' },
  { name: 'Review', purpose: 'Quality check and finalize output' }
];

class ScaffolderError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ScaffolderError';
    this.code = code;
    this.status = status;
  }
}

function expandHome(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') return '';
  if (inputPath === '~') return os.homedir();
  if (inputPath.startsWith('~/')) return path.join(os.homedir(), inputPath.slice(2));
  return inputPath;
}

function slugify(value, fallback = 'untitled') {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64);

  return slug || fallback;
}

function isPathInside(parentPath, targetPath) {
  const relative = path.relative(parentPath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function ensureDirectoryExists(dirPath, code, message) {
  if (!fs.existsSync(dirPath)) {
    throw new ScaffolderError(code, message, 400);
  }
  if (!fs.statSync(dirPath).isDirectory()) {
    throw new ScaffolderError(code, `${message} (not a directory)`, 400);
  }
}

function resolveAllowedRoots(config) {
  const configuredRoots = Array.isArray(config?.createModeAllowedRoots) && config.createModeAllowedRoots.length > 0
    ? config.createModeAllowedRoots
    : [path.join(os.homedir(), 'AI_Dev')];

  return configuredRoots
    .map(root => path.resolve(expandHome(root)))
    .filter(Boolean);
}

function validateOutputRoot(outputRoot, allowedRoots) {
  const expandedRoot = expandHome(outputRoot);
  if (!expandedRoot) {
    throw new ScaffolderError('MISSING_OUTPUT_ROOT', 'Output location is required.', 400);
  }

  const resolvedRoot = path.resolve(expandedRoot);
  ensureDirectoryExists(resolvedRoot, 'OUTPUT_ROOT_NOT_FOUND', 'Output location does not exist');

  const matchedRoot = allowedRoots.find(root => isPathInside(root, resolvedRoot));
  if (!matchedRoot) {
    throw new ScaffolderError('PATH_OUTSIDE_ROOT', 'Output location is outside the allowed Create mode roots.', 403);
  }

  return resolvedRoot;
}

function normalizeStages(inputStages) {
  const sourceStages = Array.isArray(inputStages) && inputStages.length > 0 ? inputStages : DEFAULT_STAGES;
  const usedSlugs = new Set();

  return sourceStages.map((stage, index) => {
    const safeName = String(stage?.name || `Stage ${index + 1}`).trim() || `Stage ${index + 1}`;
    const safePurpose = String(stage?.purpose || `Complete the ${safeName.toLowerCase()} stage.`).trim()
      || `Complete the ${safeName.toLowerCase()} stage.`;
    const baseSlug = slugify(safeName, `stage-${index + 1}`);
    let uniqueSlug = baseSlug;
    let suffix = 2;

    while (usedSlugs.has(uniqueSlug)) {
      uniqueSlug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    usedSlugs.add(uniqueSlug);

    return {
      order: index + 1,
      name: safeName,
      purpose: safePurpose,
      slug: `${String(index + 1).padStart(2, '0')}-${uniqueSlug}`
    };
  });
}

function readTemplateFile(templateRoot, relativePath) {
  const filePath = path.join(templateRoot, relativePath);
  ensureDirectoryExists(templateRoot, 'TEMPLATE_NOT_FOUND', 'ICM template folder does not exist');
  if (!fs.existsSync(filePath)) {
    throw new ScaffolderError('TEMPLATE_FILE_NOT_FOUND', `Template file missing: ${relativePath}`, 500);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function replaceTokens(content, replacements) {
  return Object.entries(replacements).reduce((result, [token, value]) => {
    return result.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }, content);
}

function buildFolderMap(stages) {
  return stages.map(stage => `| \`stages/${stage.slug}/\` | ${stage.purpose} |`).join('\n');
}

function buildClaudeContent(templateRoot, options) {
  const template = readTemplateFile(templateRoot, 'CLAUDE.md');
  const folderMap = buildFolderMap(options.stages);

  return replaceTokens(template, {
    '[Your Project Name]': options.name,
    '[describe the AI\'s purpose in 1-2 sentences]': options.role,
    '| `stages/01-research/` | Gather and organize source material |\n| `stages/02-draft/` | Create first drafts from research |\n| `stages/03-review/` | Quality check and finalize output |': folderMap
  });
}

function buildRootContext(stages) {
  const routingRows = stages
    .map(stage => `| ${stage.purpose} | \`stages/${stage.slug}/\` |`)
    .join('\n');

  return `# Workspace Routing

This file tells you where to go based on what the user needs.

## Stage Routing

| If the user wants to... | Go to... |
|------------------------|----------|
${routingRows}

## How Routing Works

1. Read the user's request
2. Match it to the correct stage using the table above
3. Navigate to that stage's folder
4. Read the stage's \`CONTEXT.md\` for detailed instructions

## Shared Resources

If a stage's CONTEXT.md references shared files, find them in:

- \`_config/\` — Brand voice, style guides, design tokens
- \`shared/\` — Templates, examples, and cross-stage resources
- \`skills/\` — Reusable domain knowledge and workflows
`;
}

function buildStageContext(stage, stages) {
  const previousStage = stages[stage.order - 2];
  const nextStage = stages[stage.order];
  const outputFile = `${slugify(stage.name, `stage-${stage.order}`)}-output.md`;
  const checkpointTarget = nextStage ? `before proceeding to ${nextStage.name}` : 'before finalizing the project';

  const inputRows = [
    '| User\'s request | Full | Understand the stage objective |',
    '| `_config/brand-voice.md` | Full | Keep tone and audience aligned |'
  ];

  if (previousStage) {
    inputRows.push(`| \`../${previousStage.slug}/output/\` | Full (if exists) | Use the prior stage output as input |`);
  }

  if (stage.order === 1) {
    inputRows.push('| `references/` | Full (if exists) | Review supporting source material for this stage |');
  }

  return `# Stage ${String(stage.order).padStart(2, '0')}: ${stage.name}

## Purpose
${stage.purpose}

## Inputs
| File | Load | Reason |
|------|------|--------|
${inputRows.join('\n')}

## Process
1. Read the user's request carefully
2. Review the available inputs for this stage
3. Complete the stage goal: ${stage.purpose.toLowerCase()}
4. Save clear, well-structured output into the \`output/\` folder
5. Summarize any assumptions or open questions before moving on

## Outputs
| File | Location | Format |
|------|----------|--------|
| Stage output | \`output/${outputFile}\` | Markdown with clear headings |

## Checkpoint
**Stop here and ask the user to review** the files in \`output/\` ${checkpointTarget}.
`;
}

function writeFile(projectRoot, relativePath, content, files) {
  const filePath = path.join(projectRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  files.push(relativePath);
}

function createProjectStructure(projectRoot, templateRoot, options) {
  const createdFiles = [];

  writeFile(projectRoot, 'CLAUDE.md', buildClaudeContent(templateRoot, options), createdFiles);
  writeFile(projectRoot, 'CONTEXT.md', buildRootContext(options.stages), createdFiles);

  const brandVoice = replaceTokens(readTemplateFile(templateRoot, '_config/brand-voice.md'), {
    '[Describe your target audience. Example: "Small business owners who are new to AI and prefer plain language over technical jargon."]': options.audience,
    '[Describe the tone. Example: "Friendly, encouraging, and practical. Avoid sounding academic or overly formal."]': options.tone
  });
  writeFile(projectRoot, '_config/brand-voice.md', brandVoice, createdFiles);

  writeFile(projectRoot, 'shared/README.md', readTemplateFile(templateRoot, 'shared/README.md'), createdFiles);
  writeFile(projectRoot, 'skills/README.md', readTemplateFile(templateRoot, 'skills/README.md'), createdFiles);

  for (const stage of options.stages) {
    const stageRoot = path.join(projectRoot, 'stages', stage.slug);
    const contextContent = buildStageContext(stage, options.stages);
    writeFile(projectRoot, path.join('stages', stage.slug, 'CONTEXT.md'), contextContent, createdFiles);
    fs.mkdirSync(path.join(stageRoot, 'output'), { recursive: true });
    if (stage.order === 1) {
      fs.mkdirSync(path.join(stageRoot, 'references'), { recursive: true });
    }
  }

  return createdFiles;
}

function scaffoldProject({ config, name, description, role, audience, tone, stages, outputRoot, overwrite = false }) {
  if (!name || !description || !role || !audience || !tone) {
    throw new ScaffolderError('MISSING_FIELDS', 'Name, description, role, audience, and tone are required.', 400);
  }

  const allowedRoots = resolveAllowedRoots(config);
  const resolvedOutputRoot = validateOutputRoot(outputRoot, allowedRoots);
  const templateRoot = path.resolve(expandHome(config?.icmTemplatePath || path.join(os.homedir(), 'AI_Dev', 'ICM_FW', 'ICM-Framework-Template')));
  ensureDirectoryExists(templateRoot, 'TEMPLATE_NOT_FOUND', 'ICM template folder does not exist');

  const projectSlug = slugify(name, 'new-project');
  const normalizedStages = normalizeStages(stages);
  const projectPath = path.join(resolvedOutputRoot, projectSlug);

  if (fs.existsSync(projectPath) && !overwrite) {
    throw new ScaffolderError('PROJECT_EXISTS', 'A project folder with this name already exists.', 409);
  }

  const tempRoot = fs.mkdtempSync(path.join(resolvedOutputRoot, `.${projectSlug}-tmp-`));

  try {
    const files = createProjectStructure(tempRoot, templateRoot, {
      name,
      description,
      role,
      audience,
      tone,
      stages: normalizedStages
    });

    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }

    fs.renameSync(tempRoot, projectPath);

    return {
      success: true,
      projectSlug,
      projectPath,
      projectFolder: projectPath,
      stages: normalizedStages,
      files,
      warnings: []
    };
  } catch (error) {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {}

    if (error instanceof ScaffolderError) {
      throw error;
    }

    throw new ScaffolderError('CREATE_FAILED', error.message || 'Project scaffolding failed.', 500);
  }
}

module.exports = {
  DEFAULT_STAGES,
  ScaffolderError,
  normalizeStages,
  scaffoldProject,
  slugify
};
