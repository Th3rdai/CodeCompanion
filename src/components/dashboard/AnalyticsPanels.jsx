import { useMemo } from "react";
import BarList from "./BarList";

/**
 * Helper to convert object to sorted entries
 */
function toEntries(obj) {
  return Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
}

/**
 * AnalyticsPanels - Mode and Model analytics visualizations
 * Displays conversation breakdown by mode and model family
 */
export default function AnalyticsPanels({ analytics, modes }) {
  // Process mode counts and map to human-readable labels
  const modeCounts = useMemo(() => {
    const entries = toEntries(analytics?.modeCounts || {});
    return entries.map(([modeId, count]) => {
      const label = modes?.find((m) => m.id === modeId)?.label || modeId;
      return [label, count];
    });
  }, [analytics, modes]);

  // Process model counts
  const modelCounts = useMemo(
    () => toEntries(analytics?.modelCounts || {}),
    [analytics],
  );

  return (
    <div className="space-y-6">
      {/* Mode Breakdown Panel */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Mode Breakdown
        </h3>

        {modeCounts.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            No conversations yet — start chatting and this will fill up!
          </p>
        ) : (
          <BarList items={modeCounts} ariaLabel="Conversations by mode" />
        )}
      </div>

      {/* Model Family Breakdown Panel */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Model Family Breakdown
        </h3>

        {modelCounts.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            No model data yet — try a few different models and see what shows
            up!
          </p>
        ) : (
          <BarList
            items={modelCounts}
            ariaLabel="Conversations by model family"
          />
        )}
      </div>
    </div>
  );
}
