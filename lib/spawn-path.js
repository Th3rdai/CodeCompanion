/**
 * Merge common developer tool directories into PATH for child_process.spawn.
 * Electron / macOS .app bundles often inherit a minimal PATH, so bare commands
 * like `npx` and `uvx` fail with ENOENT even when installed via Homebrew or uv.
 */
const path = require('path');
const os = require('os');

/**
 * @param {NodeJS.ProcessEnv} [baseEnv]
 * @returns {NodeJS.ProcessEnv}
 */
function mergeDevToolPathIntoEnv(baseEnv = process.env) {
  const out = { ...baseEnv };
  const sep = process.platform === 'win32' ? ';' : ':';

  const current =
    process.platform === 'win32'
      ? String(out.Path || out.PATH || '')
      : String(out.PATH || '');
  const parts = current.split(sep).filter(Boolean);
  const home = os.homedir();

  const extra = [];
  if (process.platform === 'darwin') {
    extra.push(
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      '/usr/local/sbin'
    );
  } else if (process.platform !== 'win32') {
    extra.push('/usr/local/bin', '/usr/local/sbin');
  }

  extra.push(path.join(home, '.local', 'bin'), path.join(home, '.cargo', 'bin'));

  if (process.platform === 'win32') {
    const localAppData = out.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    extra.push(path.join(localAppData, 'Programs', 'Python'), path.join(home, 'AppData', 'Roaming', 'npm'));
  } else {
    extra.push(path.join(home, '.nvm', 'current', 'bin'));
  }

  const seen = new Set(parts.map((p) => path.normalize(p)));
  for (const p of extra) {
    const n = path.normalize(p);
    if (!seen.has(n)) {
      seen.add(n);
      parts.push(p);
    }
  }

  const merged = parts.join(sep);
  out.PATH = merged;
  if (process.platform === 'win32') {
    out.Path = merged;
  }

  return out;
}

module.exports = { mergeDevToolPathIntoEnv };
