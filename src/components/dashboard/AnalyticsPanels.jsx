import { useMemo } from "react";
import BarList from "./BarList";
import CollapsibleSection from "./CollapsibleSection";

/**
 * Helper to convert object to sorted entries
 */
function toEntries(obj) {
  return Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
}

/**
 * AnalyticsPanels - Mode and Model analytics visualizations
 * Displays conversation breakdown by mode and model family. Each panel is its
 * own collapsible section.
 */
export default function AnalyticsPanels({ analytics, modes, showModeBreakdown = true, showModelBreakdown = true }) {
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
      {showModeBreakdown && (
        <CollapsibleSection
          title="Mode Breakdown"
          meta={
            modeCounts.length > 0
              ? `${modeCounts.length} mode${modeCounts.length !== 1 ? "s" : ""}`
              : null
          }
          storageKey="cc.dashboard.modeBreakdown"
        >
          <div className="glass rounded-xl p-6">
            {modeCounts.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                No conversations yet — start chatting and this will fill up!
              </p>
            ) : (
              <BarList items={modeCounts} ariaLabel="Conversations by mode" />
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Model Family Breakdown Panel */}
      {showModelBreakdown && (
        <CollapsibleSection
          title="Model Family Breakdown"
          meta={
            modelCounts.length > 0
              ? `${modelCounts.length} model${modelCounts.length !== 1 ? "s" : ""}`
              : null
          }
          storageKey="cc.dashboard.modelBreakdown"
        >
          <div className="glass rounded-xl p-6">
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
        </CollapsibleSection>
      )}
    </div>
  );
}
