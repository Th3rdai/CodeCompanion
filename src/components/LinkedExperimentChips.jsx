import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { apiFetch } from "../lib/api-fetch";

const STATUS_DOT = {
  active: "bg-blue-400",
  completed: "bg-emerald-400",
  aborted: "bg-slate-400",
  failed: "bg-red-400",
  timeout: "bg-amber-400",
};

/**
 * Small chip-row that surfaces experiments spawned from the active chat
 * conversation. Backend stores `experimentIds` on the chat record (history.js);
 * this component fetches each experiment's hypothesis + status to render a
 * clickable chip. Clicking switches the user back into Experiment mode with
 * that specific run restored.
 *
 * Renders nothing when `ids` is empty — caller can mount unconditionally.
 */
export default function LinkedExperimentChips({ ids, onOpen }) {
  const [details, setDetails] = useState({}); // { id: { hypothesis, status } }

  useEffect(() => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = {};
      for (const id of ids) {
        try {
          const res = await apiFetch(
            `/api/experiment/${encodeURIComponent(id)}`,
          );
          if (!res.ok) continue;
          const data = await res.json();
          results[id] = {
            hypothesis: (data.hypothesis || "").slice(0, 200),
            status: data.status || "active",
          };
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setDetails(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  if (!Array.isArray(ids) || ids.length === 0) return null;

  return (
    <div
      className="shrink-0 flex flex-wrap items-center gap-1.5 px-4 py-1.5 border-b border-slate-700/40 bg-slate-900/30"
      aria-label="Linked experiments"
    >
      <span className="text-[10px] uppercase text-slate-500 mr-1">
        Linked experiments
      </span>
      {ids.map((id) => {
        const d = details[id];
        const label = d?.hypothesis
          ? d.hypothesis.length > 40
            ? d.hypothesis.slice(0, 40) + "…"
            : d.hypothesis
          : id.slice(0, 8);
        const dotCls = STATUS_DOT[d?.status] || "bg-slate-500";
        return (
          <button
            key={id}
            type="button"
            onClick={() => onOpen?.(id)}
            title={
              d
                ? `${d.hypothesis} (${d.status})`
                : `Experiment ${id} — click to open`
            }
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-xs text-indigo-200 hover:bg-indigo-500/20 transition-colors cursor-pointer"
          >
            <span
              aria-hidden="true"
              className={`inline-block w-1.5 h-1.5 rounded-full ${dotCls}`}
            />
            <FlaskConical className="w-3 h-3" />
            <span className="truncate max-w-[280px]">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
