import { useState, useRef, useCallback, useEffect } from "react";
import { apiFetch } from "../lib/api-fetch";
import { useAbortable } from "../hooks/useAbortable";
import { registerAbort, unregisterAbort } from "../hooks/useAbortRegistry";
import StopButton from "./ui/StopButton";
import { Tab } from "@headlessui/react";
import {
  FileText,
  Upload as UploadIcon,
  FolderOpen,
  AlertTriangle,
  History,
} from "lucide-react";
import ReportCard from "./ReportCard";
import MessageBubble from "./MessageBubble";
import InputToolbar from "./ui/InputToolbar";
import MarkdownContent from "./MarkdownContent";
import LoadingAnimation from "./LoadingAnimation";
import ImageThumbnail from "./ImageThumbnail";
import ImageLightbox from "./ImageLightbox";
import { validateImage, processImage, hashImage } from "../lib/image-processor";
import {
  isConvertibleDocument,
  convertDocument,
  validateDocument,
} from "../lib/document-processor";

// ── Model tier system ─────────────────────────────────
// Empirical tier list for code review quality
const MODEL_TIERS = {
  strong: [
    "qwen3:32b",
    "qwen3:30b",
    "qwen2.5:32b",
    "llama3:70b",
    "llama3.1:70b",
    "llama3.3:70b",
    "deepseek-r1:32b",
    "deepseek-r1:70b",
    "codellama:34b",
    "codellama:70b",
    "mixtral:8x22b",
    "command-r-plus",
    "qwq:32b",
    "gemma3:27b",
  ],
  adequate: [
    "qwen3:14b",
    "qwen3:8b",
    "qwen2.5:14b",
    "qwen2.5:7b",
    "llama3:8b",
    "llama3.1:8b",
    "llama3.2:8b",
    "deepseek-r1:14b",
    "deepseek-r1:8b",
    "codellama:13b",
    "codellama:7b",
    "gemma3:12b",
    "mistral:7b",
    "mixtral:8x7b",
    "phi4:14b",
  ],
  weak: [
    "qwen3:4b",
    "qwen3:1.7b",
    "qwen3:0.6b",
    "qwen2.5:3b",
    "qwen2.5:1.5b",
    "qwen2.5:0.5b",
    "llama3.2:3b",
    "llama3.2:1b",
    "deepseek-r1:1.5b",
    "deepseek-r1:7b",
    "gemma3:4b",
    "gemma3:1b",
    "phi4-mini:3.8b",
    "tinyllama:1.1b",
  ],
};

function getModelTier(modelName) {
  if (!modelName) return "unknown";
  const normalized = modelName.toLowerCase().replace(/:latest$/, "");
  for (const [tier, models] of Object.entries(MODEL_TIERS)) {
    if (
      models.some(
        (m) =>
          normalized === m ||
          normalized.startsWith(m + "-") ||
          normalized.startsWith(m + ":"),
      )
    ) {
      return tier;
    }
  }
  const baseMatch = normalized.match(/^([^:]+):(\d+(?:\.\d+)?b)/);
  if (baseMatch) {
    const base = `${baseMatch[1]}:${baseMatch[2]}`;
    for (const [tier, models] of Object.entries(MODEL_TIERS)) {
      if (models.includes(base)) return tier;
    }
  }
  // Parameter-count fallback
  if (/(?:^|[^0-9])(?:0\.5b|1b|1\.5b|2b|3b|4b)(?:$|[^0-9])/.test(normalized))
    return "weak";
  if (/(?:^|[^0-9])(?:7b|8b)(?:$|[^0-9])/.test(normalized)) return "adequate";
  return "unknown";
}

function suggestBetterModel(currentModel, installedModels) {
  const currentTier = getModelTier(currentModel);
  if (currentTier === "strong" || currentTier === "unknown") return null;
  for (const targetTier of ["strong", "adequate"]) {
    if (targetTier === currentTier) continue;
    for (const model of installedModels) {
      if (getModelTier(model.name) === targetTier) {
        return { name: model.name, tier: targetTier };
      }
    }
  }
  return null;
}

// ── Review Panel ────────────────────────────────────
// Full Review mode: input methods, report card display,
// fallback streaming, deep-dive conversation, and history persistence.

