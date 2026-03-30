import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api-fetch";
import McpServerPanel from "./McpServerPanel";
import McpClientPanel from "./McpClientPanel";
import { use3DEffects, THEME_PRESETS } from "../contexts/Effects3DContext";
import { resetOnboarding } from "./OnboardingWizard";
import { resetPrivacyBanner } from "./PrivacyBanner";
import {
  Download,
  Upload,
  Settings,
  ExternalLink,
  Power,
  RefreshCw,
} from "lucide-react";
import { OFFICIAL_RELEASES_LATEST_URL } from "../lib/release-urls";
import { AUTO_MODEL_MODE_ROWS } from "../lib/auto-model-modes";

/** Friendly copy for updater failures — avoid jargon; full technical text is often huge. */
function formatSoftwareUpdateError(raw) {
  if (raw == null || typeof raw !== "string") {
    return "We couldn't check for updates. Try again in a moment.";
  }
  const r = raw;
  if (
    (r.includes("latest-mac.yml") ||
      r.includes("latest.yml") ||
      r.includes("latest-linux")) &&
    (r.includes("404") || r.includes("Not Found") || r.includes("not find"))
  ) {
    return "We couldn't reach the update files on GitHub (they may still be uploading after a new release, or the release isn't published yet). Wait a few minutes and tap Check for updates again, or use Open download page to install the latest build manually.";
  }
  if (
    /HttpError:.*404/i.test(r) ||
    (r.includes("404") && r.includes("github.com"))
  ) {
    return "We couldn't find the update file online. Click Open download page below to download and install the latest version.";
  }
  if (/network|ENOTFOUND|ETIMEDOUT|ECONNRESET|getaddrinfo/i.test(r)) {
    return "We couldn't reach the update server. Check your internet connection, then try again.";
  }
  if (/certificate|SSL|TLS|UNABLE_TO_VERIFY/i.test(r)) {
    return "We couldn't verify the secure connection for updates. Check your network or VPN, then try again.";
  }
  return r.length > 280 ? `${r.slice(0, 240)}…` : r;
}

/** True when GitHub has not published updater YAML yet (common while CI uploads a new release). */
function isTransientGithubYaml404(raw) {
  if (raw == null || typeof raw !== "string") return false;
  const r = raw;
  return (
    (r.includes("latest-mac.yml") ||
      r.includes("latest.yml") ||
      r.includes("latest-linux")) &&
    (r.includes("404") || r.includes("Not Found") || r.includes("not find"))
  );
}

const UPDATER_YAML_404_RETRIES = 2;
const UPDATER_YAML_404_RETRY_MS = 12_000;

