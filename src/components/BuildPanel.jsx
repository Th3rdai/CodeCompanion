import { useState, useEffect, useCallback } from 'react';
import MarkdownContent from './MarkdownContent';
import BuildHeader from './BuildHeader';
import BuildSimpleView from './BuildSimpleView';
import BuildAdvancedView from './BuildAdvancedView';

/**
 * BuildPanel — Multi-view dashboard for Build mode projects.
 * Views: project list → project dashboard → phase detail
 */
export default function BuildPanel({ projects, activeProject, onSelectProject, onNewProject, onViewFiles, onRefresh, onToast, selectedModel = null, ollamaConnected = false }) {
  const [view, setView] = useState(activeProject ? 'dashboard' : 'list');
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('cc_build_view_mode') || 'simple';
  });
  const toggleViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('cc_build_view_mode', mode);
  };
  const [projectData, setProjectData] = useState(null); // roadmap + progress
  const [phaseDetail, setPhaseDetail] = useState(null);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importPath, setImportPath] = useState('');
  const [importing, setImporting] = useState(false);

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

  async function handleImportProject() {
    if (!importPath.trim()) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch('/api/build/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: importPath.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Import failed');
      } else {
        onToast?.(data.scaffolded ? 'Project imported — .planning/ created automatically' : 'Project imported');
        setShowImport(false);
        setImportPath('');
        onRefresh?.();
        if (data.id) onSelectProject?.(data.id);
      }
    } catch (err) {
      setError(err.message || 'Import failed');
    }
    setImporting(false);
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
          <div className="flex items-center gap-2">
            <button onClick={() => setShowImport(!showImport)}
              className="glass text-xs text-slate-400 hover:text-indigo-300 px-3 py-2 rounded-lg transition-colors">
              Import Existing
            </button>
            <button onClick={onNewProject} className="btn-neon text-sm px-4 py-2 rounded-lg font-medium">
              + New Project
            </button>
          </div>
        </div>

        {showImport && (
          <div className="glass-neon rounded-xl p-4 space-y-3 mb-4">
            <p className="text-sm font-medium text-slate-200">Import an existing project folder</p>
            <p className="text-xs text-slate-400">Works with Create projects, GitHub clones, or any codebase. Planning structure will be added automatically if needed.</p>
            <div className="flex gap-2">
              <input type="text" value={importPath} onChange={e => setImportPath(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleImportProject()}
                placeholder="~/AI_Dev/my-project"
                className="flex-1 input-glow text-slate-100 rounded-lg px-4 py-2.5 outline-none font-mono text-sm" />
              <button onClick={handleImportProject} disabled={importing || !importPath.trim()}
                className="btn-neon disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap">
                {importing ? '...' : 'Import'}
              </button>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        )}

        {projects.length === 0 && !showImport ? (
          <div className="glass rounded-xl p-8 text-center space-y-3">
            <p className="text-3xl">🏗️</p>
            <p className="text-sm text-slate-300">No build projects yet</p>
            <p className="text-xs text-slate-500">Create a new project, or import an existing one (Create projects, GitHub clones, any folder)</p>
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
                    <button onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Remove "${p.name}" from the project list?${p.exists ? '\n\nThis only removes it from the list — the folder on disk is not deleted.' : ''}`)) {
                          handleRemoveProject(p.id);
                        }
                      }}
                      className="text-xs text-red-400/70 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Remove from list">
                      Remove
                    </button>
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

  const derivedStatus = progress.percent === 100 ? 'complete' : progress.percent > 0 ? 'in_progress' : 'not_started';

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-4">
      <BuildHeader
        projectName={currentProject?.name}
        progress={progress}
        status={derivedStatus}
        viewMode={viewMode}
        onToggleViewMode={toggleViewMode}
        onRefresh={() => loadProjectData(activeProject)}
        onBack={() => { onSelectProject?.(null); setProjectData(null); }}
      />

      <p className="text-xs text-slate-500">{currentProject?.path}</p>

      {error && (
        <div className="p-3 rounded-lg text-xs bg-red-500/10 border border-red-500/30 text-red-400">{error}</div>
      )}

      {/* Simple View */}
      {viewMode === 'simple' && (
        <BuildSimpleView
          project={currentProject}
          projectData={projectData}
          selectedModel={selectedModel}
          ollamaConnected={ollamaConnected}
          onToast={onToast}
          onViewFiles={onViewFiles}
          onViewPhases={() => toggleViewMode('advanced')}
        />
      )}

      {/* Advanced View */}
      {viewMode === 'advanced' && (
        <BuildAdvancedView
          project={currentProject}
          projectData={projectData}
          onToast={onToast}
          onViewPhase={(phaseNum) => loadPhaseDetail(activeProject, phaseNum)}
        />
      )}
    </div>
  );
}
