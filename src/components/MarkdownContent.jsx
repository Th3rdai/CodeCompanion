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

function addCodeBlockButtons(container) {
  container.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('.code-actions')) return;

    const code = pre.querySelector('code');
    if (!code) return;

    pre.style.position = 'relative';

    const lang = getLanguageFromClass(code);
    const ext = getFileExtension(lang);

    const toolbar = document.createElement('div');
    toolbar.className = 'code-actions';
    toolbar.style.cssText = 'position:absolute;top:6px;right:6px;display:flex;gap:4px;opacity:0;transition:opacity 0.15s;z-index:10;';

    // Language label
    if (lang) {
      const label = document.createElement('span');
      label.textContent = lang;
      label.style.cssText = 'font-size:10px;color:#94a3b8;padding:2px 6px;border-radius:4px;background:rgba(30,41,59,0.8);user-select:none;';
      toolbar.appendChild(label);
    }

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy';
    copyBtn.title = 'Copy code to clipboard';
    copyBtn.style.cssText = 'font-size:11px;color:#a5b4fc;padding:2px 8px;border-radius:4px;background:rgba(30,41,59,0.8);border:1px solid rgba(99,102,241,0.3);cursor:pointer;';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(code.textContent);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
    });
    toolbar.appendChild(copyBtn);

    // Download button
    const dlBtn = document.createElement('button');
    dlBtn.textContent = 'Download';
    dlBtn.title = `Download as .${ext} file`;
    dlBtn.style.cssText = 'font-size:11px;color:#a5b4fc;padding:2px 8px;border-radius:4px;background:rgba(30,41,59,0.8);border:1px solid rgba(99,102,241,0.3);cursor:pointer;';
    dlBtn.addEventListener('click', () => {
      const blob = new Blob([code.textContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `code.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    });
    toolbar.appendChild(dlBtn);

    pre.appendChild(toolbar);

    pre.addEventListener('mouseenter', () => { toolbar.style.opacity = '1'; });
    pre.addEventListener('mouseleave', () => { toolbar.style.opacity = '0'; });
  });
}

export default function MarkdownContent({ content, enableJargon = true }) {
  const ref = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
      addCodeBlockButtons(ref.current);
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