export default function ReviewPanel({
  selectedModel,
  connected,
  streaming: _appStreaming,
  onAttachFromBrowser,
  onOpenFileBrowser,
  onToast,
  onSwitchToChat: _onSwitchToChat,
  savedReview,
  onSaveReview,
  models,
  onSetSelectedModel,
  onUpdateReviewDeepDive,
}) {
  // ── State ───────────────────────────────────────────
  const [phase, setPhase] = useState("input"); // 'input' | 'loading' | 'report' | 'fallback' | 'deep-dive'
  const [code, setCode] = useState("");
  const [filename, setFilename] = useState("");
  const [reportData, setReportData] = useState(null);
  const [fallbackContent, setFallbackContent] = useState("");
  const [deepDiveMessages, setDeepDiveMessages] = useState([]);
  const [deepDiveInput, setDeepDiveInput] = useState("");
  const [deepDiveStreaming, setDeepDiveStreaming] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [dragging, setDragging] = useState(false);

  // Document conversion state
  const [convertingDoc, setConvertingDoc] = useState(null);

  // Phase 9.1: Image support
  const [attachedImages, setAttachedImages] = useState([]);
  const [processingImages, setProcessingImages] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const modelTier = getModelTier(selectedModel);
  const suggestedModel = suggestBetterModel(selectedModel, models || []);
  const showModelWarning = modelTier === "weak" || modelTier === "adequate";

  // ── Restore saved review from history ───────────────
  useEffect(() => {
    if (savedReview) {
      if (savedReview.reportData) {
        setReportData(savedReview.reportData);
        setFilename(savedReview.filename || "");
        setCode(savedReview.code || "");
        setPhase("report");
        if (savedReview.deepDiveMessages?.length > 0) {
          setDeepDiveMessages(savedReview.deepDiveMessages);
        }
      } else if (savedReview.fallbackContent) {
        setFallbackContent(savedReview.fallbackContent);
        setFilename(savedReview.filename || "");
        setCode(savedReview.code || "");
        setPhase("fallback");
      }
    }
  }, [savedReview]);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const deepDiveInputRef = useRef(null);
  const dragCounter = useRef(0);
  const deepDiveEndRef = useRef(null);

  const isLoading = phase === "loading";

  // ── Abort support ──────────────────────────────────
  const { startAbortable, abort, isAborted, clearAbortable } = useAbortable();
  const handleStop = useCallback(() => {
    abort();
    setPhase(fallbackContent ? "fallback" : "input");
  }, [abort, fallbackContent]);
  useEffect(() => {
    registerAbort(handleStop);
    return () => unregisterAbort(handleStop);
  }, [handleStop]);

  // ── Submit review ─────────────────────────────────
  const handleSubmitReview = useCallback(async () => {
    if (!code.trim() || !selectedModel || isLoading) return;

    setPhase("loading");
    setReviewError("");
    setReportData(null);
    setFallbackContent("");

    try {
      // Phase 9.1: Include images in review request
      const images = attachedImages.map((img) => img.content); // Array of base64 (NO prefix)

      const signal = startAbortable();
      const res = await apiFetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          model: selectedModel,
          code: code.trim(),
          filename: filename || undefined,
          ...(images.length > 0 && { images }),
        }),
      });

      const contentType = res.headers.get("Content-Type") || "";

      if (contentType.includes("application/json")) {
        // Structured report card
        const result = await res.json();
        if (result.type === "report-card" && result.data) {
          setReportData(result.data);
          setPhase("report");
          // Persist to review history
          onSaveReview?.({
            reportData: result.data,
            filename: filename || undefined,
            code: code.trim(),
            model: selectedModel,
          });
          return;
        }
        // Error JSON
        setReviewError(
          result.error || "Unexpected response from review endpoint.",
        );
        setPhase("input");
        return;
      }

      if (contentType.includes("text/event-stream")) {
        // SSE fallback stream
        setPhase("fallback");
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
              if (parsed.token) {
                accumulated += parsed.token;
                setFallbackContent(accumulated);
              }
              if (parsed.error) {
                accumulated += `\n\nError: ${parsed.error}`;
                setFallbackContent(accumulated);
              }
            } catch {}
          }
        }
        setFallbackContent(accumulated);
        // Persist fallback review to history
        onSaveReview?.({
          fallbackContent: accumulated,
          filename: filename || undefined,
          code: code.trim(),
          model: selectedModel,
        });
        return;
      }

      // Unexpected content type
      const text = await res.text();
      setReviewError(`Unexpected response: ${text.slice(0, 200)}`);
      setPhase("input");
    } catch (err) {
      if (isAborted(err)) {
        setPhase(fallbackContent ? "fallback" : "input");
        return;
      }
      setReviewError(`Connection failed: ${err.message}`);
      setPhase("input");
    } finally {
      clearAbortable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    code,
    filename,
    selectedModel,
    isLoading,
    startAbortable,
    isAborted,
    clearAbortable,
    fallbackContent,
  ]);

  // ── Deep dive into a finding ──────────────────────
  const handleDeepDive = useCallback(
    (finding, categoryKey) => {
      const context = `I just reviewed some code and found this issue:\n\n**Category:** ${categoryKey}\n**Finding:** ${finding.title} (${finding.severity})\n**Details:** ${finding.explanation}${finding.analogy ? `\n**Analogy:** ${finding.analogy}` : ""}\n\nHere is the original code:\n\`\`\`\n${code.trim()}\n\`\`\``;

      const systemMsg = {
        role: "system",
        content: `You are a senior developer helping a Product Manager understand a code review finding in depth. The PM found an issue during a code review and wants to understand it better. Explain clearly, use analogies when helpful, and suggest specific fixes with code examples. Never use jargon without explanation.`,
      };

      const userMsg = {
        role: "user",
        content: `I want to understand this finding better and know how to fix it:\n\n**${finding.title}** (${finding.severity} severity, ${categoryKey} category)\n\n${finding.explanation}\n\nCan you explain what exactly is wrong, show me how to fix it, and tell me what the fix would look like?`,
      };

      setDeepDiveMessages([
        { role: "context", content: context },
        systemMsg,
        userMsg,
      ]);
      setDeepDiveInput("");
      setPhase("deep-dive");

      // Auto-send the initial deep-dive question
      sendDeepDiveMessage([systemMsg, userMsg], context);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [code, selectedModel],
  );

  // ── Send deep-dive chat message ───────────────────
  async function sendDeepDiveMessage(messages, _contextStr) {
    if (!selectedModel) return;
    setDeepDiveStreaming(true);

    const chatMessages = messages
      .filter((m) => m.role !== "context")
      .map((m) => ({
        role: m.role === "system" ? "system" : m.role,
        content: m.content,
      }));

    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          mode: "chat",
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
              setDeepDiveMessages((prev) => {
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
            if (parsed.error) {
              assistantContent += `\n\nError: ${parsed.error}`;
            }
          } catch {}
        }
      }

      // Ensure final message is set
      setDeepDiveMessages((prev) => {
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
      setDeepDiveMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Connection failed: ${err.message}` },
      ]);
    } finally {
      setDeepDiveStreaming(false);
      setTimeout(
        () => deepDiveEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
      // Persist deep-dive messages after each response
      setDeepDiveMessages((prev) => {
        onUpdateReviewDeepDive?.(prev);
        return prev;
      });
    }
  }

  // ── Deep-dive follow-up ───────────────────────────
  async function handleDeepDiveFollowUp() {
    if (!deepDiveInput.trim() || deepDiveStreaming) return;

    let base = deepDiveMessages;
    // If no messages yet, initialize with system context containing the original code
    if (base.length === 0 && code) {
      const sysMsg = {
        role: "system",
        content: `You are a senior developer helping fix code issues found during a review. You have the COMPLETE original source code below — do NOT ask the user to share it again.\n\nFilename: ${filename}\n\nORIGINAL CODE:\n\`\`\`\n${code}\n\`\`\`\n\nREVIEW FINDINGS:\n${reportData ? JSON.stringify(reportData, null, 2) : fallbackContent}\n\nINSTRUCTIONS:\n1. Fix ALL issues listed in the review findings.\n2. Show the COMPLETE corrected file in a single code block.\n3. Explain each change briefly.\n4. MANDATORY: After showing the corrected code, you MUST save it by calling:\nTOOL_CALL: builtin.write_file({"path": "${filename}", "content": "YOUR CORRECTED FILE CONTENT HERE"})\nThis creates a .backup automatically. You MUST make this tool call — do not skip it.\n5. Do NOT ask the user to share the code — you already have it above.\n6. Do NOT apologize or say you lack access.`,
      };
      base = [sysMsg];
    }

    const userMsg = { role: "user", content: deepDiveInput.trim() };
    const updatedMessages = [...base, userMsg];
    setDeepDiveMessages(updatedMessages);
    setDeepDiveInput("");

    await sendDeepDiveMessage(
      updatedMessages.filter((m) => m.role !== "context"),
      null,
    );
  }

  // ── File handling ─────────────────────────────────
  async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    for (const file of files) {
      // Handle convertible documents (PDF, PPTX, DOCX, etc.)
      if (isConvertibleDocument(file)) {
        const validation = validateDocument(file);
        if (!validation.valid) {
          alert(validation.error);
          return;
        }
        setConvertingDoc(file.name);
        try {
          const result = await convertDocument(file);
          setCode(result.markdown);
          setFilename(file.name);
        } catch (err) {
          alert(`Failed to convert "${file.name}": ${err.message}`);
        } finally {
          setConvertingDoc(null);
        }
        return;
      }

      const isImage = file.type.startsWith("image/");

      if (isImage) {
        // Phase 9.1: Process image files
        setProcessingImages((prev) => prev + 1);
        try {
          const configRes = await apiFetch("/api/config");
          const config = await configRes.json();

          const validation = await validateImage(
            file,
            config.imageSupport || {},
          );
          if (!validation.valid) {
            onToast?.(`❌ ${file.name}: ${validation.error}`);
            continue;
          }

          const processed = await processImage(file, config.imageSupport || {});
          const hash = await hashImage(processed.base64);
          const isDuplicate = attachedImages.some((img) => img.hash === hash);

          if (isDuplicate) {
            const proceed = confirm(
              `${file.name} appears to be a duplicate. Attach anyway?`,
            );
            if (!proceed) continue;
          }

          setAttachedImages((prev) => [
            ...prev,
            {
              name: file.name,
              content: processed.base64, // NO data URI prefix
              thumbnail: processed.thumbnail, // WITH data URI prefix
              size: processed.size,
              dimensions: processed.dimensions,
              format: processed.format,
              hash,
            },
          ]);

          onToast?.(`✓ Image processed: ${file.name}`);
        } catch (err) {
          const msg = err.message.toLowerCase();
          if (msg.includes("dimension")) {
            onToast?.(`❌ ${file.name}: Image too large to process`);
          } else if (msg.includes("canvas") || msg.includes("context")) {
            onToast?.(
              `❌ ${file.name}: Failed to process image (browser error)`,
            );
          } else if (msg.includes("memory") || msg.includes("out of")) {
            onToast?.(`❌ Out of memory. Try smaller images or fewer at once.`);
          } else if (msg.includes("corrupt") || msg.includes("invalid")) {
            onToast?.(`❌ ${file.name}: Corrupted or invalid image file`);
          } else {
            onToast?.(`❌ ${file.name}: ${err.message}`);
          }
        } finally {
          setProcessingImages((prev) => prev - 1);
        }
      } else {
        // Existing text file logic
        const reader = new FileReader();
        reader.onload = (ev) => {
          setCode(ev.target.result);
          setFilename(file.name);
          onToast?.(`Loaded: ${file.name}`);
        };
        reader.readAsText(file);
      }
    }

    e.target.value = "";
  }

  // ── Drag and drop ─────────────────────────────────
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
  async function handleDrop(e) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);

    for (const file of files) {
      // Handle convertible documents
      if (isConvertibleDocument(file)) {
        const validation = validateDocument(file);
        if (!validation.valid) continue;
        setConvertingDoc(file.name);
        try {
          const result = await convertDocument(file);
          setCode(result.markdown);
          setFilename(file.name);
        } catch (err) {
          console.error("Document conversion failed:", err);
        } finally {
          setConvertingDoc(null);
        }
        continue;
      }

      const isImage = file.type.startsWith("image/");

      if (isImage) {
        // Phase 9.1: Process image files
        setProcessingImages((prev) => prev + 1);
        try {
          const configRes = await apiFetch("/api/config");
          const config = await configRes.json();

          const validation = await validateImage(
            file,
            config.imageSupport || {},
          );
          if (!validation.valid) {
            onToast?.(`❌ ${file.name}: ${validation.error}`);
            continue;
          }

          const processed = await processImage(file, config.imageSupport || {});
          const hash = await hashImage(processed.base64);
          const isDuplicate = attachedImages.some((img) => img.hash === hash);

          if (isDuplicate) {
            const proceed = confirm(
              `${file.name} appears to be a duplicate. Attach anyway?`,
            );
            if (!proceed) continue;
          }

          setAttachedImages((prev) => [
            ...prev,
            {
              name: file.name,
              content: processed.base64,
              thumbnail: processed.thumbnail,
              size: processed.size,
              dimensions: processed.dimensions,
              format: processed.format,
              hash,
            },
          ]);

          onToast?.(`✓ Image dropped: ${file.name}`);
        } catch (err) {
          const msg = err.message.toLowerCase();
          if (msg.includes("dimension")) {
            onToast?.(`❌ ${file.name}: Image too large to process`);
          } else if (msg.includes("canvas") || msg.includes("context")) {
            onToast?.(
              `❌ ${file.name}: Failed to process image (browser error)`,
            );
          } else if (msg.includes("memory") || msg.includes("out of")) {
            onToast?.(`❌ Out of memory. Try smaller images or fewer at once.`);
          } else if (msg.includes("corrupt") || msg.includes("invalid")) {
            onToast?.(`❌ ${file.name}: Corrupted or invalid image file`);
          } else {
            onToast?.(`❌ ${file.name}: ${err.message}`);
          }
        } finally {
          setProcessingImages((prev) => prev - 1);
        }
      } else {
        // Existing text file logic
        const reader = new FileReader();
        reader.onload = (ev) => {
          setCode(ev.target.result);
          setFilename(file.name);
          onToast?.(`Loaded: ${file.name}`);
        };
        reader.readAsText(file);
      }
    }
  }

  // ── Reset to input ────────────────────────────────
  function handleNewReview() {
    setPhase("input");
    setCode("");
    setFilename("");
    setReportData(null);
    setFallbackContent("");
    setDeepDiveMessages([]);
    setReviewError("");
    // Phase 9.1: Clear attached images
    setAttachedImages([]);
  }

  // ── Back to report from deep-dive ─────────────────
  function handleBackToReport() {
    setPhase("report");
    setDeepDiveMessages([]);
    setDeepDiveInput("");
  }

  // ── Phase 9.1: Image management ───────────────────
  function removeImage(index) {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  }

  function openLightbox(index) {
    const img = attachedImages[index];
    if (!img) return;
    setLightboxImage({ src: img.thumbnail, filename: img.name });
    setLightboxIndex(index);
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
    setLightboxImage(null);
  }

  function navigateLightbox(newIndex) {
    if (newIndex < 0 || newIndex >= attachedImages.length) return;
    const img = attachedImages[newIndex];
    setLightboxImage({ src: img.thumbnail, filename: img.name });
    setLightboxIndex(newIndex);
  }

  // ── Receive file from File Browser ────────────────
  // This is called externally via a ref or prop callback
  // when the user clicks "attach" in the file browser.
  // We accept it as: { name, content, path }
  const handleFileFromBrowser = useCallback(
    (fileData) => {
      if (!fileData?.content) return;

      // Phase 9.1: Handle image files
      if (fileData.type === "image" || fileData.isImage) {
        setAttachedImages((prev) => [...prev, fileData]);
        onToast?.(`Attached image: ${fileData.name}`);
      } else {
        // Handle text files (code)
        setCode(fileData.content);
        setFilename(fileData.name || fileData.path || "");
        onToast?.(`Loaded from file browser: ${fileData.name}`);
      }
    },
    [onToast],
  );

  // Expose file-from-browser handler
  if (onAttachFromBrowser) {
    onAttachFromBrowser.current = handleFileFromBrowser;
  }

  // ── Render: Loading ───────────────────────────────
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center gap-4">
        <LoadingAnimation filename={filename} />
        <StopButton onClick={handleStop} label="Stop Review" />
      </div>
    );
  }

  // ── Render: Report Card ───────────────────────────
  if (phase === "report" && reportData) {
    const isSuspicious =
      modelTier === "weak" &&
      reportData &&
      (reportData.cleanBillOfHealth === true ||
        (reportData.overallGrade === "A" &&
          Object.values(reportData.categories || {}).every(
            (c) => c.grade === "A",
          )) ||
        Object.values(reportData.categories || {}).reduce(
          (sum, c) => sum + (c.findings?.length || 0),
          0,
        ) < 2);

    return (
      <section
        className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
        aria-label="Code review report card"
      >
        {savedReview && (
          <div className="max-w-3xl mx-auto mb-3 flex items-center gap-2 text-xs text-slate-500">
            <History className="w-3.5 h-3.5" />
            <span>Saved review</span>
          </div>
        )}
        <ReportCard
          data={reportData}
          filename={filename}
          onDeepDive={handleDeepDive}
          onNewReview={handleNewReview}
          onReviewRevision={async () => {
            // Keep filename, clear previous results, auto-reload the file
            setReportData(null);
            setDeepDiveMessages([]);
            setDeepDiveInput("");
            setFallbackContent("");
            // Try to reload the file from the project folder
            if (filename) {
              try {
                const res = await apiFetch(
                  `/api/files/read?path=${encodeURIComponent(filename)}`,
                );
                if (res.ok) {
                  const data = await res.json();
                  if (data.content) {
                    setCode(data.content);
                    setPhase("input");
                    onToast?.(
                      `Loaded revised ${filename} — click Run Code Review to re-score`,
                    );
                    return;
                  }
                }
              } catch {}
            }
            setCode("");
            setPhase("input");
            onToast?.(
              `Ready to review revised ${filename || "file"} — paste or upload the updated code`,
            );
          }}
          onPasteFixPrompts={(prompts) => {
            setDeepDiveInput("");
            setTimeout(() => {
              setDeepDiveInput(prompts);
              deepDiveInputRef.current?.focus();
              onToast?.("Fix prompts ready — click Ask to send");
            }, 50);
          }}
        />
        {/* Inline chat for discussing findings */}
        <div className="max-w-3xl mx-auto mt-3 space-y-3">
          <InputToolbar
            textareaRef={deepDiveInputRef}
            getText={() => deepDiveInput}
            setText={(val) => setDeepDiveInput((prev) => prev + val)}
            messages={
              deepDiveMessages.length
                ? deepDiveMessages
                : [
                    {
                      role: "assistant",
                      content: JSON.stringify(reportData, null, 2),
                    },
                  ]
            }
            mode="Review"
            onToast={onToast}
            onClear={() => setDeepDiveInput("")}
            connected={connected}
            streaming={deepDiveStreaming}
            hideButtons={["upload", "paste"]}
          />

          {/* Show conversation messages inline */}
          {deepDiveMessages.filter(
            (m) => m.role === "user" || m.role === "assistant",
          ).length > 0 && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
              {deepDiveMessages
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
              {deepDiveStreaming && (
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
              <div ref={deepDiveEndRef} />
            </div>
          )}

          {/* Chat input */}
          <div className="flex gap-2">
            <textarea
              ref={deepDiveInputRef}
              value={deepDiveInput}
              onChange={(e) => setDeepDiveInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleDeepDiveFollowUp();
                }
              }}
              placeholder="Paste fix prompts or ask about the findings..."
              rows={2}
              disabled={deepDiveStreaming || !connected}
              className="flex-1 input-glow text-slate-100 text-sm rounded-xl px-4 py-3 resize-none placeholder-slate-500 disabled:opacity-50"
            />
            {deepDiveStreaming ? (
              <StopButton onClick={handleStop} className="min-w-[60px]" />
            ) : (
              <button
                onClick={() => handleDeepDiveFollowUp()}
                disabled={!deepDiveInput.trim() || !connected}
                className="btn-neon text-white rounded-xl px-4 font-medium transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-600 disabled:shadow-none disabled:cursor-not-allowed min-w-[60px]"
              >
                Ask
              </button>
            )}
          </div>
        </div>
        {isSuspicious && suggestedModel && (
          <div className="max-w-3xl mx-auto mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div className="flex-1 text-sm text-amber-200/80">
              For a deeper review, try <strong>{suggestedModel.name}</strong> —
              larger models catch more subtle issues.
            </div>
            <button
              onClick={() => {
                onSetSelectedModel?.(suggestedModel.name);
                setPhase("input");
              }}
              className="px-3 py-1.5 text-sm font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors cursor-pointer whitespace-nowrap"
            >
              Try it
            </button>
          </div>
        )}
      </section>
    );
  }

  // ── Render: Fallback (streaming markdown) ─────────
  if (phase === "fallback") {
    return (
      <section
        className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
        aria-label="Code review (conversation mode)"
      >
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="glass rounded-xl border border-amber-500/20 p-3 flex items-center gap-2">
            <span className="text-amber-400">⚠️</span>
            <p className="text-xs text-amber-300">
              The model couldn't produce a structured report card, so here's a
              conversational review instead.
            </p>
          </div>
          <div className="glass rounded-xl border border-slate-700/30 p-4">
            {fallbackContent ? (
              <MarkdownContent content={fallbackContent} />
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                <span className="text-sm">Streaming review...</span>
              </div>
            )}
          </div>
          <InputToolbar
            textareaRef={null}
            getText={() => ""}
            setText={() => {}}
            messages={[{ role: "assistant", content: fallbackContent }]}
            mode="Review"
            onToast={onToast}
            connected={connected}
            streaming={false}
            hideButtons={["upload", "paste", "clear", "dictate"]}
          />
          <div className="flex gap-2">
            <button
              onClick={handleNewReview}
              className="text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/40 transition-colors"
            >
              Review Another
            </button>
            <button
              onClick={() => {
                setDeepDiveMessages([
                  {
                    role: "system",
                    content: `You are a senior developer helping fix code issues found during a review. You have the COMPLETE original source code below — do NOT ask the user to share it again.\n\nFilename: ${filename}\n\nORIGINAL CODE:\n\`\`\`\n${code}\n\`\`\`\n\nREVIEW FINDINGS:\n${fallbackContent}\n\nINSTRUCTIONS:\n1. Fix ALL issues listed in the review findings.\n2. Show the COMPLETE corrected file in a single code block.\n3. Explain each change briefly.\n4. MANDATORY: After showing the corrected code, you MUST save it by calling:\nTOOL_CALL: builtin.write_file({"path": "${filename}", "content": "YOUR CORRECTED FILE CONTENT HERE"})\nThis creates a .backup automatically. You MUST make this tool call — do not skip it.\n5. Do NOT ask the user to share the code — you already have it above.\n6. Do NOT apologize or say you lack access.`,
                  },
                ]);
                setPhase("deep-dive");
              }}
              className="text-xs px-3 py-2 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition-colors"
            >
              Continue Discussion
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ── Render: Deep Dive Conversation ────────────────
  if (phase === "deep-dive") {
    const visibleMessages = deepDiveMessages.filter(
      (m) => m.role === "user" || m.role === "assistant",
    );

    return (
      <section
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
        aria-label="Deep dive conversation"
      >
        {/* Header bar */}
        <div className="glass border-b border-slate-700/30 px-4 py-2 flex items-center gap-3">
          <button
            onClick={handleBackToReport}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-700/40 transition-colors"
          >
            ← Back to Report
          </button>
          <span className="text-xs text-slate-500">Deep Dive Conversation</span>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
          role="log"
          aria-label="Deep dive messages"
          aria-live="polite"
        >
          {visibleMessages.map((msg, i) => (
            <MessageBubble
              key={i}
              role={msg.role}
              content={msg.content}
              streaming={
                deepDiveStreaming &&
                i === visibleMessages.length - 1 &&
                msg.role === "assistant"
              }
            />
          ))}
          {deepDiveStreaming &&
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
          <div ref={deepDiveEndRef} />
        </div>

        {/* Follow-up input */}
        <div className="glass-heavy border-t border-slate-700/30 p-4 space-y-2">
          <InputToolbar
            textareaRef={deepDiveInputRef}
            getText={() => deepDiveInput}
            setText={(val) => setDeepDiveInput((prev) => prev + val)}
            messages={deepDiveMessages}
            mode="Review"
            onToast={onToast}
            onClear={() => setDeepDiveInput("")}
            connected={connected}
            streaming={deepDiveStreaming}
            hideButtons={["upload"]}
          />
          <div className="flex gap-2">
            <label htmlFor="deep-dive-input" className="sr-only">
              Ask a follow-up question
            </label>
            <textarea
              id="deep-dive-input"
              ref={deepDiveInputRef}
              value={deepDiveInput}
              onChange={(e) => setDeepDiveInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleDeepDiveFollowUp();
                }
              }}
              placeholder="Ask a follow-up question about this finding..."
              rows={2}
              disabled={deepDiveStreaming || !connected}
              className="flex-1 input-glow text-slate-100 font-mono text-sm rounded-xl px-4 py-3 resize-none placeholder-slate-500 disabled:opacity-50"
            />
            <button
              onClick={handleDeepDiveFollowUp}
              disabled={
                !deepDiveInput.trim() || deepDiveStreaming || !connected
              }
              className="btn-neon text-white rounded-xl px-4 font-medium transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-600 disabled:shadow-none disabled:cursor-not-allowed min-w-[60px]"
            >
              {deepDiveStreaming ? "..." : "Ask"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ── Render: Input Phase ───────────────────────────
  return (
    <section
      className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
      aria-label="Code review input"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center space-y-2 py-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Code Review
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Submit code for a structured review. You'll get a color-coded report
            card with grades for bugs, security, readability, and completeness.
          </p>
        </div>

        {/* Error */}
        {reviewError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
            <span className="text-red-400 shrink-0">✕</span>
            <p className="text-sm text-red-300">{reviewError}</p>
          </div>
        )}

        {/* Drag overlay */}
        {dragging && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-base/80 border-2 border-dashed border-indigo-500 rounded-2xl m-2 pointer-events-none">
            <div className="text-center">
              <div className="text-4xl mb-2">📄</div>
              <p className="text-indigo-300 font-medium neon-text">
                Drop a file to review
              </p>
            </div>
          </div>
        )}

        {/* Code Input - Tab-based interface */}
        <div className="glass rounded-xl border border-slate-700/30 p-4 space-y-4">
          <Tab.Group>
            <Tab.List className="flex gap-2 border-b border-slate-700/30 mb-4">
              <Tab
                className={({ selected }) =>
                  `flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                    selected
                      ? "border-b-2 border-indigo-500 text-white -mb-px"
                      : "text-slate-400 hover:text-slate-300"
                  }`
                }
              >
                <FileText className="w-4 h-4" />
                Paste Code
              </Tab>
              <Tab
                className={({ selected }) =>
                  `flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                    selected
                      ? "border-b-2 border-indigo-500 text-white -mb-px"
                      : "text-slate-400 hover:text-slate-300"
                  }`
                }
              >
                <UploadIcon className="w-4 h-4" />
                Upload File
              </Tab>
              <Tab
                className={({ selected }) =>
                  `flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                    selected
                      ? "border-b-2 border-indigo-500 text-white -mb-px"
                      : "text-slate-400 hover:text-slate-300"
                  }`
                }
              >
                <FolderOpen className="w-4 h-4" />
                Browse Files
              </Tab>
            </Tab.List>

            <Tab.Panels>
              {/* Paste Code Panel */}
              <Tab.Panel className="space-y-3">
                <div>
                  <label
                    htmlFor="review-filename"
                    className="text-xs text-slate-400 block mb-1"
                  >
                    Filename{" "}
                    <span className="text-slate-600">
                      (optional — helps the AI understand context)
                    </span>
                  </label>
                  <input
                    id="review-filename"
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder="e.g. server.js, utils/auth.py"
                    className="w-full input-glow text-slate-200 text-sm rounded-lg px-3 py-2 placeholder-slate-500 font-mono"
                  />
                </div>
                <div>
                  <label
                    htmlFor="review-code"
                    className="text-xs text-slate-400 block mb-1"
                  >
                    Code to review
                  </label>
                  <textarea
                    id="review-code"
                    ref={textareaRef}
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      if (!filename) setFilename("");
                    }}
                    placeholder="Paste your code here..."
                    rows={16}
                    className="w-full input-glow text-slate-100 font-mono text-sm rounded-xl px-4 py-3 resize-y placeholder-slate-500"
                  />
                </div>
                <InputToolbar
                  textareaRef={textareaRef}
                  getText={() => code}
                  setText={(val) => setCode((prev) => prev + val)}
                  messages={
                    deepDiveMessages.length
                      ? deepDiveMessages
                      : reportData
                        ? [
                            {
                              role: "assistant",
                              content:
                                fallbackContent || JSON.stringify(reportData),
                            },
                          ]
                        : []
                  }
                  mode="Review"
                  onToast={onToast}
                  onClear={() => {
                    setCode("");
                    setFilename("");
                  }}
                  connected={connected}
                  streaming={deepDiveStreaming}
                  hideButtons={["upload"]}
                />
              </Tab.Panel>

              {/* Upload File Panel */}
              <Tab.Panel>
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    dragging
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-slate-700/40 hover:border-slate-600/60"
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".js,.jsx,.ts,.tsx,.py,.json,.md,.txt,.html,.css,.yaml,.yml,.sh,.sql,.go,.rs,.java,.c,.cpp,.h,.toml,.xml,.csv,.env,.svelte,.vue,.rb,.php,.swift,.kt,.dart,.zig,.ex,.exs,.erl,.hs,.ml,.clj,.scala,.r,.lua,.pl,.ps1,image/*,.png,.jpg,.jpeg,.gif,.pdf,.pptx,.docx,.xlsx,.xls,.doc,.ppt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <UploadIcon className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-300 mb-2">
                    Drag and drop a file, or click to browse
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
                  >
                    Choose File
                  </button>
                  {filename && (
                    <p className="text-xs text-emerald-400 mt-3">
                      Loaded: <span className="font-mono">{filename}</span>
                    </p>
                  )}
                </div>
              </Tab.Panel>

              {/* Browse Files Panel */}
              <Tab.Panel>
                <div className="text-center py-8 space-y-4">
                  <FolderOpen className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">
                    Browse files from your project folder
                  </p>
                  <button
                    onClick={onOpenFileBrowser}
                    className="text-sm px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
                  >
                    Open File Browser
                  </button>
                  {filename && (
                    <p className="text-xs text-emerald-400 mt-3">
                      Loaded: <span className="font-mono">{filename}</span>
                    </p>
                  )}
                </div>
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </div>

        {/* Phase 9.1: Attached Images Display */}
        {attachedImages.length > 0 && (
          <div className="glass rounded-xl border border-slate-700/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400">
                Attached Images ({attachedImages.length})
              </p>
              <button
                onClick={() => setAttachedImages([])}
                className="text-xs text-red-400 hover:text-red-300 hover:underline"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {attachedImages.map((img, i) => (
                <ImageThumbnail
                  key={i}
                  src={img.thumbnail}
                  filename={img.name}
                  size={img.size}
                  dimensions={img.dimensions}
                  format={img.format}
                  onClick={() => openLightbox(i)}
                  onRemove={() => removeImage(i)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Document conversion indicator */}
        {convertingDoc && (
          <div className="glass rounded-xl border border-indigo-500/30 p-3 flex items-center gap-2 text-xs text-indigo-300">
            <span className="inline-block animate-spin">&#x27F3;</span>
            <span>Converting {convertingDoc}...</span>
          </div>
        )}

        {/* Phase 9.1: Processing Indicator */}
        {processingImages > 0 && (
          <div className="fixed bottom-4 right-4 z-50 glass-heavy rounded-xl border border-indigo-500/30 px-4 py-3 flex items-center gap-3 shadow-xl">
            <div className="flex gap-1">
              <div
                className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <div
                className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
            <span className="text-sm text-slate-200">
              Processing {processingImages} image
              {processingImages > 1 ? "s" : ""}...
            </span>
          </div>
        )}

        {/* Model capability warning */}
        {showModelWarning && connected && selectedModel && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm text-amber-300">
                {modelTier === "weak"
                  ? "This model is very small and will likely struggle to produce a structured report card. You may get a conversational fallback instead."
                  : "Smaller models can produce report cards but may miss issues or produce less accurate grades."}
              </p>
              {suggestedModel && (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-amber-200/80">
                    For better results, try{" "}
                    <strong>{suggestedModel.name}</strong>
                  </p>
                  <button
                    onClick={() => onSetSelectedModel?.(suggestedModel.name)}
                    className="px-3 py-1 text-sm font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Switch
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-center">
          {isLoading || phase === "fallback" ? (
            <StopButton
              onClick={handleStop}
              label="Stop Review"
              className="px-8 py-3 text-base"
            />
          ) : (
            <button
              onClick={handleSubmitReview}
              disabled={!code.trim() || !selectedModel || !connected}
              className="btn-neon text-white rounded-xl px-8 py-3 font-medium text-base transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-600 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {!connected
                ? "Connect to Ollama First"
                : !selectedModel
                  ? "Select a Model"
                  : "Run Code Review"}
            </button>
          )}
        </div>

        {/* Tips */}
        <div className="glass rounded-xl border border-slate-700/20 p-4 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-400">Tips for best results:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>
              Submit one file or logical unit at a time for more focused reviews
            </li>
            <li>
              Include the filename so the AI understands the file type and
              context
            </li>
            <li>
              Larger models (13B+) produce more accurate structured report cards
            </li>
            <li>
              If the structured report fails, you'll get a conversational review
              as fallback
            </li>
          </ul>
        </div>
      </div>

      {/* Phase 9.1: Image Lightbox */}
      {lightboxOpen && lightboxImage && (
        <ImageLightbox
          isOpen={lightboxOpen}
          onClose={closeLightbox}
          src={lightboxImage.src}
          filename={lightboxImage.filename}
          images={attachedImages.map((img) => img.thumbnail)}
          currentIndex={lightboxIndex}
          onNavigate={navigateLightbox}
        />
      )}
    </section>
  );
}
