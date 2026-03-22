const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { validateProjectFilePath, executeBuiltinTool } = require('../../lib/builtin-agent-tools.js');

test('validateProjectFilePath accepts relative file under project', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-proj-'));
  const sub = path.join(root, 'sub');
  fs.mkdirSync(sub);
  const f = path.join(sub, 'a.txt');
  fs.writeFileSync(f, 'hi');
  const r = validateProjectFilePath('sub/a.txt', root);
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.resolved, fs.realpathSync(f));
});

test('validateProjectFilePath rejects path outside project', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-proj-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-out-'));
  const f = path.join(outside, 'x.txt');
  fs.writeFileSync(f, 'x');
  const r = validateProjectFilePath(f, root);
  assert.strictEqual(r.valid, false);
});

test('validateProjectFilePath rejects directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-proj-'));
  const sub = path.join(root, 'dironly');
  fs.mkdirSync(sub);
  const r = validateProjectFilePath('dironly', root);
  assert.strictEqual(r.valid, false);
});

test('generate_office_file with sourcePath csv writes xlsx without Docling', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-proj-'));
  fs.writeFileSync(path.join(root, 'sample.csv'), 'Name,Val\na,1\n');
  const outPath = path.join(root, 'out.xlsx');
  const noopLog = () => {};
  const res = await executeBuiltinTool(
    'generate_office_file',
    {
      sourcePath: 'sample.csv',
      filename: 'out.xlsx',
      savePath: outPath,
    },
    { projectFolder: root },
    noopLog,
  );
  assert.strictEqual(res.success, true, res.result?.content?.[0]?.text);
  assert.ok(fs.existsSync(outPath));
  assert.ok(fs.statSync(outPath).size > 100);
});
