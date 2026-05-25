import { useMemo } from "react";
import FeatureGrid from "./FeatureGrid";
import RecentWorkSection from "./RecentWorkSection";
import QuickStatsGrid from "./QuickStatsGrid";
import AnalyticsPanels from "./AnalyticsPanels";
import { Home } from "lucide-react";
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

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      {/* Dashboard Header */}
      <div className="glass-heavy border-b border-slate-700/30 px-6 py-4">
        <div className="flex items-center gap-3">
          <Home className="w-6 h-6 text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Home</h1>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Recent Work Section - Phase 2 */}
          <RecentWorkSection
            conversations={history || []}
            onResume={onResumeConversation}
            onStartChat={() => onModeSelect("chat")}
            loading={false}
            modes={modes}
          />

          {/* Feature Grid - Phase 1 Component */}
          <FeatureGrid
            modes={modes}
            currentMode={currentMode}
            onModeSelect={onModeSelect}
            isElectron={isElectron}
          />

          {/* Phase 3: Quick Stats */}
          <QuickStatsGrid analytics={analytics} />

          {/* Phase 3: Analytics Panels */}
          <AnalyticsPanels analytics={analytics} modes={modes} />
        </div>
      </div>
    </div>
  );
}
