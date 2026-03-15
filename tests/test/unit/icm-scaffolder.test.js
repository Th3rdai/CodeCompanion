const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  normalizeStages,
  scaffoldProject,
  slugify
} = require('../../../lib/icm-scaffolder');

function writeTemplateFixture(templateRoot) {
  fs.mkdirSync(path.join(templateRoot, '_config'), { recursive: true });
  fs.mkdirSync(path.join(templateRoot, 'shared'), { recursive: true });
  fs.mkdirSync(path.join(templateRoot, 'skills'), { recursive: true });

  fs.writeFileSync(path.join(templateRoot, 'CLAUDE.md'), [
    '# [Your Project Name]',
    '',
    '[describe the AI\'s purpose in 1-2 sentences]',
    '',
    '| `stages/01-research/` | Gather and organize source material |',
    '| `stages/02-draft/` | Create first drafts from research |',
    '| `stages/03-review/` | Quality check and finalize output |'
  ].join('\n'));

  fs.writeFileSync(path.join(templateRoot, '_config/brand-voice.md'), [
    '[Describe your target audience. Example: "Small business owners who are new to AI and prefer plain language over technical jargon."]',
    '',
    '[Describe the tone. Example: "Friendly, encouraging, and practical. Avoid sounding academic or overly formal."]'
  ].join('\n'));

  fs.writeFileSync(path.join(templateRoot, 'shared/README.md'), 'Shared resources');
  fs.writeFileSync(path.join(templateRoot, 'skills/README.md'), 'Skills resources');
}

test('slugify normalizes unsafe project names', () => {
  assert.equal(slugify(' Create: Mode / Plan? v2!  '), 'create-mode-plan-v2!');
  assert.equal(slugify(''), 'project');
});

test('normalizeStages creates deterministic unique stage slugs', () => {
  const stages = normalizeStages([
    { name: 'Review', purpose: 'First review pass' },
    { name: 'Review', purpose: 'Second review pass' }
  ]);

  assert.equal(stages[0].slug, 'review');
  assert.equal(stages[1].slug, 'review-2');
});

test('scaffoldProject creates expected project structure', () => {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffolder-unit-'));
  const allowedRoot = path.join(sandboxRoot, 'allowed-root');
  const templateRoot = path.join(sandboxRoot, 'template');
  fs.mkdirSync(allowedRoot, { recursive: true });
  writeTemplateFixture(templateRoot);

  try {
    const result = scaffoldProject(
      {
        name: 'Unit Test Workspace',
        description: 'Workspace scaffold test',
        role: 'Test assistant',
        audience: 'Product managers',
        tone: 'Professional',
        stages: [
          { name: 'Research', purpose: 'Collect references' },
          { name: 'Draft', purpose: 'Create draft outputs' },
          { name: 'Review', purpose: 'Finalize with quality review' }
        ],
        outputRoot: allowedRoot
      },
      { createModeAllowedRoots: [allowedRoot] }
    );

    assert.equal(result.success, true);
    assert.ok(fs.existsSync(path.join(result.projectPath, 'CLAUDE.md')));
    assert.ok(fs.existsSync(path.join(result.projectPath, 'CONTEXT.md')));
    assert.ok(fs.existsSync(path.join(result.projectPath, '_config', 'brand-voice.md')));
    assert.ok(fs.existsSync(path.join(result.projectPath, 'stages', '01-research', 'output')));
    assert.ok(fs.existsSync(path.join(result.projectPath, 'stages', '01-research', 'references')));
    assert.ok(fs.existsSync(path.join(result.projectPath, 'stages', '02-draft', 'output')));
  } finally {
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
  }
});

test('scaffoldProject blocks output roots outside allowlist', () => {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffolder-unit-'));
  const allowedRoot = path.join(sandboxRoot, 'allowed-root');
  const outsideRoot = path.join(sandboxRoot, 'outside-root');
  fs.mkdirSync(allowedRoot, { recursive: true });
  fs.mkdirSync(outsideRoot, { recursive: true });

  try {
    const result = scaffoldProject(
      {
        name: 'Outside Root Workspace',
        description: 'Should fail',
        role: 'Test assistant',
        audience: 'PM',
        tone: 'Professional',
        outputRoot: outsideRoot
      },
      { createModeAllowedRoots: [allowedRoot] }
    );
    assert.equal(result.success, false);
    assert.equal(result.code, 'PATH_OUTSIDE_ROOT');
  } finally {
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
  }
});
