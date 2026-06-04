import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Copy,
  Check,
  Download,
  Image,
  Sun,
  Moon,
  Code2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  X,
} from "lucide-react";
import DOMPurify from "dompurify";
import { copyText } from "../lib/clipboard";
import { resolveSvgExportDimensions } from "../lib/mermaid-export-dimensions";

// ── Lazy loader (singleton) ──────────────────────────
let mermaidPromise = null;
let mermaidCounter = 0;
const MERMAID_THEME_STORAGE_KEY = "cc-mermaid-diagram-theme";

const BASE_MERMAID_THEME_VARIABLES = {
  fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  fontSize: "13px",
};

const DARK_THEME_VARIABLES = {
  ...BASE_MERMAID_THEME_VARIABLES,
  primaryColor: "#4f46e5",
  primaryTextColor: "#e2e8f0",
  primaryBorderColor: "#6366f1",
  lineColor: "#818cf8",
  secondaryColor: "#7c3aed",
  tertiaryColor: "#2563eb",
  background: "#141829",
  mainBkg: "#1e1b4b",
  secondBkg: "#312e81",
  textColor: "#e2e8f0",
  nodeTextColor: "#f1f5f9",
  nodeBorder: "#818cf8",
  clusterBkg: "rgba(99, 102, 241, 0.08)",
  clusterBorder: "rgba(99, 102, 241, 0.3)",
  labelBackground: "#1e1b4b",
  labelTextColor: "#c7d2fe",
  noteBkgColor: "#1e1b4b",
  noteTextColor: "#c7d2fe",
  noteBorderColor: "#6366f1",
  actorBkg: "#312e81",
  actorBorder: "#818cf8",
  actorTextColor: "#e2e8f0",
  signalColor: "#818cf8",
  signalTextColor: "#e2e8f0",
  activationBkgColor: "#4f46e5",
  activationBorderColor: "#818cf8",
  edgeLabelBackground: "#1e1b4b",
  entityBkg: "#1e1b4b",
  entityBorder: "#818cf8",
};

const LIGHT_THEME_VARIABLES = {
  ...BASE_MERMAID_THEME_VARIABLES,
  primaryColor: "#e0e7ff",
  primaryTextColor: "#0f172a",
  primaryBorderColor: "#3b82f6",
  lineColor: "#475569",
  secondaryColor: "#dbeafe",
  tertiaryColor: "#f1f5f9",
  background: "#ffffff",
  mainBkg: "#eff6ff",
  secondBkg: "#e0f2fe",
  textColor: "#0f172a",
  nodeTextColor: "#0f172a",
  nodeBorder: "#64748b",
  clusterBkg: "rgba(59, 130, 246, 0.08)",
  clusterBorder: "rgba(59, 130, 246, 0.35)",
  labelBackground: "#ffffff",
  labelTextColor: "#0f172a",
  noteBkgColor: "#eef2ff",
  noteTextColor: "#0f172a",
  noteBorderColor: "#6366f1",
  actorBkg: "#e0e7ff",
  actorBorder: "#64748b",
  actorTextColor: "#0f172a",
  signalColor: "#334155",
  signalTextColor: "#0f172a",
  activationBkgColor: "#c7d2fe",
  activationBorderColor: "#6366f1",
  edgeLabelBackground: "#ffffff",
  entityBkg: "#f8fafc",
  entityBorder: "#64748b",
};

function buildMermaidConfig(themeMode = "dark") {
  return {
    startOnLoad: false,
    suppressErrors: true,
    theme: "base",
    flowchart: {
      htmlLabels: true,
      wrappingWidth: 200,
      nodeSpacing: 50,
      rankSpacing: 60,
      curve: "basis",
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
    themeVariables:
      themeMode === "light" ? LIGHT_THEME_VARIABLES : DARK_THEME_VARIABLES,
  };
}

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => m.default);
  }
  return mermaidPromise;
}

