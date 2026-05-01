import { useState, useRef, useEffect, useCallback } from "react";
import { apiFetch } from "../lib/api-fetch";
import MessageBubble from "./MessageBubble";
import ExperimentInputForm from "./ExperimentInputForm";
import ExperimentReport from "./ExperimentReport";
import DeepDivePanel from "./DeepDivePanel";
import { sanitizeUnconfirmedImageClaims } from "../lib/chat-image-claims";
import {
  MAX_CHAT_POST_BYTES,
  estimateChatPostBodyBytes,
} from "../lib/chat-payload";
import ChatSessionProgress from "./ui/ChatSessionProgress";

const TERMINAL_STATUSES = new Set([
  "completed",
  "aborted",
  "failed",
  "timeout",
]);

/**
 * Phase-machine orchestrator for Experiment Mode.
 *
 *   input → running → report → [deep-dive] ↻ report → input (New experiment)
 *
 * The actual SSE pipe (POST /api/experiment/:id/step) is unchanged on the wire.
 * The "running" phase shows a live message stream + step ticker as the model
 * works; on terminal status the panel auto-transitions to "report".
 */
export default function ExperimentPanel({
  selectedModel,
  connected,
  onToast,
  projectFolder,
  chatFolder,
  agentMaxRounds,
}) {
  const [defaultCommandAllowlist, setDefaultCommandAllowlist] = useState([]);
  const [status, setStatus] = useState({
    enabled: false,
    maxRounds: 8,
    maxDurationSec: 900,
  });
  const [phase, setPhase] = useState("input"); // 'input' | 'running' | 'report' | 'deep-dive'
  const [experiment, setExperiment] = useState(null);
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [convId, setConvId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);
  const [existingRunId, setExistingRunId] = useState(null);
  const [activeStep, setActiveStep] = useState(null); // { step, index } | { outcome: true }
  const [deepDiveMessages, setDeepDiveMessages] = useState([]);
  const [progress, setProgress] = useState(null);
  const [restoredFromServer, setRestoredFromServer] = useState(false);
  // progress shape:
  //   { phase: 'thinking' | 'tool' | 'streaming' | 'finalizing',
  //     round: number, maxRounds: number, label: string, startedAt: number,
  //     toolName?: string, toolDetail?: string }
  const stepAbortRef = useRef(null);
  const pollRef = useRef(null);
  const elapsedTickRef = useRef(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Load server defaults (enabled flag, max rounds, max duration) on mount,
  // and the global agent-terminal allowlist used to seed the input form's
  // commands chip-row.
  useEffect(() => {
    apiFetch("/api/experiment/status")
      .then((r) => r.json())
      .then((j) => setStatus(j))
      .catch(() =>
        setStatus({ enabled: false, maxRounds: 8, maxDurationSec: 900 }),
      );
    apiFetch("/api/config")
      .then((r) => r.json())
      .then((cfg) => {
        const allow = Array.isArray(cfg?.agentTerminal?.allowlist)
          ? cfg.agentTerminal.allowlist
          : [];
        setDefaultCommandAllowlist(allow);
      })
      .catch(() => setDefaultCommandAllowlist([]));
  }, []);

  // Recover from mount-after-tab-switch: switching modes unmounts ExperimentPanel
  // and wipes local state. On remount, look up the latest experiment for this
  // project and restore the user's view (running banner + step stream, or report
  // card). Conversation history is rehydrated via the linked conversationId so
  // the user doesn't lose what they already chatted through.
  useEffect(() => {
    const folder = chatFolder || projectFolder;
    if (!folder) return;
    let cancelled = false;
    (async () => {
      try {
        const listRes = await apiFetch(
          `/api/experiment?projectFolder=${encodeURIComponent(folder)}&limit=1`,
        );
        if (!listRes.ok || cancelled) return;
        const { items } = await listRes.json();
        const latest = items?.[0];
        if (!latest || cancelled) return;

        // Skip if this user has already started a fresh run on this mount.
        if (experiment || phase !== "input") return;

        // Only auto-restore if it's still active OR very recently completed
        // (≤ 1h). Older terminal records are accessed via history, not auto-loaded.
        const ageMs = Date.now() - new Date(latest.updatedAt).getTime();
        const isActive = !TERMINAL_STATUSES.has(latest.status);
        if (!isActive && (Number.isNaN(ageMs) || ageMs > 60 * 60 * 1000))
          return;

        const expRes = await apiFetch(
          `/api/experiment/${encodeURIComponent(latest.id)}`,
        );
        if (!expRes.ok || cancelled) return;
        const fullRec = await expRes.json();
        if (cancelled || experiment) return;

        setExperiment(fullRec);
        setPhase(isActive ? "running" : "report");
        setRestoredFromServer(true);

        if (fullRec.conversationId) {
          try {
            const histRes = await apiFetch(
              `/api/history/${encodeURIComponent(fullRec.conversationId)}`,
            );
            if (histRes.ok && !cancelled) {
              const hist = await histRes.json();
              if (Array.isArray(hist.messages)) {
                setMessages(hist.messages);
                setConvId(hist.id || fullRec.conversationId);
              }
            }
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatFolder, projectFolder]);

  // Esc aborts any in-flight step request.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && streaming) stepAbortRef.current?.abort();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [streaming]);

  // Poll the experiment record while running, so the report-card transitions
  // happen on terminal status (completed/aborted/timeout) without depending on
  // SSE state — server is the source of truth.
  useEffect(() => {
    if (!experiment?.id || phase !== "running") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    const tick = async () => {
      try {
        const res = await apiFetch(
          `/api/experiment/${encodeURIComponent(experiment.id)}`,
        );
        if (!res.ok) return;
        const fresh = await res.json();
        setExperiment(fresh);
        if (TERMINAL_STATUSES.has(fresh.status)) {
          setPhase("report");
        }
      } catch {
        /* ignore */
      }
    };
    pollRef.current = setInterval(tick, 2500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [experiment?.id, phase]);

  const saveHistory = useCallback(
    async (msgs, overrides = {}) => {
      const title =
        overrides.title ||
        msgs.find((m) => m.role === "user")?.content?.slice(0, 60) ||
        "Experiment";
      const expField = overrides.experimentId ?? experiment?.id;
      try {
        const res = await apiFetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...overrides,
            id: overrides.id ?? convId ?? undefined,
            title,
            mode: "experiment",
            model: selectedModel,
            messages: msgs,
            ...(expField ? { experimentIds: [expField] } : {}),
          }),
        });
        const { id } = await res.json();
        if (id) setConvId(id);
        return id;
      } catch {
        return null;
      }
    },
    [convId, experiment?.id, selectedModel],
  );

  const refreshExperiment = useCallback(async (id) => {
    try {
      const r = await apiFetch(`/api/experiment/${encodeURIComponent(id)}`);
      if (!r.ok) return;
      const fresh = await r.json();
      setExperiment(fresh);
      if (TERMINAL_STATUSES.has(fresh.status)) {
        setPhase("report");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const noteStep = useCallback(
    async (rawAssistantText, idOverride) => {
      const eid = idOverride ?? experiment?.id;
      if (!eid || !rawAssistantText?.trim()) return;
      try {
        await apiFetch(`/api/experiment/${encodeURIComponent(eid)}/note-step`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawAssistantText: rawAssistantText.slice(0, 8000),
          }),
        });
        await refreshExperiment(eid);
      } catch {
        /* ignore */
      }
    },
    [experiment?.id, refreshExperiment],
  );

  const runStep = useCallback(
    async (nextMessages, conversationIdOverride, experimentIdOverride) => {
      const expId = experimentIdOverride ?? experiment?.id;
      if (!expId || !selectedModel || streaming) return;
      setStreaming(true);
      stepAbortRef.current?.abort();
      const ac = new AbortController();
      stepAbortRef.current = ac;

      const convForChat = conversationIdOverride ?? convId;
      const cap = Math.min(
        experiment?.maxRounds ?? status.maxRounds ?? 8,
        agentMaxRounds || status.maxRounds || 8,
        status.maxRounds || 8,
      );

      const postBody = {
        model: selectedModel,
        messages: nextMessages.map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.images && { images: m.images }),
        })),
        conversationId: convForChat || undefined,
        agentMaxRounds: cap,
      };
      const bytes = estimateChatPostBodyBytes(postBody);
      if (bytes > MAX_CHAT_POST_BYTES) {
        onToast?.("Request too large for experiment step.");
        setStreaming(false);
        return;
      }

      let assistantContent = "";
      let assistantImages = [];
      const buildAssistantMessage = () => ({
        role: "assistant",
        content: sanitizeUnconfirmedImageClaims(
          assistantContent,
          assistantImages.length > 0,
        ),
        ...(assistantImages.length > 0 ? { images: assistantImages } : {}),
      });

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const startedAt = Date.now();
      setElapsedSec(0);
      elapsedTickRef.current = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
      }, 1000);
      setProgress({
        phase: "thinking",
        round: 1,
        maxRounds: cap,
        label: `Waiting for ${selectedModel} to start…`,
        startedAt,
      });

      try {
        const res = await apiFetch(
          `/api/experiment/${encodeURIComponent(expId)}/step`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: ac.signal,
            body: JSON.stringify(postBody),
          },
        );
        if (!res.ok) {
          const t = await res.text();
          let err = t || res.statusText;
          try {
            const j = JSON.parse(t);
            err = j.error || err;
          } catch {
            /* */
          }
          throw new Error(err);
        }
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
                if (assistantContent === "") {
                  setProgress((p) =>
                    p
                      ? {
                          ...p,
                          phase: "streaming",
                          label: "Streaming response…",
                        }
                      : p,
                  );
                }
                assistantContent += parsed.token;
                setMessages((prev) => {
                  const copy = [...prev];
                  if (copy[copy.length - 1]?.role === "assistant") {
                    copy[copy.length - 1] = buildAssistantMessage();
                  }
                  return copy;
                });
              }
              if (parsed.toolImage?.data) {
                assistantImages.push(parsed.toolImage.data);
              }
              if (parsed.toolCallRound) {
                setProgress((p) =>
                  p
                    ? {
                        ...p,
                        phase: "thinking",
                        round: parsed.toolCallRound,
                        label: `Round ${parsed.toolCallRound} of ${p.maxRounds}: deciding next action…`,
                      }
                    : p,
                );
              }
              if (parsed.terminalCmd) {
                const cmd = parsed.terminalCmd.command || "";
                const args = Array.isArray(parsed.terminalCmd.args)
                  ? parsed.terminalCmd.args.join(" ")
                  : "";
                setProgress((p) =>
                  p
                    ? {
                        ...p,
                        phase: "tool",
                        toolName: "run_terminal_cmd",
                        toolDetail: `${cmd} ${args}`.trim().slice(0, 80),
                        label: `Running: ${cmd}`,
                      }
                    : p,
                );
              }
              if (parsed.terminalStatus) {
                const code = parsed.terminalStatus.exitCode;
                const ok = code === 0 || code === undefined;
                setProgress((p) =>
                  p
                    ? {
                        ...p,
                        phase: "thinking",
                        label: ok
                          ? "Terminal command finished — analyzing output…"
                          : `Command exited ${code} — analyzing…`,
                      }
                    : p,
                );
              }
              if (parsed.notice) {
                setProgress((p) =>
                  p ? { ...p, label: parsed.notice.message || p.label } : p,
                );
              }
              if (parsed.error) {
                assistantContent += `\n\nError: ${parsed.error}`;
                setProgress((p) =>
                  p
                    ? {
                        ...p,
                        phase: "thinking",
                        label: `Error: ${parsed.error}`.slice(0, 100),
                      }
                    : p,
                );
              }
            } catch {
              /* */
            }
          }
        }
        const finalMsgs = [...nextMessages, buildAssistantMessage()];
        setMessages(finalMsgs);
        await saveHistory(finalMsgs, { experimentId: expId });
        await noteStep(assistantContent, expId);
      } catch (e) {
        if (e.name === "AbortError") {
          setMessages((prev) => {
            const copy = [...prev];
            if (copy[copy.length - 1]?.role === "assistant") copy.pop();
            return copy;
          });
        } else {
          const errText = e.message || String(e);
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            const errorMsg = {
              role: "assistant",
              content: `**Experiment step failed**\n\n${errText}`,
            };
            if (last?.role === "assistant") {
              copy[copy.length - 1] = errorMsg;
            } else {
              copy.push(errorMsg);
            }
            return copy;
          });
          onToast?.(`❌ ${errText}`);
        }
      } finally {
        stepAbortRef.current = null;
        setStreaming(false);
        if (elapsedTickRef.current) {
          clearInterval(elapsedTickRef.current);
          elapsedTickRef.current = null;
        }
        setProgress(null);
      }
    },
    [
      experiment?.id,
      experiment?.maxRounds,
      selectedModel,
      streaming,
      convId,
      agentMaxRounds,
      status.maxRounds,
      saveHistory,
      noteStep,
      onToast,
    ],
  );

  const handleStart = useCallback(
    async (payload) => {
      if (!status.enabled) {
        onToast?.("Turn on Experiment mode in Settings → General.");
        return;
      }
      if (!connected || !selectedModel) {
        onToast?.("Pick a model and ensure Ollama is connected.");
        return;
      }
      setErrorBanner(null);
      setExistingRunId(null);
      setStarting(true);
      try {
        const res = await apiFetch("/api/experiment/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          if (res.status === 409 && j?.existingId) {
            setExistingRunId(j.existingId);
            setErrorBanner({
              title: "An experiment is already running",
              message:
                "This project already has an active experiment. Resume it or wait for it to finish before starting another.",
            });
            return;
          }
          throw new Error(j.error || res.statusText);
        }
        const { id, record } = await res.json();
        setExperiment(record || { id, ...payload });
        setConvId(null);
        setMessages([]);
        const seed = [
          {
            role: "user",
            content:
              `**Experiment hypothesis**\n\n${payload.hypothesis}\n\n` +
              `Work in small steps. Use the Step summary block when you finish each turn — include the **Done** marker on the final turn.`,
          },
        ];
        setMessages(seed);
        setPhase("running");
        const hid = await saveHistory(seed, {
          experimentId: id,
          title: payload.hypothesis.slice(0, 60),
        });
        await runStep(seed, hid || undefined, id);
      } catch (e) {
        onToast?.(`❌ ${e.message}`);
      } finally {
        setStarting(false);
      }
    },
    [status.enabled, connected, selectedModel, onToast, saveHistory, runStep],
  );

  const handleResumeExisting = useCallback(async () => {
    if (!existingRunId) return;
    try {
      const r = await apiFetch(
        `/api/experiment/${encodeURIComponent(existingRunId)}`,
      );
      if (!r.ok) return;
      const fresh = await r.json();
      setExperiment(fresh);
      setErrorBanner(null);
      setExistingRunId(null);
      if (TERMINAL_STATUSES.has(fresh.status)) {
        setPhase("report");
      } else {
        setPhase("running");
      }
    } catch {
      /* ignore */
    }
  }, [existingRunId]);

  const handleResume = useCallback(async () => {
    if (!experiment?.id || streaming) return;
    setRestoredFromServer(false);
    // Continue the conversation by sending a short user nudge — the model picks
    // up the prior thread and produces the next step. We don't auto-replay the
    // last assistant message because the SSE that produced it was killed by
    // navigation and may have only partially completed.
    const resumeNudge = {
      role: "user",
      content:
        "(Resuming this experiment after a tab switch — please continue from where you left off. If your previous turn ended mid-thought, finish it now and produce a Step summary block.)",
    };
    const next = [...messages, resumeNudge];
    setMessages(next);
    await saveHistory(next, { experimentId: experiment.id });
    await runStep(next);
  }, [experiment?.id, streaming, messages, saveHistory, runStep]);

  const handleAbort = useCallback(async () => {
    if (!experiment?.id) return;
    stepAbortRef.current?.abort();
    try {
      await apiFetch(
        `/api/experiment/${encodeURIComponent(experiment.id)}/abort`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "user" }),
        },
      );
      await refreshExperiment(experiment.id);
    } catch (e) {
      onToast?.(`❌ ${e.message}`);
    }
  }, [experiment?.id, onToast, refreshExperiment]);

  const handleNewExperiment = useCallback(() => {
    setExperiment(null);
    setMessages([]);
    setConvId(null);
    setActiveStep(null);
    setDeepDiveMessages([]);
    setRestoredFromServer(false);
    setPhase("input");
  }, []);

  const handleAskAboutStep = useCallback((step, index) => {
    setActiveStep({ step, index });
    setDeepDiveMessages([]);
    setPhase("deep-dive");
  }, []);

  const handleAskAboutOutcome = useCallback(() => {
    setActiveStep({ outcome: true });
    setDeepDiveMessages([]);
    setPhase("deep-dive");
  }, []);

  const handleBackFromDeepDive = useCallback(() => {
    setActiveStep(null);
    setPhase("report");
  }, []);

  // ── Render dispatch ────────────────────────────────

  if (!status.enabled || phase === "input") {
    return (
      <ExperimentInputForm
        status={status}
        connected={connected}
        selectedModel={selectedModel}
        projectFolder={chatFolder || projectFolder}
        defaultCommandAllowlist={defaultCommandAllowlist}
        starting={starting}
        errorBanner={errorBanner}
        existingRunId={existingRunId}
        onStart={handleStart}
        onResumeExisting={handleResumeExisting}
        onDismissError={() => setErrorBanner(null)}
      />
    );
  }

  if (phase === "deep-dive" && experiment) {
    const sysPrompt = activeStep?.outcome
      ? `You are helping the user understand the outcome of an experiment they ran. The hypothesis was: ${experiment.hypothesis}. The final status was ${experiment.status}. Final metric value: ${experiment.finalMetricValue}. Be specific — quote step Did/Observed text when relevant.`
      : `You are helping the user understand a single step from an experiment. Hypothesis: ${experiment.hypothesis}. Step ${activeStep?.index + 1} did: ${activeStep?.step?.did || "(unparsed)"}. Observed: ${activeStep?.step?.observed || "(unparsed)"}. Next: ${activeStep?.step?.next || "(unparsed)"}. Be specific and reference what actually happened.`;
    const seedQuestion = activeStep?.outcome
      ? "Walk me through what just happened. What worked, what didn't, and what would you try next?"
      : `Tell me more about this step. Why did the model choose this approach, and what does the observation imply?`;
    return (
      <DeepDivePanel
        title={
          activeStep?.outcome
            ? "Deep Dive · outcome"
            : `Deep Dive · step ${(activeStep?.index ?? 0) + 1}`
        }
        systemPrompt={sysPrompt}
        initialUserMessage={seedQuestion}
        initialMessages={deepDiveMessages.length > 0 ? deepDiveMessages : null}
        selectedModel={selectedModel}
        connected={connected}
        onBack={handleBackFromDeepDive}
        onMessagesChange={setDeepDiveMessages}
      />
    );
  }

  if (phase === "report" && experiment) {
    return (
      <ExperimentReport
        experiment={experiment}
        onNewExperiment={handleNewExperiment}
        onAskAboutStep={handleAskAboutStep}
        onAskAboutOutcome={handleAskAboutOutcome}
      />
    );
  }

  // running phase: show live stream + tiny banner with abort
  const scopeFolder = chatFolder || projectFolder || "(not set)";
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 border-b border-slate-700/50 glass px-4 py-2 space-y-2">
        <div className="flex items-center gap-2 flex-wrap justify-between">
          <div className="min-w-0 flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`inline-block w-2 h-2 rounded-full bg-emerald-400 motion-safe:animate-pulse motion-reduce:opacity-80`}
            />
            <div className="min-w-0">
              <div className="text-[10px] uppercase text-slate-500">
                Running experiment
              </div>
              <div className="text-sm text-slate-200 truncate">
                {experiment?.hypothesis || "(starting…)"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-mono truncate max-w-[220px]">
              scope: {scopeFolder}
            </span>
            {restoredFromServer && !streaming && (
              <button
                type="button"
                onClick={handleResume}
                disabled={!experiment?.id}
                className="rounded-lg px-3 py-1.5 text-xs bg-emerald-600/90 text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                Resume
              </button>
            )}
            <button
              type="button"
              onClick={handleAbort}
              disabled={!experiment?.id}
              className="rounded-lg px-3 py-1.5 text-xs bg-red-600/90 text-white hover:bg-red-500 disabled:opacity-40"
            >
              Abort
            </button>
          </div>
        </div>
        {restoredFromServer && !streaming && (
          <div
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200"
            role="status"
          >
            This run was paused when you switched tabs. Click{" "}
            <strong>Resume</strong> to continue, or <strong>Abort</strong> to
            stop. Your conversation is restored.
          </div>
        )}
        <ChatSessionProgress
          active={streaming}
          detail="Experiment · Running step"
          testId="experiment-session-progress"
        />
        <RunningProgress
          progress={progress}
          elapsedSec={elapsedSec}
          streaming={streaming}
        />
      </div>

      <div
        className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
        role="log"
        aria-label="Experiment messages"
      >
        {messages.map((msg, i) => (
          <div key={i} className="relative group mb-3">
            <MessageBubble
              role={msg.role}
              content={msg.content}
              streaming={
                streaming &&
                i === messages.length - 1 &&
                msg.role === "assistant"
              }
              images={msg.images}
            />
          </div>
        ))}
      </div>

      {experiment?.steps?.length > 0 && (
        <div className="shrink-0 max-h-32 overflow-y-auto scrollbar-thin border-t border-slate-700/40 px-4 py-2 bg-slate-900/40">
          <div className="text-[10px] uppercase text-slate-500 mb-1">
            Steps so far ({experiment.steps.length})
          </div>
          <ol className="space-y-1 text-xs text-slate-400">
            {experiment.steps.slice(-3).map((s, i) => (
              <li key={i} className="border-l-2 border-indigo-500/40 pl-2">
                <span className="text-slate-500">
                  {s.at ? new Date(s.at).toLocaleTimeString() : ""}
                </span>{" "}
                {(s.did || s.summary || "").slice(0, 160)}
                {(s.did || s.summary || "").length > 160 ? "…" : ""}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function fmtElapsed(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const PHASE_PILLS = {
  thinking: {
    text: "Thinking",
    cls: "bg-indigo-500/15 border-indigo-500/30 text-indigo-200",
  },
  tool: {
    text: "Tool",
    cls: "bg-amber-500/15 border-amber-500/30 text-amber-200",
  },
  streaming: {
    text: "Streaming",
    cls: "bg-emerald-500/15 border-emerald-500/30 text-emerald-200",
  },
  finalizing: {
    text: "Wrapping up",
    cls: "bg-slate-500/15 border-slate-500/30 text-slate-200",
  },
};

function RunningProgress({ progress, elapsedSec, streaming }) {
  if (!streaming && !progress) return null;
  const phase = progress?.phase || "thinking";
  const pill = PHASE_PILLS[phase] || PHASE_PILLS.thinking;
  const round = progress?.round || 1;
  const max = progress?.maxRounds || 1;
  const pct = Math.min(
    100,
    Math.round(((round - 1) / Math.max(1, max - 1)) * 100),
  );
  const label = progress?.label || "Working…";

  return (
    <div className="space-y-1.5" aria-live="polite" aria-atomic="true">
      <div className="flex items-center gap-2 text-[11px]">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wide ${pill.cls}`}
        >
          {pill.text}
        </span>
        <span className="text-slate-400 font-mono">
          Round {round}/{max}
        </span>
        <span className="text-slate-500 font-mono ml-auto tabular-nums">
          {fmtElapsed(elapsedSec)}
        </span>
      </div>
      <div className="text-xs text-slate-300 truncate" title={label}>
        {label}
      </div>
      <div
        className="h-1 bg-slate-800 rounded overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Round progress: ${round} of ${max}`}
      >
        <div
          className={`h-full rounded transition-all duration-300 ease-out ${
            phase === "tool"
              ? "bg-amber-400/80"
              : phase === "streaming"
                ? "bg-emerald-400/80 motion-safe:animate-pulse"
                : "bg-indigo-400/80 motion-safe:animate-pulse"
          }`}
          style={{ width: `${Math.max(6, pct)}%` }}
        />
      </div>
    </div>
  );
}
