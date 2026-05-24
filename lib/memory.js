const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const {
  chatStructured,
  embed,
  effectiveOllamaApiKey,
} = require("./ollama-client");

let _memoryDir = null;
let _memories = [];

const MEMORIES_FILE = "memories.json";

/** Single source of truth for the embedding model fallback when none is configured. */
const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text";

/** Pick the user's configured embedding model, or the default if unset/blank. */
function resolveEmbeddingModel(config) {
  const m = config && config.memory && config.memory.embeddingModel;
  return typeof m === "string" && m.trim() ? m.trim() : DEFAULT_EMBEDDING_MODEL;
}

/**
 * Derive a stable, normalized project key from a folder path or project name.
 * e.g. "/Users/james/Projects/CodeCompanion" → "codecompanion"
 *      "My Cool App"                          → "my-cool-app"
 * Returns null if nothing usable is provided.
 */
function deriveProjectKey(folderPathOrName) {
  if (!folderPathOrName || typeof folderPathOrName !== "string") return null;
  const base = path.basename(folderPathOrName.trim());
  const key = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return key || null;
}

function initMemory(dataRoot) {
  // Drop any pending debounced write from a prior init (re-init / test isolation)
  // so it can't fire against the new/old directory after the swap.
  if (_persistTimer) {
    clearTimeout(_persistTimer);
    _persistTimer = null;
  }
  _persistDirty = false;
  _memoryDir = path.join(dataRoot, "memory");
  if (!fs.existsSync(_memoryDir)) {
    fs.mkdirSync(_memoryDir, { recursive: true });
  }
  _loadFromDisk();
  _migrateGlobalScope();
}

/**
 * One-time migration:
 * 1. Facts/patterns/projects previously stored with a conversationId source get
 *    source cleared so they become globally searchable.
 * 2. Project memories get a projectKey recovered from their content string
 *    ("Project: CodeCompanion — ...") if they don't already have one.
 * 3. Pattern memories without a projectKey stay null (treated as agent-level patterns).
 */
function _migrateGlobalScope() {
  const GLOBAL_TYPES = ["fact", "pattern", "project"];
  // Regex to extract project name from "Project: <Name> — Stack: ..."
  const PROJECT_RE = /^Project:\s*([^—\n]+)/i;
  let changed = 0;
  for (const m of _memories) {
    if (!GLOBAL_TYPES.includes(m.type)) continue;
    // Clear legacy conversationId source
    if (m.source !== null) {
      m.source = null;
      changed++;
    }
    // Recover projectKey for project memories that lack one
    if (m.type === "project" && !m.projectKey) {
      const match = m.content && m.content.match(PROJECT_RE);
      if (match) {
        m.projectKey = deriveProjectKey(match[1].trim());
        changed++;
      }
    }
  }
  if (changed > 0) {
    console.log(
      `[Memory] Migrated ${changed} memory fields to global/project scope.`,
    );
    _persistToDisk();
  }
}

/**
 * Rebuild memories.json, optionally pruning orphaned conversation summaries.
 * @param {{ validSources?: string[]|Set<string> }} [options]
 *   validSources: ids of conversations that still exist. Summary memories whose
 *   `source` is not in this set are orphaned (their conversation was deleted)
 *   and removed. Pinned memories are never removed. Omit to just rebuild.
 * @returns {{ before:number, after:number, removed:number }}
 */
function compactMemories(options = {}) {
  if (!_memoryDir)
    throw new Error("Memory not initialized. Call initMemory(dataRoot) first.");
  const before = _memories.length;
  const { validSources } = options;
  if (validSources) {
    const valid =
      validSources instanceof Set ? validSources : new Set(validSources);
    _memories = _memories.filter((m) => {
      if (m.pinned) return true; // never drop pinned
      // Only summaries are conversation-scoped; orphan = source not in valid set.
      if (m.type === "summary" && m.source && !valid.has(m.source)) return false;
      return true;
    });
  }
  _persistToDisk();
  const after = _memories.length;
  return { before, after, removed: before - after };
}

