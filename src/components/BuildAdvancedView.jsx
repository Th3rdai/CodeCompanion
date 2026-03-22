import { useState } from 'react';
import { apiFetch } from '../lib/api-fetch';
import { ChevronDown, ChevronRight, FileText, CheckCircle } from 'lucide-react';
import PlanningFileViewer from './PlanningFileViewer';

/**
 * BuildAdvancedView — Phase accordion + planning file viewer for power users.
 */
export default function BuildAdvancedView({ project, projectData, onToast, onViewPhase }) {
  const [expandedPhases, setExpandedPhases] = useState(new Set());
  const [files, setFiles] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filesLoading, setFilesLoading] = useState(false);

  const phases = projectData?.roadmap?.phases || [];

  // Load available planning files on first render
  useState(() => {
    if (!project?.id) return;
    setFilesLoading(true);
    apiFetch(`/api/build/projects/${project.id}/files`)
      .then(r => r.json())
      .then(data => setFiles(data.files || []))
      .catch(() => setFiles([]))
      .finally(() => setFilesLoading(false));
  });

  function togglePhase(num) {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Planning Files */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Planning Files
        </h3>
        <div className="flex flex-wrap gap-2">
          {filesLoading && (
            <span className="text-xs text-slate-500">Loading files...</span>
          )}
          {files && files.length === 0 && (
            <span className="text-xs text-slate-500">No planning files found</span>
          )}
          {files && files.map(f => (
            <button
              key={f}
              onClick={() => setSelectedFile(f)}
              className="glass text-xs text-slate-300 hover:text-indigo-300 hover:border-indigo-500/30 border border-transparent px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Planning File Viewer */}
      {selectedFile && (
        <PlanningFileViewer
          projectId={project.id}
          filename={selectedFile}
          onClose={() => setSelectedFile(null)}
          onToast={onToast}
        />
      )}

      {/* Phases Accordion */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-300">Phases</h3>
        {phases.length === 0 ? (
          <p className="text-xs text-slate-500">No phases found</p>
        ) : (
          phases.map(phase => {
            const expanded = expandedPhases.has(phase.number);
            const status = phase.disk_status || phase.status || 'pending';
            const dotColor = status === 'complete' ? 'bg-emerald-400' : status === 'in_progress' || status === 'partial' ? 'bg-amber-400' : 'bg-slate-500';
            const isComplete = status === 'complete';

            return (
              <div key={phase.number} className="glass rounded-lg border border-transparent transition-all">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:border-indigo-500/30"
                  onClick={() => togglePhase(phase.number)}
                >
                  {expanded
                    ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  }
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
                  {isComplete && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-200">{phase.number}. {phase.name || 'Unnamed'}</span>
                    <span className="text-xs text-slate-500 ml-2">
                      {phase.plan_count || 0} plan{(phase.plan_count || 0) !== 1 ? 's' : ''}
                      {phase.summary_count > 0 && `, ${phase.summary_count} done`}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 shrink-0 capitalize">{status.replace('_', ' ')}</span>
                </div>

                {expanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-700/50 space-y-2">
                    {phase.goal && (
                      <p className="text-xs text-slate-400">{phase.goal}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onViewPhase?.(phase.number)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-500/10 transition-colors cursor-pointer"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
