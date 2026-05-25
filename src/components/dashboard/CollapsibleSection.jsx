import { useCallback, useId, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Read a persisted open/closed flag from localStorage.
 * Returns `fallback` when there's no stored value or storage is unavailable
 * (private mode, quota, SSR). "1" = open, "0" = closed.
 */
function readPersisted(key, fallback) {
  if (!key || typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

/**
 * CollapsibleSection — a dashboard section that can be expanded/collapsed.
 *
 * Follows the WAI-ARIA accordion pattern: the title is a real heading whose
 * content is a toggle button (so `getByRole("heading", …)` and screen-reader
 * navigation keep working), wired to its content region via aria-controls /
 * aria-expanded. Collapsed content is `inert` so it leaves the tab order and
 * a11y tree.
 *
 * The body animates open/closed via a grid-template-rows 0fr↔1fr transition
 * (cheap, no JS height measuring). Overflow is only clipped while animating or
 * collapsed, so card hover-lift/glow isn't cropped at rest. Honors
 * prefers-reduced-motion. Open state optionally persists per `storageKey`.
 */
export default function CollapsibleSection({
  title,
  meta,
  storageKey,
  defaultOpen = true,
  children,
}) {
  const [open, setOpen] = useState(() =>
    readPersisted(storageKey, defaultOpen),
  );
  // While the height transition runs we must clip overflow; once settled open
  // we let it be visible so children's hover-lift/glow shadows aren't cropped.
  const [animating, setAnimating] = useState(false);
  const contentId = useId();

  const toggle = useCallback(() => {
    setAnimating(true);
    setOpen((prev) => {
      const next = !prev;
      if (storageKey && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(storageKey, next ? "1" : "0");
        } catch {
          /* ignore storage failures (private mode / quota) */
        }
      }
      return next;
    });
  }, [storageKey]);

  const clip = !open || animating;

  return (
    <section>
      <h2 className="m-0">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={contentId}
          className="group flex w-full items-center justify-between gap-3 -mx-2 px-2 py-1 rounded-lg cursor-pointer text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0f1a]"
        >
          <span className="flex items-center gap-2 min-w-0">
            <ChevronDown
              aria-hidden="true"
              className={`w-5 h-5 shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none ${
                open ? "" : "-rotate-90"
              }`}
            />
            <span className="text-xl font-semibold text-white truncate">
              {title}
            </span>
          </span>
          {meta != null && (
            <span className="text-sm font-normal text-slate-400 shrink-0">
              {meta}
            </span>
          )}
        </button>
      </h2>

      <div
        id={contentId}
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
        onTransitionEnd={(e) => {
          // Only react to our own grid-rows transition, not bubbled child ones.
          if (e.target === e.currentTarget) setAnimating(false);
        }}
      >
        <div className={clip ? "overflow-hidden" : ""}>
          <div className="pt-4" inert={!open ? true : undefined}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
