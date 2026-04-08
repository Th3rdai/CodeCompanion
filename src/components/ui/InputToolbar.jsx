import { useRef } from "react";
import { copyText, readText } from "../../lib/clipboard";
import ExportPanel from "../ExportPanel";
import DictateButton from "../DictateButton";

const btnClass =
  "text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40";

/**
 * Reusable toolbar with Upload, Paste, Copy Response, Markdown, Export, Clear, Dictate.
 *
 * Props:
 *  - textareaRef: ref to the active textarea (for paste/dictate/clear)
 *  - getText: () => string — get current input text (for clear detection)
 *  - setText: (string) => void — set input text (for paste/dictate)
 *  - messages: array of {role, content} — for copy response / export / markdown
 *  - mode: string — current mode label for export
 *  - onToast: (msg) => void — toast notification
 *  - onFileUpload: (e) => void — file input change handler (optional, hides Upload if missing)
 *  - onClear: () => void — clear handler (optional, hides Clear if missing)
 *  - fileAccept: string — file input accept attribute
 *  - connected: boolean — for dictate disabled state
 *  - streaming: boolean — for dictate disabled state
 *  - hideButtons: string[] — list of button names to hide, e.g. ['upload', 'export']
 */
export default function InputToolbar({
  textareaRef,
  getText: _getText,
  setText,
  messages = [],
  mode = "",
  onToast,
  onFileUpload,
  onClear,
  fileAccept,
  connected = true,
  streaming = false,
  hideButtons = [],
}) {
  const fileRef = useRef(null);
  const hidden = new Set(hideButtons.map((b) => b.toLowerCase()));

  function handlePaste() {
    // Try programmatic clipboard read first
    readText().then((text) => {
      if (text && text.length > 5 && !/^[A-Z]=>/.test(text)) {
        // Got valid text from clipboard API
        if (setText)
          setText((prev) => (typeof prev === "function" ? prev : prev + text));
        textareaRef?.current?.focus();
        onToast?.("Pasted from clipboard");
      } else {
        // Clipboard API failed or returned garbage — trigger native paste
        textareaRef?.current?.focus();
        const pasted = document.execCommand("paste");
        if (!pasted) {
          onToast?.("Click in the text area, then press Cmd+V to paste");
        }
      }
    });
  }

  function handleCopyLastResponse() {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (last?.content) {
      copyText(last.content);
      onToast?.("Response copied to clipboard");
    } else {
      onToast?.("No AI response to copy");
    }
  }

  function handleDownloadMarkdown() {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last?.content) {
      onToast?.("No AI response to download");
      return;
    }
    const blob = new Blob([last.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `response-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onToast?.("Markdown downloaded");
  }

  function handleDictation(text) {
    if (setText && text) {
      setText((prev) => (prev || "") + text);
      textareaRef?.current?.focus();
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {onFileUpload && !hidden.has("upload") && (
        <>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            accept={
              fileAccept ||
              ".js,.jsx,.ts,.tsx,.py,.json,.md,.txt,.html,.css,.yaml,.yml,.sh,.sql,.go,.rs,.java,.c,.cpp,.h,.toml,.xml,.csv"
            }
            onChange={onFileUpload}
          />
          <button
            onClick={() => fileRef.current?.click()}
            title="Upload files"
            className={btnClass}
          >
            📎 Upload
          </button>
        </>
      )}
      {!hidden.has("paste") && (
        <button
          onClick={handlePaste}
          title="Paste text from clipboard"
          className={btnClass}
        >
          📋 Paste
        </button>
      )}
      {!hidden.has("copy") && (
        <button
          onClick={handleCopyLastResponse}
          title="Copy last AI response"
          className={btnClass}
        >
          📑 Copy Response
        </button>
      )}
      {!hidden.has("markdown") && (
        <button
          onClick={handleDownloadMarkdown}
          title="Download response as Markdown"
          className={btnClass}
        >
          📝 Markdown
        </button>
      )}
      {!hidden.has("export") && (
        <ExportPanel messages={messages} mode={mode} showToast={onToast} />
      )}
      {onClear && !hidden.has("clear") && (
        <button onClick={onClear} title="Clear input" className={btnClass}>
          🧹 Clear
        </button>
      )}
      {!hidden.has("dictate") && (
        <DictateButton
          onResult={handleDictation}
          disabled={!connected || streaming}
        />
      )}
    </div>
  );
}
