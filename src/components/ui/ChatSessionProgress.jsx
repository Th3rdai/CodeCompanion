/**
 * High-visibility “agent is working” strip for active SSE / chat turns.
 * Sits under the mode tab bar (main app) or at the top of a panel (builders).
 *
 * @param {string} [detail] — Full subtitle line; overrides `modeLabel` when set.
 * @param {string} [headline] — Bold word before detail (default: Working).
 * @param {boolean} [busy] — When false: no pulse, static bar, aria-busy=false (e.g. between experiment steps).
 */
export default function ChatSessionProgress({
  active,
  modeLabel = "",
  detail: detailProp,
  headline = "Working",
  busy = true,
  testId = "chat-session-progress",
}) {
  if (!active) return null;

  const detail =
    detailProp ??
    (modeLabel
      ? `${modeLabel} — generating a response`
      : "Generating a response");

  const ariaLabel = `${headline}. ${detail}`;

  return (
    <div
      data-testid={testId}
      className="shrink-0 border-b border-indigo-500/25 bg-gradient-to-b from-indigo-950/35 to-slate-900/85 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy={busy}
      aria-label={ariaLabel}
    >
      <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
          {busy ? (
            <>
              <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-35 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400 motion-reduce:ring-2 motion-reduce:ring-indigo-300/60" />
            </>
          ) : (
            <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-400" />
          )}
        </span>
        <span className="text-xs font-semibold tracking-wide text-indigo-100">
          {headline}
        </span>
        <span className="min-w-0 truncate text-[11px] text-slate-400 sm:text-xs">
          {detail}
        </span>
      </div>
      <div className="cc-chat-progress-track relative" aria-hidden>
        {busy ? (
          <div className="cc-chat-progress-segment" />
        ) : (
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[42%] max-w-[220px] -translate-x-1/2 rounded-full bg-indigo-500/45" />
        )}
      </div>
    </div>
  );
}
