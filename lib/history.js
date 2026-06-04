const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { SYSTEM_FOLDER_ID } = require("./history-folders");
const { getConfig } = require("./config");
const {
  deleteForConversation: deleteToolResultsForConversation,
} = require("./tool-result-artifacts");

let _historyDir = null;

// File locking to prevent concurrent write races
const _fileLocks = new Map();

async function _acquireFileLock(conversationId, maxRetries = 10) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (!_fileLocks.has(conversationId)) {
      _fileLocks.set(conversationId, Date.now());
      return true;
    }
    // Wait with exponential backoff: 10ms, 20ms, 40ms, etc.
    await new Promise((resolve) => setTimeout(resolve, 10 * Math.pow(2, attempt)));
  }
  throw new Error(`Could not acquire file lock for conversation ${conversationId} after ${maxRetries} attempts`);
}

function _releaseFileLock(conversationId) {
  _fileLocks.delete(conversationId);
}

function normalizeCreatedAt(value, fallback = null) {
  const parsed = value ? new Date(value) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed.toISOString();
  if (fallback) {
    const fallbackDate = new Date(fallback);
    if (!Number.isNaN(fallbackDate.getTime()))
      return fallbackDate.toISOString();
  }
  return null;
}

function initHistory(appRoot) {
  _historyDir = path.join(appRoot, "history");
  if (!fs.existsSync(_historyDir)) {
    fs.mkdirSync(_historyDir, { recursive: true });
  }
}

/** Find history file for an id: `${id}.json` first, else scan for JSON where data.id matches (legacy mismatch). */
function resolveConversationFilePath(id) {
  if (!id || typeof id !== "string" || /[\/\\]|\.\./.test(id)) return null;
  if (!_historyDir) return null;
  const direct = path.join(_historyDir, `${id}.json`);
  if (fs.existsSync(direct)) return direct;
  let files;
  try {
    files = fs.readdirSync(_historyDir).filter((f) => f.endsWith(".json"));
  } catch {
    return null;
  }
  for (const f of files) {
    const fp = path.join(_historyDir, f);
    try {
      const data = JSON.parse(fs.readFileSync(fp, "utf8"));
      if (data && data.id === id) return fp;
    } catch {
      /* skip corrupt */
    }
  }
  return null;
}

function listConversations() {
  if (!_historyDir)
    throw new Error(
      "History not initialized. Call initHistory(appRoot) first.",
    );

  try {
    const files = fs
      .readdirSync(_historyDir)
      .filter((f) => f.endsWith(".json"));
    const conversations = files
      .map((f) => {
        const filePath = path.join(_historyDir, f);
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const stat = fs.statSync(filePath);
        const normalizedCreatedAt =
          normalizeCreatedAt(data.createdAt, stat.mtime) ||
          new Date().toISOString();

        // Auto-repair malformed history rows so the sidebar no longer shows "Invalid Date".
        if (data.createdAt !== normalizedCreatedAt) {
          data.createdAt = normalizedCreatedAt;
          const tmp = `${filePath}.tmp`;
          fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
          fs.renameSync(tmp, filePath);
        }

        return {
          id: data.id || path.basename(f, ".json"),
          title: data.title,
          mode: data.mode,
          model: data.model,
          createdAt: normalizedCreatedAt,
          // Surface message count for the dashboard (file is already parsed here,
          // so this is free) without shipping the full messages array to the list.
          messageCount: Array.isArray(data.messages) ? data.messages.length : 0,
          archived: data.archived || false,
          folderId:
            typeof data.folderId === "string" && data.folderId.trim()
              ? data.folderId.trim()
              : SYSTEM_FOLDER_ID,
          summary: data.summary || undefined,
          overallGrade:
            data.mode === "review" && data.reviewData?.reportData?.overallGrade
              ? data.reviewData.reportData.overallGrade
              : data.builderData?.scoreData?.overallGrade
                ? data.builderData.scoreData.overallGrade
                : undefined,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return conversations;
  } catch (err) {
    return [];
  }
}

function getConversation(id) {
  // Validate conversation ID — prevent path traversal
  if (!id || typeof id !== "string" || /[\/\\]|\.\./.test(id)) {
    throw new Error("Invalid conversation id");
  }
  if (!_historyDir)
    throw new Error(
      "History not initialized. Call initHistory(appRoot) first.",
    );

  const filePath = resolveConversationFilePath(id);
  if (!filePath) {
    throw new Error("Conversation not found");
  }

  // Phase 2: Image Support — Load conversation (images field is optional for backwards compat)
  // Message schema: { role, content, images?: string[] }
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  data.folderId =
    typeof data.folderId === "string" && data.folderId.trim()
      ? data.folderId.trim()
      : SYSTEM_FOLDER_ID;
  return data;
}

async function saveConversation(data) {
  if (!_historyDir)
    throw new Error(
      "History not initialized. Call initHistory(appRoot) first.",
    );

  if (!data.id) {
    data.id = randomUUID();
  }
  data.folderId =
    typeof data.folderId === "string" && data.folderId.trim()
      ? data.folderId.trim()
      : SYSTEM_FOLDER_ID;

  // Validate conversation ID — prevent path traversal
  if (!data.id || typeof data.id !== "string" || /[\/\\]|\.\./.test(data.id)) {
    throw new Error("Invalid conversation id");
  }

  if (Array.isArray(data.experimentIds)) {
    data.experimentIds = data.experimentIds
      .filter((id) => typeof id === "string" && /^[A-Za-z0-9-]{8,}$/.test(id))
      .slice(0, 32);
    if (data.experimentIds.length === 0) delete data.experimentIds;
  } else {
    delete data.experimentIds;
  }

  // Phase 2: Image Support — Warn if conversation with images is large
  data.createdAt =
    normalizeCreatedAt(data.createdAt, new Date()) || new Date().toISOString();
  const jsonString = JSON.stringify(data, null, 2);
  const sizeInBytes = Buffer.byteLength(jsonString, "utf8");
  const sizeInMB = sizeInBytes / (1024 * 1024);

  if (sizeInMB > 5) {
    console.warn(
      `[History] Conversation ${data.id} is large (${sizeInMB.toFixed(1)}MB). Consider archiving older conversations with images.`,
    );
  }

  // Acquire file lock to prevent concurrent write races
  await _acquireFileLock(data.id);
  try {
    const dest = path.join(_historyDir, `${data.id}.json`);
    const tmp = `${dest}.tmp`;
    fs.writeFileSync(tmp, jsonString);
    fs.renameSync(tmp, dest);
    return data.id;
  } finally {
    _releaseFileLock(data.id);
  }
}

function deleteConversation(id) {
  // Validate conversation ID — prevent path traversal
  if (!id || typeof id !== "string" || /[\/\\]|\.\./.test(id)) {
    throw new Error("Invalid conversation id");
  }
  if (!_historyDir)
    throw new Error(
      "History not initialized. Call initHistory(appRoot) first.",
    );

  const filePath = resolveConversationFilePath(id);
  if (!filePath) {
    throw new Error("Conversation not found");
  }
  fs.unlinkSync(filePath);

  // CTXFIX Phase 3 — sweep externalized tool-result artifacts so they don't
  // outlive the conversation that produced them. Best-effort: failures here
  // shouldn't block the delete (the conversation file is already gone).
  try {
    const projectFolder = String(getConfig().projectFolder || "").trim();
    if (projectFolder) {
      deleteToolResultsForConversation(projectFolder, id);
    }
  } catch {
    // never let artifact GC fail the delete
  }
}

module.exports = {
  initHistory,
  listConversations,
  getConversation,
  saveConversation,
  deleteConversation,
};
