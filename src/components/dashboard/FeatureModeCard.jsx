import { Info } from "lucide-react";
import { getModeIcon } from "./icon-map";

/**
 * Individual mode card for the Feature Grid
 * Displays mode icon and label with hover effects (full description lives
 * behind the ⓘ info button and in the card's aria-label)
 */
export default function FeatureModeCard({
  mode,
  isActive,
  onClick,
  onInfoClick,
  infoButtonRef,
}) {
  const IconComponent = getModeIcon(mode.id);

  return (
    <div className="relative min-h-[120px] min-w-[140px]">
      <button
        type="button"
        className={`
          glass p-6 rounded-xl cursor-pointer w-full h-full
          hover:border-indigo-500/50
          hover:-translate-y-1
          hover:shadow-lg hover:shadow-indigo-500/20
          transition-all duration-200
          text-left
          focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0f1a]
          ${isActive ? "border-indigo-500/50 bg-indigo-500/5" : ""}
        `}
        onClick={onClick}
        aria-label={`Switch to ${mode.label} mode — ${mode.desc}`}
        data-testid={`feature-mode-card-${mode.id}`}
      >
        <div className="flex flex-col items-center gap-3 pr-6">
          <IconComponent className="w-10 h-10 text-indigo-400" />

          <h3 className="text-lg font-semibold text-white text-center">
            {mode.label}
          </h3>
        </div>
      </button>

      <button
        type="button"
        ref={infoButtonRef}
        className="absolute top-2 right-2 flex items-center justify-center w-11 h-11 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0f1a]"
        onClick={(e) => {
          e.stopPropagation();
          onInfoClick?.();
        }}
        aria-label={`More about ${mode.label}`}
        data-testid={`feature-mode-info-${mode.id}`}
      >
        <Info className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  );
}
