import { useState, useEffect, useCallback } from 'react';
import MarkdownContent from './MarkdownContent';

/**
 * BuildPanel — Multi-view dashboard for Build mode projects.
 * Views: project list → project dashboard → phase detail
 */
export default function BuildPanel({ projects, activeProject, onSelectProject, onNewProject, onViewFiles, onRefresh, onToast }) {
  const [view, setView] = useState(activeProject ? 'dashboard' : 'list');
  const [projectData, setProjectData] = useState(null); // roadmap + progress
  const [phaseDetail, setPhaseDetail] = useState(null);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // When activeProject changes, load its data
  useEffect(() => {
    if (activeProject) {
      setView('dashboard');
      loadProjectData(activeProject);
    } else {
      setView('list');
      setProjectData(null);
    }
  }, [activeProject]);

  // Auto-refresh polling (every 10s when enabled)
  useEffect(() => {
    if (!autoRefresh || !activeProject) return;
    const interval = setInterval(() => loadProjectData(activeProject), 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, activeProject]);

  async function loadProjectData(projectId) {
    try {
      const [roadmapRes, progressRes] = await Promise.all([
        fetch(`/api/build/projects/${projectId}/roadmap`),
        fetch(`/api/build/projects/${projectId}/progress`),
      ]);
      const roadmap = await roadmapRes.json();
      const progress = await progressRes.json();
      setProjectData({ roadmap, progress });
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load project data');
    }
  }

  async function loadPhaseDetail(projectId, phaseNum) {
    setLoading(true);
    try {
      const res = await fetch(`/api/build/projects/${projectId}/phase/${phaseNum}`);
      const data = await res.json();
      setPhaseDetail(data);
      setSelectedPhase(phaseNum);
      setView('phase');
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load phase');
    }
    setLoading(false);
  }

  async function handleRemoveProject(id) {
    try {
      await fetch(`/api/build/projects/${id}`, { method: 'DELETE' });
      onRefresh?.();
      onToast?.('Project removed from list');
    } catch {}
  }

  function copyCommand(cmd) {
    navigator.clipboard.writeText(cmd);
    onToast?.('Command copied to clipboard');
  }

  // ── View: Project List ──────────────────────────────
  if (projects === null) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-2 text-slate-400">
          <span className="inline-block spin">&#x27F3;</span>
          <span className="text-sm">Loading projects...</span>
        </div>
      </div>
    );
  }

  if (view === 'list' || !activeProject) {
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-100">Build Projects</h2>
          <button onClick={onNewProject} className="btn-neon text-sm px-4 py-2 rounded-lg font-medium">
            + New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center space-y-3">
            <p className="text-3xl">🏗️</p>
            <p className="text-sm text-slate-300">No build projects yet</p>
            <p className="text-xs text-slate-500">Create your first project to get started with GSD + ICM workflows</p>
            <button onClick={onNewProject} className="btn-neon text-sm px-6 py-2.5 rounded-lg font-medium mt-2">
              Create First Project
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map(p => (
              <div key={p.id}
                className={`glass rounded-xl p-4 cursor-pointer transition-all hover:border-indigo-500/30 border border-transparent ${!p.exists ? 'opacity-60' : ''}`}
                onClick={() => p.exists && onSelectProject?.(p.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-200 truncate">{p.name}</h3>
                      {!p.exists && (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">MISSING</span>
                      )}
                      {p.exists && !p.hasPlanning && (
                        <span className="text-[10px] font-bold text-orange-400 bg-orange-500/20 px-1.5 py-0.5 rounded">NO PLANNING</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{p.path}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Last activity: {new Date(p.lastActivity).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    {p.exists && (
                      <button onClick={(e) => { e.stopPropagation(); onViewFiles?.(p.path); }}
                        className="text-xs text-slate-400 hover:text-indigo-300 px-2 py-1 rounded-lg hover:bg-indigo-500/10 transition-colors">
                        Files
                      </button>
                    )}
                    {!p.exists && (
                      <button onClick={(e) => { e.stopPropagation(); handleRemoveProject(p.id); }}
                        className="text-xs text-red-400/70 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors">
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── View: Phase Detail ──────────────────────────────
  if (view === 'phase' && phaseDetail) {
    const gsdCmd = `/gsd:execute-phase ${selectedPhase}`;
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-4">
        <button onClick={() => { setView('dashboard'); setPhaseDetail(null); }}
          className="text-xs text-slate-400 hover:text-indigo-300 transition-colors mb-2">
          ← Back to Dashboard
        </button>

        <h2 className="text-lg font-bold text-slate-100">
          Phase {selectedPhase}: {phaseDetail.name || 'Unknown'}
        </h2>

        {/* Execute Instructions */}
        <div className="glass-neon rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-slate-200">Execute in Claude Code or Cursor:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 input-glow text-indigo-300 font-mono text-sm rounded-lg px-4 py-2.5">
              {gsdCmd}
            </code>
            <button onClick={() => copyCommand(gsdCmd)}
              className="glass text-xs text-slate-400 hover:text-indigo-300 px-3 py-2.5 rounded-lg transition-colors whitespace-nowrap">
              📋 Copy
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => loadProjectData(activeProject)}
              className="text-xs text-slate-400 hover:text-indigo-300 px-2.5 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors">
              Refresh Progress
            </button>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/40" />
              Auto-refresh (10s)
            </label>
            {projectData?.progress && (
              <span className="text-xs text-slate-500 ml-auto">
                {projectData.progress.percent || 0}% complete
              </span>
            )}
          </div>
        </div>

        {/* Plans */}
        <div className="space-y-3">
          {(phaseDetail.plans || []).map(plan => (
            <div key={plan.number} className="glass rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${plan.hasSummary ? 'bg-emerald-400' : plan.hasPlan ? 'bg-amber-400' : 'bg-slate-500'}`} />
                <span className="text-sm font-medium text-slate-200">Plan {plan.number}</span>
                <span className="text-xs text-slate-500">{plan.hasSummary ? 'Complete' : plan.hasPlan ? 'Ready' : 'Pending'}</span>
              </div>
              {plan.plan && (
                <details className="mt-2">
                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-indigo-300">View Plan</summary>
                  <div className="mt-2 prose text-xs max-h-64 overflow-y-auto scrollbar-thin">
                    <MarkdownContent content={plan.plan} />
                  </div>
                </details>
              )}
              {plan.summary && (
                <details className="mt-2">
                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-indigo-300">View Summary</summary>
                  <div className="mt-2 prose text-xs max-h-64 overflow-y-auto scrollbar-thin">
                    <MarkdownContent content={plan.summary} />
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── View: Project Dashboard ─────────────────────────
  const phases = projectData?.roadmap?.phases || [];
  const progress = projectData?.progress || {};
  const currentProject = projects?.find(p => p.id === activeProject);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => { onSelectProject?.(null); setProjectData(null); }}
          className="text-xs text-slate-400 hover:text-indigo-300 transition-colors">
          ← All Projects
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => loadProjectData(activeProject)}
            className="text-xs text-slate-400 hover:text-indigo-300 px-2.5 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors">
            ↻ Refresh
          </button>
          {currentProject && (
            <button onClick={() => onViewFiles?.(currentProject.path)}
              className="text-xs text-slate-400 hover:text-indigo-300 px-2.5 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors">
              View Files
            </button>
          )}
        </div>
      </div>

      <h2 className="text-lg font-bold text-slate-100">{currentProject?.name || 'Project'}</h2>
      <p className="text-xs text-slate-500">{currentProject?.path}</p>

      {error && (
        <div className="p-3 rounded-lg text-xs bg-red-500/10 border border-red-500/30 text-red-400">{error}</div>
      )}

      {/* Progress Bar */}
      {progress.percent !== undefined && (
        <div className="glass rounded-lg p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">Progress</span>
            <span className="text-xs text-indigo-300 font-medium">{progress.percent}%</span>
          </div>
          <div className="w-full bg-slate-700/50 rounded-full h-2">
            <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 h-2 rounded-full transition-all"
              style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            {progress.total_summaries || 0} / {progress.total_plans || 0} plans complete
          </p>
        </div>
      )}

      {/* Phase List */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <span className="inline-block spin text-indigo-400">&#x27F3;</span>
        </div>
      ) : phases.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Phases</h3>
          {phases.map(phase => {
            const status = phase.disk_status || phase.status || 'pending';
            const dotColor = status === 'complete' ? 'bg-emerald-400' : status === 'in_progress' || status === 'partial' ? 'bg-amber-400' : 'bg-slate-500';
            return (
              <div key={phase.number}
                className="glass rounded-lg p-3 cursor-pointer hover:border-indigo-500/30 border border-transparent transition-all"
                onClick={() => loadPhaseDetail(activeProject, phase.number)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-200">{phase.number}. {phase.name || 'Unnamed'}</span>
                    <span className="text-xs text-slate-500 ml-2">
                      {phase.plan_count || 0} plan{(phase.plan_count || 0) !== 1 ? 's' : ''}
                      {phase.summary_count > 0 && `, ${phase.summary_count} done`}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 shrink-0 capitalize">{status.replace('_', ' ')}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : !projectData ? (
        <div className="glass rounded-xl p-6 text-center space-y-2">
          <span className="inline-block spin text-indigo-400 text-lg">&#x27F3;</span>
          <p className="text-sm text-slate-400">Loading project data...</p>
        </div>
      ) : (
        <div className="glass rounded-xl p-6 text-center space-y-3">
          <p className="text-sm text-slate-300">No phases found</p>
          <p className="text-xs text-slate-500">Run <code className="text-indigo-400">/gsd:new-project</code> in Claude Code to create your roadmap</p>
        </div>
      )}
    </div>
  );
}
