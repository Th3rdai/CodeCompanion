import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api-fetch';
import { Brain, Trash2, Search, X } from 'lucide-react';

const TYPE_COLORS = {
  fact: { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-300' },
  project: { bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-300' },
  pattern: { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-300' },
  summary: { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-300' },
};

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'fact', label: 'Facts' },
  { id: 'project', label: 'Projects' },
  { id: 'pattern', label: 'Patterns' },
  { id: 'summary', label: 'Summaries' },
];

function relativeDate(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return '1 month ago';
  return `${diffMonths} months ago`;
}

export default function MemoryPanel({ onClose }) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchMemories();
  }, []);

  async function fetchMemories() {
    setLoading(true);
    try {
      const res = await apiFetch('/api/memory');
      const data = await res.json();
      setMemories(Array.isArray(data) ? data : (data.memories || []));
    } catch {
      setMemories([]);
    }
    setLoading(false);
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchMemories();
      return;
    }
    setSearching(true);
    try {
      const res = await apiFetch(`/api/memory/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      setMemories(Array.isArray(data) ? data : (data.memories || data.results || []));
    } catch {
      // keep current list on error
    }
    setSearching(false);
  }

  function handleClearSearch() {
    setSearchQuery('');
    fetchMemories();
  }

  async function handleDelete(id) {
    try {
      await apiFetch(`/api/memory/${id}`, { method: 'DELETE' });
      setMemories(prev => prev.filter(m => m.id !== id));
    } catch {}
  }

  const filtered = filter === 'all' ? memories : memories.filter(m => m.type === filter);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div className="glass-heavy rounded-2xl w-full max-w-2xl p-6 neon-border max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()} role="dialog" aria-label="Memory Manager" aria-modal="true">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-100 neon-text">Memories</h2>
            <span className="text-xs text-slate-500">({filtered.length})</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl transition-colors" aria-label="Close memory panel">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search memories..."
              className="w-full input-glow text-slate-100 rounded-lg pl-9 pr-8 py-2 outline-none text-sm"
            />
            {searchQuery && (
              <button type="button" onClick={handleClearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button type="submit" disabled={searching} className="btn-neon text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
            {searching ? <span className="inline-block spin">&#x27F3;</span> : 'Search'}
          </button>
        </form>

        {/* Filter tabs */}
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === tab.id
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Memory list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-sm">Loading memories...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No memories yet. Have a few conversations and I'll start remembering!</p>
            </div>
          ) : (
            filtered.map(memory => {
              const colors = TYPE_COLORS[memory.type] || TYPE_COLORS.fact;
              const isExpanded = expandedId === memory.id;
              return (
                <div key={memory.id} className="glass rounded-lg p-3 group">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Type badge + date */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${colors.bg} ${colors.border} ${colors.text} border`}>
                          {memory.type}
                        </span>
                        <span className="text-[10px] text-slate-600">{relativeDate(memory.createdAt || memory.updatedAt)}</span>
                        {memory.confidence != null && (
                          <span className="text-[10px] text-slate-600">conf: {(memory.confidence * 100).toFixed(0)}%</span>
                        )}
                      </div>
                      {/* Content */}
                      <p
                        className={`text-sm text-slate-300 cursor-pointer ${!isExpanded ? 'line-clamp-3' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : memory.id)}
                      >
                        {memory.content}
                      </p>
                    </div>
                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(memory.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1 rounded transition-all shrink-0"
                      title="Delete memory"
                      aria-label="Delete memory"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
