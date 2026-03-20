import { useState, useEffect } from 'react';
import { parseApiJson } from '../utils/parseApiJson';

/**
 * GitHub integration panel — clone repos, browse your GitHub account,
 * and manage locally cloned repos.
 *
 * Three sections:
 * 1. Clone by URL — paste any GitHub repo URL
 * 2. Your Repos — browse repos from your GitHub account (requires token)
 * 3. Cloned Repos — manage repos already cloned locally
 */
export default function GitHubPanel({ onRepoOpened, onClose, selectedModel }) {
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

  // Publish (Create & Push) state
  const [pubRepoName, setPubRepoName] = useState('');
  const [pubDescription, setPubDescription] = useState('');
  const [pubPrivate, setPubPrivate] = useState(false);
  const [pubLocalPath, setPubLocalPath] = useState('');
  const [pubCommitMsg, setPubCommitMsg] = useState('Initial commit');
  const [publishing, setPublishing] = useState(false);
  const [pubResult, setPubResult] = useState(null);
  const [pubStep, setPubStep] = useState('');

  // Local VCS state
  const [gitStatus, setGitStatus] = useState(null);
  const [gitLoading, setGitLoading] = useState(false);
  const [gitError, setGitError] = useState('');
  const [branchName, setBranchName] = useState('');
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [selectedDiffFile, setSelectedDiffFile] = useState('');
  const [diffContent, setDiffContent] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [mergeSourceBranch, setMergeSourceBranch] = useState('');
  const [mergePreview, setMergePreview] = useState(null);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState('');
  const [inlineComments, setInlineComments] = useState({});

  // PM integration state
  const [pmProvider, setPmProvider] = useState('jira');
  const [pmLoading, setPmLoading] = useState(false);
  const [pmError, setPmError] = useState('');
  const [pmItems, setPmItems] = useState([]);
  const [jiraBaseUrl, setJiraBaseUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [jiraJql, setJiraJql] = useState('project = YOURPROJECT ORDER BY updated DESC');
  const [trelloBoardId, setTrelloBoardId] = useState('');
  const [trelloKey, setTrelloKey] = useState('');
  const [trelloToken, setTrelloToken] = useState('');
  const [asanaProjectId, setAsanaProjectId] = useState('');
  const [asanaToken, setAsanaToken] = useState('');

  useEffect(() => {
    fetchClonedRepos();
    checkToken();
  }, []);

  async function checkToken() {
    try {
      const res = await fetch('/api/github/token/status');
      const data = await parseApiJson(res);
      setTokenStatus(data);
    } catch {}
  }

  async function fetchClonedRepos() {
    setLoadingCloned(true);
    try {
      const res = await fetch('/api/github/repos');
      const data = await parseApiJson(res);
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
      const data = await parseApiJson(res);
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
      const data = await parseApiJson(res);
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
      const data = await parseApiJson(res);
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

  async function fetchGitStatus() {
    setGitLoading(true);
    setGitError('');
    try {
      const res = await fetch('/api/git/status');
      const data = await parseApiJson(res);
      if (!res.ok || data.error) {
        setGitError(data.error || 'Failed to load git status');
        setGitStatus(null);
      } else {
        setGitStatus(data);
        const firstBranch = (data.branches || []).find(b => b !== data.branch);
        if (firstBranch && !mergeSourceBranch) setMergeSourceBranch(firstBranch);
        if (data.repoPath) {
          try {
            const saved = JSON.parse(localStorage.getItem(`cc-vcs-comments:${data.repoPath}`) || '{}');
            setInlineComments(saved && typeof saved === 'object' ? saved : {});
          } catch {
            setInlineComments({});
          }
        }
      }
    } catch (err) {
      setGitError(err.message);
      setGitStatus(null);
    }
    setGitLoading(false);
  }

  async function handleCreateBranch() {
    if (!branchName.trim()) return;
    setCreatingBranch(true);
    setGitError('');
    try {
      const res = await fetch('/api/git/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: branchName.trim(), checkout: true })
      });
      const data = await parseApiJson(res);
      if (!res.ok || data.error) {
        setGitError(data.error || 'Failed to create branch');
      } else {
        setBranchName('');
        await fetchGitStatus();
      }
    } catch (err) {
      setGitError(err.message);
    }
    setCreatingBranch(false);
  }

  async function fetchDiff(filePath = '') {
    setDiffLoading(true);
    try {
      const query = filePath ? `?file=${encodeURIComponent(filePath)}` : '';
      const res = await fetch(`/api/git/diff${query}`);
      const data = await parseApiJson(res);
      setDiffContent(data.diff || '');
    } catch {
      setDiffContent('Unable to load diff.');
    }
    setDiffLoading(false);
  }

  async function handleMergePreview() {
    if (!mergeSourceBranch) return;
    setMergeLoading(true);
    setMergePreview(null);
    try {
      const res = await fetch('/api/git/merge-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceBranch: mergeSourceBranch, targetRef: 'HEAD' })
      });
      const data = await parseApiJson(res);
      setMergePreview(data);
    } catch (err) {
      setMergePreview({ hasConflicts: false, preview: `Preview failed: ${err.message}` });
    }
    setMergeLoading(false);
  }

  async function handleResolveConflict(filePath, strategy) {
    try {
      await fetch('/api/git/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, strategy })
      });
      await fetchGitStatus();
      await fetchDiff(filePath);
    } catch {}
  }

  async function handleAutomatedReview() {
    if (!selectedModel) {
      setReviewResult('Pick an AI model from the header first, then we can run the review!');
      return;
    }
    setReviewLoading(true);
    setReviewResult('');
    try {
      const res = await fetch('/api/git/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel, filePath: selectedDiffFile || '' })
      });
      const data = await parseApiJson(res);
      setReviewResult(data.review || data.error || 'No review output.');
    } catch (err) {
      setReviewResult(`Review failed: ${err.message}`);
    }
    setReviewLoading(false);
  }

  function updateInlineComment(filePath, value) {
    if (!gitStatus?.repoPath) return;
    const next = { ...inlineComments, [filePath]: value };
    setInlineComments(next);
    localStorage.setItem(`cc-vcs-comments:${gitStatus.repoPath}`, JSON.stringify(next));
  }

  async function fetchPmItems() {
    setPmLoading(true);
    setPmError('');
    setPmItems([]);
    try {
      let endpoint = '';
      let payload = {};
      if (pmProvider === 'jira') {
        endpoint = '/api/pm/jira/issues';
        payload = {
          baseUrl: jiraBaseUrl.trim(),
          email: jiraEmail.trim(),
          apiToken: jiraToken.trim(),
          jql: jiraJql.trim()
        };
      } else if (pmProvider === 'trello') {
        endpoint = '/api/pm/trello/cards';
        payload = {
          boardId: trelloBoardId.trim(),
          key: trelloKey.trim(),
          token: trelloToken.trim()
        };
      } else {
        endpoint = '/api/pm/asana/tasks';
        payload = {
          projectId: asanaProjectId.trim(),
          accessToken: asanaToken.trim()
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await parseApiJson(res);
      if (!res.ok || data.error) {
        setPmError(data.error || 'Failed to fetch items');
      } else {
        setPmItems(data.items || []);
      }
    } catch (err) {
      setPmError(err.message);
    }
    setPmLoading(false);
  }

  async function handlePublish() {
    if (!pubRepoName.trim() || !pubLocalPath.trim()) return;
    setPublishing(true);
    setPubResult(null);

    try {
      // Step 1: Create repo on GitHub
      setPubStep('Creating repository on GitHub...');
      const createRes = await fetch('/api/github/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pubRepoName.trim(), description: pubDescription.trim(), isPrivate: pubPrivate }),
      });
      const createData = await parseApiJson(createRes);
      if (!createRes.ok || !createData.success) {
        setPubResult({ ok: false, message: createData.error || 'Failed to create repository' });
        setPublishing(false);
        return;
      }

      // Step 2: Init local repo and push
      setPubStep('Pushing code to GitHub...');
      const pushRes = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localPath: pubLocalPath.trim(),
          remoteUrl: createData.cloneUrl,
          commitMessage: pubCommitMsg.trim() || 'Initial commit',
          branch: 'main',
        }),
      });
      const pushData = await parseApiJson(pushRes);
      if (pushData.success) {
        setPubResult({ ok: true, message: `Published to GitHub!`, url: createData.url, fullName: createData.fullName });
      } else {
        setPubResult({ ok: false, message: pushData.error || 'Push failed' });
      }
    } catch (err) {
      setPubResult({ ok: false, message: err.message || 'Network error' });
    }
    setPubStep('');
    setPublishing(false);
  }

  const sections = [
    { id: 'clone', label: 'Clone URL', icon: '📥' },
    { id: 'publish', label: 'Publish', icon: '🚀' },
    { id: 'browse', label: 'My Repos', icon: '🔍' },
    { id: 'cloned', label: `Cloned (${clonedRepos.length})`, icon: '📂' },
    { id: 'vcs', label: 'VCS', icon: '🧬' },
    { id: 'pm', label: 'PM', icon: '🗂️' },
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
              if (s.id === 'vcs') fetchGitStatus();
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
              Got a repo you want to explore? Paste the URL and I'll grab it for you.
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
              <p className="font-medium text-slate-400 mb-1">Any of these formats work:</p>
              <ul className="space-y-0.5">
                <li><code className="text-indigo-300">https://github.com/owner/repo</code></li>
                <li><code className="text-indigo-300">owner/repo</code></li>
                <li><code className="text-indigo-300">git@github.com:owner/repo.git</code></li>
              </ul>
              {!tokenStatus?.configured && (
                <p className="mt-2 text-amber-400/80">
                  💡 Want to clone private repos? Add a GitHub token in Settings!
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Publish (Create & Push) ── */}
        {activeSection === 'publish' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Create a new GitHub repo and push a local project to it in one step.
            </p>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Local project folder</label>
              <input type="text" value={pubLocalPath} onChange={e => setPubLocalPath(e.target.value)}
                placeholder="~/AI_Dev/my-project"
                className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 outline-none font-mono text-xs" />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Repository name</label>
              <input type="text" value={pubRepoName} onChange={e => setPubRepoName(e.target.value)}
                placeholder="my-project"
                className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 outline-none text-xs" />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Description (optional)</label>
              <input type="text" value={pubDescription} onChange={e => setPubDescription(e.target.value)}
                placeholder="A short description"
                className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 outline-none text-xs" />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Commit message</label>
              <input type="text" value={pubCommitMsg} onChange={e => setPubCommitMsg(e.target.value)}
                placeholder="Initial commit"
                className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 outline-none text-xs" />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
              <input type="checkbox" checked={pubPrivate} onChange={e => setPubPrivate(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/40" />
              Private repository
            </label>

            <button onClick={handlePublish}
              disabled={publishing || !pubRepoName.trim() || !pubLocalPath.trim()}
              className="w-full btn-neon disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-sm font-medium">
              {publishing ? pubStep || 'Publishing...' : '🚀 Create Repo & Push'}
            </button>

            {pubResult && (
              <div className={`p-3 rounded-lg text-xs ${pubResult.ok
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                <p>{pubResult.message}</p>
                {pubResult.url && (
                  <a href={pubResult.url} target="_blank" rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 underline mt-1 inline-block">
                    {pubResult.fullName} →
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Browse My Repos ── */}
        {activeSection === 'browse' && (
          <div className="space-y-2">
            {!tokenStatus?.configured ? (
              <div className="glass rounded-lg p-4 text-center">
                <p className="text-sm text-slate-300 mb-2">Let's connect your GitHub!</p>
                <p className="text-xs text-slate-500 mb-3">Add a Personal Access Token in Settings and you'll be able to browse all your repos right here.</p>
                <p className="text-xs text-slate-600">Head to Settings, then GitHub, then Add Token</p>
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
                <p className="text-sm text-slate-400">No repos here yet!</p>
                <p className="text-xs text-slate-600 mt-1">Head over to Clone URL and grab one to get started.</p>
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

        {/* ── Local VCS ── */}
        {activeSection === 'vcs' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">Your local git at a glance — branches, diffs, and conflict help.</p>
              <button onClick={fetchGitStatus} className="text-xs text-indigo-400 hover:text-indigo-300">↻ Refresh</button>
            </div>

            {gitLoading && (
              <div className="text-xs text-slate-500">Loading git status...</div>
            )}

            {gitError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-xs text-red-400">
                {gitError}
              </div>
            )}

            {gitStatus && (
              <>
                <div className="glass rounded-lg p-3 text-xs text-slate-300 space-y-1">
                  <div><span className="text-slate-500">Repo:</span> <span className="font-mono">{gitStatus.repoPath}</span></div>
                  <div>
                    <span className="text-slate-500">Branch:</span> <span className="text-indigo-300">{gitStatus.branch}</span>
                    <span className="text-slate-500 ml-3">Ahead:</span> {gitStatus.ahead}
                    <span className="text-slate-500 ml-2">Behind:</span> {gitStatus.behind}
                  </div>
                  <div><span className="text-slate-500">Changed files:</span> {gitStatus.changedFiles?.length || 0}</div>
                </div>

                <div className="glass rounded-lg p-3 space-y-2">
                  <p className="text-xs text-slate-400">Automatic branching</p>
                  <div className="flex gap-2">
                    <input
                      value={branchName}
                      onChange={e => setBranchName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateBranch()}
                      placeholder="feature/my-branch"
                      className="flex-1 input-glow text-slate-100 rounded-lg px-3 py-2 text-xs font-mono"
                    />
                    <button
                      onClick={handleCreateBranch}
                      disabled={creatingBranch || !branchName.trim()}
                      className="btn-neon text-white text-xs px-3 py-2 rounded-lg disabled:opacity-50"
                    >
                      {creatingBranch ? 'Creating...' : 'Create + Checkout'}
                    </button>
                  </div>
                </div>

                <div className="glass rounded-lg p-3 space-y-2">
                  <p className="text-xs text-slate-400">Merge conflict preview</p>
                  <div className="flex gap-2">
                    <select
                      value={mergeSourceBranch}
                      onChange={e => setMergeSourceBranch(e.target.value)}
                      className="flex-1 input-glow text-slate-100 rounded-lg px-3 py-2 text-xs"
                    >
                      <option value="">Select source branch...</option>
                      {(gitStatus.branches || []).filter(b => b !== gitStatus.branch).map(branch => (
                        <option key={branch} value={branch}>{branch}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleMergePreview}
                      disabled={mergeLoading || !mergeSourceBranch}
                      className="text-xs border border-indigo-500/30 text-indigo-300 px-3 py-2 rounded-lg hover:bg-indigo-500/10 disabled:opacity-50"
                    >
                      {mergeLoading ? 'Checking...' : 'Preview'}
                    </button>
                  </div>
                  {mergePreview && (
                    <div className={`text-xs rounded-lg p-2 border ${
                      mergePreview.hasConflicts
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : 'bg-green-500/10 border-green-500/30 text-green-300'
                    }`}>
                      {mergePreview.hasConflicts ? 'Conflicts detected in merge preview.' : 'No conflicts detected.'}
                    </div>
                  )}
                  {mergePreview?.preview && (
                    <pre className="max-h-44 overflow-auto text-[10px] font-mono bg-slate-900/60 border border-slate-700/50 rounded p-2 text-slate-300 whitespace-pre-wrap">
                      {mergePreview.preview}
                    </pre>
                  )}
                </div>

                <div className="glass rounded-lg p-3 space-y-2">
                  <p className="text-xs text-slate-400">Code diff visualization</p>
                  <div className="flex gap-2">
                    <select
                      value={selectedDiffFile}
                      onChange={(e) => {
                        const next = e.target.value;
                        setSelectedDiffFile(next);
                        fetchDiff(next);
                      }}
                      className="flex-1 input-glow text-slate-100 rounded-lg px-3 py-2 text-xs"
                    >
                      <option value="">All changed files</option>
                      {(gitStatus.changedFiles || []).map(file => (
                        <option key={file.path} value={file.path}>{file.path}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => fetchDiff(selectedDiffFile)}
                      className="text-xs border border-indigo-500/30 text-indigo-300 px-3 py-2 rounded-lg hover:bg-indigo-500/10"
                    >
                      Load Diff
                    </button>
                  </div>
                  <pre className="max-h-56 overflow-auto text-[10px] font-mono bg-slate-900/60 border border-slate-700/50 rounded p-2 text-slate-300 whitespace-pre-wrap">
                    {diffLoading ? 'Loading diff...' : (diffContent || 'No diff output.')}
                  </pre>
                </div>

                <div className="glass rounded-lg p-3 space-y-2">
                  <p className="text-xs text-slate-400">Automated code review</p>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500">
                      Scope: {selectedDiffFile ? selectedDiffFile : 'All changed files'}
                    </span>
                    <button
                      onClick={handleAutomatedReview}
                      disabled={reviewLoading}
                      className="text-xs border border-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 disabled:opacity-50"
                    >
                      {reviewLoading ? 'Reviewing...' : 'Run AI Review'}
                    </button>
                  </div>
                  <pre className="max-h-56 overflow-auto text-[11px] font-mono bg-slate-900/60 border border-slate-700/50 rounded p-2 text-slate-300 whitespace-pre-wrap">
                    {reviewResult || 'No automated review yet.'}
                  </pre>
                </div>

                <div className="glass rounded-lg p-3 space-y-2">
                  <p className="text-xs text-slate-400">Inline review comments</p>
                  {(gitStatus.changedFiles || []).length === 0 ? (
                    <p className="text-xs text-slate-500">No changed files available for comments.</p>
                  ) : (
                    (gitStatus.changedFiles || []).map(file => (
                      <div key={file.path} className="space-y-1">
                        <div className="text-[11px] text-slate-400">{file.path}</div>
                        <textarea
                          value={inlineComments[file.path] || ''}
                          onChange={(e) => updateInlineComment(file.path, e.target.value)}
                          placeholder="Add review feedback for this file..."
                          rows={2}
                          className="w-full input-glow text-slate-100 rounded-lg px-2 py-1.5 text-xs"
                        />
                      </div>
                    ))
                  )}
                </div>

                {(gitStatus.conflicts || []).length > 0 && (
                  <div className="glass rounded-lg p-3 space-y-2">
                    <p className="text-xs text-slate-400">Merge conflict resolution</p>
                    {(gitStatus.conflicts || []).map(filePath => (
                      <div key={filePath} className="flex items-center justify-between gap-2 text-xs">
                        <code className="text-slate-300 truncate">{filePath}</code>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleResolveConflict(filePath, 'ours')}
                            className="px-2 py-1 rounded border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
                          >
                            Use Ours
                          </button>
                          <button
                            onClick={() => handleResolveConflict(filePath, 'theirs')}
                            className="px-2 py-1 rounded border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
                          >
                            Use Theirs
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── PM Tools ── */}
        {activeSection === 'pm' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">Pull in tasks and issues from Jira, Trello, or Asana — all in one place.</p>

            <div className="flex gap-1">
              {['jira', 'trello', 'asana'].map(provider => (
                <button
                  key={provider}
                  onClick={() => { setPmProvider(provider); setPmError(''); setPmItems([]); }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs border ${
                    pmProvider === provider
                      ? 'border-indigo-500/40 text-indigo-300 bg-indigo-600/10'
                      : 'border-slate-700/50 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {provider.toUpperCase()}
                </button>
              ))}
            </div>

            {pmProvider === 'jira' && (
              <div className="glass rounded-lg p-3 space-y-2">
                <input value={jiraBaseUrl} onChange={e => setJiraBaseUrl(e.target.value)} placeholder="Jira base URL (https://your-org.atlassian.net)" className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 text-xs" />
                <input value={jiraEmail} onChange={e => setJiraEmail(e.target.value)} placeholder="Jira email" className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 text-xs" />
                <input value={jiraToken} onChange={e => setJiraToken(e.target.value)} placeholder="Jira API token" type="password" className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 text-xs" />
                <input value={jiraJql} onChange={e => setJiraJql(e.target.value)} placeholder="JQL query" className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 text-xs font-mono" />
              </div>
            )}

            {pmProvider === 'trello' && (
              <div className="glass rounded-lg p-3 space-y-2">
                <input value={trelloBoardId} onChange={e => setTrelloBoardId(e.target.value)} placeholder="Trello board ID" className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 text-xs" />
                <input value={trelloKey} onChange={e => setTrelloKey(e.target.value)} placeholder="Trello API key" className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 text-xs" />
                <input value={trelloToken} onChange={e => setTrelloToken(e.target.value)} placeholder="Trello token" type="password" className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 text-xs" />
              </div>
            )}

            {pmProvider === 'asana' && (
              <div className="glass rounded-lg p-3 space-y-2">
                <input value={asanaProjectId} onChange={e => setAsanaProjectId(e.target.value)} placeholder="Asana project ID" className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 text-xs" />
                <input value={asanaToken} onChange={e => setAsanaToken(e.target.value)} placeholder="Asana access token" type="password" className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 text-xs" />
              </div>
            )}

            <button
              onClick={fetchPmItems}
              disabled={pmLoading}
              className="w-full text-xs border border-indigo-500/30 text-indigo-300 px-3 py-2 rounded-lg hover:bg-indigo-500/10 disabled:opacity-50"
            >
              {pmLoading ? 'Loading items...' : `Fetch ${pmProvider.toUpperCase()} Items`}
            </button>

            {pmError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-xs text-red-400">{pmError}</div>
            )}

            <div className="space-y-2">
              {(pmItems || []).length === 0 ? (
                <p className="text-xs text-slate-500">No items loaded yet.</p>
              ) : (
                pmItems.map(item => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block glass rounded-lg p-3 hover:bg-indigo-500/5 transition-colors"
                  >
                    <div className="text-sm text-slate-200">{item.title}</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {item.key} · {item.type} · {item.status}
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
