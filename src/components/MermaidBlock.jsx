import { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, Check, Download, Image, Code2, AlertTriangle, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { copyText } from '../lib/clipboard';

// ── Lazy loader (singleton) ──────────────────────────
let mermaidPromise = null;
let mermaidCounter = 0;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(m => {
      m.default.initialize({
        startOnLoad: false,
        suppressErrors: true,
        theme: 'dark',
        flowchart: {
          htmlLabels: true,
          wrappingWidth: 200,
          nodeSpacing: 50,
          rankSpacing: 60,
          curve: 'basis',
          padding: 15,
        },
        sequence: {
          actorMargin: 80,
          boxMargin: 10,
          noteMargin: 10,
          messageMargin: 40,
          mirrorActors: true,
          wrap: true,
          wrapPadding: 15,
        },
        themeVariables: {
          // Core palette
          primaryColor: '#4f46e5',
          primaryTextColor: '#e2e8f0',
          primaryBorderColor: '#6366f1',
          lineColor: '#818cf8',
          // Backgrounds
          secondaryColor: '#7c3aed',
          tertiaryColor: '#2563eb',
          background: '#141829',
          mainBkg: '#1e1b4b',
          secondBkg: '#312e81',
          // Text
          textColor: '#e2e8f0',
          nodeTextColor: '#f1f5f9',
          // Borders & edges
          nodeBorder: '#818cf8',
          clusterBkg: 'rgba(99, 102, 241, 0.08)',
          clusterBorder: 'rgba(99, 102, 241, 0.3)',
          // Labels & notes
          labelBackground: '#1e1b4b',
          labelTextColor: '#c7d2fe',
          noteBkgColor: '#1e1b4b',
          noteTextColor: '#c7d2fe',
          noteBorderColor: '#6366f1',
          // Sequence diagram
          actorBkg: '#312e81',
          actorBorder: '#818cf8',
          actorTextColor: '#e2e8f0',
          signalColor: '#818cf8',
          signalTextColor: '#e2e8f0',
          activationBkgColor: '#4f46e5',
          activationBorderColor: '#818cf8',
          // Styling
          fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
          fontSize: '13px',
          edgeLabelBackground: '#1e1b4b',
          // ER diagram
          entityBkg: '#1e1b4b',
          entityBorder: '#818cf8',
        },
      });
      return m.default;
    });
  }
  return mermaidPromise;
}

// ── Clean up mermaid error elements from DOM ─────────
function cleanupMermaidErrors() {
  document.querySelectorAll('#d.mermaid-error, [id^="dmermaid-"], .mermaid-error-icon').forEach(el => el.remove());
  // Mermaid v11 injects error divs with data-mermaid attributes
  document.querySelectorAll('[data-mermaid-error]').forEach(el => el.remove());
  // Also catch any elements with "Syntax error in text" content outside our containers
  document.querySelectorAll('body > div, body > svg, body > #d').forEach(el => {
    if (el.textContent?.includes('Syntax error in text') || el.id?.startsWith('dmermaid')) {
      el.remove();
    }
  });
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
  const img = new window.Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const scale = 2;
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

// ── Toolbar Button ───────────────────────────────────

function ToolbarButton({ onClick, icon: Icon, label, active, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md cursor-pointer
        transition-all duration-200
        ${active
          ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 neon-glow-sm'
          : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-700/50 border border-transparent hover:border-indigo-500/20'
        }
        disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <Icon size={12} />
      {label && <span>{label}</span>}
    </button>
  );
}

// ── MermaidBlock Component ───────────────────────────

// Strip style/classDef/linkStyle directives that cause parse failures
function sanitizeMermaid(src) {
  return src
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('style ') &&
             !trimmed.startsWith('classDef ') &&
             !trimmed.startsWith('linkStyle ') &&
             !trimmed.startsWith('class ') &&
             !trimmed.match(/^%%\{/); // strip init directives too
    })
    .join('\n');
}

export default function MermaidBlock({ code }) {
  const [svg, setSvg] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);
  const diagramRef = useRef(null);

  // Sanitize mermaid source to remove style directives that cause parse errors
  const cleanCode = sanitizeMermaid(code);

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-${++mermaidCounter}`;

    setLoading(true);
    setError(null);
    setSvg(null);
    setZoom(1);

    loadMermaid()
      .then(mermaid => mermaid.render(id, cleanCode))
      .then(result => {
        if (!cancelled) {
          setSvg(result.svg);
          setLoading(false);
        }
        // Clean up any error elements mermaid injected into the DOM
        cleanupMermaidErrors();
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || 'Failed to render diagram');
          setLoading(false);
        }
        // Clean up any error elements mermaid injected into the DOM
        cleanupMermaidErrors();
      });

    return () => {
      cancelled = true;
      cleanupMermaidErrors();
    };
  }, [cleanCode]);

  const handleCopySource = useCallback(async () => {
    const ok = await copyText(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [code]);

  const handleZoomIn = useCallback(() => setZoom(z => Math.min(z + 0.25, 3)), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z - 0.25, 0.5)), []);
  const handleZoomReset = useCallback(() => setZoom(1), []);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="mermaid-container glass-neon flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            <span className="inline-block w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="inline-block w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="inline-block w-2.5 h-2.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-slate-500 italic">Rendering diagram...</span>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="mermaid-container glass">
        <div className="flex items-center gap-2 mb-3 px-1">
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
          <span className="text-xs text-red-300">Diagram syntax error — showing raw source</span>
        </div>
        <pre className="bg-[#0c0f1a] rounded-lg p-3 overflow-auto m-0 text-left border border-red-500/20">
          <code className="text-sm text-slate-300 whitespace-pre-wrap">{code}</code>
        </pre>
      </div>
    );
  }

  // ── Success state ──
  return (
    <div className="mermaid-container glass-neon group" ref={containerRef}>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Diagram</span>
          {zoom !== 1 && (
            <span className="text-[10px] text-slate-500">{Math.round(zoom * 100)}%</span>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity duration-200">
          {/* Zoom controls */}
          <ToolbarButton onClick={handleZoomOut} icon={ZoomOut} label="" disabled={zoom <= 0.5} />
          <ToolbarButton onClick={handleZoomReset} icon={Maximize2} label="" active={zoom !== 1} />
          <ToolbarButton onClick={handleZoomIn} icon={ZoomIn} label="" disabled={zoom >= 3} />

          <div className="w-px h-4 bg-slate-700/50 mx-1" />

          {/* Export controls */}
          <ToolbarButton onClick={() => setShowSource(!showSource)} icon={Code2} label="Source" active={showSource} />
          <ToolbarButton onClick={handleCopySource} icon={copied ? Check : Copy} label={copied ? 'Copied' : 'Copy'} active={copied} />
          <ToolbarButton onClick={() => svg && exportSvg(svg)} icon={Download} label="SVG" />
          <ToolbarButton onClick={() => svg && exportPng(svg)} icon={Image} label="PNG" />
        </div>
      </div>

      {/* Diagram */}
      <div
        ref={diagramRef}
        className="mermaid-diagram-area"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      {/* Source panel (collapsible) */}
      {showSource && (
        <div className="mt-3 fade-in">
          <pre className="bg-[#0c0f1a] rounded-lg p-3 overflow-auto m-0 text-left border border-indigo-500/15">
            <code className="text-xs text-slate-400 whitespace-pre-wrap font-mono">{code}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