function addMemory({
  type,
  content,
  source,
  projectKey,
  embedding,
  embeddingModel,
  confidence,
  topics,
  pinned,
}) {
  if (!_memoryDir)
    throw new Error("Memory not initialized. Call initMemory(dataRoot) first.");

  const now = new Date().toISOString();
  const resolvedType = type || "fact";
  const memory = {
    id: randomUUID(),
    type: resolvedType,
    content,
    source: source || null,
    projectKey: projectKey || null,
    createdAt: now,
    updatedAt: now,
    embedding: embedding || null,
    embeddingModel: embeddingModel || "",
    confidence: typeof confidence === "number" ? confidence : 0.5,
    pinned: pinned === true,
  };
  // Topics are keyword tags for a conversation, only meaningful on summaries.
  // Persist as a normalized string[] when provided on a summary record.
  if (resolvedType === "summary" && Array.isArray(topics)) {
    memory.topics = topics
      .filter((t) => typeof t === "string" && t.trim())
      .map((t) => t.trim());
  }
  _memories.push(memory);
  _persistToDisk();
  return memory;
}

function getMemories(filter) {
  if (!_memoryDir)
    throw new Error("Memory not initialized. Call initMemory(dataRoot) first.");

  let results = _memories;
  if (filter && filter.type) {
    results = results.filter((m) => m.type === filter.type);
  }
  return results.slice();
}

function getMemory(id) {
  if (!_memoryDir)
    throw new Error("Memory not initialized. Call initMemory(dataRoot) first.");
  return _memories.find((m) => m.id === id) || null;
}

function updateMemory(id, updates) {
  if (!_memoryDir)
    throw new Error("Memory not initialized. Call initMemory(dataRoot) first.");

  const memory = _memories.find((m) => m.id === id);
  if (!memory) return null;

  // Only allow safe fields to be updated
  const allowedFields = [
    "type",
    "content",
    "source",
    "projectKey",
    "embedding",
    "embeddingModel",
    "confidence",
    "topics",
    "pinned",
    "active",
  ];
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      memory[key] = updates[key];
    }
  }
  memory.updatedAt = new Date().toISOString();
  _persistToDisk();
  return memory;
}

function deleteMemory(id) {
  if (!_memoryDir)
    throw new Error("Memory not initialized. Call initMemory(dataRoot) first.");

  const idx = _memories.findIndex((m) => m.id === id);
  if (idx === -1) return false;

  _memories.splice(idx, 1);
  _persistToDisk();
  return true;
}

/**
 * Hard-delete every memory whose `source` matches the given conversation id.
 * Returns the number of records removed. Used to cascade history deletes.
 */
function deleteMemoriesBySource(source) {
  if (!_memoryDir)
    throw new Error("Memory not initialized. Call initMemory(dataRoot) first.");
  if (!source || typeof source !== "string") return 0;

  const before = _memories.length;
  _memories = _memories.filter((m) => m.source !== source);
  const removed = before - _memories.length;
  if (removed > 0) _persistToDisk();
  return removed;
}

/**
 * @param {number[]} queryEmbedding
 * @param {number} [topK]
 * @param {number} [threshold]
 * @param {{
 *   conversationId?: string|null,
 *   scopeToConversation?: boolean,
 *   projectKey?: string|null,
 *   types?: string[],
 * }} [options]
 *   - `scopeToConversation`: restrict to memories from one conversation (for summaries)
 *   - `projectKey`: restrict to memories tagged with this project (for project/pattern recall)
 *   - `types`: only include memories of these types
 */
