const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const { mergeDevToolPathIntoEnv } = require('../../lib/spawn-path');

test('mergeDevToolPathIntoEnv appends standard dev dirs', () => {
  const merged = mergeDevToolPathIntoEnv({
    PATH: '/usr/bin:/bin',
  });
  assert.ok(merged.PATH.includes('/usr/bin'));
  if (process.platform === 'darwin') {
    assert.ok(merged.PATH.includes('/opt/homebrew/bin'));
  }
  assert.ok(merged.PATH.includes(path.join(os.homedir(), '.local', 'bin')));
});

test('mergeDevToolPathIntoEnv does not drop existing entries', () => {
  const merged = mergeDevToolPathIntoEnv({
    PATH: '/custom/bin',
  });
  assert.ok(merged.PATH.startsWith('/custom/bin'));
});
