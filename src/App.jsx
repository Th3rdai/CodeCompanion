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
import TutorialPanel from './components/TutorialPanel';
import { BUILD_TUTORIAL_STEPS, CREATE_TUTORIAL_STEPS } from './data/tutorialSteps';
import ReviewPanel from './components/ReviewPanel';
import SecurityPanel from './components/SecurityPanel';
import ValidatePanel from './components/ValidatePanel';
import PromptingPanel from './components/builders/PromptingPanel';
import SkillzPanel from './components/builders/SkillzPanel';
import AgenticPanel from './components/builders/AgenticPanel';
import PlannerPanel from './components/builders/PlannerPanel';
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
import MemoryPanel from './components/MemoryPanel';
import ImageThumbnail from './components/ImageThumbnail';
import ImageLightbox from './components/ImageLightbox';
import ImagePrivacyWarning from './components/ImagePrivacyWarning';
import { validateImage, processImage, hashImage } from './lib/image-processor';
import { isConvertibleDocument, convertDocument, validateDocument, formatAsAttachment, getDocumentAcceptString } from './lib/document-processor';
import { ChevronLeft, ChevronRight, PanelLeft, Brain, BookOpen } from 'lucide-react';
import { use3DEffects } from './contexts/Effects3DContext';

const MODES = [
  { id: 'chat',           label: 'Chat',                    icon: '💬', desc: 'Let\'s talk about anything',         placeholder: "What's on your mind? Ask about code, building with AI, or just say hey..." },
  { id: 'explain',        label: 'Explain This',            icon: '💡', desc: 'Walk me through this code',         placeholder: "Paste some code and I'll walk you through it step by step..." },
  { id: 'bugs',           label: 'Safety Check',            icon: '🐛', desc: 'Spot issues before they bite',      placeholder: "Drop your code here — I'll look for anything that could cause trouble..." },
  { id: 'refactor',       label: 'Clean Up',                icon: '✨', desc: 'Help me make this better',          placeholder: "Paste code you'd like to improve — I'll show you what I'd change and why..." },
  { id: 'translate-tech', label: 'Code → Plain English',    icon: '📋', desc: 'Make this make sense to everyone',  placeholder: "Paste code or a technical description...\nI'll explain it in plain English." },
  { id: 'translate-biz',  label: 'Idea → Code Spec',        icon: '🔧', desc: 'Turn ideas into buildable specs',   placeholder: "Describe what you want built...\nI'll turn it into clear instructions for your AI coding tool." },
  { id: 'diagram',        label: 'Diagram',                 icon: '📊', desc: 'Visualize systems and processes',  placeholder: "Describe a system, process, or relationship and I'll create a diagram..." },
  { id: 'pentest',        label: 'Security',                icon: '🛡️', desc: 'OWASP security assessment',        placeholder: '' },
  { id: 'validate',       label: 'Validate',                icon: '✅', desc: 'Generate project validation',      placeholder: '' },
  { id: 'review',         label: 'Review',                  icon: '📝', desc: 'Get a code report card',           placeholder: "Submit code for a structured review with color-coded grades..." },
  { id: 'prompting',      label: 'Prompting',               icon: '🎯', desc: 'Craft and score AI prompts',       placeholder: '' },
  { id: 'skillz',         label: 'Skillz',                  icon: '⚡', desc: 'Build Claude Code skills',         placeholder: '' },
  { id: 'agentic',        label: 'Agentic',                 icon: '🤖', desc: 'Design AI agents',                 placeholder: '' },
  { id: 'planner',        label: 'Planner',                 icon: '📋', desc: 'Design and score plans',            placeholder: '' },
  { id: 'create',         label: 'Create',                  icon: '🛠️', desc: 'Start something new',              placeholder: "Tell me what you want to build and I'll help you get started..." },
  { id: 'build',          label: 'Build',                   icon: '🏗️', desc: 'Start a GSD+ICM project to build apps and tools', placeholder: 'Scaffold a project with planning and stages...' },
];

const BUILDER_MODES = ['prompting', 'skillz', 'agentic', 'planner'];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 p-3">
      <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot" />
      <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot" />
      <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot" />
    </div>
  );
}

