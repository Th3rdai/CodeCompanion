import FeatureGrid from "./FeatureGrid";
import RecentWorkSection from "./RecentWorkSection";
import { Home } from "lucide-react";

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
  return (
    <div className="fixed inset-0 flex flex-col mesh-gradient overflow-hidden">
      {/* Dashboard Header */}
      <div className="glass-heavy border-b border-slate-700/30 px-6 py-4">
        <div className="flex items-center gap-3">
          <Home className="w-6 h-6 text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
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
          />

          {/* Feature Grid - Phase 1 Component */}
          <FeatureGrid
            modes={modes}
            currentMode={currentMode}
            onModeSelect={onModeSelect}
            isElectron={isElectron}
          />

          {/* Placeholder for Phase 3 */}
          <div className="glass p-6 rounded-xl">
            <p className="text-slate-400 text-center text-sm">
              🚧 Coming in Phase 3: Quick Stats and Analytics
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
