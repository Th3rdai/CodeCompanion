import { useState, useRef, useEffect, useCallback } from "react";

export default function RenameModal({ currentName, onSave, onClose }) {
  const [name, setName] = useState(currentName);
  const [panelPos, setPanelPos] = useState(null);
  const [dragState, setDragState] = useState(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  useEffect(() => {
    inputRef.current?.select();
  }, []);
  useEffect(() => {
    function handleEsc(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  useEffect(() => {
    const width = Math.min(420, window.innerWidth - 32);
    const height = 240;
    setPanelPos({
      left: clamp((window.innerWidth - width) / 2, 8, window.innerWidth - width - 8),
      top: clamp((window.innerHeight - height) / 2, 8, window.innerHeight - height - 8),
    });
  }, []);

  useEffect(() => {
    if (!dragState) return;
    const onMove = (e) => {
      const panelWidth = panelRef.current?.offsetWidth || 420;
      const panelHeight = panelRef.current?.offsetHeight || 240;
      setPanelPos({
        left: clamp(
          e.clientX - dragState.offsetX,
          8,
          window.innerWidth - panelWidth - 8,
        ),
        top: clamp(
          e.clientY - dragState.offsetY,
          8,
          window.innerHeight - panelHeight - 8,
        ),
      });
    };
    const onUp = () => setDragState(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragState]);

  const startDrag = useCallback((e) => {
    if (!panelPos) return;
    setDragState({
      offsetX: e.clientX - panelPos.left,
      offsetY: e.clientY - panelPos.top,
    });
  }, [panelPos]);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="rounded-2xl w-full max-w-sm p-6 neon-border shadow-2xl border border-indigo-400/30"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Rename conversation"
        aria-modal="true"
        style={{
          position: "fixed",
          left: panelPos?.left ?? "50%",
          top: panelPos?.top ?? "50%",
          transform: panelPos ? "none" : "translate(-50%, -50%)",
          backgroundColor: "rgba(8, 14, 28, 0.96)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          className="cursor-move select-none pb-2 mb-2 border-b border-slate-700/50"
          onPointerDown={startDrag}
        >
          <p className="text-[10px] text-slate-400 mb-1">Drag to move</p>
          <h3 className="text-base font-bold text-slate-100">
            Rename Conversation
          </h3>
        </div>
        <h3 className="sr-only">
          Rename Conversation
        </h3>
        <label htmlFor="rename-input" className="sr-only">
          Conversation name
        </label>
        <input
          id="rename-input"
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave(name);
              onClose();
            }
            if (e.key === "Escape") onClose();
          }}
          className="w-full input-glow text-slate-100 rounded-lg px-4 py-2.5 outline-none text-sm mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 glass hover:bg-slate-600/30 text-slate-300 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(name);
              onClose();
            }}
            className="px-4 py-2 btn-neon text-white rounded-lg text-sm font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
