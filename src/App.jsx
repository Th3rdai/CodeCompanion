import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { apiFetch } from "./lib/api-fetch";
import { copyText, pasteFromClipboardButton } from "./lib/clipboard";
import { suggestMode } from "./lib/mode-suggestion";
import Toast from "./components/Toast";
import RenameModal from "./components/RenameModal";
import SettingsPanel from "./components/SettingsPanel";
import FileBrowser from "./components/FileBrowser";
import GitHubPanel from "./components/GitHubPanel";
import Sidebar from "./components/Sidebar";
import Splite from "./components/ui/Splite";
import PreflightBanner from "./components/ui/PreflightBanner";
import SplashScreen from "./components/3d/SplashScreen";
import HeaderScene from "./components/3d/HeaderScene";
import OnboardingWizard, {
  isOnboardingComplete,
} from "./components/OnboardingWizard";
import SetupAssistantPanel from "./components/SetupAssistantPanel";
import { GlossaryPanel } from "./components/JargonGlossary";
import PrivacyBanner from "./components/PrivacyBanner";
import ParticleBurst from "./components/3d/ParticleBurst";
import TokenCounter from "./components/3d/TokenCounter";
import OrbitingBadge from "./components/3d/OrbitingBadge";
import OllamaSetup from "./components/OllamaSetup";
import ConnectionDot from "./components/ConnectionDot";
import MemoryPanel from "./components/MemoryPanel";
import ImageLightbox from "./components/ImageLightbox";
import ImagePrivacyWarning from "./components/ImagePrivacyWarning";
import DictateButton from "./components/DictateButton";
import ExportPanel from "./components/ExportPanel";
import ConfirmRunModal from "./components/ConfirmRunModal";
import { joinAppend } from "./lib/dictationAppend";
import {
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  Brain,
} from "lucide-react";
import { use3DEffects } from "./contexts/Effects3DContext";
import { useModels } from "./hooks/useModels";
import { useChat } from "./hooks/useChat";
import { useImageAttachments } from "./hooks/useImageAttachments";
import { estimateMessageTokens } from "./lib/context-budget";
import {
  readFileBrowserRootsMap,
  writeFileBrowserRootsMap,
  isPathUnderProjectRoot,
} from "./app/file-browser-roots";
import {
  MODES,
  BUILDER_MODES,
  PRIMARY_MODE_IDS,
  modeById,
  showAgentRoundsInHeader,
} from "./app/modes";
import { AttachedFiles } from "./app/chat-ui-helpers";
import ModeTabs from "./app/ModeTabs";
import ModeRouter from "./app/ModeRouter";

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
  const [mode, _setMode] = useState(() => {
    // Check if user wants dashboard on startup
    try {
      const showDashboard = JSON.parse(
        localStorage.getItem("cc-show-dashboard") || "false",
      );
      return showDashboard ? "dashboard" : "chat";
    } catch {
      return "chat";
    }
  });
  // When the user clicks a linked-experiment chip, this carries the target id
  // into ExperimentPanel; ExperimentPanel restores that specific run, then
  // calls onRestoreComplete which clears it back to null.
  const [restoreExperimentId, setRestoreExperimentId] = useState(null);

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
    provider: modelProvider,
    selectedModel,
    setSelectedModel,
    autoResolvedLabel,
    setAutoResolvedLabel,
    isVisionModel,
    refreshModels,
    refreshing,
  } = useModels({ isElectron, setShowOllamaSetup, mode });
  // Free-text filter for the model dropdown — OpenRouter exposes 300+ models, so
  // the raw native <select> is unusable; we show a search box above it.
  const [modelFilter, setModelFilter] = useState("");
  // Clear the filter on provider switch — the input only renders for OpenRouter,
  // so a leftover query (e.g. "gpt") would otherwise silently collapse the
  // Ollama dropdown after switching back, with no visible box to clear it.
  useEffect(() => {
    setModelFilter("");
  }, [modelProvider]);

  const [input, setInput] = useState("");
  const [dismissedModeSuggestion, setDismissedModeSuggestion] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDecorative3D, setShowDecorative3D] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("cc-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQueries = [
      window.matchMedia("(min-width: 1024px)"),
      window.matchMedia("(pointer: fine)"),
      window.matchMedia("(prefers-reduced-motion: no-preference)"),
    ];

    const updateDecorative3D = () => {
      const mediaOk = mediaQueries.every((query) => query.matches);
      setShowDecorative3D(mediaOk && !document.hidden);
    };

    updateDecorative3D();
    const onVisibility = () => updateDecorative3D();
    document.addEventListener("visibilitychange", onVisibility);

    mediaQueries.forEach((query) => {
      if (typeof query.addEventListener === "function") {
        query.addEventListener("change", updateDecorative3D);
      } else if (typeof query.addListener === "function") {
        query.addListener(updateDecorative3D);
      }
    });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      mediaQueries.forEach((query) => {
        if (typeof query.removeEventListener === "function") {
          query.removeEventListener("change", updateDecorative3D);
        } else if (typeof query.removeListener === "function") {
          query.removeListener(updateDecorative3D);
        }
      });
    };
  }, []);
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
  const [showSetupAssistant, setShowSetupAssistant] = useState(false);
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
  /** Groq dictation fallback configured (server); avoids extra /api/config fetch in DictateButton */
  const [dictateGroqConfigured, setDictateGroqConfigured] = useState(false);

  // Agent terminal output state
  const [terminalOutput, setTerminalOutput] = useState(null); // {command, output, exitCode, status}

  // Preflight context banner state (Phase 1 — CTXFIX.md)
  const [preflightBannerVisible, setPreflightBannerVisible] = useState(false);
  const [contextLength, setContextLength] = useState(null); // Model's context window size
  const [estimatedTokens, setEstimatedTokens] = useState(0); // Current conversation token estimate
  const [enablePreflightBanner, setEnablePreflightBanner] = useState(false); // Config flag from server

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
    folders,
    sendBurst,
    renaming,
    setRenaming,
    showArchived,
    setShowArchived,
    stats,
    fetchHistory,
    fetchFolders,
    loadConversation,
    deleteConversation,
    renameConversation,
    archiveConversation,
    exportConversation,
    bulkDeleteConversations,
    bulkExportConversations,
    bulkArchiveConversations,
    moveConversationToFolder,
    bulkMoveConversations,
    createHistoryFolder,
    renameHistoryFolder,
    setFolderCollapsed,
    deleteHistoryFolder,
    handleRenameRequest,
    startNew,
    handleSend,
    handleRecoverAgent,
    canRecoverAgent,
    handleStopChat,
    pendingAutoSend,
    pendingConfirm,
    setPendingConfirm,
    linkedExperimentIds,
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

  // ── Dashboard: Resume Conversation Handler ────────────────────────────────
  async function handleResumeConversation(conversationId, modeId) {
    await loadConversation(conversationId);
    setMode(modeId);
  }

  // ── Preflight Context Banner: Fetch context length when model changes ──────
  // Gated on enablePreflightBanner so installs with the feature off (the
  // default) never poll /api/model-context or recompute on each keystroke.
  useEffect(() => {
    if (!enablePreflightBanner || !selectedModel) {
      setContextLength(null);
      return;
    }

    const params = new URLSearchParams();
    if (selectedModel === "auto") {
      params.set("auto", "1");
      params.set("mode", mode);
      if (estimatedTokens > 0) {
        params.set("estimatedTokens", String(estimatedTokens));
      }
    } else {
      params.set("name", selectedModel);
    }

    fetch(`/api/model-context?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.contextLength !== undefined) {
          setContextLength(data.contextLength);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch context length:", err);
        setContextLength(null);
      });
  }, [enablePreflightBanner, selectedModel, mode, estimatedTokens]);

  // ── Preflight Context Banner: Check threshold with 200ms debouncing ────────
  // Gated on enablePreflightBanner so the debounced token recompute + setState
  // only runs when the feature is enabled.
  useEffect(() => {
    if (!enablePreflightBanner) {
      setPreflightBannerVisible(false);
      return;
    }

    const timer = setTimeout(() => {
      if (!contextLength || contextLength <= 0) {
        setPreflightBannerVisible(false);
        return;
      }

      // Calculate estimated tokens from messages + pending input
      const messageTokens = estimateMessageTokens(messages);
      const inputTokens = estimateMessageTokens([{ content: input }]);
      const total = messageTokens + inputTokens;

      setEstimatedTokens(total);

      // Show banner when above 80% threshold
      const threshold = contextLength * 0.8;
      setPreflightBannerVisible(total > threshold);
    }, 200); // 200ms debounce per CTXFIX.md spec

    return () => clearTimeout(timer);
  }, [enablePreflightBanner, messages, input, contextLength]);

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
    fetchFolders();
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
      const pf = data.projectFolder || "";
      setProjectFolder(pf);
      let cf = data.chatFolder || pf || "";
      if (pf && cf === pf) {
        const map = readFileBrowserRootsMap();
        const stored = map[pf];
        if (stored && stored !== pf && isPathUnderProjectRoot(pf, stored)) {
          try {
            const persist = await apiFetch("/api/config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chatFolder: stored }),
            });
            if (persist.ok) {
              const d2 = await persist.json();
              cf = d2.chatFolder || stored;
            }
          } catch {
            /* keep server default */
          }
        }
      }
      setChatFolder(cf || pf || "");
      setIcmTemplatePath(data.icmTemplatePath || "");
      setImageSupportConfig(
        data.imageSupport && typeof data.imageSupport === "object"
          ? data.imageSupport
          : {},
      );
      setDictateGroqConfigured(!!data.dictateGroqConfigured);
      setEnablePreflightBanner(data.enablePreflightBanner ?? false);
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
      setDictateGroqConfigured(!!data.dictateGroqConfigured);
      await refreshModels();
      if (newFolder && String(newFolder).trim()) {
        setShowFileBrowser(true);
        setShowGlossary(false);
      }
    } catch {}
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleSaveReview(reviewData) {
    const existing = history.find((h) => h.id === activeConvId);
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
      ...(existing?.folderId ? { folderId: existing.folderId } : {}),
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
      const existing = history.find((h) => h.id === activeConvId);
      const convData = {
        id: activeConvId || undefined,
        title: `${data.modeId === "prompting" ? "Prompt" : data.modeId === "skillz" ? "Skill" : "Agent"}: ${data.formData?.skillName || data.formData?.agentName || data.formData?.purpose || "Untitled"} (${new Date().toLocaleString()})`,
        mode: data.modeId,
        model: selectedModel,
        messages: [],
        builderData: data,
        overallGrade: data.scoreData?.overallGrade,
        ...(existing?.folderId ? { folderId: existing.folderId } : {}),
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
    [activeConvId, history, selectedModel],
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
    const existing = history.find((h) => h.id === activeConvId);
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
      ...(existing?.folderId ? { folderId: existing.folderId } : {}),
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
  function buildAttachmentSignature(fileData) {
    const raw = typeof fileData?.content === "string" ? fileData.content : "";
    return (
      `${fileData?.path || ""}|${fileData?.convertedFrom || ""}|${fileData?.name || ""}|` +
      `${raw.length}|${raw.slice(0, 256)}|${raw.slice(-256)}`
    );
  }

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
    if (fileData?.type !== "image" && !fileData?.isImage) {
      const incomingSignature = buildAttachmentSignature(fileData);
      const isDuplicate = attachedFiles.some(
        (existing) => buildAttachmentSignature(existing) === incomingSignature,
      );
      if (isDuplicate) {
        showToast(`Skipped duplicate attachment: ${fileData.name}`);
        return;
      }
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
        modelProvider === "openrouter"
          ? "No vision-capable model in the loaded OpenRouter catalog. Refresh models, or pick one with the 👁️ badge."
          : "No vision models available. Install one with: ollama pull llava",
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
    await pasteFromClipboardButton({
      focusRef: textareaRef,
      appendText: (text) => setInput((prev) => prev + text),
      onSuccess: () => showToast("Pasted from clipboard"),
      onManualFallback: () => {
        textareaRef.current?.focus();
        showToast("Press Ctrl+V (or ⌘V) to paste");
      },
    });
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
    setShowGlossary(false);
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

  // Soft mode-suggestion: when the draft prompt strongly looks like a different
  // mode's task, surface a non-overriding banner. Click switches modes; X
  // dismisses for the current draft. Suggestion auto-clears when input clears.
  const suggestedModeId = useMemo(
    () => suggestMode(input, mode),
    [input, mode],
  );
  const suggestedMode = useMemo(
    () =>
      suggestedModeId ? MODES.find((m) => m.id === suggestedModeId) : null,
    [suggestedModeId],
  );
  const showModeSuggestion =
    !!suggestedMode &&
    suggestedModeId !== dismissedModeSuggestion &&
    !streaming;
  useEffect(() => {
    if (!input.trim()) setDismissedModeSuggestion(null);
  }, [input]);

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
        folders={folders}
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
        onMoveConversation={moveConversationToFolder}
        onBulkMove={bulkMoveConversations}
        onCreateFolder={createHistoryFolder}
        onRenameFolder={renameHistoryFolder}
        onToggleFolderCollapsed={setFolderCollapsed}
        onDeleteFolder={deleteHistoryFolder}
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
              onClick={() => {
                setShowGlossary(!showGlossary);
                if (!showGlossary) {
                  setShowGitHub(false);
                  setShowFileBrowser(false);
                }
              }}
              className={`flex min-h-11 items-center gap-1 text-xs px-3 py-2 rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 ${
                showGlossary
                  ? "text-indigo-300 border-indigo-500/30 bg-indigo-600/10 neon-glow-sm"
                  : "text-slate-400 border-slate-600 hover:bg-indigo-500/10"
              }`}
              title="Jargon Glossary"
            >
              📖 Glossary
            </button>
            <button
              onClick={() => {
                setShowGitHub(!showGitHub);
                if (!showGitHub) {
                  setShowFileBrowser(false);
                  setShowGlossary(false);
                }
              }}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors
                ${showGitHub ? "text-indigo-300 border-indigo-500/30 bg-indigo-600/10 neon-glow-sm" : "text-slate-400 border-slate-600 hover:bg-indigo-500/10"} min-h-11 px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70`}
              title="GitHub Repos"
            >
              🐙 GitHub
            </button>
            <button
              onClick={() => {
                setShowFileBrowser(!showFileBrowser);
                if (!showFileBrowser) {
                  setShowGitHub(false);
                  setShowGlossary(false);
                }
              }}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors
                ${showFileBrowser ? "text-indigo-300 border-indigo-500/30 bg-indigo-600/10 neon-glow-sm" : "text-slate-400 border-slate-600 hover:bg-indigo-500/10"} min-h-11 px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70`}
              title="File Browser"
            >
              📂 Files
            </button>
            {isElectron && window.electronAPI?.terminal ? (
              <button
                type="button"
                data-testid="header-open-terminal-button"
                onClick={() => setMode("terminal")}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors
                  ${mode === "terminal" ? "text-indigo-300 border-indigo-500/30 bg-indigo-600/10 neon-glow-sm" : "text-slate-400 border-slate-600 hover:bg-indigo-500/10"} min-h-11 px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70`}
                title={
                  (chatFolder || projectFolder || "").trim()
                    ? `Open integrated terminal in: ${(chatFolder || projectFolder).length > 72 ? `…${(chatFolder || projectFolder).slice(-71)}` : chatFolder || projectFolder}`
                    : "Open integrated terminal — set Project folder in Settings if empty"
                }
              >
                ⌨️ Terminal
              </button>
            ) : null}
            <button
              type="button"
              data-testid="header-settings-button"
              onClick={() => setShowSettings(true)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                connected
                  ? "text-green-400 border-green-500/30 hover:bg-green-500/10"
                  : "text-red-400 border-red-500/30 hover:bg-red-500/10"
              } min-h-11 px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70`}
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
                  className="flex min-h-11 items-center gap-1 text-xs px-3 py-2 rounded-lg border transition-colors text-purple-300 border-purple-500/30 bg-purple-600/10 hover:bg-purple-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/70"
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
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sm text-slate-400 transition-colors hover:bg-indigo-500/10 hover:text-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 disabled:opacity-50"
              title="Refresh models"
            >
              <span className={refreshing ? "inline-block spin" : ""}>
                &#x27F3;
              </span>
            </button>
            <label htmlFor="model-select" className="sr-only">
              Select AI model
            </label>
            {modelProvider === "openrouter" && models.length > 0 && (
              <input
                type="text"
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                placeholder="Filter models…"
                aria-label="Filter OpenRouter models"
                className="input-glow text-slate-200 text-sm rounded-lg px-3 py-1.5 max-w-[160px]"
              />
            )}
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
                .filter((m) => {
                  const q = modelFilter.trim().toLowerCase();
                  if (!q) return true;
                  // Always keep the currently-selected model visible so the
                  // <select> value never points at a filtered-out option.
                  if (m.name === selectedModel) return true;
                  return m.name.toLowerCase().includes(q);
                })
                .sort((a, b) => {
                  // Sort vision models to top when images attached (Phase 4: Image Support)
                  if (hasImages) {
                    return (
                      (b.supportsVision ? 1 : 0) - (a.supportsVision ? 1 : 0)
                    );
                  }
                  return 0;
                })
                .map((m) => {
                  // OpenRouter models report size:0; show the friendly ctx tag
                  // (paramSize) and drop the ugly "(0GB)" suffix.
                  const tag = m.paramSize || (m.size ? `${m.size}GB` : "");
                  return (
                    <option key={m.name} value={m.name}>
                      {m.supportsVision ? "👁️ " : ""}
                      {m.name}
                      {tag ? ` (${tag})` : ""}
                    </option>
                  );
                })}
            </select>
            {selectedModel === "auto" && models.length > 0 && (
              <span
                className="text-xs text-slate-500 whitespace-nowrap hidden sm:inline"
                title="Shown after your first message in this mode"
              >
                {autoResolvedLabel ? `→ ${autoResolvedLabel}` : "→ …"}
              </span>
            )}
            {showAgentRoundsInHeader(mode) && (
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
              className="text-xs min-h-11 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
            >
              Configure
            </button>
            <button
              onClick={refreshModels}
              className="text-xs min-h-11 glass text-slate-300 px-3 py-2 rounded-lg hover:bg-slate-600/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70"
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
            <ModeTabs
              showDecorative3D={showDecorative3D}
              primaryModes={primaryModes}
              mode={mode}
              selectMode={selectMode}
              agentTerminalEnabled={agentTerminalEnabled}
              moreModesRef={moreModesRef}
              showMoreModes={showMoreModes}
              setShowMoreModes={setShowMoreModes}
              currentModeIsSecondary={currentModeIsSecondary}
              showModePalette={showModePalette}
              setShowModePalette={setShowModePalette}
              paletteQuery={paletteQuery}
              setPaletteQuery={setPaletteQuery}
              paletteInputRef={paletteInputRef}
              paletteModes={paletteModes}
              paletteHighlightIndex={paletteHighlightIndex}
              setPaletteHighlightIndex={setPaletteHighlightIndex}
              streaming={streaming}
              currentMode={currentMode}
              linkedExperimentIds={linkedExperimentIds}
              setRestoreExperimentId={setRestoreExperimentId}
              setMode={setMode}
            />

            <ModeRouter
              mode={mode}
              isElectron={isElectron}
              history={history}
              onResumeConversation={handleResumeConversation}
              setMode={setMode}
              review={{
                selectedModel,
                connected,
                streaming,
                onAttachFromBrowser: reviewAttachRef,
                onOpenFileBrowser: () => {
                  setShowFileBrowser(true);
                  setShowGitHub(false);
                  setShowGlossary(false);
                },
                onToast: showToast,
                onSwitchToChat: (msgs) => {
                  setMode("chat");
                  if (msgs) setMessages(msgs);
                },
                savedReview,
                onSaveReview: handleSaveReview,
                models,
                onSetSelectedModel: setSelectedModel,
                onUpdateReviewDeepDive: handleUpdateReviewDeepDive,
                setPendingConfirm,
              }}
              pentest={{
                selectedModel,
                connected,
                streaming,
                onAttachFromBrowser: pentestAttachRef,
                onOpenFileBrowser: () => {
                  setShowFileBrowser(true);
                  setShowGitHub(false);
                  setShowGlossary(false);
                },
                onToast: showToast,
                savedPentest,
                onSavePentest: handleSavePentest,
                models,
                onSetSelectedModel: setSelectedModel,
                onUpdatePentestDeepDive: handleUpdatePentestDeepDive,
                setPendingConfirm,
              }}
              validate={{
                selectedModel,
                connected,
                onToast: showToast,
                models,
              }}
              experiment={{
                selectedModel,
                connected,
                onToast: showToast,
                projectFolder,
                chatFolder,
                agentMaxRounds,
                setPendingConfirm,
                restoreExperimentId,
                onRestoreComplete: () => setRestoreExperimentId(null),
              }}
              terminal={{
                projectFolder: chatFolder || projectFolder,
              }}
              builder={{
                selectedModel,
                connected,
                models,
                onToast: setToast,
                savedData: savedBuilderData,
                onSaveBuilder: handleSaveBuilder,
                onLoadFile: builderAttachRef,
                projectFolder,
              }}
              create={{
                showTutorial,
                tutorialStep,
                wizardPrefill,
                defaultOutputRoot: projectFolder || "~/AI_Dev/",
                onToggleTutorial: () => {
                  setShowTutorial(!showTutorial);
                  if (!showTutorial) setTutorialStep(1);
                  setWizardPrefill(null);
                },
                onTutorialStepChange: (s) => {
                  setTutorialStep(s);
                  setWizardPrefill(null);
                },
                onPrefillStep: (stepNum, data) =>
                  setWizardPrefill({ step: stepNum, data }),
                onCloseTutorial: () => setShowTutorial(false),
                onSetTutorialStep: setTutorialStep,
                onSuccess: handleCreateSuccess,
                onGeneratePRP: handleGeneratePRP,
                onToast: showToast,
              }}
              build={{
                showBuildWizard,
                showTutorial,
                tutorialStep,
                wizardPrefill,
                defaultOutputRoot: projectFolder || "~/AI_Dev/",
                onToggleTutorial: () => {
                  setShowTutorial(!showTutorial);
                  if (!showTutorial) setTutorialStep(1);
                  setWizardPrefill(null);
                },
                onTutorialStepChange: (s) => {
                  setTutorialStep(s);
                  setWizardPrefill(null);
                },
                onPrefillStep: (stepNum, data) =>
                  setWizardPrefill({ step: stepNum, data }),
                onCloseTutorial: () => setShowTutorial(false),
                onSetTutorialStep: setTutorialStep,
                onSuccess: handleBuildProjectCreated,
                onCancelWizard: () => {
                  setShowBuildWizard(false);
                  setShowTutorial(false);
                },
                onToast: showToast,
                projects: buildProjects,
                activeProject: activeBuildProject,
                onSelectProject: setActiveBuildProject,
                onNewProject: () => setShowBuildWizard(true),
                onViewFiles: (p) => {
                  setProjectFolder(p);
                  setShowFileBrowser(true);
                  setShowGlossary(false);
                },
                onRefresh: fetchBuildProjects,
                selectedModel,
                ollamaConnected: connected,
              }}
              chat={{
                messages,
                streaming,
                currentMode,
                connected,
                selectedModel,
                onSettingsClick: () => setShowSettings(true),
                onImageClick: openLightboxFromMessage,
                terminalOutput,
                messagesEndRef,
              }}
            />


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

            {/* Preflight Context Banner — Phase 1 (CTXFIX.md) */}
            <PreflightBanner
              visible={preflightBannerVisible && enablePreflightBanner}
              estimatedTokens={estimatedTokens}
              contextLength={contextLength}
              onNewThread={startNew}
            />

            {/* Input — hidden in Dashboard, Create, Review, and Terminal modes */}
            {mode !== "dashboard" &&
              mode !== "create" &&
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

                  {showModeSuggestion && (
                    <div className="mb-2 px-3 py-2 rounded-lg border border-indigo-500/30 bg-indigo-500/5 flex items-center gap-3">
                      <span className="text-base" aria-hidden="true">
                        {suggestedMode.icon}
                      </span>
                      <div className="flex-1 text-xs text-slate-300">
                        This looks like a{" "}
                        <span className="text-indigo-300 font-medium">
                          {suggestedMode.label}
                        </span>{" "}
                        task. Switch?
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMode(suggestedModeId);
                          setDismissedModeSuggestion(null);
                        }}
                        className="text-xs px-2.5 py-1 rounded-md border border-indigo-400/40 text-indigo-200 hover:bg-indigo-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                        title={`Switch to ${suggestedMode.label} mode`}
                      >
                        Switch
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDismissedModeSuggestion(suggestedModeId)
                        }
                        className="text-xs px-1.5 py-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-700/40 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                        title="Dismiss suggestion"
                        aria-label="Dismiss mode suggestion"
                      >
                        ✕
                      </button>
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
                          dictateGroqConfigured={dictateGroqConfigured}
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
                      {!streaming && canRecoverAgent && (
                        <button
                          type="button"
                          onClick={handleRecoverAgent}
                          className="rounded-xl px-3 py-2 text-xs font-medium bg-amber-500/20 text-amber-200 border border-amber-500/40 hover:bg-amber-500/30 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                          title="Retry last request with stricter tool-call enforcement"
                        >
                          Recover Agent
                        </button>
                      )}
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

          {/* Glossary (right panel) */}
          {showGlossary && (
            <aside
              className="w-80 flex-shrink-0 overflow-hidden min-h-0"
              aria-label="Jargon glossary"
            >
              <GlossaryPanel onClose={() => setShowGlossary(false)} />
            </aside>
          )}

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
                  setShowGlossary(false);
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
                imageSupportConfig={imageSupportConfig}
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
                    if (!res.ok) {
                      showToast(
                        data?.error || "Could not reset File Browser folder",
                      );
                      return;
                    }
                    setChatFolder(data.chatFolder || data.projectFolder || "");
                    const pfKey = data.projectFolder || projectFolder;
                    if (pfKey) {
                      const map = readFileBrowserRootsMap();
                      delete map[pfKey];
                      writeFileBrowserRootsMap(map);
                    }
                  } catch {
                    showToast("Could not reset File Browser folder");
                    setChatFolder(projectFolder);
                  }
                }}
                onSetFolder={async (folder) => {
                  const next = String(folder || "").trim();
                  if (!next) return;
                  setChatFolder(next);
                  try {
                    const res = await apiFetch("/api/config", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ chatFolder: next }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      showToast(
                        data?.error || "Could not save File Browser folder",
                      );
                      return;
                    }
                    if (data.chatFolder !== undefined)
                      setChatFolder(data.chatFolder);
                    const pfKey = data.projectFolder || projectFolder;
                    const resolved = data.chatFolder || next;
                    if (pfKey && resolved) {
                      const map = readFileBrowserRootsMap();
                      map[pfKey] = resolved;
                      writeFileBrowserRootsMap(map);
                    }
                  } catch {
                    showToast(
                      "Could not save File Browser folder (network error)",
                    );
                  }
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
          onRunSetupAssistant={() => {
            setShowSettings(false);
            setShowSetupAssistant(true);
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
      {showOnboarding && (
        <OnboardingWizard
          onComplete={(payload) => {
            setShowOnboarding(false);
            if (payload?.guidedSetup) setShowSetupAssistant(true);
          }}
        />
      )}
      {showSetupAssistant && (
        <SetupAssistantPanel
          isElectron={isElectron}
          onClose={() => setShowSetupAssistant(false)}
          onApplied={async () => {
            await fetchConfig();
            // Repopulate the toolbar dropdown in case the provider/key changed.
            await refreshModels();
            showToast("Settings updated");
          }}
        />
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
