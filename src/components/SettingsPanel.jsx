import { useState, useEffect } from 'react';
import McpServerPanel from './McpServerPanel';
import McpClientPanel from './McpClientPanel';
import { use3DEffects } from '../contexts/Effects3DContext';
import { resetOnboarding } from './OnboardingWizard';
import { resetPrivacyBanner } from './PrivacyBanner';

export default function SettingsPanel({ ollamaUrl, projectFolder, onSave, onClose }) {
  const [activeTab, setActiveTab] = useState('general');
  const [url, setUrl] = useState(ollamaUrl);
  const [folder, setFolder] = useState(projectFolder || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [folderResult, setFolderResult] = useState(null);

  // GitHub token state
  const [ghToken, setGhToken] = useState('');
  const [ghTokenStatus, setGhTokenStatus] = useState(null);
  const [ghValidating, setGhValidating] = useState(false);
  const [ghResult, setGhResult] = useState(null);
  const { enabled: effects3D, setEnabled: setEffects3D } = use3DEffects();

  useEffect(() => {
    fetchGhTokenStatus();
  }, []);

  async function fetchGhTokenStatus() {
    try {
      const res = await fetch('/api/github/token/status');
      const data = await res.json();
      setGhTokenStatus(data);
    } catch {}
  }

  async function handleValidateGhToken() {
    if (!ghToken.trim()) return;
    setGhValidating(true);
    setGhResult(null);
    try {
      const res = await fetch('/api/github/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: ghToken }),
      });
      const data = await res.json();
      setGhResult(data);
      if (data.valid) {
        setGhToken('');
        fetchGhTokenStatus();
      }
    } catch (err) {
      setGhResult({ valid: false, error: err.message });
    }
    setGhValidating(false);
  }

  async function handleRemoveGhToken() {
    try {
      await fetch('/api/github/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: '' }),
      });
      setGhTokenStatus(null);
      setGhResult(null);
    } catch {}
  }

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
            { id: 'github', label: 'GitHub' },
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
              <p className="text-xs text-slate-400 mt-1.5">Point me to your project folder and I'll open the file browser for you.</p>
              {folderResult && (
                <div className={`mt-2 p-2.5 rounded-lg text-xs ${folderResult.ok ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                  {folderResult.ok ? `Found ${folderResult.count} items in folder.` : `Error: ${folderResult.error}`}
                </div>
              )}
            </div>

            {/* 3D Effects Toggle */}
            <div className="glass rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">3D Visual Effects</p>
                <p className="text-xs text-slate-500 mt-0.5">Animated backgrounds, particle effects, and holographic elements</p>
              </div>
              <button
                onClick={() => setEffects3D(!effects3D)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                  effects3D ? 'bg-indigo-600' : 'bg-slate-600'
                }`}
                role="switch"
                aria-checked={effects3D}
                aria-label="Toggle 3D effects">
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  effects3D ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Restart Tour / Reset Privacy */}
            <div className="glass rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Welcome Tour</p>
                <p className="text-xs text-slate-500 mt-0.5">Re-show the onboarding walkthrough and privacy banner</p>
              </div>
              <button
                onClick={() => { resetOnboarding(); resetPrivacyBanner(); window.location.reload(); }}
                className="text-xs px-3 py-1.5 rounded-lg glass text-slate-300 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors border border-slate-600"
              >
                Restart Tour
              </button>
            </div>

            <div className="mb-5 p-3 glass rounded-lg text-xs text-slate-400">
              <strong className="text-slate-300">Need a hand?</strong>
              <ul className="mt-1.5 space-y-1">
                <li>Ollama on this machine: <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-indigo-300">http://localhost:11434</code></li>
                <li>Ollama on your network: <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-indigo-300">http://192.168.x.x:11434</code></li>
                <li>Project folder example: <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-indigo-300">~/projects/my-app</code></li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'github' && (
          <div className="space-y-5">
            {/* Current token status */}
            {ghTokenStatus?.configured && ghTokenStatus?.valid ? (
              <div className="glass rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 bg-green-400 rounded-full glow-pulse" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">Connected as <span className="text-indigo-300">{ghTokenStatus.username}</span></p>
                      <p className="text-xs text-slate-500 mt-0.5">Personal Access Token active</p>
                    </div>
                  </div>
                  <button onClick={handleRemoveGhToken}
                    className="text-xs text-red-400/70 hover:text-red-400 border border-red-500/20 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                    Remove Token
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass rounded-lg p-4 text-center">
                <p className="text-sm text-slate-300 mb-1">Let's connect your GitHub!</p>
                <p className="text-xs text-slate-500">Add a token below and you'll be able to clone private repos and browse your account.</p>
              </div>
            )}

            {/* Token input */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-medium">
                {ghTokenStatus?.configured ? 'Replace Token' : 'Personal Access Token'}
              </label>
              <div className="flex gap-2">
                <input type="password" value={ghToken} onChange={e => setGhToken(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleValidateGhToken()}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="flex-1 input-glow text-slate-100 rounded-lg px-4 py-2.5 outline-none font-mono text-sm" />
                <button onClick={handleValidateGhToken} disabled={ghValidating || !ghToken.trim()}
                  className="btn-neon disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap">
                  {ghValidating ? <span className="inline-block spin">&#x27F3;</span> : 'Validate & Save'}
                </button>
              </div>
              {ghResult && (
                <div className={`mt-2 p-2.5 rounded-lg text-xs ${ghResult.valid
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                  {ghResult.valid ? `Token valid! Connected as ${ghResult.username}.` : `Invalid: ${ghResult.error}`}
                </div>
              )}
            </div>

            {/* Help */}
            <div className="glass rounded-lg p-3 text-xs text-slate-500">
              <p className="font-medium text-slate-400 mb-1.5">Here's how to get a token (it's quick!):</p>
              <ol className="space-y-1 list-decimal list-inside">
                <li>Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)</li>
                <li>Click "Generate new token (classic)"</li>
                <li>Select the <code className="bg-slate-700/50 px-1 py-0.5 rounded text-indigo-300">repo</code> scope (full control of private repos)</li>
                <li>Copy the token and paste it above</li>
              </ol>
              <p className="mt-2 text-amber-400/70">Don't worry — your token stays on your machine and is never shared with anyone.</p>
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
