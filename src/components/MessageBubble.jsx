import { useState } from 'react';
import MarkdownContent from './MarkdownContent';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-xs px-2.5 py-1.5 rounded-lg glass text-slate-400 hover:text-white transition-all hover:neon-glow-sm"
      aria-label="Copy response">
      {copied ? '✓ Copied' : '📋 Copy'}
    </button>
  );
}

export default function MessageBubble({ role, content, streaming, images, onImageClick }) {
  const isUser = role === 'user';
  const hasImages = images && images.length > 0;

  return (
    <div className={`fade-in mb-4 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'glass-neon border border-indigo-500/30'
          : 'glass border border-slate-700/30'
      }`}>
        {isUser ? (
          <>
            <pre className="font-mono text-sm whitespace-pre-wrap text-slate-200">{content}</pre>
            {hasImages && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                {images.map((imgBase64, idx) => {
                  // Reconstruct data URI for display (images stored as raw base64)
                  const src = imgBase64.startsWith('data:') ? imgBase64 : `data:image/jpeg;base64,${imgBase64}`;
                  return (
                    <img
                      key={idx}
                      src={src}
                      alt={`Uploaded image ${idx + 1}`}
                      className="rounded border border-indigo-500/30 cursor-pointer hover:opacity-80 transition-opacity max-h-48 object-cover"
                      onClick={() => onImageClick && onImageClick(imgBase64, `image-${idx + 1}`, images, idx)}
                    />
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="relative group">
            <MarkdownContent content={content} streaming={streaming} />
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
