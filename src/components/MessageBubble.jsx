import { useState } from "react";
import { copyText } from "../lib/clipboard";
import MarkdownContent from "./MarkdownContent";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        const ok = await copyText(text);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }}
      className="text-xs px-2.5 py-1.5 rounded-lg glass text-slate-400 hover:text-white transition-all hover:neon-glow-sm"
      aria-label="Copy response"
    >
      {copied ? "✓ Copied" : "📋 Copy"}
    </button>
  );
}

function ImageActionButtons({ src, filename }) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const downloadImage = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = filename;
    a.click();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 1500);
  };

  const copyImage = async () => {
    try {
      const ClipboardItemCtor =
        (typeof window !== "undefined" && window.ClipboardItem) ||
        globalThis.ClipboardItem;
      if (navigator.clipboard?.write && ClipboardItemCtor) {
        const res = await fetch(src);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItemCtor({ [blob.type || "image/png"]: blob }),
        ]);
      } else {
        await copyText(src);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback to copying the image data URI when binary clipboard is unavailable.
      const ok = await copyText(src);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    }
  };

  return (
    <div className="mt-1.5 flex gap-2">
      <button
        onClick={copyImage}
        className="text-[11px] px-2 py-1 rounded-md glass text-slate-300 hover:text-white transition-colors"
        aria-label={`Copy ${filename}`}
      >
        {copied ? "✓ Copied" : "📋 Copy"}
      </button>
      <button
        onClick={downloadImage}
        className="text-[11px] px-2 py-1 rounded-md glass text-slate-300 hover:text-white transition-colors"
        aria-label={`Download ${filename}`}
      >
        {downloaded ? "✓ Downloaded" : "⬇ Download"}
      </button>
    </div>
  );
}

export default function MessageBubble({
  role,
  content,
  streaming,
  images,
  onImageClick,
}) {
  const isUser = role === "user";
  const hasImages = images && images.length > 0;
  const renderImages = () =>
    hasImages && (
      <div className="grid grid-cols-2 gap-2 mt-3">
        {images.map((imgBase64, idx) => {
          // Reconstruct data URI for display (images may be raw base64 or full data URI).
          const src = imgBase64.startsWith("data:")
            ? imgBase64
            : `data:image/jpeg;base64,${imgBase64}`;
          const filename = `${isUser ? "uploaded" : "generated"}-image-${idx + 1}.png`;
          return (
            <div key={idx}>
              <img
                src={src}
                alt={`${isUser ? "Uploaded" : "Generated"} image ${idx + 1}`}
                className="rounded border border-indigo-500/30 cursor-pointer hover:opacity-80 transition-opacity max-h-48 object-cover"
                onClick={() =>
                  onImageClick && onImageClick(imgBase64, filename, images, idx)
                }
              />
              <ImageActionButtons src={src} filename={filename} />
            </div>
          );
        })}
      </div>
    );

  return (
    <div
      className={`fade-in mb-4 flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "glass-neon border border-indigo-500/30"
            : "glass border border-slate-700/30"
        }`}
      >
        {isUser ? (
          <>
            <pre className="font-mono text-sm whitespace-pre-wrap text-slate-200">
              {content}
            </pre>
            {renderImages()}
          </>
        ) : (
          <div className="relative group">
            <MarkdownContent content={content} streaming={streaming} />
            {renderImages()}
            {!streaming && (
              <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <CopyButton text={content} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