function searchMemories(
  queryEmbedding,
  topK = 5,
  threshold = 0.3,
  options = {},
) {
  if (!_memoryDir)
    throw new Error("Memory not initialized. Call initMemory(dataRoot) first.");
  if (!queryEmbedding || !Array.isArray(queryEmbedding)) return [];

  const { conversationId, scopeToConversation, projectKey, types, embeddingModel } =
    options;
  let pool = _memories.filter((m) => m.embedding && Array.isArray(m.embedding));
  // Skip records embedded with a different model — cosine similarity across
  // different embedding models is meaningless. Opt-in: only filters when the
  // caller passes the active embeddingModel. Stale records become recallable
  // again after POST /api/memory/reembed re-embeds them with the current model.
  if (embeddingModel) {
    pool = pool.filter((m) => m.embeddingModel === embeddingModel);
  }
  if (scopeToConversation && conversationId) {
    pool = pool.filter((m) => m.source === conversationId);
  }
  if (projectKey) {
    pool = pool.filter((m) => m.projectKey === projectKey);
  }
  if (Array.isArray(types) && types.length > 0) {
    pool = pool.filter((m) => types.includes(m.type));
  }

  const scored = pool
    .map((m) => ({
      ...m,
      score: cosineSimilarity(queryEmbedding, m.embedding),
    }))
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

function getStats() {
  if (!_memoryDir)
    throw new Error("Memory not initialized. Call initMemory(dataRoot) first.");

  const byType = {};
  for (const m of _memories) {
    byType[m.type] = (byType[m.type] || 0) + 1;
  }

  let storageBytes = 0;
  const filePath = path.join(_memoryDir, MEMORIES_FILE);
  if (fs.existsSync(filePath)) {
    try {
      storageBytes = fs.statSync(filePath).size;
    } catch {
      // ignore
    }
  }

  return {
    total: _memories.length,
    totalIncludingDeleted: _memories.length,
    byType,
    storageBytes,
  };
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

function _loadFromDisk() {
  const filePath = path.join(_memoryDir, MEMORIES_FILE);
  if (!fs.existsSync(filePath)) {
    _memories = [];
    return;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!Array.isArray(parsed)) {
      _memories = [];
      return;
    }
    // Migration: drop legacy soft-delete tombstones (active === false) and
    // strip the `active` field from kept records. If anything was removed,
    // compact the file in place so the next start sees the slim version.
    const before = parsed.length;
    _memories = parsed
      .filter((m) => m && m.active !== false)
      .map(({ active: _active, ...rest }) => rest);
    if (_memories.length !== before) {
      _persistToDisk();
    }
  } catch {
    _memories = [];
  }
}

// Debounced persistence (MEMORYFIX P1b): bursts of writes — e.g. extraction
// adding many records in a loop, or auto-prune — coalesce into a single disk
// write. flushMemoryToDisk() forces any pending write synchronously and is
// called on process shutdown (server.js SIGINT/SIGTERM). A non-graceful crash
// within the debounce window can lose the last write; acceptable for local
// memory, and the window is small.
let _persistTimer = null;
let _persistDirty = false;
const PERSIST_DEBOUNCE_MS = 250;

/** Write current in-memory state to disk synchronously (atomic tmp+rename). */
function _writeToDiskNow() {
  const filePath = path.join(_memoryDir, MEMORIES_FILE);
  const tmp = filePath + ".tmp." + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(_memories, null, 2));
  fs.renameSync(tmp, filePath);
  _persistDirty = false;
}

/** Mark state dirty and schedule a coalesced disk write (debounced). */
function _persistToDisk() {
  _persistDirty = true;
  if (_persistTimer) return;
  _persistTimer = setTimeout(() => {
    _persistTimer = null;
    if (!_persistDirty || !_memoryDir) return;
    try {
      _writeToDiskNow();
    } catch (err) {
      console.warn("[Memory] debounced persist failed:", err.message);
    }
  }, PERSIST_DEBOUNCE_MS);
  // A pending memory flush should not keep the process alive on its own.
  if (typeof _persistTimer.unref === "function") _persistTimer.unref();
}

