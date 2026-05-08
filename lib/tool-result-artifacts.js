/**
 * lib/tool-result-artifacts.js — CTXFIX Phase 3 helpers for the
 * cumulative tool-output cap + project-folder externalization feature.
 *
 * Single source of truth for:
 *   - sanitizeConvIdForFilename — used by the writer (chat handler), the
 *     conversation-delete GC (lib/history.js), and the startup sweep
 *     (server.js). Drift between these would orphan files on disk.
 *   - generateReqSuffix — per-request disambiguator so concurrent
 *     /api/chat calls sharing a conversationId can't collide on filename.
 *   - maybeExternalizeToolOutput — accepts the (already-cleaned) tool
 *     stdout for one round, and either:
 *       - returns it unchanged (under the cap),
 *       - writes it to <projectFolder>/.codecompanion/tool-results/ and
 *         returns a short placeholder pointing the LLM at
 *         codecompanion_read_file (when the flag is on AND a project
 *         folder is set), or
 *       - returns the trailing 5,000 chars + a "set Settings → Project
 *         folder" hint (fallback when externalization isn't possible).
 *
 * The cap counts characters in the LLM-bound message stream, not on-disk
 * bytes. Disk usage is bounded by the GC sweep (older than 7 days at
 * end-of-request, plus a one-shot startup sweep).
 *
 * Vision images (toolResultMsg.images) are NOT counted in v1 — base64 is
 * already bounded by imageSupport.maxSizeMB and tool rounds rarely attach
 * them. Track follow-up if telemetry shows that's wrong.
 */

const fs = require("fs");
const path = require("path");

const TOOL_RESULTS_SUBDIR = path.join(".codecompanion", "tool-results");
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FALLBACK_TAIL_CHARS = 5000;
const DEFAULT_CUMULATIVE_CAP = 100_000;

function sanitizeConvIdForFilename(id) {
  const s = String(id || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 64);
  return s || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateReqSuffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function toolResultsDir(projectFolder) {
  return path.join(projectFolder, TOOL_RESULTS_SUBDIR);
}

function ensureToolResultsDir(projectFolder) {
  const dir = toolResultsDir(projectFolder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    // Drop a narrow .gitignore so users don't accidentally commit
    // multi-MB tool outputs. Limited to `tool-results/` so the
    // .codecompanion/ directory itself stays trackable for future
    // sibling artifacts.
    const gitignorePath = path.join(
      projectFolder,
      ".codecompanion",
      ".gitignore",
    );
    try {
      if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, "tool-results/\n", "utf8");
      }
    } catch {
      // best-effort — never let .gitignore creation block writing the artifact
    }
  }
  return dir;
}

function placeholderFor(relPath, byteLen) {
  const kb = Math.max(1, Math.round(byteLen / 1024));
  return `Tool output saved to ${relPath} (~${kb} KB). Use codecompanion_read_file to inspect.`;
}

function fallbackTruncate(content) {
  const tail = String(content).slice(-FALLBACK_TAIL_CHARS);
  return `${tail}\n[truncated — set Settings → Project folder to externalize]`;
}

/**
 * @param {string} content       Already-cleaned tool stdout for one round.
 * @param {object} ctx
 * @param {object} ctx.config            App config (.cc-config.json merged with defaults)
 * @param {string} ctx.conversationId    Active conversation id (sanitized internally)
 * @param {string} ctx.reqSuffix         Per-request disambiguator (generateReqSuffix)
 * @param {number} ctx.roundIdx          Tool-call round index in this request
 * @param {{ value: number }} ctx.cumulativeRef
 *   Mutable counter — caller (chat handler) is the SOLE writer. This
 *   helper only READS `cumulativeRef.value` for the threshold check.
 *   On externalize, cumulativeRef.value grows by the placeholder length
 *   (~80 B), not the original — that's intentional: the cap bounds the
 *   LLM-bound message stream, not on-disk bytes.
 * @returns {string} content unchanged, a placeholder, or fallback-truncated.
 */
