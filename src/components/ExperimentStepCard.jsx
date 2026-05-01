import { useState } from "react";
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { DECISION_COLORS } from "./report-card-tokens";

function DecisionPill({ decision }) {
  if (!decision) return null;
  const cls =
    DECISION_COLORS[decision] ||
    "text-slate-300 bg-slate-500/15 border-slate-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide font-semibold ${cls}`}
    >
      {decision}
    </span>
  );
}

/**
 * Per-step card. Shows index + decision + timestamp in the header, the parsed
 * Did/Observed/Next rows in the body, and an expandable section for raw
 * summary, denials, and metric. The "Ask about this step" button transitions
 * the parent ExperimentPanel into deep-dive mode anchored on this step.
 */
export default function ExperimentStepCard({ step, index, onAskAbout }) {
  const [expanded, setExpanded] = useState(false);

  const hasStructured = Boolean(step.did || step.observed || step.next);
  const denialCount = Array.isArray(step.denials) ? step.denials.length : 0;
  const metricValue =
    step.metric && typeof step.metric.value === "number"
      ? step.metric.value
      : null;

  return (
    <article className="glass border border-slate-700/40 rounded-xl p-3 space-y-2">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-mono">
            Step {index + 1}
          </span>
          <DecisionPill decision={step.decision} />
          {step.done && (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 px-2 py-0.5 text-[10px] uppercase tracking-wide font-semibold">
              done
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          {metricValue !== null && (
            <span className="font-mono text-amber-200">
              metric: {metricValue}
            </span>
          )}
          {denialCount > 0 && (
            <span className="text-orange-300">
              {denialCount} denial{denialCount > 1 ? "s" : ""}
            </span>
          )}
          <time dateTime={step.at}>
            {step.at ? new Date(step.at).toLocaleTimeString() : ""}
          </time>
        </div>
      </header>

      {hasStructured ? (
        <dl className="text-xs space-y-1.5">
          {step.did && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-slate-500 w-16">Did</dt>
              <dd className="text-slate-200">{step.did}</dd>
            </div>
          )}
          {step.observed && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-slate-500 w-16">Observed</dt>
              <dd className="text-slate-200">{step.observed}</dd>
            </div>
          )}
          {step.next && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-slate-500 w-16">Next</dt>
              <dd className="text-slate-300">{step.next}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-xs text-slate-400 line-clamp-3 whitespace-pre-wrap">
          {(step.summary || "").slice(0, 280)}
          {step.summary && step.summary.length > 280 ? "…" : ""}
        </p>
      )}

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-slate-400 hover:text-slate-200 inline-flex items-center gap-1"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" /> Hide details
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" /> Show details
            </>
          )}
        </button>
        {onAskAbout && (
          <button
            type="button"
            onClick={() => onAskAbout(step, index)}
            className="text-[11px] text-indigo-300 hover:text-indigo-100 inline-flex items-center gap-1"
          >
            <MessageSquare className="w-3 h-3" /> Ask about this step…
          </button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-slate-700/40 pt-2 space-y-2 text-xs">
          {denialCount > 0 && (
            <div>
              <div className="text-[10px] uppercase text-slate-500 mb-1">
                Denials
              </div>
              <ul className="space-y-1">
                {step.denials.map((d, i) => (
                  <li
                    key={i}
                    className="text-slate-300 font-mono text-[11px] truncate"
                    title={d.reason}
                  >
                    {d.name && (
                      <span className="text-slate-500">[{d.name}] </span>
                    )}
                    {d.reason || "(no reason)"}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <div className="text-[10px] uppercase text-slate-500 mb-1">
              Raw summary
            </div>
            <pre className="bg-slate-900/60 border border-slate-700/40 rounded p-2 text-[11px] text-slate-300 whitespace-pre-wrap break-words max-h-64 overflow-y-auto scrollbar-thin">
              {step.summary || "(empty)"}
            </pre>
          </div>
        </div>
      )}
    </article>
  );
}
