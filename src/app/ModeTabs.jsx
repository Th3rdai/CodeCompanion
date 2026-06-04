import { ChevronDown, Search } from "lucide-react";
import FloatingGeometry from "../components/3d/FloatingGeometry";
import ChatSessionProgress from "../components/ui/ChatSessionProgress";
import LinkedExperimentChips from "../components/LinkedExperimentChips";
import { MORE_MENU_GROUPS, modeById } from "./modes";

export default function ModeTabs({
  showDecorative3D,
  primaryModes,
  mode,
  selectMode,
  agentTerminalEnabled,
  moreModesRef,
  showMoreModes,
  setShowMoreModes,
  currentModeIsSecondary,
  showModePalette,
  setShowModePalette,
  paletteQuery,
  setPaletteQuery,
  paletteInputRef,
  paletteModes,
  paletteHighlightIndex,
  setPaletteHighlightIndex,
  streaming,
  currentMode,
  linkedExperimentIds,
  setRestoreExperimentId,
  setMode,
}) {
  return (
    <>
      {/* Mode tabs: primary strip, More menu, command palette (⌘K / Ctrl+K) */}
      <div className="glass border-b border-slate-700/30 px-3 sm:px-4 py-2 flex flex-wrap items-center gap-1.5 sm:gap-2 relative">
        {showDecorative3D && <FloatingGeometry shapeCount={5} />}
        {primaryModes.map((m) => (
          <button
            key={m.id}
            type="button"
            data-testid={`mode-tab-${m.id}`}
            onClick={() => selectMode(m.id)}
            className={`relative z-10 flex min-h-[36px] cursor-pointer items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1419] ${
              mode === m.id
                ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-medium neon-glow-sm"
                : "text-slate-400 hover:bg-indigo-500/10 hover:text-slate-200 border border-transparent"
            }`}
          >
            <span aria-hidden="true">{m.icon}</span>
            <span className="relative">
              {m.label}
              {m.id === "agentic" && agentTerminalEnabled && (
                <span
                  className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-green-400"
                  title="Agent terminal is active"
                />
              )}
            </span>
          </button>
        ))}
        <div className="relative z-10" ref={moreModesRef}>
          <button
            type="button"
            data-testid="mode-tab-more"
            aria-expanded={showMoreModes}
            aria-haspopup="menu"
            onClick={() => {
              setShowMoreModes((v) => !v);
              setShowModePalette(false);
            }}
            className={`relative z-10 flex min-h-[36px] cursor-pointer items-center gap-0.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1419] ${
              currentModeIsSecondary
                ? "bg-indigo-600/20 text-indigo-200 border border-indigo-500/35 font-medium"
                : "text-slate-400 hover:bg-indigo-500/10 hover:text-slate-200 border border-transparent"
            }`}
          >
            More
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 opacity-70 transition-transform ${showMoreModes ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {showMoreModes && (
            <div
              className="absolute left-0 top-full z-50 mt-1 min-w-[min(100vw-2rem,16rem)] max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-slate-600/40 bg-[#141a24]/95 py-2 shadow-xl backdrop-blur-md"
              role="menu"
            >
              {MORE_MENU_GROUPS.map((group) => (
                <div key={group.label} className="px-1 pb-1">
                  <div
                    className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                    role="presentation"
                  >
                    {group.label}
                  </div>
                  {group.ids.map((id) => {
                    const m = modeById(id);
                    if (!m) return null;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="menuitem"
                        data-testid={`mode-tab-${m.id}`}
                        onClick={() => selectMode(m.id)}
                        className={`flex w-full min-h-[40px] items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                          mode === m.id
                            ? "bg-indigo-600/25 text-indigo-200"
                            : "text-slate-300 hover:bg-slate-600/30"
                        }`}
                      >
                        <span aria-hidden="true">{m.icon}</span>
                        <span className="relative flex-1">
                          {m.label}
                          {m.id === "agentic" && agentTerminalEnabled && (
                            <span
                              className="absolute -top-0.5 right-0 w-2 h-2 rounded-full bg-green-400"
                              title="Agent terminal is active"
                            />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          data-testid="mode-tab-palette-open"
          title="Search modes (⌘K or Ctrl+K)"
          aria-label="Search modes, keyboard shortcut Command K or Control K"
          onClick={() => {
            setShowModePalette(true);
            setShowMoreModes(false);
          }}
          className="relative z-10 ml-auto flex min-h-[36px] min-w-[36px] cursor-pointer items-center justify-center rounded-lg border border-transparent text-slate-400 transition-colors hover:bg-indigo-500/10 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1419]"
        >
          <Search className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <ChatSessionProgress
        active={streaming}
        modeLabel={currentMode?.label || ""}
      />

      {mode !== "experiment" && (
        <LinkedExperimentChips
          ids={linkedExperimentIds}
          onOpen={(id) => {
            setRestoreExperimentId(id);
            setMode("experiment");
          }}
        />
      )}

      {showModePalette && (
        <div
          className="fixed inset-0 z-[200] flex items-start justify-center bg-black/55 px-4 pt-[12vh] pb-8"
          role="dialog"
          aria-modal="true"
          aria-label="Switch mode"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowModePalette(false);
          }}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-600/50 bg-[#141a24] shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-700/50 px-3 py-2">
              <Search
                className="h-4 w-4 shrink-0 text-slate-500"
                aria-hidden
              />
              <input
                ref={paletteInputRef}
                type="search"
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder="Filter modes…"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
                aria-autocomplete="list"
                aria-controls="mode-palette-list"
              />
              <kbd className="hidden shrink-0 rounded border border-slate-600/60 bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">
                esc
              </kbd>
            </div>
            <ul
              id="mode-palette-list"
              className="max-h-[min(50vh,20rem)] overflow-y-auto py-1"
              role="listbox"
            >
              {paletteModes.map((m, idx) => (
                <li key={m.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={idx === paletteHighlightIndex}
                    data-testid={`mode-tab-${m.id}`}
                    onMouseEnter={() => setPaletteHighlightIndex(idx)}
                    onClick={() => selectMode(m.id)}
                    className={`flex w-full min-h-[44px] items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                      idx === paletteHighlightIndex
                        ? "bg-indigo-600/30 text-indigo-100"
                        : "text-slate-300 hover:bg-slate-700/40"
                    }`}
                  >
                    <span aria-hidden="true">{m.icon}</span>
                    <span className="relative flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-medium">{m.label}</span>
                      {m.desc ? (
                        <span className="truncate text-xs text-slate-500">
                          {m.desc}
                        </span>
                      ) : null}
                      {m.id === "agentic" && agentTerminalEnabled && (
                        <span
                          className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-green-400"
                          title="Agent terminal is active"
                        />
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {paletteModes.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-500">
                No modes match that filter.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