// ── Clean up mermaid error elements from DOM ─────────
function cleanupMermaidErrors() {
  document
    .querySelectorAll(
      '#d.mermaid-error, [id^="dmermaid-"], .mermaid-error-icon',
    )
    .forEach((el) => el.remove());
  // Mermaid v11 injects error divs with data-mermaid attributes
  document
    .querySelectorAll("[data-mermaid-error]")
    .forEach((el) => el.remove());
  // Also catch any elements with "Syntax error in text" content outside our containers
  document
    .querySelectorAll("body > div, body > svg, body > #d")
    .forEach((el) => {
      if (
        el.textContent?.includes("Syntax error in text") ||
        el.id?.startsWith("dmermaid")
      ) {
        el.remove();
      }
    });
}

// ── Export helpers ────────────────────────────────────

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke asynchronously so slower browsers/electron shells can finish the
  // download handshake before the object URL disappears.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportSvg(svgHtml) {
  const blob = new Blob([svgHtml], { type: "image/svg+xml" });
  downloadBlob(blob, "diagram.svg");
}

function exportPng(
  svgHtml,
  { onError, onSuccess, onComplete, backgroundColor = "#141829" } = {},
) {
  // Parse SVG and set explicit pixel dimensions so img.naturalWidth/Height are non-zero.
  // Mermaid often emits width="100%" or style="max-width:Xpx" without a px height,
  // which causes the browser to report naturalWidth=0 and the export to silently fail.
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgHtml, "image/svg+xml");
  const svgEl = doc.querySelector("svg");

  if (!svgEl) {
    onError?.("No SVG element found.");
    onComplete?.();
    return;
  }

  if (!svgEl.getAttribute("xmlns")) {
    svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  if (!svgEl.getAttribute("xmlns:xlink")) {
    svgEl.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  }

  const { width: w, height: h } = resolveSvgExportDimensions({
    widthAttr: svgEl.getAttribute("width"),
    heightAttr: svgEl.getAttribute("height"),
    viewBoxAttr: svgEl.getAttribute("viewBox"),
    styleAttr: svgEl.getAttribute("style"),
  });

  svgEl.setAttribute("width", w);
  svgEl.setAttribute("height", h);

  const fixedSvg = new XMLSerializer().serializeToString(doc);

  const fail = (reason) => {
    onError?.(reason);
    onComplete?.();
  };

  const saveWithPicker = async (blob) => {
    if (typeof window.showSaveFilePicker !== "function") {
      downloadBlob(blob, "diagram.png");
      onSuccess?.("PNG download started — check your Downloads folder.");
      onComplete?.();
      return;
    }
    let handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: "diagram.png",
        types: [
          {
            description: "PNG Image",
            accept: { "image/png": [".png"] },
          },
        ],
      });
    } catch (err) {
      if (err?.name === "AbortError") {
        onComplete?.();
        return;
      }
      downloadBlob(blob, "diagram.png");
      onSuccess?.("PNG download started — check your Downloads folder.");
      onComplete?.();
      return;
    }
    try {
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      onSuccess?.("PNG saved.");
      onComplete?.();
    } catch {
      downloadBlob(blob, "diagram.png");
      onSuccess?.("PNG download started — check your Downloads folder.");
      onComplete?.();
    }
  };

  const stripForeignObjectNodes = (svgText) => {
    const parsed = parser.parseFromString(svgText, "image/svg+xml");
    parsed.querySelectorAll("foreignObject").forEach((node) => node.remove());
    return new XMLSerializer().serializeToString(parsed);
  };

  const attemptRender = (
    svgText,
    { allowForeignObjectFallback = true } = {},
  ) => {
    const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
    const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;

    const failAttempt = (reason) => {
      if (allowForeignObjectFallback && /<foreignObject[\s>]/i.test(svgText)) {
        const simplifiedSvg = stripForeignObjectNodes(svgText);
        attemptRender(simplifiedSvg, { allowForeignObjectFallback: false });
        return;
      }
      fail(reason);
    };

    const drawRaster = (rasterSource, cleanup) => {
      const pw = rasterSource.width || rasterSource.naturalWidth || w;
      const ph = rasterSource.height || rasterSource.naturalHeight || h;
      const canvas = document.createElement("canvas");
      const scale = 2;
      canvas.width = pw * scale;
      canvas.height = ph * scale;
      const ctx = canvas.getContext("2d");
      // Fill background to match diagram theme
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      try {
        ctx.drawImage(rasterSource, 0, 0);
      } catch {
        cleanup?.();
        failAttempt(
          "Canvas export blocked by browser security — try SVG export instead.",
        );
        return;
      }
      canvas.toBlob((blob) => {
        cleanup?.();
        if (blob) {
          void saveWithPicker(blob);
        } else {
          failAttempt("Could not create PNG — try SVG export instead.");
        }
      }, "image/png");
    };

    // Preferred: createImageBitmap can be more reliable in Electron shells.
    if (typeof window.createImageBitmap === "function") {
      window
        .createImageBitmap(svgBlob)
        .then((bitmap) =>
          drawRaster(bitmap, () => {
            try {
              bitmap.close?.();
            } catch {
              // no-op
            }
          }),
        )
        .catch(() => {
          const img = new window.Image();
          img.onload = () => drawRaster(img);
          img.onerror = () => {
            const blobUrl = URL.createObjectURL(svgBlob);
            const blobImg = new window.Image();
            blobImg.onload = () =>
              drawRaster(blobImg, () => URL.revokeObjectURL(blobUrl));
            blobImg.onerror = () => {
              URL.revokeObjectURL(blobUrl);
              failAttempt(
                "Could not load diagram for PNG export — try SVG export instead.",
              );
            };
            blobImg.src = blobUrl;
          };
          img.src = dataUri;
        });
      return;
    }

    const img = new window.Image();
    img.onload = () => drawRaster(img);
    img.onerror = () => {
      const blobUrl = URL.createObjectURL(svgBlob);
      const blobImg = new window.Image();
      blobImg.onload = () =>
        drawRaster(blobImg, () => URL.revokeObjectURL(blobUrl));
      blobImg.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        failAttempt(
          "Could not load diagram for PNG export — try SVG export instead.",
        );
      };
      blobImg.src = blobUrl;
    };
    img.src = dataUri;
  };

  attemptRender(fixedSvg);
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
        ${
          active
            ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 neon-glow-sm"
            : "text-slate-400 hover:text-indigo-300 hover:bg-slate-700/50 border border-transparent hover:border-indigo-500/20"
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
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return (
        !trimmed.startsWith("style ") &&
        !trimmed.startsWith("classDef ") &&
        !trimmed.startsWith("linkStyle ") &&
        !trimmed.startsWith("class ") &&
        !trimmed.match(/^%%\{/)
      ); // strip init directives too
    })
    .join("\n");
}

