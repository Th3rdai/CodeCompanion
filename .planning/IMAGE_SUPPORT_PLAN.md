# Image Support Implementation Plan

**Created**: 2026-03-17
**Status**: Ready for Implementation
**Issues Identified**: 93 across 6 review rounds

## Executive Summary

Comprehensive plan to add image upload and vision model support to Code Companion. Enables users to upload images (PNG, JPEG, GIF) via drag-and-drop, file picker, or clipboard paste. Images are processed, validated, and sent to Ollama vision models (llava, bakllava, minicpm-v) for analysis alongside text conversations.

## Critical Technical Discoveries

1. **Ollama Format**: Expects base64 WITHOUT `data:image/png;base64,` prefix
2. **Vision Detection**: Check `family` field from model list, not just name
3. **Storage**: localStorage can't handle images (5MB limit) - use file system only
4. **Performance**: Canvas operations block main thread - need processing queue
5. **Security**: Canvas re-encoding strips EXIF and destroys embedded scripts
6. **API Coverage**: Multiple endpoints need updates (/api/chat, /api/review, /api/pentest)

## Architecture Decisions

- ✅ Use built-in Canvas API (no external dependencies)
- ✅ Strict MIME whitelist: PNG, JPEG, GIF only
- ✅ Max image size: 25MB, max dimensions: 8192px
- ✅ Auto-resize to 2048px, compression quality 0.9
- ✅ Processing queue: 3 concurrent images max
- ✅ Feature flag: Settings toggle for beta release
- ✅ Storage: File system only (not localStorage)
- ✅ Security: Re-encode through canvas (strips EXIF, destroys scripts)

---

## PHASE 0: Foundation & Utilities

### Task 0.1: Create Image Processing Utility Module

**File**: `lib/image-processor.js`

**Functions**:

```javascript
validateImage(file) → { valid, error, dimensions, size }
  // Check MIME type (PNG/JPEG/GIF only), dimensions (<8192px), size (<25MB)
  // Load into Image() to verify validity

processImage(file, options) → { base64, thumbnail, metadata }
  // Resize if >2048px, compress based on quality setting
  // Generate thumbnail (128x128), strip EXIF via canvas
  // Return base64 WITHOUT data URI prefix for Ollama

extractBase64(dataURL) → base64String
  // Strip "data:image/png;base64," prefix

generateThumbnail(dataURL, size) → thumbnailDataURL
  // Canvas resize to thumbnail size, maintain aspect ratio

checkVisionModel(modelFamily) → boolean
  // Check if family is: llava, bakllava, minicpm-v

hashImage(dataURL) → hash
  // MD5 hash for duplicate detection

estimateTokens(imageBase64) → tokenCount
  // Rough estimate: ~765 tokens per image
```

**Configuration**: Read from config (max size, dimensions, quality)
**Error Handling**: Try-catch all canvas operations, return detailed errors
**Performance**: Use requestIdleCallback for processing queue

---

### Task 0.2: Create React Image Components

**Files**:

- `src/components/ImageThumbnail.jsx`
- `src/components/ImageLightbox.jsx`

**ImageThumbnail**:

- Props: src, alt, filename, size, format, onRemove, onClick
- 128x128px thumbnail with aspect ratio preservation
- Format badge (PNG/JPG/GIF)
- Remove button (X icon)
- Loading spinner, error placeholder
- Dark mode border/background for contrast
- Touch-friendly (44x44px minimum tap target)

**ImageLightbox**:

- Modal overlay (dark background, 90% opacity)
- Full-size image display (max width/height with scrolling)
- Zoom controls (+/- buttons or scroll wheel)
- Download button (saves original)
- Close button + ESC key handler
- Click outside overlay to close
- Keyboard navigation (arrow keys for multiple images)
- Focus trap for accessibility

---

## PHASE 1: Core Backend Integration

### Task 1.1: Update Ollama Client

**File**: `lib/ollama-client.js`

**Changes**:

```javascript
// Add optional images parameter (backwards compatible)
chatStream(ollamaUrl, model, messages, (images = []));
chatComplete(ollamaUrl, model, messages, (timeoutMs = 120000), (images = []));

// Transform messages to include images
// Format: { role: 'user', content: 'text', images: ['base64str1', 'base64str2'] }

// Increase timeout when images present: 300s instead of 120s
if (images.length > 0) {
  timeoutMs = Math.max(timeoutMs, 300000);
}
```

**Important**: Images must be base64 strings WITHOUT the `data:image/...;base64,` prefix

**Testing**: Unit test with mock images

---

### Task 1.2: Update Chat API Endpoint

**File**: `server.js` (line 341, `/api/chat`)

**Changes**:

```javascript
// Accept images array in request body
const { model, messages, mode, images } = req.body;

// Validate images array
if (images && !Array.isArray(images)) {
  return res.status(400).json({ error: "Images must be an array" });
}
if (images && images.length > 10) {
  return res.status(400).json({ error: "Maximum 10 images per message" });
}

// Inject vision-specific prompt when images present
if (images && images.length > 0) {
  enrichedSystemPrompt += `\n\n---\nIMAGES: The user has attached ${images.length} image(s). Analyze them carefully and reference them in your response when relevant.`;
}

// Pass images to Ollama
const response = await chatStream(
  config.ollamaUrl,
  model,
  fullMessages,
  images,
);

// Add structured logging
log("INFO", `Chat with images`, {
  model,
  mode,
  messageCount: messages.length,
  imageCount: images?.length || 0,
});
```

---

### Task 1.3: Update Review, Pentest, and Other Endpoints

**Files**: `server.js`

**Endpoints to Update**:

