import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { marked, Renderer } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import 'highlight.js/styles/github-dark.min.css';
import { highlightJargon, GLOSSARY } from './JargonGlossary';
import MermaidBlock from './MermaidBlock';

// ── Mermaid sentinel pattern ─────────────────────────
const MERMAID_SENTINEL_RE = /<div data-mermaid-source="([^"]*)" class="mermaid-placeholder"><\/div>/g;

function renderMarkdown(text, enableJargon, streaming) {
  if (!text) return '';
  try {
    const renderer = new Renderer();
    const originalCode = renderer.code.bind(renderer);

    renderer.code = function({ text: codeText, lang, escaped }) {
      if (lang === 'mermaid' && !streaming) {
        const encoded = btoa(unescape(encodeURIComponent(codeText)));
        return `<div data-mermaid-source="${encoded}" class="mermaid-placeholder"></div>`;
      }
      return originalCode({ text: codeText, lang, escaped });
    };

    const raw = marked.parse(text, { breaks: true, renderer });
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

function getLanguageFromClass(codeEl) {
  const cls = codeEl.className || '';
  const match = cls.match(/language-(\w+)/);
  return match ? match[1] : '';
}

function getFileExtension(lang) {
  const map = {
    javascript: 'js', typescript: 'ts', python: 'py', ruby: 'rb',
    java: 'java', go: 'go', rust: 'rs', c: 'c', cpp: 'cpp',
    csharp: 'cs', php: 'php', swift: 'swift', kotlin: 'kt',
    html: 'html', css: 'css', json: 'json', yaml: 'yml',
    xml: 'xml', sql: 'sql', bash: 'sh', shell: 'sh',
    markdown: 'md', jsx: 'jsx', tsx: 'tsx', vue: 'vue',
    svelte: 'svelte', dart: 'dart', lua: 'lua', r: 'r',
  };
  return map[lang] || lang || 'txt';
}

function copyToClipboard(text, btn) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    }).catch(() => {
      fallbackCopy(text, btn);
    });
  } else {
    fallbackCopy(text, btn);
  }
}

function fallbackCopy(text, btn) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  } catch {
    btn.textContent = 'Failed';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  }
  document.body.removeChild(ta);
}

function addCodeBlockButtons(container) {
  container.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('.code-actions')) return;

    const code = pre.querySelector('code');
    if (!code) return;

    pre.style.position = 'relative';
    pre.style.paddingTop = '32px';
    pre.style.paddingRight = '12px';

    const lang = code.dataset.originalLang || getLanguageFromClass(code);
    const ext = getFileExtension(lang);

    const toolbar = document.createElement('div');
    toolbar.className = 'code-actions';
    toolbar.style.cssText = 'position:absolute;top:6px;right:6px;display:flex;gap:4px;opacity:1;z-index:10;';

    if (lang) {
      const label = document.createElement('span');
      label.textContent = lang;
      label.style.cssText = 'font-size:10px;color:#94a3b8;padding:2px 6px;border-radius:4px;background:rgba(30,41,59,0.8);user-select:none;';
      toolbar.appendChild(label);
    }

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy';
    copyBtn.title = 'Copy code to clipboard';
    copyBtn.style.cssText = 'font-size:11px;color:#a5b4fc;padding:2px 8px;border-radius:4px;background:rgba(30,41,59,0.8);border:1px solid rgba(99,102,241,0.3);cursor:pointer;';
    copyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      copyToClipboard(code.textContent, copyBtn);
    });
    toolbar.appendChild(copyBtn);

    const dlBtn = document.createElement('button');
    dlBtn.textContent = 'Download';
    dlBtn.title = `Download as .${ext} file`;
    dlBtn.style.cssText = 'font-size:11px;color:#a5b4fc;padding:2px 8px;border-radius:4px;background:rgba(30,41,59,0.8);border:1px solid rgba(99,102,241,0.3);cursor:pointer;';
    dlBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const blob = new Blob([code.textContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `code.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    toolbar.appendChild(dlBtn);

    pre.appendChild(toolbar);
  });
}

function applyHighlightAndButtons(container) {
  if (!container) return;
  container.querySelectorAll('pre code').forEach(block => {
    const origLang = getLanguageFromClass(block);
    if (origLang) block.dataset.originalLang = origLang;
    hljs.highlightElement(block);
  });
  addCodeBlockButtons(container);
}

// ── Split HTML into segments around mermaid placeholders ──
function splitAtMermaid(html) {
  const segments = [];
  let lastIndex = 0;

  // Reset regex state
  MERMAID_SENTINEL_RE.lastIndex = 0;

  let match;
  while ((match = MERMAID_SENTINEL_RE.exec(html)) !== null) {
    // Add HTML before this mermaid block
    if (match.index > lastIndex) {
      segments.push({ type: 'html', content: html.slice(lastIndex, match.index) });
    }
    // Add mermaid source (base64 decoded)
    try {
      const decoded = decodeURIComponent(escape(atob(match[1])));
      segments.push({ type: 'mermaid', content: decoded });
    } catch {
      // If decode fails, keep as HTML
      segments.push({ type: 'html', content: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }

  // Add remaining HTML
  if (lastIndex < html.length) {
    segments.push({ type: 'html', content: html.slice(lastIndex) });
  }

  return segments;
}

// ── Component ────────────────────────────────────────

export default function MarkdownContent({ content, enableJargon = true, streaming = false }) {
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const dismissedAt = useRef(0);

  // Memoize the rendered HTML to avoid re-parsing on every render
  const html = useMemo(() => renderMarkdown(content, enableJargon, streaming), [content, enableJargon, streaming]);

  // Check if there are mermaid blocks
  const hasMermaid = html.includes('data-mermaid-source');
  const segments = useMemo(() => hasMermaid ? splitAtMermaid(html) : null, [html, hasMermaid]);

  // Apply hljs + code buttons to all HTML segments
  useEffect(() => {
    if (containerRef.current) {
      applyHighlightAndButtons(containerRef.current);
    }
  }, [html]);

  const handleMouseOver = useCallback((e) => {
    if (Date.now() - dismissedAt.current < 500) return;
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

  const dismissTooltip = useCallback(() => {
    dismissedAt.current = Date.now();
    setTooltip(null);
  }, []);

  return (
    <div onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
      <div ref={containerRef} className="prose">
        {segments ? (
          // Mixed content: HTML segments + MermaidBlock components
          segments.map((seg, i) =>
            seg.type === 'mermaid' ? (
              <MermaidBlock key={`m-${i}`} code={seg.content} />
            ) : (
              <div key={`h-${i}`} dangerouslySetInnerHTML={{ __html: seg.content }} />
            )
          )
        ) : (
          // Fast path: no mermaid blocks — single HTML render (same as before)
          <div dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
      {tooltip && (
        <div
          className="fixed z-50 glass-neon rounded-lg p-3 max-w-xs fade-in cursor-pointer"
          onClick={dismissTooltip}
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
