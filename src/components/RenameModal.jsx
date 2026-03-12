import { useState, useRef, useEffect } from 'react';

export default function RenameModal({ currentName, onSave, onClose }) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.select(); }, []);
  useEffect(() => {
    function handleEsc(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div className="glass-heavy rounded-2xl w-full max-w-sm p-6 neon-border" onClick={e => e.stopPropagation()} role="dialog" aria-label="Rename conversation" aria-modal="true">
        <h3 className="text-base font-bold text-slate-100 mb-4">Rename Conversation</h3>
        <label htmlFor="rename-input" className="sr-only">Conversation name</label>
        <input id="rename-input" ref={inputRef} type="text" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { onSave(name); onClose(); } if (e.key === 'Escape') onClose(); }}
          className="w-full input-glow text-slate-100 rounded-lg px-4 py-2.5 outline-none text-sm mb-4" />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 glass hover:bg-slate-600/30 text-slate-300 rounded-lg text-sm transition-colors">Cancel</button>
          <button onClick={() => { onSave(name); onClose(); }} className="px-4 py-2 btn-neon text-white rounded-lg text-sm font-medium">Save</button>
        </div>
      </div>
    </div>
  );
}