/**
 * Force any pending debounced write to disk synchronously. Called on process
 * shutdown so a deferred write isn't lost. No-op (returns false) if memory was
 * never initialized or nothing is pending.
 * @returns {boolean} true if a flush was performed
 */
function flushMemoryToDisk() {
  if (!_memoryDir) return false;
  if (_persistTimer) {
    clearTimeout(_persistTimer);
    _persistTimer = null;
  }
  if (!_persistDirty) return false;
  try {
    _writeToDiskNow();
    return true;
  } catch (err) {
    console.warn("[Memory] flushMemoryToDisk failed:", err.message);
    return false;
  }
}

/**
 * Recompute embeddings for every stored memory using the given embedding model.
 * Mutates records in place and persists once at the end (not per record).
 * `embedFn` is injectable so this is unit-testable without a live Ollama.
 * @returns {Promise<{total:number, reembedded:number, failed:number, embeddingModel:string}>}
 */
async function reembedAllMemories(
  ollamaUrl,
  embeddingModel,
  opts = {},
  embedFn = embed,
) {
  if (!_memoryDir)
    throw new Error("Memory not initialized. Call initMemory(dataRoot) first.");

  let reembedded = 0;
  let failed = 0;
  for (const m of _memories) {
    if (!m.content || typeof m.content !== "string") {
      failed++;
      continue;
    }
    try {
      const emb = await embedFn(ollamaUrl, m.content, embeddingModel, opts);
      if (emb && Array.isArray(emb) && emb.length > 0) {
        m.embedding = emb;
        m.embeddingModel = embeddingModel;
        m.updatedAt = new Date().toISOString();
        reembedded++;
      } else {
        failed++;
      }
    } catch (err) {
      console.warn("[Memory] Re-embed failed for a memory:", err.message);
      failed++;
    }
  }
  if (reembedded > 0) _persistToDisk();
  return { total: _memories.length, reembedded, failed, embeddingModel };
}

// ── Phase 2: Extraction Pipeline ──────────────────────

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    facts: {
      type: "array",
      items: { type: "string" },
      description: "Factual statements about the user",
    },
    project: {
      type: "object",
      properties: {
        name: { type: "string" },
        stack: { type: "string" },
        description: { type: "string" },
      },
      nullable: true,
    },
    patterns: {
      type: "array",
      items: { type: "string" },
      description: "Code patterns or recurring issues",
    },
    summary: {
      type: "string",
      description: "2-3 sentence conversation summary",
    },
    topics: { type: "array", items: { type: "string" } },
  },
  required: ["facts", "patterns", "summary", "topics"],
};

