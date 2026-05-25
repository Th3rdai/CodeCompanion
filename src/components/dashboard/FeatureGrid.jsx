import { useCallback, useRef, useState } from "react";
import FeatureModeCard from "./FeatureModeCard";
import FeatureModeDetailModal from "./FeatureModeDetailModal";
import CollapsibleSection from "./CollapsibleSection";

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
  const [detailMode, setDetailMode] = useState(null);
  const infoButtonRefs = useRef({});

  const modesForGrid = modes
    .filter((m) => m.id !== "dashboard")
    .filter((m) => isElectron || m.id !== "terminal");

  const closeDetailModal = useCallback(() => {
    if (!detailMode) return;
    const trigger = infoButtonRefs.current[detailMode.id];
    setDetailMode(null);
    requestAnimationFrame(() => trigger?.focus());
  }, [detailMode]);

  const openModeFromModal = useCallback(() => {
    if (!detailMode) return;
    const modeId = detailMode.id;
    setDetailMode(null);
    onModeSelect(modeId);
  }, [detailMode, onModeSelect]);

  return (
    <>
      <CollapsibleSection
        title="Feature Access Grid"
        meta={`${modesForGrid.length} modes available`}
        storageKey="cc.dashboard.featureGrid"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {modesForGrid.map((mode) => (
            <FeatureModeCard
              key={mode.id}
              mode={mode}
              isActive={currentMode === mode.id}
              onClick={() => onModeSelect(mode.id)}
              onInfoClick={() => setDetailMode(mode)}
              infoButtonRef={(el) => {
                if (el) infoButtonRefs.current[mode.id] = el;
                else delete infoButtonRefs.current[mode.id];
              }}
            />
          ))}
        </div>
      </CollapsibleSection>

      {/* Rendered outside the collapsible region so the modal isn't inert'd. */}
      {detailMode && (
        <FeatureModeDetailModal
          mode={detailMode}
          onOpen={openModeFromModal}
          onClose={closeDetailModal}
        />
      )}
    </>
  );
}
