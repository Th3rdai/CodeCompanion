const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const {
  chatStructured,
  embed,
  effectiveOllamaApiKey,
} = require("./ollama-client");

let _memoryDir = null;
let _memories = [];

const MEMORIES_FILE = "memories.json";

function initMemory(dataRoot) {
  _memoryDir = path.join(dataRoot, "memory");
  if (!fs.existsSync(_memoryDir)) {
    fs.mkdirSync(_memoryDir, { recursive: true });
  }
  _loadFromDisk();
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
    id: uuidv4(),
    type: type || "fact",
    content,
    source: source || null,
    createdAt: now,
    updatedAt: now,
    embedding: embedding || null,
    embeddingModel: embeddingModel || "",
    confidence: typeof confidence === "number" ? confidence : 0.5,
    active: true,
  };
  _memories.push(memory);
  _persistToDisk();
  return memory;
}

function getMemories(filter) {
  if (!_memoryDir)
    throw new Error("Memory not initialized. Call initMemory(dataRoot) first.");

  let results = _memories.filter((m) => m.active);
  if (filter && filter.type) {
    results = results.filter((m) => m.type === filter.type);
  }
  return results;
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

  const memory = _memories.find((m) => m.id === id);
  if (!memory) return false;

  memory.active = false;
  memory.updatedAt = new Date().toISOString();
  _persistToDisk();
  return true;
}

/**
 * @param {number[]} queryEmbedding
 * @param {number} [topK]
 * @param {number} [threshold]
 * @param {{ conversationId?: string|null }} [options] — When set, only memories whose `source` matches this conversation id (no cross-chat leakage).
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

  const { conversationId } = options;
  let pool = _memories.filter(
    (m) => m.active && m.embedding && Array.isArray(m.embedding),
  );
  if (conversationId) {
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

  const active = _memories.filter((m) => m.active);
  const byType = {};
  for (const m of active) {
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
    total: active.length,
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
    _memories = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!Array.isArray(_memories)) _memories = [];
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

  // Process facts
  if (Array.isArray(extracted.facts)) {
    for (const fact of extracted.facts) {
      if (!fact || typeof fact !== "string" || fact.trim().length < 5) continue;
      try {
        const emb = await embed(ollamaUrl, fact, embeddingModel, embOpts);
        await _deduplicateAndAdd(
          "fact",
          fact,
          conversationId,
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

  // Process patterns
  if (Array.isArray(extracted.patterns)) {
    for (const pattern of extracted.patterns) {
      if (!pattern || typeof pattern !== "string" || pattern.trim().length < 5)
        continue;
      try {
        const emb = await embed(ollamaUrl, pattern, embeddingModel, embOpts);
        await _deduplicateAndAdd(
          "pattern",
          pattern,
          conversationId,
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

  // Process project
  if (extracted.project && extracted.project.name) {
    const projContent = `Project: ${extracted.project.name} — Stack: ${extracted.project.stack || "unknown"} — ${extracted.project.description || ""}`;
    try {
      const emb = await embed(ollamaUrl, projContent, embeddingModel, embOpts);
      await _deduplicateAndAdd(
        "project",
        projContent,
        conversationId,
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
    (m) => m.active && m.type === type && m.embedding,
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
  const active = _memories.filter((m) => m.active);
  if (active.length <= maxMemories) return;

  // Sort by confidence (asc), then by createdAt (asc) — remove oldest low-confidence first
  const sorted = [...active].sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence - b.confidence;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  const toRemove = sorted.slice(0, active.length - maxMemories);
  for (const m of toRemove) {
    m.active = false;
    m.updatedAt = new Date().toISOString();
  }
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

  // Require a conversation id so retrieval stays scoped to this thread only (no other chats).
  if (!conversationId || typeof conversationId !== "string") {
    return empty;
  }

  // Extract text from last user message
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg || !lastUserMsg.content) return empty;

  try {
    // 5-second timeout for the whole retrieval
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

    const results = searchMemories(queryEmbedding, 5, 0.3, {
      conversationId,
    });
    if (results.length === 0) return empty;

    // Format as prompt section
    const maxChars = (config.memory?.maxContextTokens || 500) * 4;
    let items = [];
    let totalLen = 0;
    for (const r of results) {
      const line = `- ${r.content}`;
      if (totalLen + line.length > maxChars) break;
      items.push(line);
      totalLen += line.length;
    }

    const prompt =
      items.length > 0
        ? `\n\n---\nMEMORY CONTEXT (from this conversation only — do not mix with unrelated threads):\n${items.join("\n")}\n---`
        : "";

    const memories = results.slice(0, items.length).map((m) => ({
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
  addMemory,
  getMemories,
  getMemory,
  updateMemory,
  deleteMemory,
  searchMemories,
  getStats,
  cosineSimilarity,
  extractAndStore,
  buildMemoryContext,
};