async function extractAndStore(
  ollamaUrl,
  chatModel,
  embeddingModel,
  conversation,
  config = null,
  projectKey = null,
) {
  const apiKey = effectiveOllamaApiKey(config || {});
  const embOpts = apiKey ? { apiKey } : {};
  const structOpts = apiKey ? { apiKey } : {};
  const msgs = conversation.messages || [];
  const mode = conversation.mode || "chat";
  const conversationId = conversation.id || null;

  // Format last 20 messages
  const recent = msgs.slice(-20);
  const formatted = recent
    .map((m) => {
      const role = m.role === "user" ? "User" : "Assistant";
      return `${role}: ${m.content}`;
    })
    .join("\n");

  const projectContext = projectKey
    ? `Active project: ${projectKey}`
    : "No specific project context.";

  const extractionPrompt = `Analyze this conversation and extract memories. Return ONLY new, specific information — not general programming knowledge.

Mode: ${mode}
${projectContext}
Messages:
${formatted}

Extract:
1. "facts": Facts about THIS USER as a person — their preferences, communication style, skill level, tools they use across all projects. These are AGENT-LEVEL memories recalled in every future conversation. Do NOT include project-specific details here.
2. "project": If a specific project was discussed: { name, stack, description }. null if no project mentioned.
3. "patterns": Code patterns, bugs, or architectural decisions specific to the ACTIVE PROJECT. Leave empty if no project context.
4. "summary": 2-3 sentence summary of key takeaways from this conversation.
5. "topics": Keyword tags for this conversation.

Return JSON only. Be concise. Skip generic facts like "user writes code".`;

  let extracted;
  try {
    extracted = await chatStructured(
      ollamaUrl,
      chatModel,
      [{ role: "user", content: extractionPrompt }],
      EXTRACTION_SCHEMA,
      60000,
      [],
      structOpts,
    );
  } catch (err) {
    const msg = err && err.message != null ? String(err.message) : "";
    if (err && err.name === "AbortError") return;
    if (/\baborted\b/i.test(msg)) return;
    console.warn("[Memory] Extraction failed (chatStructured):", msg || err);
    return;
  }

  if (!extracted) return;

  const maxMemories =
    (config && config.memory && config.memory.maxMemories) || 500;

  // Process facts — stored globally (source: null) so they persist across conversations
  if (Array.isArray(extracted.facts)) {
    for (const fact of extracted.facts) {
      if (!fact || typeof fact !== "string" || fact.trim().length < 5) continue;
      try {
        const emb = await embed(ollamaUrl, fact, embeddingModel, embOpts);
        await _deduplicateAndAdd(
          "fact",
          fact,
          null, // global scope — not tied to one conversation
          emb,
          embeddingModel,
          0.7,
          maxMemories,
        );
      } catch (err) {
        console.warn("[Memory] Failed to embed fact:", err.message);
      }
    }
  }

  // Process patterns — scoped to the active project so they don't bleed into other codebases
  if (Array.isArray(extracted.patterns)) {
    for (const pattern of extracted.patterns) {
      if (!pattern || typeof pattern !== "string" || pattern.trim().length < 5)
        continue;
      try {
        const emb = await embed(ollamaUrl, pattern, embeddingModel, embOpts);
        await _deduplicateAndAdd(
          "pattern",
          pattern,
          null,
          emb,
          embeddingModel,
          0.6,
          maxMemories,
          projectKey, // project-scoped — only recalled when this project is active
        );
      } catch (err) {
        console.warn("[Memory] Failed to embed pattern:", err.message);
      }
    }
  }

  // Resolve projectKey: prefer caller-supplied, fall back to extracted project name
  const resolvedProjectKey =
    projectKey ||
    (extracted.project?.name ? deriveProjectKey(extracted.project.name) : null);

  // Process project — scoped to its own key so different projects stay isolated
  if (extracted.project && extracted.project.name) {
    const projContent = `Project: ${extracted.project.name} — Stack: ${extracted.project.stack || "unknown"} — ${extracted.project.description || ""}`;
    try {
      const emb = await embed(ollamaUrl, projContent, embeddingModel, embOpts);
      await _deduplicateAndAdd(
        "project",
        projContent,
        null,
        emb,
        embeddingModel,
        0.8,
        maxMemories,
        resolvedProjectKey,
      );
    } catch (err) {
      console.warn("[Memory] Failed to embed project:", err.message);
    }
  }

  // Process summary
  if (
    extracted.summary &&
    typeof extracted.summary === "string" &&
    extracted.summary.trim().length > 5
  ) {
    try {
      const emb = await embed(
        ollamaUrl,
        extracted.summary,
        embeddingModel,
        embOpts,
      );
      addMemory({
        type: "summary",
        content: extracted.summary,
        source: conversationId,
        embedding: emb,
        embeddingModel,
        confidence: 0.5,
        topics: Array.isArray(extracted.topics) ? extracted.topics : [],
      });
      _autoPrune(maxMemories);
    } catch (err) {
      console.warn("[Memory] Failed to embed summary:", err.message);
    }
  }
}

