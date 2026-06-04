import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getDashboardSectionDefaultOpen } from "./dashboard-section-defaults";

/**
 * CollapsibleSection - Reusable collapsible container with localStorage persistence
 * Used for dashboard sections that users can expand/collapse
 */
export default function CollapsibleSection({
  title,
  meta,
  storageKey,
  defaultOpen = true,
  children,
}) {
  const [isOpen, setIsOpen] = useState(() => {
    const resolvedDefault = getDashboardSectionDefaultOpen(
      storageKey,
      defaultOpen,
    );
    if (!storageKey) return resolvedDefault;
    try {
      const stored = localStorage.getItem(storageKey);
      return stored !== null ? JSON.parse(stored) : resolvedDefault;
    } catch {
      return resolvedDefault;
    }
  });

  // Persist collapse state to localStorage
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(isOpen));
    }
  }, [isOpen, storageKey]);

  const toggleOpen = () => setIsOpen((prev) => !prev);

  return (
    <div className="space-y-4">
      {/* Collapsible Header */}
      <button
        onClick={toggleOpen}
        className="w-full flex items-center justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0f1a] rounded-lg p-2 -m-2"
        aria-expanded={isOpen}
        aria-controls={storageKey ? `${storageKey}-content` : undefined}
      >
        <div className="flex items-center gap-3">
          {/* Chevron Icon */}
          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-indigo-400 transition-transform duration-200" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors duration-200" />
          )}

          {/* Title */}
          <h2 className="text-xl font-semibold text-white group-hover:text-indigo-400 transition-colors duration-200">
            {title}
          </h2>
        </div>

        {/* Meta Badge (count, etc.) */}
        {meta && (
          <span className="text-sm text-slate-400 font-medium">{meta}</span>
        )}
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div
          id={storageKey ? `${storageKey}-content` : undefined}
          className="animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {children}
        </div>
      )}
    </div>
  );
}
