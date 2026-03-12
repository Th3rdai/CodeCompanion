import { useState, useMemo } from 'react';
import ContextMenu from './ContextMenu';
import ParticleField from './3d/ParticleField';

export default function Sidebar({ history, activeId, onSelect, onNew, onDelete, onRename, onExport, onArchive, open, onClose, showArchived, onToggleArchived, modes }) {
  const [search, setSearch] = useState('');
  const [contextMenu, setContextMenu] = useState(null);

  const filtered = useMemo(() => {
    let list = history.filter(h => showArchived ? h.archived : !h.archived);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(h =>
        (h.title || '').toLowerCase().includes(q) ||
        (h.mode || '').toLowerCase().includes(q) ||
        (h.model || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [history, search, showArchived]);

  function handleContextMenu(e, h) {
    e.preventDefault();
    setContextMenu({
      x: e.clientX, y: e.clientY, items: [
        { icon: '✏️', label: 'Rename', action: () => onRename(h.id) },
        { icon: '📥', label: 'Export as Markdown', action: () => onExport(h.id, 'md') },
        { icon: '📄', label: 'Export as Text', action: () => onExport(h.id, 'txt') },
        { divider: true },
        h.archived
          ? { icon: '📂', label: 'Unarchive', action: () => onArchive(h.id, false) }
          : { icon: '📦', label: 'Archive', action: () => onArchive(h.id, true) },
        { divider: true },
        { icon: '🗑️', label: 'Delete', action: () => onDelete(h.id), danger: true },
      ]
    });
  }

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />}
      <nav aria-label="Conversations"
        className={`fixed lg:relative top-0 left-0 h-full w-72 glass-heavy border-r border-slate-700/30 z-40 flex flex-col transition-transform duration-200 overflow-hidden
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <ParticleField particleCount={300} speed={0.15} color="#6366f1" />

        <div className="p-4 border-b border-slate-700/30 space-y-2 relative z-10">
          <button onClick={onNew}
            className="w-full btn-neon text-white rounded-lg py-2.5 px-4 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400">
            + New Conversation
          </button>
          <label htmlFor="sidebar-search" className="sr-only">Search conversations</label>
          <input id="sidebar-search" type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="w-full input-glow text-slate-200 text-sm rounded-lg px-3 py-2 placeholder-slate-500" />
        </div>

        <div className="px-4 pt-2 pb-1 flex items-center gap-2 relative z-10">
          <button onClick={onToggleArchived}
            className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
              showArchived
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
            }`}>
            {showArchived ? '📦 Archived' : '💬 Active'}
          </button>
          <span className="text-xs text-slate-600">{filtered.length} chat{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 relative z-10">
          {filtered.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">
              {search ? 'No chats match your search. Try different keywords.'
                : showArchived ? 'No archived chats yet. Right-click a chat to archive it.'
                : 'No conversations yet. Click "+ New Conversation" to start.'}
            </p>
          )}
          {filtered.map(h => (
            <div key={h.id}
              className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 mb-1 cursor-pointer transition-colors
                ${activeId === h.id
                  ? 'bg-indigo-600/20 border border-indigo-500/30 neon-glow-sm'
                  : 'hover:bg-indigo-500/10'}`}
              onClick={() => { onSelect(h.id); onClose(); }}
              onContextMenu={(e) => handleContextMenu(e, h)}>
              <span className="text-sm">{modes?.find(m => m.id === h.mode)?.icon || '💬'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-200 truncate">{h.title || 'Untitled'}</div>
                <div className="text-xs text-slate-500">
                  {h.model && <span className="text-indigo-400">{h.model.split(':')[0]}</span>}
                  {h.model && ' · '}{new Date(h.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleContextMenu(e, h); }}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 text-xs transition-opacity px-1"
                aria-label="More options">⋯</button>
            </div>
          ))}
        </div>
      </nav>
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)} />}
    </>
  );
}
