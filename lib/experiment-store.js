/**
 * Persistent experiment run records (parallel to history/).
 * Atomic writes: .tmp + rename.
 *
 * The store also maintains an in-process registry, _activeExperimentByProject,
 * which the chat-post-handler uses to thread the active experiment scope into
 * the tool-call context. The map is process-local: single-process Electron /
 * single-process Node server is the only deployment shape today.
 */

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

let _dir = null;
const _activeExperimentByProject = new Map();

class DuplicateExperimentError extends Error {
  constructor(existingId) {
    super(`Experiment already running for this project: ${existingId}`);
    this.name = "DuplicateExperimentError";
    this.existingId = existingId;
  }
}

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
 * Migration shim: fills in fields added after v1.6.22.
 * Never widens capability — missing scope falls back to {projectFolder + global allowlist}.
 *
 * @param {object} record    raw record loaded from disk
 * @param {object} [currentConfig]  optional config snapshot used when scope is missing;
 *                                  must have shape `{ agentTerminal?: { allowlist?: [] }, projectFolder? }`.
 *                                  Defaults to {} so unit tests can call without config.
 */
function _migrate(record, currentConfig = {}) {
  if (!record || typeof record !== "object") return record;
  const out = { ...record };

  if (!out.scope || typeof out.scope !== "object") {
    const fallbackPath =
      out.projectFolder || currentConfig.projectFolder || null;
    const allowlist = Array.isArray(currentConfig?.agentTerminal?.allowlist)
      ? [...currentConfig.agentTerminal.allowlist]
      : [];
    out.scope = {
      paths: fallbackPath ? [fallbackPath] : [],
      commands: allowlist,
    };
  }

  if (!("metric" in out)) out.metric = null;
  if (!("reproducibility" in out)) out.reproducibility = null;
  if (!("promptHash" in out)) out.promptHash = null;
  if (typeof out.denials !== "number") out.denials = 0;
  if (!("finalMetricValue" in out)) out.finalMetricValue = null;
  if (typeof out.messageCountAtStart !== "number") out.messageCountAtStart = 0;
  if (!("abortReason" in out)) out.abortReason = null;
  if (!("endedAt" in out)) out.endedAt = null;
  if (typeof out.budgetSec !== "number") out.budgetSec = null;

  if (!out.status) {
    out.status = out.endedAt ? "timeout" : "active";
  }

  if (Array.isArray(out.steps)) {
    out.steps = out.steps.map((s) => ({
      at: s.at || new Date().toISOString(),
      role: s.role || "assistant",
      summary: typeof s.summary === "string" ? s.summary : "",
      did: typeof s.did === "string" ? s.did : null,
      observed: typeof s.observed === "string" ? s.observed : null,
      next: typeof s.next === "string" ? s.next : null,
      done: s.done === true,
      decision:
        s.decision === "keep" ||
        s.decision === "iterate" ||
        s.decision === "discard"
          ? s.decision
          : null,
      denials: Array.isArray(s.denials) ? s.denials : [],
      metric:
        s.metric && typeof s.metric === "object" && "value" in s.metric
          ? {
              value: typeof s.metric.value === "number" ? s.metric.value : null,
            }
          : null,
    }));
  } else {
    out.steps = [];
  }

  return out;
}

function _resolvedProjectFolder(folder) {
  if (!folder) return null;
  try {
    return fs.realpathSync(folder);
  } catch {
    return path.resolve(folder);
  }
}

/**
 * @param {object} input
 * @param {string} input.hypothesis
 * @param {number} [input.maxRounds]
 * @param {number} [input.budgetSec]
 * @param {string} [input.conversationId]
 * @param {string} [input.projectFolder]
 * @param {{paths: string[], commands: string[]} | null} [input.scope]
 * @param {object | null} [input.metric]
 * @param {object | null} [input.reproducibility]
 * @param {string | null} [input.promptHash]
 */
