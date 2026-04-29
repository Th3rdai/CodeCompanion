const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { getConfig } = require("../lib/config");
const {
  buildFileTree,
  readProjectFile,
  saveProjectFile,
} = require("../lib/file-browser");
const {
  assertResolvedPathUnderAllowedRoots,
  resolveFolderInput,
} = require("../lib/security-helpers");
const { CLIENT_INTERNAL_ERROR } = require("../lib/client-errors");

// Directories to skip when searching for folders by name
const FOLDER_SEARCH_SKIP = new Set([
  ".Trash",
  ".Trashes",
  "Library",
  "node_modules",
  ".git",
  ".cache",
  ".npm",
  ".nvm",
]);

// Search common directories for a folder by name (1-2 levels deep)
function findFolderByName(name) {
  const searchRoots = [
    os.homedir(),
    path.join(os.homedir(), "AI_Dev"),
    path.join(os.homedir(), "Projects"),
    path.join(os.homedir(), "Developer"),
    path.join(os.homedir(), "Documents"),
    path.join(os.homedir(), "Desktop"),
    path.join(os.homedir(), "Docker"),
    path.join(__dirname, ".."),
  ];
  for (const root of searchRoots) {
    const candidate = path.join(root, name);
    try {
      if (FOLDER_SEARCH_SKIP.has(path.basename(root))) continue;
      if (candidate.split(path.sep).some((seg) => FOLDER_SEARCH_SKIP.has(seg)))
        continue;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory())
        return candidate;
    } catch {}
  }
  for (const root of searchRoots) {
    try {
      if (!fs.existsSync(root)) continue;
      const children = fs.readdirSync(root, { withFileTypes: true });
      for (const child of children) {
        if (!child.isDirectory()) continue;
        if (FOLDER_SEARCH_SKIP.has(child.name)) continue;
        const candidate = path.join(root, child.name, name);
        try {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory())
            return candidate;
        } catch {}
      }
    } catch {}
  }
  return null;
}

function resolveFolder(folder) {
  if (folder.startsWith("~")) folder = path.join(os.homedir(), folder.slice(1));
  folder = path.resolve(folder);
  if (fs.existsSync(folder)) return folder;
  return findFolderByName(path.basename(folder));
}

module.exports = function createRouter(appContext) {
  const router = express.Router();
  const { log, debug } = appContext;

  // ── GET /api/files/tree ───────────────────────────────
  router.get("/files/tree", (req, res) => {
    const config = getConfig();
    let folder = req.query.folder || config.chatFolder || config.projectFolder;
    if (!folder)
      return res.status(400).json({ error: "No project folder configured" });
    folder = resolveFolder(folder);
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    const allowedCheck = assertResolvedPathUnderAllowedRoots(folder, config);
    if (!allowedCheck.ok) {
      log("WARN", "files/tree blocked — folder outside allowed roots", {
        folder,
      });
      return res.status(403).json({ error: allowedCheck.error });
    }

    const depth = Number.parseInt(req.query.depth, 10);
    const maxDepth = Number.isNaN(depth) ? 3 : Math.min(Math.max(depth, 1), 6);

    try {
      debug("Building file tree", { folder, maxDepth });
      const result = buildFileTree(folder, maxDepth);
      res.json(result);
    } catch (err) {
      log("ERROR", "Failed to build file tree", { error: err.message });
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── GET /api/files/read ───────────────────────────────
  router.get("/files/read", (req, res) => {
    const config = getConfig();
    const filePath = req.query.path;
    let folder = req.query.folder
      ? path.resolve(req.query.folder)
      : config.chatFolder || config.projectFolder;

    if (!filePath || !folder)
      return res.status(400).json({ error: "Missing path or project folder" });

    if (req.query.folder) {
      const allowedRoots = [
        config.projectFolder,
        path.join(__dirname, ".."),
      ].filter(Boolean);
      const absFolder = path.resolve(folder);
      const allowed = allowedRoots.some(
        (root) =>
          absFolder === path.resolve(root) ||
          absFolder.startsWith(path.resolve(root) + path.sep),
      );
      if (!allowed) return res.status(403).json({ error: "Access denied" });
    }

    try {
      const result = readProjectFile(folder, filePath);
      debug("File read", { path: filePath, size: result.size });
      res.json(result);
    } catch (err) {
      if (err.message.includes("Path traversal")) {
        log("ERROR", "Path traversal attempt blocked", { filePath, folder });
        return res.status(403).json({ error: "Access denied" });
      }
      const status =
        err.message === "File not found"
          ? 404
          : err.message === "Not a file"
            ? 400
            : 500;
      log("ERROR", "Failed to read file", {
        path: filePath,
        error: err.message,
        status,
      });
      res.status(status).json({
        error:
          status === 500
            ? CLIENT_INTERNAL_ERROR
            : status === 404
              ? "Not found"
              : err.message,
      });
    }
  });

  // ── GET /api/files/read-raw ───────────────────────────
  router.get("/files/read-raw", (req, res) => {
    const config = getConfig();
    const folder = config.projectFolder;
    const relativePath = req.query.path;

    if (!folder || !relativePath) {
      return res.status(400).json({ error: "Missing folder or path" });
    }

    const absPath = path.resolve(folder, relativePath);
    if (!absPath.startsWith(path.resolve(folder))) {
      return res.status(403).json({ error: "Path traversal blocked" });
    }

    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const stat = fs.statSync(absPath);
    const maxBytes = (config.docling?.maxFileSizeMB || 50) * 1024 * 1024;
    if (stat.size > maxBytes) {
      return res.status(413).json({
        error: `File too large: ${(stat.size / 1024 / 1024).toFixed(1)}MB`,
      });
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(absPath)}"`,
    );
    fs.createReadStream(absPath).pipe(res);
  });

  // ── POST /api/files/save ──────────────────────────────
  router.post("/files/save", appContext.requireLocalOrApiKey, (req, res) => {
    const { filePath, folder, content } = req.body;

    if (!filePath || !folder || content === undefined) {
      return res
        .status(400)
        .json({ error: "Missing filePath, folder, or content" });
    }

    const config = getConfig();
    const resolvedFolder = resolveFolderInput(folder);
    if (!resolvedFolder) {
      return res.status(400).json({ error: "Invalid folder path" });
    }
    const allowed = assertResolvedPathUnderAllowedRoots(resolvedFolder, config);
    if (!allowed.ok) {
      log("WARN", "files/save blocked — folder outside allowed roots", {
        folder,
      });
      return res.status(403).json({ error: allowed.error });
    }

    try {
      const result = saveProjectFile(resolvedFolder, filePath, content);
      log("INFO", "File saved", {
        path: filePath,
        size: result.size,
        backedUp: result.backedUp,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.message.includes("Path traversal")) {
        log("ERROR", "Path traversal attempt blocked on save", {
          filePath,
          folder,
        });
        return res.status(403).json({ error: "Access denied" });
      }
      log("ERROR", "Failed to save file", {
        path: filePath,
        error: err.message,
      });
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── POST /api/files/upload ────────────────────────────
  router.post("/files/upload", (req, res) => {
    const { name, content } = req.body;
    if (!name || content === undefined)
      return res.status(400).json({ error: "Missing name or content" });
    debug("File uploaded via chat", { name, size: content.length });
    res.json({ name, size: content.length, content });
  });

  return router;
};
