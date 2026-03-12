import { useState, useEffect } from 'react';

function FileTreeNode({ node, depth, onFileClick }) {
  const [open, setOpen] = useState(depth < 2);
  const indent = depth * 16;

  if (node.type === 'dir') {
    return (
      <div role="treeitem" aria-expanded={open} aria-label={`Folder: ${node.name}`}>
        <button className="w-full flex items-center gap-1 py-1.5 px-2 hover:bg-indigo-500/10 rounded cursor-pointer text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors"
          style={{ paddingLeft: indent }}
          onClick={() => setOpen(!open)}
          onKeyDown={e => { if (e.key === 'ArrowRight' && !open) setOpen(true); if (e.key === 'ArrowLeft' && open) setOpen(false); }}>
          <span className="text-xs text-slate-400" aria-hidden="true">{open ? '▾' : '▸'}</span>
          <span className="text-amber-400 text-xs" aria-hidden="true">📁</span>
          <span className="truncate">{node.name}</span>
        </button>
        {open && <div role="group">{node.children?.map((child, i) => (
          <FileTreeNode key={child.path || i} node={child} depth={depth + 1} onFileClick={onFileClick} />
        ))}</div>}
      </div>
    );
  }

  const extColors = { js: 'text-yellow-400', jsx: 'text-cyan-400', ts: 'text-blue-400', tsx: 'text-blue-300',
    py: 'text-green-400', json: 'text-amber-300', md: 'text-slate-300', css: 'text-pink-400',
    html: 'text-orange-400', sh: 'text-green-300' };
  const extColor = extColors[node.ext] || 'text-slate-400';

  return (
    <button role="treeitem" className="w-full flex items-center gap-1.5 py-1.5 px-2 hover:bg-indigo-500/10 rounded cursor-pointer text-sm group focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors"
      style={{ paddingLeft: indent }}
      onClick={() => onFileClick(node)}
      aria-label={`File: ${node.name}`}>
      <span className={`text-xs ${extColor}`} aria-hidden="true">📄</span>
      <span className="truncate text-slate-300 group-hover:text-white">{node.name}</span>
      {node.size > 0 && <span className="text-[10px] text-slate-500 ml-auto">{(node.size / 1024).toFixed(0)}k</span>}
    </button>
  );
}

export default function FileBrowser({ projectFolder, onAttachFile, onClose }) {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);

  useEffect(() => { if (projectFolder) loadTree(); }, [projectFolder]);

  async function loadTree() {
    setLoading(true);
    try {
      const res = await fetch(`/api/files/tree?depth=3`);
      const data = await res.json();
      setTree(data);
    } catch {}
    setLoading(false);
  }

  async function handleFileClick(node) {
    setLoadingFile(true);
    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(node.path)}`);
      const data = await res.json();
      setPreview(data);
    } catch {}
    setLoadingFile(false);
  }

  function handleAttach() {
    if (preview) {
      onAttachFile({ name: preview.name, path: preview.path, content: preview.content, lines: preview.lines });
      setPreview(null);
    }
  }

  return (
    <div className="w-80 glass-heavy border-l border-slate-700/30 flex flex-col h-full">
      <div className="p-3 border-b border-slate-700/30 flex items-center gap-2">
        <span className="text-sm font-medium text-slate-200 flex-1">📂 File Browser</span>
        <button onClick={loadTree} className="text-slate-400 hover:text-indigo-300 text-sm transition-colors" title="Refresh" aria-label="Refresh file tree">&#x27F3;</button>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-sm transition-colors" title="Close" aria-label="Close file browser">✕</button>
      </div>

      {!projectFolder && (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-slate-400 text-center">Set a project folder in Settings to browse files</p>
        </div>
      )}

      {projectFolder && loading && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-slate-400 text-sm">Loading...</span>
        </div>
      )}

      {projectFolder && tree && !preview && (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-1">
          <div className="px-2 py-1 text-[10px] text-slate-500 truncate">{tree.root}</div>
          <div role="tree" aria-label="Project files">
            {tree.tree?.map((node, i) => (
              <FileTreeNode key={node.path || i} node={node} depth={0} onFileClick={handleFileClick} />
            ))}
          </div>
          {tree.tree?.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No text files found. Try a different project folder.</p>}
        </div>
      )}

      {preview && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-700/30 flex items-center gap-2">
            <button onClick={() => setPreview(null)} className="text-slate-400 hover:text-indigo-300 text-xs transition-colors">← Back</button>
            <span className="text-sm text-slate-200 truncate flex-1">{preview.name}</span>
            <span className="text-[10px] text-slate-500">{preview.lines} lines</span>
          </div>
          <div className="flex-1 overflow-auto p-3">
            <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap">{preview.content}</pre>
          </div>
          <div className="p-2 border-t border-slate-700/30">
            <button onClick={handleAttach}
              className="w-full btn-neon text-white text-sm rounded-lg py-2.5 font-medium">
              + Attach to Chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
