#!/usr/bin/env node
/**
 * After CI downloads per-platform release/ artifacts, verify every file referenced in
 * latest*.yml (url / path) exists next to that YAML so electron-updater does not 404.
 */
const fs = require('fs');
const path = require('path');

const artifactsRoot = process.argv[2] || 'artifacts';

const REQUIRED = {
  'installer-mac': ['latest-mac.yml'],
  'installer-win': ['latest.yml'],
};

/** Linux arch varies; require at least one feed electron-builder emits for this arch. */
const LINUX_FEED_ONE_OF = ['latest-linux.yml', 'latest-linux-arm64.yml'];

function collectRefs(ymlContent) {
  const refs = [];
  for (const line of ymlContent.split('\n')) {
    let m = line.match(/^\s*url:\s*(.+)\s*$/);
    if (m) {
      refs.push(m[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    m = line.match(/^path:\s*(.+)\s*$/);
    if (m) refs.push(m[1].trim().replace(/^["']|["']$/g, ''));
  }
  return refs;
}

function verifyDir(subdir) {
  const dir = path.join(artifactsRoot, subdir);
  if (!fs.existsSync(dir)) {
    console.error(`missing directory: ${dir}`);
    process.exit(1);
  }
  const required = REQUIRED[subdir];
  if (required) {
    for (const name of required) {
      const p = path.join(dir, name);
      if (!fs.existsSync(p)) {
        console.error(`::error::missing required updater file ${p}`);
        process.exit(1);
      }
    }
  }
  if (subdir === 'installer-linux') {
    const hasFeed = LINUX_FEED_ONE_OF.some((n) => fs.existsSync(path.join(dir, n)));
    if (!hasFeed) {
      console.error(
        `::error::installer-linux must include at least one of: ${LINUX_FEED_ONE_OF.join(', ')}`
      );
      process.exit(1);
    }
  }

  const names = fs.readdirSync(dir);
  const ymls = names.filter((n) => n.startsWith('latest') && n.endsWith('.yml'));
  for (const yml of ymls) {
    const ymlPath = path.join(dir, yml);
    const content = fs.readFileSync(ymlPath, 'utf8');
    for (const ref of collectRefs(content)) {
      if (!ref || ref.startsWith('http://') || ref.startsWith('https://')) continue;
      const fp = path.join(dir, ref);
      if (!fs.existsSync(fp)) {
        console.error(
          `::error::${subdir}/${yml} references missing file: ${ref} (expected at ${fp})`
        );
        process.exit(1);
      }
    }
  }
}

for (const sub of ['installer-mac', 'installer-win', 'installer-linux']) {
  verifyDir(sub);
}
console.log('ok: updater YAML references match files on disk');
