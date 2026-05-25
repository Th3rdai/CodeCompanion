import { useEffect, useId, useRef } from "react";
import { Check, Lightbulb } from "lucide-react";
import { getModeIcon } from "./icon-map";
import { getModeDetails } from "./mode-details";

/**
 * Detail modal for a dashboard feature-grid mode — full description + explicit open action.
 */
export default function FeatureModeDetailModal({ mode, onOpen, onClose }) {
  const titleId = useId();
  const openButtonRef = useRef(null);
  const panelRef = useRef(null);
  const IconComponent = getModeIcon(mode.id);
  const details = getModeDetails(mode.id);

  useEffect(() => {
    openButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="feature-mode-detail-modal"
        className="glass rounded-2xl border border-indigo-500/30 shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-6 pb-5">
          {/* Header */}
          <div className="flex flex-col items-center gap-3 text-center">
            <IconComponent
              className="w-12 h-12 text-indigo-400"
              aria-hidden="true"
            />
            <h2 id={titleId} className="text-xl font-semibold text-white">
              {mode.label}
            </h2>
            <p
              className="text-sm font-medium text-indigo-300"
              data-testid="feature-mode-detail-desc"
            >
              {mode.desc}
            </p>
          </div>

          {details && (
            <div className="mt-5 space-y-4 text-left">
              {details.summary && (
                <p className="text-sm leading-relaxed text-slate-300">
                  {details.summary}
                </p>
              )}

              {details.bestFor?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Great for
                  </p>
                  <ul className="space-y-1.5">
                    {details.bestFor.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm text-slate-300"
                      >
                        <Check
                          className="w-4 h-4 mt-0.5 shrink-0 text-indigo-400"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {details.tip && (
                <div className="flex items-start gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-2">
                  <Lightbulb
                    className="w-4 h-4 mt-0.5 shrink-0 text-indigo-300"
                    aria-hidden="true"
                  />
                  <p className="text-xs leading-relaxed text-indigo-100">
                    {details.tip}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors min-h-[44px]"
          >
            Cancel
          </button>
          <button
            ref={openButtonRef}
            type="button"
            onClick={onOpen}
            className="btn-neon text-white px-4 py-2 text-sm rounded-lg font-medium transition-colors min-h-[44px]"
          >
            Open {mode.label}
          </button>
        </div>
      </div>
    </div>
  );
}
