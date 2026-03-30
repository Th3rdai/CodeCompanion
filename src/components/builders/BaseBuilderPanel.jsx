import React, { useState, useCallback, useEffect, useRef } from "react";
import { apiFetch } from "../../lib/api-fetch";
import { useAbortable } from "../../hooks/useAbortable";
import { registerAbort, unregisterAbort } from "../../hooks/useAbortRegistry";
import StopButton from "../ui/StopButton";
import LoadingAnimation from "../LoadingAnimation";
import MarkdownContent from "../MarkdownContent";
import BuilderScoreCard from "./BuilderScoreCard";
import DictateButton from "../DictateButton";
import InputToolbar from "../ui/InputToolbar";
import { joinAppend } from "../../lib/dictationAppend";

// ── Tag Input Component ──────────────────────────────
// v1: one trimmed tag per recognition result (no comma-splitting).

function TagInput({
  value = [],
  onChange,
  placeholder,
  dictateDisabled = false,
}) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = inputValue.trim();
      if (tag && !value.includes(tag)) {
        onChange([...value, tag]);
      }
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (idx) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const appendTagFromSpeech = (text) => {
    const tag = String(text ?? "").trim();
    if (!tag || value.includes(tag)) return;
    onChange([...value, tag]);
  };

  return (
    <div className="flex gap-2 items-start">
      <div className="flex flex-wrap gap-1.5 input-glow rounded-xl px-3 py-2 min-h-[42px] items-center flex-1 min-w-0">
        {value.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full px-2.5 py-0.5"
          >
            {tag}
            <button
              onClick={() => removeTag(i)}
              className="text-indigo-400 hover:text-indigo-200 ml-0.5 cursor-pointer"
              aria-label={`Remove ${tag}`}
            >
              &times;
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : "Add more..."}
          className="flex-1 min-w-[120px] bg-transparent text-slate-100 text-sm placeholder-slate-500 outline-none"
        />
      </div>
      <DictateButton
        onResult={appendTagFromSpeech}
        disabled={dictateDisabled}
      />
    </div>
  );
}

// ── BaseBuilderPanel ─────────────────────────────────
// Config-driven panel that manages the builder lifecycle.
// Each mode (Prompting, Skillz, Agentic) passes a config object.

