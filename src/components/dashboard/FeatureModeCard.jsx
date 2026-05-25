import { getModeIcon } from "./icon-map";

/**
 * Individual mode card for the Feature Grid
 * Displays mode icon, label, and description with hover effects
 */
export default function FeatureModeCard({ mode, isActive, onClick }) {
  const IconComponent = getModeIcon(mode.id);

  return (
    <button
      className={`
        glass p-6 rounded-xl cursor-pointer
        hover:border-indigo-500/50
        hover:-translate-y-1
        hover:shadow-lg hover:shadow-indigo-500/20
        transition-all duration-200
        text-left
        focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0f1a]
        ${isActive ? "border-indigo-500/50 bg-indigo-500/5" : ""}
        min-h-[120px] min-w-[140px]
      `}
      onClick={onClick}
      aria-label={`Switch to ${mode.label} mode — ${mode.desc}`}
    >
      <div className="flex flex-col items-center gap-3">
        {/* SVG Icon (Lucide React) */}
        <IconComponent className="w-10 h-10 text-indigo-400" />

        {/* Mode Label */}
        <h3 className="text-lg font-semibold text-white text-center">
          {mode.label}
        </h3>

        {/* Mode Description */}
        <p className="text-sm text-slate-400 text-center line-clamp-1">
          {mode.desc}
        </p>
      </div>
    </button>
  );
}
