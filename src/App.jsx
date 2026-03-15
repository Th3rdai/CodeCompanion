import { useState, useEffect, useRef, useCallback } from 'react';
import MarkdownContent from './components/MarkdownContent';
import MessageBubble from './components/MessageBubble';
import Toast from './components/Toast';
import RenameModal from './components/RenameModal';
import SettingsPanel from './components/SettingsPanel';
import FileBrowser from './components/FileBrowser';
import GitHubPanel from './components/GitHubPanel';
import Sidebar from './components/Sidebar';
import Splite from './components/ui/Splite';
import SplashScreen from './components/3d/SplashScreen';
import HeaderScene from './components/3d/HeaderScene';
import EmptyStateScene from './components/3d/EmptyStateScene';
import CreateWizard from './components/CreateWizard';
import BuildWizard from './components/BuildWizard';
import BuildPanel from './components/BuildPanel';
import ReviewPanel from './components/ReviewPanel';
import PromptingPanel from './components/builders/PromptingPanel';
import SkillzPanel from './components/builders/SkillzPanel';
import AgenticPanel from './components/builders/AgenticPanel';
import OnboardingWizard, { isOnboardingComplete } from './components/OnboardingWizard';
import { GlossaryPanel } from './components/JargonGlossary';
import PrivacyBanner from './components/PrivacyBanner';
import ParticleField from './components/3d/ParticleField';
import FloatingGeometry from './components/3d/FloatingGeometry';
import TypingIndicator3D from './components/3d/TypingIndicator3D';
import ParticleBurst from './components/3d/ParticleBurst';
import TokenCounter from './components/3d/TokenCounter';
import OrbitingBadge from './components/3d/OrbitingBadge';
import OllamaSetup from './components/OllamaSetup';
import ConnectionDot from './components/ConnectionDot';
import { ChevronLeft, ChevronRight, PanelLeft } from 'lucide-react';
import { use3DEffects } from './contexts/Effects3DContext';

const MODES = [
  { id: 'chat',           label: 'Chat',                    icon: '💬', desc: 'Let\'s talk about anything',         placeholder: "What's on your mind? Ask about code, building with AI, or just say hey..." },
  { id: 'explain',        label: 'Explain This',            icon: '💡', desc: 'Walk me through this code',         placeholder: "Paste some code and I'll walk you through it step by step..." },
  { id: 'bugs',           label: 'Safety Check',            icon: '🐛', desc: 'Spot issues before they bite',      placeholder: "Drop your code here — I'll look for anything that could cause trouble..." },
  { id: 'refactor',       label: 'Clean Up',                icon: '✨', desc: 'Help me make this better',          placeholder: "Paste code you'd like to improve — I'll show you what I'd change and why..." },
  { id: 'translate-tech', label: 'Code → Plain English',    icon: '📋', desc: 'Make this make sense to everyone',  placeholder: "Paste code or a technical description...\nI'll explain it in plain English." },
  { id: 'translate-biz',  label: 'Idea → Code Spec',        icon: '🔧', desc: 'Turn ideas into buildable specs',   placeholder: "Describe what you want built...\nI'll turn it into clear instructions for your AI coding tool." },
  { id: 'review',         label: 'Review',                  icon: '📝', desc: 'Get a code report card',           placeholder: "Submit code for a structured review with color-coded grades..." },
  { id: 'prompting',      label: 'Prompting',               icon: '🎯', desc: 'Craft and score AI prompts',       placeholder: '' },
  { id: 'skillz',         label: 'Skillz',                  icon: '⚡', desc: 'Build Claude Code skills',         placeholder: '' },
  { id: 'agentic',        label: 'Agentic',                 icon: '🤖', desc: 'Design AI agents',                 placeholder: '' },
  { id: 'create',         label: 'Create',                  icon: '🛠️', desc: 'Start something new',              placeholder: "Tell me what you want to build and I'll help you get started..." },
  { id: 'build',          label: 'Build',                   icon: '🏗️', desc: 'Start a GSD+ICM project to build apps and tools', placeholder: 'Scaffold a project with planning and stages...' },
];

const BUILDER_MODES = ['prompting', 'skillz', 'agentic'];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 p-3">
      <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot" />
      <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot" />
      <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot" />
    </div>
  );
}

