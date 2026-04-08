import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "../lib/api-fetch";
import { useAbortable } from "../hooks/useAbortable";
import { registerAbort, unregisterAbort } from "../hooks/useAbortRegistry";
import StopButton from "./ui/StopButton";
import {
  FolderSearch,
  Download,
  Copy,
  Check,
  CheckCircle,
  XCircle,
  Github,
  PackageCheck,
} from "lucide-react";
import { copyText } from "../lib/clipboard";
import MarkdownContent from "./MarkdownContent";

const IDE_TARGETS = [
  {
    id: "claude",
    label: "Claude Code",
    path: ".claude/commands/validate.md",
    color: "text-indigo-300",
    bg: "hover:bg-indigo-500/10 hover:border-indigo-500/30",
  },
  {
    id: "cursor",
    label: "Cursor",
    path: ".cursor/prompts/validate.md",
    color: "text-blue-300",
    bg: "hover:bg-blue-500/10 hover:border-blue-500/30",
  },
  {
    id: "vscode",
    label: "VS Code",
    path: ".github/prompts/validate.prompt.md",
    color: "text-green-300",
    bg: "hover:bg-green-500/10 hover:border-green-500/30",
  },
  {
    id: "opencode",
    label: "OpenCode",
    path: ".opencode/commands/validate.md",
    color: "text-amber-300",
    bg: "hover:bg-amber-500/10 hover:border-amber-500/30",
  },
];

// ── Phase icons ──────────────────────────────────────
const PHASE_ICONS = {
  linting: "🔍",
  typeChecking: "📐",
  formatting: "🎨",
  testing: "🧪",
  ci: "⚙️",
};

