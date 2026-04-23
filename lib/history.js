const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

let _historyDir = null;

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
          archived: data.archived || false,
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
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveConversation(data) {
  if (!_historyDir)
    throw new Error(
      "History not initialized. Call initHistory(appRoot) first.",
    );

  if (!data.id) {
    data.id = uuidv4();
  }
  // Validate conversation ID — prevent path traversal
  if (!data.id || typeof data.id !== "string" || /[\/\\]|\.\./.test(data.id)) {
    throw new Error("Invalid conversation id");
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

  const dest = path.join(_historyDir, `${data.id}.json`);
  const tmp = `${dest}.tmp`;
  fs.writeFileSync(tmp, jsonString);
  fs.renameSync(tmp, dest);
  return data.id;
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
}

module.exports = {
  initHistory,
  listConversations,
  getConversation,
  saveConversation,
  deleteConversation,
};
