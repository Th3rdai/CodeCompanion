'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getConfig } = require('./config');

// ── Slug generation ───────────────────────────────────
// Rule: lowercase, spaces/specials → hyphens, strip path-unsafe chars,
// collapse consecutive hyphens, trim, max 64 chars.
// Must be identical to the frontend slug function in CreateWizard.jsx.
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[\\/:*?"<>|]/g, '')   // strip path-unsafe chars
    .replace(/[\s_]+/g, '-')        // spaces/underscores → hyphens
    .replace(/[^a-z0-9-]/g, '')     // strip anything else non-alphanumeric
    .replace(/-+/g, '-')            // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '')        // trim leading/trailing hyphens
    .slice(0, 64);
}

// ── Embedded fallback templates ───────────────────────
// Used when icmTemplatePath does not exist on disk.

function embeddedCLAUDE(name, role, stages) {
  const folderMap = stages
    .map(s => `| stages/${s.slug}/ | ${s.name} stage work |`)
    .join('\n');
  return `# ${name}

## Identity
${role}

## Folder Map

| Folder | Purpose |
|--------|---------|
${folderMap}
| _config/ | Brand voice and style rules |
| shared/ | Cross-stage reference material |
| skills/ | Reusable workflow definitions |

## Rules
- Read CONTEXT.md first to find the right stage
- Complete one stage before moving to the next
- Save all work to the stage's output/ folder
- Ask for review at each checkpoint
`;
}

function embeddedROOT_CONTEXT(name, stages) {
  const routes = stages
    .map(s => `- **${s.name}** → \`stages/${s.slug}/\``)
    .join('\n');
  return `# ${name} — Project Context

## Current Status
Project initialised. Start with Stage 01.

## Stage Routing
${routes}

## How to Use
Read the CONTEXT.md in the current stage folder for detailed instructions.
`;
}

function embeddedStageContext(stage) {
  return `# ${stage.name}

## Inputs
${stage.trigger || 'Source material and instructions from previous stage'}

## Process
${stage.purpose}

## Outputs
Save all results to the output/ folder

## Checkpoint
Pause here for human review before proceeding to the next stage
`;
}

function embeddedBrandVoice(audience, tone) {
  return `# Brand Voice & Style

## Target Audience
${audience}

## Tone
${tone}

## Style Rules
- Write clearly and concisely
- Avoid jargon unless the audience is technical
- Use active voice
- Match the tone defined above consistently
`;
}

const EMBEDDED_SHARED_README = `# Shared Resources

Place cross-stage reference material here — documents, data, or context
that multiple stages need access to.
`;

const EMBEDDED_SKILLS_README = `# Skills

Place reusable workflow definitions here — prompts, templates, or
step-by-step processes that can be reused across stages or projects.
`;

// ── Path safety ───────────────────────────────────────

function resolveAndValidate(outputRoot, projectSlug) {
  const resolved = outputRoot.replace(/^~/, os.homedir());
  const projectPath = path.resolve(resolved, projectSlug);

  // Build safe zone from config (default ~/AI_Dev)
  const config = getConfig();
  const allowedRoots = (config.createModeAllowedRoots || [])
    .map(r => path.resolve(r.replace(/^~/, os.homedir())));
  if (allowedRoots.length === 0) {
    allowedRoots.push(path.resolve(os.homedir(), 'AI_Dev'));
  }

  const inSafeZone = allowedRoots.some(
    root => projectPath === root || projectPath.startsWith(root + path.sep)
  );
  if (!inSafeZone) {
    const err = new Error(`Output path must be within an allowed root: ${allowedRoots.join(', ')}`);
    err.code = 'PATH_OUTSIDE_ROOT';
    throw err;
  }

  return projectPath;
}

// ── Template file reader ──────────────────────────────
// Tries to read a file from the disk template; falls back to the embedded fn.

function readTemplate(templateDir, relPath) {
  if (templateDir) {
    const full = path.join(templateDir, relPath);
    try {
      if (fs.existsSync(full)) return fs.readFileSync(full, 'utf8');
    } catch { /* fall through */ }
  }
  return null;
}

