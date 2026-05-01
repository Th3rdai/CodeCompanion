import { useState, useEffect, useRef } from "react";
import { X, Plus } from "lucide-react";

const COMPARISONS = [
  { value: "<=", label: "≤" },
  { value: "<", label: "<" },
  { value: "==", label: "=" },
  { value: ">=", label: "≥" },
  { value: ">", label: ">" },
];

/**
 * Structured form for starting an experiment. Returns input via onStart(payload):
 *   { hypothesis, maxRounds, budgetSec, scope: {paths, commands}, metric, reproducibility }
 *
 * Cmd/Ctrl+Enter from inside the hypothesis textarea triggers Start (skips
 * having to click).
 */
export default function ExperimentInputForm({
  status,
  connected,
  selectedModel,
  projectFolder,
  defaultCommandAllowlist,
  starting,
  errorBanner,
  existingRunId,
  onStart,
  onResumeExisting,
  onDismissError,
}) {
  const [hypothesis, setHypothesis] = useState("");
  const [budgetRounds, setBudgetRounds] = useState(8);
  const [budgetSec, setBudgetSec] = useState(900);
  const [scopePaths, setScopePaths] = useState(() =>
    projectFolder ? [projectFolder] : [],
  );
  const [scopeCommands, setScopeCommands] = useState(
    () => defaultCommandAllowlist || [],
  );
  const [pathInput, setPathInput] = useState("");
  const [commandInput, setCommandInput] = useState("");
  const [metricEnabled, setMetricEnabled] = useState(false);
  const [metricName, setMetricName] = useState("");
  const [metricTarget, setMetricTarget] = useState("");
  const [metricComparison, setMetricComparison] = useState("<=");
  const [metricUnit, setMetricUnit] = useState("");
  const [reproNote, setReproNote] = useState("");

  const hypothesisRef = useRef(null);

  useEffect(() => {
    if (projectFolder && scopePaths.length === 0) {
      setScopePaths([projectFolder]);
    }
  }, [projectFolder, scopePaths.length]);

  useEffect(() => {
    const cap = Math.min(Math.max(parseInt(status?.maxRounds, 10) || 8, 1), 25);
    setBudgetRounds(cap);
    const dur = Math.min(
      Math.max(parseInt(status?.maxDurationSec, 10) || 900, 60),
      7200,
    );
    setBudgetSec(dur);
  }, [status?.maxRounds, status?.maxDurationSec]);

  function addPath() {
    const p = pathInput.trim();
    if (!p) return;
    if (!scopePaths.includes(p)) setScopePaths([...scopePaths, p]);
    setPathInput("");
  }
  function removePath(p) {
    setScopePaths(scopePaths.filter((x) => x !== p));
  }
  function addCommand() {
    const c = commandInput.trim();
    if (!c) return;
    if (!scopeCommands.includes(c)) setScopeCommands([...scopeCommands, c]);
    setCommandInput("");
  }
  function removeCommand(c) {
    setScopeCommands(scopeCommands.filter((x) => x !== c));
  }

  function buildPayload() {
    let metric = null;
    if (metricEnabled && metricName.trim()) {
      const tgtRaw = metricTarget.trim();
      const tgtNum = tgtRaw === "" ? null : Number(tgtRaw);
      metric = {
        name: metricName.trim(),
        target: Number.isFinite(tgtNum) ? tgtNum : null,
        comparison: metricComparison,
        unit: metricUnit.trim() || null,
      };
    }
    return {
      hypothesis: hypothesis.trim(),
      maxRounds: budgetRounds,
      budgetSec,
      scope: {
        paths: scopePaths,
        commands: scopeCommands,
      },
      metric,
      reproducibility: reproNote.trim() ? { note: reproNote.trim() } : null,
    };
  }

  function handleSubmit() {
    if (!status?.enabled) return;
    if (!hypothesis.trim()) return;
    if (!connected || !selectedModel || starting) return;
    onStart?.(buildPayload());
  }

  if (!status?.enabled) {
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-8 max-w-2xl mx-auto text-center">
        <div className="text-4xl mb-3">🧪</div>
        <h2 className="text-lg font-semibold text-slate-200 mb-2">
          Experiment mode is off
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          Enable <strong className="text-slate-300">Experiment mode</strong> in{" "}
          <strong className="text-slate-300">Settings → General</strong> to run
          bounded hypothesis → change → measure loops with a restricted tool set
          and saved run history.
        </p>
      </div>
    );
  }

  return (
    <section
      className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
      aria-label="Experiment input form"
    >
      <div className="max-w-3xl mx-auto space-y-5">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-100">
            New Experiment
          </h2>
          <p className="text-xs text-slate-500">
            Describe a hypothesis, set scope and an optional success metric,
            then run small bounded steps until the metric is met or the budget
            is exhausted.
          </p>
        </header>

        {errorBanner && (
          <div
            className="glass border border-amber-500/40 bg-amber-500/10 rounded-lg px-3 py-2 text-xs text-amber-200 flex items-start gap-2"
            role="alert"
          >
            <div className="flex-1">
              <div className="font-semibold">{errorBanner.title}</div>
              <div className="text-amber-200/80">{errorBanner.message}</div>
              {existingRunId && (
                <button
                  type="button"
                  onClick={onResumeExisting}
                  className="mt-2 underline hover:text-amber-100"
                >
                  Resume the active run →
                </button>
              )}
            </div>
            {onDismissError && (
              <button
                type="button"
                onClick={onDismissError}
                className="text-amber-300 hover:text-amber-100"
                aria-label="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label
            htmlFor="exp-hypothesis"
            className="block text-xs text-slate-400"
          >
            Hypothesis{" "}
            <span className="text-[10px] text-slate-600">
              (⌘/Ctrl + Enter to start)
            </span>
          </label>
          <textarea
            id="exp-hypothesis"
            ref={hypothesisRef}
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                (e.metaKey || e.ctrlKey) &&
                hypothesis.trim()
              ) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            rows={3}
            placeholder="e.g. TradingAgents tests fail because deps aren't installed; uv pip install -e . will get collection errors to 0."
            className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 text-sm outline-none resize-y min-h-[72px]"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={metricEnabled}
              onChange={(e) => setMetricEnabled(e.target.checked)}
              className="accent-indigo-500"
            />
            Track a numeric success metric
          </label>
          {metricEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_120px_120px] gap-2">
              <input
                value={metricName}
                onChange={(e) => setMetricName(e.target.value)}
                placeholder="metric name (e.g. test_failures)"
                className="input-glow text-slate-100 rounded-lg px-3 py-2 text-sm outline-none"
              />
              <select
                value={metricComparison}
                onChange={(e) => setMetricComparison(e.target.value)}
                className="input-glow text-slate-100 rounded-lg px-3 py-2 text-sm outline-none"
              >
                {COMPARISONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                value={metricTarget}
                onChange={(e) => setMetricTarget(e.target.value)}
                placeholder="target"
                inputMode="decimal"
                className="input-glow text-slate-100 rounded-lg px-3 py-2 text-sm outline-none"
              />
              <input
                value={metricUnit}
                onChange={(e) => setMetricUnit(e.target.value)}
                placeholder="unit (opt)"
                className="input-glow text-slate-100 rounded-lg px-3 py-2 text-sm outline-none"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-xs text-slate-400">
            Scope —{" "}
            <span className="text-[11px] text-slate-500">
              server-enforced; the agent cannot write outside these paths or run
              binaries outside this list
            </span>
          </div>
          <div className="space-y-2">
            <label className="block text-[11px] text-slate-500">Paths</label>
            <div className="flex flex-wrap items-center gap-2">
              {scopePaths.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-xs text-indigo-200 font-mono max-w-[280px] truncate"
                  title={p}
                >
                  <span className="truncate">{p}</span>
                  <button
                    type="button"
                    onClick={() => removePath(p)}
                    aria-label={`Remove ${p}`}
                    className="text-indigo-300 hover:text-indigo-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPath();
                  }
                }}
                placeholder="/absolute/path…"
                className="input-glow text-slate-100 rounded-lg px-2 py-1 text-xs outline-none flex-1 min-w-[180px] font-mono"
              />
              <button
                type="button"
                onClick={addPath}
                className="rounded-lg px-2 py-1 text-xs border border-slate-600 text-slate-300 hover:bg-slate-800 inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Path
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-[11px] text-slate-500">Commands</label>
            <div className="flex flex-wrap items-center gap-2">
              {scopeCommands.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs text-emerald-200 font-mono"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => removeCommand(c)}
                    aria-label={`Remove ${c}`}
                    className="text-emerald-300 hover:text-emerald-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCommand();
                  }
                }}
                placeholder="binary name (e.g. python3)"
                className="input-glow text-slate-100 rounded-lg px-2 py-1 text-xs outline-none flex-1 min-w-[140px] font-mono"
              />
              <button
                type="button"
                onClick={addCommand}
                className="rounded-lg px-2 py-1 text-xs border border-slate-600 text-slate-300 hover:bg-slate-800 inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Command
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="exp-rounds"
              className="block text-xs text-slate-400 mb-1"
            >
              Tool rounds per step ({budgetRounds})
            </label>
            <input
              id="exp-rounds"
              type="range"
              min={1}
              max={Math.min(status?.maxRounds || 25, 25)}
              value={budgetRounds}
              onChange={(e) =>
                setBudgetRounds(parseInt(e.target.value, 10) || 1)
              }
              className="w-full accent-indigo-500"
            />
          </div>
          <div>
            <label
              htmlFor="exp-budget-sec"
              className="block text-xs text-slate-400 mb-1"
            >
              Budget in seconds ({budgetSec}s)
            </label>
            <input
              id="exp-budget-sec"
              type="range"
              min={60}
              max={Math.min(status?.maxDurationSec || 900, 7200)}
              step={30}
              value={budgetSec}
              onChange={(e) => setBudgetSec(parseInt(e.target.value, 10) || 60)}
              className="w-full accent-indigo-500"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="exp-repro" className="block text-xs text-slate-400">
            Reproducibility note (optional)
          </label>
          <input
            id="exp-repro"
            value={reproNote}
            onChange={(e) => setReproNote(e.target.value)}
            placeholder="e.g. uses Python 3.12 from .python-version; numpy pin pending"
            className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 text-xs outline-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              !connected || !selectedModel || starting || !hypothesis.trim()
            }
            className="btn-neon text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {starting ? "Starting…" : "Start experiment"}
          </button>
        </div>
      </div>
    </section>
  );
}
