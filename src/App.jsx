import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { apiFetch } from "./lib/api-fetch";
import { copyText, readText } from "./lib/clipboard";
import MessageBubble from "./components/MessageBubble";
import Toast from "./components/Toast";
import RenameModal from "./components/RenameModal";
import SettingsPanel from "./components/SettingsPanel";
import FileBrowser from "./components/FileBrowser";
import GitHubPanel from "./components/GitHubPanel";
import TerminalPanel from "./components/TerminalPanel";
import Sidebar from "./components/Sidebar";
import Splite from "./components/ui/Splite";
import SplashScreen from "./components/3d/SplashScreen";
import HeaderScene from "./components/3d/HeaderScene";
import EmptyStateScene from "./components/3d/EmptyStateScene";
import CreateWizard from "./components/CreateWizard";
import BuildWizard from "./components/BuildWizard";
import BuildPanel from "./components/BuildPanel";
import TutorialPanel from "./components/TutorialPanel";
import {
  BUILD_TUTORIAL_STEPS,
  CREATE_TUTORIAL_STEPS,
} from "./data/tutorialSteps";
import ReviewPanel from "./components/ReviewPanel";
import SecurityPanel from "./components/SecurityPanel";
import ValidatePanel from "./components/ValidatePanel";
import ExperimentPanel from "./components/ExperimentPanel";
import PromptingPanel from "./components/builders/PromptingPanel";
import SkillzPanel from "./components/builders/SkillzPanel";
import AgenticPanel from "./components/builders/AgenticPanel";
import PlannerPanel from "./components/builders/PlannerPanel";
import OnboardingWizard, {
  isOnboardingComplete,
} from "./components/OnboardingWizard";
import { GlossaryPanel } from "./components/JargonGlossary";
import PrivacyBanner from "./components/PrivacyBanner";
import FloatingGeometry from "./components/3d/FloatingGeometry";
import TypingIndicator3D from "./components/3d/TypingIndicator3D";
import ParticleBurst from "./components/3d/ParticleBurst";
import TokenCounter from "./components/3d/TokenCounter";
import OrbitingBadge from "./components/3d/OrbitingBadge";
import OllamaSetup from "./components/OllamaSetup";
import ConnectionDot from "./components/ConnectionDot";
import MemoryPanel from "./components/MemoryPanel";
import ImageThumbnail from "./components/ImageThumbnail";
import ImageLightbox from "./components/ImageLightbox";
import ImagePrivacyWarning from "./components/ImagePrivacyWarning";
import DictateButton from "./components/DictateButton";
import ExportPanel from "./components/ExportPanel";
import ConfirmRunModal from "./components/ConfirmRunModal";
import { joinAppend } from "./lib/dictationAppend";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  PanelLeft,
  Brain,
  BookOpen,
  Search,
} from "lucide-react";
import { use3DEffects } from "./contexts/Effects3DContext";
import { useModels } from "./hooks/useModels";
import { useChat } from "./hooks/useChat";
import { useImageAttachments } from "./hooks/useImageAttachments";

const MODES = [
  {
    id: "chat",
    label: "Chat",
    icon: "💬",
    desc: "Let's talk about anything",
    placeholder:
      "What's on your mind? Ask about code, building with AI, or just say hey...",
  },
  {
    id: "explain",
    label: "Explain This",
    icon: "💡",
    desc: "Walk me through this code",
    placeholder: "Paste some code and I'll walk you through it step by step...",
  },
  {
    id: "bugs",
    label: "Safety Check",
    icon: "🐛",
    desc: "Spot issues before they bite",
    placeholder:
      "Drop your code here — I'll look for anything that could cause trouble...",
  },
  {
    id: "refactor",
    label: "Clean Up",
    icon: "✨",
    desc: "Help me make this better",
    placeholder:
      "Paste code you'd like to improve — I'll show you what I'd change and why...",
  },
  {
    id: "translate-tech",
    label: "Code → Plain English",
    icon: "📋",
    desc: "Make this make sense to everyone",
    placeholder:
      "Paste code or a technical description...\nI'll explain it in plain English.",
  },
  {
    id: "translate-biz",
    label: "Idea → Code Spec",
    icon: "🔧",
    desc: "Turn ideas into buildable specs",
    placeholder:
      "Describe what you want built...\nI'll turn it into clear instructions for your AI coding tool.",
  },
  {
    id: "diagram",
    label: "Diagram",
    icon: "📊",
    desc: "Visualize systems and processes",
    placeholder:
      "Describe a system, process, or relationship and I'll create a diagram...",
  },
  {
    id: "pentest",
    label: "Security",
    icon: "🛡️",
    desc: "OWASP security assessment",
    placeholder: "",
  },
  {
    id: "validate",
    label: "Validate",
    icon: "✅",
    desc: "Generate project validation",
    placeholder: "",
  },
  {
    id: "experiment",
    label: "Experiment",
    icon: "🧪",
    desc: "Bounded hypothesis → change → measure loops",
    placeholder: "",
  },
  {
    id: "review",
    label: "Review",
    icon: "📝",
    desc: "Get a code report card",
    placeholder:
      "Submit code for a structured review with color-coded grades...",
  },
  {
    id: "prompting",
    label: "Prompting",
    icon: "🎯",
    desc: "Craft and score AI prompts",
    placeholder: "",
  },
  {
    id: "skillz",
    label: "Skillz",
    icon: "⚡",
    desc: "Build Claude Code skills",
    placeholder: "",
  },
  {
    id: "agentic",
    label: "Agentic",
    icon: "🤖",
    desc: "Design AI agents",
    placeholder: "",
  },
  {
    id: "planner",
    label: "Planner",
    icon: "📋",
    desc: "Design and score plans",
    placeholder: "",
  },
  {
    id: "create",
    label: "Create",
    icon: "🛠️",
    desc: "Start something new",
    placeholder:
      "Tell me what you want to build and I'll help you get started...",
  },
  {
    id: "build",
    label: "Build",
    icon: "🏗️",
    desc: "Start a GSD+ICM project to build apps and tools",
    placeholder: "Scaffold a project with planning and stages...",
  },
  {
    id: "terminal",
    label: "Terminal",
    icon: "⌨️",
    desc: "Interactive shell in your project folder",
    placeholder: "",
  },
];

const BUILDER_MODES = ["prompting", "skillz", "agentic", "planner"];

/** Shown in the main strip; everything else lives under More or the command palette. */
const PRIMARY_MODE_IDS = [
  "chat",
  "review",
  "pentest",
  "build",
  "create",
  "diagram",
];

const MORE_MENU_GROUPS = [
  {
    label: "Assist",
    ids: ["explain", "bugs", "refactor", "translate-tech", "translate-biz"],
  },
  {
    label: "Builders",
    ids: ["prompting", "skillz", "agentic", "planner"],
  },
  { label: "Analyze", ids: ["validate", "experiment"] },
  { label: "Tools", ids: ["terminal"] },
];

function modeById(id) {
  return MODES.find((m) => m.id === id);
}

