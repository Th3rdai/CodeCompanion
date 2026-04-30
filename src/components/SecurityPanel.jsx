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
  FolderSearch,
  AlertTriangle,
  History,
  Copy,
  Download,
  Wrench,
} from "lucide-react";
import { copyText } from "../lib/clipboard";
import SecurityReport from "./SecurityReport";
import MessageBubble from "./MessageBubble";
import MarkdownContent from "./MarkdownContent";
import LoadingAnimation from "./LoadingAnimation";
import ImageThumbnail from "./ImageThumbnail";
import DictateButton from "./DictateButton";
import ImageLightbox from "./ImageLightbox";
import { validateImage, processImage, hashImage } from "../lib/image-processor";
import {
  isConvertibleDocument,
  convertDocument,
  validateDocument,
} from "../lib/document-processor";

// ── Model tier system (same as ReviewPanel) ──────────
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

// ── Security Panel ──────────────────────────────────
export default function SecurityPanel({
  selectedModel,
  connected,
  streaming: _appStreaming,
  onAttachFromBrowser,
  onOpenFileBrowser,
  onToast,
  savedPentest,
  onSavePentest,
  models,
  onSetSelectedModel,
  onUpdatePentestDeepDive,
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
  const [scanError, setScanError] = useState("");
  const [dragging, setDragging] = useState(false);

  // Folder scan state
  const [folderPath, setFolderPath] = useState("");
  const [folderPreview, setFolderPreview] = useState(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState("");
  const [_folderMeta, setFolderMeta] = useState(null);

  // Fallback follow-up conversation state
  const [fallbackMessages, setFallbackMessages] = useState([]);
  const [fallbackInput, setFallbackInput] = useState("");
  const [fallbackStreaming, setFallbackStreaming] = useState(false);
  const fallbackEndRef = useRef(null);

  // Remediation state
  const [remediating, setRemediating] = useState(false);
  const [remediationProgress, setRemediationProgress] = useState("");

  // Document conversion state
  const [convertingDoc, setConvertingDoc] = useState(null);

  // Phase 9.2: Image support
  const [attachedImages, setAttachedImages] = useState([]);
  const [processingImages, setProcessingImages] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const modelTier = getModelTier(selectedModel);
  const suggestedModel = suggestBetterModel(selectedModel, models || []);
  const showModelWarning = modelTier === "weak" || modelTier === "adequate";

  // ── Restore saved pentest from history ───────────────
  useEffect(() => {
    if (savedPentest) {
      if (savedPentest.reportData) {
        setReportData(savedPentest.reportData);
        setFilename(savedPentest.filename || "");
        setCode(savedPentest.code || "");
        setPhase("report");
        if (savedPentest.deepDiveMessages?.length > 0) {
          setDeepDiveMessages(savedPentest.deepDiveMessages);
        }
      } else if (savedPentest.fallbackContent) {
        setFallbackContent(savedPentest.fallbackContent);
        setFilename(savedPentest.filename || "");
        setCode(savedPentest.code || "");
        setPhase("fallback");
      }
    }
  }, [savedPentest]);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const deepDiveInputRef = useRef(null);
  const dragCounter = useRef(0);
  const deepDiveEndRef = useRef(null);

  const isLoading = phase === "loading";

  // ── Abort support ──────────────────────────────────
  const singleAbort = useAbortable();
  const folderAbort = useAbortable();
  const handleStop = useCallback(() => {
    singleAbort.abort();
    folderAbort.abort();
    setPhase(fallbackContent ? "fallback" : "input");
  }, [singleAbort, folderAbort, fallbackContent]);
  useEffect(() => {
    registerAbort(handleStop);
    return () => unregisterAbort(handleStop);
  }, [handleStop]);

  // ── Submit security scan ─────────────────────────────
  const handleSubmitScan = useCallback(async () => {
    if (!code.trim() || !selectedModel || isLoading) return;

    setPhase("loading");
    setScanError("");
    setReportData(null);
    setFallbackContent("");

    try {
      // Phase 9.2: Include images in security scan request
      const images = attachedImages.map((img) => img.content); // Array of base64 (NO prefix)

      const signal = singleAbort.startAbortable();
      const res = await apiFetch("/api/pentest", {
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
        const result = await res.json();
        if (result.type === "security-report" && result.data) {
          setReportData(result.data);
          setPhase("report");
          onSavePentest?.({
            reportData: result.data,
            filename: filename || undefined,
            code: code.trim(),
            model: selectedModel,
          });
          return;
        }
        setScanError(
          result.error || "Unexpected response from security endpoint.",
        );
        setPhase("input");
        return;
      }

      if (contentType.includes("text/event-stream")) {
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
        onSavePentest?.({
          fallbackContent: accumulated,
          filename: filename || undefined,
          code: code.trim(),
          model: selectedModel,
        });
        return;
      }

      const text = await res.text();
      setScanError(`Unexpected response: ${text.slice(0, 200)}`);
      setPhase("input");
    } catch (err) {
      if (singleAbort.isAborted(err)) {
        setPhase(fallbackContent ? "fallback" : "input");
        return;
      }
      setScanError(`Connection failed: ${err.message}`);
      setPhase("input");
    } finally {
      singleAbort.clearAbortable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, filename, selectedModel, isLoading, singleAbort, fallbackContent]);

  // ── Deep dive into a category ──────────────────────
  const handleDeepDive = useCallback(
    (categoryKey, categoryData) => {
      const context = `I just ran a security scan on some code and found issues in the ${categoryKey} category.\n\n**Category:** ${categoryData.label || categoryKey}\n**Grade:** ${categoryData.grade}\n**Summary:** ${categoryData.summary}\n\nHere is the original code:\n\`\`\`\n${code.trim()}\n\`\`\``;

      const systemMsg = {
        role: "system",
        content:
          "You are a senior security engineer helping a developer understand OWASP security findings in depth. Explain clearly, use analogies when helpful, and suggest specific fixes with code examples. Never use jargon without explanation.",
      };

      const vulnList = (categoryData.vulnerabilities || [])
        .map((v) => `- **${v.title}** (${v.severity}): ${v.description}`)
        .join("\n");

      const userMsg = {
        role: "user",
        content: `I want to understand the security issues in the "${categoryData.label || categoryKey}" category better.\n\nFindings:\n${vulnList || "No specific findings, but the grade is " + categoryData.grade}\n\nCan you explain what these issues mean, how an attacker could exploit them, and show me exactly how to fix them?`,
      };

      setDeepDiveMessages([
        { role: "context", content: context },
        systemMsg,
        userMsg,
      ]);
      setDeepDiveInput("");
      setPhase("deep-dive");

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
      setDeepDiveMessages((prev) => {
        onUpdatePentestDeepDive?.(prev);
        return prev;
      });
    }
  }

  // ── Deep-dive follow-up ───────────────────────────
  async function handleDeepDiveFollowUp() {
    if (!deepDiveInput.trim() || deepDiveStreaming) return;

    const userMsg = { role: "user", content: deepDiveInput.trim() };
    const updatedMessages = [...deepDiveMessages, userMsg];
    setDeepDiveMessages(updatedMessages);
    setDeepDiveInput("");

    await sendDeepDiveMessage(
      updatedMessages.filter((m) => m.role !== "context"),
      null,
    );
  }

  // ── File handling (single or multiple) ───────────
  async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Separate documents, images, and text files
    const imageFiles = [];
    const textFiles = [];
    const docFiles = [];

    for (const file of files) {
      if (isConvertibleDocument(file)) {
        docFiles.push(file);
      } else if (file.type.startsWith("image/")) {
        imageFiles.push(file);
      } else {
        textFiles.push(file);
      }
    }

    // Process convertible documents (PDF, PPTX, DOCX, etc.)
    for (const file of docFiles) {
      const validation = validateDocument(file);
      if (!validation.valid) {
        onToast?.(`${file.name}: ${validation.error}`);
        continue;
      }
      setConvertingDoc(file.name);
      try {
        const result = await convertDocument(file);
        setCode(result.markdown);
        setFilename(file.name);
      } catch (err) {
        console.error("Document conversion failed:", err);
        onToast?.(`Failed to convert "${file.name}": ${err.message}`);
      } finally {
        setConvertingDoc(null);
      }
    }

    // Process images
    for (const file of imageFiles) {
      setProcessingImages((prev) => prev + 1);
      try {
        const configRes = await apiFetch("/api/config");
        const config = await configRes.json();

        const validation = await validateImage(file, config.imageSupport || {});
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

        onToast?.(`✓ Image processed: ${file.name}`);
      } catch (err) {
        const msg = err.message.toLowerCase();
        if (msg.includes("dimension")) {
          onToast?.(`❌ ${file.name}: Image too large to process`);
        } else if (msg.includes("canvas") || msg.includes("context")) {
          onToast?.(`❌ ${file.name}: Failed to process image (browser error)`);
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
    }

    // Process text files (existing logic)
    if (textFiles.length === 1) {
      const file = textFiles[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCode(ev.target.result);
        setFilename(file.name);
        onToast?.(`Loaded: ${file.name}`);
      };
      reader.readAsText(file);
    } else if (textFiles.length > 1) {
      // Multiple text files selected
      const results = [];
      let loaded = 0;
      for (const file of textFiles) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          results.push({ name: file.name, content: ev.target.result });
          loaded++;
          if (loaded === textFiles.length) {
            const combined = results
              .map((r) => `── File: ${r.name} ──\n${r.content}`)
              .join("\n\n");
            setCode(combined);
            setFilename(`${textFiles.length} files`);
            onToast?.(`Loaded ${textFiles.length} text files`);
          }
        };
        reader.readAsText(file);
      }
    }
    e.target.value = "";
  }

  // ── Drag and drop (files + folders) ─────────────────
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

  // Helpers for recursive folder reading via browser File System API
  function readEntryFile(fileEntry) {
    return new Promise((resolve, reject) => {
      fileEntry.file((f) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve({
            path: fileEntry.fullPath.replace(/^\//, ""),
            content: reader.result,
            size: f.size,
          });
        reader.onerror = reject;
        reader.readAsText(f);
      }, reject);
    });
  }

  function readDirectoryEntries(dirReader) {
    return new Promise((resolve, reject) => {
      dirReader.readEntries((entries) => resolve(entries), reject);
    });
  }

  const TEXT_EXTS = new Set([
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".py",
    ".rb",
    ".go",
    ".rs",
    ".java",
    ".kt",
    ".swift",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".less",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".xml",
    ".md",
    ".txt",
    ".sh",
    ".sql",
    ".graphql",
    ".svelte",
    ".vue",
    ".astro",
    ".env",
    ".conf",
    ".ini",
    ".cfg",
    ".tf",
    ".hcl",
    ".php",
    ".dart",
    ".zig",
    ".ex",
    ".lua",
  ]);
  const IGNORE_DIRS = new Set([
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    "__pycache__",
    ".venv",
    "venv",
    "coverage",
    ".cache",
  ]);

  async function readEntriesRecursive(entry, collected, maxFiles = 80) {
    if (collected.length >= maxFiles) return;
    if (entry.isFile) {
      const ext = entry.name.includes(".")
        ? "." + entry.name.split(".").pop().toLowerCase()
        : "";
      if (TEXT_EXTS.has(ext)) {
        try {
          const f = await readEntryFile(entry);
          if (f.size <= 200 * 1024) collected.push(f);
        } catch {
          /* skip unreadable */
        }
      }
    } else if (
      entry.isDirectory &&
      !IGNORE_DIRS.has(entry.name) &&
      !entry.name.startsWith(".")
    ) {
      const reader = entry.createReader();
      let batch;
      do {
        batch = await readDirectoryEntries(reader);
        for (const child of batch) {
          if (collected.length >= maxFiles) break;
          await readEntriesRecursive(child, collected, maxFiles);
        }
      } while (batch.length > 0 && collected.length < maxFiles);
    }
  }

  async function handleDrop(e) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);

    const items = e.dataTransfer.items;
    const entries = [];
    let hasDirectory = false;

    // Check for directory entries first
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) {
          entries.push(entry);
          if (entry.isDirectory) hasDirectory = true;
        }
      }
    }

    if (hasDirectory || entries.length > 1) {
      // Multi-file / folder drop — read all files recursively
      onToast?.("Reading folder contents...");
      const collected = [];
      for (const entry of entries) {
        await readEntriesRecursive(entry, collected);
      }

      if (collected.length === 0) {
        onToast?.("No scannable code files found");
        return;
      }

      const combined = collected
        .map((f) => `── File: ${f.path} ──\n${f.content}`)
        .join("\n\n");
      const folderName =
        entries.find((e) => e.isDirectory)?.name || `${collected.length} files`;
      setCode(combined);
      setFilename(`${folderName} (${collected.length} files)`);
      onToast?.(`Loaded ${collected.length} files from ${folderName}`);
    } else {
      // Single file drop
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        const file = files[0];

        // Handle convertible documents
        if (isConvertibleDocument(file)) {
          const validation = validateDocument(file);
          if (!validation.valid) {
            onToast?.(`${file.name}: ${validation.error}`);
            return;
          }
          setConvertingDoc(file.name);
          try {
            const result = await convertDocument(file);
            setCode(result.markdown);
            setFilename(file.name);
          } catch (err) {
            console.error("Document conversion failed:", err);
            onToast?.(`Failed to convert "${file.name}": ${err.message}`);
          } finally {
            setConvertingDoc(null);
          }
          return;
        }

        const isImage = file.type.startsWith("image/");

        if (isImage) {
          // Phase 9.2: Process dropped image
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
              return;
            }

            const processed = await processImage(
              file,
              config.imageSupport || {},
            );
            const hash = await hashImage(processed.base64);
            const isDuplicate = attachedImages.some((img) => img.hash === hash);

            if (isDuplicate) {
              const proceed = confirm(
                `${file.name} appears to be a duplicate. Attach anyway?`,
              );
              if (!proceed) return;
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
              onToast?.(
                `❌ Out of memory. Try smaller images or fewer at once.`,
              );
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
  }

  // ── Reset to input ────────────────────────────────
  function handleDictation(text) {
    setCode((prev) => (prev ? prev + " " + text : text));
  }

  function handleNewScan() {
    setPhase("input");
    setCode("");
    setFilename("");
    setReportData(null);
    setFallbackContent("");
    setDeepDiveMessages([]);
    setScanError("");
    setFolderPreview(null);
    setFolderError("");
    setFolderMeta(null);
    setFallbackMessages([]);
    setFallbackInput("");
    // Phase 9.2: Clear attached images
    setAttachedImages([]);
  }

  // ── Back to report from deep-dive ─────────────────
  function handleBackToReport() {
    setPhase("report");
    setDeepDiveMessages([]);
    setDeepDiveInput("");
  }

  // ── Phase 9.2: Image management ───────────────────
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
  const handleFileFromBrowser = useCallback(
    (fileData) => {
      if (!fileData?.content) return;

      // Phase 9.2: Handle image files
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

  if (onAttachFromBrowser) {
    onAttachFromBrowser.current = handleFileFromBrowser;
  }

  // ── Folder preview (show files before scanning) ────
  const handleFolderPreview = useCallback(async () => {
    if (!folderPath.trim()) return;
    setFolderLoading(true);
    setFolderError("");
    setFolderPreview(null);

    try {
      const res = await apiFetch("/api/pentest/folder/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: folderPath.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFolderError(data.error || "Could not preview folder");
        return;
      }
      setFolderPreview(data);
    } catch {
      setFolderError("Could not reach server");
    } finally {
      setFolderLoading(false);
    }
  }, [folderPath]);

  // ── Submit folder scan ─────────────────────────────
  const handleSubmitFolderScan = useCallback(async () => {
    if (!folderPath.trim() || !selectedModel || isLoading) return;

    setPhase("loading");
    setScanError("");
    setReportData(null);
    setFallbackContent("");
    setFolderMeta(null);

    try {
      const signal = folderAbort.startAbortable();
      const res = await apiFetch("/api/pentest/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          model: selectedModel,
          folder: folderPath.trim(),
        }),
      });

      const contentType = res.headers.get("Content-Type") || "";

      if (contentType.includes("application/json")) {
        const result = await res.json();
        if (result.type === "security-report" && result.data) {
          const meta = result.meta || {};
          setFolderMeta(meta);
          setReportData(result.data);
          setFilename(
            `${meta.fileCount || "?"} files in ${folderPath.trim().split("/").pop() || "folder"}`,
          );
          setPhase("report");
          onSavePentest?.({
            reportData: result.data,
            filename: `Folder: ${folderPath.trim()}`,
            code: `Scanned ${meta.fileCount} files (${(meta.totalSize / 1024).toFixed(1)}KB)${meta.skipped ? `, ${meta.skipped} skipped` : ""}`,
            model: selectedModel,
          });
          return;
        }
        setScanError(result.error || "Unexpected response");
        setPhase("input");
        return;
      }

      if (contentType.includes("text/event-stream")) {
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
              if (parsed.meta) setFolderMeta(parsed.meta);
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
        setFilename(`Folder: ${folderPath.trim()}`);
        onSavePentest?.({
          fallbackContent: accumulated,
          filename: `Folder: ${folderPath.trim()}`,
          code: "",
          model: selectedModel,
        });
        return;
      }

      const text = await res.text();
      setScanError(`Unexpected response: ${text.slice(0, 200)}`);
      setPhase("input");
    } catch (err) {
      if (folderAbort.isAborted(err)) {
        setPhase(fallbackContent ? "fallback" : "input");
        return;
      }
      setScanError(`Connection failed: ${err.message}`);
      setPhase("input");
    } finally {
      folderAbort.clearAbortable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderPath, selectedModel, isLoading, folderAbort, fallbackContent]);

  // ── Render: Loading ───────────────────────────────
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center gap-4">
        <LoadingAnimation filename={filename} />
        <StopButton onClick={handleStop} label="Stop Scan" />
      </div>
    );
  }

  // ── Render: Security Report ───────────────────────
  if (phase === "report" && reportData) {
    return (
      <section
        className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
        aria-label="Security scan report"
      >
        {savedPentest && (
          <div className="max-w-3xl mx-auto mb-3 flex items-center gap-2 text-xs text-slate-500">
            <History className="w-3.5 h-3.5" />
            <span>Saved scan</span>
          </div>
        )}
        <SecurityReport
          data={reportData}
          filename={filename}
          onDeepDive={handleDeepDive}
          onNewScan={handleNewScan}
          onToast={onToast}
          onRemediate={handleRemediate}
          remediating={remediating}
          remediationProgress={remediationProgress}
        />
      </section>
    );
  }

  // ── Fallback follow-up conversation ─────────────────
  async function handleFallbackFollowUp() {
    if (!fallbackInput.trim() || fallbackStreaming || !selectedModel) return;

    const userMsg = { role: "user", content: fallbackInput.trim() };
    const updatedMessages = [...fallbackMessages, userMsg];
    setFallbackMessages(updatedMessages);
    setFallbackInput("");
    setFallbackStreaming(true);

    // Build chat history: system context + initial report + follow-ups
    const chatMessages = [
      {
        role: "system",
        content:
          "You are a senior security engineer helping a developer understand OWASP security findings in depth. The user has just received a security assessment and wants to discuss the findings. Explain clearly, use analogies when helpful, and suggest specific fixes with code examples.",
      },
      { role: "assistant", content: fallbackContent },
      ...updatedMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

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
              setFallbackMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
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

      // Final update
      setFallbackMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = {
            role: "assistant",
            content: assistantContent,
          };
        } else {
          updated.push({ role: "assistant", content: assistantContent });
        }
        return updated;
      });
    } catch (err) {
      setFallbackMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Connection failed: ${err.message}` },
      ]);
    } finally {
      setFallbackStreaming(false);
      setTimeout(
        () => fallbackEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    }
  }

  // ── Fallback export helpers ──────────────────────────
  async function handleFallbackCopy() {
    await copyText(fallbackContent);
    onToast?.("Report copied to clipboard");
  }

  function fallbackDownload(content, ext, mime) {
    const name = filename
      ? filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_")
      : "security-scan";
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}-security-report.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function buildFallbackHTML() {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Security Report${filename ? " — " + filename : ""}</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;background:#0c0f1a;color:#e2e8f0}
h1,h2,h3{color:#f97316}pre{background:#1e293b;padding:1rem;border-radius:8px;overflow-x:auto}
code{font-family:monospace}blockquote{border-left:3px solid #10b981;padding-left:1rem;color:#6ee7b7}
li{margin:2px 0}strong{color:#f1f5f9}</style></head>
<body><h1>Security Scan Report</h1>${filename ? "<p><strong>Target:</strong> " + filename + "</p>" : ""}
${fallbackContent
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/^### (.+)$/gm, "<h3>$1</h3>")
  .replace(/^## (.+)$/gm, "<h2>$1</h2>")
  .replace(/^# (.+)$/gm, "<h1>$1</h1>")
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/^- (.+)$/gm, "<li>$1</li>")
  .replace(/\n\n/g, "<br/><br/>")}</body></html>`;
  }

  function handleFallbackHTML() {
    fallbackDownload(buildFallbackHTML(), "html", "text/html");
  }

  function handleFallbackPDF() {
    const html = buildFallbackHTML();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.onload = () => {
        try {
          win.print();
        } catch (_) {}
        URL.revokeObjectURL(url);
      };
      onToast?.('Print dialog opened — choose "Save as PDF" to download a PDF');
    } else {
      URL.revokeObjectURL(url);
      fallbackDownload(html, "html", "text/html");
      onToast?.(
        "Popup blocked — HTML downloaded. Open it and use Print → Save as PDF",
      );
    }
  }

  // ── Remediation handler (works for both structured + fallback) ──
  async function handleRemediate() {
    const hasCode = code.trim() && !code.startsWith("Scanned ");
    const hasFallback = !!fallbackContent.trim();
    const hasReport = !!reportData;
    if (
      remediating ||
      !selectedModel ||
      (!hasCode && !hasFallback && !hasReport)
    )
      return;
    setRemediating(true);
    setRemediationProgress("Generating remediated code...");

    // Build findings summary from either structured report or fallback
    let findingsText = "";
    if (reportData) {
      const catMeta = {
        accessControl: "Access Control",
        dataProtection: "Data Protection",
        injection: "Injection & Input",
        authAndSession: "Auth & Sessions",
        configuration: "Configuration",
        apiSecurity: "API Security",
      };
      for (const [key, cat] of Object.entries(reportData.categories || {})) {
        if (!cat.vulnerabilities?.length) continue;
        findingsText += `\n## ${catMeta[key] || key} (Grade: ${cat.grade})\n`;
        for (const v of cat.vulnerabilities) {
          findingsText += `- **${v.title}** (${v.severity}): ${v.description}`;
          if (v.remediation) findingsText += ` Fix: ${v.remediation}`;
          findingsText += "\n";
        }
      }
    } else if (fallbackContent) {
      findingsText = fallbackContent;
    }

    // Use actual code if available, otherwise ask AI to generate fixes based on findings
    const codeToSend = hasCode
      ? code.trim()
      : `(Original source code not available. Target: ${filename || "unknown"}. Generate recommended remediation code examples based on the security findings below.)`;

    try {
      const res = await apiFetch("/api/pentest/remediate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          code: codeToSend,
          filename: filename || "code",
          findings: findingsText,
        }),
      });

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
        setRemediationProgress(
          `Generating... (${(accumulated.length / 1024).toFixed(1)} KB)`,
        );
      }

      // Parse the AI response into report + files
      setRemediationProgress("Building zip...");
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Split on the REVISED_FILES marker
      const markerIdx = accumulated.indexOf("---REVISED_FILES---");
      let reportMd, filesSection;

      if (markerIdx >= 0) {
        reportMd = accumulated.slice(0, markerIdx).trim();
        filesSection = accumulated.slice(markerIdx);
      } else {
        // No marker — treat the entire response as the report
        reportMd = accumulated;
        filesSection = "";
      }

      // Add remediation report
      zip.file("REMEDIATION-REPORT.md", reportMd);

      // Add original code
      const isMultiFile = code.includes("── File: ");
      if (isMultiFile) {
        // Multi-file: parse and add each original file
        const origFolder = zip.folder("original");
        const fileBlocks = code.split(/── File: /);
        for (const block of fileBlocks) {
          if (!block.trim()) continue;
          const nlIdx = block.indexOf("\n");
          const fpath = block.slice(0, nlIdx).replace(/ ──$/, "").trim();
          const content = block.slice(nlIdx + 1).trim();
          if (fpath) origFolder.file(fpath, content);
        }
      } else {
        zip.folder("original").file(filename || "code.txt", code);
      }

      // Parse revised files from the AI response
      const fileRegex = /---FILE:\s*(.+?)---\n([\s\S]*?)---END_FILE---/g;
      let match;
      const remediatedFolder = zip.folder("remediated");
      let fileCount = 0;

      while ((match = fileRegex.exec(filesSection)) !== null) {
        const fpath = match[1].trim();
        const content = match[2].trim();
        remediatedFolder.file(fpath, content);
        fileCount++;
      }

      // If no files were parsed with markers, try to extract code blocks
      if (fileCount === 0 && filesSection) {
        const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
        let cbMatch;
        let cbIdx = 0;
        while ((cbMatch = codeBlockRegex.exec(accumulated)) !== null) {
          cbIdx++;
          remediatedFolder.file(
            filename || `fixed-${cbIdx}.txt`,
            cbMatch[1].trim(),
          );
        }
      }

      // Generate and download
      const blob = await zip.generateAsync({ type: "blob" });
      const name = filename
        ? filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_")
        : "security-remediation";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}-remediation.zip`;
      a.click();
      URL.revokeObjectURL(url);

      onToast?.(
        `Remediation package downloaded (${fileCount || "check"} fixed file${fileCount !== 1 ? "s" : ""})`,
      );
    } catch (err) {
      onToast?.(`Remediation failed: ${err.message}`);
    } finally {
      setRemediating(false);
      setRemediationProgress("");
    }
  }

  // ── Render: Fallback (streaming markdown) ─────────
  if (phase === "fallback") {
    return (
      <section
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
        aria-label="Security scan (conversation mode)"
      >
        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="glass rounded-xl border border-amber-500/20 p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-amber-300">
                Structured report unavailable -- showing analysis as
                conversation
              </p>
            </div>

            {/* Target path */}
            {filename && (
              <div className="glass rounded-xl border border-slate-700/30 px-4 py-2 flex items-center gap-2">
                {filename.includes("files") ||
                filename.toLowerCase().includes("folder") ? (
                  <FolderOpen className="w-4 h-4 text-orange-400 shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                )}
                <p className="text-sm text-slate-300 font-mono break-all">
                  {filename}
                </p>
              </div>
            )}

            <div className="glass rounded-xl border border-slate-700/30 p-4">
              {fallbackContent ? (
                <MarkdownContent content={fallbackContent} />
              ) : (
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                  <span className="text-sm">
                    Scanning for vulnerabilities...
                  </span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {fallbackContent && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleFallbackCopy}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
                <button
                  onClick={() =>
                    fallbackDownload(fallbackContent, "md", "text/markdown")
                  }
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> .md
                </button>
                <button
                  onClick={handleFallbackHTML}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> .html
                </button>
                <button
                  onClick={handleFallbackPDF}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  onClick={handleRemediate}
                  disabled={remediating || !connected}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Wrench className="w-3.5 h-3.5" />{" "}
                  {remediating
                    ? remediationProgress || "Remediating..."
                    : "Remediate"}
                </button>
                <button
                  onClick={handleNewScan}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/40 transition-colors cursor-pointer"
                >
                  New Scan
                </button>
              </div>
            )}

            {!fallbackContent && (
              <div className="flex gap-2">
                <button
                  onClick={handleNewScan}
                  className="text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/40 transition-colors cursor-pointer"
                >
                  New Scan
                </button>
              </div>
            )}

            {/* Follow-up messages */}
            {fallbackMessages.length > 0 && (
              <div className="space-y-3 border-t border-slate-700/30 pt-4">
                {fallbackMessages.map((msg, i) => (
                  <MessageBubble
                    key={i}
                    role={msg.role}
                    content={msg.content}
                    streaming={
                      fallbackStreaming &&
                      i === fallbackMessages.length - 1 &&
                      msg.role === "assistant"
                    }
                  />
                ))}
                {fallbackStreaming &&
                  (fallbackMessages.length === 0 ||
                    fallbackMessages[fallbackMessages.length - 1]?.role !==
                      "assistant") && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                      <div className="flex gap-1">
                        <span
                          className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <span
                          className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <span
                          className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                      <span>Thinking...</span>
                    </div>
                  )}
              </div>
            )}

            <div ref={fallbackEndRef} />
          </div>
        </div>

        {/* Follow-up input */}
        {fallbackContent && (
          <div className="glass-heavy border-t border-slate-700/30 p-4">
            <div className="max-w-3xl mx-auto flex gap-2">
              <textarea
                value={fallbackInput}
                onChange={(e) => setFallbackInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleFallbackFollowUp();
                  }
                }}
                placeholder="Ask a follow-up question about the security findings..."
                rows={2}
                disabled={fallbackStreaming || !connected}
                className="flex-1 input-glow text-slate-100 font-mono text-sm rounded-xl px-4 py-3 resize-none placeholder-slate-500 disabled:opacity-50"
              />
              <button
                onClick={handleFallbackFollowUp}
                disabled={
                  !fallbackInput.trim() || fallbackStreaming || !connected
                }
                className="btn-neon text-white rounded-xl px-4 font-medium transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-600 disabled:shadow-none disabled:cursor-not-allowed min-w-[60px] cursor-pointer"
              >
                {fallbackStreaming ? "..." : "Ask"}
              </button>
            </div>
          </div>
        )}
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
        <div className="glass border-b border-slate-700/30 px-4 py-2 flex items-center gap-3">
          <button
            onClick={handleBackToReport}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-700/40 transition-colors cursor-pointer"
          >
            ← Back to Report
          </button>
          <span className="text-xs text-slate-500">Security Deep Dive</span>
        </div>

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

        <div className="glass-heavy border-t border-slate-700/30 p-4">
          <div className="flex gap-2">
            <label htmlFor="pentest-deep-dive-input" className="sr-only">
              Ask a follow-up question
            </label>
            <textarea
              id="pentest-deep-dive-input"
              ref={deepDiveInputRef}
              value={deepDiveInput}
              onChange={(e) => setDeepDiveInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleDeepDiveFollowUp();
                }
              }}
              placeholder="Ask a follow-up question about this security finding..."
              rows={2}
              disabled={deepDiveStreaming || !connected}
              className="flex-1 input-glow text-slate-100 font-mono text-sm rounded-xl px-4 py-3 resize-none placeholder-slate-500 disabled:opacity-50"
            />
            <button
              onClick={handleDeepDiveFollowUp}
              disabled={
                !deepDiveInput.trim() || deepDiveStreaming || !connected
              }
              className="btn-neon text-white rounded-xl px-4 font-medium transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-600 disabled:shadow-none disabled:cursor-not-allowed min-w-[60px] cursor-pointer"
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
      aria-label="Security scan input"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center space-y-2 py-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
            Security Scan
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Submit code for an OWASP security assessment. You'll get a
            structured report with grades across 6 security categories and
            actionable fix prompts.
          </p>
        </div>

        {/* Error */}
        {scanError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
            <span className="text-red-400 shrink-0">✕</span>
            <p className="text-sm text-red-300">{scanError}</p>
          </div>
        )}

        {/* Drag overlay */}
        {dragging && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-base/80 border-2 border-dashed border-orange-500 rounded-2xl m-2 pointer-events-none">
            <div className="text-center">
              <div className="text-4xl mb-2">🛡️</div>
              <p className="text-orange-300 font-medium neon-text">
                Drop a file or folder to scan
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
                  `flex items-center gap-2 px-4 py-2 text-sm transition-colors cursor-pointer ${
                    selected
                      ? "border-b-2 border-orange-500 text-white -mb-px"
                      : "text-slate-400 hover:text-slate-300"
                  }`
                }
              >
                <FileText className="w-4 h-4" />
                Paste Code
              </Tab>
              <Tab
                className={({ selected }) =>
                  `flex items-center gap-2 px-4 py-2 text-sm transition-colors cursor-pointer ${
                    selected
                      ? "border-b-2 border-orange-500 text-white -mb-px"
                      : "text-slate-400 hover:text-slate-300"
                  }`
                }
              >
                <UploadIcon className="w-4 h-4" />
                Upload File
              </Tab>
              <Tab
                className={({ selected }) =>
                  `flex items-center gap-2 px-4 py-2 text-sm transition-colors cursor-pointer ${
                    selected
                      ? "border-b-2 border-orange-500 text-white -mb-px"
                      : "text-slate-400 hover:text-slate-300"
                  }`
                }
              >
                <FolderOpen className="w-4 h-4" />
                Browse Files
              </Tab>
              <Tab
                className={({ selected }) =>
                  `flex items-center gap-2 px-4 py-2 text-sm transition-colors cursor-pointer ${
                    selected
                      ? "border-b-2 border-orange-500 text-white -mb-px"
                      : "text-slate-400 hover:text-slate-300"
                  }`
                }
              >
                <FolderSearch className="w-4 h-4" />
                Scan Folder
              </Tab>
            </Tab.List>

            <Tab.Panels>
              {/* Paste Code Panel */}
              <Tab.Panel className="space-y-3">
                <div>
                  <label
                    htmlFor="pentest-filename"
                    className="text-xs text-slate-400 block mb-1"
                  >
                    Filename{" "}
                    <span className="text-slate-600">
                      (optional -- helps the AI understand context)
                    </span>
                  </label>
                  <input
                    id="pentest-filename"
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder="e.g. server.js, utils/auth.py"
                    className="w-full input-glow text-slate-200 text-sm rounded-lg px-3 py-2 placeholder-slate-500 font-mono"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pentest-code"
                    className="text-xs text-slate-400 block mb-1"
                  >
                    Code to scan
                  </label>
                  <textarea
                    id="pentest-code"
                    ref={textareaRef}
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      if (!filename) setFilename("");
                    }}
                    placeholder="Paste your code here for OWASP security analysis..."
                    rows={16}
                    className="w-full input-glow text-slate-100 font-mono text-sm rounded-xl px-4 py-3 resize-y placeholder-slate-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCode("");
                      setFilename("");
                    }}
                    title="Clear code input"
                    disabled={!code}
                    className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-500/10 transition-colors border border-slate-700/30 hover:border-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Clear
                  </button>
                  <DictateButton
                    onResult={handleDictation}
                    disabled={!connected}
                    className="!w-auto !h-auto text-xs px-2.5 py-1.5 !rounded-lg border border-slate-700/30 hover:border-indigo-500/30"
                  />
                </div>
              </Tab.Panel>

              {/* Upload File Panel */}
              <Tab.Panel>
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    dragging
                      ? "border-orange-500 bg-orange-500/10"
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
                    multiple
                    accept=".js,.jsx,.ts,.tsx,.py,.json,.md,.txt,.html,.css,.yaml,.yml,.sh,.sql,.go,.rs,.java,.c,.cpp,.h,.toml,.xml,.csv,.env,.svelte,.vue,.rb,.php,.swift,.kt,.dart,.zig,.ex,.exs,.erl,.hs,.ml,.clj,.scala,.r,.lua,.pl,.ps1,image/*,.png,.jpg,.jpeg,.gif,.pdf,.pptx,.docx,.xlsx,.xls,.doc,.ppt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <UploadIcon className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-300 mb-2">
                    Drag and drop files or a folder, or click to browse
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors cursor-pointer"
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
                    className="text-sm px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors cursor-pointer"
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

              {/* Scan Folder Panel */}
              <Tab.Panel className="space-y-4">
                <div>
                  <label
                    htmlFor="pentest-folder"
                    className="text-xs text-slate-400 block mb-1"
                  >
                    Folder path{" "}
                    <span className="text-slate-600">
                      (scans all code files recursively)
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="pentest-folder"
                      type="text"
                      value={folderPath}
                      onChange={(e) => {
                        setFolderPath(e.target.value);
                        setFolderPreview(null);
                        setFolderError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleFolderPreview();
                      }}
                      placeholder="/Users/you/project"
                      className="flex-1 input-glow text-slate-200 text-sm rounded-lg px-3 py-2 placeholder-slate-500 font-mono"
                    />
                    <button
                      onClick={handleFolderPreview}
                      disabled={!folderPath.trim() || folderLoading}
                      className="text-sm px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                    >
                      {folderLoading ? "Scanning..." : "Preview"}
                    </button>
                  </div>
                </div>

                {folderError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-sm text-red-300">
                    {folderError}
                  </div>
                )}

                {folderPreview && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-emerald-400 font-medium">
                        {folderPreview.files.length} files
                      </span>
                      <span className="text-slate-500">|</span>
                      <span className="text-slate-400">
                        {(folderPreview.totalSize / 1024).toFixed(1)} KB
                      </span>
                      {folderPreview.skipped > 0 && (
                        <>
                          <span className="text-slate-500">|</span>
                          <span className="text-amber-400">
                            {folderPreview.skipped} skipped (too large)
                          </span>
                        </>
                      )}
                    </div>
                    <div className="max-h-48 overflow-y-auto scrollbar-thin bg-slate-900/50 rounded-lg border border-slate-700/30 p-2">
                      {folderPreview.files.map((f, i) => (
                        <div
                          key={i}
                          className="flex justify-between text-xs py-0.5 px-1 hover:bg-slate-700/20 rounded"
                        >
                          <span className="text-slate-300 font-mono truncate">
                            {f.path}
                          </span>
                          <span className="text-slate-500 shrink-0 ml-2">
                            {(f.size / 1024).toFixed(1)}K
                          </span>
                        </div>
                      ))}
                    </div>
                    {isLoading ? (
                      <StopButton
                        onClick={handleStop}
                        label="Stop Scan"
                        className="w-full py-3 text-sm"
                      />
                    ) : (
                      <button
                        onClick={handleSubmitFolderScan}
                        disabled={!selectedModel || !connected}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl px-6 py-3 font-medium text-sm transition-colors disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-orange-500/20"
                      >
                        {!connected
                          ? "Connect to Ollama First"
                          : !selectedModel
                            ? "Select a Model"
                            : `Scan ${folderPreview.files.length} Files for Vulnerabilities`}
                      </button>
                    )}
                  </div>
                )}

                {!folderPreview && !folderError && (
                  <div className="text-center py-6">
                    <FolderSearch className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">
                      Enter a folder path and click Preview to see which files
                      will be scanned
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Scans .js, .py, .go, .rs, .java, .ts, .html, .sql, and 30+
                      file types
                    </p>
                  </div>
                )}
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </div>

        {/* Phase 9.2: Attached Images Display */}
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
          <div className="glass rounded-xl border border-orange-500/30 p-3 flex items-center gap-2 text-xs text-orange-300">
            <span className="inline-block animate-spin">&#x27F3;</span>
            <span>Converting {convertingDoc}...</span>
          </div>
        )}

        {/* Phase 9.2: Processing Indicator */}
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
                  ? "This model is very small and will likely struggle with security analysis. You may get a conversational fallback instead of a structured report."
                  : "Smaller models may miss vulnerabilities or produce less accurate severity ratings. Security analysis needs strong reasoning."}
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

        {/* Loaded target indicator */}
        {filename && code.trim() && (
          <div className="glass rounded-xl border border-slate-700/30 px-4 py-3 flex items-center gap-2">
            {filename.includes("files") ||
            filename.toLowerCase().includes("folder") ? (
              <FolderOpen className="w-4 h-4 text-orange-400 shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500">Scanning</p>
              <p className="text-sm text-slate-200 font-mono break-all">
                {filename}
              </p>
            </div>
            <span className="text-xs text-slate-500 shrink-0">
              {(code.length / 1024).toFixed(1)} KB
            </span>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-center">
          {isLoading || phase === "fallback" ? (
            <StopButton
              onClick={handleStop}
              label="Stop Scan"
              className="px-8 py-3 text-base"
            />
          ) : (
            <button
              onClick={handleSubmitScan}
              disabled={!code.trim() || !selectedModel || !connected}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl px-8 py-3 font-medium text-base transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:from-slate-700 disabled:to-slate-700 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-orange-500/20"
            >
              {!connected
                ? "Connect to Ollama First"
                : !selectedModel
                  ? "Select a Model"
                  : "Scan for Vulnerabilities"}
            </button>
          )}
        </div>

        {/* Tips */}
        <div className="glass rounded-xl border border-slate-700/20 p-4 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-400">Tips for best results:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>
              Use <strong>Scan Folder</strong> to evaluate an entire project
              with subfolders
            </li>
            <li>
              Single-file scans give more focused analysis — folder scans give
              broader coverage
            </li>
            <li>
              Include the filename so the AI understands the file type and
              context
            </li>
            <li>
              Larger models (13B+) produce more accurate OWASP vulnerability
              assessments
            </li>
            <li>
              Use Deep Dive on any category to get detailed remediation guidance
            </li>
          </ul>
        </div>
      </div>

      {/* Phase 9.2: Image Lightbox */}
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
