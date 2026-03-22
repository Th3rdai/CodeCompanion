#!/usr/bin/env node
/**
 * Release job only: CI must run on the same github.com owner/repo as electron-builder
 * `publish`, or installed apps (which resolve updates from that repo) will 404.
 */
const cfg = require('../electron-builder.config.js');

const publish = cfg.publish;
if (!publish || publish.provider !== 'github') {
  console.log('skip: no GitHub publish config');
  process.exit(0);
}

const expected = `${publish.owner}/${publish.repo}`.toLowerCase();
const actual = (process.env.GITHUB_REPOSITORY || '').toLowerCase();

if (!actual) {
  console.log('skip: GITHUB_REPOSITORY unset');
  process.exit(0);
}

if (expected !== actual) {
  console.error(
    `::error::This workflow is running on **github.com/${actual}** but electron-builder.config.js ` +
      `publish targets **github.com/${expected}**. Installed apps fetch \`latest-*.yml\` from the publish repo only.\n` +
      `Fix: push the release tag to **${expected}**, or change publish.owner/repo to match **${actual}**.`
  );
  process.exit(1);
}

console.log(`ok: GITHUB_REPOSITORY matches publish target (${expected})`);
