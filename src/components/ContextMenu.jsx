import { useRef, useEffect } from 'react';

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    function handleEsc(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleEsc); };
  }, [onClose]);

  return (
    <div ref={ref} className="context-menu glass-heavy rounded-xl shadow-2xl py-1 min-w-[180px] neon-border" style={{ left: x, top: y }}>
      {items.map((item, i) => item.divider ? (
        <div key={i} className="border-t border-slate-700/50 my-1" />
      ) : (
        <button key={i} onClick={() => { item.action(); onClose(); }}
          className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2.5
            ${item.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:bg-indigo-500/10 hover:text-white'}`}>
          <span className="w-5 text-center">{item.icon}</span>{item.label}
        </button>
      ))}
    </div>
  );
}
