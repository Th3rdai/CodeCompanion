import { useState } from 'react';
import McpServerPanel from './McpServerPanel';
import McpClientPanel from './McpClientPanel';

export default function SettingsPanel({ ollamaUrl, projectFolder, onSave, onClose }) {
  const [activeTab, setActiveTab] = useState('general');
  const [url, setUrl] = useState(ollamaUrl);
  const [folder, setFolder] = useState(projectFolder || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [folderResult, setFolderResult] = useState(null);

  async function handleTest() {
    setTesting(true); setTestResult(null);
    try {
      await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ollamaUrl: url }) });
      const res = await fetch('/api/models');
      const data = await res.json();
      setTestResult(data.connected ? { ok: true, count: data.models.length } : { ok: false, error: data.detail || 'Cannot connect' });
    } catch (err) { setTestResult({ ok: false, error: err.message }); }
    setTesting(false);
  }

  async function handleTestFolder() {
    setFolderResult(null);
    if (!folder.trim()) { setFolderResult({ ok: false, error: 'Enter a folder path' }); return; }
    try {
      const res = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectFolder: folder }) });
      const data = await res.json();
      if (data.error) { setFolderResult({ ok: false, error: data.error }); }
      else {
        const treeRes = await fetch(`/api/files/tree?path=${encodeURIComponent(folder)}&depth=1`);
        const treeData = await treeRes.json();
        if (treeData.tree) { setFolderResult({ ok: true, count: treeData.tree.length }); }
        else { setFolderResult({ ok: false, error: treeData.error || 'Cannot read folder' }); }
      }
    } catch (err) { setFolderResult({ ok: false, error: err.message }); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div className="glass-heavy rounded-2xl w-full max-w-lg p-6 neon-border max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} role="dialog" aria-label="Settings" aria-modal="true">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-100 neon-text">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl transition-colors" aria-label="Close settings">✕</button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 p-1 glass rounded-lg">
          {[
            { id: 'general', label: 'General' },
            { id: 'mcp-server', label: 'MCP Server' },
            { id: 'mcp-clients', label: 'MCP Clients' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'btn-neon text-white' : 'text-slate-400 hover:text-white'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'general' && (
          <div className="space-y-5">
            {/* Ollama URL */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-medium">Ollama Server URL</label>
              <div className="flex gap-2">
                <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="http://localhost:11434"
                  className="flex-1 input-glow text-slate-100 rounded-lg px-4 py-2.5 outline-none font-mono text-sm" />
                <button onClick={handleTest} disabled={testing}
                  className="btn-neon disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap">
                  {testing ? <span className="inline-block spin">&#x27F3;</span> : 'Test Connection'}
                </button>
              </div>
              {testResult && (
                <div className={`mt-2 p-2.5 rounded-lg text-xs ${testResult.ok ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                  {testResult.ok ? `Connected! Found ${testResult.count} model${testResult.count !== 1 ? 's' : ''}.` : `Failed: ${testResult.error}`}
                </div>
              )}
            </div>

            {/* Project Folder */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-medium">Project Folder</label>
              <div className="flex gap-2">
                <input type="text" value={folder} onChange={e => setFolder(e.target.value)} placeholder="/Users/you/projects/my-app"
                  className="flex-1 input-glow text-slate-100 rounded-lg px-4 py-2.5 outline-none font-mono text-sm" />
                <button onClick={handleTestFolder}
                  className="btn-neon text-white rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap">
                  Set Folder
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Full path to a repo or folder. Opens the file browser panel.</p>
              {folderResult && (
                <div className={`mt-2 p-2.5 rounded-lg text-xs ${folderResult.ok ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                  {folderResult.ok ? `Found ${folderResult.count} items in folder.` : `Error: ${folderResult.error}`}
                </div>
              )}
            </div>

            <div className="mb-5 p-3 glass rounded-lg text-xs text-slate-400">
              <strong className="text-slate-300">Quick help:</strong>
              <ul className="mt-1.5 space-y-1">
                <li>Same machine Ollama: <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-violet-300">http://localhost:11434</code></li>
                <li>Network Ollama: <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-violet-300">http://192.168.x.x:11434</code></li>
                <li>Project folder example: <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-violet-300">~/projects/my-app</code></li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'mcp-server' && <McpServerPanel />}
        {activeTab === 'mcp-clients' && <McpClientPanel />}

        {/* Buttons always visible */}
        <div className="flex gap-2 justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 glass hover:bg-slate-600/30 text-slate-300 rounded-lg text-sm transition-colors">Cancel</button>
          <button onClick={async () => { await onSave(url, folder); onClose(); }}
            className="px-4 py-2 btn-neon text-white rounded-lg text-sm font-medium">
            Save &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
}