const MERMAID_START_RE =
  /^(sequenceDiagram|graph\s+(TD|TB|BT|RL|LR)|flowchart\s+(TD|TB|BT|RL|LR)|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline|journey|quadrantChart|sankey|xychart|block-beta|packet-beta|architecture-beta|kanban)/i;

function autoRepairMermaidOnce(src) {
  let repaired = sanitizeMermaid(src || "");

  // Remove accidental markdown fences that occasionally leak into code blocks.
  repaired = repaired
    .replace(/^\s*```mermaid\s*$/gim, "")
    .replace(/^\s*```\s*$/gim, "");

  // Normalize line endings + smart punctuation that Mermaid parsers dislike.
  repaired = repaired
    .replace(/\r\n?/g, "\n")
    .replace(/→/g, "-->")
    .replace(/←/g, "<--")
    .replace(/—/g, "--")
    .trim();

  // If prose leaked in, keep content from the first real Mermaid directive.
  const lines = repaired.split("\n");
  const firstDirectiveIndex = lines.findIndex((line) =>
    MERMAID_START_RE.test(line.trim()),
  );
  if (firstDirectiveIndex > 0) {
    repaired = lines.slice(firstDirectiveIndex).join("\n").trim();
  }

  return repaired;
}

export default function MermaidBlock({ code }) {
  const [svg, setSvg] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [exportError, setExportError] = useState(null);
  const [exportStatus, setExportStatus] = useState(null);
  const [exportingPng, setExportingPng] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [diagramTheme, setDiagramTheme] = useState(() => {
    try {
      const saved = window.localStorage.getItem(MERMAID_THEME_STORAGE_KEY);
      return saved === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const containerRef = useRef(null);
  const diagramRef = useRef(null);
  const isLightTheme = diagramTheme === "light";

  const handleExportPng = useCallback(() => {
    if (!svg) return;
    setExportingPng(true);
    setExportStatus(null);
    setExportError(null);
    exportPng(svg, {
      onError: (msg) => {
        setExportError(msg);
        window.setTimeout(() => setExportError(null), 6000);
      },
      onSuccess: (msg) => {
        setExportStatus(msg);
        window.setTimeout(() => setExportStatus(null), 4000);
      },
      onComplete: () => setExportingPng(false),
      backgroundColor: isLightTheme ? "#ffffff" : "#141829",
    });
  }, [svg, isLightTheme]);

  const toggleDiagramTheme = useCallback(() => {
    setDiagramTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        window.localStorage.setItem(MERMAID_THEME_STORAGE_KEY, next);
      } catch {
        // no-op (privacy mode / disabled storage)
      }
      return next;
    });
  }, []);

  // Sanitize mermaid source to remove directives that cause parse errors.
  const cleanCode = sanitizeMermaid(code);
  const repairedCode = useMemo(() => autoRepairMermaidOnce(code), [code]);

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-${++mermaidCounter}`;

    setLoading(true);
    setError(null);
    setSvg(null);
    setZoom(1);

    loadMermaid()
      .then(async (mermaid) => {
        mermaid.initialize(buildMermaidConfig(diagramTheme));
        try {
          return await mermaid.render(id, cleanCode);
        } catch (firstErr) {
          if (repairedCode && repairedCode !== cleanCode) {
            const retryId = `${id}-retry`;
            return await mermaid.render(retryId, repairedCode);
          }
          throw firstErr;
        }
      })
      .then((result) => {
        if (!cancelled) {
          // Sanitize SVG to prevent XSS attacks from AI-generated malicious event handlers
          const sanitizedSvg = DOMPurify.sanitize(result.svg, {
            USE_PROFILES: { svg: true, svgFilters: true },
            ADD_TAGS: ["foreignObject"], // Allow foreignObject for complex diagrams
            FORBID_ATTR: ["onclick", "onerror", "onload", "onmouseover"], // Block event handlers
          });
          setSvg(sanitizedSvg);
          setLoading(false);
        }
        // Clean up any error elements mermaid injected into the DOM
        cleanupMermaidErrors();
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to render diagram");
          setLoading(false);
        }
        // Clean up any error elements mermaid injected into the DOM
        cleanupMermaidErrors();
      });

    return () => {
      cancelled = true;
      cleanupMermaidErrors();
    };
  }, [cleanCode, repairedCode, diagramTheme]);

  const handleCopySource = useCallback(async () => {
    const ok = await copyText(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [code]);

  const handleZoomIn = useCallback(
    () => setZoom((z) => Math.min(z + 0.25, 3)),
    [],
  );
  const handleZoomOut = useCallback(
    () => setZoom((z) => Math.max(z - 0.25, 0.5)),
    [],
  );
  const handleZoomReset = useCallback(() => setZoom(1), []);
  const openPreview = useCallback(() => setPreviewOpen(true), []);
  const closePreview = useCallback(() => setPreviewOpen(false), []);

  useEffect(() => {
    if (!previewOpen) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewOpen]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="mermaid-container glass-neon flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="inline-block w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="inline-block w-2.5 h-2.5 bg-cyan-400 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <span className="text-xs text-slate-500 italic">
            Rendering diagram...
          </span>
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
          <span className="text-xs text-red-300">
            Diagram syntax error — showing raw source
          </span>
        </div>
        <pre className="bg-[#0c0f1a] rounded-lg p-3 overflow-auto m-0 text-left border border-red-500/20">
          <code className="text-sm text-slate-300 whitespace-pre-wrap">
            {code}
          </code>
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
          <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">
            Diagram
          </span>
          {zoom !== 1 && (
            <span className="text-[10px] text-slate-500">
              {Math.round(zoom * 100)}%
            </span>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity duration-200">
          {/* Zoom controls */}
          <ToolbarButton
            onClick={handleZoomOut}
            icon={ZoomOut}
            label=""
            disabled={zoom <= 0.5}
          />
          <ToolbarButton
            onClick={handleZoomReset}
            icon={RotateCcw}
            label=""
            active={zoom !== 1}
          />
          <ToolbarButton
            onClick={handleZoomIn}
            icon={ZoomIn}
            label=""
            disabled={zoom >= 3}
          />

          <div className="w-px h-4 bg-slate-700/50 mx-1" />

          {/* Export controls */}
          <ToolbarButton
            onClick={openPreview}
            icon={Maximize2}
            label="Preview"
            active={previewOpen}
          />
          <ToolbarButton
            onClick={toggleDiagramTheme}
            icon={isLightTheme ? Moon : Sun}
            label={isLightTheme ? "Dark" : "Light"}
          />
          <ToolbarButton
            onClick={() => setShowSource(!showSource)}
            icon={Code2}
            label="Source"
            active={showSource}
          />
          <ToolbarButton
            onClick={handleCopySource}
            icon={copied ? Check : Copy}
            label={copied ? "Copied" : "Copy"}
            active={copied}
          />
          <ToolbarButton
            onClick={() => svg && exportSvg(svg)}
            icon={Download}
            label="SVG"
          />
          <ToolbarButton
            onClick={handleExportPng}
            icon={Image}
            label={exportingPng ? "Exporting..." : "PNG"}
            disabled={!svg || exportingPng}
          />
        </div>
      </div>

      {exportError && (
        <div
          className="mb-2 px-1 text-[11px] text-amber-300/90 flex items-center gap-1"
          role="status"
        >
          <AlertTriangle size={12} className="shrink-0" />
          <span>{exportError}</span>
          <button
            type="button"
            className="ml-1 underline text-slate-400 hover:text-slate-200"
            onClick={() => setExportError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      {exportStatus && (
        <div className="mb-2 px-1 text-[11px] text-emerald-300/90 flex items-center gap-1">
          <Check size={12} className="shrink-0" />
          <span>{exportStatus}</span>
        </div>
      )}

      {/* Diagram */}
      <div
        ref={diagramRef}
        className="mermaid-diagram-area"
        style={{
          backgroundColor: isLightTheme ? "#ffffff" : "#141829",
          borderRadius: "0.5rem",
          padding: "0.75rem",
          transform: `scale(${zoom})`,
          transformOrigin: "top center",
          transition: "transform 0.2s ease",
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      {/* Source panel (collapsible) */}
      {showSource && (
        <div className="mt-3 fade-in">
          <pre className="bg-[#0c0f1a] rounded-lg p-3 overflow-auto m-0 text-left border border-indigo-500/15">
            <code className="text-xs text-slate-400 whitespace-pre-wrap font-mono">
              {code}
            </code>
          </pre>
        </div>
      )}

      {previewOpen && (
        <div
          className="fixed inset-0 z-[90] bg-slate-950/85 backdrop-blur-sm p-6"
          onClick={closePreview}
        >
          <div
            className="w-full h-full rounded-xl border border-slate-600/40 bg-slate-900/85 p-4 overflow-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-slate-300">
                Diagram preview (press Esc to close)
              </div>
              <button
                type="button"
                onClick={closePreview}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-700/70 border border-slate-600/50"
              >
                <X size={12} />
                Close
              </button>
            </div>
            <div
              className="w-full min-h-[70vh] overflow-auto"
              style={{
                backgroundColor: isLightTheme ? "#ffffff" : "#141829",
                borderRadius: "0.5rem",
                padding: "1rem",
              }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
