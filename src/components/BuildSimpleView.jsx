import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../lib/api-fetch";
import {
  Lightbulb,
  RefreshCw,
  FolderOpen,
  Layers,
  Search,
  FileText,
  Save,
  AlertTriangle,
} from "lucide-react";
import MarkdownContent from "./MarkdownContent";
import ChatSessionProgress from "./ui/ChatSessionProgress";
import ClaudeCodeHandoff from "./ClaudeCodeHandoff";

/**
 * Parse SSE stream from a fetch Response.
 * Reads chunks, splits on "data: " lines, parses JSON, calls onToken/onDone/onError.
 */
async function readSSEStream(response, { onToken, onDone, onError }) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(trimmed.slice(6));
          if (data.error) {
            onError(data.error);
            return;
          }
          if (data.done) {
            onDone(data);
            return;
          }
          if (data.token !== undefined) {
            onToken(data.token);
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }
    // Stream ended without done event
    onDone({});
  } catch (err) {
    onError(err.message || "Stream read failed");
  }
}

/**
 * BuildSimpleView — "What's Next" AI card, research/plan streaming, and quick actions.
 */
export default function BuildSimpleView({
  project,
  projectData,
  selectedModel,
  ollamaConnected,
  onToast,
  onViewFiles,
  onViewPhases,
}) {
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timestamp, setTimestamp] = useState(null);

  // Research and Plan state
  const [researchText, setResearchText] = useState("");
  const [planText, setPlanText] = useState("");
  const [streaming, setStreaming] = useState(null); // 'research' | 'plan' | null
  const [streamedContent, setStreamedContent] = useState("");
  const [streamError, setStreamError] = useState(null);
  const [planValidated, setPlanValidated] = useState(false);
  const [planWritten, setPlanWritten] = useState(false);
  const [saving, setSaving] = useState(false);

  // Determine the next incomplete phase number
  const getNextPhaseNumber = useCallback(() => {
    const phases = projectData?.roadmap?.phases;
    if (!phases || !Array.isArray(phases)) return 1;
    const incomplete = phases.find(
      (p) => p.status !== "complete" && p.status !== "completed",
    );
    return incomplete?.number || incomplete?.phase || 1;
  }, [projectData]);

  // Fetch recommendation on mount if Ollama is connected
  useEffect(() => {
    if (project?.id && ollamaConnected) {
      fetchNextAction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  async function fetchNextAction() {
    if (!project?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/build/projects/${project.id}/next-action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: selectedModel }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setRecommendation(data.action);
      setTimestamp(data.timestamp);
    } catch (err) {
      setError(err.message || "Failed to get recommendation");
    }
    setLoading(false);
  }

  async function handleResearch() {
    if (!project?.id || streaming) return;
    const phaseNumber = getNextPhaseNumber();

    setStreaming("research");
    setStreamedContent("");
    setStreamError(null);
    setResearchText("");
    setPlanText("");
    setPlanValidated(false);
    setPlanWritten(false);

    let accumulated = "";

    try {
      const res = await apiFetch(`/api/build/projects/${project.id}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel, phaseNumber }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      await readSSEStream(res, {
        onToken: (token) => {
          accumulated += token;
          setStreamedContent(accumulated);
        },
        onDone: () => {
          setResearchText(accumulated);
          setStreaming(null);
        },
        onError: (errMsg) => {
          setStreamError(errMsg);
          setStreaming(null);
        },
      });
    } catch (err) {
      setStreamError(err.message || "Research failed");
      setStreaming(null);
    }
  }

  async function handlePlan(writeToFile = false) {
    if (!project?.id || (streaming && !writeToFile)) return;
    const phaseNumber = getNextPhaseNumber();

    if (writeToFile) {
      // Re-call with writeToFile flag
      setSaving(true);
      try {
        const res = await apiFetch(`/api/build/projects/${project.id}/plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel,
            phaseNumber,
            researchContext: researchText,
            writeToFile: true,
          }),
        });
        // Read to completion (we already have the plan text, just need the write result)
        await readSSEStream(res, {
          onToken: () => {},
          onDone: (data) => {
            if (data.written) {
              setPlanWritten(true);
              onToast?.("Plan saved to project files");
            } else {
              onToast?.("Plan validation failed - not saved");
            }
            setSaving(false);
          },
          onError: (errMsg) => {
            setStreamError(errMsg);
            setSaving(false);
          },
        });
      } catch (err) {
        setStreamError(err.message || "Save failed");
        setSaving(false);
      }
      return;
    }

    setStreaming("plan");
    setStreamedContent("");
    setStreamError(null);
    setPlanText("");
    setPlanValidated(false);
    setPlanWritten(false);

    let accumulated = "";

    try {
      const res = await apiFetch(`/api/build/projects/${project.id}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          phaseNumber,
          researchContext: researchText,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      await readSSEStream(res, {
        onToken: (token) => {
          accumulated += token;
          setStreamedContent(accumulated);
        },
        onDone: (data) => {
          setPlanText(accumulated);
          setPlanValidated(!!data.validated);
          setStreaming(null);
        },
        onError: (errMsg) => {
          setStreamError(errMsg);
          setStreaming(null);
        },
      });
    } catch (err) {
      setStreamError(err.message || "Planning failed");
      setStreaming(null);
    }
  }

  const phaseNumber = getNextPhaseNumber();
  const isStreaming = streaming !== null;

  // Loading skeleton when projectData hasn't loaded yet
  if (!projectData && project?.id) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-xl p-5 space-y-3 animate-pulse">
            <div className="h-4 bg-slate-700/40 rounded w-1/3" />
            <div className="h-3 bg-slate-700/30 rounded w-2/3" />
            <div className="h-3 bg-slate-700/20 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ChatSessionProgress
        active={isStreaming || !!(ollamaConnected && loading)}
        detail={
          loading
            ? "Build · What's next"
            : streaming === "research"
              ? `Build · Research (phase ${phaseNumber})`
              : streaming === "plan"
                ? `Build · Plan (phase ${phaseNumber})`
                : "Build · Working"
        }
        testId="build-simple-session-progress"
      />
      {/* What's Next AI Card */}
      <div className="glass-neon rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb
              className={`w-5 h-5 ${ollamaConnected ? "text-amber-400" : "text-slate-500"}`}
            />
            <h3 className="text-sm font-semibold text-slate-200">
              What's Next
            </h3>
          </div>
          {ollamaConnected && !loading && (
            <button
              onClick={fetchNextAction}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-300 px-2 py-1 rounded-lg hover:bg-indigo-500/10 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Ask AI
            </button>
          )}
        </div>

        {/* Ollama offline state */}
        {!ollamaConnected && (
          <div className="text-sm text-slate-400 py-2">
            <p>Start Ollama to get AI-powered suggestions for your project.</p>
            <p className="text-xs text-slate-500 mt-1">
              The AI will analyze your project state and recommend the most
              impactful next step.
            </p>
          </div>
        )}

        {/* Loading state */}
        {ollamaConnected && loading && (
          <div className="flex items-center gap-2 py-3">
            <span className="inline-block animate-pulse text-indigo-400 text-sm">
              Thinking about your next step...
            </span>
          </div>
        )}

        {/* Error state */}
        {ollamaConnected && !loading && error && (
          <div className="glass rounded-lg p-3 space-y-2 border border-red-500/20 bg-red-500/5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">
                {error.includes("fetch") ||
                error.includes("network") ||
                error.includes("Failed to fetch")
                  ? "Could not reach the server. Is it running?"
                  : error}
              </p>
            </div>
            <button
              onClick={fetchNextAction}
              className="text-xs text-indigo-300 hover:text-indigo-200 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Recommendation */}
        {ollamaConnected && !loading && !error && recommendation && (
          <div className="space-y-2">
            <div className="prose prose-sm prose-invert max-w-none text-sm text-slate-300">
              <MarkdownContent
                content={
                  typeof recommendation === "string"
                    ? recommendation
                    : recommendation?.message?.content ||
                      JSON.stringify(recommendation)
                }
              />
            </div>
            {timestamp && (
              <p className="text-[10px] text-slate-500">
                Generated {new Date(timestamp).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* No recommendation yet (connected but not fetched) */}
        {ollamaConnected && !loading && !error && !recommendation && (
          <div className="text-sm text-slate-400 py-2">
            <p>
              Click "Ask AI" to get a recommendation for what to work on next.
            </p>
          </div>
        )}
      </div>

      {/* AI Research and Planning */}
      <div className="glass-neon rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Search
            className={`w-5 h-5 ${ollamaConnected ? "text-cyan-400" : "text-slate-500"}`}
          />
          <h3 className="text-sm font-semibold text-slate-200">
            AI Research and Planning
          </h3>
          <span className="text-[10px] text-slate-500 ml-auto">
            Phase {phaseNumber}
          </span>
        </div>

        {!ollamaConnected && (
          <div className="text-sm text-slate-400 py-2">
            <p>Start Ollama to use AI research and planning features.</p>
          </div>
        )}

        {ollamaConnected && (
          <>
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleResearch}
                disabled={isStreaming || !ollamaConnected}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/20 hover:border-cyan-500/40"
                title={
                  !ollamaConnected ? "Start Ollama to use AI features" : ""
                }
              >
                <Search className="w-3.5 h-3.5" />
                Research Phase
              </button>
              <button
                onClick={() => handlePlan(false)}
                disabled={isStreaming || !ollamaConnected || !researchText}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 border border-indigo-500/20 hover:border-indigo-500/40"
                title={
                  !researchText
                    ? "Run research first"
                    : !ollamaConnected
                      ? "Start Ollama to use AI features"
                      : ""
                }
              >
                <FileText className="w-3.5 h-3.5" />
                Generate Plan
              </button>
              {planText && planValidated && !planWritten && (
                <button
                  onClick={() => handlePlan(true)}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/20 hover:border-emerald-500/40"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? "Saving..." : "Save to Project"}
                </button>
              )}
              {planWritten && (
                <span className="text-xs text-emerald-400">Saved</span>
              )}
            </div>

            {/* Stream error */}
            {streamError && (
              <div className="glass rounded-lg p-3 space-y-2 border border-red-500/20 bg-red-500/5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{streamError}</p>
                </div>
                <button
                  onClick={() => {
                    setStreamError(null);
                  }}
                  className="text-xs text-indigo-300 hover:text-indigo-200 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Streaming status */}
            {streaming === "research" && (
              <div className="text-xs text-cyan-400 animate-pulse">
                Researching phase {phaseNumber}...
              </div>
            )}
            {streaming === "plan" && (
              <div className="text-xs text-indigo-400 animate-pulse">
                Generating plan for phase {phaseNumber}...
              </div>
            )}

            {/* Streamed content display */}
            {(streaming || researchText || planText) && (
              <div className="space-y-3">
                {/* Research output */}
                {(streaming === "research" || researchText) && (
                  <div className="glass rounded-lg p-4 max-h-64 overflow-y-auto">
                    <div className="text-[10px] text-cyan-400/60 uppercase tracking-wider mb-2 font-semibold">
                      Research
                    </div>
                    <div className="prose prose-sm prose-invert max-w-none text-sm text-slate-300">
                      <MarkdownContent
                        content={
                          streaming === "research"
                            ? streamedContent
                            : researchText
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Plan output */}
                {(streaming === "plan" || planText) && (
                  <div className="glass rounded-lg p-4 max-h-64 overflow-y-auto">
                    <div className="text-[10px] text-indigo-400/60 uppercase tracking-wider mb-2 font-semibold">
                      Plan
                    </div>
                    <div className="prose prose-sm prose-invert max-w-none text-sm text-slate-300">
                      <MarkdownContent
                        content={
                          streaming === "plan" ? streamedContent : planText
                        }
                      />
                    </div>
                    {planText && !planValidated && (
                      <div className="text-[10px] text-amber-400 mt-2">
                        Plan did not pass validation checks. Try regenerating.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Quick Actions
        </h3>
        <div className="flex items-center gap-2">
          {onViewFiles && (
            <button
              onClick={() => onViewFiles(project?.path)}
              className="flex items-center gap-1.5 glass text-xs text-slate-300 hover:text-indigo-300 px-3 py-2 rounded-lg transition-colors cursor-pointer hover:border-indigo-500/30 border border-transparent"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              View Files
            </button>
          )}
          {onViewPhases && (
            <button
              onClick={onViewPhases}
              className="flex items-center gap-1.5 glass text-xs text-slate-300 hover:text-indigo-300 px-3 py-2 rounded-lg transition-colors cursor-pointer hover:border-indigo-500/30 border border-transparent"
            >
              <Layers className="w-3.5 h-3.5" />
              View Phases
            </button>
          )}
        </div>
      </div>

      {/* Claude Code Handoff */}
      <ClaudeCodeHandoff
        project={project}
        projectData={projectData}
        onToast={onToast}
      />
    </div>
  );
}
