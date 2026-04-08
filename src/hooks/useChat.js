import { useState, useRef, useEffect } from "react";
import { apiFetch } from "../lib/api-fetch";
import {
  MAX_CHAT_POST_BYTES,
  estimateChatPostBodyBytes,
} from "../lib/chat-payload";
import { abortAll } from "./useAbortRegistry";

export function useChat({
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
  modes,
  showVisionWarning,
  input,
}) {
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [history, setHistory] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [stats, setStats] = useState(null);
  const [sendBurst, setSendBurst] = useState(false);
  /** Pending confirm-before-run prompt: { id, command, args, cwd } or null */
  const [pendingConfirm, setPendingConfirm] = useState(null);
  /** AbortController for POST /api/chat — Stop button */
  const chatAbortRef = useRef(null);
  /** Batches streaming tokens to one React update per animation frame (reduces main-thread jank). */
  const chatTokenRafRef = useRef(null);
  /** Pending prompt to auto-send after mode change settles (CRE8 PRP flow). */
  const pendingAutoSend = useRef(null);

  async function fetchHistory() {
    try {
      const res = await apiFetch("/api/history");
      setHistory(await res.json());
    } catch {}
  }

  async function loadConversation(id) {
    try {
      const res = await apiFetch(`/api/history/${id}`);
      const conv = await res.json();
      setMessages(conv.messages || []);
      setMode(conv.mode || "explain");
      setActiveConvId(conv.id);
      if (conv.model) setSelectedModel(conv.model);
      setAttachedFiles([]);
      // Restore saved review data when loading a review conversation
      if (conv.mode === "review" && conv.reviewData) {
        setSavedReview({
          ...conv.reviewData,
          deepDiveMessages: conv.reviewData.deepDiveMessages || [],
        });
      } else {
        setSavedReview(null);
      }
      // Restore saved pentest data when loading a security conversation
      if (conv.mode === "pentest" && conv.pentestData) {
        setSavedPentest({
          ...conv.pentestData,
          deepDiveMessages: conv.pentestData.deepDiveMessages || [],
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
    const title =
      overrides.title || msgs[0]?.content?.slice(0, 60) || "Untitled";
    // Allow callers to pass an explicit convId to avoid reading stale React state
    // (activeConvId may not yet reflect an id returned by a concurrent save).
    const convId =
      overrides._convId !== undefined ? overrides._convId : activeConvId;
    const { _convId: _dropped, ...restOverrides } = overrides;
    const conv = {
      id: convId || undefined,
      title,
      mode: convMode || mode,
      model: selectedModel,
      messages: msgs,
      ...restOverrides,
    };
    if (convId) {
      const existing = history.find((h) => h.id === convId);
      if (existing) {
        conv.createdAt = existing.createdAt;
        if (existing.archived) conv.archived = existing.archived;
      }
    } else {
      conv.createdAt = new Date().toISOString();
    }
    try {
      const res = await apiFetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(conv),
      });
      const { id } = await res.json();
      setActiveConvId(id);
      fetchHistory();
      return id;
    } catch {
      return null;
    }
  }

  async function deleteConversation(id) {
    if (!id) return;
    try {
      const res = await apiFetch(`/api/history/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast(
          `❌ Could not delete: ${j.error || res.statusText || res.status}`,
        );
        return;
      }
      if (activeConvId === id) {
        setMessages([]);
        setActiveConvId(null);
      }
      fetchHistory();
      showToast("Conversation deleted");
    } catch (e) {
      showToast(`❌ Could not delete: ${e.message}`);
    }
  }
  async function renameConversation(id, newTitle) {
    try {
      const res = await apiFetch(`/api/history/${id}`);
      const conv = await res.json();
      conv.title = newTitle;
      await apiFetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(conv),
      });
      fetchHistory();
      showToast("Renamed");
    } catch {}
  }
  async function archiveConversation(id, archive) {
    try {
      const res = await apiFetch(`/api/history/${id}`);
      const conv = await res.json();
      conv.archived = archive;
      await apiFetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(conv),
      });
      if (activeConvId === id && archive) {
        setMessages([]);
        setActiveConvId(null);
      }
      fetchHistory();
      showToast(archive ? "Archived" : "Unarchived");
    } catch {}
  }
  async function exportConversation(id, format) {
    try {
      const res = await apiFetch(`/api/history/${id}`);
      const conv = await res.json();
      let content = "";
      const title = conv.title || "Untitled";
      const modeLabel =
        modes.find((m) => m.id === conv.mode)?.label || conv.mode;
      if (format === "md") {
        content = `# ${title}\n\n**Mode:** ${modeLabel}  \n**Model:** ${conv.model || "N/A"}  \n**Date:** ${new Date(conv.createdAt).toLocaleString()}  \n\n---\n\n`;
        (conv.messages || [])
          .filter((m) => !m._toolContext)
          .forEach((m) => {
            content +=
              m.role === "user"
                ? `## You\n\n\`\`\`\n${m.content}\n\`\`\`\n\n`
                : `## Assistant\n\n${m.content}\n\n---\n\n`;
          });
      } else {
        content = `${title}\nMode: ${modeLabel} | Model: ${conv.model || "N/A"} | Date: ${new Date(conv.createdAt).toLocaleString()}\n${"=".repeat(60)}\n\n`;
        (conv.messages || [])
          .filter((m) => !m._toolContext)
          .forEach((m) => {
            content += `[${m.role === "user" ? "YOU" : "ASSISTANT"}]\n${m.content}\n\n${"-".repeat(40)}\n\n`;
          });
      }
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported as .${format}`);
    } catch {}
  }

  async function bulkDeleteConversations(ids) {
    const validIds = ids.filter(Boolean);
    if (validIds.length === 0) return;
    try {
      const res = await apiFetch("/api/history/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: validIds }),
      });
      const data = await res.json().catch(() => ({}));
      const ok = data.ok || 0;
      const failed = data.failed || 0;
      if (validIds.includes(activeConvId)) {
        setMessages([]);
        setActiveConvId(null);
      }
      fetchHistory();
      if (failed === 0) {
        showToast(`Deleted ${ok} conversation${ok !== 1 ? "s" : ""}`);
      } else {
        showToast(`Deleted ${ok}, failed ${failed}`);
      }
    } catch (e) {
      showToast(`Delete failed: ${e.message}`);
    }
  }

  async function bulkExportConversations(ids, format) {
    for (const id of ids) {
      await exportConversation(id, format);
    }
  }

  async function bulkArchiveConversations(ids, archive) {
    for (const id of ids) {
      try {
        const res = await apiFetch(`/api/history/${id}`);
        const conv = await res.json();
        conv.archived = archive;
        await apiFetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(conv),
        });
        if (activeConvId === id && archive) {
          setMessages([]);
          setActiveConvId(null);
        }
      } catch {}
    }
    fetchHistory();
    showToast(
      `${archive ? "Archived" : "Unarchived"} ${ids.length} conversation${ids.length !== 1 ? "s" : ""}`,
    );
  }

  function handleRenameRequest(id) {
    const h = history.find((c) => c.id === id);
    if (h) setRenaming({ id, title: h.title || "Untitled" });
  }
  function startNew() {
    setMessages([]);
    setActiveConvId(null);
    setStats(null);
    setInput("");
    setAttachedFiles([]);
    setSavedReview(null);
    setSavedPentest(null);
    setSavedBuilderData(null);
    setActiveMemories(null);
  }

  // Build message with attached files (text only, images handled separately)
  function buildUserContent(text, files) {
    // Filter out images - they're sent separately
    const textFiles = files.filter((f) => f.type !== "image" && !f.isImage);
    if (textFiles.length === 0) return text;

    // Safety cap per-file to prevent browser/network issues with extremely large payloads.
    // Actual context window management is handled server-side via num_ctx auto-adjustment.
    const MAX_FILE_CHARS = 500000;
    const MAX_TOTAL_CHARS = 800000;
    let totalChars = 0;

    let content = text.trim() ? text + "\n\n" : "";
    content += "---\nATTACHED FILES:\n";
    textFiles.forEach((f) => {
      let fileContent = f.content || "";
      let truncated = false;
      if (fileContent.length > MAX_FILE_CHARS) {
        fileContent = fileContent.slice(0, MAX_FILE_CHARS);
        truncated = true;
      }
      if (totalChars + fileContent.length > MAX_TOTAL_CHARS) {
        fileContent = fileContent.slice(
          0,
          Math.max(0, MAX_TOTAL_CHARS - totalChars),
        );
        truncated = true;
      }
      totalChars += fileContent.length;
      content += `\n### ${f.name}${f.path ? " (" + f.path + ")" : ""}\n\`\`\`\n${fileContent}\n\`\`\`\n`;
      if (truncated) {
        content += `\n*(Content truncated to fit model context window — original: ${(f.content.length / 1024).toFixed(0)} KB)*\n`;
      }
      content += "\n";
    });
    return content;
  }

  async function handleSend(textOverride) {
    const sendText = typeof textOverride === "string" ? textOverride : input;
    if (
      (!sendText.trim() && attachedFiles.length === 0) ||
      streaming ||
      !selectedModel ||
      showVisionWarning
    )
      return;

    // Separate text files and image files
    const imageFiles = attachedFiles.filter(
      (f) => f.type === "image" || f.isImage,
    );
    const images = imageFiles.map((img) => img.content); // Array of base64 strings (NO prefix)

    const content = buildUserContent(sendText.trim(), attachedFiles);
    const userMsg = {
      role: "user",
      content,
      ...(images.length > 0 && { images }), // Add images field if present
    };
    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
    setInput("");
    setAttachedFiles([]);
    setStreaming(true);
    setStats(null);
    setTerminalOutput(null);
    setAutoResolvedLabel(null);
    setSendBurst(true);
    setTimeout(() => setSendBurst(false), 100);

    let conversationIdForChat = activeConvId;
    try {
      const savedId = await saveConversation(newMessages, mode);
      if (savedId) conversationIdForChat = savedId;
    } catch {
      /* keep activeConvId */
    }

    const postBody = {
      model: selectedModel,
      mode,
      messages: newMessages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.images && { images: m.images }),
        ...(m._toolContext && { _toolContext: true }),
      })),
      ...(images.length > 0 && { images }),
      ...(conversationIdForChat && { conversationId: conversationIdForChat }),
      agentMaxRounds,
    };
    const payloadBytes = estimateChatPostBodyBytes(postBody);
    if (payloadBytes > MAX_CHAT_POST_BYTES) {
      showToast(
        `❌ Request too large (${(payloadBytes / 1024 / 1024).toFixed(1)} MB). Use smaller images, fewer images, or shorter text — stay under ~${Math.floor(MAX_CHAT_POST_BYTES / 1024 / 1024)} MB.`,
      );
      setMessages(messages);
      setStreaming(false);
      return;
    }

    chatAbortRef.current?.abort();
    const ac = new AbortController();
    chatAbortRef.current = ac;

    let assistantContent = "";
    let capturedToolContext = []; // tool round messages from toolContextMessages SSE event
    const flushChatAssistantUi = () => {
      if (chatTokenRafRef.current) {
        cancelAnimationFrame(chatTokenRafRef.current);
        chatTokenRafRef.current = null;
      }
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: assistantContent,
          };
          return updated;
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };
    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify(postBody),
      });
      if (!res.ok) {
        let detail = `${res.status} ${res.statusText || ""}`.trim();
        try {
          const text = await res.text();
          if (text) {
            try {
              const j = JSON.parse(text);
              detail = j.error || j.message || text.slice(0, 400);
            } catch {
              detail = text.slice(0, 400);
            }
          }
        } catch {
          /* keep detail */
        }
        throw new Error(detail || "Request failed");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lastSaveTime = Date.now();
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
            if (parsed.toolContextMessages) {
              capturedToolContext = parsed.toolContextMessages;
            }
            if (parsed.memoryContext) {
              setActiveMemories(parsed.memoryContext);
            }
            if (parsed.resolvedModel)
              setAutoResolvedLabel(parsed.resolvedModel);
            if (parsed.token) {
              assistantContent += parsed.token;
              if (!chatTokenRafRef.current) {
                chatTokenRafRef.current = requestAnimationFrame(() => {
                  chatTokenRafRef.current = null;
                  setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    if (last?.role === "assistant") {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        role: "assistant",
                        content: assistantContent,
                      };
                      return updated;
                    }
                    return [
                      ...prev,
                      { role: "assistant", content: assistantContent },
                    ];
                  });
                });
              }
            }
            if (parsed.done) {
              flushChatAssistantUi();
              const dur = Number(parsed.total_duration);
              setStats({
                tokens: parsed.eval_count,
                duration: Number.isFinite(dur) ? (dur / 1e9).toFixed(1) : null,
              });
              setTerminalOutput(null);
            }
            if (parsed.error) {
              assistantContent += `\n\nError: ${parsed.error}`;
              flushChatAssistantUi();
            }
            if (parsed.toolCallRound !== undefined) {
              // Show tool execution progress in terminal output indicator
              const calls = parsed.toolCalls || [];
              const terminalCalls = calls.filter(
                (c) => c.serverId === "builtin",
              );
              if (terminalCalls.length > 0) {
                setTerminalOutput({
                  command: terminalCalls
                    .map((c) => `${c.toolName}(${JSON.stringify(c.args)})`)
                    .join("; "),
                  status: "running",
                  output: "",
                });
              }
            }
            // Streaming terminal SSE events from run_terminal_cmd
            if (parsed.terminalCmd) {
              const { command, args } = parsed.terminalCmd;
              const cmdStr = [command, ...(args || [])].join(" ");
              setTerminalOutput({ command: cmdStr, status: "running", output: "" });
            }
            if (parsed.terminalOutput) {
              setTerminalOutput((prev) =>
                prev
                  ? { ...prev, output: (prev.output || "") + parsed.terminalOutput }
                  : { command: "", status: "running", output: parsed.terminalOutput },
              );
            }
            if (parsed.terminalStatus) {
              const { exitCode, killed } = parsed.terminalStatus;
              const status = killed ? "timeout" : exitCode === 0 ? "done" : "error";
              setTerminalOutput((prev) => (prev ? { ...prev, status } : null));
            }
            // Confirm-before-run: show modal for user approval
            if (parsed.confirmRequired) {
              setPendingConfirm(parsed.confirmRequired);
            }
            // Render MCP tool result images inline in the assistant message
            if (parsed.toolImage) {
              const { mimeType, data, tool } = parsed.toolImage;
              if (data) {
                assistantContent += `\n\n![${tool || "Tool Result"}](data:${mimeType};base64,${data})\n`;
                flushChatAssistantUi();
              }
            }
          } catch {}
        }
        // Auto-save every 5 seconds during streaming
        if (assistantContent && Date.now() - lastSaveTime > 5000) {
          lastSaveTime = Date.now();
          const autoSaveMsgs =
            capturedToolContext.length > 0
              ? [
                  ...newMessages,
                  ...capturedToolContext.map((m) => ({
                    ...m,
                    _toolContext: true,
                  })),
                  { role: "assistant", content: assistantContent },
                ]
              : [
                  ...newMessages,
                  { role: "assistant", content: assistantContent },
                ];
          saveConversation(autoSaveMsgs, mode, {
            _convId: conversationIdForChat,
          });
        }
      }
      flushChatAssistantUi();
      const finalMsgs =
        capturedToolContext.length > 0
          ? [
              ...newMessages,
              ...capturedToolContext.map((m) => ({ ...m, _toolContext: true })),
              { role: "assistant", content: assistantContent },
            ]
          : [...newMessages, { role: "assistant", content: assistantContent }];
      saveConversation(finalMsgs, mode, { _convId: conversationIdForChat });
    } catch (err) {
      if (err.name === "AbortError") {
        if (chatTokenRafRef.current) {
          cancelAnimationFrame(chatTokenRafRef.current);
          chatTokenRafRef.current = null;
        }
        setTerminalOutput(null);
        if (assistantContent.trim()) {
          const stoppedMessages = [
            ...newMessages,
            { role: "assistant", content: assistantContent.trimEnd() },
          ];
          setMessages(stoppedMessages);
          saveConversation(stoppedMessages, mode, {
            _convId: conversationIdForChat,
          });
        }
        return;
      }
      // "Failed to fetch" / TypeError = browser never got a response from *this* app (wrong URL, server down, SSL blocked).
      // That is different from Ollama being offline (server usually returns JSON with an error body).
      const hasImages = images && images.length > 0;
      const detailLower = String(err.message || "").toLowerCase();
      const msg = String(err.message || "");
      const isAppUnreachable =
        msg === "Failed to fetch" ||
        msg === "Load failed" ||
        (err.name === "TypeError" && /fetch|network|load failed/i.test(msg));

      let errorMsg = `Oops, I couldn't reach Ollama just now. No worries — let's check that it's running and try again!`;

      if (isAppUnreachable) {
        errorMsg =
          `The browser could not connect to the Code Companion server (the request never reached the app). ` +
          `Start or restart the server, use the same URL you used to open this page (try http://127.0.0.1 with your port), ` +
          `and if you see a certificate warning for HTTPS, accept it once so requests are allowed.`;
      } else if (hasImages) {
        if (
          detailLower.includes("413") ||
          detailLower.includes("too large") ||
          detailLower.includes("payload")
        ) {
          errorMsg = `The request was too large (often base64 images in JSON). Try a smaller image, fewer images, or compress the file.`;
        } else {
          errorMsg = `Vision inference failed. ${selectedModel} may not support images, or Ollama may not be running.`;
        }
      }

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `${errorMsg}\n\nTechnical detail: ${err.message}`,
        },
      ]);
    } finally {
      chatAbortRef.current = null;
      setTerminalOutput(null);
      setPendingConfirm(null);
      setStreaming(false);
    }
  }

  function handleStopChat() {
    chatAbortRef.current?.abort();
    setTerminalOutput(null);
    setPendingConfirm(null);
  }

  // ── Global Escape key → abort all active requests ──
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        handleStopChat();
        abortAll();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-send pending prompt after mode change settles (CRE8 PRP flow)
  useEffect(() => {
    if (
      !pendingAutoSend.current ||
      mode !== "chat" ||
      !selectedModel ||
      streaming
    )
      return;
    const prompt = pendingAutoSend.current;
    pendingAutoSend.current = null;
    handleSend(prompt);
  }, [mode, selectedModel, streaming]);

  function handleSaveChat() {
    if (!messages.length) {
      showToast("No conversation to save");
      return;
    }
    // Build brief filename from first user message
    const firstUser = messages.find((m) => m.role === "user");
    const snippet = firstUser
      ? firstUser.content
          .replace(/[^a-zA-Z0-9 ]/g, "")
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .join("-")
          .toLowerCase() || "chat"
      : "chat";
    const date = new Date().toISOString().slice(0, 10);
    const modeLabel = modes.find((m) => m.id === mode)?.label || mode;

    // Format entire conversation as markdown
    const lines = [`# ${modeLabel} — ${date}\n`];
    for (const msg of messages) {
      if (msg._toolContext) continue;
      if (msg.role === "user") {
        lines.push(`## You\n\n${msg.content}\n`);
      } else if (msg.role === "assistant") {
        lines.push(`## Assistant\n\n${msg.content}\n`);
      }
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${snippet}-${date}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Chat saved");
  }
  return {
    messages,
    setMessages,
    streaming,
    activeConvId,
    setActiveConvId,
    history,
    setHistory,
    sendBurst,
    renaming,
    setRenaming,
    showArchived,
    setShowArchived,
    stats,
    setStats,
    fetchHistory,
    loadConversation,
    saveConversation,
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
    handleSaveChat,
    pendingAutoSend,
    pendingConfirm,
    setPendingConfirm,
  };
}