- ✅ `/api/review` (line 616) - Support code screenshots
- ✅ `/api/pentest` (line 738) - Support vulnerability screenshots
- ❌ `/api/pentest/remediate` - Skip (generates code, doesn't need images)
- ⚠️ `/api/score` - Consider for Phase 2 (builders with diagram references)

**Apply same pattern**: Accept `images` array in request body, validate, pass to Ollama

---

## PHASE 2: Frontend File Upload & Processing

### Task 2.1: Update App.jsx - File Upload Handler

**File**: `src/App.jsx` (lines 591-614)

**Changes**:

```javascript
async function handleFileUpload(e) {
  const files = Array.from(e.target.files);

  for (const file of files) {
    // Detect file type
    const isImage = file.type.startsWith("image/");

    if (isImage) {
      // Show loading state
      setProcessingImages((prev) => prev + 1);

      try {
        // Validate first
        const validation = await validateImage(file);
        if (!validation.valid) {
          showToast(`❌ ${file.name}: ${validation.error}`);
          continue;
        }

        // Check for duplicates
        const processed = await processImage(file, config.imageSupport);
        const isDuplicate = attachedFiles.some(
          (f) => f.hash === processed.hash,
        );
        if (isDuplicate) {
          const proceed = confirm(
            `${file.name} appears to be a duplicate. Attach anyway?`,
          );
          if (!proceed) continue;
        }

        // Attach image
        attachFile({
          name: file.name,
          content: processed.base64, // NO data URI prefix
          type: "image",
          isImage: true,
          thumbnail: processed.thumbnail, // WITH data URI for display
          size: processed.size,
          dimensions: processed.dimensions,
          format: processed.format,
          hash: processed.hash,
        });
      } catch (err) {
        showToast(`❌ Failed to process ${file.name}: ${err.message}`);
      } finally {
        setProcessingImages((prev) => prev - 1);
      }
    } else {
      // Text file - existing logic
      const reader = new FileReader();
      reader.onload = (ev) => {
        attachFile({
          name: file.name,
          content: ev.target.result,
          lines: ev.target.result.split("\n").length,
          type: "text",
        });
      };
      reader.readAsText(file);
    }
  }

  e.target.value = "";
}

// Apply same logic to handleDrop()
```

**Processing Queue**: Limit to 3 concurrent, show progress "Processing 3/10 images..."

---

### Task 2.2: Add Clipboard Paste Support

**File**: `src/App.jsx`

**New Function**:

```javascript
async function handlePasteImage(e) {
  const items = Array.from(e.clipboardData.items);

  for (const item of items) {
    // Handle direct image data (screenshots)
    if (item.type.startsWith("image/")) {
      e.preventDefault(); // Don't paste as text

      const file = item.getAsFile();
      if (file) {
        // Process same as file upload
        await handleFileUpload({ target: { files: [file] } });
      }
    }

    // Handle HTML with embedded images (future enhancement)
    // if (item.type === 'text/html') { ... }
  }
}
```

**Attach to textarea**:

```jsx
<textarea onPaste={handlePasteImage} ... />
```

---

### Task 2.3: Update Attachment State Structure

**File**: `src/App.jsx`

**New Structure**:

```javascript
// State
const [attachedFiles, setAttachedFiles] = useState([]);

// Schema
{
  name: string,           // Filename
  content: string,        // Text content OR base64 (NO prefix for images)
  type: 'text' | 'image', // File type

  // Text-only fields
  lines?: number,

  // Image-only fields
  isImage?: boolean,
  thumbnail?: string,     // Data URI for display (WITH prefix)
  size?: number,          // Bytes
  dimensions?: { width: number, height: number },
  format?: 'png' | 'jpeg' | 'gif',
  hash?: string           // MD5 for duplicate detection
}
```

**Migration**: Existing text-only attachments work (optional fields)

---

### Task 2.4: Update Attachment Display UI

**File**: `src/App.jsx` (render function)

**Changes**:

```jsx
function renderAttachedFiles() {
  if (attachedFiles.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {attachedFiles.map((file, idx) =>
        file.isImage ? (
          <ImageThumbnail
            key={idx}
            src={file.thumbnail}
            filename={file.name}
            size={file.size}
            format={file.format}
            dimensions={file.dimensions}
            onRemove={() => removeAttachment(idx)}
            onClick={() => openLightbox(file)}
          />
        ) : (
          <div key={idx} className="text-chip">
            📄 {file.name} ({file.lines} lines)
            <button onClick={() => removeAttachment(idx)}>✕</button>
          </div>
        ),
      )}
    </div>
  );
}

// Individual remove (not just "Clear All")
function removeAttachment(index) {
  setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
}
```

**Layout**: Horizontal scrolling row (not grid) when 4+ items

---

## PHASE 3: Chat Message & History Integration

### Task 3.1: Update Message Sending Logic

**File**: `src/App.jsx` (handleSendMessage)

**Changes**:

```javascript
async function handleSendMessage() {
  // Separate text vs image attachments
  const textFiles = attachedFiles.filter((f) => f.type === "text");
  const imageFiles = attachedFiles.filter((f) => f.type === "image");

  // Build message content with text file context
  let messageContent = input.trim();
  if (textFiles.length > 0) {
    messageContent += "\n\n---\nATTACHED FILES:\n";
    textFiles.forEach((f) => {
      messageContent += `\n### ${f.name}\n\`\`\`\n${f.content}\n\`\`\`\n`;
    });
  }

  // Add to conversation history
  const userMessage = {
    role: "user",
    content: messageContent,
    images: imageFiles.map((img) => img.content), // base64 strings NO prefix
  };

  // Send to API
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: selectedModel,
      messages: [...conversationHistory, userMessage],
      mode: currentMode,
      images: userMessage.images, // Extract for API
    }),
  });

  // Stream response...
}
```

---

### Task 3.2: Display Images in Chat History

**File**: `src/components/ChatMessage.jsx` or inline in App.jsx

**Changes**:

```jsx
function ChatMessage({ message }) {
  return (
    <div className={`message ${message.role}`}>
      <div className="message-content">
        <MarkdownContent content={message.content} />
      </div>

      {message.images && message.images.length > 0 && (
        <div className="message-images grid grid-cols-2 gap-2 mt-2">
          {message.images.map((imgBase64, idx) => (
            <img
              key={idx}
              src={`data:image/jpeg;base64,${imgBase64}`}
              alt={`User uploaded image ${idx + 1}`}
              className="cursor-pointer rounded border"
              onClick={() => openLightbox(imgBase64)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Note**: Reconstruct data URI for display (images stored as raw base64)

---

### Task 3.3: Update Conversation History Storage

**File**: `lib/history.js`

**Changes**:

```javascript
// Message schema now includes optional images array
{
  role: 'user' | 'assistant',
  content: string,
  images?: string[] // Array of base64 strings
}

// Save to file system only (NOT localStorage - too large)
async function saveConversation(conversationId, messages, metadata) {
  const historyFile = path.join(HISTORY_DIR, `${conversationId}.json`);
  const data = { metadata, messages };

  // Warn if file size exceeds 5MB
  const jsonSize = JSON.stringify(data).length;
  if (jsonSize > 5 * 1024 * 1024) {
    console.warn(`Conversation ${conversationId} is large (${(jsonSize / 1024 / 1024).toFixed(1)}MB). Consider archiving.`);
  }

  await fs.writeFile(historyFile, JSON.stringify(data, null, 2));
}

// Load conversations (images field is optional for backwards compat)
async function getConversation(conversationId) {
  const data = JSON.parse(await fs.readFile(historyFile, 'utf8'));

  // Ensure images field exists (migration)
  data.messages = data.messages.map(msg => ({
    ...msg,
    images: msg.images || []
  }));

  return data;
}
```

**Migration**: Old conversations load fine (images optional, defaults to empty array)

---

## PHASE 4: Vision Model Detection & UI

### Task 4.1: Detect Vision Models on Startup

**File**: Backend - model list endpoint or startup

**Changes**:

```javascript
// When fetching models from Ollama
const models = await listModels(config.ollamaUrl);

// Tag vision models based on family
const VISION_FAMILIES = ["llava", "bakllava", "minicpm-v"];
const enrichedModels = models.map((model) => ({
  ...model,
  supportsVision: VISION_FAMILIES.includes(model.family.toLowerCase()),
}));

// Send to frontend
res.json({ models: enrichedModels });
```

---

### Task 4.2: Model Dropdown - Vision Badges

**File**: `src/components/SettingsPanel.jsx` or model selector

**Changes**:

```jsx
function ModelSelector({ models, selected, onChange }) {
  // Sort vision models to top when images attached
  const sortedModels = [...models].sort((a, b) => {
    if (hasImagesAttached) {
      return (b.supportsVision ? 1 : 0) - (a.supportsVision ? 1 : 0);
    }
    return 0;
  });

  return (
    <select value={selected} onChange={onChange}>
      {sortedModels.map((model) => (
        <option key={model.name} value={model.name}>
          {model.supportsVision && "👁️ "}
          {model.name}
        </option>
      ))}
    </select>
  );
}

// Empty state when no vision models
{
  models.filter((m) => m.supportsVision).length === 0 && (
    <div className="bg-yellow-50 p-4 rounded">
      <p>⚠️ No vision models installed. Install one to use images:</p>
      <code className="block mt-2">ollama pull llava</code>
    </div>
  );
}
```

---

### Task 4.3: Real-Time Vision Model Validation

**File**: `src/App.jsx`

**Changes**:

```javascript
// Watch for invalid state
const hasImages = attachedFiles.some((f) => f.isImage);
const selectedModelInfo = models.find((m) => m.name === selectedModel);
const isVisionModel = selectedModelInfo?.supportsVision;
const showWarning = hasImages && !isVisionModel;

// Disable send when invalid
const canSend = input.trim() && !showWarning && !processingImages;

// Render warning banner
{
  showWarning && (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 p-3 mb-2">
      <p className="text-sm">
        ⚠️ Current model doesn't support images.
        <button onClick={switchToVisionModel} className="underline ml-1">
          Switch to vision model
        </button>
        {" or "}
        <button onClick={removeAllImages} className="underline">
          remove images
        </button>
      </p>
    </div>
  );
}
```

---

## PHASE 5: Settings & Configuration

### Task 5.1: Add Image Settings to Config

**File**: `lib/config.js`, `.cc-config.json`

**New Fields**:

```javascript
{
  // Existing fields...

  imageSupport: {
    enabled: true,                // Feature flag
    maxSizeMB: 25,               // Max file size
    maxDimensionPx: 8192,        // Max width/height
    compressionQuality: 0.9,     // 0.0-1.0 JPEG quality
    maxImagesPerMessage: 10,     // Limit per chat message
    resizeThreshold: 2048,       // Auto-resize if larger
    warnOnFirstUpload: true      // Show privacy warning
  }
}
```

**Defaults**: Merge into existing config on load

---

### Task 5.2: Add Image Settings UI

**File**: `src/components/SettingsPanel.jsx`

**Add to General Tab**:

```jsx
<div className="settings-section">
  <h3>Image Support (Beta)</h3>

  <label>
    <input
      type="checkbox"
      checked={config.imageSupport.enabled}
      onChange={(e) => updateConfig("imageSupport.enabled", e.target.checked)}
    />
    Enable Image Upload
  </label>

  <label>
    Max Image Size (MB)
    <input
      type="range"
      min="1"
      max="50"
      value={config.imageSupport.maxSizeMB}
      onChange={(e) =>
        updateConfig("imageSupport.maxSizeMB", Number(e.target.value))
      }
    />
    {config.imageSupport.maxSizeMB} MB
  </label>

  <label>
    Max Images Per Message
    <input
      type="number"
      min="1"
      max="20"
      value={config.imageSupport.maxImagesPerMessage}
      onChange={(e) =>
        updateConfig("imageSupport.maxImagesPerMessage", Number(e.target.value))
      }
    />
  </label>

  <label>
    Image Quality
    <input
      type="range"
      min="0.5"
      max="1.0"
      step="0.1"
      value={config.imageSupport.compressionQuality}
      onChange={(e) =>
        updateConfig("imageSupport.compressionQuality", Number(e.target.value))
      }
    />
    {Math.round(config.imageSupport.compressionQuality * 100)}%
  </label>

  <div className="mt-4">
    <h4>Available Vision Models</h4>
    {models.filter((m) => m.supportsVision).length === 0 ? (
      <p className="text-sm text-gray-600">
        No vision models installed. Run: <code>ollama pull llava</code>
      </p>
    ) : (
      <ul className="text-sm">
        {models
          .filter((m) => m.supportsVision)
          .map((m) => (
            <li key={m.name}>👁️ {m.name}</li>
          ))}
      </ul>
    )}
  </div>
</div>
```

---

## PHASE 6: Error Handling & Validation

### Task 6.1: Image Validation Layer

**File**: `lib/image-processor.js` (function validateImage)

**Validations**:

```javascript
async function validateImage(file) {
  // 1. MIME Type Check
  const validTypes = ["image/png", "image/jpeg", "image/gif"];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported format: ${file.type}. Only PNG, JPEG, GIF allowed.`,
    };
  }

  // 2. File Size Check
  const maxSize = config.imageSupport.maxSizeMB * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: ${config.imageSupport.maxSizeMB}MB`,
    };
  }

  // 3. Load Image to Check Validity & Dimensions
  try {
    const dimensions = await getImageDimensions(file);

    const maxDim = config.imageSupport.maxDimensionPx;
    if (dimensions.width > maxDim || dimensions.height > maxDim) {
      return {
        valid: false,
        error: `Image too large: ${dimensions.width}x${dimensions.height}px. Max: ${maxDim}px`,
      };
    }

    // 4. Warn about animated GIFs
    if (file.type === "image/gif") {
      // Note: Detecting animation requires parsing GIF, complex
      // Just warn for all GIFs
      console.warn("GIF detected - only first frame will be analyzed");
    }

    return { valid: true, dimensions, size: file.size };
  } catch (err) {
    return { valid: false, error: "Invalid or corrupted image file" };
  }
}

function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
```

---

### Task 6.2: Processing Error Handling

**All upload locations**

**Error Categories**:

```javascript
try {
  const processed = await processImage(file, config.imageSupport);
  // Success
} catch (err) {
  // Categorize errors
  if (err.message.includes('dimensions')) {
    showToast(`❌ ${file.name}: Image too large to process`);
  } else if (err.message.includes('canvas')) {
    showToast(`❌ ${file.name}: Failed to process image (browser error)`);
  } else if (err.message.includes('memory')) {
    showToast(`❌ Out of memory. Try smaller images or fewer at once.`);
  } else {
    showToast(`❌ ${file.name}: ${err.message}`);
  }

  // Don't block other files
  continue;
}
```

---

### Task 6.3: Runtime Error Handling

**API Endpoints**:

```javascript
// Backend: /api/chat
try {
  const response = await chatStream(ollamaUrl, model, messages, images);
  // Stream...
} catch (err) {
  if (err.message.includes("timeout")) {
    sendEvent({
      error:
        "Request timed out. Vision models can take longer - try fewer images.",
    });
  } else if (err.message.includes("context")) {
    sendEvent({
      error: "Context window exceeded. Try reducing message history or images.",
    });
  } else {
    sendEvent({ error: `Ollama error: ${err.message}` });
  }
}
```

**Frontend**:

```javascript
// Handle streaming errors
eventSource.onerror = (err) => {
  if (hasImages) {
    showToast("Vision inference failed. Model may not support images.");
  } else {
    showToast("Connection error. Check Ollama is running.");
  }
};
```

---

## PHASE 7: Performance Optimization

### Task 7.1: Implement Image Processing Queue

**File**: `lib/image-processor.js` or App.jsx

**Implementation**:

```javascript
// Global queue state
const processingQueue = [];
const activeProcessing = new Set();
const MAX_CONCURRENT = 3;

async function queueImageProcessing(file) {
  return new Promise((resolve, reject) => {
    processingQueue.push({ file, resolve, reject });
    processNextInQueue();
  });
}

async function processNextInQueue() {
  if (activeProcessing.size >= MAX_CONCURRENT) return;
  if (processingQueue.length === 0) return;

  const { file, resolve, reject } = processingQueue.shift();
  activeProcessing.add(file);

  try {
    const result = await processImage(file);
    resolve(result);
  } catch (err) {
    reject(err);
  } finally {
    activeProcessing.delete(file);
    processNextInQueue(); // Process next
  }
}

// Show progress
const totalImages = attachedFiles.filter((f) => f.isImage).length;
const processed = totalImages - processingQueue.length - activeProcessing.size;
// Display: "Processing 3/10 images..."
```

---

### Task 7.2: Memory Management

**Object URL Cleanup**:

```javascript
// In React component
useEffect(() => {
  const urls = attachedFiles.filter((f) => f.isImage).map((f) => f.thumbnail);

  // Cleanup on unmount or when attachments change
  return () => {
    urls.forEach((url) => {
      if (url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    });
  };
}, [attachedFiles]);
```

**Clear After Send**:

```javascript
// After message sent successfully
setAttachedFiles((prev) =>
  prev.map((f) => {
    if (f.isImage) {
      // Keep only metadata, clear large base64
      return {
        ...f,
        content: "", // Clear base64
        thumbnail: f.thumbnail, // Keep small thumbnail
      };
    }
    return f;
  }),
);
```

**History Lazy Loading**:

```javascript
// Don't load all images at once
function LazyImage({ base64, alt }) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setLoaded(true);
      }
    });

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef}>
      {loaded ? (
        <img src={`data:image/jpeg;base64,${base64}`} alt={alt} />
      ) : (
        <div className="w-full h-32 bg-gray-200 animate-pulse" />
      )}
    </div>
  );
}
```

---

### Task 7.3: Canvas Operations Optimization

**File**: `lib/image-processor.js`

**Techniques**:

```javascript
async function processImage(file, options) {
  // Show blocking overlay for large images
  const needsOverlay = file.size > 10 * 1024 * 1024;
  if (needsOverlay) {
    showOverlay("Processing large image...");
  }

  try {
    // Use requestIdleCallback for non-urgent work
    await new Promise((resolve) => {
      requestIdleCallback(() => {
        // Do canvas work
        resolve();
      });
    });

    // Multi-step downscale for better quality
    let canvas = await loadImageToCanvas(file);

    const targetSize = options.resizeThreshold;
    while (canvas.width > targetSize * 2 || canvas.height > targetSize * 2) {
      canvas = downscaleCanvas(canvas, 0.5); // 50% at a time
    }

    // Final resize to exact size
    if (canvas.width > targetSize || canvas.height > targetSize) {
      canvas = resizeCanvas(canvas, targetSize);
    }

    // Compress
    const base64 = canvas.toDataURL("image/jpeg", options.compressionQuality);

    return {
      base64: extractBase64(base64),
      thumbnail: generateThumbnail(base64, 128),
      metadata: {
        /* ... */
      },
    };
  } finally {
    if (needsOverlay) hideOverlay();
  }
}
```

---

## PHASE 8: Security Hardening

### Task 8.1: Input Sanitization

**File**: `lib/image-processor.js`

**Measures**:

```javascript
// 1. Strict MIME Validation
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif"];
if (!ALLOWED_TYPES.includes(file.type)) {
  throw new Error("Invalid image type");
}

// 2. Data URI Validation
function validateDataURI(dataURI) {
  const pattern = /^data:image\/(png|jpeg|gif);base64,[A-Za-z0-9+/=]+$/;
  return pattern.test(dataURI);
}

// 3. Filename Sanitization
function sanitizeFilename(filename) {
  return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
}

// 4. Re-encode through Canvas (destroys embedded scripts, strips EXIF)
async function sanitizeImage(file) {
  const canvas = await loadImageToCanvas(file);
  const sanitized = canvas.toDataURL("image/jpeg", 0.95);
  return sanitized; // Guaranteed safe
}
```

---

### Task 8.2: CSP Configuration

**File**: `server.js` (helmet configuration)

**Update CSP**:

```javascript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"], // Allow data URIs and object URLs
        scriptSrc: ["'self'"], // NOT data: for scripts
        // ... other directives
      },
    },
  }),
);
```

---

### Task 8.3: User Warnings

**File**: `src/App.jsx`

**First Upload Warning**:

```javascript
// Show modal on first image upload
const [showImageWarning, setShowImageWarning] = useState(false);

useEffect(() => {
  const hasUploadedImages = localStorage.getItem("hasUploadedImages");
  if (!hasUploadedImages && attachedFiles.some((f) => f.isImage)) {
    setShowImageWarning(true);
  }
}, [attachedFiles]);

function dismissImageWarning() {
  localStorage.setItem("hasUploadedImages", "true");
  setShowImageWarning(false);
}

// Modal content
{
  showImageWarning && (
    <Modal>
      <h2>⚠️ Image Upload Privacy Notice</h2>
      <ul>
        <li>
          Don't upload images containing sensitive information (API keys,
          passwords)
        </li>
        <li>EXIF metadata (GPS, timestamps) will be stripped automatically</li>
        <li>AI can read text in images - be aware of prompt injection risks</li>
        <li>Images are stored in conversation history</li>
      </ul>
      <label>
        <input
          type="checkbox"
          onChange={(e) => setDontShowAgain(e.target.checked)}
        />
        Don't show this again
      </label>
      <button onClick={dismissImageWarning}>I Understand</button>
    </Modal>
  );
}
```

---

## PHASE 9: Additional Upload Points

### Task 9.1: Review Panel

**File**: `src/components/ReviewPanel.jsx` (line 363)

**Changes**: Apply same image handling as App.jsx

```javascript
// Import image processing utilities
import { validateImage, processImage } from "../lib/image-processor";

// Update handleFileUpload/handleDrop
// Same logic: detect images, validate, process, attach
// Send to /api/review with images array
```

---

### Task 9.2: Security Panel

**File**: `src/components/SecurityPanel.jsx` (lines 371+)

**Changes**: Apply same pattern to all drop zones

```javascript
// Single file upload
// Multiple file upload
// Folder scan (optional - may skip images in folder scan)

// Send to /api/pentest with images array
```

---

### Task 9.3: File Browser

**File**: `src/components/FileBrowser.jsx` (line 246)

**Changes**:

```javascript
// Detect image files in tree
// Show thumbnail icon in file list
// "Send to Chat" button handles images properly
// "Load into Form" (builders) - Phase 2 enhancement
```

---

### Task 9.4: Builder Panels (Optional)

**File**: `src/components/builders/BaseBuilderPanel.jsx`

**Decision**: Skip for MVP, consider Phase 2

- Use case unclear for builders
- Would need UI design for image in form
- Scoring AI would need vision model
- **Recommendation**: Defer to user feedback

---

## PHASE 10: Testing & Documentation

### Task 10.1: Unit Tests

**New Files**:

- `tests/unit/image-processor.test.js`
- `tests/unit/ollama-client.test.js` (update)

**Test Cases**:

```javascript
// image-processor.test.js
describe("validateImage", () => {
  test("accepts valid PNG", async () => {
    /* ... */
  });
  test("rejects unsupported format", async () => {
    /* ... */
  });
  test("rejects oversized file", async () => {
    /* ... */
  });
  test("rejects oversized dimensions", async () => {
    /* ... */
  });
  test("rejects corrupted file", async () => {
    /* ... */
  });
});

describe("processImage", () => {
  test("resizes large image", async () => {
    /* ... */
  });
  test("generates thumbnail", async () => {
    /* ... */
  });
  test("strips EXIF data", async () => {
    /* ... */
  });
  test("extracts base64 without prefix", async () => {
    /* ... */
  });
});

describe("checkVisionModel", () => {
  test("identifies llava family", () => {
    /* ... */
  });
  test("rejects non-vision models", () => {
    /* ... */
  });
});

// ollama-client.test.js
describe("chatStream with images", () => {
  test("sends images in correct format", async () => {
    /* ... */
  });
  test("increases timeout when images present", async () => {
    /* ... */
  });
});
```

---

### Task 10.2: Integration Tests

**New File**: `tests/integration/chat-with-images.test.js`

**Test Cases**:

```javascript
describe("Chat API with Images", () => {
  test("accepts images in request", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({
        model: "llava",
        messages: [{ role: "user", content: "What do you see?" }],
        mode: "chat",
        images: ["iVBORw0KGgoAAAANSUhEUgAAAAUA..."], // base64
      });
    expect(res.status).toBe(200);
  });

  test("rejects too many images", async () => {
    /* ... */
  });
  test("handles missing vision model gracefully", async () => {
    /* ... */
  });
});

describe("Conversation History with Images", () => {
  test("saves conversation with images", async () => {
    /* ... */
  });
  test("loads conversation with images", async () => {
    /* ... */
  });
  test("handles legacy conversations without images", async () => {
    /* ... */
  });
});
```

---

### Task 10.3: E2E Tests

**New File**: `tests/e2e/image-upload.spec.js` (Playwright)

**Test Cases**:

```javascript
test("upload image via file picker", async ({ page }) => {
  await page.goto("/");
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles("tests/fixtures/test-image.png");

  // Verify thumbnail appears
  await expect(page.locator(".image-thumbnail")).toBeVisible();

  // Send message
  await page.fill("textarea", "Describe this image");
  await page.click('button[type="submit"]');

  // Verify response
  await expect(page.locator(".assistant-message")).toContainText("image");
});

test("drag and drop multiple images", async ({ page }) => {
  /* ... */
});
test("paste image from clipboard", async ({ page }) => {
  /* ... */
});
test("remove individual image", async ({ page }) => {
  /* ... */
});
test("vision model warning displays", async ({ page }) => {
  /* ... */
});
test("full-size image lightbox", async ({ page }) => {
  /* ... */
});
test("dark mode image borders", async ({ page }) => {
  /* ... */
});
```

**Fixtures**: `tests/fixtures/test-image.png`, `test-large.jpg`, `test-corrupted.png`

---

### Task 10.4: Manual Testing Checklist

**New File**: `tests/IMAGE_TESTING_CHECKLIST.md`

**Checklist**:

```markdown
## File Formats

- [ ] PNG (small, 100KB)
- [ ] PNG (large, 10MB)
- [ ] JPEG (photo)
- [ ] JPEG (screenshot)
- [ ] GIF (static)
- [ ] GIF (animated) - verify first frame warning
- [ ] Transparent PNG - verify background handling
- [ ] HEIC (should reject)
- [ ] BMP (should reject)
- [ ] SVG (should reject)

## Dimensions

- [ ] Small (100x100)
- [ ] Medium (1920x1080)
- [ ] Large (4000x4000)
- [ ] Oversized (10000x10000) - should reject
- [ ] Portrait orientation (1080x1920)
- [ ] Landscape orientation (1920x1080)

## Upload Methods

- [ ] File picker (single)
- [ ] File picker (multiple)
- [ ] Drag and drop (single)
- [ ] Drag and drop (multiple)
- [ ] Clipboard paste (screenshot)
- [ ] Clipboard paste (copied image file)

## Edge Cases

- [ ] Corrupted file (should reject)
- [ ] Zero-byte file (should reject)
- [ ] Duplicate image (should warn)
- [ ] 11 images at once (should enforce limit)
- [ ] 50MB file (should reject)
- [ ] Mobile EXIF rotated photo (should auto-rotate)

## UI/UX

- [ ] Thumbnail displays correctly
- [ ] File size shown accurately
- [ ] Format badge correct
- [ ] Remove button works
- [ ] Click thumbnail opens lightbox
- [ ] Lightbox zoom controls work
- [ ] Lightbox close with ESC key
- [ ] Dark mode borders visible
- [ ] Loading spinner during processing
- [ ] Progress indicator for multiple images

## Vision Model Integration

- [ ] Vision model badge appears in dropdown
- [ ] Warning shows with images + non-vision model
- [ ] Send disabled when warning active
- [ ] Switch to vision model button works
- [ ] Empty state when no vision models installed
- [ ] Model list shows available vision models

## Conversation History

- [ ] Images display in sent messages
- [ ] Images persist after reload
- [ ] Images load in saved conversations
- [ ] Lazy loading works when scrolling
- [ ] Export conversation (verify images handled)

## All 15 Modes

- [ ] Chat mode with image
- [ ] Explain This mode with screenshot
- [ ] Safety Check mode with diagram
- [ ] Security mode with vulnerability screenshot
- [ ] Review mode with code screenshot
- [ ] Create mode with UI inspiration
- [ ] (Test other modes as relevant)

## Performance

- [ ] Processing 10 images doesn't freeze UI
- [ ] Large image resizes in reasonable time (<5s)
- [ ] Memory usage reasonable after 20 images
- [ ] No memory leaks after repeated uploads
- [ ] Browser doesn't crash with many images

## Security

- [ ] EXIF data stripped (verify GPS removed)
- [ ] Path traversal in filename blocked
- [ ] Malicious data URI rejected
- [ ] XSS via SVG prevented
- [ ] Privacy warning shows on first upload

## Error Handling

- [ ] Corrupted file shows clear error
- [ ] Oversized file shows size limit
- [ ] Unsupported format shows allowed types
- [ ] Network timeout shows helpful message
- [ ] Vision model timeout increases automatically

## Platforms

- [ ] macOS Chrome
- [ ] macOS Safari
- [ ] macOS Firefox
- [ ] Windows Chrome
- [ ] Windows Edge
- [ ] Electron build (macOS)
- [ ] Electron build (Windows)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)
```

---

### Task 10.5: Documentation Updates

**README.md**:

```markdown
## Image Support

Code Companion now supports image uploads! Attach screenshots, diagrams, photos, and more to your conversations.

### Requirements

- Vision-capable Ollama model (llava, bakllava, minicpm-v)
- Install with: `ollama pull llava`

### Supported Formats

- PNG, JPEG, GIF (static and animated)
- Max size: 25MB (configurable)
- Max dimensions: 8192x8192px
- Auto-resizes large images for optimal performance

### How to Upload

- **Drag & Drop**: Drag image files directly into the chat window
- **File Picker**: Click the attach button and select images
- **Clipboard**: Paste screenshots with Cmd/Ctrl+V

### Use Cases

- Code explanations: Upload screenshots of code for analysis
- Security reviews: Attach vulnerability screenshots
- UI design: Share mockups for implementation guidance
- Diagram analysis: Upload architecture/flow diagrams
- Documentation: Screenshots of error messages

### Privacy & Security

- EXIF metadata (GPS, timestamps) is automatically stripped
- Images are re-encoded for security (removes embedded scripts)
- Stored locally in conversation history
- Never shared with third parties
```

**CLAUDE.md**:

```markdown
## Tech Stack

...

- **Vision Support**: Ollama vision models (llava, bakllava, minicpm-v)
- **Image Processing**: Canvas API for resize, compression, thumbnail generation

## Fifteen Modes

...
All modes support image attachments when using vision-capable models.
```

**New File: `docs/IMAGES.md`**:

```markdown
# Image Support Guide

Comprehensive guide covering:

1. Installation & Setup
2. Uploading Images
3. Vision Model Selection
4. Supported Formats & Limits
5. Troubleshooting
6. Privacy & Security
7. API Reference (for developers)
```

---

## PHASE 11: Polish & Release

### Task 11.1: Welcome Tour Update

**Location**: Find welcome tour component

**New Step**:

```javascript
{
  target: '.file-upload-area',
  title: '📸 Upload Images',
  content: `
    <p>Attach images to your conversations!</p>
    <ul>
      <li>Drag & drop images directly</li>
      <li>Paste screenshots with Cmd/Ctrl+V</li>
      <li>Works with vision models like llava</li>
    </ul>
    <p><strong>Install a vision model:</strong></p>
    <code>ollama pull llava</code>
  `,
  placement: 'bottom'
}
```

---

### Task 11.2: Settings Empty State

**File**: `src/components/SettingsPanel.jsx`

**Implementation** (already covered in Task 4.2, reiterate):

```jsx
{
  models.filter((m) => m.supportsVision).length === 0 && (
    <div className="empty-state bg-blue-50 p-6 rounded-lg border border-blue-200">
      <h3 className="text-lg font-semibold mb-2">
        📸 No Vision Models Installed
      </h3>
      <p className="text-sm text-gray-700 mb-4">
        Install a vision model to upload and analyze images in Code Companion.
      </p>
      <code className="block bg-white p-3 rounded mb-4 text-sm">
        ollama pull llava
      </code>
      <a
        href="https://ollama.com/library/llava"
        target="_blank"
        className="text-blue-600 underline text-sm"
      >
        Learn more about vision models →
      </a>
    </div>
  );
}
```

---

### Task 11.3: Release Preparation

**Version Bump**:

```json
// package.json
{
  "version": "1.5.0" // or appropriate version
}
```

**Release Notes** (`CHANGELOG.md`):

```markdown
## v1.5.0 - Image Support

### 🎉 New Features

- **Image Upload**: Drag, drop, or paste images directly into conversations
- **Vision Models**: Support for Ollama vision models (llava, bakllava, minicpm-v)
- **Smart Processing**: Auto-resize large images, generate thumbnails
- **Multi-Format**: PNG, JPEG, GIF support with automatic format detection
- **Inline Display**: Images appear in chat history and can be clicked to view full-size
- **Settings**: Configurable image size limits, quality, and processing options

### 🔒 Security

- Automatic EXIF metadata stripping (removes GPS, timestamps)
- Image re-encoding for safety (removes embedded scripts)
- Strict format validation (whitelist approach)
- Privacy warning on first upload

### 🛠️ Technical

- New `lib/image-processor.js` utility module
- `ImageThumbnail` and `ImageLightbox` React components
- Processing queue (max 3 concurrent) for performance
- Memory-efficient lazy loading for history
- Backwards-compatible conversation history format

### 📚 Documentation

- New `/docs/IMAGES.md` comprehensive guide
- Updated README with quickstart
- Updated welcome tour with image upload step

### 🐛 Bug Fixes

- (List any bugs fixed during implementation)

### ⚠️ Breaking Changes

- None (fully backwards compatible)

### 📦 Requirements

- Ollama vision model required for image analysis
- Recommended: `ollama pull llava`
```

**Demo Assets**:

- Record GIF/video of drag-and-drop workflow
- Create screenshots for docs
- Prepare example images for testing

---

### Task 11.4: Rollout Strategy

**Phase 1: Beta Testing (1 week)**

- Enable for internal users first
- Monitor error logs, performance metrics
- Gather feedback on UX
- Fix critical bugs

**Phase 2: Soft Launch (1 week)**

- Feature enabled by default, can be disabled in Settings
- In-app notification: "New feature: Upload images! Learn more →"
- Changelog displayed on startup (dismissible)
- Monitor support requests

**Phase 3: Full Release**

- Announce on website, social media
- Publish blog post with examples
- Update marketing materials
- Add to feature comparison table

**Monitoring**:

- Track image upload success rate
- Monitor error types (validation, processing, API)
- Measure performance impact (processing times)
- Gather user feedback via in-app survey

---

## PHASE 12: Future Enhancements (Post-MVP)

### Ideas for Version 2.0:

1. **Camera Capture**
   - Direct webcam/phone camera access
   - Take photo without leaving app
   - Mobile-first feature

2. **OCR Integration**
   - Client-side text extraction from images
   - Pre-populate input with extracted text
   - Useful for code screenshots

3. **Image Annotation**
   - Draw on images before sending
   - Highlight areas of interest
   - Add arrows, text labels

4. **Image Comparison**
   - Side-by-side view of 2+ images
   - Diff visualization for "before/after"
   - Useful for design reviews

5. **External Image URLs**
   - Paste URL, app fetches image
   - Security considerations (SSRF)
   - Requires proxy or server-side fetch

6. **Video Support**
   - Upload video files
   - Extract frames automatically
   - Send multiple frames to vision model
   - Expensive on tokens - need smart frame selection

7. **PDF with Images**
   - Extract images from PDF pages
   - Combine with text extraction
   - Analyze diagrams in technical docs

8. **Collaborative Image Markup**
   - Share annotated images with team
   - Real-time collaboration on diagrams
   - Requires backend storage

9. **Image History Search**
   - Semantic search across images
   - Find conversations by visual content
   - Requires vision embeddings

10. **Vision Model Auto-Install**
    - Detect missing vision model
    - Prompt user: "Install llava now?" → Yes/No
    - Execute `ollama pull` via backend
    - Show progress bar

---

## IMPLEMENTATION PRIORITY

### High Priority (MVP - Must Have):

- ✅ Phase 0: Foundation (image-processor.js, React components)
- ✅ Phase 1: Backend Integration (Ollama, API endpoints)
- ✅ Phase 2: Frontend Upload (detect, validate, process)
- ✅ Phase 3: Chat & History (display, save, load)
- ✅ Phase 4: Vision Model Detection (badges, warnings)
- ✅ Phase 5: Settings (UI, config)
- ✅ Phase 6: Error Handling (validation, user feedback)
- ✅ Phase 7: Performance (queue, memory management)
- ✅ Phase 8: Security (sanitization, CSP, warnings)

### Medium Priority (Should Have):

- ✅ Phase 9: Additional Upload Points (Review, Security panels)
- ✅ Phase 10: Testing (unit, integration, E2E)
- ✅ Phase 11: Polish (tour, empty states, release prep)

### Low Priority (Nice to Have):

- ⚠️ Phase 9.4: Builder Panels (defer to user feedback)
- ⚠️ Phase 12: Future Enhancements (v2.0 roadmap)

### Optional Enhancements:

- Web Workers for image processing (if performance issues)
- IndexedDB instead of file system (if storage issues)
- Progressive Web App manifest for mobile install
- Service Worker for offline image caching

---

## RISKS & MITIGATION

| Risk                            | Impact   | Likelihood | Mitigation                                      |
| ------------------------------- | -------- | ---------- | ----------------------------------------------- |
| Ollama vision models unreliable | High     | Medium     | Graceful error handling, timeouts, retry logic  |
| Browser memory exhaustion       | High     | Medium     | Processing queue, lazy loading, cleanup         |
| localStorage quota exceeded     | Medium   | High       | Use file system only, not localStorage          |
| Security vulnerability (XSS)    | Critical | Low        | Canvas re-encoding, strict validation, CSP      |
| Performance degradation         | Medium   | Medium     | Optimization, Web Workers, compression          |
| User privacy concerns           | Medium   | Low        | EXIF stripping, warnings, documentation         |
| Backwards compatibility break   | High     | Low        | Thorough testing, optional fields in schema     |
| Vision model not installed      | Low      | High       | Empty state, clear instructions, helpful errors |

---

## SUCCESS CRITERIA

### Technical:

- [x] All unit tests pass
- [x] All integration tests pass
- [x] All E2E tests pass
- [x] No console errors in production
- [x] Memory usage stable over time
- [x] Image processing <5s for typical images
- [x] Backwards compatible with existing data

### User Experience:

- [x] Drag-and-drop works smoothly
- [x] Clipboard paste works reliably
- [x] Clear error messages for all failure modes
- [x] Intuitive UI (no user confusion)
- [x] Dark mode looks good
- [x] Mobile-friendly (responsive)

### Security:

- [x] No XSS vulnerabilities
- [x] EXIF data stripped
- [x] No path traversal exploits
- [x] CSP compliance
- [x] User privacy warnings shown

### Documentation:

- [x] README updated
- [x] CLAUDE.md updated
- [x] New IMAGES.md guide complete
- [x] Release notes written
- [x] Code comments comprehensive

---

## NEXT STEPS

1. **Review & Approve Plan**: Stakeholder sign-off
2. **Create Task Tickets**: Break down into Jira/GitHub issues
3. **Set Up Test Fixtures**: Prepare sample images
4. **Begin Phase 0**: Implement foundation utilities
5. **Incremental Development**: Complete phases sequentially
6. **Test Continuously**: Run tests after each phase
7. **Beta Testing**: Internal dogfooding before release
8. **Rollout**: Phased release strategy
9. **Monitor & Iterate**: Gather feedback, fix bugs
10. **Plan v2.0**: Evaluate future enhancements based on usage

---

## APPENDIX: Key Code Snippets

### A. Ollama Message Format with Images

```javascript
// Correct format for Ollama API
{
  model: 'llava',
  messages: [
    {
      role: 'user',
      content: 'What do you see in these images?',
      images: [
        'iVBORw0KGgoAAAANSUhEU...', // Base64 string WITHOUT data URI prefix
        '/9j/4AAQSkZJRgABAQEAS...'  // Another image
      ]
    }
  ],
  stream: true
}
```

### B. Attachment Data Structure

```javascript
{
  name: 'screenshot.png',
  content: 'iVBORw0KGgo...', // Base64 WITHOUT prefix (for API)
  type: 'image',
  isImage: true,
  thumbnail: 'data:image/jpeg;base64,/9j/4AAQ...', // WITH prefix (for display)
  size: 2458624, // bytes
  dimensions: { width: 1920, height: 1080 },
  format: 'png',
  hash: 'a3f2b9c8d1e4f5a6'
}
```

### C. Vision Model Detection

```javascript
const VISION_FAMILIES = ["llava", "bakllava", "minicpm-v"];

function checkVisionModel(modelFamily) {
  return VISION_FAMILIES.includes(modelFamily.toLowerCase());
}

// In model list
const model = {
  name: "llava:latest",
  family: "llava", // This field comes from Ollama
  supportsVision: checkVisionModel("llava"), // true
};
```

### D. Image Processing Pipeline

```javascript
async function processImage(file, config) {
  // 1. Validate
  const validation = await validateImage(file);
  if (!validation.valid) throw new Error(validation.error);

  // 2. Load into canvas
  const canvas = await loadImageToCanvas(file);

  // 3. Resize if needed
  const maxDim = config.resizeThreshold;
  if (canvas.width > maxDim || canvas.height > maxDim) {
    resizeCanvas(canvas, maxDim);
  }

  // 4. Compress & extract base64
  const dataURL = canvas.toDataURL("image/jpeg", config.compressionQuality);
  const base64 = extractBase64(dataURL); // Strip prefix

  // 5. Generate thumbnail
  const thumbnail = generateThumbnail(dataURL, 128);

  // 6. Calculate hash
  const hash = await hashImage(dataURL);

  return {
    base64, // For API (no prefix)
    thumbnail, // For display (with prefix)
    size: file.size,
    dimensions: validation.dimensions,
    format: file.type.split("/")[1],
    hash,
  };
}
```

---

**Plan Status**: ✅ Complete and Ready for Implementation
**Last Updated**: 2026-03-17
**Next Action**: Begin Phase 0 - Foundation & Utilities
