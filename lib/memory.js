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

function initMemory(dataRoot) {
  _memoryDir = path.join(dataRoot, "memory");
  if (!fs.existsSync(_memoryDir)) {
    fs.mkdirSync(_memoryDir, { recursive: true });
  }
  _loadFromDisk();
  _migrateGlobalScope();
}

/**
 * One-time migration: facts, patterns, and projects stored with a conversationId source
 * were previously scoped to a single conversation and never retrievable elsewhere.
 * Clear their source so they become globally searchable across all conversations.
 */
function _migrateGlobalScope() {
  const GLOBAL_TYPES = ["fact", "pattern", "project"];
  let changed = 0;
  for (const m of _memories) {
    if (GLOBAL_TYPES.includes(m.type) && m.source !== null) {
      m.source = null;
      changed++;
    }
  }
  if (changed > 0) {
    console.log(`[Memory] Migrated ${changed} memories to global scope.`);
    _persistToDisk();
  }
}

/**
 * One-shot rebuild of memories.json from current in-memory state.
 * Use after migrating away from soft-delete tombstones, or any time
 * the on-disk file is suspected to have grown bloated.
 * Returns the post-compaction record count.
 */
function compactMemories() {
  if (!_memoryDir)
    throw new Error("Memory not initialized. Call initMemory(dataRoot) first.");
  _persistToDisk();
  return _memories.length;
}

