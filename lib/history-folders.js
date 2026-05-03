const fs = require("fs");
const path = require("path");

const SYSTEM_FOLDER_ID = "inbox";
let _foldersFile = null;
let _folders = [];

function nowIso() {
  return new Date().toISOString();
}

function normalizeId(value) {
  if (!value || typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function validateFolderName(name) {
  if (typeof name !== "string") return "Folder name must be a string";
  const trimmed = name.trim();
  if (!trimmed) return "Folder name is required";
  if (trimmed.length > 80) return "Folder name must be 80 characters or less";
  return null;
}

function ensureSystemInbox() {
  const existing = _folders.find((f) => f.id === SYSTEM_FOLDER_ID);
  if (existing) {
    existing.name = "Inbox";
    existing.system = true;
    if (!Number.isFinite(existing.position)) existing.position = 0;
    return;
  }
  _folders.push({
    id: SYSTEM_FOLDER_ID,
    name: "Inbox",
    color: null,
    position: 0,
    collapsed: false,
    system: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

function normalizeFolders(folders) {
  const normalized = Array.isArray(folders) ? folders : [];
  const seen = new Set();
  _folders = [];
  for (const raw of normalized) {
    const id = normalizeId(raw?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    _folders.push({
      id,
      name: typeof raw?.name === "string" && raw.name.trim() ? raw.name.trim() : id,
      color: typeof raw?.color === "string" && raw.color.trim() ? raw.color.trim() : null,
      position: Number.isFinite(raw?.position) ? raw.position : _folders.length + 1,
      collapsed: !!raw?.collapsed,
      system: id === SYSTEM_FOLDER_ID || !!raw?.system,
      createdAt: raw?.createdAt || nowIso(),
      updatedAt: raw?.updatedAt || nowIso(),
    });
  }
  ensureSystemInbox();
  _folders.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

function persist() {
  if (!_foldersFile)
    throw new Error(
      "History folders not initialized. Call initHistoryFolders(dataRoot) first.",
    );
  const payload = JSON.stringify({ folders: _folders }, null, 2);
  const tmp = `${_foldersFile}.tmp`;
  fs.writeFileSync(tmp, payload);
  fs.renameSync(tmp, _foldersFile);
}

function initHistoryFolders(dataRoot) {
  if (!dataRoot || typeof dataRoot !== "string") {
    throw new Error("dataRoot is required");
  }
  _foldersFile = path.join(dataRoot, "history-folders.json");
  if (fs.existsSync(_foldersFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(_foldersFile, "utf8"));
      normalizeFolders(parsed?.folders);
    } catch {
      _folders = [];
      ensureSystemInbox();
      persist();
      return;
    }
  } else {
    _folders = [];
    ensureSystemInbox();
    persist();
    return;
  }
  persist();
}

function listFolders() {
  return [..._folders].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name),
  );
}

function getFolder(id) {
  const normalized = normalizeId(id);
  if (!normalized) return null;
  return _folders.find((f) => f.id === normalized) || null;
}

function createFolder({ id, name, color }) {
  const nameErr = validateFolderName(name);
  if (nameErr) throw new Error(nameErr);
  let folderId = normalizeId(id);
  if (!folderId) folderId = normalizeId(name);
  if (!folderId) throw new Error("Could not derive folder id from name");
  if (folderId.length < 2 || folderId.length > 64) {
    throw new Error("Folder id must be 2-64 chars (a-z, 0-9, hyphen)");
  }
  if (_folders.some((f) => f.id === folderId)) {
    throw new Error("Folder id already exists");
  }
  if (
    _folders.some(
      (f) => f.name.toLowerCase() === String(name).trim().toLowerCase(),
    )
  ) {
    throw new Error("Folder name already exists");
  }
  const highestPos = _folders.reduce(
    (max, f) => Math.max(max, Number.isFinite(f.position) ? f.position : 0),
    0,
  );
  const folder = {
    id: folderId,
    name: String(name).trim(),
    color: typeof color === "string" && color.trim() ? color.trim() : null,
    position: highestPos + 1,
    collapsed: false,
    system: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  _folders.push(folder);
  persist();
  return folder;
}

function updateFolder(id, updates = {}) {
  const folder = getFolder(id);
  if (!folder) throw new Error("Folder not found");
  if (folder.system && updates.name && String(updates.name).trim() !== "Inbox") {
    throw new Error("System folder name cannot be changed");
  }
  if (updates.name !== undefined) {
    const err = validateFolderName(updates.name);
    if (err) throw new Error(err);
    const nextName = String(updates.name).trim();
    if (
      _folders.some(
        (f) => f.id !== folder.id && f.name.toLowerCase() === nextName.toLowerCase(),
      )
    ) {
      throw new Error("Folder name already exists");
    }
    folder.name = nextName;
  }
  if (updates.color !== undefined) {
    folder.color =
      typeof updates.color === "string" && updates.color.trim()
        ? updates.color.trim()
        : null;
  }
  if (updates.position !== undefined) {
    if (!Number.isFinite(updates.position)) {
      throw new Error("Folder position must be a number");
    }
    folder.position = updates.position;
  }
  if (updates.collapsed !== undefined) {
    folder.collapsed = !!updates.collapsed;
  }
  folder.updatedAt = nowIso();
  persist();
  return folder;
}

function deleteFolder(id) {
  const normalized = normalizeId(id);
  if (!normalized) throw new Error("Folder id is required");
  if (normalized === SYSTEM_FOLDER_ID) {
    throw new Error("System folder cannot be deleted");
  }
  const index = _folders.findIndex((f) => f.id === normalized);
  if (index === -1) throw new Error("Folder not found");
  const [deleted] = _folders.splice(index, 1);
  persist();
  return deleted;
}

module.exports = {
  SYSTEM_FOLDER_ID,
  initHistoryFolders,
  listFolders,
  getFolder,
  createFolder,
  updateFolder,
  deleteFolder,
};