// ── Validate Panel ──────────────────────────────────
export default function ValidatePanel({
  selectedModel,
  connected,
  onToast,
  models: _models,
}) {
  // ── State ─────────────────────────────────────────
  const [phase, setPhase] = useState("input"); // 'input' | 'scanning' | 'generating' | 'result'
  const [folderPath, setFolderPath] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [inputTab, setInputTab] = useState("folder"); // 'folder' | 'github'
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [generateError, setGenerateError] = useState("");
  const [copied, setCopied] = useState(false);
  const [installed, setInstalled] = useState({}); // { claude: true, cursor: true, ... }

  // ── Abort support ──────────────────────────────────
  const { startAbortable, abort, isAborted, clearAbortable } = useAbortable();
  const handleStop = useCallback(() => {
    abort();
    setPhase(generatedContent ? "result" : "input");
  }, [abort, generatedContent]);
  useEffect(() => {
    registerAbort(handleStop);
    return () => unregisterAbort(handleStop);
  }, [handleStop]);

  // ── Scan project ──────────────────────────────────
  const handleScan = useCallback(async () => {
    const target = inputTab === "github" ? githubUrl.trim() : folderPath.trim();
    if (!target) return;

    setScanError("");
    setScanResult(null);

    // If GitHub URL, clone first
    let folder = target;
    if (inputTab === "github") {
      setPhase("scanning");
      try {
        const res = await apiFetch("/api/github/clone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: target }),
        });
        const data = await res.json();
        if (!res.ok) {
          setScanError(data.error || "Clone failed");
          setPhase("input");
          return;
        }
        folder = data.localPath;
        setFolderPath(folder);
      } catch (err) {
        setScanError(`Clone failed: ${err.message}`);
        setPhase("input");
        return;
      }
    }

    setPhase("scanning");
    try {
      const res = await apiFetch("/api/validate/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error || "Scan failed");
        setPhase("input");
        return;
      }
      setScanResult(data);
      setPhase("input"); // stay on input to show scan results + generate button
    } catch (err) {
      setScanError(`Could not reach server: ${err.message}`);
      setPhase("input");
    }
  }, [folderPath, githubUrl, inputTab]);

  // ── Generate validate.md ──────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!scanResult || !selectedModel || !folderPath.trim()) return;

    setPhase("generating");
    setGeneratedContent("");
    setGenerateError("");

    let accumulated = "";
    try {
      const signal = startAbortable();
      const res = await apiFetch("/api/validate/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          model: selectedModel,
          folder: folderPath.trim(),
          scanResult,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.token) {
              accumulated += parsed.token;
              setGeneratedContent(accumulated);
            }
            if (parsed.error) {
              accumulated += `\nError: ${parsed.error}`;
              setGeneratedContent(accumulated);
            }
          } catch {}
        }
      }

      setGeneratedContent(accumulated);
      setPhase("result");
    } catch (err) {
      if (isAborted(err)) {
        setPhase(accumulated ? "result" : "input");
        return;
      }
      setGenerateError(`Generation failed: ${err.message}`);
      setPhase("input");
    } finally {
      clearAbortable();
    }
  }, [
    scanResult,
    selectedModel,
    folderPath,
    startAbortable,
    isAborted,
    clearAbortable,
  ]);

  // ── Export helpers ────────────────────────────────
  async function handleCopy() {
    await copyText(generatedContent);
    setCopied(true);
    onToast?.("validate.md copied to clipboard");
    setTimeout(() => setCopied(false), 3000);
  }

  function handleDownload(filename) {
    const blob = new Blob([generatedContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadAll() {
    // Download for all IDE formats
    handleDownload("validate.md");
    onToast?.(
      "validate.md downloaded — copy to .claude/commands/, .cursor/prompts/, .github/prompts/ as needed",
    );
  }

  async function handleInstallIDE(target) {
    try {
      const res = await apiFetch("/api/validate/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectFolder: folderPath,
          content: generatedContent,
          targets: [target.path],
        }),
      });
      const data = await res.json();
      if (res.ok && data.installed > 0) {
        setInstalled((prev) => ({ ...prev, [target.id]: true }));
        onToast?.(`Installed to ${target.path}`);
      } else {
        onToast?.(
          `Failed: ${data.results?.[0]?.error || data.error || "Unknown error"}`,
        );
      }
    } catch (err) {
      onToast?.(`Install failed: ${err.message}`);
    }
  }

  async function handleInstallAll() {
    try {
      const res = await apiFetch("/api/validate/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectFolder: folderPath,
          content: generatedContent,
          targets: IDE_TARGETS.map((t) => t.path),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const newInstalled = {};
        for (const r of data.results || []) {
          const target = IDE_TARGETS.find((t) => t.path === r.target);
          if (target && r.success) newInstalled[target.id] = true;
        }
        setInstalled((prev) => ({ ...prev, ...newInstalled }));
        onToast?.(`Installed to ${data.installed} IDE(s)`);
      } else {
        onToast?.(`Install failed: ${data.error}`);
      }
    } catch (err) {
      onToast?.(`Install failed: ${err.message}`);
    }
  }

  function handleReset() {
    setPhase("input");
    setScanResult(null);
    setScanError("");
    setGeneratedContent("");
    setGenerateError("");
    setCopied(false);
    setInstalled({});
  }

  // ── Render: Scanning/Generating ───────────────────
  if (phase === "scanning" || phase === "generating") {
    return (
      <section className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="flex items-center justify-center gap-2">
            <div
              className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <div
              className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <div
              className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <h2 className="text-lg font-semibold text-slate-200">
            {phase === "scanning"
              ? "Scanning project..."
              : "Generating validate.md..."}
          </h2>
          <p className="text-sm text-slate-400">
            {phase === "scanning"
              ? "Discovering linters, type checkers, test runners, and CI configs"
              : "AI is analyzing your project and writing a custom validation command"}
          </p>
          {phase === "generating" && generatedContent && (
            <p className="text-xs text-slate-500">
              {(generatedContent.length / 1024).toFixed(1)} KB generated
            </p>
          )}
        </div>
      </section>
    );
  }

  // ── Render: Result ────────────────────────────────
  if (phase === "result" && generatedContent) {
    return (
      <section className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Header */}
            <div className="glass rounded-2xl border border-slate-700/30 p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-2xl">
                  ✅
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-slate-100">
                    validate.md Generated
                  </h2>
                  <p className="text-sm text-slate-400 font-mono break-all mt-0.5">
                    {folderPath}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                  <button
                    onClick={handleCopy}
                    className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                      copied
                        ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                        : "border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
                    }`}
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button
                    onClick={handleDownloadAll}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/40 transition-colors cursor-pointer"
                  >
                    New
                  </button>
                </div>
              </div>
            </div>

            {/* IDE install buttons */}
            <div className="glass rounded-xl border border-slate-700/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-200">
                  Install as IDE Command
                </h3>
                <button
                  onClick={handleInstallAll}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                >
                  <PackageCheck className="w-3.5 h-3.5" /> Install All
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {IDE_TARGETS.map((target) => (
                  <button
                    key={target.id}
                    onClick={() => handleInstallIDE(target)}
                    className={`text-left bg-slate-800/50 rounded-lg p-3 font-mono text-xs border border-transparent transition-all cursor-pointer ${target.bg} ${
                      installed[target.id]
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={target.color + " font-semibold"}>
                        {target.label}
                      </span>
                      {installed[target.id] && (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                    <p className="text-slate-500 mt-0.5 text-[11px]">
                      {target.path}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Generated content */}
            <div className="glass rounded-xl border border-slate-700/30 p-4">
              <MarkdownContent content={generatedContent} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── Render: Input Phase ───────────────────────────
  return (
    <section className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center space-y-2 py-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
            Validate
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Point to a local project folder or GitHub repo. The AI will analyze
            it and generate a project-specific{" "}
            <code className="text-emerald-300">validate.md</code> command you
            can use in any IDE.
          </p>
        </div>

        {/* Errors */}
        {(scanError || generateError) && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{scanError || generateError}</p>
          </div>
        )}

        {/* Input */}
        <div className="glass rounded-xl border border-slate-700/30 p-4 space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-700/30 mb-2">
            <button
              onClick={() => setInputTab("folder")}
              className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors cursor-pointer ${
                inputTab === "folder"
                  ? "border-b-2 border-emerald-500 text-white -mb-px"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              <FolderSearch className="w-4 h-4" /> Local Folder
            </button>
            <button
              onClick={() => setInputTab("github")}
              className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors cursor-pointer ${
                inputTab === "github"
                  ? "border-b-2 border-emerald-500 text-white -mb-px"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              <Github className="w-4 h-4" /> GitHub Repo
            </button>
          </div>

          {inputTab === "folder" ? (
            <div>
              <label
                htmlFor="validate-folder"
                className="text-xs text-slate-400 block mb-1"
              >
                Project folder path
              </label>
              <div className="flex gap-2">
                <input
                  id="validate-folder"
                  type="text"
                  value={folderPath}
                  onChange={(e) => {
                    setFolderPath(e.target.value);
                    setScanResult(null);
                    setScanError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleScan();
                  }}
                  placeholder="/Users/you/project"
                  className="flex-1 input-glow text-slate-200 text-sm rounded-lg px-3 py-2 placeholder-slate-500 font-mono"
                />
                <button
                  onClick={handleScan}
                  disabled={!folderPath.trim()}
                  className="text-sm px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                >
                  Scan
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor="validate-github"
                className="text-xs text-slate-400 block mb-1"
              >
                GitHub repository URL or owner/repo
              </label>
              <div className="flex gap-2">
                <input
                  id="validate-github"
                  type="text"
                  value={githubUrl}
                  onChange={(e) => {
                    setGithubUrl(e.target.value);
                    setScanResult(null);
                    setScanError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleScan();
                  }}
                  placeholder="https://github.com/owner/repo or owner/repo"
                  className="flex-1 input-glow text-slate-200 text-sm rounded-lg px-3 py-2 placeholder-slate-500 font-mono"
                />
                <button
                  onClick={handleScan}
                  disabled={!githubUrl.trim()}
                  className="text-sm px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                >
                  Clone & Scan
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scan Results */}
        {scanResult && (
          <div className="glass rounded-xl border border-slate-700/30 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">
              Project Analysis
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Language</p>
                <p className="text-sm text-slate-200 font-medium capitalize">
                  {scanResult.language}
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Framework</p>
                <p className="text-sm text-slate-200 font-medium capitalize">
                  {scanResult.framework}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {[
                { key: "linting", label: "Linting", icon: PHASE_ICONS.linting },
                {
                  key: "typeChecking",
                  label: "Type Checking",
                  icon: PHASE_ICONS.typeChecking,
                },
                {
                  key: "formatting",
                  label: "Formatting",
                  icon: PHASE_ICONS.formatting,
                },
                { key: "testing", label: "Testing", icon: PHASE_ICONS.testing },
                { key: "ci", label: "CI/CD", icon: PHASE_ICONS.ci },
              ].map(({ key, label, icon }) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <span>{icon}</span>
                  <span className="text-slate-300 w-28">{label}</span>
                  {scanResult[key]?.length > 0 ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-slate-400 font-mono truncate">
                        {scanResult[key].join(", ")}
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-slate-600" />
                      <span className="text-xs text-slate-600">not found</span>
                    </>
                  )}
                </div>
              ))}

              {scanResult.testDirs?.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span>📁</span>
                  <span className="text-slate-300 w-28">Test Dirs</span>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-slate-400 font-mono">
                    {scanResult.testDirs.join(", ")}
                  </span>
                </div>
              )}

              {Object.keys(scanResult.scripts || {}).length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/30">
                  <p className="text-xs text-slate-500 mb-2">
                    Package scripts:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(scanResult.scripts).map((s) => (
                      <span
                        key={s}
                        className="text-[11px] font-mono bg-slate-700/40 text-slate-300 px-2 py-0.5 rounded"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Generate button */}
            {phase === "generating" ? (
              <StopButton
                onClick={handleStop}
                label="Stop Generation"
                className="w-full py-3 text-sm"
              />
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!selectedModel || !connected}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl px-6 py-3 font-medium text-sm transition-colors disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                {!connected
                  ? "Connect to Ollama First"
                  : !selectedModel
                    ? "Select a Model"
                    : "Generate validate.md"}
              </button>
            )}
          </div>
        )}

        {/* Empty state */}
        {!scanResult && !scanError && (
          <div className="text-center py-6">
            <FolderSearch className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              Enter a project path or GitHub URL and click Scan
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Discovers linters, type checkers, test runners, CI configs, and
              package scripts
            </p>
          </div>
        )}

        {/* Tips */}
        <div className="glass rounded-xl border border-slate-700/20 p-4 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-400">What gets generated:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>
              A <code className="text-emerald-300">validate.md</code> command
              file customized to your project
            </li>
            <li>Phased validation: Lint → Type Check → Style → Tests → E2E</li>
            <li>Only includes phases your project actually supports</li>
            <li>
              Compatible with Claude Code, Cursor, VS Code Copilot, and OpenCode
            </li>
            <li>
              Includes a journal entry template for tracking validation runs
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