function AttachedFiles({ files, onRemove }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-1.5 bg-indigo-600/15 border border-indigo-500/30 rounded-lg px-2.5 py-1 text-xs">
          <span className="text-indigo-400">📄</span>
          <span className="text-slate-300 max-w-[120px] truncate">{f.name}</span>
          <span className="text-slate-600">{f.lines ? `${f.lines}L` : ''}</span>
          <button onClick={() => onRemove(i)} className="text-slate-500 hover:text-red-400 ml-0.5" aria-label={`Remove ${f.name}`}>✕</button>
        </div>
      ))}
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="glass text-xs text-slate-400 hover:text-indigo-300 px-2 py-1 rounded-lg transition-colors"
      aria-label="Copy to clipboard">
      {copied ? '✓ Copied' : '📋 Copy'}
    </button>
  );
}

export default function App() {
  // Electron detection
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;
  const { theme } = use3DEffects();

  const [splashDismissed, setSplashDismissed] = useState(
    () => sessionStorage.getItem('th3rdai_splash_dismissed') === 'true'
  );
  const [models, setModels] = useState([]);
  const [selectedModel, _setSelectedModel] = useState(() => localStorage.getItem('cc-selected-model') || '');
  const setSelectedModel = (m) => { _setSelectedModel(m); if (m) localStorage.setItem('cc-selected-model', m); };
  const [connected, setConnected] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [projectFolder, setProjectFolder] = useState('');
  const [mode, _setMode] = useState('chat');

  // Wrap setMode to persist last active mode in Electron
  const setMode = useCallback((newMode) => {
    _setMode(newMode);
    if (isElectron && window.electronAPI?.setLastMode) {
      window.electronAPI.setLastMode(newMode);
    }
  }, [isElectron]);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [history, setHistory] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('cc-sidebar-collapsed') === 'true'; } catch { return false; }
  });
  function toggleSidebarCollapsed() {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('cc-sidebar-collapsed', String(next)); } catch {}
      return next;
    });
  }
  const [showSettings, setShowSettings] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [sendBurst, setSendBurst] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingComplete());
  const [showGlossary, setShowGlossary] = useState(false);
  const [showOllamaSetup, setShowOllamaSetup] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);
  const reviewAttachRef = useRef(null);
  const [savedReview, setSavedReview] = useState(null);
  const [savedBuilderData, setSavedBuilderData] = useState(null);
  const [buildProjects, setBuildProjects] = useState(null); // null=loading, []=empty
  const [activeBuildProject, setActiveBuildProject] = useState(null);
  const [showBuildWizard, setShowBuildWizard] = useState(false);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streaming]);

  // Fetch build projects for BuildPanel
  async function fetchBuildProjects() {
    try {
      const res = await fetch('/api/build/projects');
      const data = await res.json();
      setBuildProjects(Array.isArray(data) ? data : []);
    } catch { setBuildProjects([]); }
  }

  // Initialize app on mount
  useEffect(() => {
    fetchConfig();
    fetchModels();
    fetchHistory();
    fetchBuildProjects();

    // Restore last mode in Electron
    if (isElectron && window.electronAPI?.getLastMode) {
      window.electronAPI.getLastMode().then((lastMode) => {
        if (lastMode) _setMode(lastMode);
      }).catch(() => {});
    }

    // Listen for port fallback notification in Electron
    if (isElectron && window.electronAPI?.onPortFallback) {
      window.electronAPI.onPortFallback(({ actual, preferred }) => {
        showToast(`Server started on port ${actual} (port ${preferred} was busy)`);
      });
    }
  }, [isElectron]);

  function showToast(msg) { setToast(msg); }

  async function fetchConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setOllamaUrl(data.ollamaUrl || '');
      setProjectFolder(data.projectFolder || '');
    } catch {}
  }

  async function fetchModels() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      if (data.models) {
        setModels(data.models); setConnected(true); setOllamaUrl(data.ollamaUrl || '');
        if (data.models.length > 0 && !selectedModel) {
          const saved = localStorage.getItem('cc-selected-model');
          const match = saved && data.models.find(m => m.name === saved);
          setSelectedModel(match ? match.name : data.models[0].name);
        }
      } else {
        setConnected(false);
        setOllamaUrl(data.ollamaUrl || '');
        // In Electron mode, show Ollama setup wizard if not connected and no models
        if (isElectron && models.length === 0) {
          setShowOllamaSetup(true);
        }
      }
    } catch {
      setConnected(false);
      // In Electron mode, show Ollama setup wizard on connection error
      if (isElectron && models.length === 0) {
        setShowOllamaSetup(true);
      }
    }
    setRefreshing(false);
  }

  async function fetchHistory() {
    try { const res = await fetch('/api/history'); setHistory(await res.json()); } catch {}
  }

  async function handleSaveSettings(newUrl, newFolder) {
    try {
      await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ollamaUrl: newUrl, projectFolder: newFolder }) });
      setOllamaUrl(newUrl);
      setProjectFolder(newFolder);
      await fetchModels();
      if (newFolder) setShowFileBrowser(true);
    } catch {}
  }

  async function loadConversation(id) {
    try {
      const res = await fetch(`/api/history/${id}`);
      const conv = await res.json();
      setMessages(conv.messages || []); setMode(conv.mode || 'explain'); setActiveConvId(conv.id);
      if (conv.model) setSelectedModel(conv.model);
      setAttachedFiles([]);
      // Restore saved review data when loading a review conversation
      if (conv.mode === 'review' && conv.reviewData) {
        setSavedReview({
          ...conv.reviewData,
          deepDiveMessages: conv.reviewData.deepDiveMessages || []
        });
      } else {
        setSavedReview(null);
      }
      // Restore saved builder data when loading a builder conversation
      if (conv.builderData) {
        setSavedBuilderData(conv.builderData);
      } else {
        setSavedBuilderData(null);
      }
    } catch {}
  }

  async function saveConversation(msgs, convMode, overrides = {}) {
    const title = overrides.title || msgs[0]?.content?.slice(0, 60) || 'Untitled';
    const conv = { id: activeConvId || undefined, title, mode: convMode || mode, model: selectedModel, messages: msgs, ...overrides };
    if (activeConvId) {
      const existing = history.find(h => h.id === activeConvId);
      if (existing) { conv.createdAt = existing.createdAt; if (existing.archived) conv.archived = existing.archived; }
    } else { conv.createdAt = new Date().toISOString(); }
    try {
      const res = await fetch('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(conv) });
      const { id } = await res.json();
      setActiveConvId(id); fetchHistory();
    } catch {}
  }

  async function deleteConversation(id) {
    try { await fetch(`/api/history/${id}`, { method: 'DELETE' }); if (activeConvId === id) { setMessages([]); setActiveConvId(null); } fetchHistory(); showToast('Conversation deleted'); } catch {}
  }
  async function renameConversation(id, newTitle) {
    try { const res = await fetch(`/api/history/${id}`); const conv = await res.json(); conv.title = newTitle; await fetch('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(conv) }); fetchHistory(); showToast('Renamed'); } catch {}
  }
  async function archiveConversation(id, archive) {
    try { const res = await fetch(`/api/history/${id}`); const conv = await res.json(); conv.archived = archive; await fetch('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(conv) }); if (activeConvId === id && archive) { setMessages([]); setActiveConvId(null); } fetchHistory(); showToast(archive ? 'Archived' : 'Unarchived'); } catch {}
  }
  async function exportConversation(id, format) {
    try {
      const res = await fetch(`/api/history/${id}`); const conv = await res.json();
      let content = ''; const title = conv.title || 'Untitled'; const modeLabel = MODES.find(m => m.id === conv.mode)?.label || conv.mode;
      if (format === 'md') {
        content = `# ${title}\n\n**Mode:** ${modeLabel}  \n**Model:** ${conv.model || 'N/A'}  \n**Date:** ${new Date(conv.createdAt).toLocaleString()}  \n\n---\n\n`;
        (conv.messages || []).forEach(m => { content += m.role === 'user' ? `## You\n\n\`\`\`\n${m.content}\n\`\`\`\n\n` : `## Assistant\n\n${m.content}\n\n---\n\n`; });
      } else {
        content = `${title}\nMode: ${modeLabel} | Model: ${conv.model || 'N/A'} | Date: ${new Date(conv.createdAt).toLocaleString()}\n${'='.repeat(60)}\n\n`;
        (conv.messages || []).forEach(m => { content += `[${m.role === 'user' ? 'YOU' : 'ASSISTANT'}]\n${m.content}\n\n${'-'.repeat(40)}\n\n`; });
      }
      const blob = new Blob([content], { type: 'text/plain' }); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${title.replace(/[^a-z0-9]/gi, '_').slice(0, 40)}.${format}`; a.click(); URL.revokeObjectURL(url);
      showToast(`Exported as .${format}`);
    } catch {}
  }

  async function bulkDeleteConversations(ids) {
    for (const id of ids) {
      try { await fetch(`/api/history/${id}`, { method: 'DELETE' }); if (activeConvId === id) { setMessages([]); setActiveConvId(null); } } catch {}
    }
    fetchHistory();
    showToast(`Deleted ${ids.length} conversation${ids.length !== 1 ? 's' : ''}`);
  }

  async function bulkExportConversations(ids, format) {
    for (const id of ids) { await exportConversation(id, format); }
  }

  async function bulkArchiveConversations(ids, archive) {
    for (const id of ids) {
      try {
        const res = await fetch(`/api/history/${id}`); const conv = await res.json();
        conv.archived = archive;
        await fetch('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(conv) });
        if (activeConvId === id && archive) { setMessages([]); setActiveConvId(null); }
      } catch {}
    }
    fetchHistory();
    showToast(`${archive ? 'Archived' : 'Unarchived'} ${ids.length} conversation${ids.length !== 1 ? 's' : ''}`);
  }

  function handleRenameRequest(id) { const h = history.find(c => c.id === id); if (h) setRenaming({ id, title: h.title || 'Untitled' }); }
  function startNew() { setMessages([]); setActiveConvId(null); setStats(null); setInput(''); setAttachedFiles([]); setSavedReview(null); setSavedBuilderData(null); }

  async function handleSaveReview(reviewData) {
    const title = reviewData.filename
      ? `Review: ${reviewData.filename}`
      : `Code Review (${new Date().toLocaleString()})`;
    const conv = {
      id: activeConvId || undefined,
      title,
      mode: 'review',
      model: selectedModel,
      messages: [],
      reviewData,
      createdAt: new Date().toISOString(),
    };
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conv),
      });
      const { id } = await res.json();
      setActiveConvId(id);
      fetchHistory();
      showToast('Review saved to history');
    } catch {}
  }

  const handleSaveBuilder = useCallback((data) => {
    const convData = {
      id: activeConvId || undefined,
      title: `${data.modeId === 'prompting' ? 'Prompt' : data.modeId === 'skillz' ? 'Skill' : 'Agent'}: ${data.formData?.skillName || data.formData?.agentName || data.formData?.purpose || 'Untitled'} (${new Date().toLocaleString()})`,
      mode: data.modeId,
      model: selectedModel,
      messages: [],
      builderData: data,
      overallGrade: data.scoreData?.overallGrade,
    };
    fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(convData),
    }).then(r => r.json()).then(result => {
      if (result.id) setActiveConvId(result.id);
      fetchHistory();
    });
  }, [activeConvId, selectedModel]);

  async function handleUpdateReviewDeepDive(deepDiveMessages) {
    if (!activeConvId || mode !== 'review') return;
    try {
      const res = await fetch(`/api/history/${activeConvId}`);
      const conv = await res.json();
      if (conv.reviewData) {
        conv.reviewData.deepDiveMessages = deepDiveMessages;
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(conv),
        });
      }
    } catch {}
  }

  // Build message with attached files
  function buildUserContent(text, files) {
    if (files.length === 0) return text;
    let content = text.trim() ? text + '\n\n' : '';
    files.forEach(f => {
      content += `--- File: ${f.name}${f.path ? ' (' + f.path + ')' : ''} ---\n\`\`\`\n${f.content}\n\`\`\`\n\n`;
    });
    return content;
  }

  async function handleSend() {
    if ((!input.trim() && attachedFiles.length === 0) || streaming || !selectedModel) return;
    const content = buildUserContent(input.trim(), attachedFiles);
    const userMsg = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages); setInput(''); setAttachedFiles([]); setStreaming(true); setStats(null);
    setSendBurst(true); setTimeout(() => setSendBurst(false), 100);

    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel, mode, messages: newMessages.map(m => ({ role: m.role, content: m.content })) }) });
      const reader = res.body.getReader(); const decoder = new TextDecoder();
      let assistantContent = ''; let buffer = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue; const payload = line.slice(6); if (payload === '[DONE]') break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.token) { assistantContent += parsed.token; setMessages([...newMessages, { role: 'assistant', content: assistantContent }]); }
            if (parsed.done) { setStats({ tokens: parsed.eval_count, duration: parsed.total_duration ? (parsed.total_duration / 1e9).toFixed(1) : null }); }
            if (parsed.error) { assistantContent += `\n\nError: ${parsed.error}`; setMessages([...newMessages, { role: 'assistant', content: assistantContent }]); }
          } catch {}
        }
      }
      const finalMessages = [...newMessages, { role: 'assistant', content: assistantContent }];
      setMessages(finalMessages); saveConversation(finalMessages, mode);
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `Oops, I couldn't reach Ollama just now. No worries — let's check that it's running and try again!\n\nTechnical detail: ${err.message}` }]);
    } finally { setStreaming(false); }
  }

  function handleKeyDown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }

  // File handling
  function attachFile(fileData) {
    // In review mode, route file to ReviewPanel instead of chat attachments
    if (mode === 'review' && reviewAttachRef.current) {
      reviewAttachRef.current(fileData);
      return;
    }
    setAttachedFiles(prev => [...prev, fileData]);
    showToast(`Attached: ${fileData.name}`);
  }
  function removeAttachedFile(index) { setAttachedFiles(prev => prev.filter((_, i) => i !== index)); }

  function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => { attachFile({ name: file.name, content: ev.target.result, lines: ev.target.result.split('\n').length }); };
      reader.readAsText(file);
    });
    e.target.value = '';
  }

  // Drag and drop
  function handleDragEnter(e) { e.preventDefault(); dragCounter.current++; setDragging(true); }
  function handleDragLeave(e) { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setDragging(false); }
  function handleDragOver(e) { e.preventDefault(); }
  function handleDrop(e) {
    e.preventDefault(); dragCounter.current = 0; setDragging(false);
    Array.from(e.dataTransfer.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => { attachFile({ name: file.name, content: ev.target.result, lines: ev.target.result.split('\n').length }); };
      reader.readAsText(file);
    });
  }

  // Toolbar actions
  async function handlePaste() {
    try { const text = await navigator.clipboard.readText(); setInput(prev => prev + text); textareaRef.current?.focus(); showToast('Pasted from clipboard'); }
    catch { showToast('Clipboard access denied'); }
  }
  function handleCopyLastResponse() {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistant) { navigator.clipboard.writeText(lastAssistant.content); showToast('Response copied'); }
    else { showToast('No response to copy'); }
  }
  function handleDownloadMarkdown() {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) { showToast('No response to download'); return; }
    const blob = new Blob([lastAssistant.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Markdown downloaded');
  }
  function handleClearInput() { setInput(''); setAttachedFiles([]); textareaRef.current?.focus(); }

  async function handleCreateSuccess(projectPath) {
    // Verify the folder was actually created before saving to config
    try {
      const verify = await fetch(`/api/files/tree?depth=1&folder=${encodeURIComponent(projectPath)}`);
      if (!verify.ok) {
        showToast('Project folder was not found on disk. Try creating again.');
        return;
      }
    } catch {
      showToast('Could not verify project folder exists.');
      return;
    }
    setProjectFolder(projectPath);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectFolder: projectPath })
      });
    } catch {}
    setShowFileBrowser(true);
    setShowGitHub(false);
  }

  async function handleBuildProjectCreated(projectPath, data) {
    try {
      await fetch('/api/build/projects/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data?.name || projectPath.split('/').pop(), projectPath }),
      });
    } catch {}
    await fetchBuildProjects();
    setActiveBuildProject(null); // will be set after projects reload
    setShowBuildWizard(false);
    // Find the newly registered project and select it
    try {
      const res = await fetch('/api/build/projects');
      const projects = await res.json();
      const newest = projects.find(p => p.path === projectPath);
      if (newest) setActiveBuildProject(newest.id);
      setBuildProjects(projects);
    } catch {}
  }

  const currentMode = MODES.find(m => m.id === mode);

  // Splash screen — shown once per browser session
  if (!splashDismissed) {
    return (
      <SplashScreen onDismiss={() => {
        sessionStorage.setItem('th3rdai_splash_dismissed', 'true');
        setSplashDismissed(true);
      }} />
    );
  }

  return (
    <div className="h-screen flex mesh-gradient">
      <a href="#chat-input" className="skip-link">Skip to chat input</a>

      <Sidebar history={history} activeId={activeConvId} onSelect={loadConversation} onNew={startNew}
        onDelete={deleteConversation} onRename={handleRenameRequest} onExport={exportConversation}
        onArchive={archiveConversation} onBulkDelete={bulkDeleteConversations} onBulkExport={bulkExportConversations}
        onBulkArchive={bulkArchiveConversations} open={sidebarOpen} onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebarCollapsed}
        showArchived={showArchived} onToggleArchived={() => setShowArchived(!showArchived)} modes={MODES} />

      <main className="flex-1 flex flex-col min-w-0 relative"
        onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>

        {/* Header */}
        <header className="glass-heavy border-b border-slate-700/30 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 relative overflow-hidden">
          <HeaderScene />
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700/50 relative z-10 shrink-0 order-first" aria-label="Open sidebar">
            <PanelLeft className="w-5 h-5" />
          </button>
          <button onClick={toggleSidebarCollapsed} className="hidden lg:flex items-center justify-center text-slate-400 hover:text-white w-8 h-8 rounded-lg hover:bg-slate-700/50 relative z-10 shrink-0 order-first" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-3 shrink-0 relative z-10 min-w-0">
            <img src="/logo.svg" alt="Th3rdAI" className="w-10 h-10 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight truncate">
                <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Th3rdAI</span>
                <span className="text-slate-300 ml-1.5 font-medium">Code Companion</span>
              </h1>
              <p className="text-xs text-slate-500 truncate">Your friendly guide to all things code</p>
            </div>
          </div>
          <div className="flex-1 min-w-[1rem] shrink" aria-hidden="true" />
          <div className="flex items-center gap-2 shrink-0 relative z-10 flex-wrap">
            <button onClick={() => setShowGlossary(true)}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors text-slate-400 border-slate-600 hover:bg-indigo-500/10"
              title="Jargon Glossary">
              📖 Glossary
            </button>
            <button onClick={() => { setShowGitHub(!showGitHub); if (!showGitHub) setShowFileBrowser(false); }}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors
                ${showGitHub ? 'text-indigo-300 border-indigo-500/30 bg-indigo-600/10 neon-glow-sm' : 'text-slate-400 border-slate-600 hover:bg-indigo-500/10'}`}
              title="GitHub Repos">
              🐙 GitHub
            </button>
            <button onClick={() => { setShowFileBrowser(!showFileBrowser); if (!showFileBrowser) setShowGitHub(false); }}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors
                ${showFileBrowser ? 'text-indigo-300 border-indigo-500/30 bg-indigo-600/10 neon-glow-sm' : 'text-slate-400 border-slate-600 hover:bg-indigo-500/10'}`}
              title="File Browser">
              📂 Files
            </button>
            <button onClick={() => setShowSettings(true)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                connected ? 'text-green-400 border-green-500/30 hover:bg-green-500/10' : 'text-red-400 border-red-500/30 hover:bg-red-500/10'
              }`}>
              <OrbitingBadge status={streaming ? 'streaming' : connected ? 'online' : 'offline'} size={24} />
              Settings
              <span className="text-slate-500 ml-0.5">&#9881;</span>
            </button>
            <ConnectionDot connected={connected} />
            <button onClick={fetchModels} disabled={refreshing}
              className="text-slate-400 hover:text-indigo-300 text-sm px-2 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors disabled:opacity-50" title="Refresh models">
              <span className={refreshing ? 'inline-block spin' : ''}>&#x27F3;</span>
            </button>
            <label htmlFor="model-select" className="sr-only">Select AI model</label>
            <select id="model-select" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
              className="input-glow text-slate-200 text-sm rounded-lg px-3 py-1.5 max-w-[200px]">
              {models.length === 0 && <option value="">No models found</option>}
              {models.map(m => <option key={m.name} value={m.name}>{m.name} ({m.paramSize || m.size + 'GB'})</option>)}
            </select>
          </div>
        </header>

        {/* Animated beam accent */}
        <Splite color={theme.primary} height={1} speed={2} />

        {/* Offline Banner — non-blocking info message */}
        {!connected && models.length > 0 && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3 flex items-center gap-3">
            <span className="text-amber-400 text-sm">&#9888;</span>
            <div className="flex-1 text-sm text-amber-300">
              Ollama disconnected — AI features unavailable. You can still browse your conversation history.
            </div>
            <button onClick={() => setShowSettings(true)} className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1.5 rounded-lg transition-colors">Configure</button>
            <button onClick={fetchModels} className="text-xs glass text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-600/50 transition-colors">Retry</button>
          </div>
        )}

        {/* Drag overlay */}
        {dragging && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-base/80 border-2 border-dashed border-indigo-500 rounded-2xl m-2 pointer-events-none">
            <div className="text-center">
              <div className="text-4xl mb-2">📄</div>
              <p className="text-indigo-300 font-medium neon-text">Drop your files here — I'll take a look!</p>
            </div>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Main chat area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Mode Tabs */}
            <div className="glass border-b border-slate-700/30 px-3 sm:px-4 py-2 flex flex-wrap gap-1.5 sm:gap-2 relative overflow-hidden">
              <FloatingGeometry shapeCount={5} />
              {MODES.map(m => (
                  <button key={m.id} onClick={() => setMode(m.id)}
                    className={`relative z-10 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap transition-all
                      ${mode === m.id
                        ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-medium neon-glow-sm'
                        : 'text-slate-400 hover:bg-indigo-500/10 hover:text-slate-200'}`}>
                    <span>{m.icon}</span><span>{m.label}</span>
                  </button>
              ))}
            </div>

            {/* Messages / Create Wizard / Review Panel */}
            {mode === 'review' ? (
              <ReviewPanel
                selectedModel={selectedModel}
                connected={connected}
                streaming={streaming}
                onAttachFromBrowser={reviewAttachRef}
                onOpenFileBrowser={() => { setShowFileBrowser(true); setShowGitHub(false); }}
                onToast={showToast}
                onSwitchToChat={(msgs) => { setMode('chat'); if (msgs) setMessages(msgs); }}
                savedReview={savedReview}
                onSaveReview={handleSaveReview}
                models={models}
                onSetSelectedModel={setSelectedModel}
                onUpdateReviewDeepDive={handleUpdateReviewDeepDive}
              />
            ) : BUILDER_MODES.includes(mode) ? (
              mode === 'prompting' ? (
                <PromptingPanel
                  selectedModel={selectedModel}
                  connected={connected}
                  models={models}
                  onToast={setToast}
                  savedData={savedBuilderData}
                  onSaveBuilder={handleSaveBuilder}
                />
              ) : mode === 'skillz' ? (
                <SkillzPanel
                  selectedModel={selectedModel}
                  connected={connected}
                  models={models}
                  onToast={setToast}
                  savedData={savedBuilderData}
                  onSaveBuilder={handleSaveBuilder}
                />
              ) : (
                <AgenticPanel
                  selectedModel={selectedModel}
                  connected={connected}
                  models={models}
                  onToast={setToast}
                  savedData={savedBuilderData}
                  onSaveBuilder={handleSaveBuilder}
                />
              )
            ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4" role="log" aria-label="Chat messages" aria-live="polite">
              {mode === 'create' ? (
                <CreateWizard
                  defaultOutputRoot={projectFolder || '~/AI_Dev/'}
                  onSuccess={handleCreateSuccess}
                  onToast={showToast}
                />
              ) : mode === 'build' ? (
                showBuildWizard ? (
                  <BuildWizard
                    defaultOutputRoot={projectFolder || '~/AI_Dev/'}
                    onSuccess={handleBuildProjectCreated}
                    onToast={showToast}
                    onCancel={() => setShowBuildWizard(false)}
                  />
                ) : (
                  <BuildPanel
                    projects={buildProjects}
                    activeProject={activeBuildProject}
                    onSelectProject={setActiveBuildProject}
                    onNewProject={() => setShowBuildWizard(true)}
                    onViewFiles={(p) => { setProjectFolder(p); setShowFileBrowser(true); }}
                    onRefresh={fetchBuildProjects}
                    onToast={showToast}
                  />
                )
              ) : (
                <>
                  {messages.length === 0 ? (
                    <EmptyStateScene
                      mode={mode}
                      currentMode={currentMode}
                      connected={connected}
                      selectedModel={selectedModel}
                      onSettingsClick={() => setShowSettings(true)}
                    />
                  ) : null}
                  {messages.map((msg, i) => (
                    <div key={i} className="relative group">
                      <MessageBubble role={msg.role} content={msg.content} />
                      {msg.role === 'assistant' && !streaming && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><CopyButton text={msg.content} /></div>
                      )}
                    </div>
                  ))}
                  {streaming && messages[messages.length - 1]?.role !== 'assistant' && <TypingIndicator3D />}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
            )}

            {/* Stats — holographic token counter */}
            {stats && mode !== 'review' && (
              <div className="glass border-t border-slate-700/30 px-4 py-1.5 flex items-center gap-4 text-xs text-slate-500">
                <span>Model: <strong className="text-slate-400">{selectedModel}</strong></span>
                <TokenCounter tokens={stats.tokens} duration={stats.duration} />
              </div>
            )}

            {/* Input — hidden in Create and Review modes */}
            {mode !== 'create' && mode !== 'build' && mode !== 'review' && !BUILDER_MODES.includes(mode) && (
            <div className={`glass-heavy border-t border-slate-700/30 p-4 ${dragging ? 'drop-zone-active' : ''}`}>
              <AttachedFiles files={attachedFiles} onRemove={removeAttachedFile} />
              <div className="flex gap-2">
                <div className="flex-1 flex flex-col gap-1.5">
                  <label htmlFor="chat-input" className="sr-only">Type your message</label>
                  <textarea id="chat-input" ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder={connected ? (attachedFiles.length > 0 ? 'Add a note about these files, or just hit Send — I\'ll take a look!' : currentMode?.placeholder) : 'Let\'s get connected first — click Settings up top to set up Ollama...'}
                    rows={4} disabled={streaming || !connected}
                    className="flex-1 input-glow text-slate-100 font-mono text-sm rounded-xl px-4 py-3 resize-none placeholder-slate-500 disabled:opacity-50" />
                  <div className="flex items-center gap-1.5 pl-1">
                    <input ref={fileInputRef} type="file" multiple accept=".js,.jsx,.ts,.tsx,.py,.json,.md,.txt,.html,.css,.yaml,.yml,.sh,.sql,.go,.rs,.java,.c,.cpp,.h,.toml,.xml,.csv,.env,.svelte,.vue" className="hidden" onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current?.click()} title="Upload files to attach"
                      className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                      📎 Upload
                    </button>
                    <button onClick={handlePaste} title="Paste text from clipboard"
                      className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                      📋 Paste
                    </button>
                    <button onClick={handleCopyLastResponse} title="Copy last AI response to clipboard"
                      className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                      📑 Copy Response
                    </button>
                    <button onClick={handleDownloadMarkdown} title="Download last AI response as Markdown file"
                      className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                      📝 Markdown
                    </button>
                    <button onClick={handleClearInput} title="Clear input text and attached files"
                      className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                      🧹 Clear
                    </button>
                    <span className="flex-1" />
                    <span className="text-[10px] text-slate-500">Enter to send · Shift+Enter for new line · Drag files to attach</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 relative">
                  <ParticleBurst trigger={sendBurst} color={theme.primary} />
                  <button onClick={handleSend} disabled={(!input.trim() && attachedFiles.length === 0) || streaming || !connected || !selectedModel}
                    className="flex-1 btn-neon text-white rounded-xl px-4 font-medium transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-600 disabled:shadow-none disabled:cursor-not-allowed min-w-[60px]">
                    {streaming ? '...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
            )}
          </div>

          {/* GitHub Panel (right panel) */}
          {showGitHub && (
            <aside className="w-80 border-l border-slate-700/30 glass" aria-label="GitHub repos">
              <GitHubPanel
                onRepoOpened={(folder) => {
                  setProjectFolder(folder);
                  setShowGitHub(false);
                  setShowFileBrowser(true);
                }}
                onClose={() => setShowGitHub(false)}
              />
            </aside>
          )}

          {/* File Browser (right panel) */}
          {showFileBrowser && (
            <aside aria-label="File browser">
              <FileBrowser
                projectFolder={projectFolder}
                onAttachFile={attachFile}
                onClose={() => setShowFileBrowser(false)}
                onClearFolder={() => setProjectFolder('')}
                onSetFolder={async (folder) => {
                  setProjectFolder(folder);
                  try {
                    await fetch('/api/config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ projectFolder: folder })
                    });
                  } catch {}
                }}
              />
            </aside>
          )}
        </div>

        {/* Privacy banner — bottom of main area */}
        <PrivacyBanner />
      </main>

      {showSettings && <SettingsPanel ollamaUrl={ollamaUrl} projectFolder={projectFolder} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
      {renaming && <RenameModal currentName={renaming.title} onSave={(name) => renameConversation(renaming.id, name)} onClose={() => setRenaming(null)} />}
      {showGlossary && <GlossaryPanel onClose={() => setShowGlossary(false)} />}
      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}
      {showOllamaSetup && <OllamaSetup onComplete={() => { setShowOllamaSetup(false); fetchModels(); }} />}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
