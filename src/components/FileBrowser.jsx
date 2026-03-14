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

export default function FileBrowser({ projectFolder, onAttachFile, onClose, onClearFolder, onSetFolder }) {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [folderInput, setFolderInput] = useState('');
  const [launchingClaude, setLaunchingClaude] = useState(false);
  const [launchingCursor, setLaunchingCursor] = useState(false);
  const [launchingWindsurf, setLaunchingWindsurf] = useState(false);
  const [launchingOpenCode, setLaunchingOpenCode] = useState(false);

  const folderPath = tree?.root || projectFolder;

  async function handleLaunchClaude() {
    if (!folderPath) return;
    setLaunchingClaude(true);
    try {
      const res = await fetch('/api/launch-claude-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: folderPath })
      });
      const data = await res.json();
      if (!res.ok || !data.success) console.error('Launch Claude failed:', data.error);
    } catch (err) {
      console.error('Launch Claude failed:', err);
    } finally {
      setLaunchingClaude(false);
    }
  }

  async function handleLaunchCursor() {
    if (!folderPath) return;
    setLaunchingCursor(true);
    try {
      const res = await fetch('/api/launch-cursor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: folderPath })
      });
      const data = await res.json();
      if (!res.ok || !data.success) console.error('Launch Cursor failed:', data.error);
    } catch (err) {
      console.error('Launch Cursor failed:', err);
    } finally {
      setLaunchingCursor(false);
    }
  }

  async function handleLaunchWindsurf() {
    if (!folderPath) return;
    setLaunchingWindsurf(true);
    try {
      const res = await fetch('/api/launch-windsurf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: folderPath })
      });
      const data = await res.json();
      if (!res.ok || !data.success) console.error('Launch Windsurf failed:', data.error);
    } catch (err) {
      console.error('Launch Windsurf failed:', err);
    } finally {
      setLaunchingWindsurf(false);
    }
  }

  async function handleLaunchOpenCode() {
    if (!folderPath) return;
    setLaunchingOpenCode(true);
    try {
      const res = await fetch('/api/launch-opencode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: folderPath })
      });
      const data = await res.json();
      if (!res.ok || !data.success) console.error('Launch OpenCode failed:', data.error);
    } catch (err) {
      console.error('Launch OpenCode failed:', err);
    } finally {
      setLaunchingOpenCode(false);
    }
  }

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

      {projectFolder && (
        <div className="px-3 py-2 border-b border-slate-700/30 flex flex-wrap gap-2">
          <button
            onClick={handleLaunchClaude}
            disabled={launchingClaude || !folderPath}
            className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30 border border-indigo-500/30 transition-colors disabled:opacity-50"
          >
            {launchingClaude ? 'Opening...' : '⌨ Claude'}
          </button>
          <button
            onClick={handleLaunchCursor}
            disabled={launchingCursor || !folderPath}
            className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors disabled:opacity-50"
          >
            {launchingCursor ? 'Opening...' : '🖱 Cursor'}
          </button>
          <button
            onClick={handleLaunchWindsurf}
            disabled={launchingWindsurf || !folderPath}
            className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 border border-cyan-500/30 transition-colors disabled:opacity-50"
          >
            {launchingWindsurf ? 'Opening...' : '🌊 Windsurf'}
          </button>
          <button
            onClick={handleLaunchOpenCode}
            disabled={launchingOpenCode || !folderPath}
            className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-orange-500/20 text-orange-200 hover:bg-orange-500/30 border border-orange-500/30 transition-colors disabled:opacity-50"
          >
            {launchingOpenCode ? 'Opening...' : '💻 OpenCode'}
          </button>
        </div>
      )}

      {!projectFolder && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="space-y-3 w-full max-w-[260px]">
            <p className="text-sm text-slate-400 text-center">Enter a folder path to browse</p>
            <input
              type="text"
              value={folderInput}
              onChange={e => setFolderInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && folderInput.trim() && onSetFolder) onSetFolder(folderInput.trim()); }}
              placeholder="~/AI_Dev/my-project"
              className="w-full input-glow text-slate-200 text-xs rounded-lg px-3 py-2 placeholder-slate-500 font-mono"
            />
            <button
              onClick={() => { if (folderInput.trim() && onSetFolder) onSetFolder(folderInput.trim()); }}
              disabled={!folderInput.trim()}
              className="w-full text-xs px-3 py-2 rounded-lg bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30 border border-indigo-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Open Folder
            </button>
            <p className="text-[10px] text-slate-500 text-center">Or set it in Settings, or create a project</p>
          </div>
        </div>
      )}

      {projectFolder && loading && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-slate-400 text-sm">Loading...</span>
        </div>
      )}

      {projectFolder && tree && !preview && (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-1">
          <div className="px-2 py-1 flex items-center gap-1">
            <span className="text-[10px] text-slate-500 truncate flex-1">{tree.root}</span>
            {onClearFolder && (
              <button
                onClick={() => { onClearFolder(); setTree(null); }}
                className="text-[10px] text-slate-500 hover:text-red-300 shrink-0 transition-colors"
                title="Clear folder"
              >
                ✕
              </button>
            )}
          </div>
          <div role="tree" aria-label="Project files">
            {tree.tree?.map((node, i) => (
              <FileTreeNode key={node.path || i} node={node} depth={0} onFileClick={handleFileClick} />
            ))}
          </div>
          {tree.tree?.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Hmm, no text files here. Try pointing to a different folder!</p>}
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
