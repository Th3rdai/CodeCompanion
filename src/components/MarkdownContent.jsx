import { useRef, useEffect, useState, useCallback } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import 'highlight.js/styles/github-dark.min.css';
import { highlightJargon, GLOSSARY } from './JargonGlossary';

function renderMarkdown(text, enableJargon) {
  if (!text) return '';
  try {
    const raw = marked.parse(text, { breaks: true });
    let sanitized = DOMPurify.sanitize(raw, {
      USE_PROFILES: { html: true },
      ALLOW_DATA_ATTR: true,
    });
    if (enableJargon) {
      sanitized = highlightJargon(sanitized);
    }
    return sanitized;
  }
  catch { return text; }
}

export default function MarkdownContent({ content, enableJargon = true }) {
  const ref = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
    }
  }, [content]);

  const handleMouseOver = useCallback((e) => {
    const target = e.target;
    if (target.classList?.contains('jargon-term')) {
      const key = target.dataset.jargonKey;
      const entry = GLOSSARY[key];
      if (entry) {
        const rect = target.getBoundingClientRect();
        setTooltip({
          term: entry.term,
          definition: entry.definition,
          category: entry.category,
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
      }
    }
  }, []);

  const handleMouseOut = useCallback((e) => {
    if (e.target.classList?.contains('jargon-term')) {
      setTooltip(null);
    }
  }, []);

  return (
    <div onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
      <div ref={ref} className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(content, enableJargon) }} />
      {tooltip && (
        <div
          className="fixed z-50 glass-neon rounded-lg p-3 max-w-xs fade-in pointer-events-none"
          style={{
            left: Math.min(Math.max(tooltip.x, 140), window.innerWidth - 140),
            top: Math.max(tooltip.y - 8, 8),
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-indigo-300">{tooltip.term}</span>
            <span className="text-[9px] text-slate-600 px-1 py-0.5 rounded glass">{tooltip.category}</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">{tooltip.definition}</p>
        </div>
      )}
    </div>
  );
}
