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

    // Count messages
    if (Array.isArray(conv.messages)) {
      totals.messages += conv.messages.length;
    }

    // Count by mode
    if (conv.mode) {
      modeCounts[conv.mode] = (modeCounts[conv.mode] || 0) + 1;
    }

    // Count by model family (extract base model name)
    if (Array.isArray(conv.messages)) {
      conv.messages.forEach((msg) => {
        if (msg.model) {
          // Extract model family (e.g., "llama3.3" from "llama3.3:70b")
          const family = msg.model.split(":")[0];
          modelCounts[family] = (modelCounts[family] || 0) + 1;
        }
      });
    }
  });

  return {
    totals,
    modeCounts,
    modelCounts,
  };
}
