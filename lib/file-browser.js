const fs = require('fs');
const path = require('path');

const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp', '.cs',
  '.html', '.htm', '.css', '.scss', '.less', '.sass',
  '.json', '.yaml', '.yml', '.toml', '.xml', '.csv',
  '.md', '.mdx', '.txt', '.rst', '.log',
  '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1',
  '.sql', '.graphql', '.gql',
  '.env', '.gitignore', '.dockerignore', '.editorconfig',
  '.svelte', '.vue', '.astro',
  'Dockerfile', 'Makefile', 'Rakefile', 'Gemfile',
  '.tf', '.hcl', '.nginx', '.conf', '.ini', '.cfg',
]);

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', 'dist', 'build',
  '__pycache__', '.venv', 'venv', '.idea', '.vscode',
  'coverage', '.cache', '.turbo', '.svelte-kit',
]);

function isTextFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  // Files without extension that are commonly text
  if (!ext && TEXT_EXTENSIONS.has(filename)) return true;
  return false;
}

function buildFileTree(folder, maxDepth) {
  function walkDir(dirPath, depth) {
    if (depth > maxDepth) return [];
    let entries;
    try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); }
    catch { return []; }

    const result = [];
    entries.sort((a, b) => {
      // Directories first, then alphabetical
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env') continue;
      if (IGNORE_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(folder, fullPath);

      if (entry.isDirectory()) {
        const children = walkDir(fullPath, depth + 1);
        result.push({ name: entry.name, path: relativePath, type: 'dir', children });
      } else if (isTextFile(entry.name)) {
        try {
          const stat = fs.statSync(fullPath);
          result.push({
            name: entry.name,
            path: relativePath,
            type: 'file',
            size: stat.size,
            ext: path.extname(entry.name).slice(1) || entry.name,
          });
        } catch {}
      }
    }
    return result;
  }

  const tree = walkDir(folder, 1);
  return { root: folder, tree };
}

function readProjectFile(folder, relativePath) {
  // Security: resolve to absolute and verify it's inside the project folder
  const absPath = path.resolve(folder, relativePath);
  if (!absPath.startsWith(path.resolve(folder))) {
    throw new Error('Path traversal attempt blocked');
  }

  if (!fs.existsSync(absPath)) {
    throw new Error('File not found');
  }

  const stat = fs.statSync(absPath);
  const MAX_SIZE = 500 * 1024; // 500KB limit

  const content = fs.readFileSync(absPath, 'utf8');
  const truncated = stat.size > MAX_SIZE;

  return {
    path: relativePath,
    name: path.basename(absPath),
    size: stat.size,
    content: truncated ? content.slice(0, MAX_SIZE) + '\n\n... (file truncated — too large to display in full)' : content,
    lines: content.split('\n').length,
    truncated
  };
}

/**
 * Check if fullPath is within basePath (prevents path traversal).
 */
function isWithinBasePath(basePath, fullPath) {
  const absBase = path.resolve(basePath);
  const absFull = path.resolve(fullPath);
  return absFull === absBase || absFull.startsWith(absBase + path.sep);
}

module.exports = {
  TEXT_EXTENSIONS,
  IGNORE_DIRS,
  isTextFile,
  isWithinBasePath,
  buildFileTree,
  readProjectFile
};
