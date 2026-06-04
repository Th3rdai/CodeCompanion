import { useState } from "react";
import { copyText } from "../lib/clipboard";
import ImageThumbnail from "../components/ImageThumbnail";

export function AttachedFiles({ files, onRemove, onImageClick }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {files.map((f, i) =>
        f.isImage || f.type === "image" ? (
          <ImageThumbnail
            key={i}
            src={f.thumbnail}
            filename={f.name}
            size={f.size}
            format={f.format}
            dimensions={f.dimensions}
            onRemove={() => onRemove(i)}
            onClick={() => onImageClick && onImageClick(i)}
          />
        ) : (
          <div
            key={i}
            className="flex items-center gap-1.5 bg-indigo-600/15 border border-indigo-500/30 rounded-lg px-2.5 py-1 text-xs"
          >
            <span className="text-indigo-400">📄</span>
            <span className="text-slate-300 max-w-[120px] truncate">
              {f.name}
            </span>
            <span className="text-slate-600">
              {f.lines ? `${f.lines}L` : ""}
            </span>
            <button
              onClick={() => onRemove(i)}
              className="text-slate-500 hover:text-red-400 ml-0.5"
              aria-label={`Remove ${f.name}`}
            >
              ✕
            </button>
          </div>
        ),
      )}
    </div>
  );
}

export function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        const ok = await copyText(text);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
      className="glass text-xs text-slate-400 hover:text-indigo-300 px-2 py-1 rounded-lg transition-colors"
      aria-label="Copy to clipboard"
    >
      {copied ? "✓ Copied" : "📋 Copy"}
    </button>
  );
}