function _deduplicateAndAdd(
  type,
  content,
  source,
  embedding,
  embeddingModel,
  confidence,
  maxMemories,
  projectKey = null,
) {
  // Check for duplicates among same type (and same project, if applicable)
  const sameType = _memories.filter(
    (m) =>
      m.type === type && m.embedding && m.projectKey === (projectKey || null),
  );
  for (const existing of sameType) {
    const sim = cosineSimilarity(embedding, existing.embedding);
    if (sim > 0.92) {
      // Update existing — bump confidence, refresh content and timestamp
      existing.updatedAt = new Date().toISOString();
      existing.confidence = Math.min(1.0, existing.confidence + 0.05);
      existing.content = content;
      existing.source = source;
      existing.projectKey = projectKey || null;
      _persistToDisk();
      return;
    }
  }

  // No duplicate — add as new
  addMemory({
    type,
    content,
    source,
    projectKey,
    embedding,
    embeddingModel,
    confidence,
  });
  _autoPrune(maxMemories);
}

function _autoPrune(maxMemories) {
  if (_memories.length <= maxMemories) return;

  const overflow = _memories.length - maxMemories;
  // Pinned memories are never auto-pruned — only unpinned records are candidates.
  const prunable = _memories.filter((m) => !m.pinned);
  if (prunable.length === 0) return;

  // Sort prunable by confidence (asc), then createdAt (asc) — oldest low-confidence first
  const sorted = prunable.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence - b.confidence;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  const toRemove = new Set(
    sorted.slice(0, Math.min(overflow, prunable.length)).map((m) => m.id),
  );
  if (toRemove.size === 0) return;
  _memories = _memories.filter((m) => !toRemove.has(m.id));
  _persistToDisk();
}

// ── Phase 2 hybrid recall (MEMORYFIX): multi-turn query + BM25 + RRF ──
// All opt-in via config.memory.hybridRecall; the default path is unchanged.

const RRF_K = 60;
const HYBRID_CANDIDATE_K = 25;
const MULTI_TURN_DEFAULT = 3;

/**
 * Combine the last N user messages into one query string, weighting the most
 * recent higher (it is repeated once → ~2x weight in both the embedding text
 * and the BM25 terms). Returns "" when there are no user messages.
 */
function buildMultiTurnQuery(messages, maxTurns = MULTI_TURN_DEFAULT) {
  if (!Array.isArray(messages)) return "";
  const userTexts = messages
    .filter(
      (m) =>
        m &&
        m.role === "user" &&
        typeof m.content === "string" &&
        m.content.trim(),
    )
    .map((m) => m.content.trim());
  if (userTexts.length === 0) return "";
  const recent = userTexts.slice(-Math.max(1, maxTurns));
  const latest = recent[recent.length - 1];
  return [...recent, latest].join("\n");
}

const _STOPWORDS = new Set(
  "the a an and or but if then else of to in on for with is are was were be been it this that these those as at by from".split(
    " ",
  ),
);

function _tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !_STOPWORDS.has(t));
}

/**
 * BM25 relevance scores for each doc against the query text.
 * @param {string} queryText
 * @param {{id:string, content:string}[]} docs
 * @returns {Map<string, number>} id → score (0 when no term overlap)
 */