export default function BaseBuilderPanel({
  selectedModel,
  connected,
  models,
  onToast,
  savedData,
  onSaveBuilder,
  config,
  onLoadFile,
  projectFolder,
}) {
  // ── State ────────────────────────────────────────────
  const [phase, setPhase] = useState("input"); // 'input' | 'loading' | 'scored' | 'revising'
  const [formData, setFormData] = useState({});
  const [scoreData, setScoreData] = useState(null);
  const [scoreError, setScoreError] = useState("");
  const [reviseInput, setReviseInput] = useState("");
  const [reviseMessages, setReviseMessages] = useState([]);
  const [reviseStreaming, setReviseStreaming] = useState(false);
  const [sourceFile, setSourceFile] = useState(null); // { name, path, folder } — tracks loaded file for save-back

  const reviseEndRef = useRef(null);
  const inlineChatRef = useRef(null);
  const fileInputRef = useRef(null);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const isLoading = phase === "loading";

  // ── Abort support ──────────────────────────────────
  const scoreAbort = useAbortable();
  const reviseAbort = useAbortable();
  const handleStop = useCallback(() => {
    scoreAbort.abort();
    reviseAbort.abort();
    setReviseStreaming(false);
    if (phase === "loading") setPhase("input");
  }, [scoreAbort, reviseAbort, phase]);
  useEffect(() => {
    registerAbort(handleStop);
    return () => unregisterAbort(handleStop);
  }, [handleStop]);

  // ── Initialize form data from config fields ──────────
  useEffect(() => {
    if (!config?.fields) return;
    const initial = {};
    for (const field of config.fields) {
      if (field.type === "tags") {
        initial[field.name] = [];
      } else {
        initial[field.name] = "";
      }
    }
    setFormData(initial);
  }, [config?.modeId]);

  // ── Restore saved data from history ──────────────────
  useEffect(() => {
    if (savedData) {
      if (savedData.formData) {
        setFormData(savedData.formData);
      }
      if (savedData.scoreData) {
        setScoreData(savedData.scoreData);
        setPhase("scored");
      }
    }
  }, [savedData]);

  // ── Load file into form ────────────────────────────────
  const loadFileIntoForm = useCallback(
    (fileData) => {
      if (!fileData?.content || !config?.parseLoaded) return;
      const parsed = config.parseLoaded(fileData.content);
      if (parsed) {
        setFormData(parsed);
        formDataRef.current = parsed;
        setScoreData(null);
        setScoreError("");
        setReviseMessages([]);
        setPhase("input");
        // Track source file for save-back (path from File Browser, or just name from native picker)
        setSourceFile(
          fileData.path
            ? {
                name: fileData.name,
                path: fileData.path,
                folder: projectFolder,
              }
            : null,
        );
        onToast?.(`Loaded: ${fileData.name}`);
      }
    },
    [config, onToast, projectFolder],
  );

  // ── Expose loadFileIntoForm via ref for App.jsx routing ──
  useEffect(() => {
    if (onLoadFile) {
      onLoadFile.current = loadFileIntoForm;
    }
    return () => {
      if (onLoadFile) onLoadFile.current = null;
    };
  }, [onLoadFile, loadFileIntoForm]);

  // ── Native file input handler ──────────────────────────
  const handleFileInput = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        loadFileIntoForm({
          name: file.name,
          content: ev.target.result,
          lines: ev.target.result.split("\n").length,
        });
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [loadFileIntoForm],
  );

  // ── Field update helper ──────────────────────────────
  const updateField = useCallback((name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  /** Append speech chunk to a string field without stale closures */
  const appendToField = useCallback((name, chunk) => {
    setFormData((prev) => ({ ...prev, [name]: joinAppend(prev[name], chunk) }));
  }, []);

  // ── Check if required fields are filled ──────────────
  const requiredFieldsFilled = useCallback(() => {
    if (!config?.fields) return false;
    return config.fields
      .filter((f) => f.required)
      .every((f) => {
        const val = formData[f.name];
        if (Array.isArray(val)) return val.length > 0;
        return val && String(val).trim().length > 0;
      });
  }, [config?.fields, formData]);

  // ── Submit for scoring ───────────────────────────────
  const handleScore = useCallback(async () => {
    if (!selectedModel || !connected || isLoading) return;

    setPhase("loading");
    setScoreError("");
    setScoreData(null);

    try {
      const currentFormData = formDataRef.current;
      const content = config.buildContent(currentFormData);
      const signal = scoreAbort.startAbortable();
      const res = await apiFetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          model: selectedModel,
          mode: config.modeId,
          content,
          metadata: currentFormData,
        }),
      });

      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        setScoreError(errData.message || "Access denied");
        setPhase("input");
        return;
      }

      const contentType = res.headers.get("Content-Type") || "";

      if (contentType.includes("application/json")) {
        const result = await res.json();
        if (result.error) {
          setScoreError(result.error);
          setPhase("input");
          return;
        }
        setScoreData(result.data || result);
        setPhase("scored");
        return;
      }

      // SSE fallback — accumulate tokens then try to parse
      if (contentType.includes("text/event-stream")) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

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
              if (parsed.token) accumulated += parsed.token;
              if (parsed.error) accumulated += `\nError: ${parsed.error}`;
            } catch {}
          }
        }

        // Try to parse accumulated as JSON score data
        try {
          const parsed = JSON.parse(accumulated);
          setScoreData(parsed);
          setPhase("scored");
          onSaveBuilder?.({
            formData,
            scoreData: parsed,
            model: selectedModel,
            modeId: config.modeId,
          });
        } catch {
          setScoreError(
            "Could not parse score response. The model may need to be larger.",
          );
          setPhase("input");
        }
        return;
      }

      const text = await res.text();
      setScoreError(`Unexpected response: ${text.slice(0, 200)}`);
      setPhase("input");
    } catch (err) {
      if (scoreAbort.isAborted(err)) {
        setPhase("input");
        return;
      }
      setScoreError(`Connection failed: ${err.message}`);
      setPhase("input");
    } finally {
      scoreAbort.clearAbortable();
    }
  }, [
    selectedModel,
    connected,
    isLoading,
    formData,
    config,
    onSaveBuilder,
    scoreAbort,
  ]);

  // ── Download handler ─────────────────────────────────
  const handleDownload = useCallback(() => {
    const content = config.buildContent(formData);
    const filename =
      (formData[config.nameField] || config.defaultFilename) +
      config.fileExtension;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onToast?.(`Downloaded ${filename}`);
  }, [formData, config, onToast]);

  // ── Save handler ─────────────────────────────────────
  const handleSave = useCallback(() => {
    onSaveBuilder?.({
      formData,
      scoreData,
      model: selectedModel,
      modeId: config.modeId,
    });
    onToast?.("Saved successfully");
  }, [formData, scoreData, selectedModel, config, onSaveBuilder, onToast]);

  // ── Save to original file (with .bak backup) ───────
  const handleSaveToFile = useCallback(async () => {
    if (!sourceFile?.path || !sourceFile?.folder) return;
    try {
      const content = config.buildContent(formDataRef.current);
      const res = await apiFetch("/api/files/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: sourceFile.path,
          folder: sourceFile.folder,
          content,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast?.(`Save failed: ${data.error}`);
        return;
      }
      onToast?.(
        data.backedUp
          ? `Saved to ${sourceFile.name} (backup: ${sourceFile.name}.bak)`
          : `Saved to ${sourceFile.name}`,
      );
    } catch (err) {
      onToast?.(`Save failed: ${err.message}`);
    }
  }, [sourceFile, config, onToast]);

  // ── New / reset ──────────────────────────────────────
  const handleNew = useCallback(() => {
    const initial = {};
    for (const field of config.fields) {
      initial[field.name] = field.type === "tags" ? [] : "";
    }
    setFormData(initial);
    setScoreData(null);
    setScoreError("");
    setReviseMessages([]);
    setReviseInput("");
    setSourceFile(null);
    setPhase("input");
  }, [config]);

  // ── Revise with AI (SSE streaming) ───────────────────
  const handleRevise = useCallback(async () => {
    if (!reviseInput.trim() || reviseStreaming || !selectedModel) return;

    const userMsg = { role: "user", content: reviseInput.trim() };
    const updatedMessages = [...reviseMessages, userMsg];
    setReviseMessages(updatedMessages);
    setReviseInput("");
    setReviseStreaming(true);

    try {
      const content = config.buildContent(formData);
      const categoryFeedback = scoreData?.categories
        ? Object.entries(scoreData.categories)
            .map(
              ([k, v]) =>
                `- ${k}: ${v.grade} — ${v.summary}${v.suggestions?.length ? "\n  Suggestions: " + v.suggestions.join("; ") : ""}`,
            )
            .join("\n")
        : "";
      const systemContext = `You are an expert prompt engineer helping improve a ${config.title}. Here is the current content:

<current_content>
${content}
</current_content>

Current score: ${scoreData?.overallGrade || "N/A"} — ${scoreData?.summary || "N/A"}
${categoryFeedback ? "\nCategory breakdown:\n" + categoryFeedback : ""}

YOUR JOB: Rewrite and improve the content based on the user's request and the score feedback.${
        config.modeId === "skillz"
          ? `
Apply the Agent Skills Specification best practices:
- Ensure the description explains both WHAT the skill does and WHEN to use it — slightly "pushy" descriptions trigger more reliably
- Structure instructions with clear workflow phases (Phase 1, Phase 2, etc.)
- Explain WHY behind constraints, not just rules ("Always validate input because malformed data silently corrupts output")
- Add decision trees or branching logic for different scenarios
- Include verification steps so the AI can self-check its work
- Add examples showing input → output for at least one scenario
- Keep the body under 500 lines — move heavy reference material to separate files
- Use theory of mind: anticipate what the AI might get wrong and address it`
          : config.modeId === "agentic"
            ? `
Apply CrewAI + LangGraph agent design patterns:
- Define a specific ROLE with backstory and expertise context (CrewAI pattern) — not just "helper" but "Security analyst specializing in OWASP Top 10"
- Set a clear PRIMARY GOAL and explicit scope boundaries (what's IN and OUT)
- Define tools with NAME, PURPOSE, and INPUT/OUTPUT schemas — flag dangerous tools with safety annotations
- Structure workflow as a STATE MACHINE (LangGraph pattern): Planning → Execution → Validation → Output
- Add SELF-CORRECTION LOOPS — if validation fails, loop back to execution with error context
- Add CONDITIONAL BRANCHES for different scenarios and edge cases
- Define TERMINATION CONDITIONS — goal achieved, max iterations, or error threshold
- Add comprehensive SAFETY GUARDRAILS with WHY explanations for each rule
- Include CONFIRMATION GATES for destructive actions (file deletion, database writes, force pushes)
- Add HUMAN-IN-THE-LOOP escalation paths for ambiguous or high-risk situations
- Follow the reconnaissance-then-action pattern: always read before modifying`
            : `
Apply the TÂCHES methodology:
- Add clear context (what, who, why)
- Add XML structure tags (<objective>, <context>, <requirements>, <output>, <verification>)
- Explain WHY behind constraints, not just what they are
- Add success criteria and verification steps
- Add examples where helpful
- Be specific and explicit — eliminate ambiguity`
      }

CRITICAL: Always include the COMPLETE improved content inside <revised_prompt> tags. Do not just describe changes — show the full rewritten content. The user will click "Apply" to use your revision.

You have the COMPLETE original content above — do NOT ask the user to share it again.
You have full terminal and file access via the run_terminal_cmd and write_file tools. Do NOT say you cannot access files or the terminal.
Do NOT apologize or say you lack access. Just provide the improved content directly.

Format your response as:
1. Brief explanation of what you changed and why
2. The complete revised content in <revised_prompt>...</revised_prompt> tags`;

      const chatMessages = [
        { role: "system", content: systemContext },
        ...updatedMessages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content })),
      ];

      const signal = reviseAbort.startAbortable();
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          model: selectedModel,
          mode: config.modeId,
          messages: chatMessages,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

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
              setReviseMessages((prev) => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.role === "assistant") {
                  updated[lastIdx] = {
                    role: "assistant",
                    content: assistantContent,
                  };
                } else {
                  updated.push({
                    role: "assistant",
                    content: assistantContent,
                  });
                }
                return updated;
              });
            }
          } catch {}
        }
      }

      // Ensure final message is set
      setReviseMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.role === "assistant") {
          updated[lastIdx] = { role: "assistant", content: assistantContent };
        } else {
          updated.push({ role: "assistant", content: assistantContent });
        }
        return updated;
      });
    } catch (err) {
      if (!reviseAbort.isAborted(err)) {
        setReviseMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Connection failed: ${err.message}` },
        ]);
      }
    } finally {
      reviseAbort.clearAbortable();
      setReviseStreaming(false);
      setTimeout(
        () => reviseEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    }
  }, [
    reviseInput,
    reviseStreaming,
    reviseMessages,
    selectedModel,
    formData,
    scoreData,
    config,
    reviseAbort,
  ]);

  // ── Apply revision from AI response ─────────────────
  const applyRevision = useCallback(() => {
    const lastAssistant = [...reviseMessages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAssistant) return false;

    const match = lastAssistant.content.match(
      /<revised_prompt>([\s\S]*?)<\/revised_prompt>/,
    );
    if (!match) return false;

    const revisedContent = match[1].trim();

    // Determine the updated form data
    let updated;
    const primaryField = config.fields?.find(
      (f) => f.required && (f.type === "textarea" || f.large),
    );
    if (primaryField) {
      // Always update the primary content field with the full revised text
      updated = { ...formDataRef.current, [primaryField.name]: revisedContent };
    } else {
      updated = { ...formDataRef.current };
    }

    // Update both ref (synchronous, for immediate handleScore) and state (for re-render)
    formDataRef.current = updated;
    setFormData(updated);
    onToast?.("Revision applied to your prompt");
    return true;
  }, [reviseMessages, config, onToast]);

  // ── Check if last AI message has a revision to apply ─
  const hasRevision =
    reviseMessages.length > 0 &&
    (() => {
      const lastAssistant = [...reviseMessages]
        .reverse()
        .find((m) => m.role === "assistant");
      return lastAssistant?.content?.includes("<revised_prompt>");
    })();

  // ── Handle category-specific revise ──────────────────
  const handleCategoryRevise = useCallback((categoryKey, categoryLabel) => {
    setReviseInput(
      `Help me improve the ${categoryLabel} score. What specific changes should I make?`,
    );
    setPhase("revising");
  }, []);

  // ── Render: Loading Phase ────────────────────────────
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center gap-4">
        <LoadingAnimation />
        <StopButton onClick={handleStop} label="Stop Scoring" />
      </div>
    );
  }

  // ── Render: Scored Phase ─────────────────────────────
  if (phase === "scored" && scoreData) {
    return (
      <section
        className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
        aria-label={`${config.title} score report`}
      >
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Source file info */}
          {sourceFile && (
            <div className="glass rounded-lg border border-slate-700/30 px-3 py-2 flex items-center gap-2 text-xs">
              <span className="text-slate-500">Source:</span>
              <span className="text-indigo-300 font-medium truncate">
                {sourceFile.name}
              </span>
              <span
                className="text-slate-600 truncate flex-1"
                title={sourceFile.folder + "/" + sourceFile.path}
              >
                {sourceFile.folder}/{sourceFile.path}
              </span>
            </div>
          )}

          <BuilderScoreCard
            data={scoreData}
            categories={config.categories}
            onRevise={handleCategoryRevise}
          />

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 justify-center">
            {/* Ask AI to Improve — builds all suggestions into a prompt */}
            {scoreData?.categories &&
              (() => {
                const allSuggestions = Object.entries(
                  scoreData.categories,
                ).flatMap(([k, v]) =>
                  (v.suggestions || []).map((s) => `[${k}] ${s}`),
                );
                return allSuggestions.length > 0 ? (
                  <button
                    onClick={() => {
                      const prompt =
                        `Improve this ${config.title.toLowerCase()} based on these suggestions:\n` +
                        allSuggestions
                          .map((s, i) => `${i + 1}. ${s}`)
                          .join("\n");
                      setReviseInput(prompt);
                      setReviseMessages([]);
                      setPhase("revising");
                      onToast?.(
                        "Suggestions loaded — click Send to get improvements",
                      );
                    }}
                    className="text-xs px-4 py-2 rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                  >
                    Ask AI to Improve
                  </button>
                ) : null;
              })()}
            <button
              onClick={handleSave}
              className="text-xs px-4 py-2 rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleDownload}
              className="text-xs px-4 py-2 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition-colors"
            >
              Download
            </button>
            {sourceFile && (
              <button
                onClick={handleSaveToFile}
                className="text-xs px-4 py-2 rounded-lg border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 transition-colors"
              >
                Save to File
              </button>
            )}
            <button
              onClick={() => {
                setReviseMessages([]);
                setReviseInput("");
                setPhase("revising");
              }}
              className="text-xs px-4 py-2 rounded-lg border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 transition-colors"
            >
              Revise with AI
            </button>
            <button
              onClick={handleScore}
              className="text-xs px-4 py-2 rounded-lg border border-blue-500/30 text-blue-300 hover:bg-blue-500/10 transition-colors"
            >
              Re-Score
            </button>
            <button
              onClick={handleNew}
              className="text-xs px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/40 transition-colors"
            >
              New
            </button>
          </div>

          {/* Inline chat — discuss the score */}
          <div className="space-y-3">
            <InputToolbar
              textareaRef={inlineChatRef}
              getText={() => reviseInput}
              setText={(val) => setReviseInput((prev) => prev + val)}
              messages={
                reviseMessages.length
                  ? reviseMessages
                  : [
                      {
                        role: "assistant",
                        content:
                          scoreData?.summary || JSON.stringify(scoreData),
                      },
                    ]
              }
              mode={config.title}
              onToast={onToast}
              onClear={() => setReviseInput("")}
              connected={connected}
              streaming={reviseStreaming}
              hideButtons={["upload", "paste"]}
            />

            {/* Show conversation messages inline */}
            {reviseMessages.filter(
              (m) => m.role === "user" || m.role === "assistant",
            ).length > 0 && (
              <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
                {reviseMessages
                  .filter((m) => m.role === "user" || m.role === "assistant")
                  .map((msg, i) => (
                    <div
                      key={i}
                      className={`rounded-xl p-3 text-sm ${
                        msg.role === "user"
                          ? "glass border border-indigo-500/20 ml-8 text-slate-200"
                          : "glass border border-slate-700/30 mr-8"
                      }`}
                    >
                      <div className="text-[10px] text-slate-500 mb-1 uppercase font-semibold">
                        {msg.role === "user" ? "You" : "AI"}
                      </div>
                      {msg.role === "assistant" ? (
                        <MarkdownContent content={msg.content} />
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>
                  ))}
                {reviseStreaming && (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                    <div className="flex gap-1">
                      <span
                        className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      ></span>
                      <span
                        className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      ></span>
                      <span
                        className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      ></span>
                    </div>
                    <span>Thinking...</span>
                  </div>
                )}
                <div ref={reviseEndRef} />
              </div>
            )}

            {/* Chat input */}
            <div className="flex gap-2">
              <textarea
                ref={inlineChatRef}
                value={reviseInput}
                onChange={(e) => setReviseInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (reviseInput.trim()) {
                      setPhase("revising");
                      setTimeout(() => handleRevise(), 50);
                    }
                  }
                }}
                placeholder={`Ask about the score or how to improve your ${config.title.toLowerCase()}...`}
                rows={2}
                disabled={reviseStreaming || !connected}
                className="flex-1 input-glow text-slate-100 text-sm rounded-xl px-4 py-3 resize-none placeholder-slate-500 disabled:opacity-50"
              />
              {reviseStreaming ? (
                <StopButton onClick={handleStop} className="min-w-[60px]" />
              ) : (
                <button
                  onClick={() => {
                    if (reviseInput.trim()) {
                      setPhase("revising");
                      setTimeout(() => handleRevise(), 50);
                    }
                  }}
                  disabled={!reviseInput.trim() || !connected}
                  className="btn-neon text-white rounded-xl px-4 font-medium transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-600 disabled:shadow-none disabled:cursor-not-allowed min-w-[60px]"
                >
                  Ask
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── Render: Revising Phase ───────────────────────────
  if (phase === "revising") {
    const visibleMessages = reviseMessages.filter(
      (m) => m.role === "user" || m.role === "assistant",
    );

    return (
      <section
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
        aria-label={`${config.title} revision`}
      >
        {/* Header bar */}
        <div className="glass border-b border-slate-700/30 px-4 py-2 flex items-center gap-3">
          <button
            onClick={() => setPhase("scored")}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-700/40 transition-colors"
          >
            &larr; Back to Score
          </button>
          <span className="text-xs text-slate-500">Revise {config.title}</span>
          {sourceFile && (
            <span
              className="text-xs text-indigo-400/70 ml-auto truncate max-w-[200px]"
              title={sourceFile.folder + "/" + sourceFile.path}
            >
              {sourceFile.name}
            </span>
          )}
        </div>

        {/* Current content + score summary */}
        <div className="px-4 py-3 border-b border-slate-700/20">
          <div className="max-w-3xl mx-auto glass rounded-xl border border-slate-700/30 p-3">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg">{config.icon}</span>
              <span className="text-sm font-medium text-slate-200">
                {config.title}
              </span>
              {scoreData?.overallGrade && (
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    scoreData.overallGrade === "A"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : scoreData.overallGrade === "B"
                        ? "bg-blue-500/20 text-blue-300"
                        : scoreData.overallGrade === "C"
                          ? "bg-amber-500/20 text-amber-300"
                          : scoreData.overallGrade === "D"
                            ? "bg-orange-500/20 text-orange-300"
                            : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {scoreData.overallGrade}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 line-clamp-2">
              {scoreData?.summary || ""}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
          role="log"
          aria-label="Revision messages"
          aria-live="polite"
        >
          <div className="max-w-3xl mx-auto space-y-3">
            {visibleMessages.map((msg, i) => (
              <div
                key={i}
                className={`rounded-xl p-3 ${
                  msg.role === "user"
                    ? "glass border border-indigo-500/20 ml-8"
                    : "glass border border-slate-700/30 mr-8"
                }`}
              >
                <div className="text-[10px] text-slate-500 mb-1 uppercase font-semibold">
                  {msg.role === "user" ? "You" : "AI"}
                </div>
                <div className="text-sm text-slate-200">
                  {msg.role === "assistant" ? (
                    <MarkdownContent content={msg.content} />
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {reviseStreaming &&
              visibleMessages.length > 0 &&
              visibleMessages[visibleMessages.length - 1]?.role !==
                "assistant" && (
                <div
                  className="flex items-center gap-2 text-slate-400 text-sm py-2 px-4"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex gap-1">
                    <span
                      className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    ></span>
                    <span
                      className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    ></span>
                    <span
                      className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    ></span>
                  </div>
                  <span>Thinking...</span>
                </div>
              )}
            <div ref={reviseEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="glass-heavy border-t border-slate-700/30 p-4">
          <div className="max-w-3xl mx-auto space-y-2">
            <InputToolbar
              textareaRef={null}
              getText={() => reviseInput}
              setText={(val) => setReviseInput((prev) => prev + val)}
              messages={reviseMessages}
              mode={config.title}
              onToast={onToast}
              onClear={() => setReviseInput("")}
              connected={connected}
              streaming={reviseStreaming}
              hideButtons={["upload"]}
            />
            <div className="flex flex-wrap gap-2 items-start">
              <label htmlFor="revise-input" className="sr-only">
                Revision instructions
              </label>
              <textarea
                id="revise-input"
                value={reviseInput}
                onChange={(e) => setReviseInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleRevise();
                  }
                }}
                placeholder={`How should we improve this ${config.title.toLowerCase()}?`}
                rows={2}
                disabled={reviseStreaming || !connected}
                className="flex-1 min-w-0 input-glow text-slate-100 text-sm rounded-xl px-4 py-3 resize-none placeholder-slate-500 disabled:opacity-50"
              />
              {reviseStreaming ? (
                <StopButton onClick={handleStop} className="min-w-[60px]" />
              ) : (
                <button
                  onClick={handleRevise}
                  disabled={!reviseInput.trim() || !connected}
                  className="btn-neon text-white rounded-xl px-4 font-medium transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-600 disabled:shadow-none disabled:cursor-not-allowed min-w-[60px]"
                >
                  Send
                </button>
              )}
            </div>
            {hasRevision && (
              <button
                onClick={() => {
                  applyRevision();
                }}
                disabled={reviseStreaming}
                className="w-full text-xs px-4 py-2 rounded-lg border border-blue-500/30 text-blue-300 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
              >
                Apply Revision to{" "}
                {config.title.replace(" Builder", "").replace(" Designer", "")}
              </button>
            )}
            <button
              onClick={() => {
                if (hasRevision) applyRevision();
                handleScore();
              }}
              disabled={reviseStreaming}
              className="w-full text-xs px-4 py-2 rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
            >
              {hasRevision
                ? `Apply Revision & Re-Score`
                : `Re-Score Current ${config.title.replace(" Builder", "").replace(" Designer", "")}`}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ── Render: Input Phase ──────────────────────────────
  return (
    <section
      className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
      aria-label={`${config.title} input`}
    >
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center space-y-2 py-4">
          <div className="text-3xl mb-2">{config.icon}</div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            {config.title}
          </h2>
          {config.subtitle && (
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              {config.subtitle}
            </p>
          )}
          {/* Load from file button */}
          <div className="flex justify-center pt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt,.yaml,.yml"
              onChange={handleFileInput}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500 hover:bg-slate-700/30 transition-colors"
            >
              Load from File
            </button>
          </div>
        </div>

        {/* Source file info */}
        {sourceFile && (
          <div className="glass rounded-lg border border-slate-700/30 px-3 py-2 flex items-center gap-2 text-xs max-w-3xl mx-auto">
            <span className="text-slate-500">Editing:</span>
            <span className="text-indigo-300 font-medium">
              {sourceFile.name}
            </span>
            <span
              className="text-slate-600 truncate flex-1"
              title={sourceFile.folder + "/" + sourceFile.path}
            >
              {sourceFile.folder}/{sourceFile.path}
            </span>
          </div>
        )}

        {/* Error */}
        {scoreError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
            <span className="text-red-400 shrink-0">&times;</span>
            <div className="flex-1">
              <p className="text-sm text-red-300">{scoreError}</p>
              {scoreError.includes("Pro") && (
                <button
                  onClick={() => {
                    const evt = new CustomEvent("show-upgrade", {
                      detail: { modeId: config.modeId },
                    });
                    window.dispatchEvent(evt);
                  }}
                  className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/40 transition-colors"
                >
                  Upgrade to Pro
                </button>
              )}
            </div>
          </div>
        )}

        {/* Form Fields */}
        <div className="glass rounded-xl border border-slate-700/30 p-4 space-y-4">
          {config.fields.map((field) => (
            <div key={field.name}>
              <label
                htmlFor={`builder-${field.name}`}
                className="text-xs text-slate-400 block mb-1"
              >
                {field.label}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </label>

              {field.type === "textarea" && (
                <div className="flex gap-2 items-start">
                  <textarea
                    id={`builder-${field.name}`}
                    value={formData[field.name] || ""}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    rows={field.large ? 10 : 4}
                    className={`flex-1 min-w-0 input-glow text-slate-100 font-mono text-sm rounded-xl px-4 py-3 resize-y placeholder-slate-500 ${
                      field.large ? "min-h-[200px]" : ""
                    }`}
                  />
                  <DictateButton
                    onResult={(chunk) => appendToField(field.name, chunk)}
                    disabled={phase !== "input"}
                  />
                </div>
              )}

              {field.type === "text" && (
                <div className="flex gap-2 items-start">
                  <input
                    id={`builder-${field.name}`}
                    type="text"
                    value={formData[field.name] || ""}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    className="flex-1 min-w-0 input-glow text-slate-200 text-sm rounded-lg px-3 py-2 placeholder-slate-500"
                  />
                  <DictateButton
                    onResult={(chunk) => appendToField(field.name, chunk)}
                    disabled={phase !== "input"}
                  />
                </div>
              )}

              {field.type === "tags" && (
                <TagInput
                  value={formData[field.name] || []}
                  onChange={(val) => updateField(field.name, val)}
                  placeholder={field.placeholder}
                  dictateDisabled={phase !== "input"}
                />
              )}

              {field.type === "select" && (
                <select
                  id={`builder-${field.name}`}
                  value={formData[field.name] || ""}
                  onChange={(e) => updateField(field.name, e.target.value)}
                  className="w-full input-glow text-slate-200 text-sm rounded-lg px-3 py-2 bg-transparent"
                >
                  <option value="" disabled>
                    {field.placeholder || "Select..."}
                  </option>
                  {(field.options || []).map((opt) => (
                    <option key={opt.value || opt} value={opt.value || opt}>
                      {opt.label || opt}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <InputToolbar
          textareaRef={null}
          getText={() => ""}
          setText={() => {}}
          messages={
            reviseMessages.length
              ? reviseMessages
              : scoreData
                ? [{ role: "assistant", content: JSON.stringify(scoreData) }]
                : []
          }
          mode={config.title}
          onToast={onToast}
          onClear={() => {
            setFormData({});
            formDataRef.current = {};
          }}
          connected={connected}
          streaming={reviseStreaming}
          hideButtons={["upload", "dictate"]}
        />

        {/* Submit */}
        <div className="flex justify-center">
          {isLoading ? (
            <StopButton
              onClick={handleStop}
              label="Stop Scoring"
              className="px-8 py-3 text-base"
            />
          ) : (
            <button
              onClick={handleScore}
              disabled={!requiredFieldsFilled() || !selectedModel || !connected}
              className="btn-neon text-white rounded-xl px-8 py-3 font-medium text-base transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-600 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {!connected
                ? "Connect to Ollama First"
                : !selectedModel
                  ? "Select a Model"
                  : `Score My ${config.title}`}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
