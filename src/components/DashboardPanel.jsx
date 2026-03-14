import { useMemo, useState } from 'react';

const WIDGETS = [
  { id: 'performance', label: 'Live system performance' },
  { id: 'totals', label: 'Summary totals' },
  { id: 'modes', label: 'Mode breakdown' },
  { id: 'models', label: 'Model family breakdown' },
  { id: 'activity', label: '7-day activity' }
];

function toEntries(obj) {
  return Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
}

function BarList({ items }) {
  const max = Math.max(...items.map(([, count]) => count), 1);
  return (
    <div className="space-y-2">
      {items.map(([label, count]) => (
        <div key={label} className="space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="truncate">{label}</span>
            <span>{count}</span>
          </div>
          <div className="h-2 rounded bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-indigo-500/80"
              style={{ width: `${Math.max((count / max) * 100, 4)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPanel({
  analytics,
  systemMetrics,
  systemMetricsLoading,
  onRefresh,
  onExport,
  modes
}) {
  const [visibleWidgets, setVisibleWidgets] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('cc-dashboard-widgets') || '[]');
      if (Array.isArray(saved) && saved.length > 0) return saved;
    } catch {}
    return WIDGETS.map(widget => widget.id);
  });

  function toggleWidget(id) {
    setVisibleWidgets(prev => {
      const next = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
      localStorage.setItem('cc-dashboard-widgets', JSON.stringify(next));
      return next;
    });
  }

  const modeCounts = useMemo(() => {
    const entries = toEntries(analytics?.modeCounts || {});
    return entries.map(([modeId, count]) => {
      const label = modes?.find(m => m.id === modeId)?.label || modeId;
      return [label, count];
    });
  }, [analytics, modes]);

  const modelCounts = useMemo(() => toEntries(analytics?.modelCounts || {}), [analytics]);
  const activityRows = useMemo(() => Object.entries(analytics?.dailyActivity || {}), [analytics]);

  return (
    <section className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-4" aria-label="Dashboard and reports">
      <div className="glass rounded-xl border border-slate-700/30 p-4">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Dashboard and Reports</h2>
            <p className="text-xs text-slate-400 mt-1">
              Pick the widgets you want to see and export reports whenever you need them.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onRefresh} className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/40">
              Refresh
            </button>
            <button onClick={() => onExport('md')} className="text-xs px-2.5 py-1.5 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/10">
              Export MD
            </button>
            <button onClick={() => onExport('json')} className="text-xs px-2.5 py-1.5 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/10">
              Export JSON
            </button>
            <button onClick={() => onExport('csv')} className="text-xs px-2.5 py-1.5 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/10">
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {visibleWidgets.includes('performance') && (
        <div className="glass rounded-xl border border-slate-700/30 p-4">
          <h3 className="text-sm font-medium text-slate-200 mb-3">Live system performance</h3>
          {systemMetricsLoading ? (
            <p className="text-xs text-slate-500">Loading real-time metrics...</p>
          ) : !systemMetrics ? (
            <p className="text-xs text-slate-500">Performance metrics aren't available just yet — check back soon!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-700/40 p-3">
                <div className="text-[11px] text-slate-500">CPU Usage</div>
                <div className="text-xl font-semibold text-indigo-300">{systemMetrics.cpu?.usagePercent ?? 0}%</div>
                <div className="text-[11px] text-slate-500 mt-1">Uptime: {systemMetrics.uptimeSec ?? 0}s</div>
              </div>
              <div className="rounded-lg border border-slate-700/40 p-3">
                <div className="text-[11px] text-slate-500">Memory (RSS / Heap)</div>
                <div className="text-xl font-semibold text-slate-100">
                  {(systemMetrics.memory?.rssMb ?? 0).toFixed(1)} / {(systemMetrics.memory?.heapUsedMb ?? 0).toFixed(1)} MB
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Heap total: {(systemMetrics.memory?.heapTotalMb ?? 0).toFixed(1)} MB
                </div>
              </div>
              <div className="rounded-lg border border-slate-700/40 p-3">
                <div className="text-[11px] text-slate-500">Network Throughput (1m)</div>
                <div className="text-sm text-slate-200 mt-1">
                  In: <span className="text-indigo-300">{(systemMetrics.network?.inboundKbps1m ?? 0).toFixed(2)} kbps</span>
                </div>
                <div className="text-sm text-slate-200">
                  Out: <span className="text-indigo-300">{(systemMetrics.network?.outboundKbps1m ?? 0).toFixed(2)} kbps</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Req/min: {systemMetrics.requests?.perMinute ?? 0} | Avg latency: {systemMetrics.requests?.avgLatencyMs ?? 0} ms
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="glass rounded-xl border border-slate-700/30 p-4">
        <h3 className="text-sm font-medium text-slate-200 mb-3">Widget visibility</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {WIDGETS.map(widget => (
            <label key={widget.id} className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={visibleWidgets.includes(widget.id)}
                onChange={() => toggleWidget(widget.id)}
              />
              <span>{widget.label}</span>
            </label>
          ))}
        </div>
      </div>

      {visibleWidgets.includes('totals') && (
        <div className="glass rounded-xl border border-slate-700/30 p-4">
          <h3 className="text-sm font-medium text-slate-200 mb-3">Summary totals</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-700/40 p-3">
              <div className="text-[11px] text-slate-500">Conversations</div>
              <div className="text-xl font-semibold text-slate-100">{analytics?.totals?.conversations ?? 0}</div>
            </div>
            <div className="rounded-lg border border-slate-700/40 p-3">
              <div className="text-[11px] text-slate-500">Active</div>
              <div className="text-xl font-semibold text-indigo-300">{analytics?.totals?.active ?? 0}</div>
            </div>
            <div className="rounded-lg border border-slate-700/40 p-3">
              <div className="text-[11px] text-slate-500">Archived</div>
              <div className="text-xl font-semibold text-slate-300">{analytics?.totals?.archived ?? 0}</div>
            </div>
            <div className="rounded-lg border border-slate-700/40 p-3">
              <div className="text-[11px] text-slate-500">Loaded Messages</div>
              <div className="text-xl font-semibold text-slate-100">{analytics?.totals?.messages ?? 0}</div>
            </div>
          </div>
        </div>
      )}

      {visibleWidgets.includes('modes') && (
        <div className="glass rounded-xl border border-slate-700/30 p-4">
          <h3 className="text-sm font-medium text-slate-200 mb-3">Mode breakdown</h3>
          {modeCounts.length === 0 ? <p className="text-xs text-slate-500">No conversations yet — start chatting and this will fill up!</p> : <BarList items={modeCounts} />}
        </div>
      )}

      {visibleWidgets.includes('models') && (
        <div className="glass rounded-xl border border-slate-700/30 p-4">
          <h3 className="text-sm font-medium text-slate-200 mb-3">Model family breakdown</h3>
          {modelCounts.length === 0 ? <p className="text-xs text-slate-500">No model data yet — try a few different models and see what shows up!</p> : <BarList items={modelCounts} />}
        </div>
      )}

      {visibleWidgets.includes('activity') && (
        <div className="glass rounded-xl border border-slate-700/30 p-4">
          <h3 className="text-sm font-medium text-slate-200 mb-3">7-day activity</h3>
          {activityRows.length === 0 ? (
            <p className="text-xs text-slate-500">No activity in the last 7 days — let's change that!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-700/40">
                    <th className="py-2 pr-2 font-medium">Date</th>
                    <th className="py-2 pr-2 font-medium">Conversations Created</th>
                  </tr>
                </thead>
                <tbody>
                  {activityRows.map(([date, count]) => (
                    <tr key={date} className="border-b border-slate-800/50 text-slate-300">
                      <td className="py-2 pr-2">{date}</td>
                      <td className="py-2 pr-2">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