function bm25Scores(queryText, docs, k1 = 1.5, b = 0.75) {
  const scores = new Map();
  if (!Array.isArray(docs) || docs.length === 0) return scores;
  const docTokens = docs.map((d) => _tokenize(d.content));
  const docLens = docTokens.map((t) => t.length);
  const avgdl = docLens.reduce((s, n) => s + n, 0) / docs.length || 1;
  const queryTerms = [...new Set(_tokenize(queryText))];
  if (queryTerms.length === 0) {
    for (const d of docs) scores.set(d.id, 0);
    return scores;
  }
  const N = docs.length;
  const df = new Map();
  for (const term of queryTerms) {
    let n = 0;
    for (const toks of docTokens) if (toks.includes(term)) n++;
    df.set(term, n);
  }
  for (let i = 0; i < docs.length; i++) {
    const tf = new Map();
    for (const t of docTokens[i]) tf.set(t, (tf.get(t) || 0) + 1);
    let score = 0;
    for (const term of queryTerms) {
      const f = tf.get(term) || 0;
      if (f === 0) continue;
      const n = df.get(term) || 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const denom = f + k1 * (1 - b + (b * docLens[i]) / avgdl);
      score += idf * ((f * (k1 + 1)) / denom);
    }
    scores.set(docs[i].id, score);
  }
  return scores;
}

/**
 * Reciprocal Rank Fusion of multiple ranked id-lists (best→worst order).
 * @param {string[][]} rankings
 * @returns {Map<string, number>} id → fused score
 */
function rrfFuse(rankings, k = RRF_K) {
  const fused = new Map();
  for (const ranking of rankings) {
    if (!Array.isArray(ranking)) continue;
    for (let rank = 0; rank < ranking.length; rank++) {
      const id = ranking[rank];
      fused.set(id, (fused.get(id) || 0) + 1 / (k + rank + 1));
    }
  }
  return fused;
}

// ── Phase 3: Retrieval & Injection ──────────────────────

