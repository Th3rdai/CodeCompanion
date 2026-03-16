import { useState, useEffect } from 'react';
import McpServerPanel from './McpServerPanel';
import McpClientPanel from './McpClientPanel';
import { use3DEffects, THEME_PRESETS } from '../contexts/Effects3DContext';
import { resetOnboarding } from './OnboardingWizard';
import { resetPrivacyBanner } from './PrivacyBanner';
import { Download, Upload, Settings } from 'lucide-react';

export default function SettingsPanel({ ollamaUrl, projectFolder, onSave, onClose, onOpenMemoryPanel }) {
  const [activeTab, setActiveTab] = useState('general');
  const [url, setUrl] = useState(ollamaUrl);
  const [folder, setFolder] = useState(projectFolder || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [folderResult, setFolderResult] = useState(null);

  // Brand assets state
  const [brandAssets, setBrandAssets] = useState([]);
  const [brandLoaded, setBrandLoaded] = useState(false);

  // GitHub token state
  const [ghToken, setGhToken] = useState('');
  const [ghTokenStatus, setGhTokenStatus] = useState(null);
  const [ghValidating, setGhValidating] = useState(false);
  const [ghResult, setGhResult] = useState(null);
  const { enabled: effects3D, setEnabled: setEffects3D, theme, setThemeId, customHue, setCustomHue } = use3DEffects();

  // Electron state
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;
  const [appVersion, setAppVersion] = useState(null);
  const [dataDir, setDataDir] = useState(null);
  const [preferredPort, setPreferredPort] = useState(3000);
  const [actualPort, setActualPort] = useState(null);
  const [portError, setPortError] = useState('');

  // Memory state
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [embeddingModel, setEmbeddingModel] = useState('');
  const [maxContextTokens, setMaxContextTokens] = useState(500);
  const [autoExtract, setAutoExtract] = useState(true);
  const [memoryStats, setMemoryStats] = useState(null);
  const [embeddingModels, setEmbeddingModels] = useState([]);
  const [reembedding, setReembedding] = useState(false);

  // Update state
  const [updateStatus, setUpdateStatus] = useState(null); // null | 'checking' | 'available' | 'downloading' | 'ready' | 'up-to-date' | 'error'
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateError, setUpdateError] = useState(null);

  // Load brand assets from config
  useEffect(() => {
    if (!brandLoaded) {
      fetch('/api/config').then(r => r.json()).then(data => {
        if (Array.isArray(data.brandAssets)) setBrandAssets(data.brandAssets);
        setBrandLoaded(true);
      }).catch(() => setBrandLoaded(true));
    }
  }, [brandLoaded]);

  async function saveBrandAssets(assets) {
    setBrandAssets(assets);
    try {
      await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandAssets: assets }) });
    } catch {}
  }

  function addBrandAsset() {
    saveBrandAssets([...brandAssets, { label: '', path: '', description: '' }]);
  }

  function updateBrandAsset(index, field, value) {
    const updated = brandAssets.map((a, i) => i === index ? { ...a, [field]: value } : a);
    saveBrandAssets(updated);
  }

  function removeBrandAsset(index) {
    saveBrandAssets(brandAssets.filter((_, i) => i !== index));
  }

  // Fetch memory config and data on mount
  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(data => {
      if (data.memory) {
        setMemoryEnabled(!!data.memory.enabled);
        setEmbeddingModel(data.memory.embeddingModel || '');
        setMaxContextTokens(data.memory.maxContextTokens || 500);
        setAutoExtract(data.memory.autoExtract !== false);
      }
    }).catch(() => {});
    fetch('/api/memory/models').then(r => r.json()).then(data => {
      setEmbeddingModels(Array.isArray(data) ? data : (data.models || []));
    }).catch(() => setEmbeddingModels([]));
    fetch('/api/memory/stats').then(r => r.json()).then(data => {
      setMemoryStats(data);
    }).catch(() => {});
  }, []);

  async function saveMemoryConfig(updates) {
    const memConfig = {
      enabled: memoryEnabled,
      embeddingModel,
      maxContextTokens,
      autoExtract,
      ...updates,
    };
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memory: memConfig }),
      });
    } catch {}
  }

  async function handleReembed() {
    if (!confirm('Re-embed all memories with the current embedding model? This may take a while.')) return;
    setReembedding(true);
    try {
      await fetch('/api/memory/reembed', { method: 'POST' });
    } catch {}
    setReembedding(false);
  }

  useEffect(() => {
    fetchGhTokenStatus();
    if (isElectron) {
      fetchElectronData();

      // Listen for update events
      window.electronAPI.onUpdateAvailable((info) => {
        setUpdateStatus('available');
        setUpdateInfo(info);
      });
      window.electronAPI.onUpdateDownloadProgress?.((progress) => {
        setUpdateStatus('downloading');
        setDownloadProgress(Math.round(progress.percent));
      });
      window.electronAPI.onUpdateDownloaded((info) => {
        setUpdateStatus('ready');
        setUpdateInfo(info);
      });
    }
  }, [isElectron]);

  async function fetchElectronData() {
    try {
      const version = await window.electronAPI.getAppVersion();
      const dir = await window.electronAPI.getDataDir();
      const port = await window.electronAPI.getPortConfig();
      const actual = await window.electronAPI.getActualPort();
      setAppVersion(version);
      setDataDir(dir);
      setPreferredPort(port);
      setActualPort(actual);
    } catch (err) {
      console.error('Failed to fetch Electron data:', err);
    }
  }

  async function handleExportData() {
    try {
      const result = await window.electronAPI.exportData();
      if (result.success) {
        showToast('Data exported successfully');
      } else if (!result.cancelled) {
        showToast(`Export failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      showToast(`Export failed: ${err.message}`);
    }
  }

  async function handleImportData() {
    try {
      const result = await window.electronAPI.importData();
      if (result.success) {
        showToast('Data imported successfully. Reloading app...');
        setTimeout(() => window.location.reload(), 1500);
      } else if (!result.cancelled) {
        showToast(`Import failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      showToast(`Import failed: ${err.message}`);
    }
  }

  async function handleSavePort() {
    const portNum = parseInt(preferredPort, 10);
    if (portNum < 1024 || portNum > 65535) {
      setPortError('Port must be between 1024 and 65535');
      return;
    }
    setPortError('');
    try {
      const result = await window.electronAPI.setPortConfig(portNum);
      if (result.success) {
        showToast('Port preference saved. Takes effect on next launch.');
      } else {
        setPortError(result.error || 'Failed to save port');
      }
    } catch (err) {
      setPortError(err.message);
    }
  }

  async function handleCheckForUpdates() {
    setUpdateStatus('checking');
    setUpdateError(null);
    try {
      const result = await window.electronAPI.checkForUpdates();
      if (result.success && result.updateInfo) {
        // Events will handle status changes
      } else if (result.success) {
        setUpdateStatus('up-to-date');
      } else {
        setUpdateStatus('error');
        setUpdateError(result.error || 'Check failed');
      }
    } catch (err) {
      setUpdateStatus('error');
      setUpdateError(err.message);
    }
  }

  async function handleRestartForUpdate() {
    try {
      await window.electronAPI.restartForUpdate();
    } catch (err) {
      setUpdateError(err.message);
    }
  }

  function showToast(msg) {
    // This would need to be passed as a prop or accessed via context
    // For now, using console.log as placeholder
    console.log('[Toast]', msg);
  }

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
            { id: 'memory', label: 'Memory' },
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

            {/* Brand Assets */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-medium">Brand Assets</label>
              <p className="text-xs text-slate-500 mb-3">Logo and image files the AI will use for branding in diagrams, reports, and builds.</p>
              <div className="space-y-2">
                {brandAssets.map((asset, i) => (
                  <div key={i} className="glass rounded-lg p-3 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={asset.label}
                        onChange={e => updateBrandAsset(i, 'label', e.target.value)}
                        placeholder="Label (e.g., Logo, Icon, Banner)"
                        className="w-1/3 input-glow text-slate-100 rounded-lg px-3 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={asset.path}
                        onChange={e => updateBrandAsset(i, 'path', e.target.value)}
                        placeholder="/path/to/logo.png"
                        className="flex-1 input-glow text-slate-100 rounded-lg px-3 py-1.5 font-mono text-xs"
                      />
                      <button
                        onClick={() => removeBrandAsset(i)}
                        className="text-red-400 hover:text-red-300 text-xs px-2 transition-colors"
                        title="Remove asset"
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      type="text"
                      value={asset.description || ''}
                      onChange={e => updateBrandAsset(i, 'description', e.target.value)}
                      placeholder="Description (e.g., Primary logo for light backgrounds, 512x512 PNG)"
                      className="w-full input-glow text-slate-100 rounded-lg px-3 py-1.5 text-xs"
                    />
                  </div>
                ))}
                <button
                  onClick={addBrandAsset}
                  className="text-xs px-3 py-1.5 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                >
                  + Add Brand Asset
                </button>
              </div>
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

            {/* Theme Picker — Hue Slider + Preset Quick Picks */}
            <div className="glass rounded-lg p-4">
              <p className="text-sm font-medium text-slate-200 mb-1">Color Theme</p>
              <p className="text-xs text-slate-500 mb-3">Slide to pick any color, or tap a preset</p>

              {/* Hue Slider */}
              <div className="mb-3">
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={theme.hue || 239}
                  onChange={(e) => setCustomHue(parseInt(e.target.value, 10))}
                  className="w-full h-3 rounded-full outline-none cursor-pointer"
                  style={{
                    background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                  }}
                  aria-label="Theme hue slider"
                />
                <style>{`
                  input[type="range"][aria-label="Theme hue slider"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: ${theme.primary};
                    border: 2px solid white;
                    box-shadow: 0 0 12px ${theme.primary}80;
                    cursor: pointer;
                    transition: box-shadow 0.2s ease;
                  }
                  input[type="range"][aria-label="Theme hue slider"]::-moz-range-thumb {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: ${theme.primary};
                    border: 2px solid white;
                    box-shadow: 0 0 12px ${theme.primary}80;
                    cursor: pointer;
                  }
                `}</style>
              </div>

              {/* Preset Quick Picks */}
              <div className="flex items-center gap-2">
                {THEME_PRESETS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setThemeId(t.id)}
                    className={`w-6 h-6 rounded-full transition-all ${
                      theme.id === t.id ? 'ring-2 ring-white ring-offset-1 ring-offset-[#141829] scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'
                    }`}
                    style={{ background: t.primary }}
                    title={t.label}
                    aria-label={`Select ${t.label} theme`}
                  />
                ))}
                <span className="text-xs text-slate-500 ml-2">{theme.label}</span>
              </div>
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

            {/* Electron-only sections */}
            {isElectron && (
              <>
                {/* Data Management */}
                <div className="glass rounded-lg p-4">
                  <p className="text-sm font-medium text-slate-200 mb-3">Data Management</p>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={handleExportData}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg glass text-slate-300 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors border border-slate-600 text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Export Data
                      </button>
                      <button
                        onClick={handleImportData}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg glass text-slate-300 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors border border-slate-600 text-sm"
                      >
                        <Upload className="w-4 h-4" />
                        Import Data
                      </button>
                    </div>
                    {dataDir && (
                      <p className="text-xs text-slate-500">
                        Data location: <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-indigo-300 text-[10px]">{dataDir}</code>
                      </p>
                    )}
                  </div>
                </div>

                {/* Port Configuration */}
                <div className="glass rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Settings className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-medium text-slate-200">Port Configuration</p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs text-slate-400">Preferred Port</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={preferredPort}
                        onChange={(e) => setPreferredPort(e.target.value)}
                        min="1024"
                        max="65535"
                        className="flex-1 input-glow text-slate-100 rounded-lg px-3 py-2 outline-none text-sm"
                      />
                      <button
                        onClick={handleSavePort}
                        className="btn-neon text-white rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap"
                      >
                        Save
                      </button>
                    </div>
                    {portError && (
                      <p className="text-xs text-red-400">{portError}</p>
                    )}
                    {actualPort && (
                      <p className="text-xs text-slate-500">
                        Currently running on port <span className="text-indigo-300 font-medium">{actualPort}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Software Updates */}
                <div className="glass rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-slate-200">Software Updates</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {updateStatus === 'up-to-date' && 'You\'re running the latest version'}
                        {updateStatus === 'available' && `Version ${updateInfo?.version} is available`}
                        {updateStatus === 'downloading' && `Downloading update... ${downloadProgress}%`}
                        {updateStatus === 'ready' && `Version ${updateInfo?.version} ready to install`}
                        {updateStatus === 'checking' && 'Checking for updates...'}
                        {updateStatus === 'error' && (updateError || 'Update check failed')}
                        {!updateStatus && 'Check for the latest version'}
                      </p>
                    </div>
                  </div>

                  {/* Download progress bar */}
                  {updateStatus === 'downloading' && (
                    <div className="mb-3">
                      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {updateStatus === 'ready' ? (
                      <button
                        onClick={handleRestartForUpdate}
                        className="btn-neon text-white rounded-lg px-4 py-2 text-sm font-medium"
                      >
                        Restart &amp; Update
                      </button>
                    ) : (
                      <button
                        onClick={handleCheckForUpdates}
                        disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                        className="glass text-slate-300 hover:text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors border border-slate-600"
                      >
                        {updateStatus === 'checking' ? (
                          <span className="inline-block spin">&#x27F3;</span>
                        ) : (
                          'Check for Updates'
                        )}
                      </button>
                    )}
                  </div>

                  {updateStatus === 'error' && (
                    <p className="text-xs text-red-400 mt-2">{updateError}</p>
                  )}
                </div>

                {/* App Version */}
                {appVersion && (
                  <div className="text-center">
                    <p className="text-xs text-slate-500">
                      Code Companion v{appVersion}
                    </p>
                  </div>
                )}
              </>
            )}

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

        {activeTab === 'memory' && (
          <div className="space-y-5">
            {/* Enable/Disable toggle */}
            <div className="glass rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Memory System</p>
                <p className="text-xs text-slate-500 mt-0.5">Remember context from past conversations</p>
              </div>
              <button
                onClick={() => {
                  const next = !memoryEnabled;
                  setMemoryEnabled(next);
                  saveMemoryConfig({ enabled: next });
                }}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                  memoryEnabled ? 'bg-indigo-600' : 'bg-slate-600'
                }`}
                role="switch"
                aria-checked={memoryEnabled}
                aria-label="Toggle memory system">
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  memoryEnabled ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Embedding Model dropdown */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-medium">Embedding Model</label>
              {embeddingModels.length === 0 ? (
                <div className="glass rounded-lg p-3 text-xs text-amber-400/80 border border-amber-500/20">
                  No embedding models found. Run <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-indigo-300">ollama pull nomic-embed-text</code> to enable memory.
                </div>
              ) : (
                <select
                  value={embeddingModel}
                  onChange={e => {
                    setEmbeddingModel(e.target.value);
                    saveMemoryConfig({ embeddingModel: e.target.value });
                  }}
                  className="w-full input-glow text-slate-200 text-sm rounded-lg px-3 py-2"
                >
                  <option value="">Auto-detect</option>
                  {embeddingModels.map(m => (
                    <option key={m.name || m} value={m.name || m}>{m.name || m}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Max Context Tokens slider */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-medium">
                Max Context Tokens <span className="text-slate-500 font-normal">({maxContextTokens})</span>
              </label>
              <input
                type="range"
                min="100"
                max="2000"
                step="50"
                value={maxContextTokens}
                onChange={e => {
                  const val = parseInt(e.target.value, 10);
                  setMaxContextTokens(val);
                }}
                onMouseUp={() => saveMemoryConfig({ maxContextTokens })}
                onTouchEnd={() => saveMemoryConfig({ maxContextTokens })}
                className="w-full h-2 rounded-full bg-slate-700 outline-none cursor-pointer accent-indigo-500"
                aria-label="Max context tokens"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>100</span>
                <span>2000</span>
              </div>
            </div>

            {/* Auto-Extract toggle */}
            <div className="glass rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Auto-Extract</p>
                <p className="text-xs text-slate-500 mt-0.5">Extract memories after each conversation</p>
              </div>
              <button
                onClick={() => {
                  const next = !autoExtract;
                  setAutoExtract(next);
                  saveMemoryConfig({ autoExtract: next });
                }}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                  autoExtract ? 'bg-indigo-600' : 'bg-slate-600'
                }`}
                role="switch"
                aria-checked={autoExtract}
                aria-label="Toggle auto-extract">
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  autoExtract ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Memory Stats card */}
            {memoryStats && (
              <div className="glass rounded-lg p-4">
                <p className="text-sm font-medium text-slate-200 mb-3">Memory Stats</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="glass rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-indigo-300">{memoryStats.total ?? 0}</p>
                    <p className="text-slate-500">Total</p>
                  </div>
                  <div className="glass rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-blue-300">{memoryStats.byType?.fact ?? 0}</p>
                    <p className="text-slate-500">Facts</p>
                  </div>
                  <div className="glass rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-green-300">{memoryStats.byType?.project ?? 0}</p>
                    <p className="text-slate-500">Projects</p>
                  </div>
                  <div className="glass rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-orange-300">{memoryStats.byType?.pattern ?? 0}</p>
                    <p className="text-slate-500">Patterns</p>
                  </div>
                  <div className="glass rounded-lg p-2 text-center col-span-2">
                    <p className="text-lg font-bold text-purple-300">{memoryStats.byType?.summary ?? 0}</p>
                    <p className="text-slate-500">Summaries</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => { if (onOpenMemoryPanel) onOpenMemoryPanel(); }}
                className="flex-1 glass text-slate-300 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors border border-slate-600"
              >
                Manage Memories
              </button>
              <button
                onClick={handleReembed}
                disabled={reembedding}
                className="flex-1 glass text-slate-300 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors border border-slate-600 disabled:opacity-50"
              >
                {reembedding ? <span className="inline-block spin">&#x27F3;</span> : 'Re-embed All'}
              </button>
            </div>
          </div>
        )}

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
