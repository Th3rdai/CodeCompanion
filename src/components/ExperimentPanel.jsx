import { useState, useRef, useEffect, useCallback } from "react";
import { apiFetch } from "../lib/api-fetch";
import MessageBubble from "./MessageBubble";
import { sanitizeUnconfirmedImageClaims } from "../lib/chat-image-claims";
import {
  MAX_CHAT_POST_BYTES,
  estimateChatPostBodyBytes,
} from "../lib/chat-payload";

/**
 * Bounded experiment loops: hypothesis → steps via POST /api/experiment/:id/step (SSE).
 */
export default function ExperimentPanel({
  selectedModel,
  connected,
  onToast,
  projectFolder,
  chatFolder,
  agentMaxRounds,
}) {
  const [status, setStatus] = useState({ enabled: false, maxRounds: 8 });
  const [hypothesis, setHypothesis] = useState("");
  const [budgetRounds, setBudgetRounds] = useState(8);
  const [experimentId, setExperimentId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [convId, setConvId] = useState(null);

  const stepAbortRef = useRef(null);

  useEffect(() => {
    apiFetch("/api/experiment/status")
      .then((r) => r.json())
      .then((j) => {
        setStatus(j);
        const cap = Math.min(Math.max(parseInt(j.maxRounds, 10) || 8, 1), 25);
        setBudgetRounds(cap);
      })
      .catch(() => setStatus({ enabled: false, maxRounds: 8 }));
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && streaming) stepAbortRef.current?.abort();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [streaming]);

  const saveHistory = useCallback(
    async (msgs, overrides = {}) => {
      const title =
        overrides.title ||
        msgs.find((m) => m.role === "user")?.content?.slice(0, 60) ||
        "Experiment";
      const expField = overrides.experimentId ?? experimentId;
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
            ...(expField ? { experimentId: expField } : {}),
          }),
        });
        const { id } = await res.json();
        if (id) setConvId(id);
        return id;
      } catch {
        return null;
      }
    },
    [convId, experimentId, selectedModel],
  );

  const noteStep = useCallback(
    async (summary, idOverride) => {
      const eid = idOverride ?? experimentId;
      if (!eid || !summary?.trim()) return;
      try {
        await apiFetch(`/api/experiment/${encodeURIComponent(eid)}/note-step`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary: summary.slice(0, 4000) }),
        });
        const r = await apiFetch(`/api/experiment/${encodeURIComponent(eid)}`);
        const exp = await r.json();
        setTimeline(exp.steps || []);
      } catch {
        /* ignore */
      }
    },
    [experimentId],
  );

  const runStep = useCallback(
    async (nextMessages, conversationIdOverride, experimentIdOverride) => {
      const expId = experimentIdOverride ?? experimentId;
      if (!expId || !selectedModel || streaming) return;
      setStreaming(true);
      stepAbortRef.current?.abort();
      const ac = new AbortController();
      stepAbortRef.current = ac;

      const convForChat = conversationIdOverride ?? convId;

      const postBody = {
        model: selectedModel,
        messages: nextMessages.map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.images && { images: m.images }),
        })),
        conversationId: convForChat || undefined,
        agentMaxRounds: Math.min(
          budgetRounds,
          agentMaxRounds || budgetRounds,
          status.maxRounds || budgetRounds,
        ),
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
                assistantContent += parsed.token;
                setMessages((prev) => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  if (last?.role === "assistant") {
                    copy[copy.length - 1] = buildAssistantMessage();
                  }
                  return copy;
                });
              }
              if (parsed.toolImage?.data) {
                assistantImages.push(parsed.toolImage.data);
              }
              if (parsed.error) {
                assistantContent += `\n\nError: ${parsed.error}`;
              }
            } catch {
              /* line parse */
            }
          }
        }
        const finalMsgs = [...nextMessages, buildAssistantMessage()];
        setMessages(finalMsgs);
        await saveHistory(finalMsgs);
        await noteStep(
          assistantContent.slice(0, 2000) ||
            "(assistant message empty or tool-only)",
          expId,
        );
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
            if (last?.role === "assistant") {
              copy[copy.length - 1] = {
                role: "assistant",
                content: `**Experiment step failed**\n\n${errText}`,
              };
            } else {
              copy.push({
                role: "assistant",
                content: `**Experiment step failed**\n\n${errText}`,
              });
            }
            return copy;
          });
          onToast?.(`❌ ${errText}`);
        }
      } finally {
        stepAbortRef.current = null;
        setStreaming(false);
      }
    },
    [
      experimentId,
      selectedModel,
      streaming,
      convId,
      budgetRounds,
      agentMaxRounds,
      status.maxRounds,
      saveHistory,
      noteStep,
      onToast,
    ],
  );

  async function handleStart() {
    if (!status.enabled) {
      onToast?.("Turn on Experiment mode in Settings → General.");
      return;
    }
    if (!hypothesis.trim()) {
      onToast?.("Write a short hypothesis first.");
      return;
    }
    if (!connected || !selectedModel) {
      onToast?.("Pick a model and ensure Ollama is connected.");
      return;
    }
    try {
      const res = await apiFetch("/api/experiment/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hypothesis: hypothesis.trim(),
          maxRounds: budgetRounds,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || res.statusText);
      }
      const { id, record } = await res.json();
      setExperimentId(id);
      setConvId(null);
      const seed = [
        {
          role: "user",
          content:
            `**Experiment hypothesis**\n\n${hypothesis.trim()}\n\n` +
            `Work in small steps. State a success metric per step. Use the Step summary block when you finish each turn.`,
        },
      ];
      setMessages(seed);
      setTimeline(record?.steps || []);
      const hid = await saveHistory(seed, {
        experimentId: id,
        title: hypothesis.trim().slice(0, 60),
      });
      await runStep(seed, hid || undefined, id);
    } catch (e) {
      onToast?.(`❌ ${e.message}`);
    }
  }

  async function handleSendFollowUp() {
    const t = input.trim();
    if (!t || streaming || !experimentId) return;
    const next = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    await saveHistory(next);
    await runStep(next);
  }

  const scopeFolder = chatFolder || projectFolder || "(not set)";

  if (!status.enabled) {
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-8 max-w-2xl mx-auto text-center">
        <div className="text-4xl mb-3">🧪</div>
        <h2 className="text-lg font-semibold text-slate-200 mb-2">
          Experiment mode is off
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          Enable <strong className="text-slate-300">Experiment mode</strong> in{" "}
          <strong className="text-slate-300">Settings → General</strong> to run
          bounded hypothesis → change → measure loops with a restricted tool set
          and saved run history.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <span className="text-xs text-slate-500 uppercase tracking-wide">
            Experiment
          </span>
          <span className="text-[11px] text-slate-500 font-mono truncate max-w-[60%]">
            Scope: {scopeFolder}
          </span>
        </div>
        <label className="block text-xs text-slate-400">Hypothesis</label>
        <textarea
          value={hypothesis}
          onChange={(e) => setHypothesis(e.target.value)}
          disabled={Boolean(experimentId)}
          rows={3}
          placeholder="e.g. If we cache X, the dashboard load time should drop below 2s."
          className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 text-sm outline-none resize-y min-h-[72px] disabled:opacity-60"
        />
        <div className="flex flex-wrap items-end gap-4">
          {streaming && (
            <button
              type="button"
              onClick={() => stepAbortRef.current?.abort()}
              className="rounded-lg px-3 py-2 text-sm bg-red-600/90 text-white hover:bg-red-500"
            >
              Stop
            </button>
          )}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Max tool rounds / step cap ({budgetRounds})
            </label>
            <input
              type="range"
              min={1}
              max={Math.min(status.maxRounds || 25, 25)}
              value={budgetRounds}
              onChange={(e) =>
                setBudgetRounds(parseInt(e.target.value, 10) || 1)
              }
              disabled={Boolean(experimentId)}
              className="w-40 accent-indigo-500"
            />
          </div>
          <div className="flex gap-2">
            {!experimentId ? (
              <button
                type="button"
                onClick={handleStart}
                disabled={!connected || !selectedModel || streaming}
                className="btn-neon text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                Start experiment
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setExperimentId(null);
                  setMessages([]);
                  setTimeline([]);
                  setConvId(null);
                  setHypothesis("");
                }}
                className="rounded-lg px-4 py-2 text-sm border border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                New experiment
              </button>
            )}
          </div>
        </div>
      </div>

      {timeline.length > 0 && (
        <div className="shrink-0 max-h-36 overflow-y-auto scrollbar-thin border-b border-slate-700/40 px-4 py-2 bg-slate-900/40">
          <div className="text-[10px] uppercase text-slate-500 mb-1">
            Run timeline
          </div>
          <ol className="space-y-1 text-xs text-slate-400">
            {timeline.map((s, i) => (
              <li key={i} className="border-l-2 border-indigo-500/40 pl-2">
                <span className="text-slate-500">
                  {new Date(s.at).toLocaleTimeString()}
                </span>{" "}
                {s.summary?.slice(0, 160)}
                {s.summary?.length > 160 ? "…" : ""}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
        role="log"
        aria-label="Experiment messages"
      >
        {messages.length === 0 && (
          <p className="text-sm text-slate-500 text-center mt-8">
            Describe what you want to test, set a round budget, then start.
          </p>
        )}
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

      <div className="shrink-0 glass-heavy border-t border-slate-700/30 p-4 space-y-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!experimentId || streaming}
          rows={2}
          placeholder={
            experimentId
              ? "Follow-up instruction for the next step…"
              : "Start an experiment to continue the thread…"
          }
          className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 text-sm outline-none resize-none disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendFollowUp();
            }
          }}
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSendFollowUp}
            disabled={!experimentId || streaming || !input.trim()}
            className="btn-neon text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Run step
          </button>
        </div>
      </div>
    </div>
  );
}