function createExperiment(input) {
  if (!_dir) throw new Error("experiment store not initialized");
  const projectFolder = input.projectFolder || null;
  const folderKey = _resolvedProjectFolder(projectFolder);

  if (folderKey && _activeExperimentByProject.has(folderKey)) {
    const existing = _activeExperimentByProject.get(folderKey);
    throw new DuplicateExperimentError(existing.id);
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const record = {
    id,
    createdAt: now,
    updatedAt: now,
    endedAt: null,
    status: "active",
    hypothesis: String(input.hypothesis || "").trim(),
    maxRounds: Math.min(Math.max(parseInt(input.maxRounds, 10) || 8, 1), 25),
    budgetSec:
      typeof input.budgetSec === "number" && input.budgetSec > 0
        ? Math.min(input.budgetSec, 7200)
        : null,
    conversationId: input.conversationId || null,
    projectFolder,
    scope: input.scope || null,
    metric: input.metric || null,
    reproducibility: input.reproducibility || null,
    promptHash: input.promptHash || null,
    steps: [],
    messageCountAtStart: 0,
    denials: 0,
    finalMetricValue: null,
    abortReason: null,
  };
  const fp = _pathFor(id);
  atomicWriteJson(fp, record);

  if (folderKey) {
    _activeExperimentByProject.set(folderKey, {
      id,
      scope: record.scope,
      metric: record.metric,
      startedAt: now,
    });
  }

  return record;
}

function getExperiment(id, currentConfig) {
  const fp = _pathFor(id);
  if (!fp || !fs.existsSync(fp)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(fp, "utf8"));
    return _migrate(raw, currentConfig);
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
 * Append (or overwrite-on-replay) a step. Server-side denial counter is updated.
 *
 * Idempotency: if `step.rawAssistantText` matches the most recent step's
 * stored `summary`, the most recent step is overwritten instead of appended,
 * and the denial counter is recomputed (not incremented). This guards against
 * double-counting when an SSE connection drops and the client retries.
 *
 * @param {string} id
 * @param {object} step
 * @param {string} [step.rawAssistantText]
 * @param {string} [step.role]
 * @param {string} [step.summary]                    (back-compat alias for rawAssistantText)
 * @param {string|null} [step.did]
 * @param {string|null} [step.observed]
 * @param {string|null} [step.next]
 * @param {boolean} [step.done]
 * @param {"keep"|"iterate"|"discard"|null} [step.decision]
 * @param {Array<{name: string, reason: string}>} [step.denials]
 * @param {{value: number|null}|null} [step.metric]
 */
function appendStep(id, step) {
  const cur = getExperiment(id);
  if (!cur) throw new Error("not found");

  const summary = String(step.rawAssistantText ?? step.summary ?? "").slice(
    0,
    8000,
  );
  const denials = Array.isArray(step.denials) ? step.denials : [];

  const newStep = {
    at: new Date().toISOString(),
    role: step.role || "assistant",
    summary,
    did: typeof step.did === "string" ? step.did : null,
    observed: typeof step.observed === "string" ? step.observed : null,
    next: typeof step.next === "string" ? step.next : null,
    done: step.done === true,
    decision:
      step.decision === "keep" ||
      step.decision === "iterate" ||
      step.decision === "discard"
        ? step.decision
        : null,
    denials,
    metric:
      step.metric && typeof step.metric === "object" && "value" in step.metric
        ? {
            value:
              typeof step.metric.value === "number" ? step.metric.value : null,
          }
        : null,
  };

  const existingSteps = Array.isArray(cur.steps) ? [...cur.steps] : [];
  const lastStep = existingSteps[existingSteps.length - 1];
  const isReplay =
    lastStep &&
    summary !== "" &&
    lastStep.summary === summary &&
    lastStep.role === newStep.role;

  let nextSteps;
  let nextDenialsTotal;
  if (isReplay) {
    nextSteps = [...existingSteps.slice(0, -1), newStep];
    const priorTotal = (cur.denials || 0) - (lastStep.denials?.length || 0);
    nextDenialsTotal = Math.max(0, priorTotal) + denials.length;
  } else {
    nextSteps = [...existingSteps, newStep];
    nextDenialsTotal = (cur.denials || 0) + denials.length;
  }

  return updateExperiment(id, {
    steps: nextSteps,
    denials: nextDenialsTotal,
  });
}

/**
 * Single source of truth for terminal state. First arrival wins —
 * subsequent calls are no-ops returning the existing record.
 *
 * @param {string} id
 * @param {object} opts
 * @param {"completed"|"aborted"|"failed"|"timeout"} opts.status
 * @param {number|null} [opts.finalMetricValue]
 * @param {string|null} [opts.abortReason]
 */
function finalizeExperiment(id, opts) {
  const cur = getExperiment(id);
  if (!cur) throw new Error("not found");
  if (cur.status && cur.status !== "active") {
    return cur;
  }
  const patch = {
    status: opts.status,
    endedAt: new Date().toISOString(),
  };
  if ("finalMetricValue" in opts)
    patch.finalMetricValue = opts.finalMetricValue;
  if ("abortReason" in opts) patch.abortReason = opts.abortReason;
  const next = updateExperiment(id, patch);

  const folderKey = _resolvedProjectFolder(cur.projectFolder);
  if (folderKey && _activeExperimentByProject.get(folderKey)?.id === id) {
    _activeExperimentByProject.delete(folderKey);
  }
  return next;
}

/**
 * Startup sweep. Walks experiments/*.json; for each `active` record:
 *   - if endedAt is set → flip to timeout
 *   - else if (now - createdAt) > budgetSec → flip to timeout
 *   - else leave active AND restore _activeExperimentByProject entry
 *
 * Returns { swept, restored } for the startup log.
 */
function sweepStaleActiveExperiments(now = Date.now(), currentConfig = {}) {
  if (!_dir) return { swept: 0, restored: 0 };
  let files;
  try {
    files = fs.readdirSync(_dir).filter((f) => f.endsWith(".json"));
  } catch {
    return { swept: 0, restored: 0 };
  }
  let swept = 0;
  let restored = 0;
  const defaultBudgetSec = 900;

  for (const f of files) {
    const fp = path.join(_dir, f);
    let record;
    try {
      record = _migrate(JSON.parse(fs.readFileSync(fp, "utf8")), currentConfig);
    } catch {
      continue;
    }
    if (record.status !== "active") continue;

    const budgetMs = (record.budgetSec || defaultBudgetSec) * 1000;
    const createdMs = new Date(record.createdAt).getTime();
    const stale =
      record.endedAt ||
      (Number.isFinite(createdMs) && now - createdMs > budgetMs);

    if (stale) {
      const next = {
        ...record,
        status: "timeout",
        endedAt: record.endedAt || new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      };
      try {
        atomicWriteJson(fp, next);
        swept++;
      } catch {
        /* skip */
      }
      continue;
    }

    const folderKey = _resolvedProjectFolder(record.projectFolder);
    if (folderKey && !_activeExperimentByProject.has(folderKey)) {
      _activeExperimentByProject.set(folderKey, {
        id: record.id,
        scope: record.scope,
        metric: record.metric,
        startedAt: record.createdAt,
      });
      restored++;
    }
  }
  return { swept, restored };
}

function getActiveExperimentByProject(projectFolder) {
  const key = _resolvedProjectFolder(projectFolder);
  if (!key) return null;
  return _activeExperimentByProject.get(key) || null;
}

/**
 * Paginated index. Sorted by updatedAt desc; tiebreak by id desc.
 *
 * @param {object} [opts]
 * @param {string} [opts.projectFolder]   if omitted, returns cross-project list
 * @param {number} [opts.limit=50]
 * @param {string} [opts.cursor]          updatedAt of last item from previous page
 */
function listExperiments(opts = {}) {
  const { projectFolder, limit = 50, cursor } = opts;
  if (!_dir) return [];
  let files;
  try {
    files = fs.readdirSync(_dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const folderKey = projectFolder
    ? _resolvedProjectFolder(projectFolder)
    : null;
  const cursorMs = cursor ? new Date(cursor).getTime() : null;

  const rows = [];
  for (const f of files) {
    const fp = path.join(_dir, f);
    try {
      const data = JSON.parse(fs.readFileSync(fp, "utf8"));
      if (folderKey) {
        const itemKey = _resolvedProjectFolder(data.projectFolder);
        if (itemKey !== folderKey) continue;
      }
      const updatedMs = new Date(data.updatedAt).getTime();
      if (
        cursorMs !== null &&
        Number.isFinite(updatedMs) &&
        updatedMs >= cursorMs
      ) {
        continue;
      }
      rows.push({
        id: data.id,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        status: data.status || "active",
        hypothesis: (data.hypothesis || "").slice(0, 120),
        stepCount: (data.steps || []).length,
        finalMetricValue:
          typeof data.finalMetricValue === "number"
            ? data.finalMetricValue
            : null,
        metricName: data.metric?.name || null,
      });
    } catch {
      /* skip */
    }
  }
  rows.sort((a, b) => {
    const t = new Date(b.updatedAt) - new Date(a.updatedAt);
    if (t !== 0) return t;
    return (b.id || "").localeCompare(a.id || "");
  });
  return rows.slice(0, Math.max(1, Math.min(parseInt(limit, 10) || 50, 200)));
}

module.exports = {
  initExperimentStore,
  createExperiment,
  getExperiment,
  updateExperiment,
  appendStep,
  finalizeExperiment,
  sweepStaleActiveExperiments,
  getActiveExperimentByProject,
  listExperiments,
  DuplicateExperimentError,
  _migrate,
};
