/**
 * Preflight Context Banner — Phase 1 (CTXFIX.md)
 *
 * Displays a warning when approaching context window limits (80% threshold).
 * Shows estimated tokens used vs total context length with "New thread" action.
 *
 * @param {boolean} visible - Whether to show the banner
 * @param {number} estimatedTokens - Estimated tokens in current conversation
 * @param {number} contextLength - Model's context window size
 * @param {Function} onNewThread - Callback when "New thread" button clicked
 */
export default function PreflightBanner({
  visible,
  estimatedTokens,
  contextLength,
  onNewThread,
}) {
  if (!visible || !contextLength || contextLength <= 0) return null;

  // Format token counts as "~XK" (e.g., ~12K, ~128K)
  const formatTokens = (tokens) => {
    if (!tokens || tokens <= 0) return "0K";
    const k = Math.round(tokens / 1000);
    return `~${k}K`;
  };

  const estK = formatTokens(estimatedTokens);
  const ctxK = formatTokens(contextLength);
  const percentage = Math.round((estimatedTokens / contextLength) * 100);

  return (
    <div
      data-testid="preflight-banner"
      className="shrink-0 border-b border-amber-500/25 bg-gradient-to-b from-amber-950/35 to-slate-900/85 backdrop-blur-md"
      role="alert"
      aria-live="polite"
      aria-label={`Approaching context limit. ${estimatedTokens} of ${contextLength} tokens used.`}
    >
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Warning indicator */}
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-35 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400 motion-reduce:ring-2 motion-reduce:ring-amber-300/60" />
          </span>

          {/* Warning message */}
          <div className="min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-1.5">
            <span className="text-xs font-semibold tracking-wide text-amber-100 whitespace-nowrap">
              Approaching limit:
            </span>
            <span className="text-[11px] text-slate-300 sm:text-xs truncate">
              {estK} of {ctxK} tokens used ({percentage}%)
            </span>
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={onNewThread}
          className="shrink-0 rounded-md bg-amber-600/20 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-600/30 hover:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 active:bg-amber-600/40"
          aria-label="Start a new thread to clear context"
        >
          New thread
        </button>
      </div>

      {/* Progress bar showing usage percentage */}
      <div
        className="relative h-0.5 overflow-hidden bg-slate-800/50"
        aria-hidden
      >
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