function addMemory({
  type,
  content,
  source,
  embedding,
  embeddingModel,
  confidence,
}) {
  if (!_memoryDir)
    throw new Error("Memory not initialized. Call initMemory(dataRoot) first.");

  const now = new Date().toISOString();
  const memory = {
    id: randomUUID(),
    type: type || "fact",
    content,
    source: source || null,
    createdAt: now,
    updatedAt: now,
    embedding: embedding || null,
    embeddingModel: embeddingModel || "",
    confidence: typeof confidence === "number" ? confidence : 0.5,
  };
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
    "embedding",
    "embeddingModel",
    "confidence",
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
 * @param {{ conversationId?: string|null, scopeToConversation?: boolean }} [options]
 *   - When `scopeToConversation` is true AND `conversationId` is set, only memories from that
 *     conversation are returned (used for summaries). Otherwise searches all memories globally.
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

  const { conversationId, scopeToConversation } = options;
  let pool = _memories.filter(
    (m) => m.embedding && Array.isArray(m.embedding),
  );
  // Only restrict to a single conversation when explicitly requested
  if (scopeToConversation && conversationId) {
    pool = pool.filter((m) => m.source === conversationId);
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

function _persistToDisk() {
  const filePath = path.join(_memoryDir, MEMORIES_FILE);
  const tmp = filePath + ".tmp." + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(_memories, null, 2));
  fs.renameSync(tmp, filePath);
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

  const extractionPrompt = `Analyze this conversation and extract memories. Return ONLY new, specific information — not general programming knowledge.

Mode: ${mode}
Messages:
${formatted}

Extract:
1. "facts": Specific facts about THIS user (languages they use, tools, preferences, skill level). Only include what was explicitly stated or strongly implied.
2. "project": If a specific project was discussed: { name, stack, description }. null if no project mentioned.
3. "patterns": Code patterns, bugs found, or specific improvements relevant to this user's work.
4. "summary": 2-3 sentence summary of key takeaways.
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
    console.warn("[Memory] Extraction failed (chatStructured):", err.message);
    return;
  }

  if (!extracted) return;

  const maxMemories = 500; // default cap

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

  // Process patterns — stored globally so they survive across conversations
  if (Array.isArray(extracted.patterns)) {
    for (const pattern of extracted.patterns) {
      if (!pattern || typeof pattern !== "string" || pattern.trim().length < 5)
        continue;
      try {
        const emb = await embed(ollamaUrl, pattern, embeddingModel, embOpts);
        await _deduplicateAndAdd(
          "pattern",
          pattern,
          null, // global scope
          emb,
          embeddingModel,
          0.6,
          maxMemories,
        );
      } catch (err) {
        console.warn("[Memory] Failed to embed pattern:", err.message);
      }
    }
  }

  // Process project — stored globally so the model remembers the project across sessions
  if (extracted.project && extracted.project.name) {
    const projContent = `Project: ${extracted.project.name} — Stack: ${extracted.project.stack || "unknown"} — ${extracted.project.description || ""}`;
    try {
      const emb = await embed(ollamaUrl, projContent, embeddingModel, embOpts);
      await _deduplicateAndAdd(
        "project",
        projContent,
        null, // global scope
        emb,
        embeddingModel,
        0.8,
        maxMemories,
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
) {
  // Check for duplicates among same type
  const sameType = _memories.filter(
    (m) => m.type === type && m.embedding,
  );
  for (const existing of sameType) {
    const sim = cosineSimilarity(embedding, existing.embedding);
    if (sim > 0.92) {
      // Update existing — bump confidence and update timestamp
      existing.updatedAt = new Date().toISOString();
      existing.confidence = Math.min(1.0, existing.confidence + 0.05);
      existing.content = content; // use latest wording
      existing.source = source;
      _persistToDisk();
      return;
    }
  }

  // No duplicate — add as new
  addMemory({ type, content, source, embedding, embeddingModel, confidence });
  _autoPrune(maxMemories);
}

function _autoPrune(maxMemories) {
  if (_memories.length <= maxMemories) return;

  // Sort by confidence (asc), then by createdAt (asc) — remove oldest low-confidence first
  const sorted = [..._memories].sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence - b.confidence;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  const toRemove = new Set(
    sorted.slice(0, _memories.length - maxMemories).map((m) => m.id),
  );
  _memories = _memories.filter((m) => !toRemove.has(m.id));
  _persistToDisk();
}

// ── Phase 3: Retrieval & Injection ──────────────────────

async function buildMemoryContext(
  ollamaUrl,
  embeddingModel,
  messages,
  config,
  conversationId = null,
) {
  const empty = { prompt: "", memories: [] };

  // Extract text from last user message
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg || !lastUserMsg.content) return empty;

  try {
    // 5-second timeout for the embedding call
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let queryEmbedding;
    try {
      const embKey = effectiveOllamaApiKey(config);
      queryEmbedding = await embed(
        ollamaUrl,
        lastUserMsg.content,
        embeddingModel,
        embKey ? { apiKey: embKey } : {},
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!queryEmbedding) return empty;

    const maxChars = (config.memory?.maxContextTokens || 500) * 4;

    // Higher threshold for global memories (cross-conversation pool is large;
    // we only want genuinely relevant recalls, not loose topic matches).
    // Falls back to 0.6 if not configured — user-tunable in Settings → Memory.
    const GLOBAL_THRESHOLD =
      typeof config.memory?.recallThreshold === "number"
        ? config.memory.recallThreshold
        : 0.6;
    // Summaries are already scoped to this conversation so a looser match is fine.
    const LOCAL_THRESHOLD = Math.max(0.3, GLOBAL_THRESHOLD - 0.25);

    // --- Global retrieval: facts, patterns, projects (cross-conversation) ---
    const globalResults = searchMemories(queryEmbedding, 5, GLOBAL_THRESHOLD, {
      // no conversationId filter — search all stored memories
    }).filter((m) => ["fact", "pattern", "project"].includes(m.type));

    // --- Local retrieval: summaries scoped to this conversation only ---
    const localResults =
      conversationId
        ? searchMemories(queryEmbedding, 2, LOCAL_THRESHOLD, {
            conversationId,
            scopeToConversation: true,
          }).filter((m) => m.type === "summary")
        : [];

    // Merge, deduplicate by id, sort by score descending
    const seen = new Set();
    const merged = [];
    for (const r of [...globalResults, ...localResults]) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        merged.push(r);
      }
    }
    merged.sort((a, b) => b.score - a.score);

    if (merged.length === 0) return empty;

    // Format as prompt section
    let items = [];
    let totalLen = 0;
    for (const r of merged) {
      const line = `- [${r.type}] ${r.content}`;
      if (totalLen + line.length > maxChars) break;
      items.push(line);
      totalLen += line.length;
    }

    const prompt =
      items.length > 0
        ? `\n\n---\nMEMORY CONTEXT (facts and patterns recalled from prior sessions; summaries from this conversation):\n${items.join("\n")}\n---`
        : "";

    const memories = merged.slice(0, items.length).map((m) => ({
      id: m.id,
      type: m.type,
      content: m.content,
    }));

    return { prompt, memories };
  } catch (err) {
    // On ANY error (timeout, embed fail, etc): return empty
    console.warn("[Memory] buildMemoryContext failed:", err.message);
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
  getStats,
  cosineSimilarity,
  extractAndStore,
  buildMemoryContext,
  DEFAULT_EMBEDDING_MODEL,
  resolveEmbeddingModel,
};
