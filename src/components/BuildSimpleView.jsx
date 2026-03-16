import { useState, useEffect } from 'react';
import { Lightbulb, RefreshCw, FolderOpen, Layers } from 'lucide-react';
import MarkdownContent from './MarkdownContent';

/**
 * BuildSimpleView — "What's Next" AI card and quick actions for the Build dashboard.
 */
export default function BuildSimpleView({ project, projectData, selectedModel, ollamaConnected, onToast, onViewFiles, onViewPhases }) {
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timestamp, setTimestamp] = useState(null);

  // Fetch recommendation on mount if Ollama is connected
  useEffect(() => {
    if (project?.id && ollamaConnected) {
      fetchNextAction();
    }
  }, [project?.id]);

  async function fetchNextAction() {
    if (!project?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/build/projects/${project.id}/next-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setRecommendation(data.action);
      setTimestamp(data.timestamp);
    } catch (err) {
      setError(err.message || 'Failed to get recommendation');
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {/* What's Next AI Card */}
      <div className="glass-neon rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className={`w-5 h-5 ${ollamaConnected ? 'text-amber-400' : 'text-slate-500'}`} />
            <h3 className="text-sm font-semibold text-slate-200">What's Next</h3>
          </div>
          {ollamaConnected && !loading && (
            <button
              onClick={fetchNextAction}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-300 px-2 py-1 rounded-lg hover:bg-indigo-500/10 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Ask AI
            </button>
          )}
        </div>

        {/* Ollama offline state */}
        {!ollamaConnected && (
          <div className="text-sm text-slate-400 py-2">
            <p>Start Ollama to get AI-powered suggestions for your project.</p>
            <p className="text-xs text-slate-500 mt-1">The AI will analyze your project state and recommend the most impactful next step.</p>
          </div>
        )}

        {/* Loading state */}
        {ollamaConnected && loading && (
          <div className="flex items-center gap-2 py-3">
            <span className="inline-block animate-pulse text-indigo-400 text-sm">Thinking about your next step...</span>
          </div>
        )}

        {/* Error state */}
        {ollamaConnected && !loading && error && (
          <div className="space-y-2">
            <p className="text-xs text-red-400">{error}</p>
            <button
              onClick={fetchNextAction}
              className="text-xs text-indigo-300 hover:text-indigo-200 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Recommendation */}
        {ollamaConnected && !loading && !error && recommendation && (
          <div className="space-y-2">
            <div className="prose prose-sm prose-invert max-w-none text-sm text-slate-300">
              <MarkdownContent content={typeof recommendation === 'string' ? recommendation : recommendation?.message?.content || JSON.stringify(recommendation)} />
            </div>
            {timestamp && (
              <p className="text-[10px] text-slate-500">
                Generated {new Date(timestamp).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* No recommendation yet (connected but not fetched) */}
        {ollamaConnected && !loading && !error && !recommendation && (
          <div className="text-sm text-slate-400 py-2">
            <p>Click "Ask AI" to get a recommendation for what to work on next.</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick Actions</h3>
        <div className="flex items-center gap-2">
          {onViewFiles && (
            <button
              onClick={() => onViewFiles(project?.path)}
              className="flex items-center gap-1.5 glass text-xs text-slate-300 hover:text-indigo-300 px-3 py-2 rounded-lg transition-colors cursor-pointer hover:border-indigo-500/30 border border-transparent"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              View Files
            </button>
          )}
          {onViewPhases && (
            <button
              onClick={onViewPhases}
              className="flex items-center gap-1.5 glass text-xs text-slate-300 hover:text-indigo-300 px-3 py-2 rounded-lg transition-colors cursor-pointer hover:border-indigo-500/30 border border-transparent"
            >
              <Layers className="w-3.5 h-3.5" />
              View Phases
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
