import { useState } from "react";
import { X } from "lucide-react";

/**
 * ImageThumbnail Component
 * Displays a 128x128px thumbnail of an uploaded image with metadata
 *
 * Props:
 * - src: Thumbnail data URL (WITH prefix for display)
 * - filename: Original filename
 * - size: File size in bytes
 * - format: Image format (png, jpeg, gif)
 * - dimensions: { width, height } original dimensions
 * - onRemove: Callback when remove button clicked
 * - onClick: Callback when thumbnail clicked (opens lightbox)
 */
export default function ImageThumbnail({
  src,
  filename,
  size,
  format,
  dimensions,
  onRemove,
  onClick,
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Format file size for display
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // Format badge color based on format
  const getBadgeColor = (fmt) => {
    switch (fmt?.toLowerCase()) {
      case "png":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "jpeg":
      case "jpg":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      case "gif":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  return (
    <div className="relative group">
      {/* Thumbnail Container */}
      <div
        className="w-32 h-32 rounded-lg border-2 border-indigo-500/30 bg-slate-800/50 overflow-hidden cursor-pointer transition-all hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/20"
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onClick?.()}
        aria-label={`View full-size image: ${filename}`}
      >
        {/* Loading State */}
        {!imageLoaded && !imageError && (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error State */}
        {imageError && (
          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
            <span className="text-3xl mb-1">⚠️</span>
            <span className="text-xs text-slate-400">Failed to load</span>
          </div>
        )}

        {/* Image */}
        <img
          src={src}
          alt={filename}
          className={`w-full h-full object-contain ${imageLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          loading="lazy"
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white text-sm font-medium">View Full Size</span>
        </div>
      </div>

      {/* Remove Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove?.();
        }}
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-lg z-10"
        aria-label={`Remove ${filename}`}
        title="Remove image"
      >
        <X size={14} />
      </button>

      {/* Format Badge */}
      <div
        className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${getBadgeColor(format)}`}
      >
        {format || "img"}
      </div>

      {/* Metadata Tooltip */}
      <div className="mt-1 text-xs text-slate-400 max-w-[128px]">
        <div className="truncate" title={filename}>
          {filename}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span>{formatSize(size)}</span>
          {dimensions && (
            <span>
              {dimensions.width}×{dimensions.height}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
