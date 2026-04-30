/**
 * Persistent experiment run records (parallel to history/).
 * Atomic writes: .tmp + rename.
 */

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

let _dir = null;

function initExperimentStore(appRoot) {
  _dir = path.join(appRoot, "experiments");
  if (!fs.existsSync(_dir)) {
    fs.mkdirSync(_dir, { recursive: true });
  }
}

function _safeId(id) {
  if (!id || typeof id !== "string" || /[\/\\]|\.\./.test(id)) return null;
  return id;
}

function _pathFor(id) {
  const safe = _safeId(id);
  if (!safe || !_dir) return null;
  return path.join(_dir, `${safe}.json`);
}

function atomicWriteJson(filePath, data) {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

/**
 * @param {object} input
 * @param {string} input.hypothesis
 * @param {number} [input.maxRounds]
 * @param {string} [input.conversationId]
 * @param {string} [input.projectFolder]
 */
function createExperiment(input) {
  if (!_dir) throw new Error("experiment store not initialized");
  const id = randomUUID();
  const now = new Date().toISOString();
  const record = {
    id,
    createdAt: now,
    updatedAt: now,
    status: "active",
    hypothesis: String(input.hypothesis || "").trim(),
    maxRounds: Math.min(Math.max(parseInt(input.maxRounds, 10) || 8, 1), 25),
    conversationId: input.conversationId || null,
    projectFolder: input.projectFolder || null,
    steps: [],
    messageCountAtStart: 0,
  };
  const fp = _pathFor(id);
  atomicWriteJson(fp, record);
  return record;
}

function getExperiment(id) {
  const fp = _pathFor(id);
  if (!fp || !fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    return null;
  }
}

function updateExperiment(id, patch) {
  const fp = _pathFor(id);
  if (!fp) throw new Error("invalid experiment id");
  const cur = getExperiment(id);
  if (!cur) throw new Error("not found");
  const next = {
    ...cur,
    ...patch,
    id: cur.id,
    updatedAt: new Date().toISOString(),
  };
  atomicWriteJson(fp, next);
  return next;
}

/**
 * Append a step summary after each assistant turn (bounded text).
 */
function appendStep(id, step) {
  const cur = getExperiment(id);
  if (!cur) throw new Error("not found");
  const steps = Array.isArray(cur.steps) ? [...cur.steps] : [];
  steps.push({
    at: new Date().toISOString(),
    role: step.role || "assistant",
    summary: String(step.summary || "").slice(0, 8000),
    metric: step.metric || null,
  });
  return updateExperiment(id, { steps });
}

function listExperiments(limit = 50) {
  if (!_dir) return [];
  let files;
  try {
    files = fs.readdirSync(_dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const rows = [];
  for (const f of files) {
    const fp = path.join(_dir, f);
    try {
      const data = JSON.parse(fs.readFileSync(fp, "utf8"));
      rows.push({
        id: data.id,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        status: data.status,
        hypothesis: (data.hypothesis || "").slice(0, 120),
        stepCount: (data.steps || []).length,
      });
    } catch {
      /* skip */
    }
  }
  rows.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return rows.slice(0, limit);
}

module.exports = {
  initExperimentStore,
  createExperiment,
  getExperiment,
  updateExperiment,
  appendStep,
  listExperiments,
};
