import { useState, useEffect } from 'react';

/**
 * GitHub integration panel — clone repos, browse your GitHub account,
 * and manage locally cloned repos.
 *
 * Three sections:
 * 1. Clone by URL — paste any GitHub repo URL
 * 2. Your Repos — browse repos from your GitHub account (requires token)
 * 3. Cloned Repos — manage repos already cloned locally
 */
export default function GitHubPanel({ onRepoOpened, onClose }) {
  const [activeSection, setActiveSection] = useState('clone');

  // Clone by URL state
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloning, setCloning] = useState(false);
  const [cloneResult, setCloneResult] = useState(null);

  // Browse repos state
  const [browseRepos, setBrowseRepos] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState('');

  // Cloned repos state
  const [clonedRepos, setClonedRepos] = useState([]);
  const [loadingCloned, setLoadingCloned] = useState(true);

  // Token status
  const [tokenStatus, setTokenStatus] = useState(null);

  useEffect(() => {
    fetchClonedRepos();
    checkToken();
  }, []);

  async function checkToken() {
    try {
      const res = await fetch('/api/github/token/status');
      const data = await res.json();
      setTokenStatus(data);
    } catch {}
  }

  async function fetchClonedRepos() {
    setLoadingCloned(true);
    try {
      const res = await fetch('/api/github/repos');
      const data = await res.json();
      setClonedRepos(data.repos || []);
    } catch {}
    setLoadingCloned(false);
  }

  async function handleClone(url) {
    const repoUrl = url || cloneUrl;
    if (!repoUrl.trim()) return;

    setCloning(true);
    setCloneResult(null);
    try {
      const res = await fetch('/api/github/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: repoUrl }),
      });
      const data = await res.json();
      setCloneResult(data);

      if (data.success) {
        setCloneUrl('');
        fetchClonedRepos();
      }
    } catch (err) {
      setCloneResult({ success: false, error: err.message });
    }
    setCloning(false);
  }

  async function handleOpenRepo(dirName) {
    try {
      const res = await fetch('/api/github/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirName }),
      });
      const data = await res.json();
      if (data.success && onRepoOpened) {
        onRepoOpened(data.projectFolder);
      }
    } catch {}
  }

  async function handleDeleteRepo(dirName) {
    try {
      await fetch(`/api/github/repos/${encodeURIComponent(dirName)}`, { method: 'DELETE' });
      fetchClonedRepos();
    } catch {}
  }

  async function handleBrowseRepos() {
    setBrowseLoading(true);
    setBrowseError('');
    try {
      const res = await fetch('/api/github/browse');
      const data = await res.json();
      if (data.error) {
        setBrowseError(data.error);
      } else {
        setBrowseRepos(data.repos || []);
      }
    } catch (err) {
      setBrowseError(err.message);
    }
    setBrowseLoading(false);
  }

  const sections = [
    { id: 'clone', label: 'Clone URL', icon: '📥' },
    { id: 'browse', label: 'My Repos', icon: '🔍' },
    { id: 'cloned', label: `Cloned (${clonedRepos.length})`, icon: '📂' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30">
        <div className="flex items-center gap-2">
          <span className="text-lg">🐙</span>
          <h2 className="text-sm font-semibold text-slate-200">GitHub</h2>
          {tokenStatus?.configured && tokenStatus?.valid && (
            <span className="text-xs glass rounded px-1.5 py-0.5 text-green-400">
              {tokenStatus.username}
            </span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm" aria-label="Close GitHub panel">
            ✕
          </button>
        )}
      </div>

      {/* Section tabs */}
      <div className="flex border-b border-slate-700/30">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => {
              setActiveSection(s.id);
              if (s.id === 'browse' && browseRepos.length === 0 && !browseLoading) handleBrowseRepos();
              if (s.id === 'cloned') fetchClonedRepos();
            }}
            className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
              activeSection === s.id
                ? 'text-indigo-300 border-b-2 border-indigo-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="mr-1">{s.icon}</span>{s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">

        {/* ── Clone by URL ── */}
        {activeSection === 'clone' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Paste a GitHub repo URL to clone it locally for analysis.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={cloneUrl}
                onChange={e => setCloneUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleClone()}
                placeholder="https://github.com/owner/repo"
                className="flex-1 input-glow text-slate-100 rounded-lg px-3 py-2 text-xs font-mono"
              />
              <button
                onClick={() => handleClone()}
                disabled={cloning || !cloneUrl.trim()}
                className="btn-neon text-white text-xs px-3 py-2 rounded-lg disabled:opacity-50 whitespace-nowrap"
              >
                {cloning ? <span className="spin inline-block">↻</span> : 'Clone'}
              </button>
            </div>

            {cloneResult && (
              <div className={`p-2.5 rounded-lg text-xs ${
                cloneResult.success
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
                {cloneResult.success ? (
                  <div>
                    <p>{cloneResult.message}</p>
                    <button
                      onClick={() => handleOpenRepo(`${cloneResult.owner}--${cloneResult.repo}`)}
                      className="mt-2 text-indigo-400 hover:text-indigo-300 underline"
                    >
                      Open in File Browser →
                    </button>
                  </div>
                ) : (
                  cloneResult.error
                )}
              </div>
            )}

            <div className="glass rounded-lg p-3 text-xs text-slate-500">
              <p className="font-medium text-slate-400 mb-1">Accepted formats:</p>
              <ul className="space-y-0.5">
                <li><code className="text-indigo-300">https://github.com/owner/repo</code></li>
                <li><code className="text-indigo-300">owner/repo</code></li>
                <li><code className="text-indigo-300">git@github.com:owner/repo.git</code></li>
              </ul>
              {!tokenStatus?.configured && (
                <p className="mt-2 text-amber-400/80">
                  💡 Add a GitHub token in Settings for private repo access.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Browse My Repos ── */}
        {activeSection === 'browse' && (
          <div className="space-y-2">
            {!tokenStatus?.configured ? (
              <div className="glass rounded-lg p-4 text-center">
                <p className="text-sm text-slate-300 mb-2">Connect your GitHub account</p>
                <p className="text-xs text-slate-500 mb-3">Add a Personal Access Token in Settings to browse your repos.</p>
                <p className="text-xs text-slate-600">Settings → GitHub → Add Token</p>
              </div>
            ) : browseLoading ? (
              <div className="flex items-center justify-center py-8">
                <span className="spin inline-block text-indigo-400 mr-2">↻</span>
                <span className="text-xs text-slate-400">Loading your repos...</span>
              </div>
            ) : browseError ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">
                {browseError}
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-400">{browseRepos.length} repos</span>
                  <button onClick={handleBrowseRepos} className="text-xs text-indigo-400 hover:text-indigo-300">
                    ↻ Refresh
                  </button>
                </div>
                {browseRepos.map(r => (
                  <div key={r.fullName} className="glass rounded-lg p-3 hover:bg-indigo-500/5 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-slate-200 truncate">{r.name}</span>
                          {r.private && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded">private</span>
                          )}
                        </div>
                        {r.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{r.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-600">
                          {r.language && <span>{r.language}</span>}
                          {r.stars > 0 && <span>⭐ {r.stars}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleClone(r.cloneUrl)}
                        disabled={cloning}
                        className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 px-2 py-1 rounded-lg hover:bg-indigo-500/10 transition-colors whitespace-nowrap"
                      >
                        Clone
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── Cloned Repos ── */}
        {activeSection === 'cloned' && (
          <div className="space-y-2">
            {loadingCloned ? (
              <div className="flex items-center justify-center py-8">
                <span className="spin inline-block text-indigo-400 mr-2">↻</span>
                <span className="text-xs text-slate-400">Loading...</span>
              </div>
            ) : clonedRepos.length === 0 ? (
              <div className="glass rounded-lg p-4 text-center">
                <p className="text-sm text-slate-400">No repos cloned yet</p>
                <p className="text-xs text-slate-600 mt-1">Clone a repo from the Clone URL tab.</p>
              </div>
            ) : (
              clonedRepos.map(r => (
                <div key={r.dirName} className="glass rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-200">{r.owner}</span>
                        <span className="text-slate-600">/</span>
                        <span className="text-sm font-medium text-indigo-300">{r.repo}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-600">
                        <span>{r.branch}</span>
                        <span>{r.fileCount} files</span>
                        {r.lastCommit && <span className="truncate max-w-[180px]">{r.lastCommit}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleOpenRepo(r.dirName)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 px-2 py-1 rounded-lg hover:bg-indigo-500/10 transition-colors"
                        title="Open in file browser"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => handleDeleteRepo(r.dirName)}
                        className="text-xs text-red-400/60 hover:text-red-400 border border-red-500/20 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                        title="Delete cloned repo"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
