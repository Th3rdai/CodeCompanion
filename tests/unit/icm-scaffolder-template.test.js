/**
 * Unit tests for ICM scaffolder template copy (Commands + ICM-fw from icmTemplatePath).
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { scaffoldProject } = require('../../lib/icm-scaffolder');

describe('scaffoldProject with icmTemplatePath', () => {
  let templateRoot;
  let outputRoot;
  const projectName = 'template-copy-test';

  before(() => {
    templateRoot = path.join(os.tmpdir(), `icm-template-${Date.now()}`);
    outputRoot = path.join(os.tmpdir(), `icm-output-${Date.now()}`);
    fs.mkdirSync(templateRoot, { recursive: true });
    fs.mkdirSync(outputRoot, { recursive: true });
    // Commands/
    const commandsDir = path.join(templateRoot, 'Commands');
    fs.mkdirSync(commandsDir, { recursive: true });
    fs.writeFileSync(path.join(commandsDir, 'hello.md'), '# Hello Command\n', 'utf8');
    fs.writeFileSync(path.join(commandsDir, 'foo.txt'), 'foo', 'utf8');
    // ICM-fw/
    const icmFwDir = path.join(templateRoot, 'ICM-fw');
    fs.mkdirSync(icmFwDir, { recursive: true });
    fs.writeFileSync(path.join(icmFwDir, 'ICM-README.md'), '# ICM Framework\n', 'utf8');
    const sub = path.join(icmFwDir, 'sub');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(sub, 'nested.txt'), 'nested', 'utf8');
  });

  after(() => {
    const projectPath = path.join(outputRoot, 'template-copy-test');
    if (fs.existsSync(projectPath)) fs.rmSync(projectPath, { recursive: true, force: true });
    if (fs.existsSync(templateRoot)) fs.rmSync(templateRoot, { recursive: true, force: true });
    if (fs.existsSync(outputRoot)) fs.rmSync(outputRoot, { recursive: true, force: true });
  });

  it('copies Commands to .cursor/commands and ICM-fw to project root when icmTemplatePath is set', () => {
    const config = {
      icmTemplatePath: templateRoot,
      createModeAllowedRoots: [outputRoot],
    };
    const result = scaffoldProject(
      {
        name: projectName,
        description: 'Test',
        role: 'Test role',
        audience: 'Test',
        tone: 'Friendly',
        stages: [],
        outputRoot,
        overwrite: false,
      },
      config
    );

    assert.strictEqual(result.success, true, result.errors?.join('; '));
    assert.ok(result.projectPath, 'projectPath should be set');
    assert.ok(fs.existsSync(result.projectPath), 'Project directory should exist');

    // Commands copied to .cursor/commands
    const commandsDest = path.join(result.projectPath, '.cursor', 'commands');
    assert.ok(fs.existsSync(commandsDest), '.cursor/commands should exist');
    assert.ok(fs.existsSync(path.join(commandsDest, 'hello.md')), '.cursor/commands/hello.md should exist');
    assert.strictEqual(fs.readFileSync(path.join(commandsDest, 'hello.md'), 'utf8'), '# Hello Command\n');
    assert.ok(fs.existsSync(path.join(commandsDest, 'foo.txt')), '.cursor/commands/foo.txt should exist');

    // ICM-fw contents at project root
    assert.ok(fs.existsSync(path.join(result.projectPath, 'ICM-README.md')), 'ICM-README.md should exist at root');
    assert.strictEqual(fs.readFileSync(path.join(result.projectPath, 'ICM-README.md'), 'utf8'), '# ICM Framework\n');
    assert.ok(fs.existsSync(path.join(result.projectPath, 'sub', 'nested.txt')), 'sub/nested.txt should exist');
    assert.strictEqual(fs.readFileSync(path.join(result.projectPath, 'sub', 'nested.txt'), 'utf8'), 'nested');

    // Scaffold files still present
    assert.ok(fs.existsSync(path.join(result.projectPath, 'CLAUDE.md')), 'CLAUDE.md should exist');
    assert.ok(fs.existsSync(path.join(result.projectPath, 'CONTEXT.md')), 'CONTEXT.md should exist');
    assert.ok(fs.existsSync(path.join(result.projectPath, 'stages')), 'stages/ should exist');
  });

  it('scaffolds without template copy when icmTemplatePath is empty', () => {
    const config = { icmTemplatePath: '', createModeAllowedRoots: [outputRoot] };
    const result = scaffoldProject(
      { name: 'no-template-test', description: 'x', outputRoot, overwrite: false },
      config
    );
    assert.strictEqual(result.success, true);
    const cursorCommands = path.join(result.projectPath, '.cursor', 'commands');
    assert.ok(!fs.existsSync(cursorCommands), '.cursor/commands should not exist when no template');
    assert.ok(!fs.existsSync(path.join(result.projectPath, 'ICM-README.md')), 'ICM-README.md should not exist');
    fs.rmSync(result.projectPath, { recursive: true, force: true });
  });
});
