import FeatureModeCard from "./FeatureModeCard";

/**
 * Feature Grid - Displays all non-dashboard modes as clickable cards
 * Core navigation component for the dashboard
 */
export default function FeatureGrid({
  modes,
  currentMode,
  onModeSelect,
  isElectron,
}) {
  // Filter out dashboard mode (no self-reference) and Terminal in browser
  const modesForGrid = modes
    .filter((m) => m.id !== "dashboard")
    .filter((m) => isElectron || m.id !== "terminal");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">
          Feature Access Grid
        </h2>
        <span className="text-sm text-slate-400">
          {modesForGrid.length} modes available
        </span>
      </div>

      {/* Grid Layout */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        }}
      >
        {modesForGrid.map((mode) => (
          <FeatureModeCard
            key={mode.id}
            mode={mode}
            isActive={currentMode === mode.id}
            onClick={() => onModeSelect(mode.id)}
          />
        ))}
      </div>
    </div>
  );
}
