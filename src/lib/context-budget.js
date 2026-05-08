/**
 * Token-budget estimation shared by client (preflight banner) and server
 * (chat-post-handler auto-num_ctx, review.js context sizing).
 *
 * Single source of truth for the chars-to-tokens approximation used across
 * Code Companion. Keeping the formula here means a future migration to a
 * better tokenizer (e.g. tiktoken-style) only changes one file, and Phase 1b
 * frontend / Phase 2 server compaction stay in lockstep.
 *
 * NOTE: this helper never adds response-headroom. Call sites that need to
 * leave room for the model's reply (chat-post-handler:796 adds ~2048,
 * review.js:98 adds +2048) keep that addition at the call site so the
 * intent stays visible there.
 */

const CHARS_PER_TOKEN = 3.5;

export function estimateTokens(text) {
  const s = typeof text === "string" ? text : "";
  if (!s) return 0;
  return Math.ceil(s.length / CHARS_PER_TOKEN);
}

/**
 * Sum the estimate across an Ollama-style messages array.
 * Tolerant of message shapes: missing/non-string `content` is treated as 0.
 */
export function estimateMessageTokens(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return 0;
  let total = 0;
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    if (typeof m.content === "string") total += m.content.length;
  }
  return Math.ceil(total / CHARS_PER_TOKEN);
}

export const CONTEXT_BUDGET_CHARS_PER_TOKEN = CHARS_PER_TOKEN;