function AttachedFiles({ files, onRemove, onImageClick }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {files.map((f, i) => (
        f.isImage || f.type === 'image' ? (
          <ImageThumbnail
            key={i}
            src={f.thumbnail}
            filename={f.name}
            size={f.size}
            format={f.format}
            dimensions={f.dimensions}
            onRemove={() => onRemove(i)}
            onClick={() => onImageClick && onImageClick(i)}
          />
        ) : (
          <div key={i} className="flex items-center gap-1.5 bg-indigo-600/15 border border-indigo-500/30 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-indigo-400">📄</span>
            <span className="text-slate-300 max-w-[120px] truncate">{f.name}</span>
            <span className="text-slate-600">{f.lines ? `${f.lines}L` : ''}</span>
            <button onClick={() => onRemove(i)} className="text-slate-500 hover:text-red-400 ml-0.5" aria-label={`Remove ${f.name}`}>✕</button>
          </div>
        )
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
  const [icmTemplatePath, setIcmTemplatePath] = useState('');
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
  const [showFileBrowser, _setShowFileBrowser] = useState(() => {
    try { return localStorage.getItem('cc-file-browser-open') === 'true'; } catch { return false; }
  });
  const setShowFileBrowser = (v) => {
    _setShowFileBrowser(v);
    try { localStorage.setItem('cc-file-browser-open', String(v)); } catch {}
  };
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
  const [showImagePrivacyWarning, setShowImagePrivacyWarning] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);
  const reviewAttachRef = useRef(null);
  const pentestAttachRef = useRef(null);
  const builderAttachRef = useRef(null);
  const [savedReview, setSavedReview] = useState(null);
  const [savedPentest, setSavedPentest] = useState(null);
  const [savedBuilderData, setSavedBuilderData] = useState(null);
  const [buildProjects, setBuildProjects] = useState(null); // null=loading, []=empty
  const [activeBuildProject, setActiveBuildProject] = useState(null);
  const [showBuildWizard, setShowBuildWizard] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(1);
  const [wizardPrefill, setWizardPrefill] = useState(null);

  // Image support state (Phase 2)
  const [processingImages, setProcessingImages] = useState(0); // Count of images currently being processed
  const [convertingDoc, setConvertingDoc] = useState(null); // filename being converted
  const processingQueue = useRef([]); // Phase 7: Queue of pending image processing tasks
  const activeProcessing = useRef(new Set()); // Phase 7: Set of currently processing file names
  const MAX_CONCURRENT_PROCESSING = 3; // Phase 7: Max concurrent image processing operations
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null); // { src, filename }
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Auto-update state
  const [updateBanner, setUpdateBanner] = useState(null); // null | { type: 'available' | 'ready', version: string }

  // Memory state
  const [activeMemories, setActiveMemories] = useState(null);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [memoryDropdownOpen, setMemoryDropdownOpen] = useState(false);

  // Agent terminal output state
  const [terminalOutput, setTerminalOutput] = useState(null); // {command, output, exitCode, status}

  // Vision model detection (Phase 4: Image Support)
  const hasImages = attachedFiles.some(f => f.type === 'image' || f.isImage);
  const selectedModelInfo = models.find(m => m.name === selectedModel);
  const isVisionModel = selectedModelInfo?.supportsVision || false;
  const showVisionWarning = hasImages && !isVisionModel;

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

  // Listen for auto-update events (Electron only)
  useEffect(() => {
    if (!window.electronAPI?.isElectron) return;

    window.electronAPI.onUpdateAvailable((info) => {
      setUpdateBanner({ type: 'available', version: info.version });
    });
    window.electronAPI.onUpdateDownloaded((info) => {
      setUpdateBanner({ type: 'ready', version: info.version });
    });
  }, []);

  function showToast(msg) { setToast(msg); }

  async function fetchConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setOllamaUrl(data.ollamaUrl || '');
      setProjectFolder(data.projectFolder || '');
      setIcmTemplatePath(data.icmTemplatePath || '');
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

  async function handleSaveSettings(newUrl, newFolder, newIcmTemplatePath) {
    try {
      await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ollamaUrl: newUrl, projectFolder: newFolder, icmTemplatePath: newIcmTemplatePath ?? icmTemplatePath }) });
      setOllamaUrl(newUrl);
      setProjectFolder(newFolder);
      if (newIcmTemplatePath !== undefined) setIcmTemplatePath(newIcmTemplatePath);
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
      // Restore saved pentest data when loading a security conversation
      if (conv.mode === 'pentest' && conv.pentestData) {
        setSavedPentest({
          ...conv.pentestData,
          deepDiveMessages: conv.pentestData.deepDiveMessages || []
        });
      } else {
        setSavedPentest(null);
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
  function startNew() { setMessages([]); setActiveConvId(null); setStats(null); setInput(''); setAttachedFiles([]); setSavedReview(null); setSavedPentest(null); setSavedBuilderData(null); setActiveMemories(null); }

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

  async function handleSavePentest(pentestData) {
    const title = pentestData.filename
      ? `Security: ${pentestData.filename}`
      : `Security Scan (${new Date().toLocaleString()})`;
    const conv = {
      id: activeConvId || undefined,
      title,
      mode: 'pentest',
      model: selectedModel,
      messages: [],
      pentestData,
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
      showToast('Security scan saved to history');
    } catch {}
  }

  async function handleUpdatePentestDeepDive(deepDiveMessages) {
    if (!activeConvId || mode !== 'pentest') return;
    try {
      const res = await fetch(`/api/history/${activeConvId}`);
      const conv = await res.json();
      if (conv.pentestData) {
        conv.pentestData.deepDiveMessages = deepDiveMessages;
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(conv),
        });
      }
    } catch {}
  }

  // Build message with attached files (text only, images handled separately)
  function buildUserContent(text, files) {
    // Filter out images - they're sent separately
    const textFiles = files.filter(f => f.type !== 'image' && !f.isImage);
    if (textFiles.length === 0) return text;

    // Safety cap per-file to prevent browser/network issues with extremely large payloads.
    // Actual context window management is handled server-side via num_ctx auto-adjustment.
    const MAX_FILE_CHARS = 500000;
    const MAX_TOTAL_CHARS = 800000;
    let totalChars = 0;

    let content = text.trim() ? text + '\n\n' : '';
    content += '---\nATTACHED FILES:\n';
    textFiles.forEach(f => {
      let fileContent = f.content || '';
      let truncated = false;
      if (fileContent.length > MAX_FILE_CHARS) {
        fileContent = fileContent.slice(0, MAX_FILE_CHARS);
        truncated = true;
      }
      if (totalChars + fileContent.length > MAX_TOTAL_CHARS) {
        fileContent = fileContent.slice(0, Math.max(0, MAX_TOTAL_CHARS - totalChars));
        truncated = true;
      }
      totalChars += fileContent.length;
      content += `\n### ${f.name}${f.path ? ' (' + f.path + ')' : ''}\n\`\`\`\n${fileContent}\n\`\`\`\n`;
      if (truncated) {
        content += `\n*(Content truncated to fit model context window — original: ${(f.content.length / 1024).toFixed(0)} KB)*\n`;
      }
      content += '\n';
    });
    return content;
  }

  async function handleSend() {
    if ((!input.trim() && attachedFiles.length === 0) || streaming || !selectedModel || showVisionWarning) return;

    // Separate text files and image files
    const imageFiles = attachedFiles.filter(f => f.type === 'image' || f.isImage);
    const images = imageFiles.map(img => img.content); // Array of base64 strings (NO prefix)

    const content = buildUserContent(input.trim(), attachedFiles);
    const userMsg = {
      role: 'user',
      content,
      ...(images.length > 0 && { images }) // Add images field if present
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages); setInput(''); setAttachedFiles([]); setStreaming(true); setStats(null); setTerminalOutput(null);
    setSendBurst(true); setTimeout(() => setSendBurst(false), 100);

    // Save user message immediately so it survives a reload
    saveConversation(newMessages, mode);

    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          mode,
          messages: newMessages.map(m => ({
            role: m.role,
            content: m.content,
            ...(m.images && { images: m.images }) // Preserve images in message history
          })),
          ...(images.length > 0 && { images }) // Send current images to API
        }) });
      const reader = res.body.getReader(); const decoder = new TextDecoder();
      let assistantContent = ''; let buffer = '';
      let lastSaveTime = Date.now();
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue; const payload = line.slice(6); if (payload === '[DONE]') break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.memoryContext) { setActiveMemories(parsed.memoryContext); }
            if (parsed.token) {
              assistantContent += parsed.token;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                  return updated;
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
            if (parsed.done) { const dur = Number(parsed.total_duration); setStats({ tokens: parsed.eval_count, duration: Number.isFinite(dur) ? (dur / 1e9).toFixed(1) : null }); setTerminalOutput(null); }
            if (parsed.error) {
              assistantContent += `\n\nError: ${parsed.error}`;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                  return updated;
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
            if (parsed.toolCallRound !== undefined) {
              // Show tool execution progress in terminal output indicator
              const calls = parsed.toolCalls || [];
              const terminalCalls = calls.filter(c => c.serverId === 'builtin');
              if (terminalCalls.length > 0) {
                setTerminalOutput({
                  command: terminalCalls.map(c => `${c.toolName}(${JSON.stringify(c.args)})`).join('; '),
                  status: 'running',
                });
              }
            }
          } catch {}
        }
        // Auto-save every 5 seconds during streaming
        if (assistantContent && Date.now() - lastSaveTime > 5000) {
          lastSaveTime = Date.now();
          saveConversation([...newMessages, { role: 'assistant', content: assistantContent }], mode);
        }
      }
      const finalMessages = [...newMessages, { role: 'assistant', content: assistantContent }];
      setMessages(finalMessages); saveConversation(finalMessages, mode);
    } catch (err) {
      // Phase 6: Vision-specific error messages
      const hasImages = images && images.length > 0;
      let errorMsg = `Oops, I couldn't reach Ollama just now. No worries — let's check that it's running and try again!`;

      if (hasImages) {
        errorMsg = `Vision inference failed. ${selectedModel} may not support images, or Ollama may not be running.`;
      }

      setMessages([...newMessages, { role: 'assistant', content: `${errorMsg}\n\nTechnical detail: ${err.message}` }]);
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
    // In pentest mode, route file to SecurityPanel
    if (mode === 'pentest' && pentestAttachRef.current) {
      pentestAttachRef.current(fileData);
      return;
    }
    // In builder modes, route file to BaseBuilderPanel to load into form
    if (BUILDER_MODES.includes(mode) && builderAttachRef.current) {
      builderAttachRef.current(fileData);
      return;
    }
    setAttachedFiles(prev => [...prev, fileData]);
    showToast(`Attached: ${fileData.name}`);
  }
  function removeAttachedFile(index) { setAttachedFiles(prev => prev.filter((_, i) => i !== index)); }

  // Vision model helpers (Phase 4: Image Support)
  function switchToVisionModel() {
    const visionModel = models.find(m => m.supportsVision);
    if (visionModel) {
      setSelectedModel(visionModel.name);
      showToast(`Switched to vision model: ${visionModel.name}`);
    } else {
      showToast('No vision models available. Install one with: ollama pull llava');
    }
  }

  function removeAllImages() {
    setAttachedFiles(prev => prev.filter(f => f.type !== 'image' && !f.isImage));
    showToast('Removed all images');
  }

  // Phase 8: Privacy warning helper
  function checkAndShowImagePrivacyWarning() {
    const hasSeenWarning = localStorage.getItem('cc-image-privacy-accepted') === 'true';
    if (!hasSeenWarning) {
      setShowImagePrivacyWarning(true);
      return true; // Showed warning, upload should wait
    }
    return false; // No warning needed, proceed with upload
  }

  // Phase 7: Image processing queue
  async function queueImageProcessing(file, config) {
    return new Promise((resolve, reject) => {
      processingQueue.current.push({ file, config, resolve, reject });
      processNextInQueue();
    });
  }

  async function processNextInQueue() {
    // Check if we can process more
    if (activeProcessing.current.size >= MAX_CONCURRENT_PROCESSING) return;
    if (processingQueue.current.length === 0) return;

    const { file, config, resolve, reject } = processingQueue.current.shift();
    activeProcessing.current.add(file.name);

    // Update processing count
    setProcessingImages(prev => prev + 1);

    try {
      const result = await processImage(file, config);
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      activeProcessing.current.delete(file.name);
      setProcessingImages(prev => prev - 1);
      // Process next in queue
      processNextInQueue();
    }
  }

  // Lightbox handlers
  function openLightbox(imageIndex) {
    const imageFiles = attachedFiles.filter(f => f.type === 'image' || f.isImage);
    if (imageIndex >= 0 && imageIndex < imageFiles.length) {
      const img = imageFiles[imageIndex];
      setLightboxImage({
        src: img.thumbnail, // Use thumbnail which has data URI prefix
        filename: img.name
      });
      setLightboxIndex(imageIndex);
      setLightboxOpen(true);
    }
  }

  function openLightboxFromMessage(imageBase64, filename, allImages, index) {
    // Reconstruct data URI for display (images in messages are stored as raw base64)
    const src = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
    setLightboxImage({ src, filename });
    setLightboxIndex(index || 0);
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
    setLightboxImage(null);
  }

  function navigateLightbox(newIndex) {
    const imageFiles = attachedFiles.filter(f => f.type === 'image' || f.isImage);
    if (newIndex >= 0 && newIndex < imageFiles.length) {
      const img = imageFiles[newIndex];
      setLightboxImage({
        src: img.thumbnail,
        filename: img.name
      });
      setLightboxIndex(newIndex);
    }
  }

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    for (const file of files) {
      // Check for convertible documents (PDF, PPTX, DOCX, etc.)
      if (isConvertibleDocument(file)) {
        const validation = validateDocument(file);
        if (!validation.valid) {
          alert(validation.error);
          continue;
        }
        setConvertingDoc(file.name);
        try {
          const result = await convertDocument(file);
          const attachment = formatAsAttachment(result, file);
          setAttachedFiles(prev => [...prev, attachment]);
        } catch (err) {
          alert(`Failed to convert "${file.name}": ${err.message}`);
        } finally {
          setConvertingDoc(null);
        }
        continue;
      }

      const isImage = file.type.startsWith('image/');

      if (isImage) {
        // Phase 8: Check for privacy warning on first image upload
        const shouldWait = checkAndShowImagePrivacyWarning();
        if (shouldWait) {
          continue; // User will re-upload after accepting warning
        }

        // Handle image file
        try {
          // Get config for validation
          const configRes = await fetch('/api/config');
          const config = await configRes.json();

          // Validate image
          const validation = await validateImage(file, config.imageSupport || {});
          if (!validation.valid) {
            showToast(`❌ ${file.name}: ${validation.error}`);
            continue;
          }

          // Phase 7: Process image via queue (max 3 concurrent)
          const processed = await queueImageProcessing(file, config.imageSupport || {});

          // Check for duplicates
          const hash = await hashImage(processed.base64);
          const isDuplicate = attachedFiles.some(f => f.hash === hash);
          if (isDuplicate) {
            const proceed = confirm(`${file.name} appears to be a duplicate. Attach anyway?`);
            if (!proceed) continue;
          }

          // Attach image
          attachFile({
            name: file.name,
            content: processed.base64, // NO data URI prefix (for API)
            type: 'image',
            isImage: true,
            thumbnail: processed.thumbnail, // WITH data URI prefix (for display)
            size: processed.size,
            dimensions: processed.dimensions,
            format: processed.format,
            hash
          });
        } catch (err) {
          // Phase 6: Categorize processing errors for better user feedback
          const msg = err.message.toLowerCase();
          if (msg.includes('dimension')) {
            showToast(`❌ ${file.name}: Image too large to process`);
          } else if (msg.includes('canvas') || msg.includes('context')) {
            showToast(`❌ ${file.name}: Failed to process image (browser error)`);
          } else if (msg.includes('memory') || msg.includes('out of')) {
            showToast(`❌ Out of memory. Try smaller images or fewer at once.`);
          } else if (msg.includes('corrupt') || msg.includes('invalid')) {
            showToast(`❌ ${file.name}: Corrupted or invalid image file`);
          } else {
            showToast(`❌ ${file.name}: ${err.message}`);
          }
        }
        // Phase 7: Processing count now handled by queue
      } else {
        // Handle text file
        const reader = new FileReader();
        reader.onload = (ev) => {
          attachFile({
            name: file.name,
            content: ev.target.result,
            lines: ev.target.result.split('\n').length,
            type: 'text'
          });
        };
        reader.readAsText(file);
      }
    }
    e.target.value = '';
  }

  // Drag and drop
  function handleDragEnter(e) { e.preventDefault(); dragCounter.current++; setDragging(true); }
  function handleDragLeave(e) { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setDragging(false); }
  function handleDragOver(e) { e.preventDefault(); }
  async function handleDrop(e) {
    e.preventDefault(); dragCounter.current = 0; setDragging(false);
    const files = Array.from(e.dataTransfer.files);

    for (const file of files) {
      // Skip directories — they have no size and can't be read as text
      if (file.size === 0 && file.type === '') continue;

      // Check for convertible documents
      if (isConvertibleDocument(file)) {
        const validation = validateDocument(file);
        if (!validation.valid) continue;
        setConvertingDoc(file.name);
        try {
          const result = await convertDocument(file);
          const attachment = formatAsAttachment(result, file);
          setAttachedFiles(prev => [...prev, attachment]);
        } catch (err) {
          console.error('Document conversion failed:', err);
        } finally {
          setConvertingDoc(null);
        }
        continue;
      }

      const isImage = file.type.startsWith('image/');

      if (isImage) {
        // Phase 8: Check for privacy warning on first image upload
        const shouldWait = checkAndShowImagePrivacyWarning();
        if (shouldWait) {
          continue; // User will re-upload after accepting warning
        }

        // Handle image file
        try {
          // Get config for validation
          const configRes = await fetch('/api/config');
          const config = await configRes.json();

          // Validate image
          const validation = await validateImage(file, config.imageSupport || {});
          if (!validation.valid) {
            showToast(`❌ ${file.name}: ${validation.error}`);
            continue;
          }

          // Phase 7: Process image via queue (max 3 concurrent)
          const processed = await queueImageProcessing(file, config.imageSupport || {});

          // Check for duplicates
          const hash = await hashImage(processed.base64);
          const isDuplicate = attachedFiles.some(f => f.hash === hash);
          if (isDuplicate) {
            const proceed = confirm(`${file.name} appears to be a duplicate. Attach anyway?`);
            if (!proceed) continue;
          }

          // Attach image
          attachFile({
            name: file.name,
            content: processed.base64, // NO data URI prefix (for API)
            type: 'image',
            isImage: true,
            thumbnail: processed.thumbnail, // WITH data URI prefix (for display)
            size: processed.size,
            dimensions: processed.dimensions,
            format: processed.format,
            hash
          });
        } catch (err) {
          // Phase 6: Categorize processing errors for better user feedback
          const msg = err.message.toLowerCase();
          if (msg.includes('dimension')) {
            showToast(`❌ ${file.name}: Image too large to process`);
          } else if (msg.includes('canvas') || msg.includes('context')) {
            showToast(`❌ ${file.name}: Failed to process image (browser error)`);
          } else if (msg.includes('memory') || msg.includes('out of')) {
            showToast(`❌ Out of memory. Try smaller images or fewer at once.`);
          } else if (msg.includes('corrupt') || msg.includes('invalid')) {
            showToast(`❌ ${file.name}: Corrupted or invalid image file`);
          } else {
            showToast(`❌ ${file.name}: ${err.message}`);
          }
        }
        // Phase 7: Processing count now handled by queue
      } else {
        // Handle text file
        const reader = new FileReader();
        reader.onload = (ev) => {
          attachFile({
            name: file.name,
            content: ev.target.result,
            lines: ev.target.result.split('\n').length,
            type: 'text'
          });
        };
        reader.readAsText(file);
      }
    }
  }

  // Toolbar actions
  async function handlePaste() {
    try { const text = await navigator.clipboard.readText(); setInput(prev => prev + text); textareaRef.current?.focus(); showToast('Pasted from clipboard'); }
    catch { showToast('Clipboard access denied'); }
  }

  // Clipboard paste support for images
  async function handlePasteImage(e) {
    const items = Array.from(e.clipboardData?.items || []);

    for (const item of items) {
      // Handle direct image data (screenshots, copied images)
      if (item.type.startsWith('image/')) {
        e.preventDefault(); // Don't paste as text

        const file = item.getAsFile();
        if (!file) continue;

        // Phase 8: Check for privacy warning on first image upload
        const shouldWait = checkAndShowImagePrivacyWarning();
        if (shouldWait) {
          continue; // User will re-paste after accepting warning
        }

        try {
          // Get config for validation
          const configRes = await fetch('/api/config');
          const config = await configRes.json();

          // Validate image
          const validation = await validateImage(file, config.imageSupport || {});
          if (!validation.valid) {
            showToast(`❌ Pasted image: ${validation.error}`);
            continue;
          }

          // Phase 7: Process image via queue (max 3 concurrent)
          const processed = await queueImageProcessing(file, config.imageSupport || {});

          // Check for duplicates
          const hash = await hashImage(processed.base64);
          const isDuplicate = attachedFiles.some(f => f.hash === hash);
          if (isDuplicate) {
            const proceed = confirm('This image appears to be a duplicate. Attach anyway?');
            if (!proceed) continue;
          }

          // Attach image
          attachFile({
            name: file.name || `pasted-image-${Date.now()}.png`,
            content: processed.base64, // NO data URI prefix (for API)
            type: 'image',
            isImage: true,
            thumbnail: processed.thumbnail, // WITH data URI prefix (for display)
            size: processed.size,
            dimensions: processed.dimensions,
            format: processed.format,
            hash
          });

          showToast('✓ Image pasted from clipboard');
        } catch (err) {
          // Phase 6: Categorize processing errors for better user feedback
          const msg = err.message.toLowerCase();
          if (msg.includes('dimension')) {
            showToast(`❌ Pasted image too large to process`);
          } else if (msg.includes('canvas') || msg.includes('context')) {
            showToast(`❌ Failed to process pasted image (browser error)`);
          } else if (msg.includes('memory') || msg.includes('out of')) {
            showToast(`❌ Out of memory. Try a smaller image.`);
          } else if (msg.includes('corrupt') || msg.includes('invalid')) {
            showToast(`❌ Corrupted or invalid pasted image`);
          } else {
            showToast(`❌ Failed to process pasted image: ${err.message}`);
          }
        }
        // Phase 7: Processing count now handled by queue
      }
    }
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
  function handleSaveChat() {
    if (!messages.length) { showToast('No conversation to save'); return; }
    // Build brief filename from first user message
    const firstUser = messages.find(m => m.role === 'user');
    const snippet = firstUser
      ? firstUser.content.replace(/[^a-zA-Z0-9 ]/g, '').trim().split(/\s+/).slice(0, 2).join('-').toLowerCase() || 'chat'
      : 'chat';
    const date = new Date().toISOString().slice(0, 10);
    const modeLabel = MODES.find(m => m.id === mode)?.label || mode;

    // Format entire conversation as markdown
    const lines = [`# ${modeLabel} — ${date}\n`];
    for (const msg of messages) {
      if (msg.role === 'user') {
        lines.push(`## You\n\n${msg.content}\n`);
      } else if (msg.role === 'assistant') {
        lines.push(`## Assistant\n\n${msg.content}\n`);
      }
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${snippet}-${date}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Chat saved');
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

  async function handleCreateOpenInBuild(projectPath, data) {
    // Register the created project in the Build registry and switch to Build mode
    const name = data?.name || projectPath.split('/').pop();
    try {
      await fetch('/api/build/projects/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, projectPath }),
      });
    } catch {}
    await fetchBuildProjects();
    // Find and select the newly registered project
    try {
      const res = await fetch('/api/build/projects');
      const projects = await res.json();
      const newest = projects.find(p => p.path === projectPath);
      if (newest) setActiveBuildProject(newest.id);
      setBuildProjects(projects);
    } catch {}
    setShowBuildWizard(false);
    setMode('build');
    showToast(`"${name}" opened in Build mode`);
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
    <div className="fixed inset-0 flex mesh-gradient overflow-hidden">
      {/* Auto-update banner */}
      {updateBanner && (
        <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 px-4 py-2 text-sm"
          style={{ background: updateBanner.type === 'ready' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(99, 102, 241, 0.15)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <span className="text-slate-200">
            {updateBanner.type === 'available'
              ? `Version ${updateBanner.version} is available and downloading...`
              : `Version ${updateBanner.version} is ready to install`}
          </span>
          {updateBanner.type === 'ready' && (
            <button
              onClick={() => window.electronAPI.restartForUpdate()}
              className="btn-neon text-white rounded px-3 py-1 text-xs font-medium"
            >
              Restart &amp; Update
            </button>
          )}
          <button
            onClick={() => setUpdateBanner(null)}
            className="text-slate-400 hover:text-white ml-2"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
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
            {activeMemories?.count > 0 && (
              <div className="relative">
                <button
                  onClick={() => setMemoryDropdownOpen(!memoryDropdownOpen)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors text-purple-300 border-purple-500/30 bg-purple-600/10 hover:bg-purple-500/20"
                  title="Memories used in this response"
                >
                  <Brain className="w-3.5 h-3.5" />
                  Memory ({activeMemories.count})
                </button>
                {memoryDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-72 glass-heavy rounded-lg border border-slate-700/50 p-3 z-50 shadow-xl">
                    <p className="text-xs font-medium text-slate-300 mb-2">Memories used:</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
                      {activeMemories.items?.map((m, i) => (
                        <div key={i} className="text-xs text-slate-400 glass rounded p-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium mr-1.5 ${
                            m.type === 'fact' ? 'bg-blue-500/15 text-blue-300' :
                            m.type === 'project' ? 'bg-green-500/15 text-green-300' :
                            m.type === 'pattern' ? 'bg-orange-500/15 text-orange-300' :
                            'bg-purple-500/15 text-purple-300'
                          }`}>{m.type}</span>
                          <span className="line-clamp-2">{m.content}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => { setMemoryDropdownOpen(false); setShowMemoryPanel(true); }}
                      className="mt-2 w-full text-xs text-indigo-300 hover:text-indigo-200 py-1 transition-colors"
                    >
                      Manage all memories...
                    </button>
                  </div>
                )}
              </div>
            )}
            <button onClick={fetchModels} disabled={refreshing}
              className="text-slate-400 hover:text-indigo-300 text-sm px-2 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors disabled:opacity-50" title="Refresh models">
              <span className={refreshing ? 'inline-block spin' : ''}>&#x27F3;</span>
            </button>
            <label htmlFor="model-select" className="sr-only">Select AI model</label>
            <select id="model-select" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
              className="input-glow text-slate-200 text-sm rounded-lg px-3 py-1.5 max-w-[200px]">
              {models.length === 0 && <option value="">No models found</option>}
              {[...models]
                .sort((a, b) => {
                  // Sort vision models to top when images attached (Phase 4: Image Support)
                  if (hasImages) {
                    return (b.supportsVision ? 1 : 0) - (a.supportsVision ? 1 : 0);
                  }
                  return 0;
                })
                .map(m => (
                  <option key={m.name} value={m.name}>
                    {m.supportsVision ? '👁️ ' : ''}{m.name} ({m.paramSize || m.size + 'GB'})
                  </option>
                ))
              }
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
            ) : mode === 'pentest' ? (
              <SecurityPanel
                selectedModel={selectedModel}
                connected={connected}
                streaming={streaming}
                onAttachFromBrowser={pentestAttachRef}
                onOpenFileBrowser={() => { setShowFileBrowser(true); setShowGitHub(false); }}
                onToast={showToast}
                savedPentest={savedPentest}
                onSavePentest={handleSavePentest}
                models={models}
                onSetSelectedModel={setSelectedModel}
                onUpdatePentestDeepDive={handleUpdatePentestDeepDive}
              />
            ) : mode === 'validate' ? (
              <ValidatePanel
                selectedModel={selectedModel}
                connected={connected}
                onToast={showToast}
                models={models}
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
                  onLoadFile={builderAttachRef}
                  projectFolder={projectFolder}
                />
              ) : mode === 'skillz' ? (
                <SkillzPanel
                  selectedModel={selectedModel}
                  connected={connected}
                  models={models}
                  onToast={setToast}
                  savedData={savedBuilderData}
                  onSaveBuilder={handleSaveBuilder}
                  onLoadFile={builderAttachRef}
                  projectFolder={projectFolder}
                />
              ) : mode === 'agentic' ? (
                <AgenticPanel
                  selectedModel={selectedModel}
                  connected={connected}
                  models={models}
                  onToast={setToast}
                  savedData={savedBuilderData}
                  onSaveBuilder={handleSaveBuilder}
                  onLoadFile={builderAttachRef}
                  projectFolder={projectFolder}
                />
              ) : (
                <PlannerPanel
                  selectedModel={selectedModel}
                  connected={connected}
                  models={models}
                  onToast={setToast}
                  savedData={savedBuilderData}
                  onSaveBuilder={handleSaveBuilder}
                  onLoadFile={builderAttachRef}
                  projectFolder={projectFolder}
                />
              )
            ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4" role="log" aria-label="Chat messages" aria-live="polite">
              {mode === 'create' ? (
                <>
                  <div className="sticky top-0 z-10 -mx-4 -mt-4 px-4 pt-4 pb-2 mb-2 bg-slate-900/95 backdrop-blur border-b border-slate-700/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">Create project</span>
                      <button
                        type="button"
                        onClick={() => { setShowTutorial(!showTutorial); if (!showTutorial) setTutorialStep(1); setWizardPrefill(null); }}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-base shadow-lg transition-all ${showTutorial ? 'bg-amber-500 text-slate-900 ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900' : 'bg-amber-400 text-slate-900 hover:bg-amber-300 ring-2 ring-amber-400/50 animate-pulse'}`}
                        aria-label={showTutorial ? 'Hide tutorial' : 'Show step-by-step tutorial'}
                      >
                        <BookOpen className="w-5 h-5 shrink-0" aria-hidden />
                        {showTutorial ? 'Tutorial on' : 'Start tutorial'}
                      </button>
                    </div>
                  </div>
                  {showTutorial && (
                    <TutorialPanel
                      mode="create"
                      currentStep={tutorialStep}
                      onStepChange={(s) => { setTutorialStep(s); setWizardPrefill(null); }}
                      onPrefillStep={(stepNum, data) => setWizardPrefill({ step: stepNum, data })}
                      onClose={() => setShowTutorial(false)}
                      totalSteps={5}
                    />
                  )}
                  <CreateWizard
                    defaultOutputRoot={projectFolder || '~/AI_Dev/'}
                    onSuccess={handleCreateSuccess}
                    onOpenInBuild={handleCreateOpenInBuild}
                    onToast={showToast}
                    step={showTutorial ? tutorialStep : undefined}
                    onStepChange={showTutorial ? setTutorialStep : undefined}
                    prefill={wizardPrefill}
                    tutorialActive={showTutorial}
                    tutorialSuggestions={showTutorial ? CREATE_TUTORIAL_STEPS[tutorialStep - 1]?.prefill ?? null : null}
                  />
                </>
              ) : mode === 'build' ? (
                showBuildWizard ? (
                <>
                  <div className="sticky top-0 z-10 -mx-4 -mt-4 px-4 pt-4 pb-2 mb-2 bg-slate-900/95 backdrop-blur border-b border-slate-700/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">New build project</span>
                      <button
                        type="button"
                        onClick={() => { setShowTutorial(!showTutorial); if (!showTutorial) setTutorialStep(1); setWizardPrefill(null); }}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-base shadow-lg transition-all ${showTutorial ? 'bg-amber-500 text-slate-900 ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900' : 'bg-amber-400 text-slate-900 hover:bg-amber-300 ring-2 ring-amber-400/50 animate-pulse'}`}
                        aria-label={showTutorial ? 'Hide tutorial' : 'Show step-by-step tutorial'}
                      >
                        <BookOpen className="w-5 h-5 shrink-0" aria-hidden />
                        {showTutorial ? 'Tutorial on' : 'Start tutorial'}
                      </button>
                    </div>
                  </div>
                  {showTutorial && (
                    <TutorialPanel
                      mode="build"
                      currentStep={tutorialStep}
                      onStepChange={(s) => { setTutorialStep(s); setWizardPrefill(null); }}
                      onPrefillStep={(stepNum, data) => setWizardPrefill({ step: stepNum, data })}
                      onClose={() => setShowTutorial(false)}
                      totalSteps={4}
                    />
                  )}
                  <BuildWizard
                    defaultOutputRoot={projectFolder || '~/AI_Dev/'}
                    onSuccess={handleBuildProjectCreated}
                    onToast={showToast}
                    onCancel={() => { setShowBuildWizard(false); setShowTutorial(false); }}
                    step={showTutorial ? tutorialStep : undefined}
                    onStepChange={showTutorial ? setTutorialStep : undefined}
                    prefill={wizardPrefill}
                    tutorialActive={showTutorial}
                    tutorialSuggestions={showTutorial ? BUILD_TUTORIAL_STEPS[tutorialStep - 1]?.prefill ?? null : null}
                  />
                </>
                ) : (
                  <BuildPanel
                    projects={buildProjects}
                    activeProject={activeBuildProject}
                    onSelectProject={setActiveBuildProject}
                    onNewProject={() => setShowBuildWizard(true)}
                    onViewFiles={(p) => { setProjectFolder(p); setShowFileBrowser(true); }}
                    onRefresh={fetchBuildProjects}
                    onToast={showToast}
                    selectedModel={selectedModel}
                    ollamaConnected={connected}
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
                      <MessageBubble
                        role={msg.role}
                        content={msg.content}
                        streaming={streaming && i === messages.length - 1 && msg.role === 'assistant'}
                        images={msg.images}
                        onImageClick={openLightboxFromMessage}
                      />
                      {msg.role === 'assistant' && !streaming && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><CopyButton text={msg.content} /></div>
                      )}
                    </div>
                  ))}
                  {streaming && messages[messages.length - 1]?.role !== 'assistant' && <TypingIndicator3D mode={mode} />}
                  {terminalOutput && (
                    <div className="mx-4 my-2 glass rounded-xl border border-indigo-500/20 overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 border-b border-indigo-500/20">
                        <span className="text-xs font-mono text-indigo-300">
                          {terminalOutput.status === 'running' ? (
                            <><span className="inline-block animate-spin mr-1">&#x27F3;</span> Running command...</>
                          ) : (
                            <>&#x2713; Command completed</>
                          )}
                        </span>
                      </div>
                      {terminalOutput.command && (
                        <pre className="px-3 py-2 text-xs text-slate-400 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto scrollbar-thin">
                          {terminalOutput.command}
                        </pre>
                      )}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
            )}

            {/* Stats — holographic token counter */}
            {stats && mode !== 'review' && mode !== 'pentest' && (
              <div className="glass border-t border-slate-700/30 px-4 py-1.5 flex items-center gap-4 text-xs text-slate-500">
                <span>Model: <strong className="text-slate-400">{selectedModel}</strong></span>
                <TokenCounter tokens={stats.tokens} duration={stats.duration} />
              </div>
            )}

            {/* Input — hidden in Create and Review modes */}
            {mode !== 'create' && mode !== 'build' && mode !== 'review' && mode !== 'pentest' && !BUILDER_MODES.includes(mode) && (
            <div className={`glass-heavy border-t border-slate-700/30 p-4 ${dragging ? 'drop-zone-active' : ''}`}>
              <AttachedFiles files={attachedFiles} onRemove={removeAttachedFile} onImageClick={openLightbox} />

              {/* Vision Model Warning (Phase 4: Image Support) */}
              {showVisionWarning && (
                <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-3 mb-3 rounded">
                  <p className="text-sm text-yellow-200 flex items-center gap-2 flex-wrap">
                    <span className="shrink-0">⚠️ Current model doesn't support images.</span>
                    <button
                      onClick={switchToVisionModel}
                      className="underline hover:text-yellow-100 transition-colors"
                      type="button"
                    >
                      Switch to vision model
                    </button>
                    <span className="text-yellow-300/60">or</span>
                    <button
                      onClick={removeAllImages}
                      className="underline hover:text-yellow-100 transition-colors"
                      type="button"
                    >
                      remove images
                    </button>
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <div className="flex-1 flex flex-col gap-1.5">
                  <label htmlFor="chat-input" className="sr-only">Type your message</label>
                  <textarea id="chat-input" ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} onPaste={handlePasteImage}
                    placeholder={connected ? (attachedFiles.length > 0 ? 'Add a note about these files, or just hit Send — I\'ll take a look!' : currentMode?.placeholder) : 'Let\'s get connected first — click Settings up top to set up Ollama...'}
                    rows={4} disabled={streaming || !connected}
                    className="flex-1 input-glow text-slate-100 font-mono text-sm rounded-xl px-4 py-3 resize-none placeholder-slate-500 disabled:opacity-50" />
                  <div className="flex items-center gap-1.5 pl-1">
                    <input id="chat-file-input" ref={fileInputRef} type="file" multiple aria-label="Attach files to chat"
                      accept=".js,.jsx,.ts,.tsx,.py,.json,.md,.txt,.html,.css,.yaml,.yml,.sh,.sql,.go,.rs,.java,.c,.cpp,.h,.toml,.xml,.csv,.env,.svelte,.vue,image/*,.png,.jpg,.jpeg,.gif,.pdf,.pptx,.docx,.xlsx,.xls,.doc,.ppt,.odt,.ods,.odp,.rtf,.tex,.epub" className="hidden" onChange={handleFileUpload} />
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
                    <button onClick={handleSaveChat} title="Save entire conversation as Markdown file"
                      className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                      💾 Save Chat
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
                  <button onClick={handleSend} disabled={(!input.trim() && attachedFiles.length === 0) || streaming || !connected || !selectedModel || showVisionWarning}
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
                attachLabel={BUILDER_MODES.includes(mode) ? 'Load into Form' : mode === 'review' || mode === 'pentest' ? 'Load for Review' : '+ Attach to Chat'}
                onClose={() => setShowFileBrowser(false)}
                onClearFolder={async () => {
                  setProjectFolder('');
                  try { await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectFolder: '' }) }); } catch {}
                }}
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

      {showSettings && <SettingsPanel ollamaUrl={ollamaUrl} projectFolder={projectFolder} icmTemplatePath={icmTemplatePath} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} onOpenMemoryPanel={() => { setShowSettings(false); setShowMemoryPanel(true); }} />}
      {showMemoryPanel && <MemoryPanel onClose={() => setShowMemoryPanel(false)} />}
      {renaming && <RenameModal currentName={renaming.title} onSave={(name) => renameConversation(renaming.id, name)} onClose={() => setRenaming(null)} />}
      {showGlossary && <GlossaryPanel onClose={() => setShowGlossary(false)} />}
      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}
      {showOllamaSetup && <OllamaSetup onComplete={() => { setShowOllamaSetup(false); fetchModels(); }} />}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* Image Lightbox (Phase 2: Image Support) */}
      {lightboxOpen && lightboxImage && (
        <ImageLightbox
          isOpen={lightboxOpen}
          onClose={closeLightbox}
          src={lightboxImage.src}
          filename={lightboxImage.filename}
          images={attachedFiles.filter(f => f.type === 'image' || f.isImage).map(f => f.thumbnail)}
          currentIndex={lightboxIndex}
          onNavigate={navigateLightbox}
        />
      )}

      {/* Processing Images Indicator */}
      {processingImages > 0 && (
        <div className="fixed bottom-4 right-4 z-50 glass-heavy border border-indigo-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot" />
            <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot" />
            <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot" />
          </div>
          <span className="text-sm text-slate-300">Processing {processingImages} image{processingImages > 1 ? 's' : ''}...</span>
        </div>
      )}

      {/* Document Conversion Indicator */}
      {convertingDoc && (
        <div className="fixed bottom-4 right-4 z-50 glass-heavy border border-indigo-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="inline-block animate-spin text-indigo-400">&#x27F3;</span>
          <span className="text-sm text-slate-300">Converting {convertingDoc}...</span>
        </div>
      )}

      {/* Image Privacy Warning (Phase 8: Security) */}
      {showImagePrivacyWarning && (
        <ImagePrivacyWarning
          onClose={() => setShowImagePrivacyWarning(false)}
          onAccept={() => {
            setShowImagePrivacyWarning(false);
            showToast('✓ You can now upload images');
          }}
        />
      )}
    </div>
  );
}
