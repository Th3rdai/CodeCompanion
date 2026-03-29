const test = require('node:test');
const assert = require('node:assert');
const {
  mergeAutoModelMap,
  isCloudModelName,
  DEFAULT_AUTO_MODEL_MAP,
} = require('../../lib/auto-model');

test('mergeAutoModelMap fills defaults and applies overrides', () => {
  const m = mergeAutoModelMap({ chat: 'my-model:latest' });
  assert.equal(m.chat, 'my-model:latest');
  assert.equal(m.review, DEFAULT_AUTO_MODEL_MAP.review);
});

test('isCloudModelName detects cloud-tagged names', () => {
  assert.equal(isCloudModelName('kimi-k2:1t-cloud'), true);
  assert.equal(isCloudModelName('qwen3-32k'), false);
});
