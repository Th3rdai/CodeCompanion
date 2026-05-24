const crypto = require("crypto");

const TOOL_RESULT_USER_PREFIX = /^\[Tool:\s/;
const LIVE_TOOL_RESULT_USER_PREFIX = /^Tool results:\n/;

function isToolResultPseudoUser(message) {
  return (
    message?.role === "user" &&
    typeof message?.content === "string" &&
    (TOOL_RESULT_USER_PREFIX.test(message.content) ||
      LIVE_TOOL_RESULT_USER_PREFIX.test(message.content))
  );
}

function findCompactionSplitIndex(messages, keepRecent = 10) {
  if (!Array.isArray(messages) || messages.length === 0) return 0;
  const safeKeepRecent =
    Number.isFinite(keepRecent) && keepRecent >= 0 ? Math.floor(keepRecent) : 10;
  let splitIdx = messages.length - safeKeepRecent;
  if (splitIdx <= 0) return 0;

  while (splitIdx > 0) {
    const cur = messages[splitIdx];
    if (!isToolResultPseudoUser(cur)) break;
    splitIdx -= 2;
    if (splitIdx < 0) {
      splitIdx = 0;
      break;
    }
  }

  return splitIdx;
}

function buildCompactionCacheKey(messages, splitIdx) {
  const src = Array.isArray(messages) ? messages : [];
  const end = Math.max(0, Math.min(src.length, Math.floor(splitIdx || 0)));
  const payload = src
    .slice(0, end)
    .map((m) => {
      const role = typeof m?.role === "string" ? m.role : "unknown";
      const content = typeof m?.content === "string" ? m.content : "";
      return `${role}:${content.length}:${content.slice(0, 64)}`;
    })
    .join("|");

  return crypto.createHash("sha256").update(payload).digest("hex");
}

function capCompactionSummary(summary, maxSummaryChars = 2000) {
  const text = typeof summary === "string" ? summary : "";
  const limit =
    Number.isFinite(maxSummaryChars) && maxSummaryChars > 0
      ? Math.floor(maxSummaryChars)
      : 2000;
  if (text.length <= limit) return text;

  const suffix = "...[truncated]";
  const head = Math.max(0, limit - suffix.length);
  return `${text.slice(0, head)}${suffix}`;
}

async function compactHistory({
  messages,
  systemMessage = null,
  keepRecent = 10,
  maxSummaryChars = 2000,
  summarize,
}) {
  const input = Array.isArray(messages) ? messages : [];
  const splitIdx = findCompactionSplitIndex(input, keepRecent);
  const fallbackTail = input.slice(Math.max(0, splitIdx));
  const basePrefix = systemMessage ? [systemMessage] : [];
  if (splitIdx <= 0) {
    return {
      kind: "skipped",
      reason: "insufficient-history",
      splitIdx,
      summarizedRange: [0, -1],
      rebuiltMessages: [...basePrefix, ...input],
      keptRecent: input.length,
    };
  }

  if (typeof summarize !== "function") {
    return {
      kind: "fallback",
      reason: "summarizer-unavailable",
      splitIdx,
      summarizedRange: [0, splitIdx - 1],
      rebuiltMessages: [...basePrefix, ...fallbackTail],
      keptRecent: fallbackTail.length,
    };
  }

  try {
    const summaryRaw = await summarize(input.slice(0, splitIdx));
    const summary = capCompactionSummary(summaryRaw, maxSummaryChars).trim();
    if (!summary) {
      throw new Error("empty-summary");
    }
    const summaryMessage = {
      role: "system",
      content: summary,
      _kind: "compaction_summary",
    };
    return {
      kind: "summary",
      splitIdx,
      summary,
      summaryChars: summary.length,
      summarizedRange: [0, splitIdx - 1],
      rebuiltMessages: [...basePrefix, summaryMessage, ...fallbackTail],
      keptRecent: fallbackTail.length,
    };
  } catch (err) {
    return {
      kind: "fallback",
      reason: err?.message || "summary-failed",
      splitIdx,
      summarizedRange: [0, splitIdx - 1],
      rebuiltMessages: [...basePrefix, ...fallbackTail],
      keptRecent: fallbackTail.length,
    };
  }
}

module.exports = {
  TOOL_RESULT_USER_PREFIX,
  LIVE_TOOL_RESULT_USER_PREFIX,
  isToolResultPseudoUser,
  findCompactionSplitIndex,
  buildCompactionCacheKey,
  capCompactionSummary,
  compactHistory,
};
