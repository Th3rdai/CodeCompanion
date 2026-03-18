import { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, Download, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * ImageLightbox Component
 * Full-screen modal overlay for viewing images at full size
 *
 * Props:
 * - isOpen: Boolean to control visibility
 * - onClose: Callback when lightbox closes
 * - src: Image data URL or base64 (will reconstruct if needed)
 * - filename: Original filename for download
 * - images: Array of images for gallery navigation (optional)
 * - currentIndex: Index of current image in gallery (optional)
 * - onNavigate: Callback(newIndex) for gallery navigation (optional)
 */
export default function ImageLightbox({
  isOpen,
  onClose,
  src,
  filename = 'image',
  images = [],
  currentIndex = 0,
  onNavigate
}) {
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef(null);
  const overlayRef = useRef(null);

  const hasGallery = images.length > 1;

  // Reset zoom and position when image changes
  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [src, currentIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'Escape':
          onClose?.();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
        case '_':
          handleZoomOut();
          break;
        case 'ArrowLeft':
          if (hasGallery && currentIndex > 0) {
            onNavigate?.(currentIndex - 1);
          }
          break;
        case 'ArrowRight':
          if (hasGallery && currentIndex < images.length - 1) {
            onNavigate?.(currentIndex + 1);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, zoom, hasGallery, currentIndex, images.length, onClose, onNavigate]);

  // Focus trap for accessibility
  useEffect(() => {
    if (isOpen && overlayRef.current) {
      const focusableElements = overlayRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      const trapFocus = (e) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement?.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement?.focus();
            e.preventDefault();
          }
        }
      };

      window.addEventListener('keydown', trapFocus);
      firstElement?.focus();

      return () => window.removeEventListener('keydown', trapFocus);
    }
  }, [isOpen]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.5, 0.5));
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = filename;
    link.click();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  };

  const handleMouseDown = (e) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Reconstruct data URI if src is raw base64
  const imageSrc = src?.startsWith('data:') ? src : `data:image/jpeg;base64,${src}`;

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Top Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-800/90 backdrop-blur-sm rounded-lg p-1.5 border border-slate-700">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="p-2 hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Zoom out"
            title="Zoom out (-)"
          >
            <ZoomOut size={18} className="text-slate-300" />
          </button>
          <span className="px-3 text-sm text-slate-300 font-medium min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 5}
            className="p-2 hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Zoom in"
            title="Zoom in (+)"
          >
            <ZoomIn size={18} className="text-slate-300" />
          </button>
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          className="p-2.5 bg-slate-800/90 backdrop-blur-sm hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
          aria-label="Download image"
          title="Download"
        >
          <Download size={18} className="text-slate-300" />
        </button>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-2.5 bg-slate-800/90 backdrop-blur-sm hover:bg-red-600 rounded-lg transition-colors border border-slate-700"
          aria-label="Close lightbox"
          title="Close (Esc)"
        >
          <X size={18} className="text-slate-300" />
        </button>
      </div>

      {/* Gallery Navigation */}
      {hasGallery && (
        <>
          {/* Previous Button */}
          {currentIndex > 0 && (
            <button
              onClick={() => onNavigate?.(currentIndex - 1)}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-slate-800/90 backdrop-blur-sm hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 z-10"
              aria-label="Previous image"
              title="Previous (←)"
            >
              <ChevronLeft size={24} className="text-slate-300" />
            </button>
          )}

          {/* Next Button */}
          {currentIndex < images.length - 1 && (
            <button
              onClick={() => onNavigate?.(currentIndex + 1)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-slate-800/90 backdrop-blur-sm hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 z-10"
              aria-label="Next image"
              title="Next (→)"
            >
              <ChevronRight size={24} className="text-slate-300" />
            </button>
          )}

          {/* Image Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700">
            <span className="text-sm text-slate-300 font-medium">
              {currentIndex + 1} / {images.length}
            </span>
          </div>
        </>
      )}

      {/* Filename */}
      <div className="absolute top-4 left-4 px-4 py-2 bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 max-w-md">
        <span className="text-sm text-slate-300 font-medium truncate block">
          {filename}
        </span>
      </div>

      {/* Image Container */}
      <div
        className="max-w-[90vw] max-h-[90vh] overflow-auto"
        onWheel={handleWheel}
      >
        <img
          ref={imageRef}
          src={imageSrc}
          alt={filename}
          className={`max-w-full max-h-full object-contain transition-transform ${
            zoom > 1 ? 'cursor-move' : 'cursor-zoom-in'
          }`}
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            transformOrigin: 'center'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          draggable={false}
        />
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 px-4 py-2 bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700">
        <div className="text-xs text-slate-400 space-y-0.5">
          <div>ESC to close</div>
          <div>+/- to zoom</div>
          {hasGallery && <div>← → to navigate</div>}
          {zoom > 1 && <div>Drag to pan</div>}
        </div>
      </div>
    </div>
  );
}
