# Phase 0: Foundation & Utilities

**Status**: ✅ COMPLETE
**Completed**: 2026-03-17
**Agent**: Session 1

---

## Overview

Phase 0 establishes the foundation for image support by creating:
1. Core image processing utilities (validation, resize, compression, EXIF stripping)
2. React components for displaying images (thumbnails, full-screen viewer)
3. Zero external dependencies (uses built-in Canvas API)

---

## ✅ Completed Tasks

### Task 0.1: Create Image Processing Utility Module
**File**: `lib/image-processor.js`
**Status**: ✅ Complete

**Functions Implemented**:
- ✅ `validateImage(file, config)` → Validates format, size, dimensions
- ✅ `processImage(file, options)` → Resize, compress, generate thumbnail, strip EXIF
- ✅ `extractBase64(dataURL)` → Strips data URI prefix for Ollama
- ✅ `generateThumbnail(dataURL, size)` → Creates 128x128px thumbnails (async)
- ✅ `checkVisionModel(modelFamily)` → Checks vision model families
- ✅ `hashImage(base64OrDataURL)` → MD5 hash for duplicate detection
- ✅ `estimateTokens(imageBase64)` → Rough token count (~765 per image)
- ✅ `validateDataURI(dataURI)` → Security validation
- ✅ `sanitizeFilename(filename)` → Remove unsafe characters

**Key Features**:
- Strict MIME whitelist: PNG, JPEG, GIF only
- Max size: 25MB (configurable)
- Max dimensions: 8192x8192px (configurable)
- Auto-resize to 2048px (configurable)
- Multi-step downscaling for quality
- Canvas re-encoding strips EXIF and destroys embedded scripts
- Browser-only (requires Canvas API)

**Security**:
- ✅ Strict MIME type validation
- ✅ Automatic EXIF stripping via canvas re-encoding
- ✅ Embedded script destruction (XSS prevention)
- ✅ Filename sanitization
- ✅ Data URI validation with regex

---

### Task 0.2: Create React Image Components
**Status**: ✅ Complete

#### ImageThumbnail Component
**File**: `src/components/ImageThumbnail.jsx`
**Status**: ✅ Complete

**Features**:
- ✅ 128x128px responsive thumbnail
- ✅ Format badge with color coding (PNG=blue, JPEG=green, GIF=purple)
- ✅ Remove button with X icon (Lucide React)
- ✅ Loading spinner during image load
- ✅ Error placeholder for failed loads
- ✅ Hover overlay "View Full Size"
- ✅ Metadata display: filename, size (formatted), dimensions
- ✅ Dark mode optimized (slate-800 background, indigo borders)
- ✅ Click to open lightbox (onClick callback)
- ✅ Keyboard support (Enter key)
- ✅ ARIA labels for accessibility
- ✅ Lazy loading attribute
- ✅ Touch-friendly (44x44px minimum tap target implied by 128px container)

**Props**:
```javascript
{
  src: string,           // Thumbnail data URL (WITH prefix)
  filename: string,      // Original filename
  size: number,          // File size in bytes
  format: string,        // 'png' | 'jpeg' | 'gif'
  dimensions: object,    // { width, height }
  onRemove: function,    // Callback when X clicked
  onClick: function      // Callback when thumbnail clicked
}
```

#### ImageLightbox Component
**File**: `src/components/ImageLightbox.jsx`
**Status**: ✅ Complete

**Features**:
- ✅ Full-screen modal overlay (black/90 backdrop)
- ✅ Zoom controls (+/- buttons, range: 50%-500%)
- ✅ Scroll wheel zoom support
- ✅ Pan when zoomed (drag to move)
- ✅ Download button (saves original)
- ✅ Close button + ESC key handler
- ✅ Click outside overlay to close
- ✅ Gallery navigation (left/right arrows)
- ✅ Image counter (e.g., "3 / 10")
- ✅ Keyboard shortcuts:
  - ESC = close
  - +/- = zoom in/out
  - ← → = navigate gallery
  - Tab = cycle controls
- ✅ Focus trap for accessibility
- ✅ Instructions overlay (bottom-right)
- ✅ Filename display (top-left)
- ✅ Dark theme with glassmorphism (slate-800/90 with backdrop-blur)
- ✅ Prevents body scroll when open
- ✅ Auto-reconstructs data URI from raw base64 if needed

**Props**:
```javascript
{
  isOpen: boolean,          // Control visibility
  onClose: function,        // Callback when closed
  src: string,              // Data URL or raw base64
  filename: string,         // For display and download
  images: array,            // Optional gallery array
  currentIndex: number,     // Current position in gallery
  onNavigate: function      // Callback(newIndex) for gallery nav
}
```