async function buildMemoryContext(
  ollamaUrl,
  embeddingModel,
  messages,
  config,
  conversationId = null,
  projectKey = null,
) {
  const empty = { prompt: "", memories: [] };

  // Hybrid recall (multi-turn query + BM25/RRF fusion) is opt-in (MEMORYFIX P2).
  const hybrid = !!(config.memory && config.memory.hybridRecall);

  // Query text: the last user message by default, or the last few user messages
  // combined (recent-weighted) when hybrid recall is enabled.
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg || !lastUserMsg.content) return empty;
  const queryText = hybrid
    ? buildMultiTurnQuery(
        messages,
        config.memory?.recallTurns || MULTI_TURN_DEFAULT,
      )
    : lastUserMsg.content;
  if (!queryText) return empty;

  try {
    const embKey = effectiveOllamaApiKey(config);
    const queryEmbedding = await embed(ollamaUrl, queryText, embeddingModel, {
      ...(embKey ? { apiKey: embKey } : {}),
      timeoutMs: 12000,
    });

    if (!queryEmbedding) return empty;

    const maxChars = (config.memory?.maxContextTokens || 500) * 4;

    // User-tunable threshold (Settings → Memory → Recall Threshold). Default 0.6.
    const GLOBAL_THRESHOLD =
      typeof config.memory?.recallThreshold === "number"
        ? config.memory.recallThreshold
        : 0.6;
    // Summaries are already scoped to one conversation so a looser match is fine.
    const LOCAL_THRESHOLD = Math.max(0.3, GLOBAL_THRESHOLD - 0.25);

    // Candidate gather. Default path keeps the cosine thresholds and small K;
    // hybrid gathers a broader pool (no cosine cutoff, larger K) so BM25 can
    // surface keyword matches the vector pass alone would miss.
    const passK = hybrid ? HYBRID_CANDIDATE_K : 4;
    const agentThreshold = hybrid ? 0 : GLOBAL_THRESHOLD;
    const localThreshold = hybrid ? 0 : LOCAL_THRESHOLD;

    // ── Pass 1: Agent memories — facts about the user, global across all projects ──
    const agentResults = searchMemories(queryEmbedding, passK, agentThreshold, {
      types: ["fact"],
      embeddingModel,
    });

    // ── Pass 2: Project memories — patterns and project info for the active project ──
    // Only injected when a projectKey is known; keeps other projects from bleeding in.
    const projectResults = projectKey
      ? searchMemories(queryEmbedding, passK, agentThreshold, {
          projectKey,
          types: ["project", "pattern"],
          embeddingModel,
        })
      : [];

    // ── Pass 3: Conversation summaries — scoped to this thread ──
    const summaryResults = conversationId
      ? searchMemories(queryEmbedding, hybrid ? passK : 2, localThreshold, {
          conversationId,
          scopeToConversation: true,
          types: ["summary"],
          embeddingModel,
        })
      : [];

    // Merge all three passes, deduplicate by id
    const seen = new Set();
    const candidates = [];
    for (const r of [...agentResults, ...projectResults, ...summaryResults]) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        candidates.push(r);
      }
    }
    if (candidates.length === 0) return empty;

    // Rank: default = cosine score; hybrid = Reciprocal Rank Fusion of the
    // semantic (cosine) ranking and a BM25 keyword ranking over the same pool.
    let merged;
    if (hybrid) {
      const cosineRanked = [...candidates]
        .sort((a, b) => b.score - a.score)
        .map((m) => m.id);
      const bm25 = bm25Scores(
        queryText,
        candidates.map((m) => ({ id: m.id, content: m.content })),
      );
      const bm25Ranked = [...candidates]
        .sort((a, b) => (bm25.get(b.id) || 0) - (bm25.get(a.id) || 0))
        .map((m) => m.id);
      const fused = rrfFuse([cosineRanked, bm25Ranked]);
      merged = candidates
        .map((m) => ({ ...m, score: fused.get(m.id) || 0 }))
        .sort((a, b) => b.score - a.score);
    } else {
      merged = candidates.sort((a, b) => b.score - a.score);
    }

    if (merged.length === 0) return empty;

    // Format as prompt section — label each line by tier so the model understands provenance
    let items = [];
    let totalLen = 0;
    for (const r of merged) {
      const label =
        r.type === "fact"
          ? "agent"
          : r.type === "summary"
            ? "this conversation"
            : r.projectKey || "project";
      const line = `- [${label}] ${r.content}`;
      if (totalLen + line.length > maxChars) break;
      items.push(line);
      totalLen += line.length;
    }

    const prompt =
      items.length > 0
        ? `\n\n---\nMEMORY CONTEXT:\n[agent] = about you (recalled always) | [project] = active project | [this conversation] = from earlier in this chat\n${items.join("\n")}\n---`
        : "";

    const memories = merged.slice(0, items.length).map((m) => ({
      id: m.id,
      type: m.type,
      content: m.content,
      projectKey: m.projectKey || null,
    }));

    // nearMisses: ranked candidates that were retrieved but did NOT fit the
    // prompt budget. Optional debugging aid surfaced over SSE (MEMORYFIX P2).
    const NEAR_MISS_LIMIT = 5;
    const nearMisses = merged
      .slice(items.length, items.length + NEAR_MISS_LIMIT)
      .map((m) => ({
        id: m.id,
        type: m.type,
        content: m.content,
        projectKey: m.projectKey || null,
        score: typeof m.score === "number" ? Number(m.score.toFixed(4)) : null,
      }));

    return { prompt, memories, nearMisses };
  } catch (err) {
    const msg = err && err.message != null ? String(err.message) : "";
    if (!(err && err.name === "AbortError") && !/\baborted\b/i.test(msg)) {
      console.warn("[Memory] buildMemoryContext failed:", msg || err);
    }
    return empty;
  }
}

module.exports = {
  initMemory,
  compactMemories,
  addMemory,
  getMemories,
  getMemory,
  updateMemory,
  deleteMemory,
  deleteMemoriesBySource,
  searchMemories,
  deriveProjectKey,
  getStats,
  cosineSimilarity,
  extractAndStore,
  buildMemoryContext,
  flushMemoryToDisk,
  reembedAllMemories,
  buildMultiTurnQuery,
  bm25Scores,
  rrfFuse,
  DEFAULT_EMBEDDING_MODEL,
  resolveEmbeddingModel,
};