export default function SettingsPanel({
  ollamaUrl,
  projectFolder,
  icmTemplatePath,
  onSave,
  onClose,
  onOpenMemoryPanel,
}) {
  const [activeTab, setActiveTab] = useState("general");
  const [url, setUrl] = useState(ollamaUrl);
  const [ollamaApiKey, setOllamaApiKey] = useState("");
  const [folder, setFolder] = useState(projectFolder || "");
  const [icmTemplate, setIcmTemplate] = useState(icmTemplatePath || "");
  useEffect(() => setIcmTemplate(icmTemplatePath || ""), [icmTemplatePath]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [folderResult, setFolderResult] = useState(null);

  // Backend timeout state
  const [reviewTimeoutSec, setReviewTimeoutSec] = useState(300);
  const [chatTimeoutSec, setChatTimeoutSec] = useState(120);
  const [numCtx, setNumCtx] = useState(0);
  const [autoAdjustContext, setAutoAdjustContext] = useState(true);

  // Brand assets state
  const [brandAssets, setBrandAssets] = useState([]);
  const [brandLoaded, setBrandLoaded] = useState(false);

  // Image support state
  const [imageSupport, setImageSupport] = useState({
    enabled: true,
    maxSizeMB: 25,
    maxImagesPerMessage: 10,
    compressionQuality: 0.9,
  });
  const [models, setModels] = useState([]);
  const [autoModelMap, setAutoModelMap] = useState({});
  const [autoModelMapDefaults, setAutoModelMapDefaults] = useState({});
  const [showAutoModelMap, setShowAutoModelMap] = useState(false);

  // Docling (document conversion) state
  const [doclingUrl, setDoclingUrl] = useState("http://127.0.0.1:5002");
  const [doclingApiKey, setDoclingApiKey] = useState("");
  const [doclingEnabled, setDoclingEnabled] = useState(true);
  const [doclingOcr, setDoclingOcr] = useState(true);
  const [doclingTesting, setDoclingTesting] = useState(false);
  const [doclingTestResult, setDoclingTestResult] = useState(null);

  // Agent Terminal state
  const [terminalEnabled, setTerminalEnabled] = useState(false);
  const [terminalAllowlist, setTerminalAllowlist] = useState("");
  const [terminalTimeout, setTerminalTimeout] = useState(60);

  // GitHub token state (multi-PAT)
  const [ghToken, setGhToken] = useState("");
  const [ghTokenLabel, setGhTokenLabel] = useState("");
  const [ghTokenStatus, setGhTokenStatus] = useState(null);
  const [ghValidating, setGhValidating] = useState(false);
  const [ghResult, setGhResult] = useState(null);
  const {
    enabled: effects3D,
    setEnabled: setEffects3D,
    theme,
    setThemeId,
    customHue,
    setCustomHue,
  } = use3DEffects();

  // Electron state
  const isElectron =
    typeof window !== "undefined" && window.electronAPI?.isElectron;
  const [appVersion, setAppVersion] = useState(null);
  const [dataDir, setDataDir] = useState(null);
  const [preferredPort, setPreferredPort] = useState(3000);
  const [actualPort, setActualPort] = useState(null);
  const [portError, setPortError] = useState("");

  // Memory state
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [embeddingModel, setEmbeddingModel] = useState("");
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
  /** null until IPC returns; false = unpackaged dev; true = packaged installer — in-app updates only when true */
  const [isPackaged, setIsPackaged] = useState(null);

  // Load brand assets, timeout, port, and image support from config
  useEffect(() => {
    if (!brandLoaded) {
      apiFetch("/api/config")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.brandAssets)) setBrandAssets(data.brandAssets);
          if (data.reviewTimeoutSec != null)
            setReviewTimeoutSec(data.reviewTimeoutSec);
          if (data.chatTimeoutSec != null)
            setChatTimeoutSec(data.chatTimeoutSec);
          if (data.numCtx != null) setNumCtx(data.numCtx);
          if (data.autoAdjustContext != null)
            setAutoAdjustContext(data.autoAdjustContext);
          if (data.preferredPort != null) setPreferredPort(data.preferredPort);
          if (data.imageSupport) {
            setImageSupport({
              enabled: data.imageSupport.enabled ?? true,
              maxSizeMB: data.imageSupport.maxSizeMB ?? 25,
              maxImagesPerMessage: data.imageSupport.maxImagesPerMessage ?? 10,
              compressionQuality: data.imageSupport.compressionQuality ?? 0.9,
            });
          }
          if (data.ollamaApiKey != null)
            setOllamaApiKey(data.ollamaApiKey || "");
          if (data.docling) {
            setDoclingUrl(data.docling.url || "http://127.0.0.1:5002");
            setDoclingApiKey(data.docling.apiKey || "");
            setDoclingEnabled(data.docling.enabled ?? true);
            setDoclingOcr(data.docling.ocr ?? true);
          }
          if (data.agentTerminal) {
            setTerminalEnabled(data.agentTerminal.enabled ?? false);
            setTerminalAllowlist(
              (data.agentTerminal.allowlist || []).join(", "),
            );
            setTerminalTimeout(data.agentTerminal.maxTimeoutSec ?? 60);
          }
          if (data.autoModelMap && typeof data.autoModelMap === "object")
            setAutoModelMap(data.autoModelMap);
          if (
            data.autoModelMapDefaults &&
            typeof data.autoModelMapDefaults === "object"
          ) {
            setAutoModelMapDefaults(data.autoModelMapDefaults);
          }
          setBrandLoaded(true);
        })
        .catch(() => setBrandLoaded(true));
    }
  }, [brandLoaded]);

  // Load available models for vision detection
  useEffect(() => {
    apiFetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        if (data.models) setModels(data.models);
      })
      .catch(() => {});
  }, []);

  async function saveBrandAssets(assets) {
    setBrandAssets(assets);
    try {
      await apiFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandAssets: assets }),
      });
    } catch {}
  }

  async function saveImageSupport(updates) {
    const updatedSupport = { ...imageSupport, ...updates };
    setImageSupport(updatedSupport);
    try {
      await apiFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageSupport: updatedSupport }),
      });
    } catch {}
  }

  function addBrandAsset() {
    saveBrandAssets([...brandAssets, { label: "", path: "", description: "" }]);
  }

  function updateBrandAsset(index, field, value) {
    const updated = brandAssets.map((a, i) =>
      i === index ? { ...a, [field]: value } : a,
    );
    saveBrandAssets(updated);
  }

  function removeBrandAsset(index) {
    saveBrandAssets(brandAssets.filter((_, i) => i !== index));
  }

  // Fetch memory config and data on mount
  useEffect(() => {
    apiFetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.memory) {
          setMemoryEnabled(!!data.memory.enabled);
          setEmbeddingModel(data.memory.embeddingModel || "");
          setMaxContextTokens(data.memory.maxContextTokens || 500);
          setAutoExtract(data.memory.autoExtract !== false);
        }
      })
      .catch(() => {});
    apiFetch("/api/memory/models")
      .then((r) => r.json())
      .then((data) => {
        setEmbeddingModels(Array.isArray(data) ? data : data.models || []);
      })
      .catch(() => setEmbeddingModels([]));
    apiFetch("/api/memory/stats")
      .then((r) => r.json())
      .then((data) => {
        setMemoryStats(data);
      })
      .catch(() => {});
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
      await apiFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memory: memConfig }),
      });
    } catch {}
  }

  async function handleReembed() {
    if (
      !confirm(
        "Re-embed all memories with the current embedding model? This may take a while.",
      )
    )
      return;
    setReembedding(true);
    try {
      await apiFetch("/api/memory/reembed", { method: "POST" });
    } catch {}
    setReembedding(false);
  }

  useEffect(() => {
    fetchGhTokenStatus();
    if (isElectron) {
      fetchElectronData();

      // Listen for update events
      window.electronAPI.onUpdateAvailable((info) => {
        setUpdateStatus("available");
        setUpdateInfo(info);
      });
      window.electronAPI.onUpdateDownloadProgress?.((progress) => {
        setUpdateStatus("downloading");
        setDownloadProgress(Math.round(progress.percent));
      });
      window.electronAPI.onUpdateDownloaded((info) => {
        setUpdateStatus("ready");
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
      if (typeof window.electronAPI.getIsPackaged === "function") {
        try {
          setIsPackaged(await window.electronAPI.getIsPackaged());
        } catch {
          setIsPackaged(false);
        }
      } else {
        setIsPackaged(false);
      }
      if (typeof window.electronAPI.getUpdateState === "function") {
        try {
          const st = await window.electronAPI.getUpdateState();
          if (st?.success && st.updateDownloaded && st.updateInfo) {
            setUpdateStatus("ready");
            setUpdateInfo(st.updateInfo);
          }
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.error("Failed to fetch Electron data:", err);
    }
  }

  async function handleExportData() {
    try {
      const result = await window.electronAPI.exportData();
      if (result.success) {
        showToast("Data exported successfully");
      } else if (!result.cancelled) {
        showToast(`Export failed: ${result.error || "Unknown error"}`);
      }
    } catch (err) {
      showToast(`Export failed: ${err.message}`);
    }
  }

  async function handleImportData() {
    try {
      const result = await window.electronAPI.importData();
      if (result.success) {
        showToast("Data imported successfully. Reloading app...");
        setTimeout(() => window.location.reload(), 1500);
      } else if (!result.cancelled) {
        showToast(`Import failed: ${result.error || "Unknown error"}`);
      }
    } catch (err) {
      showToast(`Import failed: ${err.message}`);
    }
  }

  async function handleSavePort() {
    const portNum = parseInt(preferredPort, 10);
    if (portNum < 1024 || portNum > 65535) {
      setPortError("Port must be between 1024 and 65535");
      return;
    }
    setPortError("");
    try {
      if (isElectron) {
        // Electron mode: use IPC
        const result = await window.electronAPI.setPortConfig(portNum);
        if (result.success) {
          showToast("Port preference saved. Takes effect on next launch.");
        } else {
          setPortError(result.error || "Failed to save port");
        }
      } else {
        // Non-Electron mode: use API
        const response = await apiFetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferredPort: portNum }),
        });
        if (response.ok) {
          showToast("Port preference saved. Restart server to apply.");
        } else {
          setPortError("Failed to save port");
        }
      }
    } catch (err) {
      setPortError(err.message);
    }
  }

  async function handleCheckForUpdates(attempt = 0) {
    setUpdateStatus("checking");
    setUpdateError(null);
    try {
      const result = await window.electronAPI.checkForUpdates();
      if (!result.success) {
        const raw = result.error || "Check failed";
        if (
          attempt < UPDATER_YAML_404_RETRIES &&
          isTransientGithubYaml404(raw)
        ) {
          await new Promise((r) => setTimeout(r, UPDATER_YAML_404_RETRY_MS));
          return handleCheckForUpdates(attempt + 1);
        }
        setUpdateStatus("error");
        setUpdateError(formatSoftwareUpdateError(raw));
        return;
      }
      // updateInfo is present even when already latest; rely on isUpdateAvailable from main process.
      if (result.isUpdateAvailable) {
        setUpdateStatus("available");
        if (result.updateInfo) setUpdateInfo(result.updateInfo);
      } else {
        setUpdateStatus("up-to-date");
      }
    } catch (err) {
      const raw = err.message;
      if (attempt < UPDATER_YAML_404_RETRIES && isTransientGithubYaml404(raw)) {
        await new Promise((r) => setTimeout(r, UPDATER_YAML_404_RETRY_MS));
        return handleCheckForUpdates(attempt + 1);
      }
      setUpdateStatus("error");
      setUpdateError(formatSoftwareUpdateError(raw));
    }
  }

  /** Primary Upgrade / Download control: re-check when unknown; when already "available", start download (re-check alone does nothing visible). */
  async function handleUpgradeClick() {
    if (isPackaged !== true) return;
    setUpdateError(null);

    if (updateStatus === "available") {
      setUpdateStatus("downloading");
      setDownloadProgress(0);
      try {
        const dl = await window.electronAPI.downloadUpdate();
        if (dl.success) {
          if (dl.updateInfo) setUpdateInfo(dl.updateInfo);
          setUpdateStatus("ready");
          return;
        }
        const errMsg = dl.error || "";
        if (String(errMsg).includes("check update first")) {
          setUpdateStatus("available");
          await handleCheckForUpdates();
          return;
        }
        setUpdateStatus("error");
        setUpdateError(formatSoftwareUpdateError(errMsg));
      } catch (err) {
        setUpdateStatus("error");
        setUpdateError(formatSoftwareUpdateError(err.message));
      }
      return;
    }

    await handleCheckForUpdates();
  }

  async function handleRestartForUpdate() {
    try {
      await window.electronAPI.restartForUpdate();
    } catch (err) {
      setUpdateError(formatSoftwareUpdateError(err.message));
    }
  }

  async function handleOpenDownloadPage() {
    const api = window.electronAPI;
    if (api?.openExternalUrl) {
      const res = await api.openExternalUrl(OFFICIAL_RELEASES_LATEST_URL);
      if (!res?.success && res?.error) {
        setUpdateError(`Couldn't open your browser: ${res.error}`);
      }
      return;
    }
    window.open(OFFICIAL_RELEASES_LATEST_URL, "_blank", "noopener,noreferrer");
  }

  function showToast(msg) {
    // This would need to be passed as a prop or accessed via context
    // For now, using console.log as placeholder
    console.log("[Toast]", msg);
  }

  async function fetchGhTokenStatus() {
    try {
      const res = await apiFetch("/api/github/token/status");
      const data = await res.json();
      setGhTokenStatus(data);
    } catch {}
  }

  async function handleValidateGhToken() {
    if (!ghToken.trim()) return;
    setGhValidating(true);
    setGhResult(null);
    try {
      const res = await apiFetch("/api/github/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: ghToken,
          label: ghTokenLabel.trim() || undefined,
        }),
      });
      const data = await res.json();
      setGhResult(data);
      if (data.valid) {
        setGhToken("");
        setGhTokenLabel("");
        fetchGhTokenStatus();
      }
    } catch (err) {
      setGhResult({ valid: false, error: err.message });
    }
    setGhValidating(false);
  }

  async function handleRemoveGhTokenByName(name) {
    try {
      await apiFetch("/api/github/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remove: name }),
      });
      fetchGhTokenStatus();
    } catch {}
  }

  async function handleRemoveGhToken() {
    try {
      await apiFetch("/api/github/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "" }),
      });
      setGhTokenStatus(null);
      setGhResult(null);
    } catch {}
  }

  function ollamaApiKeyPayload() {
    const t = (ollamaApiKey || "").trim();
    if (t === "") return { ollamaApiKey: "" };
    if (/^•+$/.test(t)) return {};
    return { ollamaApiKey: t };
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const body = { ollamaUrl: url, ...ollamaApiKeyPayload() };
      await apiFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const res = await apiFetch("/api/models");
      const data = await res.json();
      setTestResult(
        data.connected
          ? { ok: true, count: data.models.length }
          : { ok: false, error: data.detail || "Cannot connect" },
      );
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    }
    setTesting(false);
  }

  async function handleDoclingTest() {
    setDoclingTesting(true);
    setDoclingTestResult(null);
    try {
      await apiFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docling: { url: doclingUrl, apiKey: doclingApiKey },
        }),
      });
      const res = await apiFetch("/api/docling/health");
      const data = await res.json();
      setDoclingTestResult(
        data.connected
          ? {
              ok: true,
              message: data.version
                ? `Connected (v${data.version})`
                : "Connected to docling-serve",
            }
          : { ok: false, error: data.detail || "Cannot connect" },
      );
    } catch (err) {
      setDoclingTestResult({ ok: false, error: err.message });
    }
    setDoclingTesting(false);
  }

  async function handleTestFolder() {
    setFolderResult(null);
    if (!folder.trim()) {
      setFolderResult({ ok: false, error: "Enter a folder path" });
      return;
    }
    try {
      const res = await apiFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectFolder: folder }),
      });
      const data = await res.json();
      if (data.error) {
        setFolderResult({ ok: false, error: data.error });
      } else {
        const treeRes = await apiFetch(
          `/api/files/tree?path=${encodeURIComponent(folder)}&depth=1`,
        );
        const treeData = await treeRes.json();
        if (treeData.tree) {
          setFolderResult({ ok: true, count: treeData.tree.length });
        } else {
          setFolderResult({
            ok: false,
            error: treeData.error || "Cannot read folder",
          });
        }
      }
    } catch (err) {
      setFolderResult({ ok: false, error: err.message });
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="glass-heavy rounded-2xl w-full max-w-lg p-6 neon-border max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-100 neon-text">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl transition-colors"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 p-1 glass rounded-lg">
          {[
            { id: "general", label: "General" },
            { id: "github", label: "GitHub" },
            { id: "mcp-server", label: "MCP Server" },
            { id: "mcp-clients", label: "MCP Clients" },
            { id: "memory", label: "Memory" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "btn-neon text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "general" && (
          <div className="space-y-5">
            {/* Ollama — local or Cloud (card so URL + API key are easy to find) */}
            <section
              className="rounded-xl border border-indigo-500/25 bg-slate-900/40 p-4 space-y-4"
              aria-labelledby="settings-ollama-heading"
            >
              <div className="flex flex-col gap-0.5">
                <h3
                  id="settings-ollama-heading"
                  className="text-sm font-semibold text-slate-100 tracking-tight"
                >
                  Ollama connection
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Use your computer (
                  <code className="text-[11px] bg-slate-800 px-1 rounded">
                    localhost:11434
                  </code>
                  ) or{" "}
                  <strong className="text-slate-400 font-medium">
                    Ollama Cloud
                  </strong>{" "}
                  — set URL to{" "}
                  <code className="text-[11px] bg-slate-800 px-1 rounded">
                    https://ollama.com
                  </code>{" "}
                  and add your API key below.
                </p>
              </div>

              <div>
                <label
                  className="block text-sm text-slate-300 mb-2 font-medium"
                  htmlFor="settings-ollama-url"
                >
                  Server URL
                </label>
                <div className="flex gap-2">
                  <input
                    id="settings-ollama-url"
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="http://localhost:11434 or https://ollama.com"
                    className="flex-1 input-glow text-slate-100 rounded-lg px-4 py-2.5 outline-none font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing}
                    className="btn-neon disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap shrink-0"
                  >
                    {testing ? (
                      <span className="inline-block spin">&#x27F3;</span>
                    ) : (
                      "Test"
                    )}
                  </button>
                </div>
                {testResult && (
                  <div
                    className={`mt-2 p-2.5 rounded-lg text-xs ${testResult.ok ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}
                  >
                    {testResult.ok
                      ? `Connected — ${testResult.count} model${testResult.count !== 1 ? "s" : ""} found.`
                      : `Failed: ${testResult.error}`}
                  </div>
                )}
              </div>

              <div>
                <label
                  className="block text-sm text-slate-300 mb-2 font-medium"
                  htmlFor="settings-ollama-api-key"
                >
                  Ollama Cloud API key{" "}
                  <span className="text-slate-500 font-normal">
                    (only if you use cloud)
                  </span>
                </label>
                <input
                  id="settings-ollama-api-key"
                  type="password"
                  value={ollamaApiKey}
                  onChange={(e) => setOllamaApiKey(e.target.value)}
                  placeholder="Paste key from ollama.com/settings/keys — leave empty for local Ollama only"
                  autoComplete="off"
                  className="w-full input-glow text-slate-100 rounded-lg px-4 py-2.5 outline-none font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  <a
                    href="https://ollama.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    Open Ollama API keys{" "}
                    <ExternalLink className="w-3 h-3 inline" aria-hidden />
                  </a>
                  <span className="text-slate-600 mx-1">·</span>
                  Or set env{" "}
                  <code className="text-[11px] bg-slate-800 px-1 rounded">
                    OLLAMA_API_KEY
                  </code>{" "}
                  (see docs). Tap{" "}
                  <strong className="text-slate-400">Save &amp; Close</strong>{" "}
                  to store the key.
                </p>
              </div>
            </section>

            {/* Document Conversion (Docling) */}
            <div className="border-t border-slate-700/40 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm text-slate-300 font-medium">
                  Document Conversion (Docling)
                </label>
                <button
                  onClick={() => {
                    const next = !doclingEnabled;
                    setDoclingEnabled(next);
                    apiFetch("/api/config", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ docling: { enabled: next } }),
                    });
                  }}
                  className={`relative w-9 h-5 rounded-full transition-colors ${doclingEnabled ? "bg-indigo-500" : "bg-slate-600"}`}
                  aria-label="Toggle document conversion"
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${doclingEnabled ? "translate-x-4" : ""}`}
                  />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Read PDF, PPTX, DOCX, XLSX and more via{" "}
                <a
                  href="https://github.com/docling-project/docling-serve"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline"
                >
                  docling-serve
                </a>
                . Install:{" "}
                <code className="text-[11px] bg-slate-800 px-1 rounded">
                  pip install "docling-serve[ui]"
                </code>{" "}
                then{" "}
                <code className="text-[11px] bg-slate-800 px-1 rounded">
                  docling-serve run --host 127.0.0.1 --port 5002
                </code>
              </p>
              {doclingEnabled && (
                <>
                  <label className="block text-sm text-slate-300 mb-2 font-medium">
                    Docling Server URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={doclingUrl}
                      onChange={(e) => setDoclingUrl(e.target.value)}
                      placeholder="http://127.0.0.1:5002"
                      className="flex-1 input-glow text-slate-100 rounded-lg px-4 py-2.5 outline-none font-mono text-sm"
                    />
                    <button
                      onClick={handleDoclingTest}
                      disabled={doclingTesting}
                      className="btn-neon disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap"
                    >
                      {doclingTesting ? (
                        <span className="inline-block spin">&#x27F3;</span>
                      ) : (
                        "Test Connection"
                      )}
                    </button>
                  </div>
                  {doclingTestResult && (
                    <div
                      className={`mt-2 p-2.5 rounded-lg text-xs ${doclingTestResult.ok ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}
                    >
                      {doclingTestResult.ok
                        ? doclingTestResult.message
                        : `Failed: ${doclingTestResult.error}`}
                    </div>
                  )}

                  <label className="block text-sm text-slate-300 mb-2 mt-3 font-medium">
                    API Key{" "}
                    <span className="text-slate-500 font-normal">
                      (optional)
                    </span>
                  </label>
                  <input
                    type="password"
                    value={doclingApiKey}
                    onChange={(e) => setDoclingApiKey(e.target.value)}
                    placeholder="Leave blank if not required"
                    className="w-full input-glow text-slate-100 rounded-lg px-4 py-2.5 outline-none font-mono text-sm"
                  />

                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="checkbox"
                      checked={doclingOcr}
                      onChange={(e) => setDoclingOcr(e.target.checked)}
                      id="docling-ocr"
                      className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
                    />
                    <label
                      htmlFor="docling-ocr"
                      className="text-sm text-slate-300 cursor-pointer"
                    >
                      Enable OCR for scanned documents
                    </label>
                  </div>
                </>
              )}
            </div>

            {/* Agent Terminal */}
            <div className="border-t border-slate-700/40 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm text-slate-300 font-medium">
                  Agent Terminal
                </label>
                <button
                  onClick={() => {
                    const next = !terminalEnabled;
                    setTerminalEnabled(next);
                    apiFetch("/api/config", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        agentTerminal: { enabled: next },
                      }),
                    });
                  }}
                  className={`relative w-9 h-5 rounded-full transition-colors ${terminalEnabled ? "bg-indigo-500" : "bg-slate-600"}`}
                  aria-label="Toggle agent terminal"
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${terminalEnabled ? "translate-x-4" : ""}`}
                  />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Allow the AI agent to run terminal commands in your project
                folder. Commands are restricted to the allowlist below.
              </p>
              {terminalEnabled && (
                <>
                  <label className="block text-sm text-slate-300 mb-2 font-medium">
                    Allowed Commands
                  </label>
                  <input
                    type="text"
                    value={terminalAllowlist}
                    onChange={(e) => setTerminalAllowlist(e.target.value)}
                    placeholder="npm, npx, node, git, python (comma-separated)"
                    className="w-full input-glow text-slate-100 rounded-lg px-4 py-2.5 outline-none font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1 mb-3">
                    Comma-separated list of allowed command names. Leave empty
                    to deny all commands.
                  </p>

                  <label className="block text-sm text-slate-300 mb-2 font-medium">
                    Command Timeout: {terminalTimeout}s
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={300}
                    step={10}
                    value={terminalTimeout}
                    onChange={(e) => setTerminalTimeout(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>10s</span>
                    <span>300s</span>
                  </div>
                </>
              )}
            </div>

            {/* Project Folder */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-medium">
                Project Folder
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  placeholder="Paste the path to your project folder"
                  className="flex-1 input-glow text-slate-100 rounded-lg px-4 py-2.5 outline-none font-mono text-sm"
                />
                <button
                  onClick={handleTestFolder}
                  className="btn-neon text-white rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap"
                >
                  Set Folder
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Defaults to your user (home) folder until you set another path.
                Point me to your project and I&apos;ll open the file browser for
                you.
              </p>
              {folderResult && (
                <div
                  className={`mt-2 p-2.5 rounded-lg text-xs ${folderResult.ok ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}
                >
                  {folderResult.ok
                    ? `Found ${folderResult.count} items in folder.`
                    : `Error: ${folderResult.error}`}
                </div>
              )}
            </div>

            {/* Create template (Commands + ICM-fw) */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-medium">
                Create template path
              </label>
              <input
                type="text"
                value={icmTemplate}
                onChange={(e) => setIcmTemplate(e.target.value)}
                placeholder="e.g. /Users/you/AI_Dev/_AI-IDEs (contains Commands and ICM-fw)"
                className="w-full input-glow text-slate-100 rounded-lg px-4 py-2.5 outline-none font-mono text-sm"
              />
              <p className="text-xs text-slate-400 mt-1.5">
                Folder that contains{" "}
                <code className="bg-slate-700/50 px-1 rounded">Commands</code>{" "}
                and <code className="bg-slate-700/50 px-1 rounded">ICM-fw</code>
                . New Create projects will copy these into the project.
              </p>
            </div>

            {/* Brand Assets */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-medium">
                Brand Assets
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Logo and image files the AI will use for branding in diagrams,
                reports, and builds.
              </p>
              <div className="space-y-2">
                {brandAssets.map((asset, i) => (
                  <div key={i} className="glass rounded-lg p-3 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={asset.label}
                        onChange={(e) =>
                          updateBrandAsset(i, "label", e.target.value)
                        }
                        placeholder="Label (e.g., Logo, Icon, Banner)"
                        className="w-1/3 input-glow text-slate-100 rounded-lg px-3 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={asset.path}
                        onChange={(e) =>
                          updateBrandAsset(i, "path", e.target.value)
                        }
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
                      value={asset.description || ""}
                      onChange={(e) =>
                        updateBrandAsset(i, "description", e.target.value)
                      }
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

            {/* Review Timeout */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-medium">
                Review Timeout{" "}
                <span className="text-slate-500 font-normal">
                  ({reviewTimeoutSec}s)
                </span>
              </label>
              <input
                type="range"
                min="60"
                max="600"
                step="30"
                value={reviewTimeoutSec}
                onChange={(e) =>
                  setReviewTimeoutSec(parseInt(e.target.value, 10))
                }
                onMouseUp={() => {
                  apiFetch("/api/config", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reviewTimeoutSec }),
                  }).catch(() => {});
                }}
                onTouchEnd={() => {
                  apiFetch("/api/config", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reviewTimeoutSec }),
                  }).catch(() => {});
                }}
                className="w-full h-2 rounded-full bg-slate-700 outline-none cursor-pointer accent-indigo-500"
                aria-label="Review timeout seconds"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>60s</span>
                <span>5 min</span>
                <span>10 min</span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                How long to wait for AI code reviews before timing out. Larger
                models need more time.
              </p>
            </div>

            {/* Chat Timeout */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-medium">
                Chat Timeout{" "}
                <span className="text-slate-500 font-normal">
                  ({chatTimeoutSec}s)
                </span>
              </label>
              <input
                type="range"
                min="30"
                max="600"
                step="30"
                value={chatTimeoutSec}
                onChange={(e) =>
                  setChatTimeoutSec(parseInt(e.target.value, 10))
                }
                onMouseUp={() => {
                  apiFetch("/api/config", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chatTimeoutSec }),
                  }).catch(() => {});
                }}
                onTouchEnd={() => {
                  apiFetch("/api/config", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chatTimeoutSec }),
                  }).catch(() => {});
                }}
                className="w-full h-2 rounded-full bg-slate-700 outline-none cursor-pointer accent-indigo-500"
                aria-label="Chat timeout seconds"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>30s</span>
                <span>5 min</span>
                <span>10 min</span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                How long to wait for chat responses. Increase for large
                documents or slow models.
              </p>
            </div>

            {/* Context Window & Auto-Adjust */}
            <div className="glass rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    Context Window (num_ctx)
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Controls how much text the model can process at once
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* num_ctx input */}
                <div>
                  <label className="block text-xs text-slate-400 mb-2">
                    Context Size{" "}
                    <span className="text-slate-300 font-medium">
                      (
                      {numCtx === 0
                        ? "Model Default"
                        : numCtx.toLocaleString() + " tokens"}
                      )
                    </span>
                  </label>
                  <select
                    value={numCtx}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setNumCtx(val);
                      apiFetch("/api/config", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ numCtx: val }),
                      }).catch(() => {});
                    }}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
                    <option value={0}>Model Default</option>
                    <option value={4096}>4K (small models)</option>
                    <option value={8192}>8K</option>
                    <option value={16384}>16K</option>
                    <option value={32768}>32K</option>
                    <option value={65536}>64K</option>
                    <option value={131072}>128K (large docs)</option>
                    <option value={262144}>256K (very large docs)</option>
                    <option value={524288}>512K (maximum)</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Higher values use more VRAM/RAM. Set to 128K+ for large
                    PDFs.
                  </p>
                </div>

                {/* Auto-adjust toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-300 font-medium">
                      Auto-Adjust Context
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Automatically increase num_ctx and timeout when large
                      files are attached
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const next = !autoAdjustContext;
                      setAutoAdjustContext(next);
                      apiFetch("/api/config", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ autoAdjustContext: next }),
                      }).catch(() => {});
                    }}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      autoAdjustContext ? "bg-indigo-500" : "bg-slate-600"
                    }`}
                    role="switch"
                    aria-checked={autoAdjustContext}
                    aria-label="Toggle auto-adjust context"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        autoAdjustContext ? "translate-x-4" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Auto model map (when toolbar uses &quot;Auto&quot;) */}
            <div className="glass rounded-lg p-4">
              <button
                type="button"
                onClick={() => setShowAutoModelMap(!showAutoModelMap)}
                className="w-full flex items-center justify-between text-left"
                aria-expanded={showAutoModelMap}
              >
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    Auto model map
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Per-mode defaults when you select{" "}
                    <strong className="text-slate-400">
                      Auto (best per mode)
                    </strong>{" "}
                    in the toolbar
                  </p>
                </div>
                <span className="text-slate-500 text-sm">
                  {showAutoModelMap ? "▼" : "▶"}
                </span>
              </button>
              {showAutoModelMap && (
                <div className="mt-4 space-y-3 border-t border-slate-600/40 pt-4">
                  <p className="text-xs text-slate-400">
                    Large requests may prefer cloud models; small ones may
                    prefer local — the server also checks your Ollama model
                    list.
                  </p>
                  <div className="overflow-x-auto max-h-[min(60vh,480px)] overflow-y-auto pr-1">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-600/50">
                          <th className="py-2 pr-3 font-medium">Mode</th>
                          <th className="py-2 font-medium">Model</th>
                        </tr>
                      </thead>
                      <tbody>
                        {AUTO_MODEL_MODE_ROWS.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-slate-700/40"
                          >
                            <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">
                              {row.label}
                            </td>
                            <td className="py-2">
                              <select
                                value={
                                  autoModelMap[row.id] ??
                                  autoModelMapDefaults[row.id] ??
                                  ""
                                }
                                onChange={async (e) => {
                                  const v = e.target.value;
                                  const next = { ...autoModelMap, [row.id]: v };
                                  setAutoModelMap(next);
                                  try {
                                    await apiFetch("/api/config", {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({
                                        autoModelMap: next,
                                      }),
                                    });
                                  } catch {}
                                }}
                                className="w-full max-w-[min(100%,280px)] bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200"
                              >
                                {models.length === 0 && (
                                  <option value="">Load models…</option>
                                )}
                                {models.map((m) => (
                                  <option key={m.name} value={m.name}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const next = { ...autoModelMapDefaults };
                      setAutoModelMap(next);
                      try {
                        await apiFetch("/api/config", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ autoModelMap: next }),
                        });
                      } catch {}
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/50 transition-colors"
                  >
                    Reset to defaults
                  </button>
                </div>
              )}
            </div>

            {/* Image Support (Beta) */}
            <div className="glass rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    Image Support (Beta)
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upload images for analysis with vision models
                  </p>
                </div>
                <button
                  onClick={() =>
                    saveImageSupport({ enabled: !imageSupport.enabled })
                  }
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                    imageSupport.enabled ? "bg-indigo-600" : "bg-slate-600"
                  }`}
                  role="switch"
                  aria-checked={imageSupport.enabled}
                  aria-label="Toggle image support"
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                      imageSupport.enabled ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {imageSupport.enabled && (
                <div className="space-y-4">
                  {/* Max Image Size */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">
                      Max Image Size{" "}
                      <span className="text-slate-300 font-medium">
                        ({imageSupport.maxSizeMB} MB)
                      </span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      step="1"
                      value={imageSupport.maxSizeMB}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setImageSupport((prev) => ({
                          ...prev,
                          maxSizeMB: val,
                        }));
                      }}
                      onMouseUp={() =>
                        saveImageSupport({ maxSizeMB: imageSupport.maxSizeMB })
                      }
                      onTouchEnd={() =>
                        saveImageSupport({ maxSizeMB: imageSupport.maxSizeMB })
                      }
                      className="w-full h-2 rounded-full bg-slate-700 outline-none cursor-pointer accent-indigo-500"
                      aria-label="Max image size in MB"
                    />
                    <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                      <span>1 MB</span>
                      <span>25 MB</span>
                      <span>50 MB</span>
                    </div>
                  </div>

                  {/* Max Images Per Message */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">
                      Max Images Per Message
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={imageSupport.maxImagesPerMessage}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (val >= 1 && val <= 20) {
                          saveImageSupport({ maxImagesPerMessage: val });
                        }
                      }}
                      className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 outline-none text-sm"
                    />
                  </div>

                  {/* Image Quality */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">
                      Image Quality{" "}
                      <span className="text-slate-300 font-medium">
                        ({Math.round(imageSupport.compressionQuality * 100)}%)
                      </span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="1.0"
                      step="0.1"
                      value={imageSupport.compressionQuality}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setImageSupport((prev) => ({
                          ...prev,
                          compressionQuality: val,
                        }));
                      }}
                      onMouseUp={() =>
                        saveImageSupport({
                          compressionQuality: imageSupport.compressionQuality,
                        })
                      }
                      onTouchEnd={() =>
                        saveImageSupport({
                          compressionQuality: imageSupport.compressionQuality,
                        })
                      }
                      className="w-full h-2 rounded-full bg-slate-700 outline-none cursor-pointer accent-indigo-500"
                      aria-label="Image compression quality"
                    />
                    <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                      <span>50%</span>
                      <span>75%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Available Vision Models */}
                  <div className="mt-4 pt-4 border-t border-slate-600/30">
                    <p className="text-xs font-medium text-slate-300 mb-2">
                      Available Vision Models
                    </p>
                    {models.filter((m) => m.supportsVision).length === 0 ? (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                        <p className="text-xs text-amber-400/90 mb-2">
                          No vision models installed. Install one to use image
                          features:
                        </p>
                        <code className="block bg-slate-800/50 px-3 py-2 rounded text-xs text-indigo-300 font-mono">
                          ollama pull llava
                        </code>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {models
                          .filter((m) => m.supportsVision)
                          .map((m) => (
                            <div
                              key={m.name}
                              className="flex items-center gap-2 text-xs bg-slate-700/30 rounded px-3 py-2"
                            >
                              <span className="text-lg">👁️</span>
                              <span className="text-slate-200 font-medium">
                                {m.name}
                              </span>
                              <span className="text-slate-500 text-[10px]">
                                ({m.size} GB)
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Port Configuration */}
            <div className="glass rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="w-4 h-4 text-slate-400" />
                <p className="text-sm font-medium text-slate-200">
                  Server Port
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-slate-400">
                  Preferred Port
                </label>
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
                    Currently running on port{" "}
                    <span className="text-indigo-300 font-medium">
                      {actualPort}
                    </span>
                  </p>
                )}
                <p className="text-xs text-slate-400">
                  Takes effect on next{" "}
                  {isElectron ? "launch" : "server restart"}. Port must be
                  between 1024-65535.
                </p>
              </div>
            </div>

            {/* 3D Effects Toggle */}
            <div className="glass rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">
                  3D Visual Effects
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Animated backgrounds, particle effects, and holographic
                  elements
                </p>
              </div>
              <button
                onClick={() => setEffects3D(!effects3D)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                  effects3D ? "bg-indigo-600" : "bg-slate-600"
                }`}
                role="switch"
                aria-checked={effects3D}
                aria-label="Toggle 3D effects"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                    effects3D ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Theme Picker — Hue Slider + Preset Quick Picks */}
            <div className="glass rounded-lg p-4">
              <p className="text-sm font-medium text-slate-200 mb-1">
                Color Theme
              </p>
              <p className="text-xs text-slate-500 mb-3">
                Slide to pick any color, or tap a preset
              </p>

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
                    background:
                      "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
                    WebkitAppearance: "none",
                    appearance: "none",
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
                {THEME_PRESETS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setThemeId(t.id)}
                    className={`w-6 h-6 rounded-full transition-all ${
                      theme.id === t.id
                        ? "ring-2 ring-white ring-offset-1 ring-offset-[#141829] scale-110"
                        : "hover:scale-110 opacity-70 hover:opacity-100"
                    }`}
                    style={{ background: t.primary }}
                    title={t.label}
                    aria-label={`Select ${t.label} theme`}
                  />
                ))}
                <span className="text-xs text-slate-500 ml-2">
                  {theme.label}
                </span>
              </div>
            </div>

            {/* Restart Tour / Reset Privacy */}
            <div className="glass rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">
                  Welcome Tour
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Re-show the onboarding walkthrough and privacy banner
                </p>
              </div>
              <button
                onClick={() => {
                  resetOnboarding();
                  resetPrivacyBanner();
                  window.location.reload();
                }}
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
                  <p className="text-sm font-medium text-slate-200 mb-3">
                    Data Management
                  </p>
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
                        Data location:{" "}
                        <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-indigo-300 text-[10px]">
                          {dataDir}
                        </code>
                      </p>
                    )}
                  </div>
                </div>

                {/* Quit / Restart — desktop only */}
                <div
                  className="glass rounded-lg p-4"
                  role="region"
                  aria-label="Quit or restart app"
                >
                  <p className="text-sm font-medium text-slate-200 mb-1">
                    Quit &amp; restart
                  </p>
                  <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                    Close the app completely, or restart it if something feels
                    stuck or after changing system settings.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          typeof window !== "undefined" &&
                          window.confirm(
                            "Quit Code Companion? The local server will stop until you open the app again.",
                          )
                        ) {
                          window.electronAPI?.quitApp?.();
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg glass text-slate-300 hover:text-rose-300 hover:bg-rose-500/10 transition-colors border border-slate-600 text-sm"
                    >
                      <Power className="w-4 h-4 shrink-0" aria-hidden />
                      Quit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          typeof window !== "undefined" &&
                          window.confirm(
                            "Restart Code Companion? The app will close and open again.",
                          )
                        ) {
                          window.electronAPI?.restartApp?.();
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg glass text-slate-300 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors border border-slate-600 text-sm"
                    >
                      <RefreshCw className="w-4 h-4 shrink-0" aria-hidden />
                      Restart
                    </button>
                  </div>
                </div>

                {/* Software Updates — releases from GitHub (electron-updater); not local git */}
                <div
                  className="glass rounded-lg p-4"
                  role="region"
                  aria-label="Software updates"
                >
                  <div className="mb-3">
                    <p className="text-sm font-medium text-slate-200">
                      Software Updates
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      We&apos;ll let you know when a newer version is ready.
                      After it downloads, you&apos;ll restart once to finish
                      installing. If anything goes wrong, use Open download page
                      to grab the installer directly — no command line needed.
                    </p>
                  </div>

                  <div
                    className={`text-xs mt-1 mb-3 min-h-[1.25rem] ${
                      updateStatus === "up-to-date"
                        ? "text-emerald-400/90"
                        : updateStatus === "error"
                          ? "text-red-400"
                          : "text-slate-400"
                    }`}
                    aria-live="polite"
                  >
                    {updateStatus === "up-to-date" && "You're up to date."}
                    {updateStatus === "available" &&
                      `Version ${updateInfo?.version} is ready. Click Download update, or wait if it already started in the background.`}
                    {updateStatus === "downloading" &&
                      `Downloading… ${downloadProgress}%`}
                    {updateStatus === "ready" &&
                      `Version ${updateInfo?.version} is ready. Click Restart to upgrade to finish.`}
                    {updateStatus === "checking" && "Checking for updates…"}
                    {updateStatus === "error" &&
                      (updateError ||
                        "We couldn't check for updates right now.")}
                    {!updateStatus &&
                      "Click Check for updates to see if a newer version is available."}
                  </div>

                  {/* Download progress bar */}
                  {updateStatus === "downloading" && (
                    <div className="mb-3">
                      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {isPackaged === false && (
                    <p className="text-xs text-amber-400/90 mb-3">
                      Installed app only: run a packaged build to upgrade from
                      here. For dev, pull and rebuild from the repo.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 items-center">
                    {updateStatus === "ready" ? (
                      <button
                        type="button"
                        onClick={handleRestartForUpdate}
                        className="btn-neon cursor-pointer text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141829]"
                      >
                        Restart to upgrade
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleUpgradeClick}
                        disabled={
                          isPackaged !== true ||
                          updateStatus === "checking" ||
                          updateStatus === "downloading"
                        }
                        className="glass cursor-pointer text-slate-300 hover:text-indigo-300 hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 border border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141829] disabled:focus-visible:ring-0"
                      >
                        {updateStatus === "checking" ? (
                          <span className="inline-block spin" aria-hidden>
                            &#x27F3;
                          </span>
                        ) : updateStatus === "available" ? (
                          "Download update"
                        ) : (
                          "Check for updates"
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenDownloadPage}
                      className="inline-flex items-center gap-1.5 glass cursor-pointer text-slate-400 hover:text-slate-200 hover:bg-slate-600/20 rounded-lg px-3 py-2 text-xs font-medium transition-colors border border-slate-600/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
                      title="Opens the official downloads page in your browser"
                    >
                      <ExternalLink
                        className="w-3.5 h-3.5 shrink-0 opacity-80"
                        aria-hidden
                      />
                      Open download page
                    </button>
                  </div>
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

            {/* Browser / dev server: explain why there is no updater button (Electron-only) */}
            {!isElectron && (
              <div
                className="glass rounded-lg p-4"
                role="region"
                aria-label="Software updates"
              >
                <p className="text-sm font-medium text-slate-200">
                  Software Updates
                </p>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Automatic updates run in the{" "}
                  <span className="text-slate-300">desktop app</span> only. In
                  the browser you&apos;re using the web version — refresh the
                  page or ask your host for a new build. For the installed app,
                  download updates from the{" "}
                  <a
                    className="text-indigo-300/90 hover:text-indigo-200 underline underline-offset-2"
                    href={OFFICIAL_RELEASES_LATEST_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    official download page
                  </a>
                  .
                </p>
              </div>
            )}

            <div className="mb-5 p-3 glass rounded-lg text-xs text-slate-400">
              <strong className="text-slate-300">Need a hand?</strong>
              <ul className="mt-1.5 space-y-1">
                <li>
                  Ollama on this machine:{" "}
                  <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-indigo-300">
                    http://localhost:11434
                  </code>
                </li>
                <li>
                  Ollama on your network:{" "}
                  <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-indigo-300">
                    http://192.168.x.x:11434
                  </code>
                </li>
                <li>
                  Project folder: paste the full path to your code, e.g.{" "}
                  <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-indigo-300">
                    /home/yourname/my-project
                  </code>
                </li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === "github" && (
          <div className="space-y-5">
            {/* Connected tokens list */}
            {ghTokenStatus?.tokens?.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-400 font-medium">
                  Connected Accounts
                </p>
                {ghTokenStatus.tokens.map((t, i) => (
                  <div
                    key={t.username || t.label || i}
                    className="glass rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 bg-green-400 rounded-full glow-pulse" />
                      {t.avatar && (
                        <img
                          src={t.avatar}
                          alt=""
                          className="w-6 h-6 rounded-full"
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          <span className="text-indigo-300">
                            {t.username || t.label}
                          </span>
                          {t.label && t.label !== t.username && (
                            <span className="text-slate-500 text-xs ml-1.5">
                              ({t.label})
                            </span>
                          )}
                        </p>
                        {i === 0 && (
                          <p className="text-[10px] text-slate-500">Primary</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleRemoveGhTokenByName(t.username || t.label)
                      }
                      className="text-xs text-red-400/70 hover:text-red-400 border border-red-500/20 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass rounded-lg p-4 text-center">
                <p className="text-sm text-slate-300 mb-1">
                  Let's connect your GitHub!
                </p>
                <p className="text-xs text-slate-500">
                  Add one or more tokens below to clone private repos and browse
                  your accounts.
                </p>
              </div>
            )}

            {/* Add token input */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-medium">
                Add Personal Access Token
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={ghTokenLabel}
                  onChange={(e) => setGhTokenLabel(e.target.value)}
                  placeholder="Label (optional, e.g. work)"
                  className="w-1/3 input-glow text-slate-100 rounded-lg px-3 py-2.5 outline-none text-sm"
                />
                <input
                  type="password"
                  value={ghToken}
                  onChange={(e) => setGhToken(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleValidateGhToken()
                  }
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="flex-1 input-glow text-slate-100 rounded-lg px-4 py-2.5 outline-none font-mono text-sm"
                />
                <button
                  onClick={handleValidateGhToken}
                  disabled={ghValidating || !ghToken.trim()}
                  className="btn-neon disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap"
                >
                  {ghValidating ? (
                    <span className="inline-block spin">&#x27F3;</span>
                  ) : (
                    "Add"
                  )}
                </button>
              </div>
              {ghResult && (
                <div
                  className={`mt-2 p-2.5 rounded-lg text-xs ${
                    ghResult.valid
                      ? "bg-green-500/10 border border-green-500/30 text-green-400"
                      : "bg-red-500/10 border border-red-500/30 text-red-400"
                  }`}
                >
                  {ghResult.valid
                    ? `Token valid! Connected as ${ghResult.username}.`
                    : `Invalid: ${ghResult.error}`}
                </div>
              )}
            </div>

            {/* Help */}
            <div className="glass rounded-lg p-3 text-xs text-slate-500">
              <p className="font-medium text-slate-400 mb-1.5">
                Here's how to get a token (it's quick!):
              </p>
              <ol className="space-y-1 list-decimal list-inside">
                <li>
                  Go to GitHub → Settings → Developer settings → Personal access
                  tokens → Tokens (classic)
                </li>
                <li>Click "Generate new token (classic)"</li>
                <li>
                  Select the{" "}
                  <code className="bg-slate-700/50 px-1 py-0.5 rounded text-indigo-300">
                    repo
                  </code>{" "}
                  scope (full control of private repos)
                </li>
                <li>Copy the token and paste it above</li>
              </ol>
              <p className="mt-2 text-amber-400/70">
                Don't worry — your token stays on your machine and is never
                shared with anyone.
              </p>
            </div>
          </div>
        )}

        {activeTab === "mcp-server" && <McpServerPanel />}
        {activeTab === "mcp-clients" && <McpClientPanel />}

        {activeTab === "memory" && (
          <div className="space-y-5">
            {/* Enable/Disable toggle */}
            <div className="glass rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">
                  Memory System
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Remember context from past conversations
                </p>
              </div>
              <button
                onClick={() => {
                  const next = !memoryEnabled;
                  setMemoryEnabled(next);
                  saveMemoryConfig({ enabled: next });
                }}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                  memoryEnabled ? "bg-indigo-600" : "bg-slate-600"
                }`}
                role="switch"
                aria-checked={memoryEnabled}
                aria-label="Toggle memory system"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                    memoryEnabled ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Embedding Model dropdown */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-medium">
                Embedding Model
              </label>
              {embeddingModels.length === 0 ? (
                <div className="glass rounded-lg p-3 text-xs text-amber-400/80 border border-amber-500/20">
                  No embedding models found. Run{" "}
                  <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-indigo-300">
                    ollama pull nomic-embed-text
                  </code>{" "}
                  to enable memory.
                </div>
              ) : (
                <select
                  value={embeddingModel}
                  onChange={(e) => {
                    setEmbeddingModel(e.target.value);
                    saveMemoryConfig({ embeddingModel: e.target.value });
                  }}
                  className="w-full input-glow text-slate-200 text-sm rounded-lg px-3 py-2"
                >
                  <option value="">Auto-detect</option>
                  {embeddingModels.map((m) => (
                    <option key={m.name || m} value={m.name || m}>
                      {m.name || m}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Max Context Tokens slider */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-medium">
                Max Context Tokens{" "}
                <span className="text-slate-500 font-normal">
                  ({maxContextTokens})
                </span>
              </label>
              <input
                type="range"
                min="100"
                max="2000"
                step="50"
                value={maxContextTokens}
                onChange={(e) => {
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
                <p className="text-sm font-medium text-slate-200">
                  Auto-Extract
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Extract memories after each conversation
                </p>
              </div>
              <button
                onClick={() => {
                  const next = !autoExtract;
                  setAutoExtract(next);
                  saveMemoryConfig({ autoExtract: next });
                }}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                  autoExtract ? "bg-indigo-600" : "bg-slate-600"
                }`}
                role="switch"
                aria-checked={autoExtract}
                aria-label="Toggle auto-extract"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                    autoExtract ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Memory Stats card */}
            {memoryStats && (
              <div className="glass rounded-lg p-4">
                <p className="text-sm font-medium text-slate-200 mb-3">
                  Memory Stats
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="glass rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-indigo-300">
                      {memoryStats.total ?? 0}
                    </p>
                    <p className="text-slate-500">Total</p>
                  </div>
                  <div className="glass rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-blue-300">
                      {memoryStats.byType?.fact ?? 0}
                    </p>
                    <p className="text-slate-500">Facts</p>
                  </div>
                  <div className="glass rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-green-300">
                      {memoryStats.byType?.project ?? 0}
                    </p>
                    <p className="text-slate-500">Projects</p>
                  </div>
                  <div className="glass rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-orange-300">
                      {memoryStats.byType?.pattern ?? 0}
                    </p>
                    <p className="text-slate-500">Patterns</p>
                  </div>
                  <div className="glass rounded-lg p-2 text-center col-span-2">
                    <p className="text-lg font-bold text-purple-300">
                      {memoryStats.byType?.summary ?? 0}
                    </p>
                    <p className="text-slate-500">Summaries</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (onOpenMemoryPanel) onOpenMemoryPanel();
                }}
                className="flex-1 glass text-slate-300 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors border border-slate-600"
              >
                Manage Memories
              </button>
              <button
                onClick={handleReembed}
                disabled={reembedding}
                className="flex-1 glass text-slate-300 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors border border-slate-600 disabled:opacity-50"
              >
                {reembedding ? (
                  <span className="inline-block spin">&#x27F3;</span>
                ) : (
                  "Re-embed All"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Buttons always visible */}
        <div className="flex gap-2 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 glass hover:bg-slate-600/30 text-slate-300 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              await onSave(url, folder, icmTemplate, ollamaApiKeyPayload());
              try {
                await apiFetch("/api/config", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    docling: {
                      url: doclingUrl,
                      apiKey: doclingApiKey,
                      enabled: doclingEnabled,
                      ocr: doclingOcr,
                    },
                    agentTerminal: {
                      enabled: terminalEnabled,
                      allowlist: terminalAllowlist
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                      maxTimeoutSec: terminalTimeout,
                    },
                  }),
                });
              } catch {}
              onClose();
            }}
            className="px-4 py-2 btn-neon text-white rounded-lg text-sm font-medium"
          >
            Save &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
}
