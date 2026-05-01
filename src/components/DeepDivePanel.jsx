import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import MessageBubble from "./MessageBubble";
import { apiFetch } from "../lib/api-fetch";
import { sanitizeUnconfirmedImageClaims } from "../lib/chat-image-claims";

/**
 * Self-contained deep-dive sub-thread.
 *
 * The parent component supplies a system-prompt string and an initial user
 * question; this panel runs an SSE-streamed back-and-forth against /api/chat
 * and persists nothing on its own — pass `onMessagesChange` to capture state
 * for parent persistence.
 */
export default function DeepDivePanel({
  title = "Deep Dive Conversation",
  systemPrompt,
  initialUserMessage,
  initialMessages,
  selectedModel,
  connected,
  onBack,
  onMessagesChange,
}) {
  const [messages, setMessages] = useState(() => {
    if (Array.isArray(initialMessages) && initialMessages.length > 0) {
      return initialMessages;
    }
    if (systemPrompt && initialUserMessage) {
      return [
        { role: "system", content: systemPrompt },
        { role: "user", content: initialUserMessage },
      ];
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const seededRef = useRef(false);

  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const sendMessage = useCallback(
    async (msgs) => {
      if (!selectedModel) return;
      setStreaming(true);
      try {
        const res = await apiFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel,
            mode: "chat",
            messages: msgs.map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || res.statusText);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistant = "";
        let images = [];
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
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
              if (parsed.token) assistant += parsed.token;
              if (parsed.toolImage?.data) images.push(parsed.toolImage.data);
              if (parsed.error) assistant += `\n\nError: ${parsed.error}`;
              setMessages((prev) => {
                const copy = [...prev];
                if (copy[copy.length - 1]?.role === "assistant") {
                  copy[copy.length - 1] = {
                    role: "assistant",
                    content: sanitizeUnconfirmedImageClaims(
                      assistant,
                      images.length > 0,
                    ),
                    ...(images.length > 0 ? { images } : {}),
                  };
                }
                return copy;
              });
            } catch {
              /* skip */
            }
          }
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `**Deep dive failed**\n\n${err.message || String(err)}`,
          },
        ]);
      } finally {
        setStreaming(false);
      }
    },
    [selectedModel],
  );

  // Auto-send the initial pair on mount.
  useEffect(() => {
    if (seededRef.current) return;
    if (
      Array.isArray(initialMessages) &&
      initialMessages.length > 0 &&
      initialMessages.some((m) => m.role === "assistant")
    ) {
      // Already has assistant content — don't re-send
      seededRef.current = true;
      return;
    }
    if (messages.length === 2 && messages[1]?.role === "user") {
      seededRef.current = true;
      sendMessage(messages);
    }
  }, [messages, initialMessages, sendMessage]);

  function handleAsk() {
    const t = input.trim();
    if (!t || streaming) return;
    const next = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    sendMessage(next);
  }

  const visible = messages.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );

  return (
    <section
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
      aria-label="Deep dive conversation"
    >
      <div className="glass border-b border-slate-700/30 px-4 py-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-700/40 inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" /> Back to report
        </button>
        <span className="text-xs text-slate-500">{title}</span>
      </div>

      <div
        className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
        role="log"
        aria-label="Deep dive messages"
        aria-live="polite"
      >
        {visible.map((msg, i) => (
          <MessageBubble
            key={i}
            role={msg.role}
            content={msg.content}
            images={msg.images}
            streaming={
              streaming && i === visible.length - 1 && msg.role === "assistant"
            }
          />
        ))}
        {streaming &&
          visible.length > 0 &&
          visible[visible.length - 1]?.role !== "assistant" && (
            <div
              className="flex items-center gap-2 text-slate-400 text-sm py-2 px-4"
              role="status"
            >
              <span className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
              <span
                className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
              <span>Thinking...</span>
            </div>
          )}
        <div ref={endRef} />
      </div>

      <div className="glass-heavy border-t border-slate-700/30 p-4 space-y-2">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            placeholder="Ask a follow-up question…"
            rows={2}
            disabled={streaming || !connected}
            className="flex-1 input-glow text-slate-100 font-mono text-sm rounded-xl px-4 py-3 resize-none placeholder-slate-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleAsk}
            disabled={!input.trim() || streaming || !connected}
            className="btn-neon text-white rounded-xl px-4 font-medium disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-600 disabled:shadow-none disabled:cursor-not-allowed min-w-[60px]"
          >
            {streaming ? "..." : "Ask"}
          </button>
        </div>
      </div>
    </section>
  );
}
