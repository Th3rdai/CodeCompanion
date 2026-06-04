import { useState, useCallback } from "react";
import { apiFetch } from "../../lib/api-fetch";
import MarkdownContent from "../chat/MarkdownContent";
import { X, Sparkles, CheckCircle2, Loader2, Info } from "lucide-react";

const EXAMPLE_GOALS = [
  "Turn on embedding memory with safe defaults",
  "Turn off Docling; I will not use document conversion",
  "Use stricter chat-agent defaults (safer file writes)",
  "Help me understand what to configure first",
];

/**
 * AI-guided setup assistant (SETUPUX v1). POSTs to /api/setup-assistant and
 * applies validated patches via POST /api/config.
 */
export default function SetupAssistantPanel({
  isElectron,
  onClose,
  onApplied,
}) {
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);

  const runAssistant = useCallback(async () => {
    setErr(null);
    setResult(null);
    const trimmed = goal.trim();
    if (!trimmed) {
      setErr(
        "Describe what you want to set up (one or two sentences is enough).",
      );
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/setup-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: trimmed }],
          phase: "goals",
          isElectron: !!isElectron,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503 && data.code === "OLLAMA_UNAVAILABLE") {
        setErr(`Ollama is not reachable. ${(data.steps || []).join(" ")}`);
        return;
      }
      if (!res.ok) {
        const base =
          typeof data.error === "string"
            ? data.error
            : "Something went wrong. Try again.";
        const detail =
          typeof data.detail === "string" && data.detail.trim()
            ? data.detail.trim()
            : "";
        const hints = Array.isArray(data.hints)
          ? data.hints.filter((h) => typeof h === "string" && h.trim())
          : [];
        const parts = [base];
        if (detail) {
          parts.push("", "Details from Ollama:", detail);
        }
        if (hints.length) {
          parts.push("", "Try this:", ...hints.map((h, i) => `${i + 1}. ${h}`));
        }
        setErr(parts.join("\n"));
        return;
      }
      setResult(data);
    } catch (e) {
      setErr(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }, [goal, isElectron]);

  const applyPatch = useCallback(async () => {
    if (!result?.configPatch || typeof result.configPatch !== "object") return;
    const keys = Object.keys(result.configPatch);
    if (keys.length === 0) {
      setErr(
        "Nothing to apply — pick different goals or adjust Settings manually.",
      );
      return;
    }
    setApplying(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.configPatch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(
          typeof data.error === "string"
            ? data.error
            : "Could not save settings.",
        );
        return;
      }
      if (typeof onApplied === "function") await onApplied(data);
      onClose?.();
    } catch (e) {
      setErr(e?.message || "Network error");
    } finally {
      setApplying(false);
    }
  }, [result, onApplied, onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Setup assistant"
    >
      <div className="glass-heavy rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col neon-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
            <Sparkles className="w-4 h-4 text-indigo-400" aria-hidden />
            Guided setup
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div className="rounded-lg border border-indigo-500/30 bg-slate-900/50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold uppercase tracking-wide">
              <Info className="w-3.5 h-3.5 shrink-0" aria-hidden />
              What lives in this app
            </div>
            <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4 marker:text-indigo-400">
              <li>
                <strong className="text-slate-200">Top bar</strong> — switch{" "}
                <strong className="text-slate-200">modes</strong> (Chat,
                Explain, Review, Security, Validate, Create, Build, and more).
                Open <strong className="text-slate-200">Glossary</strong>,{" "}
                <strong className="text-slate-200">GitHub</strong>, and the{" "}
                <strong className="text-slate-200">Files</strong> browser from
                here. On desktop you may also see <strong>Terminal</strong>.
              </li>
              <li>
                <strong className="text-slate-200">Settings (gear)</strong> —{" "}
                <strong>General:</strong> Ollama URL / cloud key, project &
                file-browser folders, chat timeouts, agent terminal & browser
                safety, voice dictation. <strong>Memory:</strong> optional saved
                facts across chats. <strong>MCP:</strong> plug in external
                tools. <strong>GitHub</strong> tab for tokens & repos.
              </li>
              <li>
                <strong className="text-slate-200">Chat toolbar</strong> —{" "}
                export conversations, save chat, attach files/images.
              </li>
            </ul>
            <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-700/60 pt-2">
              Below, describe what you want in plain language. We suggest
              checked Settings changes only — paste API keys in Settings, not
              here.
            </p>
          </div>

          <div>
            <p className="text-[11px] text-slate-500 mb-1.5">
              Examples — tap to use:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_GOALS.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setGoal(ex);
                    setErr(null);
                  }}
                  className="text-[11px] px-2 py-1 rounded-md bg-slate-800/80 text-indigo-200 border border-slate-600/60 hover:border-indigo-500/50 hover:bg-slate-700/80 text-left"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            placeholder="Example: I want embedding memory on and safer chat file rules."
            className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 text-sm outline-none resize-y min-h-[88px]"
          />

          <button
            type="button"
            disabled={loading}
            onClick={runAssistant}
            className="w-full btn-neon text-white rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Working…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" aria-hidden />
                Get suggestions
              </>
            )}
          </button>

          {err && (
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg p-3 whitespace-pre-wrap">
              {err}
            </div>
          )}

          {result && (
            <div className="space-y-3 text-sm">
              <div className="text-slate-200">
                <MarkdownContent
                  content={result.summaryMarkdown || ""}
                  streaming={false}
                />
              </div>

              {Array.isArray(result.acquire) && result.acquire.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Next steps
                  </p>
                  {result.acquire.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-lg border border-slate-600/40 bg-slate-900/40 p-3 space-y-2"
                    >
                      <p className="text-slate-100 text-sm font-medium">
                        {a.title}
                      </p>
                      <div className="text-xs text-slate-300 prose prose-invert max-w-none">
                        <MarkdownContent
                          content={a.stepsMd || ""}
                          streaming={false}
                        />
                      </div>
                      {Array.isArray(a.urls) &&
                        a.urls.map((u) => (
                          <a
                            key={u}
                            href={u}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 text-xs hover:underline block"
                          >
                            {u}
                          </a>
                        ))}
                    </div>
                  ))}
                </div>
              )}

              {result.configPatch &&
                Object.keys(result.configPatch).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Proposed settings (JSON)
                    </p>
                    <pre className="text-[11px] text-slate-300 bg-slate-950/80 rounded-lg p-3 overflow-x-auto border border-slate-700/50">
                      {JSON.stringify(result.configPatch, null, 2)}
                    </pre>
                    <button
                      type="button"
                      disabled={applying}
                      onClick={applyPatch}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {applying ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" aria-hidden />
                      )}
                      Apply suggested settings
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
