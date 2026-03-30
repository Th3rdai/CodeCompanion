# Image Support Guide

Comprehensive guide for using image uploads and vision models in Code Companion.

---

## Table of Contents

1. [Installation & Setup](#installation--setup)
2. [Getting Started](#getting-started)
3. [Uploading Images](#uploading-images)
4. [Vision Model Selection](#vision-model-selection)
5. [Supported Formats & Limits](#supported-formats--limits)
6. [Using Images in Different Modes](#using-images-in-different-modes)
7. [Image Gallery & Lightbox](#image-gallery--lightbox)
8. [Privacy & Security](#privacy--security)
9. [Troubleshooting](#troubleshooting)
10. [API Reference (Developers)](#api-reference-developers)

---

## Installation & Setup

### Prerequisites

- **Ollama**: Must be installed and running locally ([ollama.com](https://ollama.com))
- **Vision Model**: At least one vision-capable model installed
- **Code Companion**: Latest version with image support

### Installing a Vision Model

Code Companion supports any Ollama vision model. Recommended models:

**llava** (Recommended for most users):

```bash
ollama pull llava
```

**bakllava** (Alternative vision model):

```bash
ollama pull bakllava
```

**minicpm-v** (Smaller, faster):

```bash
ollama pull minicpm-v
```

### Verifying Installation

1. Start Code Companion
2. Open Settings → General → Image Support
3. Check "Available Vision Models" section
4. You should see your installed model(s) listed with 👁️ icon

If no models appear:

- Verify Ollama is running: `ollama list`
- Ensure you pulled a vision model (not a text-only model)
- Restart Code Companion

---

## Getting Started

### Quick Start (3 Steps)

1. **Install a vision model** (if not already installed):

   ```bash
   ollama pull llava
   ```

2. **Select the vision model** in Code Companion's model dropdown (top toolbar)

3. **Upload your first image**:
   - Drag an image file into the chat textarea, OR
   - Click the 📎 attach button and select an image, OR
   - Take a screenshot and paste (Cmd+V / Ctrl+V)

That's it! The AI can now analyze your image.

### First Upload Privacy Warning

On your first image upload, you'll see a privacy warning modal. This is a one-time notice reminding you:

- Don't upload images with sensitive information (API keys, passwords, etc.)
- EXIF metadata (GPS, timestamps) is automatically stripped
- AI can read text in images (be aware of prompt injection risks)
- Images are stored locally in conversation history

Click "I Understand" to proceed. Check "Don't show again" to skip this warning on future uploads.

---

## Uploading Images

### Method 1: Drag and Drop

1. Navigate to any supported mode (Chat, Review, Security)
2. Drag image file(s) from your desktop/file explorer
3. Drop onto the chat textarea or code input area
4. Images process automatically and appear as thumbnails

**Tips**:

- You can drag multiple images at once
- Drag-and-drop works in all 3 image-enabled modes
- Mixed file types (images + text files) are handled correctly

### Method 2: File Picker

1. Click the 📎 **Attach** button in the toolbar
2. Select one or more image files (Cmd/Ctrl+Click for multiple)
3. Click "Open"
4. Images process and attach automatically

**Tips**:

- Use Cmd/Ctrl+Click to select multiple files
- File picker filters to show only supported formats (PNG, JPEG, GIF)

### Method 3: Clipboard Paste

1. Take a screenshot:
   - **macOS**: Cmd+Shift+4 (region) or Cmd+Shift+3 (full screen)
   - **Windows**: Win+Shift+S or Print Screen
   - **Linux**: Varies by desktop environment
2. Click in the textarea
3. Paste: Cmd+V (macOS) or Ctrl+V (Windows/Linux)
4. Screenshot uploads automatically

**Tips**:

- Works with screenshots from any tool
- Works with images copied from web browsers
- Works with images copied from file explorers

### Method 4: File Browser (Review/Security Modes)

1. Open File Browser (Files button in toolbar)
2. Navigate to an image file
3. Click **Load into Form** (in Chat mode) or **Load for Review** (in Review/Security)
4. Image attaches to the current mode

---

## Vision Model Selection

### Identifying Vision Models

Vision models in the dropdown are marked with 👁️ icon:

```
👁️ llava:latest
👁️ bakllava:latest
   mistral:latest     (no icon = text-only)
   llama3:latest      (no icon = text-only)
```

### Auto-Sorting

When you attach images, vision models automatically move to the top of the dropdown for easy selection.

### Vision Model Warning

If you attach images while a **non-vision model** is selected, you'll see a warning banner:

```
⚠️ Current model doesn't support images.
   [Switch to vision model] or [Remove images]
```

- **Send button is disabled** until you resolve the warning
- Click "Switch to vision model" to auto-select the first available vision model
- Click "Remove images" to clear all attached images

### No Vision Models Installed?

If no vision models are available, Settings → Image Support shows an empty state:

```
📸 No Vision Models Installed

Install a vision model to upload and analyze images in Code Companion.

ollama pull llava

[Learn more about vision models →]
```

---

## Supported Formats & Limits

### Supported Formats

| Format | Extension       | Notes                                          |
| ------ | --------------- | ---------------------------------------------- |
| PNG    | `.png`          | Fully supported, transparency preserved        |
| JPEG   | `.jpg`, `.jpeg` | Fully supported, optimal for photos            |
| GIF    | `.gif`          | Supported (first frame only for animated GIFs) |

### Unsupported Formats

These formats are **rejected** with a clear error message:

- **HEIC/HEIF** (Apple photos) - Convert to JPEG first
- **SVG** (vector graphics) - Not supported for security reasons
- **WEBP** - Not yet supported
- **BMP** - Convert to PNG/JPEG
- **TIFF** - Convert to PNG/JPEG
- **RAW formats** (CR2, NEF, etc.) - Convert to JPEG

### Size Limits

| Limit                      | Default     | Configurable       |
| -------------------------- | ----------- | ------------------ |
| **Max file size**          | 25 MB       | 1-50 MB (Settings) |
| **Max dimensions**         | 8192x8192px | Fixed              |
| **Max images per message** | 10          | 1-20 (Settings)    |
| **Auto-resize threshold**  | 2048px      | Fixed              |

### Automatic Processing

All uploaded images are:

1. **Validated** - Format, size, and dimensions checked
2. **Resized** - Images >2048px are downscaled (preserves aspect ratio)
3. **Compressed** - Quality setting applied (default 90%)
4. **Security hardened** - EXIF stripped, re-encoded through canvas
5. **Thumbnailed** - 128x128px thumbnail generated for gallery
6. **Hashed** - MD5 hash for duplicate detection

---

## Using Images in Different Modes

### Chat Mode

**Use Cases**:

- Debug visual bugs ("Why is my button overlapping?")
- Share design mockups ("Build this UI")
- Analyze error screenshots ("What's causing this error?")
- Explain diagrams ("Walk me through this architecture")
- Code from screenshots ("Convert this UI to code")

**How to Use**:

1. Switch to Chat mode (default)
2. Attach image(s) via any method
3. Type your question or request
4. Click Send

**Example Workflow**:

```
[Screenshot of broken UI layout]
"The sidebar is overlapping the main content.
 Here's what it looks like. What's wrong with my CSS?"
```

AI response includes visual analysis:

```
Looking at your screenshot, the issue is...
```

### Review Mode

**Use Cases**:

- Attach bug screenshots alongside code
- Show visual rendering issues
- Include architecture diagrams for context
- Document expected vs. actual behavior

**How to Use**:

1. Switch to Review mode
2. Paste or upload code
3. Attach screenshot(s) showing the issue
4. Click "Get Review"

**Example Workflow**:

```javascript
// component.jsx
function Sidebar() {
  return <div className="sidebar">...</div>;
}
```

[Screenshot showing sidebar layout bug]

AI review references both:

```
The CSS in line 42 is causing the overlap shown in your screenshot.
The absolute positioning conflicts with...
```

### Security Mode

**Use Cases**:

- Attach vulnerability screenshots (XSS alerts, SQL errors)
- Include browser DevTools showing security issues
- Document exploit proof-of-concept visually
- Show error logs or stack traces

**How to Use**:

1. Switch to Security mode
2. Paste or upload code
3. Attach screenshot(s) of the vulnerability
4. Click "Security Scan"

**Example Workflow**:

```javascript
// Vulnerable code
app.get("/search", (req, res) => {
  res.send(`Results for: ${req.query.q}`);
});
```

[Screenshot showing XSS alert in browser]

AI scan correlates visual evidence:

```
The XSS vulnerability shown in your screenshot originates from
line 2 where user input isn't sanitized...
```

---

## Image Gallery & Lightbox

### Thumbnail Gallery

After attaching images, they appear as thumbnails below the input area:

```
┌─────────────────────────────────────────────┐
│ Attached Images (3)          [Clear All]    │
├─────────────────────────────────────────────┤
│  [Thumb1]  [Thumb2]  [Thumb3]               │
│  image.png  bug.jpg   error.gif             │
│  2.3 MB     1.1 MB    450 KB                │
└─────────────────────────────────────────────┘
```

**Features**:

- 128x128px thumbnails with aspect ratio preserved
- Format badge (PNG/JPG/GIF)
- File size and dimensions shown
- Individual remove button (X) on each thumbnail
- "Clear All" button to remove all images

### Lightbox Viewer

Click any thumbnail to open the full-size lightbox:

**Controls**:

- **Close**: Click X, press ESC, or click outside the image
- **Zoom**: Click +/- buttons or use scroll wheel (50%-500%)
- **Pan**: Drag the image when zoomed >100%
- **Navigate**: Arrow keys or click left/right arrows (multiple images)
- **Download**: Click download button to save original image

**Keyboard Shortcuts**:

- `ESC` - Close lightbox
- `←` `→` - Previous/Next image
- `+` `-` - Zoom in/out

---

## Privacy & Security

### What Gets Stripped Automatically

Code Companion automatically removes:

1. **EXIF Metadata**
   - GPS coordinates
   - Camera make/model
   - Timestamps (creation, modification)
   - Software info
   - Thumbnail images embedded in EXIF

2. **Embedded Scripts**
   - Re-encoding through HTML Canvas API destroys any embedded JavaScript
   - SVG files rejected entirely (potential XSS vector)

3. **Color Profiles**
   - ICC profiles removed
   - Output normalized to sRGB

### What You Should NOT Upload

❌ **Never upload images containing**:

- API keys, passwords, tokens
- Personal identification (driver's license, passport)
- Credit card numbers
- Social Security numbers
- Private encryption keys
- Internal network diagrams with IPs
- Proprietary business information

✅ **Safe to upload**:

- Screenshots of code or errors
- UI mockups and designs
- Architecture diagrams (public)
- Open-source code snippets
- Public documentation

### Privacy Warning (First Upload)

The first time you upload an image, you'll see a warning:

```
⚠️ Image Upload Privacy Notice

- Don't upload images containing sensitive information
  (API keys, passwords)
- EXIF metadata (GPS, timestamps) will be stripped automatically
- AI can read text in images - be aware of prompt injection risks
- Images are stored in conversation history

[ ] Don't show this again
           [I Understand]
```

### Where Images Are Stored

**Local Storage Only**:

- Images stored in: `~/.code-companion/history/[conversation-id].json`
- **Never sent to cloud** - Ollama runs 100% locally
- **No telemetry** - No tracking or analytics

**File Size Warning**:
If a conversation with images exceeds 5MB, you'll see a console warning:

```
Conversation abc123 is large (7.2MB). Consider archiving.
```

### Duplicate Detection

To prevent accidental re-uploads:

1. Each image is hashed (MD5 of first 10KB)
2. When uploading a duplicate, you see a confirmation:
   ```
   screenshot.png appears to be a duplicate. Attach anyway?
   [Cancel] [OK]
   ```
3. Click Cancel to skip, OK to attach anyway

---

## Troubleshooting

### Images Not Uploading

**Symptom**: Drag-and-drop or file picker does nothing

**Solutions**:

1. Check file format (must be PNG, JPEG, or GIF)
2. Check file size (must be <25MB by default)
3. Check browser console for errors (F12 → Console)
4. Try a different upload method (paste instead of drag-drop)
5. Refresh the page and try again

### "Unsupported format" Error

**Symptom**: Error toast shows "Unsupported format: image/webp"

**Solutions**:

- Convert image to PNG or JPEG
- Use an online converter or:
  - **macOS**: Open in Preview → Export as PNG
  - **Windows**: Open in Paint → Save As → PNG
  - **Linux**: `convert image.webp image.png` (ImageMagick)

### "File too large" Error

**Symptom**: Error toast shows "File too large: 30.0MB. Max: 25MB"

**Solutions**:

1. Resize the image before uploading
2. Compress the image (online tools or native apps)
3. Increase limit in Settings → Image Support → Max Image Size (up to 50MB)
4. Split into multiple smaller images if possible

### "Image too large" (Dimensions)

**Symptom**: Error shows "Image too large: 10000x10000px. Max: 8192px"

**Solutions**:

- This is a hard limit (cannot be changed in settings)
- Resize image to ≤8192x8192px before uploading
- Use image editing software or online resizer

### Vision Model Not Working

**Symptom**: "Vision inference failed. Model may not support images."

**Solutions**:

1. Verify vision model is installed: `ollama list`
2. Ensure you selected a vision model (👁️ icon in dropdown)
3. Try a different vision model: `ollama pull llava`
4. Check Ollama is running: `ollama serve` (in separate terminal)
5. Restart Code Companion

### Processing Takes Too Long

**Symptom**: "Processing 5 images..." stuck for >30 seconds

**Solutions**:

1. Wait a bit longer (large images can take time)
2. Check browser isn't frozen (try clicking other UI elements)
3. If stuck >60 seconds, refresh page
4. Upload fewer images at once (queue max: 3 concurrent)
5. Resize images before uploading

### Lightbox Not Opening

**Symptom**: Clicking thumbnail does nothing

**Solutions**:

1. Check browser console for errors
2. Try different thumbnail
3. Disable browser extensions (ad blockers may interfere)
4. Refresh page

### Images Not Showing in History

**Symptom**: Sent messages with images, but images missing after reload

**Solutions**:

1. Check conversation file size (may be too large)
2. Verify `~/.code-companion/history/` directory exists
3. Check browser console for storage errors
4. Try exporting conversation (test if images included)

### Privacy Warning Keeps Appearing

**Symptom**: Warning modal shows on every upload

**Solutions**:

1. Make sure you checked "Don't show again"
2. Clear browser cache and try again
3. Check localStorage: Open DevTools → Application → Local Storage → look for `cc-image-privacy-accepted`
4. If missing, manually set: `localStorage.setItem('cc-image-privacy-accepted', 'true')`

---

## API Reference (Developers)

### Backend API Endpoints

#### POST /api/chat

Send chat messages with optional images.

**Request**:

```json
{
  "model": "llava",
  "messages": [
    {
      "role": "user",
      "content": "What do you see in this image?",
      "images": ["iVBORw0KGgo..."] // Array of base64 strings (NO data URI prefix)
    }
  ],
  "mode": "chat"
}
```

**Response**: Server-Sent Events stream

**Notes**:

- Images must be base64 **WITHOUT** `data:image/png;base64,` prefix
- Max 10 images per message (enforced server-side)
- Timeout auto-increases to 300s when images present

#### POST /api/review

Code review with optional image attachments.

**Request**:

```json
{
  "model": "llava",
  "code": "function foo() { ... }",
  "filename": "app.js",
  "images": ["iVBORw0KGgo..."]
}
```

**Response**: Streaming review with letter grades

#### POST /api/pentest

Security scan with optional vulnerability screenshots.

**Request**:

```json
{
  "model": "llava",
  "code": "app.get('/search', ...)",
  "filename": "server.js",
  "images": ["/9j/4AAQSkZJ..."]
}
```

**Response**: Streaming security report

### Frontend API (React Components)

#### Image Processing Functions

**Location**: `lib/image-processor.js`

```javascript
import {
  validateImage,
  processImage,
  extractBase64,
  generateThumbnail,
  checkVisionModel,
  hashImage,
  estimateTokens,
} from "../lib/image-processor";

// Validate image file
const result = await validateImage(file, config);
// Returns: { valid: boolean, error?: string, dimensions?: {width, height}, size: number }

// Process image (resize, compress, thumbnail)
const processed = await processImage(file, config);
// Returns: { base64, thumbnail, size, dimensions, format, hash }

// Extract base64 from data URL
const base64 = extractBase64("data:image/png;base64,iVBORw0...");
// Returns: 'iVBORw0...' (WITHOUT prefix)

// Generate thumbnail
const thumbDataURL = await generateThumbnail(dataURL, 128);
// Returns: 'data:image/jpeg;base64,...' (WITH prefix for display)

// Check if model supports vision
const isVision = checkVisionModel("llava");
// Returns: true

// Hash image for duplicate detection
const hash = hashImage(base64);
// Returns: 'a3f2b9c8d1e4f5a6...' (MD5 hex)

// Estimate tokens for API quota
const tokens = estimateTokens(base64);
// Returns: 765 (fixed for llava)
```

#### React Components

**ImageThumbnail** (`src/components/ImageThumbnail.jsx`):

```jsx
import ImageThumbnail from "./components/ImageThumbnail";

<ImageThumbnail
  src={img.thumbnail} // Data URL (WITH prefix)
  filename={img.name}
  size={img.size} // Bytes
  dimensions={img.dimensions} // {width, height}
  format={img.format} // 'png' | 'jpeg' | 'gif'
  onClick={() => openLightbox(i)}
  onRemove={() => removeImage(i)}
/>;
```

**ImageLightbox** (`src/components/ImageLightbox.jsx`):

```jsx
import ImageLightbox from "./components/ImageLightbox";

<ImageLightbox
  isOpen={lightboxOpen}
  onClose={closeLightbox}
  src={lightboxImage.src} // Data URL
  filename={lightboxImage.filename}
  images={allImages} // Array of data URLs
  currentIndex={lightboxIndex}
  onNavigate={navigateLightbox} // (newIndex) => void
/>;
```

### Configuration Schema

**Location**: `.cc-config.json`

```json
{
  "imageSupport": {
    "enabled": true,
    "maxSizeMB": 25,
    "maxDimensionPx": 8192,
    "compressionQuality": 0.9,
    "maxImagesPerMessage": 10,
    "resizeThreshold": 2048,
    "warnOnFirstUpload": true
  }
}
```

### Message Schema (Conversation History)

**Location**: `~/.code-companion/history/[id].json`

```json
{
  "metadata": {
    "id": "abc123",
    "title": "Debug UI bug with screenshot",
    "created": 1234567890,
    "model": "llava"
  },
  "messages": [
    {
      "role": "user",
      "content": "What's wrong with this layout?",
      "images": ["iVBORw0KGgo..."] // Array of base64 (NO prefix)
    },
    {
      "role": "assistant",
      "content": "Looking at your screenshot, the issue is..."
    }
  ]
}
```

**Important**: Images stored as base64 **WITHOUT** data URI prefix to save space.

### Processing Queue

**Location**: `src/App.jsx` (lines 193-197, 688-713)

```javascript
// State
const [processingImages, setProcessingImages] = useState(0);
const processingQueue = useRef([]);
const activeProcessing = useRef(new Set());
const MAX_CONCURRENT_PROCESSING = 3;

// Queue an image for processing
async function queueImageProcessing(file, config) {
  return new Promise((resolve, reject) => {
    processingQueue.current.push({ file, config, resolve, reject });
    processNextInQueue();
  });
}

// Process next in queue (max 3 concurrent)
async function processNextInQueue() {
  if (activeProcessing.current.size >= MAX_CONCURRENT_PROCESSING) return;
  if (processingQueue.current.length === 0) return;

  const { file, config, resolve, reject } = processingQueue.current.shift();
  activeProcessing.current.add(file.name);
  setProcessingImages((prev) => prev + 1);

  try {
    const result = await processImage(file, config);
    resolve(result);
  } catch (err) {
    reject(err);
  } finally {
    activeProcessing.current.delete(file.name);
    setProcessingImages((prev) => prev - 1);
    processNextInQueue();
  }
}
```

---

## Additional Resources

- **Ollama Vision Models**: [ollama.com/library](https://ollama.com/library)
- **Code Companion Docs**: [github.com/Th3rdAI/AIApp-CodeCompanion](https://github.com/Th3rdAI/AIApp-CodeCompanion)
- **Model Context Protocol**: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **Report Issues**: [github.com/Th3rdAI/AIApp-CodeCompanion/issues](https://github.com/Th3rdAI/AIApp-CodeCompanion/issues)

---

**Last Updated**: 2026-03-17
**Version**: 1.5.0 (Image Support Release)
