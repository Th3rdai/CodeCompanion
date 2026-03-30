const fs = require("fs");
const path = require("path");

const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".less",
  ".sass",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".csv",
  ".md",
  ".mdx",
  ".txt",
  ".rst",
  ".log",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".bat",
  ".cmd",
  ".ps1",
  ".sql",
  ".graphql",
  ".gql",
  ".env",
  ".gitignore",
  ".dockerignore",
  ".editorconfig",
  ".svelte",
  ".vue",
  ".astro",
  "Dockerfile",
  "Makefile",
  "Rakefile",
  "Gemfile",
  ".tf",
  ".hcl",
  ".nginx",
  ".conf",
  ".ini",
  ".cfg",
]);

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  "dist",
  "build",
  "__pycache__",
  ".venv",
  "venv",
  ".idea",
  ".vscode",
  "coverage",
  ".cache",
  ".turbo",
  ".svelte-kit",
]);

const DOCUMENT_EXTENSIONS = new Set([
  ".pdf",
  ".pptx",
  ".docx",
  ".xlsx",
  ".xls",
  ".csv",
  ".doc",
  ".ppt",
  ".odt",
  ".ods",
  ".odp",
  ".rtf",
  ".latex",
  ".tex",
  ".epub",
]);

function isTextFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  // Files without extension that are commonly text
  if (!ext && TEXT_EXTENSIONS.has(filename)) return true;
  return false;
}

function isConvertibleDocument(filename) {
  const ext = path.extname(filename).toLowerCase();
  return DOCUMENT_EXTENSIONS.has(ext);
}

function buildFileTree(folder, maxDepth) {
  function walkDir(dirPath, depth) {
    if (depth > maxDepth) return [];
    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const result = [];
    entries.sort((a, b) => {
      // Directories first, then alphabetical
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".env") continue;
      if (IGNORE_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(folder, fullPath);

      if (entry.isDirectory()) {
        if (depth >= maxDepth) {
          // Mark as truncated so the client can lazy-load on expand
          result.push({
            name: entry.name,
            path: relativePath,
            type: "dir",
            children: [],
            truncated: true,
          });
        } else {
          const children = walkDir(fullPath, depth + 1);
          result.push({
            name: entry.name,
            path: relativePath,
            type: "dir",
            children,
          });
        }
      } else if (isTextFile(entry.name) || isConvertibleDocument(entry.name)) {
        try {
          const stat = fs.statSync(fullPath);
          result.push({
            name: entry.name,
            path: relativePath,
            type: "file",
            size: stat.size,
            ext: path.extname(entry.name).slice(1) || entry.name,
            convertible: isConvertibleDocument(entry.name) || undefined,
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
    throw new Error("Path traversal attempt blocked");
  }

  if (!fs.existsSync(absPath)) {
    throw new Error("File not found");
  }

  const stat = fs.statSync(absPath);
  const MAX_SIZE = 500 * 1024; // 500KB limit

  const content = fs.readFileSync(absPath, "utf8");
  const truncated = stat.size > MAX_SIZE;

  return {
    path: relativePath,
    name: path.basename(absPath),
    size: stat.size,
    content: truncated
      ? content.slice(0, MAX_SIZE) +
        "\n\n... (file truncated — too large to display in full)"
      : content,
    lines: content.split("\n").length,
    truncated,
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

/**
 * Save content to a project file, creating a .bak backup first.
 */
function saveProjectFile(folder, relativePath, content) {
  if (!folder || !relativePath) throw new Error("Missing folder or path");

  const absPath = path.resolve(folder, relativePath);
  if (!isWithinBasePath(folder, absPath)) {
    throw new Error("Path traversal blocked");
  }

  // Create backup if file exists
  let backedUp = false;
  if (fs.existsSync(absPath)) {
    const backupPath = absPath + ".bak";
    fs.copyFileSync(absPath, backupPath);
    backedUp = true;
  }

  fs.writeFileSync(absPath, content, "utf8");

  return {
    path: relativePath,
    name: path.basename(absPath),
    size: content.length,
    backedUp,
    backupPath: backedUp ? relativePath + ".bak" : null,
  };
}

/**
 * Recursively read all text files in a folder.
 * Returns { files: [{ path, content, size }], totalSize, skipped }
 */
function readFolderFiles(folder, opts = {}) {
  const maxFiles = opts.maxFiles || 100;
  const maxTotalSize = opts.maxTotalSize || 2 * 1024 * 1024; // 2MB default
  const maxFileSize = opts.maxFileSize || 200 * 1024; // 200KB per file
  const maxDepth = opts.maxDepth || 10;

  const absFolder = path.resolve(folder);
  if (!fs.existsSync(absFolder) || !fs.statSync(absFolder).isDirectory()) {
    throw new Error("Folder not found");
  }

  const files = [];
  let totalSize = 0;
  let skipped = 0;

  function walk(dirPath, depth) {
    if (depth > maxDepth || files.length >= maxFiles) return;
    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      if (entry.name.startsWith(".") && entry.name !== ".env") continue;
      if (IGNORE_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (isTextFile(entry.name)) {
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > maxFileSize) {
            skipped++;
            continue;
          }
          if (totalSize + stat.size > maxTotalSize) {
            skipped++;
            continue;
          }

          const content = fs.readFileSync(fullPath, "utf8");
          const relativePath = path.relative(absFolder, fullPath);
          files.push({ path: relativePath, content, size: stat.size });
          totalSize += stat.size;
        } catch {
          skipped++;
        }
      }
    }
  }

  walk(absFolder, 1);
  return { files, totalSize, skipped, root: absFolder };
}

module.exports = {
  TEXT_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  IGNORE_DIRS,
  isTextFile,
  isConvertibleDocument,
  isWithinBasePath,
  buildFileTree,
  readProjectFile,
  saveProjectFile,
  readFolderFiles,
};
