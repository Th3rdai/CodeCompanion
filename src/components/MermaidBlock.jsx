import { useState, useEffect, useRef, useCallback } from 'react';

// ── Lazy loader (singleton) ──────────────────────────
let mermaidPromise = null;
let mermaidCounter = 0;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(m => {
      m.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#6366f1',
          primaryTextColor: '#e2e8f0',
          primaryBorderColor: '#4f46e5',
          lineColor: '#94a3b8',
          secondaryColor: '#1e2440',
          tertiaryColor: '#0c0f1a',
          background: '#141829',
          mainBkg: '#1e2440',
          nodeBorder: '#6366f1',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '14px',
        },
      });
      return m.default;
    });
  }
  return mermaidPromise;
}

// ── Export helpers ────────────────────────────────────

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportSvg(svgHtml) {
  const blob = new Blob([svgHtml], { type: 'image/svg+xml' });
  downloadBlob(blob, 'diagram.svg');
}

function exportPng(svgHtml) {
  const svgBlob = new Blob([svgHtml], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const scale = 2; // retina quality
    canvas.width = img.naturalWidth * scale;
    canvas.height = img.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob(blob => {
      if (blob) downloadBlob(blob, 'diagram.png');
      URL.revokeObjectURL(url);
    }, 'image/png');
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

// ── MermaidBlock Component ───────────────────────────

export default function MermaidBlock({ code }) {
  const [svg, setSvg] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copyLabel, setCopyLabel] = useState('Source');
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-${++mermaidCounter}`;

    setLoading(true);
    setError(null);
    setSvg(null);

    loadMermaid()
      .then(mermaid => mermaid.render(id, code))
      .then(result => {
        if (!cancelled) {
          setSvg(result.svg);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || 'Failed to render diagram');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [code]);

  const handleCopySource = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Source'), 1500);
    }).catch(() => {
      setCopyLabel('Failed');
      setTimeout(() => setCopyLabel('Source'), 1500);
    });
  }, [code]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="mermaid-container flex items-center justify-center py-8">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <div className="flex gap-1">
            <span className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
          <span>Rendering diagram...</span>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="mermaid-container">
        <div className="mermaid-error">Diagram error: {error}</div>
        <pre style={{ background: '#0c0f1a', border: '1px solid rgba(99,102,241,0.15)', padding: '1rem', overflow: 'auto', margin: 0, textAlign: 'left' }}>
          <code className="text-sm text-slate-300" style={{ whiteSpace: 'pre-wrap' }}>{code}</code>
        </pre>
      </div>
    );
  }

  // ── Success state ──
  const btnStyle = 'font-size:11px;color:#a5b4fc;padding:2px 8px;border-radius:4px;background:rgba(30,41,59,0.8);border:1px solid rgba(99,102,241,0.3);cursor:pointer;';

  return (
    <div className="mermaid-container" ref={containerRef}>
      {/* Toolbar */}
      <div style={{ position: 'absolute', top: '6px', right: '6px', display: 'flex', gap: '4px', zIndex: 10 }}>
        <button onClick={handleCopySource} style={{ ...parseStyle(btnStyle) }}>{copyLabel}</button>
        <button onClick={() => svg && exportSvg(svg)} style={{ ...parseStyle(btnStyle) }}>SVG</button>
        <button onClick={() => svg && exportPng(svg)} style={{ ...parseStyle(btnStyle) }}>PNG</button>
      </div>
      {/* Diagram */}
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

// Parse inline CSS string to React style object
function parseStyle(css) {
  const obj = {};
  css.split(';').forEach(pair => {
    const [key, val] = pair.split(':').map(s => s.trim());
    if (key && val) {
      const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      obj[camelKey] = val;
    }
  });
  return obj;
}