function AttachedFiles({ files, onRemove, onImageClick }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {files.map((f, i) =>
        f.isImage || f.type === "image" ? (
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
          <div
            key={i}
            className="flex items-center gap-1.5 bg-indigo-600/15 border border-indigo-500/30 rounded-lg px-2.5 py-1 text-xs"
          >
            <span className="text-indigo-400">📄</span>
            <span className="text-slate-300 max-w-[120px] truncate">
              {f.name}
            </span>
            <span className="text-slate-600">
              {f.lines ? `${f.lines}L` : ""}
            </span>
            <button
              onClick={() => onRemove(i)}
              className="text-slate-500 hover:text-red-400 ml-0.5"
              aria-label={`Remove ${f.name}`}
            >
              ✕
            </button>
          </div>
        ),
      )}
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        const ok = await copyText(text);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
      className="glass text-xs text-slate-400 hover:text-indigo-300 px-2 py-1 rounded-lg transition-colors"
      aria-label="Copy to clipboard"
    >
      {copied ? "✓ Copied" : "📋 Copy"}
    </button>
  );
}

export default function App() {
  // Electron detection
  const isElectron =
    typeof window !== "undefined" && window.electronAPI?.isElectron;
  const { theme } = use3DEffects();

  const [splashDismissed, setSplashDismissed] = useState(
    () => sessionStorage.getItem("th3rdai_splash_dismissed") === "true",
  );
  const [agentMaxRounds, setAgentMaxRounds] = useState(15);
  const [projectFolder, setProjectFolder] = useState("");
  const [chatFolder, setChatFolder] = useState("");
  const [icmTemplatePath, setIcmTemplatePath] = useState("");
  const [mode, _setMode] = useState("chat");

  // Wrap setMode to persist last active mode in Electron
  const setMode = useCallback(
    (newMode) => {
      _setMode(newMode);
      if (isElectron && window.electronAPI?.setLastMode) {
        window.electronAPI.setLastMode(newMode);
      }
    },
    [isElectron],
  );

  const [showOllamaSetup, setShowOllamaSetup] = useState(false);

  const {
    models,
    connected,
    ollamaUrl,
    setOllamaUrl,
    selectedModel,
    setSelectedModel,
    autoResolvedLabel,
    setAutoResolvedLabel,
    isVisionModel,
    refreshModels,
    refreshing,
  } = useModels({ isElectron, setShowOllamaSetup, mode });

  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("cc-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });
  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("cc-sidebar-collapsed", String(next));
      } catch {}
      return next;
    });
  }
  const [showSettings, setShowSettings] = useState(false);
  const [agentTerminalEnabled, setAgentTerminalEnabled] = useState(false);
  const [showFileBrowser, _setShowFileBrowser] = useState(() => {
    try {
      return localStorage.getItem("cc-file-browser-open") === "true";
    } catch {
      return false;
    }
  });
  const setShowFileBrowser = (v) => {
    _setShowFileBrowser(v);
    try {
      localStorage.setItem("cc-file-browser-open", String(v));
    } catch {}
  };
  const [showGitHub, setShowGitHub] = useState(false);
  const [toast, setToast] = useState(null);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !isOnboardingComplete(),
  );
  const [showGlossary, setShowGlossary] = useState(false);
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

  const [showMoreModes, setShowMoreModes] = useState(false);
  const [showModePalette, setShowModePalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteHighlightIndex, setPaletteHighlightIndex] = useState(0);
  const moreModesRef = useRef(null);
  const paletteInputRef = useRef(null);

  // Auto-update state
  const [updateBanner, setUpdateBanner] = useState(null); // null | { type: 'available' | 'ready', version: string }

  // Memory state
  const [activeMemories, setActiveMemories] = useState(null);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [memoryDropdownOpen, setMemoryDropdownOpen] = useState(false);

  /** Cached from GET /api/config — used for image attach (drop/paste/file) without fetching every time */
  const [imageSupportConfig, setImageSupportConfig] = useState({});

  // Agent terminal output state
  const [terminalOutput, setTerminalOutput] = useState(null); // {command, output, exitCode, status}

  const hasImages = attachedFiles.some((f) => f.type === "image" || f.isImage);
  const showVisionWarning =
    hasImages && !isVisionModel && selectedModel !== "auto";

  function showToast(msg) {
    setToast(msg);
  }

  const {
    messages,
    setMessages,
    streaming,
    activeConvId,
    setActiveConvId,
    history,
    sendBurst,
    renaming,
    setRenaming,
    showArchived,
    setShowArchived,
    stats,
    fetchHistory,
    loadConversation,
    deleteConversation,
    renameConversation,
    archiveConversation,
    exportConversation,
    bulkDeleteConversations,
    bulkExportConversations,
    bulkArchiveConversations,
    handleRenameRequest,
    startNew,
    handleSend,
    handleStopChat,
    pendingAutoSend,
    pendingConfirm,
    setPendingConfirm,
  } = useChat({
    mode,
    setMode,
    selectedModel,
    setSelectedModel,
    agentMaxRounds,
    attachedFiles,
    setAttachedFiles,
    showToast,
    setInput,
    setTerminalOutput,
    setActiveMemories,
    setAutoResolvedLabel,
    setSavedReview,
    setSavedPentest,
    setSavedBuilderData,
    modes: MODES,
    showVisionWarning,
    input,
  });

  const {
    showImagePrivacyWarning,
    setShowImagePrivacyWarning,
    processingImages,
    convertingDoc,
    lightboxOpen,
    lightboxImage,
    lightboxIndex,
    openLightbox,
    openLightboxFromMessage,
    closeLightbox,
    navigateLightbox,
    handleFileUpload,
    handleDrop,
    handlePasteImage,
  } = useImageAttachments({
    attachedFiles,
    setAttachedFiles,
    imageSupportConfig,
    showToast,
    attachFile,
    dragCounter,
    setDragging,
  });

  const selectMode = useCallback(
    (id) => {
      setMode(id);
      setShowMoreModes(false);
      setShowModePalette(false);
    },
    [setMode],
  );

  const primaryModes = useMemo(
    () => PRIMARY_MODE_IDS.map((id) => modeById(id)).filter(Boolean),
    [],
  );

  const paletteModes = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return MODES;
    return MODES.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.label.toLowerCase().includes(q) ||
        (m.desc && m.desc.toLowerCase().includes(q)),
    );
  }, [paletteQuery]);

  const currentModeIsSecondary = useMemo(
    () => !PRIMARY_MODE_IDS.includes(mode),
    [mode],
  );

  useEffect(() => {
    setPaletteHighlightIndex(0);
  }, [paletteQuery]);

  useEffect(() => {
    if (showModePalette) setPaletteHighlightIndex(0);
  }, [showModePalette]);

  useEffect(() => {
    if (!showModePalette) return;
    const id = requestAnimationFrame(() => {
      paletteInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [showModePalette]);

  useEffect(() => {
    if (!showModePalette) return;
    const onKey = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPaletteHighlightIndex((i) =>
          Math.min(i + 1, Math.max(0, paletteModes.length - 1)),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setPaletteHighlightIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter" && paletteModes.length > 0) {
        e.preventDefault();
        const m = paletteModes[paletteHighlightIndex];
        if (m) selectMode(m.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModePalette, paletteModes, paletteHighlightIndex, selectMode]);

  useEffect(() => {
    if (!showMoreModes) return;
    const close = (ev) => {
      if (moreModesRef.current && !moreModesRef.current.contains(ev.target)) {
        setShowMoreModes(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showMoreModes]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowModePalette((open) => !open);
        setShowMoreModes(false);
        return;
      }
      if (e.key === "Escape") {
        if (showModePalette) {
          e.preventDefault();
          setShowModePalette(false);
        } else if (showMoreModes) {
          setShowMoreModes(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModePalette, showMoreModes]);

  useEffect(() => {
    if (!showModePalette) setPaletteQuery("");
  }, [showModePalette]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // Fetch build projects for BuildPanel
  async function fetchBuildProjects() {
    try {
      const res = await apiFetch("/api/build/projects");
      const data = await res.json();
      setBuildProjects(Array.isArray(data) ? data : []);
    } catch {
      setBuildProjects([]);
    }
  }

  // Initialize app on mount
  useEffect(() => {
    fetchConfig();
    refreshModels();
    fetchHistory();
    fetchBuildProjects();
    apiFetch("/api/config")
      .then((r) => r.json())
      .then((d) => setAgentTerminalEnabled(!!d.agentTerminal?.enabled))
      .catch(() => {});

    // Restore last mode in Electron
    if (isElectron && window.electronAPI?.getLastMode) {
      window.electronAPI
        .getLastMode()
        .then((lastMode) => {
          if (lastMode) _setMode(lastMode);
        })
        .catch(() => {});
    }

    // Listen for port fallback notification in Electron
    if (isElectron && window.electronAPI?.onPortFallback) {
      window.electronAPI.onPortFallback(({ actual, preferred }) => {
        showToast(
          `Server started on port ${actual} (port ${preferred} was busy)`,
        );
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isElectron]);

  // Listen for auto-update events (Electron only)
  useEffect(() => {
    if (!window.electronAPI?.isElectron) return;

    window.electronAPI.onUpdateAvailable((info) => {
      setUpdateBanner({ type: "available", version: info.version });
    });
    window.electronAPI.onUpdateDownloaded((info) => {
      setUpdateBanner({ type: "ready", version: info.version });
    });
  }, []);

  async function fetchConfig() {
    try {
      const res = await apiFetch("/api/config");
      const data = await res.json();
      setOllamaUrl(data.ollamaUrl || "");
      setProjectFolder(data.projectFolder || "");
      setChatFolder(data.chatFolder || data.projectFolder || "");
      setIcmTemplatePath(data.icmTemplatePath || "");
      setImageSupportConfig(
        data.imageSupport && typeof data.imageSupport === "object"
          ? data.imageSupport
          : {},
      );
    } catch {}
  }

  async function handleSaveSettings(
    newUrl,
    newFolder,
    newIcmTemplatePath,
    extra = {},
  ) {
    try {
      const res = await apiFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ollamaUrl: newUrl,
          projectFolder: newFolder,
          icmTemplatePath: newIcmTemplatePath ?? icmTemplatePath,
          ...extra,
        }),
      });
      const data = await res.json();
      setOllamaUrl(newUrl);
      // Server normalizes empty folder to user home — keep client in sync
      if (data.projectFolder !== undefined)
        setProjectFolder(data.projectFolder);
      else if (newFolder !== undefined) setProjectFolder(newFolder);
      if (data.chatFolder !== undefined) setChatFolder(data.chatFolder);
      else if (data.projectFolder !== undefined)
        setChatFolder(data.projectFolder);
      if (newIcmTemplatePath !== undefined)
        setIcmTemplatePath(newIcmTemplatePath);
      if (data.imageSupport && typeof data.imageSupport === "object") {
        setImageSupportConfig(data.imageSupport);
      }
      await refreshModels();
      if (newFolder && String(newFolder).trim()) setShowFileBrowser(true);
    } catch {}
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleSaveReview(reviewData) {
    const title = reviewData.filename
      ? `Review: ${reviewData.filename}`
      : `Code Review (${new Date().toLocaleString()})`;
    const conv = {
      id: activeConvId || undefined,
      title,
      mode: "review",
      model: selectedModel,
      messages: [],
      reviewData,
      createdAt: new Date().toISOString(),
    };
    try {
      const res = await apiFetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(conv),
      });
      const { id } = await res.json();
      setActiveConvId(id);
      fetchHistory();
      showToast("Review saved to history");
    } catch {}
  }

  const handleSaveBuilder = useCallback(
    (data) => {
      const convData = {
        id: activeConvId || undefined,
        title: `${data.modeId === "prompting" ? "Prompt" : data.modeId === "skillz" ? "Skill" : "Agent"}: ${data.formData?.skillName || data.formData?.agentName || data.formData?.purpose || "Untitled"} (${new Date().toLocaleString()})`,
        mode: data.modeId,
        model: selectedModel,
        messages: [],
        builderData: data,
        overallGrade: data.scoreData?.overallGrade,
      };
      apiFetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(convData),
      })
        .then((r) => r.json())
        .then((result) => {
          if (result.id) setActiveConvId(result.id);
          fetchHistory();
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeConvId, selectedModel],
  );

  async function handleUpdateReviewDeepDive(deepDiveMessages) {
    if (!activeConvId || mode !== "review") return;
    try {
      const res = await apiFetch(`/api/history/${activeConvId}`);
      const conv = await res.json();
      if (conv.reviewData) {
        conv.reviewData.deepDiveMessages = deepDiveMessages;
        await apiFetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
      mode: "pentest",
      model: selectedModel,
      messages: [],
      pentestData,
      createdAt: new Date().toISOString(),
    };
    try {
      const res = await apiFetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(conv),
      });
      const { id } = await res.json();
      setActiveConvId(id);
      fetchHistory();
      showToast("Security scan saved to history");
    } catch {}
  }

  async function handleUpdatePentestDeepDive(deepDiveMessages) {
    if (!activeConvId || mode !== "pentest") return;
    try {
      const res = await apiFetch(`/api/history/${activeConvId}`);
      const conv = await res.json();
      if (conv.pentestData) {
        conv.pentestData.deepDiveMessages = deepDiveMessages;
        await apiFetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(conv),
        });
      }
    } catch {}
  }

  // File handling
  function attachFile(fileData) {
    // In review mode, route file to ReviewPanel instead of chat attachments
    if (mode === "review" && reviewAttachRef.current) {
      reviewAttachRef.current(fileData);
      return;
    }
    // In pentest mode, route file to SecurityPanel
    if (mode === "pentest" && pentestAttachRef.current) {
      pentestAttachRef.current(fileData);
      return;
    }
    // In builder modes, route file to BaseBuilderPanel to load into form
    if (BUILDER_MODES.includes(mode) && builderAttachRef.current) {
      builderAttachRef.current(fileData);
      return;
    }
    setAttachedFiles((prev) => [...prev, fileData]);
    showToast(`Attached: ${fileData.name}`);
  }
  function removeAttachedFile(index) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // Vision model helpers (Phase 4: Image Support)
  function switchToVisionModel() {
    const visionModel = models.find((m) => m.supportsVision);
    if (visionModel) {
      setSelectedModel(visionModel.name);
      showToast(`Switched to vision model: ${visionModel.name}`);
    } else {
      showToast(
        "No vision models available. Install one with: ollama pull llava",
      );
    }
  }

  function removeAllImages() {
    setAttachedFiles((prev) =>
      prev.filter((f) => f.type !== "image" && !f.isImage),
    );
    showToast("Removed all images");
  }

  // Drag and drop
  function handleDragEnter(e) {
    e.preventDefault();
    dragCounter.current++;
    setDragging(true);
  }
  function handleDragLeave(e) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }
  function handleDragOver(e) {
    e.preventDefault();
  }

  // Toolbar actions
  async function handlePaste() {
    const text = await readText();
    if (text) {
      setInput((prev) => prev + text);
      textareaRef.current?.focus();
      showToast("Pasted from clipboard");
    } else {
      // Clipboard API denied — focus textarea so user can Ctrl/Cmd+V
      textareaRef.current?.focus();
      showToast("Press Ctrl+V (or ⌘V) to paste");
    }
  }

  async function handleCopyLastResponse() {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (lastAssistant) {
      const ok = await copyText(lastAssistant.content);
      showToast(ok ? "Response copied" : "Copy failed");
    } else {
      showToast("No response to copy");
    }
  }
  function handleDownloadMarkdown() {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAssistant) {
      showToast("No response to download");
      return;
    }
    const blob = new Blob([lastAssistant.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `response-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Markdown downloaded");
  }

  function handleClearInput() {
    setInput("");
    setAttachedFiles([]);
    textareaRef.current?.focus();
  }

  function handleDictation(text) {
    setInput((prev) => joinAppend(prev, text));
    textareaRef.current?.focus();
  }

  async function handleCreateSuccess(projectPath) {
    // Verify the folder was actually created before saving to config
    try {
      const verify = await apiFetch(
        `/api/files/tree?depth=1&folder=${encodeURIComponent(projectPath)}`,
      );
      if (!verify.ok) {
        showToast("Project folder was not found on disk. Try creating again.");
        return;
      }
    } catch {
      showToast("Could not verify project folder exists.");
      return;
    }
    setProjectFolder(projectPath);
    try {
      await apiFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectFolder: projectPath }),
      });
    } catch {}
    setShowFileBrowser(true);
    setShowGitHub(false);
  }

  async function handleBuildProjectCreated(projectPath, data) {
    try {
      await apiFetch("/api/build/projects/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data?.name || projectPath.split("/").pop(),
          projectPath,
        }),
      });
    } catch {}
    await fetchBuildProjects();
    setActiveBuildProject(null); // will be set after projects reload
    setShowBuildWizard(false);
    // Find the newly registered project and select it
    try {
      const res = await apiFetch("/api/build/projects");
      const projects = await res.json();
      const newest = projects.find((p) => p.path === projectPath);
      if (newest) setActiveBuildProject(newest.id);
      setBuildProjects(projects);
    } catch {}
  }

  async function handleGeneratePRP(projectPath, data) {
    // Set project folder to newly created project
    setProjectFolder(projectPath);
    try {
      await apiFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectFolder: projectPath }),
      });
    } catch {}

    // Build the generate-prp prompt with project context
    let prpInstructions = "";
    try {
      const res = await apiFetch("/api/cre8/prp-prompt");
      if (res.ok) {
        const { content } = await res.json();
        prpInstructions = content;
      }
    } catch {}

    const projectName = data?.name || projectPath.split("/").pop();
    const initialContent = [
      `FEATURE: ${projectName}`,
      data?.description ? `\n${data.description}` : "",
      data?.role ? `\nRole: ${data.role}` : "",
      data?.audience ? `\nAudience: ${data.audience}` : "",
      data?.tone ? `\nTone: ${data.tone}` : "",
      data?.stages?.length
        ? `\nStages:\n${data.stages.map((s) => `- ${s.name}: ${s.purpose || ""}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("");

    const prompt = prpInstructions
      ? `${prpInstructions}\n\n---\n\n## Project Context (INITIAL.md)\n\n${initialContent}`
      : `Generate an execution plan (PRP) for this project:\n\n${initialContent}`;

    // Switch to chat mode and auto-send the PRP prompt
    pendingAutoSend.current = prompt;
    setMessages([]);
    setMode("chat");
    setInput("");
    showToast(`"${projectName}" — generating execution plan…`);
  }

  const currentMode = MODES.find((m) => m.id === mode);

  // Splash screen — shown once per browser session
  if (!splashDismissed) {
    return (
      <SplashScreen
        onDismiss={() => {
          sessionStorage.setItem("th3rdai_splash_dismissed", "true");
          setSplashDismissed(true);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 flex mesh-gradient overflow-hidden">
      {/* Auto-update banner */}
      {updateBanner && (
        <div
          className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 px-4 py-2 text-sm"
          style={{
            background:
              updateBanner.type === "ready"
                ? "rgba(34, 197, 94, 0.15)"
                : "rgba(99, 102, 241, 0.15)",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <span className="text-slate-200">
            {updateBanner.type === "available"
              ? `Version ${updateBanner.version} is available and downloading...`
              : `Version ${updateBanner.version} is ready to install`}
          </span>
          {updateBanner.type === "ready" && (
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
      <a href="#chat-input" className="skip-link">
        Skip to chat input
      </a>

      <Sidebar
        history={history}
        activeId={activeConvId}
        onSelect={loadConversation}
        onNew={startNew}
        onDelete={deleteConversation}
        onRename={handleRenameRequest}
        onExport={exportConversation}
        onArchive={archiveConversation}
        onBulkDelete={bulkDeleteConversations}
        onBulkExport={bulkExportConversations}
        onBulkArchive={bulkArchiveConversations}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
        showArchived={showArchived}
        onToggleArchived={() => setShowArchived(!showArchived)}
        modes={MODES}
        projectFolder={projectFolder}
        onHealthClick={() => setMode("validate")}
      />

      <main
        className="flex-1 flex flex-col min-w-0 relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Header */}
        <header className="glass-heavy border-b border-slate-700/30 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 relative overflow-hidden">
          <HeaderScene />
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700/50 relative z-10 shrink-0 order-first"
            aria-label="Open sidebar"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
          <button
            onClick={toggleSidebarCollapsed}
            className="hidden lg:flex items-center justify-center text-slate-400 hover:text-white w-8 h-8 rounded-lg hover:bg-slate-700/50 relative z-10 shrink-0 order-first"
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
          <div className="flex items-center gap-3 shrink-0 relative z-10 min-w-0">
            <img src="/logo.svg" alt="Th3rdAI" className="w-10 h-10 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight truncate">
                <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Th3rdAI
                </span>
                <span className="text-slate-300 ml-1.5 font-medium">
                  Code Companion
                </span>
              </h1>
              <p className="text-xs text-slate-500 truncate">
                Your friendly guide to all things code
              </p>
            </div>
          </div>
          <div className="flex-1 min-w-[1rem] shrink" aria-hidden="true" />
          <div className="flex items-center gap-2 shrink-0 relative z-10 flex-wrap">
            <button
              onClick={() => setShowGlossary(true)}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors text-slate-400 border-slate-600 hover:bg-indigo-500/10"
              title="Jargon Glossary"
            >
              📖 Glossary
            </button>
            <button
              onClick={() => {
                setShowGitHub(!showGitHub);
                if (!showGitHub) setShowFileBrowser(false);
              }}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors
                ${showGitHub ? "text-indigo-300 border-indigo-500/30 bg-indigo-600/10 neon-glow-sm" : "text-slate-400 border-slate-600 hover:bg-indigo-500/10"}`}
              title="GitHub Repos"
            >
              🐙 GitHub
            </button>
            <button
              onClick={() => {
                setShowFileBrowser(!showFileBrowser);
                if (!showFileBrowser) setShowGitHub(false);
              }}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors
                ${showFileBrowser ? "text-indigo-300 border-indigo-500/30 bg-indigo-600/10 neon-glow-sm" : "text-slate-400 border-slate-600 hover:bg-indigo-500/10"}`}
              title="File Browser"
            >
              📂 Files
            </button>
            <button
              type="button"
              data-testid="header-settings-button"
              onClick={() => setShowSettings(true)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                connected
                  ? "text-green-400 border-green-500/30 hover:bg-green-500/10"
                  : "text-red-400 border-red-500/30 hover:bg-red-500/10"
              }`}
            >
              <OrbitingBadge
                status={
                  streaming ? "streaming" : connected ? "online" : "offline"
                }
                size={24}
              />
              Settings
              <span className="text-slate-500 ml-0.5">&#9881;</span>
            </button>
            <ConnectionDot connected={connected} />
            {agentTerminalEnabled && (
              <span
                className="hidden sm:flex items-center gap-1 text-xs text-green-400 bg-green-900/20 border border-green-800/40 rounded-full px-2 py-0.5"
                title="Agent terminal is enabled — the AI can run commands in your project folder"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Terminal
              </span>
            )}
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
                    <p className="text-xs font-medium text-slate-300 mb-2">
                      Memories used:
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
                      {activeMemories.items?.map((m, i) => (
                        <div
                          key={i}
                          className="text-xs text-slate-400 glass rounded p-2"
                        >
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium mr-1.5 ${
                              m.type === "fact"
                                ? "bg-blue-500/15 text-blue-300"
                                : m.type === "project"
                                  ? "bg-green-500/15 text-green-300"
                                  : m.type === "pattern"
                                    ? "bg-orange-500/15 text-orange-300"
                                    : "bg-purple-500/15 text-purple-300"
                            }`}
                          >
                            {m.type}
                          </span>
                          <span className="line-clamp-2">{m.content}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        setMemoryDropdownOpen(false);
                        setShowMemoryPanel(true);
                      }}
                      className="mt-2 w-full text-xs text-indigo-300 hover:text-indigo-200 py-1 transition-colors"
                    >
                      Manage all memories...
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={refreshModels}
              disabled={refreshing}
              className="text-slate-400 hover:text-indigo-300 text-sm px-2 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors disabled:opacity-50"
              title="Refresh models"
            >
              <span className={refreshing ? "inline-block spin" : ""}>
                &#x27F3;
              </span>
            </button>
            <label htmlFor="model-select" className="sr-only">
              Select AI model
            </label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="input-glow text-slate-200 text-sm rounded-lg px-3 py-1.5 max-w-[200px]"
            >
              {models.length === 0 && <option value="">No models found</option>}
              {models.length > 0 && (
                <option value="auto">Auto (best per mode)</option>
              )}
              {[...models]
                .sort((a, b) => {
                  // Sort vision models to top when images attached (Phase 4: Image Support)
                  if (hasImages) {
                    return (
                      (b.supportsVision ? 1 : 0) - (a.supportsVision ? 1 : 0)
                    );
                  }
                  return 0;
                })
                .map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.supportsVision ? "👁️ " : ""}
                    {m.name} ({m.paramSize || m.size + "GB"})
                  </option>
                ))}
            </select>
            {selectedModel === "auto" && models.length > 0 && (
              <span
                className="text-xs text-slate-500 whitespace-nowrap hidden sm:inline"
                title="Shown after your first message in this mode"
              >
                {autoResolvedLabel ? `→ ${autoResolvedLabel}` : "→ …"}
              </span>
            )}
            {mode === "chat" && (
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="rounds-select"
                  className="text-xs text-slate-500 whitespace-nowrap"
                >
                  Rounds
                </label>
                <select
                  id="rounds-select"
                  value={agentMaxRounds}
                  onChange={(e) => setAgentMaxRounds(Number(e.target.value))}
                  className="input-glow text-slate-200 text-sm rounded-lg px-2 py-1.5"
                  title="Max agent tool rounds per message (how many write/run/fix cycles the agent can do)"
                >
                  {[1, 3, 5, 10, 15, 20, 25].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </header>

        {/* Animated beam accent */}
        <Splite color={theme.primary} height={1} speed={2} />

        {/* Offline Banner — non-blocking info message */}
        {!connected && models.length > 0 && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3 flex items-center gap-3">
            <span className="text-amber-400 text-sm">&#9888;</span>
            <div className="flex-1 text-sm text-amber-300">
              Ollama disconnected — AI features unavailable. You can still
              browse your conversation history.
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              Configure
            </button>
            <button
              onClick={refreshModels}
              className="text-xs glass text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-600/50 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Drag overlay */}
        {dragging && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-base/80 border-2 border-dashed border-indigo-500 rounded-2xl m-2 pointer-events-none">
            <div className="text-center">
              <div className="text-4xl mb-2">📄</div>
              <p className="text-indigo-300 font-medium neon-text">
                Drop your files here — I'll take a look!
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Main chat area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Mode tabs: primary strip, More menu, command palette (⌘K / Ctrl+K) */}
            <div className="glass border-b border-slate-700/30 px-3 sm:px-4 py-2 flex flex-wrap items-center gap-1.5 sm:gap-2 relative">
              <FloatingGeometry shapeCount={5} />
              {primaryModes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`mode-tab-${m.id}`}
                  onClick={() => selectMode(m.id)}
                  className={`relative z-10 flex min-h-[36px] cursor-pointer items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1419] ${
                    mode === m.id
                      ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-medium neon-glow-sm"
                      : "text-slate-400 hover:bg-indigo-500/10 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  <span aria-hidden="true">{m.icon}</span>
                  <span className="relative">
                    {m.label}
                    {m.id === "agentic" && agentTerminalEnabled && (
                      <span
                        className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-green-400"
                        title="Agent terminal is active"
                      />
                    )}
                  </span>
                </button>
              ))}
              <div className="relative z-10" ref={moreModesRef}>
                <button
                  type="button"
                  data-testid="mode-tab-more"
                  aria-expanded={showMoreModes}
                  aria-haspopup="menu"
                  onClick={() => {
                    setShowMoreModes((v) => !v);
                    setShowModePalette(false);
                  }}
                  className={`relative z-10 flex min-h-[36px] cursor-pointer items-center gap-0.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1419] ${
                    currentModeIsSecondary
                      ? "bg-indigo-600/20 text-indigo-200 border border-indigo-500/35 font-medium"
                      : "text-slate-400 hover:bg-indigo-500/10 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  More
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 opacity-70 transition-transform ${showMoreModes ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                {showMoreModes && (
                  <div
                    className="absolute left-0 top-full z-50 mt-1 min-w-[min(100vw-2rem,16rem)] max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-slate-600/40 bg-[#141a24]/95 py-2 shadow-xl backdrop-blur-md"
                    role="menu"
                  >
                    {MORE_MENU_GROUPS.map((group) => (
                      <div key={group.label} className="px-1 pb-1">
                        <div
                          className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                          role="presentation"
                        >
                          {group.label}
                        </div>
                        {group.ids.map((id) => {
                          const m = modeById(id);
                          if (!m) return null;
                          return (
                            <button
                              key={id}
                              type="button"
                              role="menuitem"
                              data-testid={`mode-tab-${m.id}`}
                              onClick={() => selectMode(m.id)}
                              className={`flex w-full min-h-[40px] items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                                mode === m.id
                                  ? "bg-indigo-600/25 text-indigo-200"
                                  : "text-slate-300 hover:bg-slate-600/30"
                              }`}
                            >
                              <span aria-hidden="true">{m.icon}</span>
                              <span className="relative flex-1">
                                {m.label}
                                {m.id === "agentic" && agentTerminalEnabled && (
                                  <span
                                    className="absolute -top-0.5 right-0 w-2 h-2 rounded-full bg-green-400"
                                    title="Agent terminal is active"
                                  />
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                data-testid="mode-tab-palette-open"
                title="Search modes (⌘K or Ctrl+K)"
                aria-label="Search modes, keyboard shortcut Command K or Control K"
                onClick={() => {
                  setShowModePalette(true);
                  setShowMoreModes(false);
                }}
                className="relative z-10 ml-auto flex min-h-[36px] min-w-[36px] cursor-pointer items-center justify-center rounded-lg border border-transparent text-slate-400 transition-colors hover:bg-indigo-500/10 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1419]"
              >
                <Search className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {showModePalette && (
              <div
                className="fixed inset-0 z-[200] flex items-start justify-center bg-black/55 px-4 pt-[12vh] pb-8"
                role="dialog"
                aria-modal="true"
                aria-label="Switch mode"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setShowModePalette(false);
                }}
              >
                <div
                  className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-600/50 bg-[#141a24] shadow-2xl"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2 border-b border-slate-700/50 px-3 py-2">
                    <Search
                      className="h-4 w-4 shrink-0 text-slate-500"
                      aria-hidden
                    />
                    <input
                      ref={paletteInputRef}
                      type="search"
                      value={paletteQuery}
                      onChange={(e) => setPaletteQuery(e.target.value)}
                      placeholder="Filter modes…"
                      className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
                      aria-autocomplete="list"
                      aria-controls="mode-palette-list"
                    />
                    <kbd className="hidden shrink-0 rounded border border-slate-600/60 bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">
                      esc
                    </kbd>
                  </div>
                  <ul
                    id="mode-palette-list"
                    className="max-h-[min(50vh,20rem)] overflow-y-auto py-1"
                    role="listbox"
                  >
                    {paletteModes.map((m, idx) => (
                      <li key={m.id} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={idx === paletteHighlightIndex}
                          data-testid={`mode-tab-${m.id}`}
                          onMouseEnter={() => setPaletteHighlightIndex(idx)}
                          onClick={() => selectMode(m.id)}
                          className={`flex w-full min-h-[44px] items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                            idx === paletteHighlightIndex
                              ? "bg-indigo-600/30 text-indigo-100"
                              : "text-slate-300 hover:bg-slate-700/40"
                          }`}
                        >
                          <span aria-hidden="true">{m.icon}</span>
                          <span className="relative flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="font-medium">{m.label}</span>
                            {m.desc ? (
                              <span className="truncate text-xs text-slate-500">
                                {m.desc}
                              </span>
                            ) : null}
                            {m.id === "agentic" && agentTerminalEnabled && (
                              <span
                                className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-green-400"
                                title="Agent terminal is active"
                              />
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {paletteModes.length === 0 && (
                    <p className="px-3 py-6 text-center text-sm text-slate-500">
                      No modes match that filter.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Messages / Create Wizard / Review Panel */}
            {mode === "review" ? (
              <ReviewPanel
                selectedModel={selectedModel}
                connected={connected}
                streaming={streaming}
                onAttachFromBrowser={reviewAttachRef}
                onOpenFileBrowser={() => {
                  setShowFileBrowser(true);
                  setShowGitHub(false);
                }}
                onToast={showToast}
                onSwitchToChat={(msgs) => {
                  setMode("chat");
                  if (msgs) setMessages(msgs);
                }}
                savedReview={savedReview}
                onSaveReview={handleSaveReview}
                models={models}
                onSetSelectedModel={setSelectedModel}
                onUpdateReviewDeepDive={handleUpdateReviewDeepDive}
              />
            ) : mode === "pentest" ? (
              <SecurityPanel
                selectedModel={selectedModel}
                connected={connected}
                streaming={streaming}
                onAttachFromBrowser={pentestAttachRef}
                onOpenFileBrowser={() => {
                  setShowFileBrowser(true);
                  setShowGitHub(false);
                }}
                onToast={showToast}
                savedPentest={savedPentest}
                onSavePentest={handleSavePentest}
                models={models}
                onSetSelectedModel={setSelectedModel}
                onUpdatePentestDeepDive={handleUpdatePentestDeepDive}
              />
            ) : mode === "validate" ? (
              <ValidatePanel
                selectedModel={selectedModel}
                connected={connected}
                onToast={showToast}
                models={models}
              />
            ) : mode === "experiment" ? (
              <ExperimentPanel
                selectedModel={selectedModel}
                connected={connected}
                onToast={showToast}
                projectFolder={projectFolder}
                chatFolder={chatFolder}
                agentMaxRounds={agentMaxRounds}
              />
            ) : mode === "terminal" ? (
              <TerminalPanel projectFolder={chatFolder || projectFolder} />
            ) : BUILDER_MODES.includes(mode) ? (
              mode === "prompting" ? (
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
              ) : mode === "skillz" ? (
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
              ) : mode === "agentic" ? (
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
              <div
                className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
                role="log"
                aria-label="Chat messages"
                aria-live="polite"
              >
                {mode === "create" ? (
                  <>
                    <div className="sticky top-0 z-10 -mx-4 -mt-4 px-4 pt-4 pb-2 mb-2 bg-slate-900/95 backdrop-blur border-b border-slate-700/50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">
                          Create project
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowTutorial(!showTutorial);
                            if (!showTutorial) setTutorialStep(1);
                            setWizardPrefill(null);
                          }}
                          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-base shadow-lg transition-all ${showTutorial ? "bg-amber-500 text-slate-900 ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900" : "bg-amber-400 text-slate-900 hover:bg-amber-300 ring-2 ring-amber-400/50 animate-pulse"}`}
                          aria-label={
                            showTutorial
                              ? "Hide tutorial"
                              : "Show step-by-step tutorial"
                          }
                        >
                          <BookOpen className="w-5 h-5 shrink-0" aria-hidden />
                          {showTutorial ? "Tutorial on" : "Start tutorial"}
                        </button>
                      </div>
                    </div>
                    {showTutorial && (
                      <TutorialPanel
                        mode="create"
                        currentStep={tutorialStep}
                        onStepChange={(s) => {
                          setTutorialStep(s);
                          setWizardPrefill(null);
                        }}
                        onPrefillStep={(stepNum, data) =>
                          setWizardPrefill({ step: stepNum, data })
                        }
                        onClose={() => setShowTutorial(false)}
                        totalSteps={5}
                      />
                    )}
                    <CreateWizard
                      defaultOutputRoot={projectFolder || "~/AI_Dev/"}
                      onSuccess={handleCreateSuccess}
                      onGeneratePRP={handleGeneratePRP}
                      onToast={showToast}
                      step={showTutorial ? tutorialStep : undefined}
                      onStepChange={showTutorial ? setTutorialStep : undefined}
                      prefill={wizardPrefill}
                      tutorialActive={showTutorial}
                      tutorialSuggestions={
                        showTutorial
                          ? (CREATE_TUTORIAL_STEPS[tutorialStep - 1]?.prefill ??
                            null)
                          : null
                      }
                    />
                  </>
                ) : mode === "build" ? (
                  showBuildWizard ? (
                    <>
                      <div className="sticky top-0 z-10 -mx-4 -mt-4 px-4 pt-4 pb-2 mb-2 bg-slate-900/95 backdrop-blur border-b border-slate-700/50">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-500">
                            New build project
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowTutorial(!showTutorial);
                              if (!showTutorial) setTutorialStep(1);
                              setWizardPrefill(null);
                            }}
                            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-base shadow-lg transition-all ${showTutorial ? "bg-amber-500 text-slate-900 ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900" : "bg-amber-400 text-slate-900 hover:bg-amber-300 ring-2 ring-amber-400/50 animate-pulse"}`}
                            aria-label={
                              showTutorial
                                ? "Hide tutorial"
                                : "Show step-by-step tutorial"
                            }
                          >
                            <BookOpen
                              className="w-5 h-5 shrink-0"
                              aria-hidden
                            />
                            {showTutorial ? "Tutorial on" : "Start tutorial"}
                          </button>
                        </div>
                      </div>
                      {showTutorial && (
                        <TutorialPanel
                          mode="build"
                          currentStep={tutorialStep}
                          onStepChange={(s) => {
                            setTutorialStep(s);
                            setWizardPrefill(null);
                          }}
                          onPrefillStep={(stepNum, data) =>
                            setWizardPrefill({ step: stepNum, data })
                          }
                          onClose={() => setShowTutorial(false)}
                          totalSteps={4}
                        />
                      )}
                      <BuildWizard
                        defaultOutputRoot={projectFolder || "~/AI_Dev/"}
                        onSuccess={handleBuildProjectCreated}
                        onToast={showToast}
                        onCancel={() => {
                          setShowBuildWizard(false);
                          setShowTutorial(false);
                        }}
                        step={showTutorial ? tutorialStep : undefined}
                        onStepChange={
                          showTutorial ? setTutorialStep : undefined
                        }
                        prefill={wizardPrefill}
                        tutorialActive={showTutorial}
                        tutorialSuggestions={
                          showTutorial
                            ? (BUILD_TUTORIAL_STEPS[tutorialStep - 1]
                                ?.prefill ?? null)
                            : null
                        }
                      />
                    </>
                  ) : (
                    <BuildPanel
                      projects={buildProjects}
                      activeProject={activeBuildProject}
                      onSelectProject={setActiveBuildProject}
                      onNewProject={() => setShowBuildWizard(true)}
                      onViewFiles={(p) => {
                        setProjectFolder(p);
                        setShowFileBrowser(true);
                      }}
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
                    {messages.map((msg, i) =>
                      msg._toolContext ? null : (
                        <div key={i} className="relative group">
                          <MessageBubble
                            role={msg.role}
                            content={msg.content}
                            streaming={
                              streaming &&
                              i === messages.length - 1 &&
                              msg.role === "assistant"
                            }
                            images={msg.images}
                            onImageClick={openLightboxFromMessage}
                          />
                          {msg.role === "assistant" && !streaming && (
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <CopyButton text={msg.content} />
                            </div>
                          )}
                        </div>
                      ),
                    )}
                    {streaming &&
                      messages[messages.length - 1]?.role !== "assistant" && (
                        <TypingIndicator3D mode={mode} />
                      )}
                    {terminalOutput && (
                      <div className="mx-4 my-2 glass rounded-xl border border-indigo-500/20 overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 border-b border-indigo-500/20">
                          <span className="text-xs font-mono text-indigo-300">
                            {terminalOutput.status === "running" ? (
                              <>
                                <span className="inline-block animate-spin mr-1">
                                  &#x27F3;
                                </span>{" "}
                                Running command...
                              </>
                            ) : terminalOutput.status === "error" ? (
                              <span className="text-red-400">
                                ✕ Command failed
                              </span>
                            ) : terminalOutput.status === "timeout" ? (
                              <span className="text-yellow-400">
                                ⏱ Command timed out
                              </span>
                            ) : (
                              <span className="text-green-400">
                                ✓ Command completed
                              </span>
                            )}
                          </span>
                        </div>
                        {terminalOutput.command && (
                          <pre className="px-3 py-2 text-xs text-slate-400 font-mono whitespace-pre-wrap border-b border-indigo-500/10">
                            $ {terminalOutput.command}
                          </pre>
                        )}
                        {terminalOutput.output && (
                          <pre className="px-3 py-2 text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto scrollbar-thin">
                            {terminalOutput.output}
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
            {stats &&
              mode !== "review" &&
              mode !== "pentest" &&
              mode !== "experiment" && (
                <div className="glass border-t border-slate-700/30 px-4 py-1.5 flex items-center gap-4 text-xs text-slate-500">
                  <span>
                    Model:{" "}
                    <strong className="text-slate-400">{selectedModel}</strong>
                  </span>
                  <TokenCounter
                    tokens={stats.tokens}
                    duration={stats.duration}
                  />
                </div>
              )}

            {/* Input — hidden in Create, Review, and Terminal modes */}
            {mode !== "create" &&
              mode !== "build" &&
              mode !== "review" &&
              mode !== "pentest" &&
              mode !== "experiment" &&
              mode !== "terminal" &&
              !BUILDER_MODES.includes(mode) && (
                <div
                  className={`glass-heavy border-t border-slate-700/30 p-4 ${dragging ? "drop-zone-active" : ""}`}
                >
                  <AttachedFiles
                    files={attachedFiles}
                    onRemove={removeAttachedFile}
                    onImageClick={openLightbox}
                  />

                  {/* Vision Model Warning (Phase 4: Image Support) */}
                  {showVisionWarning && (
                    <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-3 mb-3 rounded">
                      <p className="text-sm text-yellow-200 flex items-center gap-2 flex-wrap">
                        <span className="shrink-0">
                          ⚠️ Current model doesn't support images.
                        </span>
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
                      <label htmlFor="chat-input" className="sr-only">
                        Type your message
                      </label>
                      <textarea
                        id="chat-input"
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePasteImage}
                        placeholder={
                          connected
                            ? attachedFiles.length > 0
                              ? "Add a note about these files, or just hit Send — I'll take a look!"
                              : currentMode?.placeholder
                            : "Let's get connected first — click Settings up top to set up Ollama..."
                        }
                        rows={4}
                        disabled={streaming || !connected}
                        className="flex-1 input-glow text-slate-100 font-mono text-sm rounded-xl px-4 py-3 resize-none placeholder-slate-500 disabled:opacity-50"
                      />
                      <div className="flex items-center gap-1.5 pl-1">
                        <input
                          id="chat-file-input"
                          ref={fileInputRef}
                          type="file"
                          multiple
                          aria-label="Attach files to chat"
                          accept=".js,.jsx,.ts,.tsx,.py,.json,.md,.txt,.html,.css,.yaml,.yml,.sh,.sql,.go,.rs,.java,.c,.cpp,.h,.toml,.xml,.csv,.env,.svelte,.vue,image/*,.png,.jpg,.jpeg,.gif,.pdf,.pptx,.docx,.xlsx,.xls,.doc,.ppt,.odt,.ods,.odp,.rtf,.tex,.epub"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          title="Upload files to attach"
                          className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        >
                          📎 Upload
                        </button>
                        <button
                          onClick={handlePaste}
                          title="Paste text from clipboard"
                          className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        >
                          📋 Paste
                        </button>
                        <button
                          onClick={handleCopyLastResponse}
                          title="Copy last AI response to clipboard"
                          className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        >
                          📑 Copy Response
                        </button>
                        <button
                          onClick={handleDownloadMarkdown}
                          title="Download last AI response as Markdown file"
                          className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        >
                          📝 Markdown
                        </button>
                        <ExportPanel
                          messages={messages}
                          mode={MODES.find((m) => m.id === mode)?.label || mode}
                          showToast={showToast}
                        />
                        <button
                          onClick={handleClearInput}
                          title="Clear input text and attached files"
                          className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        >
                          🧹 Clear
                        </button>
                        <DictateButton
                          onResult={handleDictation}
                          disabled={!connected || streaming}
                        />
                        <span className="flex-1" />
                        <span className="text-[10px] text-slate-500">
                          Enter to send · Shift+Enter for new line · Drag files
                          to attach
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 relative">
                      <ParticleBurst
                        trigger={sendBurst}
                        color={theme.primary}
                      />
                      {streaming ? (
                        <button
                          type="button"
                          onClick={handleStopChat}
                          className="flex-1 rounded-xl px-4 py-2 font-medium min-w-[60px] bg-red-600/90 hover:bg-red-500 text-white border border-red-500/50 shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500/50"
                          aria-label="Stop generation"
                        >
                          Stop
                        </button>
                      ) : (
                        <button
                          onClick={handleSend}
                          disabled={
                            (!input.trim() && attachedFiles.length === 0) ||
                            !connected ||
                            !selectedModel ||
                            showVisionWarning
                          }
                          className="flex-1 btn-neon text-white rounded-xl px-4 font-medium transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-600 disabled:shadow-none disabled:cursor-not-allowed min-w-[60px]"
                        >
                          Send
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
          </div>

          {/* GitHub Panel (right panel) */}
          {showGitHub && (
            <aside
              className="w-80 border-l border-slate-700/30 glass"
              aria-label="GitHub repos"
            >
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
            <aside
              className="w-80 flex-shrink-0 overflow-hidden"
              aria-label="File browser"
            >
              <FileBrowser
                projectFolder={chatFolder || projectFolder}
                onAttachFile={attachFile}
                onToast={showToast}
                attachLabel={
                  BUILDER_MODES.includes(mode)
                    ? "Load into Form"
                    : mode === "review" || mode === "pentest"
                      ? "Load for Review"
                      : "+ Attach to Chat"
                }
                onClose={() => setShowFileBrowser(false)}
                onClearFolder={async () => {
                  try {
                    const res = await apiFetch("/api/config", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ chatFolder: "" }),
                    });
                    const data = await res.json();
                    setChatFolder(data.chatFolder || data.projectFolder || "");
                  } catch {
                    setChatFolder(projectFolder);
                  }
                }}
                onSetFolder={async (folder) => {
                  setChatFolder(folder);
                  try {
                    await apiFetch("/api/config", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ chatFolder: folder }),
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

      {showSettings && (
        <SettingsPanel
          ollamaUrl={ollamaUrl}
          projectFolder={projectFolder}
          icmTemplatePath={icmTemplatePath}
          onSave={handleSaveSettings}
          onClose={() => {
            setShowSettings(false);
            apiFetch("/api/config")
              .then((r) => r.json())
              .then((d) => setAgentTerminalEnabled(!!d.agentTerminal?.enabled))
              .catch(() => {});
          }}
          onOpenMemoryPanel={() => {
            setShowSettings(false);
            setShowMemoryPanel(true);
          }}
        />
      )}
      {showMemoryPanel && (
        <MemoryPanel onClose={() => setShowMemoryPanel(false)} />
      )}
      {renaming && (
        <RenameModal
          currentName={renaming.title}
          onSave={(name) => renameConversation(renaming.id, name)}
          onClose={() => setRenaming(null)}
        />
      )}
      {showGlossary && <GlossaryPanel onClose={() => setShowGlossary(false)} />}
      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}
      {showOllamaSetup && (
        <OllamaSetup
          onComplete={() => {
            setShowOllamaSetup(false);
            refreshModels();
          }}
        />
      )}
      <ConfirmRunModal
        pending={pendingConfirm}
        onDone={() => setPendingConfirm(null)}
      />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* Image Lightbox (Phase 2: Image Support) */}
      {lightboxOpen && lightboxImage && (
        <ImageLightbox
          isOpen={lightboxOpen}
          onClose={closeLightbox}
          src={lightboxImage.src}
          filename={lightboxImage.filename}
          images={attachedFiles
            .filter((f) => f.type === "image" || f.isImage)
            .map((f) => f.thumbnail)}
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
          <span className="text-sm text-slate-300">
            Processing {processingImages} image{processingImages > 1 ? "s" : ""}
            ...
          </span>
        </div>
      )}

      {/* Document Conversion Indicator */}
      {convertingDoc && (
        <div className="fixed bottom-4 right-4 z-50 glass-heavy border border-indigo-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="inline-block animate-spin text-indigo-400">
            &#x27F3;
          </span>
          <span className="text-sm text-slate-300">
            Converting {convertingDoc}...
          </span>
        </div>
      )}

      {/* Image Privacy Warning (Phase 8: Security) */}
      {showImagePrivacyWarning && (
        <ImagePrivacyWarning
          onClose={() => setShowImagePrivacyWarning(false)}
          onAccept={() => {
            setShowImagePrivacyWarning(false);
            showToast("✓ You can now upload images");
          }}
        />
      )}
    </div>
  );
}