function maybeExternalizeToolOutput(content, ctx) {
  const text = typeof content === "string" ? content : String(content || "");
  if (!text) return text;
  const cfg = (ctx && ctx.config) || {};
  const cap = Number.isFinite(cfg.cumulativeToolOutputMaxChars)
    ? cfg.cumulativeToolOutputMaxChars
    : DEFAULT_CUMULATIVE_CAP;

  const cumulative =
    ctx && ctx.cumulativeRef && Number.isFinite(ctx.cumulativeRef.value)
      ? ctx.cumulativeRef.value
      : 0;
  const willOverflow = cumulative + text.length > cap;
  if (!willOverflow) return text;

  const projectFolder = String(cfg.projectFolder || "").trim();
  const flagOn = !!cfg.externalizeToolOutput;

  if (flagOn && projectFolder) {
    try {
      const dir = ensureToolResultsDir(projectFolder);
      const safeId = sanitizeConvIdForFilename(ctx.conversationId);
      const reqSuffix = String((ctx && ctx.reqSuffix) || generateReqSuffix());
      const roundIdx = Number.isFinite(ctx && ctx.roundIdx) ? ctx.roundIdx : 0;
      const filename = `${safeId}-${reqSuffix}-${roundIdx}.txt`;
      const filePath = path.join(dir, filename);
      fs.writeFileSync(filePath, text, "utf8");
      const relPath = `${TOOL_RESULTS_SUBDIR}/${filename}`;
      return placeholderFor(relPath, Buffer.byteLength(text, "utf8"));
    } catch {
      // EACCES / disk full / etc. — degrade gracefully.
      return fallbackTruncate(text);
    }
  }

  return fallbackTruncate(text);
}

/**
 * Delete tool-result artifacts older than `olderThanMs` (default 7 days).
 * Used by:
 *   - end-of-request sweep (best-effort, fire-and-forget via setImmediate),
 *   - server startup sweep,
 *   - conversation-delete sweep (with a stricter glob — see deleteForConversation).
 *
 * No-op (returns 0) when the directory does not exist.
 */
function gcOlderThan(projectFolder, olderThanMs = SEVEN_DAYS_MS) {
  if (!projectFolder) return 0;
  const dir = toolResultsDir(projectFolder);
  if (!fs.existsSync(dir)) return 0;
  const cutoff = Date.now() - olderThanMs;
  let removed = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return 0;
  }
  for (const name of entries) {
    if (!name.endsWith(".txt")) continue;
    const full = path.join(dir, name);
    try {
      const stat = fs.statSync(full);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(full);
        removed += 1;
      }
    } catch {
      // best-effort
    }
  }
  return removed;
}

/**
 * Delete every tool-result artifact for a given conversationId. Called by
 * lib/history.js when a conversation is deleted, so leftover externalized
 * outputs don't outlive their owner.
 */
function deleteForConversation(projectFolder, conversationId) {
  if (!projectFolder || !conversationId) return 0;
  const dir = toolResultsDir(projectFolder);
  if (!fs.existsSync(dir)) return 0;
  const safeId = sanitizeConvIdForFilename(conversationId);
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return 0;
  }
  let removed = 0;
  for (const name of entries) {
    // Filenames look like `<safeId>-<reqSuffix>-<roundIdx>.txt`. Match
    // safeId followed by a dash so we don't sweep `safeId2-…` siblings.
    if (!name.startsWith(`${safeId}-`)) continue;
    if (!name.endsWith(".txt")) continue;
    try {
      fs.unlinkSync(path.join(dir, name));
      removed += 1;
    } catch {
      // best-effort
    }
  }
  return removed;
}

module.exports = {
  sanitizeConvIdForFilename,
  generateReqSuffix,
  maybeExternalizeToolOutput,
  gcOlderThan,
  deleteForConversation,
  toolResultsDir,
  // exported for tests
  TOOL_RESULTS_SUBDIR,
  DEFAULT_CUMULATIVE_CAP,
  FALLBACK_TAIL_CHARS,
  SEVEN_DAYS_MS,
};
