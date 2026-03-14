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
import ReviewPanel from './components/ReviewPanel';
import OnboardingWizard, { isOnboardingComplete } from './components/OnboardingWizard';
import { GlossaryPanel } from './components/JargonGlossary';
import PrivacyBanner from './components/PrivacyBanner';
import ParticleField from './components/3d/ParticleField';
import FloatingGeometry from './components/3d/FloatingGeometry';
import TypingIndicator3D from './components/3d/TypingIndicator3D';
import ParticleBurst from './components/3d/ParticleBurst';
import TokenCounter from './components/3d/TokenCounter';
import OrbitingBadge from './components/3d/OrbitingBadge';

const MODES = [
  { id: 'chat',           label: 'Chat',                    icon: '💬', desc: 'Let\'s talk about anything',         placeholder: "What's on your mind? Ask about code, building with AI, or just say hey..." },
  { id: 'explain',        label: 'Explain This',            icon: '💡', desc: 'Walk me through this code',         placeholder: "Paste some code and I'll walk you through it step by step..." },
  { id: 'bugs',           label: 'Safety Check',            icon: '🐛', desc: 'Spot issues before they bite',      placeholder: "Drop your code here — I'll look for anything that could cause trouble..." },
  { id: 'refactor',       label: 'Clean Up',                icon: '✨', desc: 'Help me make this better',          placeholder: "Paste code you'd like to improve — I'll show you what I'd change and why..." },
  { id: 'translate-tech', label: 'Code → Plain English',    icon: '📋', desc: 'Make this make sense to everyone',  placeholder: "Paste code or a technical description...\nI'll explain it in plain English." },
  { id: 'translate-biz',  label: 'Idea → Code Spec',        icon: '🔧', desc: 'Turn ideas into buildable specs',   placeholder: "Describe what you want built...\nI'll turn it into clear instructions for your AI coding tool." },
  { id: 'review',         label: 'Review',                  icon: '📝', desc: 'Get a code report card',           placeholder: "Submit code for a structured review with color-coded grades..." },
  { id: 'create',         label: 'Create',                  icon: '🛠️', desc: 'Start something new',              placeholder: "Tell me what you want to build and I'll help you get started..." },
];

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
  const [splashDismissed, setSplashDismissed] = useState(
    () => sessionStorage.getItem('th3rdai_splash_dismissed') === 'true'
  );
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [connected, setConnected] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [projectFolder, setProjectFolder] = useState('');
  const [mode, setMode] = useState('chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [history, setHistory] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);
  const reviewAttachRef = useRef(null);
  const [savedReview, setSavedReview] = useState(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streaming]);
  useEffect(() => { fetchConfig(); fetchModels(); fetchHistory(); }, []);

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
        if (data.models.length > 0 && !selectedModel) setSelectedModel(data.models[0].name);
      } else { setConnected(false); setOllamaUrl(data.ollamaUrl || ''); }
    } catch { setConnected(false); }
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
        setSavedReview(conv.reviewData);
      } else {
        setSavedReview(null);
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

  function handleRenameRequest(id) { const h = history.find(c => c.id === id); if (h) setRenaming({ id, title: h.title || 'Untitled' }); }
  function startNew() { setMessages([]); setActiveConvId(null); setStats(null); setInput(''); setAttachedFiles([]); setSavedReview(null); }

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
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectFolder: projectPath })
      });
    } catch {}
    setProjectFolder(projectPath);
    setShowFileBrowser(true);
    setShowGitHub(false);
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
        onArchive={archiveConversation} open={sidebarOpen} onClose={() => setSidebarOpen(false)}
        showArchived={showArchived} onToggleArchived={() => setShowArchived(!showArchived)} modes={MODES} />

      <main className="flex-1 flex flex-col min-w-0 relative"
        onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>

        {/* Header */}
        <header className="glass-heavy border-b border-slate-700/30 px-4 py-3 flex items-center gap-3 relative overflow-hidden">
          <HeaderScene />
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-slate-400 hover:text-white text-xl relative z-10" aria-label="Toggle sidebar">&#9776;</button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0 relative z-10">
            <img src="/logo.svg" alt="Th3rdAI" className="w-14 h-14" />
            <div>
              <h1 className="text-lg font-bold leading-tight">
                <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Th3rdAI</span>
                <span className="text-slate-300 ml-1.5 font-medium text-base">Code Companion</span>
              </h1>
              <p className="text-xs text-slate-500 truncate">Your friendly guide to all things code</p>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10">
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
        <Splite color="#6366f1" height={1} speed={2} />

        {/* Offline Banner */}
        {!connected && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3 flex items-center gap-3">
            <span className="text-amber-400 text-sm">&#9888;</span>
            <div className="flex-1 text-sm text-amber-300">
              Hmm, I can't connect to Ollama at <code className="bg-amber-500/10 px-1.5 py-0.5 rounded text-xs">{ollamaUrl}</code>. Let's get that sorted — make sure Ollama is running!
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
            <div className="glass border-b border-slate-700/30 px-4 py-2 flex gap-2 overflow-x-auto relative overflow-hidden">
              <FloatingGeometry shapeCount={5} />
              {MODES.map(m => (
                <button key={m.id} onClick={() => setMode(m.id)}
                  className={`relative z-10 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all
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
                onToast={showToast}
                onSwitchToChat={(msgs) => { setMode('chat'); if (msgs) setMessages(msgs); }}
                savedReview={savedReview}
                onSaveReview={handleSaveReview}
              />
            ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4" role="log" aria-label="Chat messages" aria-live="polite">
              {mode === 'create' ? (
                <CreateWizard
                  defaultOutputRoot={projectFolder || '~/AI_Dev/'}
                  onSuccess={handleCreateSuccess}
                  onToast={showToast}
                />
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
            {mode !== 'create' && mode !== 'review' && (
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
                  <ParticleBurst trigger={sendBurst} />
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
              <FileBrowser projectFolder={projectFolder} onAttachFile={attachFile} onClose={() => setShowFileBrowser(false)} />
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
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
