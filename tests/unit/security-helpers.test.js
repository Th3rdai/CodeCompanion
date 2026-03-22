const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const {
  assertResolvedPathUnderAllowedRoots,
  resolveFolderInput,
  isAllowedGitHubRemoteUrl,
  assertLocalPathForGitPush,
} = require('../../lib/security-helpers');

test('resolveFolderInput expands tilde', () => {
  const r = resolveFolderInput('~');
  assert.equal(r, path.resolve(os.homedir()));
});

test('assertResolvedPathUnderAllowedRoots allows paths under default home root', () => {
  const config = {};
  const home = os.homedir();
  const sub = path.join(home, 'code-companion-test-sub');
  const r = assertResolvedPathUnderAllowedRoots(sub, config);
  assert.equal(r.ok, true);
});

test('assertResolvedPathUnderAllowedRoots rejects /etc on default config', () => {
  const config = {};
  const r = assertResolvedPathUnderAllowedRoots('/etc', config);
  assert.equal(r.ok, false);
});

test('isAllowedGitHubRemoteUrl accepts https and git@', () => {
  assert.equal(isAllowedGitHubRemoteUrl('https://github.com/o/r.git'), true);
  assert.equal(isAllowedGitHubRemoteUrl('git@github.com:o/r.git'), true);
  assert.equal(isAllowedGitHubRemoteUrl('https://evil.com/x'), false);
});

test('assertLocalPathForGitPush matches allowed roots', () => {
  const config = {};
  const home = os.homedir();
  const r = assertLocalPathForGitPush(home, config);
  assert.equal(r.ok, true);
});