---

## 📦 Files Created

1. **lib/image-processor.js** (370 lines)
   - Module exports: 10 functions + 2 constants
   - Dependencies: crypto (built-in)
   - Browser APIs: Canvas, Image, FileReader, URL.createObjectURL

2. **src/components/ImageThumbnail.jsx** (120 lines)
   - Dependencies: react, lucide-react (X icon)
   - Responsive, accessible, dark-mode ready

3. **src/components/ImageLightbox.jsx** (280 lines)
   - Dependencies: react, lucide-react (X, ZoomIn, ZoomOut, Download, ChevronLeft, ChevronRight)
   - Full gallery support with keyboard navigation

**Total Code Added**: ~770 lines

---

## 🔍 Testing Performed

### Manual Testing
- ✅ image-processor.js compiles without errors
- ✅ ImageThumbnail.jsx compiles without errors
- ✅ ImageLightbox.jsx compiles without errors
- ✅ All imports resolve correctly
- ✅ No TypeScript/JSX syntax errors
- ✅ Linter auto-fixed generateThumbnail to return Promise (async)

### Not Yet Tested (requires integration):
- ⏸️ Image processing with real files
- ⏸️ Component rendering in app
- ⏸️ Lightbox zoom/pan interactions
- ⏸️ Gallery navigation
- ⏸️ Cross-browser compatibility

---

## 🔗 Dependencies

**New Dependencies**: None
- ✅ Uses built-in crypto module (Node.js)
- ✅ Uses built-in Canvas API (browser)
- ✅ Uses existing lucide-react icons (already in project)

**Browser Requirements**:
- Canvas API (all modern browsers)
- FileReader API (all modern browsers)
- URL.createObjectURL (all modern browsers)
- ES6+ JavaScript

---

## 🚀 Ready for Next Phase

Phase 0 is complete and ready for integration. Next phases can proceed:

**Phase 1: Backend Integration** (READY)
- Ollama client can now receive images array
- API endpoints can validate and pass images
- Config can store imageSupport settings

**Phase 2: Frontend Upload** (READY)
- Can import and use processImage(), validateImage()
- Can render ImageThumbnail for attachments
- Can open ImageLightbox on click

**Phase 3: Chat Display** (READY)
- Can display images in message history
- Can use ImageLightbox for full-size viewing

---

## 📝 Notes for Next Agent

1. **Image Format**:
   - Storage (for API): base64 WITHOUT prefix → `"iVBORw0KGgo..."`
   - Display (for browser): data URI WITH prefix → `"data:image/png;base64,iVBORw0KGgo..."`
   - Use `extractBase64()` to strip prefix
   - Reconstruct in lightbox with template literal

2. **Async Functions**:
   - `generateThumbnail()` is async (returns Promise)
   - `processImage()` is async
   - `validateImage()` is async
   - All must be awaited

3. **Browser-Only Functions**:
   - processImage, generateThumbnail, validateImage (dimension check)
   - Will throw error if called in Node.js environment
   - Guard with `typeof window !== 'undefined'`

4. **Import Pattern**:
   ```javascript
   // In frontend (App.jsx)
   import { validateImage, processImage, checkVisionModel } from '../lib/image-processor';
   import ImageThumbnail from './components/ImageThumbnail';
   import ImageLightbox from './components/ImageLightbox';
   ```

5. **Config Schema** (to be added in Phase 1):
   ```javascript
   imageSupport: {
     enabled: true,
     maxSizeMB: 25,
     maxDimensionPx: 8192,
     compressionQuality: 0.9,
     maxImagesPerMessage: 10,
     resizeThreshold: 2048,
     warnOnFirstUpload: true
   }
   ```

---

## ✅ Phase 0 Sign-Off

**Checklist**:
- ✅ All 3 files created
- ✅ All functions implemented
- ✅ No compilation errors
- ✅ No missing dependencies
- ✅ Code follows project conventions (React 18, Tailwind, dark theme)
- ✅ Security considerations addressed (EXIF stripping, validation)
- ✅ Performance considerations addressed (multi-step downscaling)
- ✅ Accessibility considerations addressed (ARIA labels, keyboard nav)
- ✅ Documentation complete (JSDoc comments, this file)

**Phase 0 Status**: ✅ COMPLETE - Ready for Phase 1

---

**Last Updated**: 2026-03-17
**Next Phase**: Phase 1 - Backend Integration (4 tasks)
**See Also**: `.planning/IMAGE_SUPPORT_PROGRESS.md` for overall coordination