function applyTokens(content, { name, role, audience, tone }) {
  return content
    .replace(/\[Your Project Name\]/g, name)
    .replace(/\[describe the AI's purpose in 1-2 sentences\]/g, role)
    .replace(/\[Describe your target audience\..*?\]/g, audience)
    .replace(/\[Describe the tone\..*?\]/g, tone);
}

// ── Main scaffolder ───────────────────────────────────

/**
 * scaffoldProject(options)
 *
 * @param {object} options
 * @param {string}   options.name         Project display name
 * @param {string}   options.description  What the project is about
 * @param {string}   options.role         AI's role (CLAUDE.md identity)
 * @param {string}   options.audience     Target audience (brand-voice.md)
 * @param {string}   options.tone         Tone preset or custom description
 * @param {Array}    options.stages       [{name, purpose, trigger?}]
 * @param {string}   options.outputRoot   Parent folder path (tilde OK)
 * @param {boolean}  [options.overwrite]  Default false
 *
 * @returns {{ success, projectPath, files, errors }}
 */
function scaffoldProject(options) {
  const { name, description, role, audience, tone, outputRoot, overwrite = false } = options;

  // Normalise stages with order, slug, and defaults
  const stages = (options.stages || [
    { name: 'Research', purpose: 'Gather and organise source material' },
    { name: 'Draft',    purpose: 'Create a first draft from research findings' },
    { name: 'Review',   purpose: 'Quality check, edit, and produce the final version' },
  ]).map((s, i) => ({
    order: i + 1,
    name: s.name,
    slug: `${String(i + 1).padStart(2, '0')}-${slugify(s.name)}`,
    purpose: s.purpose || '',
    trigger: s.trigger || '',
  }));

  const projectSlug = slugify(name);
  if (!projectSlug) {
    return { success: false, projectPath: null, files: [], errors: ['Project name produces an empty slug — choose a different name'] };
  }

  let projectPath;
  try {
    projectPath = resolveAndValidate(outputRoot, projectSlug);
  } catch (err) {
    return { success: false, projectPath: null, files: [], errors: [err.message], code: err.code };
  }

  // Collision check
  if (fs.existsSync(projectPath)) {
    if (!overwrite) {
      return { success: false, projectPath, files: [], errors: [`Project already exists at ${projectPath}`], code: 'PROJECT_EXISTS' };
    }
  }

  // Resolve template dir (may not exist — that's OK)
  const config = getConfig();
  const templateDir = config.icmTemplatePath && fs.existsSync(config.icmTemplatePath)
    ? config.icmTemplatePath
    : null;

  // Atomic write: build everything in a tmp dir, then rename
  const tmpPath = projectPath + '.tmp_' + Date.now();
  const createdFiles = [];

  try {
    fs.mkdirSync(tmpPath, { recursive: true });

    // ── CLAUDE.md ────────────────────────────────────
    let claudeContent = readTemplate(templateDir, 'CLAUDE.md');
    if (claudeContent) {
      claudeContent = applyTokens(claudeContent, { name, role, audience, tone });
    } else {
      claudeContent = embeddedCLAUDE(name, role, stages);
    }
    writeFile(tmpPath, 'CLAUDE.md', claudeContent, createdFiles);

    // ── Root CONTEXT.md ───────────────────────────────
    let rootContext = readTemplate(templateDir, 'CONTEXT.md');
    if (rootContext) {
      rootContext = applyTokens(rootContext, { name, role, audience, tone });
    } else {
      rootContext = embeddedROOT_CONTEXT(name, stages);
    }
    writeFile(tmpPath, 'CONTEXT.md', rootContext, createdFiles);

    // ── Stages ────────────────────────────────────────
    for (const stage of stages) {
      const stageDir = path.join(tmpPath, 'stages', stage.slug);
      fs.mkdirSync(path.join(stageDir, 'output'), { recursive: true });
      createdFiles.push(`stages/${stage.slug}/output/`);

      // Research stage gets a references/ dir
      if (stage.order === 1) {
        fs.mkdirSync(path.join(stageDir, 'references'), { recursive: true });
        createdFiles.push(`stages/${stage.slug}/references/`);
      }

      // Stage CONTEXT.md — try disk template first but always use embedded
      // for custom stages (disk only has 01/02/03)
      const diskStagePath = `stages/0${stage.order}-${slugify(stage.name)}/CONTEXT.md`;
      let stageCtx = readTemplate(templateDir, diskStagePath);
      if (!stageCtx) stageCtx = embeddedStageContext(stage);
      writeFile(stageDir, 'CONTEXT.md', stageCtx, createdFiles, `stages/${stage.slug}/`);
    }

    // ── _config/brand-voice.md ────────────────────────
    let brandVoice = readTemplate(templateDir, '_config/brand-voice.md');
    if (brandVoice) {
      brandVoice = applyTokens(brandVoice, { name, role, audience, tone });
    } else {
      brandVoice = embeddedBrandVoice(audience, tone);
    }
    const configDir = path.join(tmpPath, '_config');
    fs.mkdirSync(configDir, { recursive: true });
    writeFile(configDir, 'brand-voice.md', brandVoice, createdFiles, '_config/');

    // ── shared/README.md ──────────────────────────────
    const sharedDir = path.join(tmpPath, 'shared');
    fs.mkdirSync(sharedDir, { recursive: true });
    const sharedContent = readTemplate(templateDir, 'shared/README.md') || EMBEDDED_SHARED_README;
    writeFile(sharedDir, 'README.md', sharedContent, createdFiles, 'shared/');

    // ── skills/README.md ──────────────────────────────
    const skillsDir = path.join(tmpPath, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    const skillsContent = readTemplate(templateDir, 'skills/README.md') || EMBEDDED_SKILLS_README;
    writeFile(skillsDir, 'README.md', skillsContent, createdFiles, 'skills/');

    // ── Atomic rename ─────────────────────────────────
    if (overwrite && fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
    fs.renameSync(tmpPath, projectPath);

    return { success: true, projectPath, files: createdFiles, errors: [] };

  } catch (err) {
    // Cleanup temp dir on any failure
    try { fs.rmSync(tmpPath, { recursive: true, force: true }); } catch { /* best effort */ }
    const code = err.code || 'WRITE_FAILED';
    return { success: false, projectPath, files: createdFiles, errors: [err.message], code };
  }
}

// Helper — write a file and record it in the manifest
function writeFile(dir, filename, content, manifest, prefix = '') {
  fs.writeFileSync(path.join(dir, filename), content, 'utf8');
  manifest.push(prefix + filename);
}

module.exports = { scaffoldProject, slugify };
