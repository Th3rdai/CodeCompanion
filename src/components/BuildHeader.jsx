import { ArrowLeft, RefreshCw, LayoutDashboard, List } from 'lucide-react';

/**
 * BuildHeader — Status badge, progress bar, and Simple/Advanced view toggle
 * for the Build mode project dashboard.
 */
export default function BuildHeader({ projectName, progress, status, viewMode, onToggleViewMode, onRefresh, onBack }) {
  const percent = progress?.percent ?? 0;
  const done = progress?.total_summaries ?? 0;
  const total = progress?.total_plans ?? 0;

  // Derive status badge props
  let badgeLabel, badgeClasses;
  if (status === 'complete' || percent === 100) {
    badgeLabel = 'Complete';
    badgeClasses = 'bg-emerald-500/20 text-emerald-300';
  } else if (percent > 0) {
    badgeLabel = 'In Progress';
    badgeClasses = 'bg-amber-500/20 text-amber-300';
  } else {
    badgeLabel = 'Not Started';
    badgeClasses = 'bg-slate-500/20 text-slate-400';
  }

  return (
    <div className="space-y-3">
      {/* Top row: back, project name, badge, actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="text-slate-400 hover:text-indigo-300 transition-colors p-1 rounded-lg hover:bg-indigo-500/10 cursor-pointer"
            aria-label="Back to projects"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-lg font-bold text-slate-100 truncate">{projectName || 'Project'}</h2>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${badgeClasses}`}>
            {badgeLabel}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onRefresh}
            className="text-slate-400 hover:text-indigo-300 transition-colors p-1.5 rounded-lg hover:bg-indigo-500/10 cursor-pointer"
            aria-label="Refresh project data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="glass rounded-lg p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-400">{percent}% complete</span>
          <span className="text-xs text-indigo-300 font-medium">{done}/{total} plans</span>
        </div>
        <div className="w-full bg-slate-700/50 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 h-2 rounded-full transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Simple / Advanced toggle */}
      <div className="flex items-center gap-1 glass rounded-lg p-1 w-fit">
        <button
          onClick={() => onToggleViewMode('simple')}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
            viewMode === 'simple'
              ? 'bg-indigo-500/30 text-indigo-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Simple
        </button>
        <button
          onClick={() => onToggleViewMode('advanced')}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
            viewMode === 'advanced'
              ? 'bg-indigo-500/30 text-indigo-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <List className="w-3.5 h-3.5" />
          Advanced
        </button>
      </div>
    </div>
  );
}
