import { useMemo, useState } from "react";
import { ArrowLeft, AlertTriangle, ShieldCheck } from "lucide-react";
import ExperimentStepCard from "./ExperimentStepCard";
import { STATUS_COLORS } from "./report-card-tokens";

function StatusBadge({ status }) {
  const cls =
    STATUS_COLORS[status] ||
    "text-slate-300 bg-slate-500/15 border-slate-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-wide font-semibold ${cls}`}
    >
      {status || "active"}
    </span>
  );
}

function metricMet({ metric, finalValue }) {
  if (!metric || finalValue === null || finalValue === undefined) return null;
  if (metric.target === null || metric.target === undefined) return null;
  switch (metric.comparison) {
    case "<":
      return finalValue < metric.target;
    case "<=":
      return finalValue <= metric.target;
    case ">":
      return finalValue > metric.target;
    case ">=":
      return finalValue >= metric.target;
    case "==":
      return finalValue === metric.target;
    default:
      return null;
  }
}

function Sparkline({ values }) {
  if (!values || values.length < 2) return null;
  const w = 220;
  const h = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = w / (values.length - 1);
  const points = values
    .map(
      (v, i) =>
        `${(i * stepX).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      role="img"
      aria-label="Metric trajectory"
      className="text-amber-300"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/**
 * Graded report-card view for an experiment record.
 * Sections (top → bottom):
 *   - Header (hypothesis + status badge + scope chips + repro note)
 *   - Final metric callout (when present)
 *   - Sparkline (when ≥2 numeric measurements)
 *   - Scope-adherence row (paths-OK + commands-OK badges)
 *   - Denials block (count, expandable list)
 *   - Step timeline (3 most-recent visible by default; "Show all N" toggle)
 */
export default function ExperimentReport({
  experiment,
  onNewExperiment,
  onAskAboutStep,
  onAskAboutOutcome,
  onBackToInput,
}) {
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [denialsOpen, setDenialsOpen] = useState(false);

  const steps = useMemo(() => experiment?.steps || [], [experiment?.steps]);
  const visibleSteps = showAllSteps ? steps : steps.slice(-3);
  const hasMoreSteps = steps.length > visibleSteps.length;

  const denialList = useMemo(
    () =>
      steps.flatMap((s, i) =>
        (s.denials || []).map((d) => ({ ...d, stepIndex: i })),
      ),
    [steps],
  );

  const metricValues = useMemo(
    () =>
      steps
        .map((s) =>
          s.metric && typeof s.metric.value === "number"
            ? s.metric.value
            : null,
        )
        .filter((v) => v !== null),
    [steps],
  );

  const isMet = metricMet({
    metric: experiment?.metric,
    finalValue: experiment?.finalMetricValue,
  });

  const scopePaths = experiment?.scope?.paths || [];
  const scopeCommands = experiment?.scope?.commands || [];

  return (
    <section
      className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
      aria-label="Experiment report"
    >
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="flex flex-wrap items-start gap-3 justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={experiment?.status} />
              {experiment?.reproducibility?.note && (
                <span
                  className="text-[10px] text-slate-500 truncate max-w-[260px]"
                  title={experiment.reproducibility.note}
                >
                  repro: {experiment.reproducibility.note}
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-slate-100 break-words">
              {experiment?.hypothesis || "(no hypothesis)"}
            </h2>
            <div className="text-[11px] text-slate-500 mt-1">
              {experiment?.createdAt &&
                new Date(experiment.createdAt).toLocaleString()}
              {experiment?.endedAt &&
                ` · ended ${new Date(experiment.endedAt).toLocaleTimeString()}`}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {onBackToInput && (
              <button
                type="button"
                onClick={onBackToInput}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-700/40 inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={onNewExperiment}
              className="rounded-lg px-3 py-1.5 text-xs border border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              New experiment
            </button>
          </div>
        </header>

        {experiment?.metric && (
          <div
            className={`glass rounded-xl p-3 border ${
              isMet === true
                ? "border-emerald-500/40 bg-emerald-500/5"
                : isMet === false
                  ? "border-red-500/40 bg-red-500/5"
                  : "border-slate-700/40"
            }`}
          >
            <div className="text-[10px] uppercase text-slate-500 mb-1">
              Success metric
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-mono text-slate-200">
                {experiment.metric.name}
              </span>
              <span className="text-[11px] text-slate-500">
                target {experiment.metric.comparison}{" "}
                {experiment.metric.target ?? "—"}
                {experiment.metric.unit ? ` ${experiment.metric.unit}` : ""}
              </span>
              <span className="ml-auto text-lg font-mono font-semibold">
                {experiment.finalMetricValue ?? "—"}
                {experiment.metric.unit ? (
                  <span className="text-xs text-slate-500 ml-1">
                    {experiment.metric.unit}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="mt-2">
              {metricValues.length >= 2 ? (
                <Sparkline values={metricValues} />
              ) : (
                <div className="text-[10px] text-slate-500">
                  Trajectory will appear after 2 measurements.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="glass border border-slate-700/40 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase text-slate-500">
                Scope · paths
              </span>
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
            </div>
            <ul className="space-y-1">
              {scopePaths.length === 0 && (
                <li className="text-[11px] text-slate-500 italic">none</li>
              )}
              {scopePaths.map((p) => (
                <li
                  key={p}
                  className="font-mono text-[11px] text-slate-300 truncate"
                  title={p}
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass border border-slate-700/40 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase text-slate-500">
                Scope · commands
              </span>
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="flex flex-wrap gap-1">
              {scopeCommands.length === 0 && (
                <span className="text-[11px] text-slate-500 italic">none</span>
              )}
              {scopeCommands.map((c) => (
                <span
                  key={c}
                  className="rounded bg-slate-800/60 border border-slate-700/40 px-1.5 py-0.5 font-mono text-[11px] text-slate-300"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>

        {(experiment?.denials || 0) > 0 && (
          <div className="glass border border-orange-500/30 bg-orange-500/5 rounded-xl p-3 text-xs">
            <button
              type="button"
              onClick={() => setDenialsOpen((v) => !v)}
              className="flex items-center gap-2 w-full text-left"
            >
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className="text-orange-200 font-semibold">
                {experiment.denials} tool denial
                {experiment.denials > 1 ? "s" : ""}
              </span>
              <span className="text-[10px] text-orange-300/70 ml-auto">
                {denialsOpen ? "Hide" : "Show"}
              </span>
            </button>
            {denialsOpen && (
              <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                {denialList.map((d, i) => (
                  <li
                    key={i}
                    className="text-[11px] text-orange-100/80 font-mono truncate"
                    title={d.reason}
                  >
                    <span className="text-orange-300/60">
                      step {d.stepIndex + 1}:
                    </span>{" "}
                    {d.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase text-slate-500">
              Steps ({steps.length})
            </h3>
            {hasMoreSteps && (
              <button
                type="button"
                onClick={() => setShowAllSteps(true)}
                className="text-[11px] text-indigo-300 hover:text-indigo-100"
              >
                Show all {steps.length} steps
              </button>
            )}
            {showAllSteps && steps.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllSteps(false)}
                className="text-[11px] text-slate-400 hover:text-slate-200"
              >
                Show only recent
              </button>
            )}
          </div>
          {steps.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No steps recorded.</p>
          ) : (
            <div className="space-y-2">
              {visibleSteps.map((step, vi) => {
                const realIndex =
                  showAllSteps || steps.length <= 3
                    ? vi
                    : steps.length - visibleSteps.length + vi;
                return (
                  <ExperimentStepCard
                    key={realIndex}
                    step={step}
                    index={realIndex}
                    onAskAbout={onAskAboutStep}
                  />
                );
              })}
            </div>
          )}
        </div>

        {onAskAboutOutcome && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onAskAboutOutcome}
              className="rounded-lg px-3 py-1.5 text-xs border border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/10"
            >
              Ask about the outcome…
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
