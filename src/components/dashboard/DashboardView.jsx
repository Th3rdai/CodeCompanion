import { useMemo } from "react";
import FeatureGrid from "./FeatureGrid";
import RecentWorkSection from "./RecentWorkSection";
import QuickStatsGrid from "./QuickStatsGrid";
import ActivityChart from "./ActivityChart";
import CollapsibleSection from "./CollapsibleSection";
import ExportAnalytics from "./ExportAnalytics";
import DashboardSettings, { useWidgetVisibility } from "./DashboardSettings";
import AnalyticsPanels from "./AnalyticsPanels";
import { calculateAnalytics } from "../../lib/analytics";

/**
 * Dashboard View - Phase 1 & 2 Implementation
 * Home view with Feature Grid navigation and Recent Work
 */
export default function DashboardView({
  modes,
  currentMode,
  onModeSelect,
  isElectron,
  history,
  onResumeConversation,
}) {
  // Calculate analytics from history
  const analytics = useMemo(() => {
    return calculateAnalytics(history || []);
  }, [history]);

  // Widget visibility preferences
  const showRecentWork = useWidgetVisibility("recentWork");
  const showQuickStats = useWidgetVisibility("quickStats");
  const showActivity = useWidgetVisibility("activity");
  const showModeBreakdown = useWidgetVisibility("modeBreakdown");
  const showModelBreakdown = useWidgetVisibility("modelBreakdown");

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      {/* No in-view "Home" banner — the persistent "See Home →" tab in the
          header mode strip is the title/affordance and the way back here. */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Phase 5: Dashboard Settings */}
          <DashboardSettings />

          {/* Recent Work Section - Phase 2 */}
          {showRecentWork && (
            <RecentWorkSection
              conversations={history || []}
              onResume={onResumeConversation}
              onStartChat={() => onModeSelect("chat")}
              loading={false}
              modes={modes}
            />
          )}

          {/* Feature Grid - Phase 1 Component */}
          <FeatureGrid
            modes={modes}
            currentMode={currentMode}
            onModeSelect={onModeSelect}
            isElectron={isElectron}
          />

          {/* Phase 3: Quick Stats */}
          {showQuickStats && <QuickStatsGrid analytics={analytics} />}

          {/* Phase 5: Export Analytics */}
          {history && history.length > 0 && (
            <div className="flex justify-end">
              <ExportAnalytics analytics={analytics} />
            </div>
          )}

          {/* Phase 5: 7-Day Activity Chart */}
          {showActivity && (
            <CollapsibleSection
              title="7-Day Activity"
              meta={history?.length > 0 ? `${history.length} total` : null}
              storageKey="cc.dashboard.activity"
            >
              <div className="glass rounded-xl p-6">
                {history && history.length > 0 ? (
                  <ActivityChart history={history} />
                ) : (
                  <p className="text-sm text-slate-400 text-center py-4">
                    No conversations yet — start chatting and watch your
                    activity grow!
                  </p>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Phase 3: Analytics Panels */}
          <AnalyticsPanels
            analytics={analytics}
            modes={modes}
            showModeBreakdown={showModeBreakdown}
            showModelBreakdown={showModelBreakdown}
          />
        </div>
      </div>
    </div>
  );
}
