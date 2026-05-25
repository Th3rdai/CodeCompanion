/**
 * Calculate analytics from conversation history
 * @param {Array} history - Array of conversation objects
 * @returns {Object} Analytics data with totals, mode counts, and model counts
 */
export function calculateAnalytics(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      totals: {
        conversations: 0,
        active: 0,
        archived: 0,
        messages: 0,
      },
      modeCounts: {},
      modelCounts: {},
    };
  }

  const totals = {
    conversations: history.length,
    active: 0,
    archived: 0,
    messages: 0,
  };

  const modeCounts = {};
  const modelCounts = {};

  history.forEach((conv) => {
    // Count active vs archived
    if (conv.archived) {
      totals.archived++;
    } else {
      totals.active++;
    }

    // Count messages — the /api/history list ships messageCount (not the full
    // messages array); fall back to messages.length when full convos are passed.
    if (Array.isArray(conv.messages)) {
      totals.messages += conv.messages.length;
    } else if (typeof conv.messageCount === "number") {
      totals.messages += conv.messageCount;
    }

    // Count by mode
    if (conv.mode) {
      modeCounts[conv.mode] = (modeCounts[conv.mode] || 0) + 1;
    }

    // Count by model family (extract base name, e.g. "llama3.3" from
    // "llama3.3:70b"). Prefer per-message models when the full messages array is
    // present; otherwise use the conversation-level model from the list endpoint.
    const bumpModel = (model) => {
      if (!model || typeof model !== "string") return;
      const family = model.split(":")[0];
      if (!family) return;
      modelCounts[family] = (modelCounts[family] || 0) + 1;
    };
    if (Array.isArray(conv.messages) && conv.messages.length > 0) {
      conv.messages.forEach((msg) => bumpModel(msg.model));
    } else if (conv.model) {
      bumpModel(conv.model);
    }
  });

  return {
    totals,
    modeCounts,
    modelCounts,
  };
}
