/**
 * High-visibility “agent is working” strip for active SSE / chat turns.
 * Sits under the mode tab bar (main app) or at the top of a panel (builders).
 *
 * @param {string} [detail] — Full subtitle line; overrides `modeLabel` when set.
 */
export default function ChatSessionProgress({
  active,
  modeLabel = "",
  detail: detailProp,
  testId = "chat-session-progress",
}) {
  if (!active) return null;

  const detail =
    detailProp ??
    (modeLabel
      ? `${modeLabel} — generating a response`
      : "Generating a response");

  return (
    <div
      data-testid={testId}
      className="shrink-0 border-b border-indigo-500/25 bg-gradient-to-b from-indigo-950/35 to-slate-900/85 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={`Assistant is working. ${detail}`}
    >
      <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-35 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400 motion-reduce:ring-2 motion-reduce:ring-indigo-300/60" />
        </span>
        <span className="text-xs font-semibold tracking-wide text-indigo-100">
          Working
        </span>
        <span className="min-w-0 truncate text-[11px] text-slate-400 sm:text-xs">
          {detail}
        </span>
      </div>
      <div className="cc-chat-progress-track" aria-hidden>
        <div className="cc-chat-progress-segment" />
      </div>
    </div>
  );
}
