# Image Support - Manual Testing Checklist

**Purpose**: Comprehensive testing checklist for image upload and vision model support across Code Companion.

**Test Date**: \***\*\_\_\_\*\***
**Tester**: \***\*\_\_\_\*\***
**Ollama Version**: \***\*\_\_\_\*\***
**Vision Model**: \***\*\_\_\_\*\*** (e.g., llava:latest)

---

## Pre-Test Setup

### Environment Setup

- [ ] Ollama running and accessible at configured URL
- [ ] At least one vision model installed (`ollama pull llava`)
- [ ] Code Companion server running (`npm run dev`)
- [ ] Browser DevTools console open (monitor for errors)
- [ ] Clear localStorage if testing privacy warning: `localStorage.removeItem('cc-image-privacy-accepted')`

### Test Images Prepared

- [ ] Small PNG (< 1MB, < 1000px) - e.g., screenshot
- [ ] Large JPEG (5-10MB, 3000x3000px) - for resize testing
- [ ] Animated GIF (< 5MB) - to verify first-frame handling
- [ ] Multiple images (5-10 different screenshots)
- [ ] Invalid formats: SVG, WebP, BMP (for rejection testing)
- [ ] Oversized image (> 25MB or > 8192px) - for validation testing
- [ ] Corrupted image file (intentionally damaged)

---

## Phase 0-2: Main Chat Image Support

### Upload Methods

#### File Picker Upload

- [ ] Click "📎 Upload" button
- [ ] Select single PNG image
- [ ] **Expected**: Image processes, thumbnail appears in attachment area
- [ ] **Expected**: Processing indicator shows briefly
- [ ] **Expected**: Image name, size, dimensions display correctly
- [ ] Select multiple images (3-5)
- [ ] **Expected**: All process sequentially, thumbnails appear
- [ ] **Expected**: Processing count updates correctly (1, 2, 3...)

#### Drag-and-Drop Upload

- [ ] Drag single JPEG from desktop into chat area
- [ ] **Expected**: Drag overlay appears with "Drop image here" message
- [ ] **Expected**: On drop, image processes and attaches
- [ ] Drag multiple images (mixed PNG/JPEG)
- [ ] **Expected**: All process and attach

#### Clipboard Paste

- [ ] Take screenshot (Cmd+Shift+4 on Mac, Win+Shift+S on Windows)
- [ ] Focus textarea, press Cmd+V (Ctrl+V on Windows)
- [ ] **Expected**: Screenshot processes and attaches automatically
- [ ] **Expected**: Toast notification: "✓ Image pasted from clipboard"
- [ ] **Expected**: Filename: `pasted-image-{timestamp}.png`

### Image Display & Interaction

#### Thumbnail Display

- [ ] Upload 3 images
- [ ] **Expected**: Thumbnails display in attachment area below textarea
- [ ] **Expected**: Each thumbnail shows filename, size, dimensions
- [ ] **Expected**: Each thumbnail has "X" remove button
- [ ] Hover over thumbnail
- [ ] **Expected**: Cursor changes to pointer
- [ ] **Expected**: Hover effect visible

#### Individual Remove

- [ ] Upload 5 images
- [ ] Click "X" on 2nd image
- [ ] **Expected**: Only 2nd image removes, others remain
- [ ] **Expected**: No console errors

#### Clear All

- [ ] Upload 3 images
- [ ] Click "Clear All" button
- [ ] **Expected**: All images removed from attachment area
- [ ] **Expected**: UI returns to clean state

#### Lightbox Viewer

- [ ] Upload 3 images
- [ ] Click first thumbnail
- [ ] **Expected**: Lightbox opens with full-size image
- [ ] **Expected**: Filename displays in header
- [ ] **Expected**: Counter shows "1 / 3"
- [ ] **Expected**: Background darkens (overlay)
- [ ] Click right arrow or press → key
- [ ] **Expected**: Navigates to image 2
- [ ] **Expected**: Counter updates to "2 / 3"
- [ ] Click left arrow or press ← key
- [ ] **Expected**: Navigates back to image 1
- [ ] Press Escape key
- [ ] **Expected**: Lightbox closes
- [ ] Re-open lightbox, click outside image
- [ ] **Expected**: Lightbox closes
- [ ] Open lightbox, click "Download" button
- [ ] **Expected**: Image downloads with correct filename

### Sending Messages with Images

#### Vision Model Selected

- [ ] Select vision model (e.g., llava:latest) from dropdown
- [ ] Upload 1 image (screenshot of code with bug)
- [ ] Type message: "What's wrong with this code?"
- [ ] Click Send
- [ ] **Expected**: Message sends with image attached
- [ ] **Expected**: Image displays in user message (2-column grid)
- [ ] **Expected**: AI response references the image content
- [ ] **Expected**: Conversation saves with images

#### Non-Vision Model Warning

- [ ] Select non-vision model (e.g., llama3.1:8b)
- [ ] Upload 1 image
- [ ] **Expected**: Yellow warning banner appears
- [ ] **Expected**: Message: "This model doesn't support images. Switch to a vision model or remove the images."
- [ ] **Expected**: Send button disabled
- [ ] Click "Switch to vision model"
- [ ] **Expected**: Model changes to first available vision model
- [ ] **Expected**: Warning disappears, send button enabled
- [ ] Upload another image with non-vision model selected
- [ ] Click "Remove images"
- [ ] **Expected**: All images removed
- [ ] **Expected**: Warning disappears, send button enabled

#### Multiple Images

- [ ] Select vision model
- [ ] Upload 5 different images
- [ ] Type message: "Analyze all these screenshots"
- [ ] Click Send
- [ ] **Expected**: All 5 images display in user message
- [ ] **Expected**: Images display in 2-column grid layout
- [ ] **Expected**: AI can reference details from multiple images

### Chat History

#### Image Display in History

- [ ] Send message with 3 images
- [ ] Scroll up to see previous messages
- [ ] **Expected**: Images display in user messages
- [ ] **Expected**: Grid layout (2 columns)
- [ ] Click image in history
- [ ] **Expected**: Lightbox opens with full-size image
- [ ] **Expected**: Can navigate between images in history message

#### Conversation Persistence

- [ ] Send message with images
- [ ] Refresh page (Cmd+R / Ctrl+R)
- [ ] **Expected**: Conversation loads with images intact
- [ ] **Expected**: Images clickable in history
- [ ] **Expected**: No console errors
- [ ] Switch to different conversation
- [ ] Switch back
- [ ] **Expected**: Images still display correctly

#### Large Conversation Warning

- [ ] Send 10 messages with 2 images each
- [ ] Open browser DevTools console
- [ ] **Expected**: If conversation > 5MB, console warning appears
- [ ] **Expected**: Warning message mentions "consider archiving"

---

## Phase 4: Vision Model Detection

### Model Dropdown

- [ ] Open Settings → General tab
- [ ] Look at available models list
- [ ] **Expected**: Vision models show 👁️ badge
- [ ] **Expected**: Non-vision models have no badge
- [ ] Click main model dropdown
- [ ] **Expected**: Vision models have 👁️ badge in dropdown too

### Warning Banner Edge Cases

- [ ] Upload image with vision model selected
- [ ] Switch to non-vision model
- [ ] **Expected**: Warning appears immediately
- [ ] Remove all images
- [ ] **Expected**: Warning disappears immediately
- [ ] Upload image, switch model, remove image, upload again
- [ ] **Expected**: Warning state always accurate

---

## Phase 5: Settings & Configuration

### Settings Panel - Image Support Tab

- [ ] Open Settings (⚙️ icon)
- [ ] Navigate to Image Support section
- [ ] **Expected**: Section visible with 4 controls

#### Enable/Disable Toggle

- [ ] Toggle "Enable image support" OFF
- [ ] Close settings
- [ ] **Expected**: Upload button and drag-drop disabled
- [ ] **Expected**: Paste image doesn't work
- [ ] Re-enable, verify upload works again

#### Max Size Slider

- [ ] Set max size to 5MB
- [ ] Try uploading 10MB image
- [ ] **Expected**: Validation error: "File too large: 10.0MB. Max: 5MB"
- [ ] Set back to 25MB
- [ ] Upload 10MB image
- [ ] **Expected**: Processes successfully

#### Max Images Per Message

- [ ] Set to 3
- [ ] Try uploading 5 images
- [ ] **Expected**: First 3 attach, remaining rejected
- [ ] **Expected**: Toast: "Maximum 3 images per message"

#### Compression Quality

- [ ] Set to 50%
- [ ] Upload large image
- [ ] Download from lightbox
- [ ] **Expected**: Smaller file size (more compression)
- [ ] Set to 100%
- [ ] Upload same image
- [ ] **Expected**: Larger file size (less compression)

#### Vision Models List

- [ ] Check "Available Vision Models" list
- [ ] **Expected**: Shows all installed vision models with 👁️ badges
- [ ] If no vision models installed:
  - [ ] **Expected**: Shows empty state
  - [ ] **Expected**: Message: "No vision models installed"
  - [ ] **Expected**: Shows installation instructions

---

## Phase 6: Error Handling

### Validation Errors (Before Processing)

#### Unsupported Format

- [ ] Try uploading .svg file
- [ ] **Expected**: Toast: "❌ filename.svg: Unsupported format: image/svg+xml. Only PNG, JPEG, GIF allowed."
- [ ] Try uploading .webp file
- [ ] **Expected**: Similar rejection message
- [ ] Try uploading .bmp file
- [ ] **Expected**: Similar rejection message

#### File Too Large

- [ ] Upload image > 25MB (or configured max)
- [ ] **Expected**: Toast: "❌ filename.jpg: File too large: 30.0MB. Max: 25MB"
- [ ] **Expected**: Image not attached

#### Dimensions Too Large

- [ ] Upload image > 8192px in any dimension
- [ ] **Expected**: Toast: "❌ filename.png: Image too large: 10000x8000px. Max: 8192px"
- [ ] **Expected**: Image not attached

### Processing Errors (During Processing)

#### Corrupted Image

- [ ] Upload intentionally corrupted image file
- [ ] **Expected**: Toast: "❌ filename.png: Corrupted or invalid image file"
- [ ] **Expected**: Processing counter decrements
- [ ] **Expected**: No attachment created

#### Memory Error (Hard to Reproduce)

- [ ] Upload extremely large image (20MB+, 8000x8000px)
- [ ] **Expected**: If browser runs out of memory: "❌ Out of memory. Try smaller images or fewer at once."

### Runtime Errors (During AI Inference)

#### Timeout with Images

- [ ] Upload 10 large images
- [ ] Send to vision model
- [ ] Wait for response
- [ ] If timeout occurs:
  - [ ] **Expected**: Error message: "Request timed out. Vision models can take longer - try fewer images."

#### Context Window Exceeded

- [ ] Have long conversation (many messages)
- [ ] Upload several images
- [ ] Send message
- [ ] If context limit exceeded:
  - [ ] **Expected**: Error message: "Context window exceeded. Try reducing message history or images."

#### Ollama Offline

- [ ] Stop Ollama service
- [ ] Upload image and try to send
- [ ] **Expected**: Error message: "Cannot connect to Ollama. Please check that Ollama is running."
- [ ] With images attached:
  - [ ] **Expected**: Error message: "Vision inference failed. {model} may not support images, or Ollama may not be running."

### Duplicate Detection

- [ ] Upload image-1.png
- [ ] Upload exact same file again (same image, different name)
- [ ] **Expected**: Confirmation dialog: "image-1-copy.png appears to be a duplicate. Attach anyway?"
- [ ] Click Cancel
- [ ] **Expected**: Second image not attached
- [ ] Re-upload, click OK
- [ ] **Expected**: Both images attached (duplicate allowed)

---

## Phase 8: Security & Privacy

### Privacy Warning Modal

#### First Upload

- [ ] Clear localStorage: `localStorage.removeItem('cc-image-privacy-accepted')`
- [ ] Refresh page
- [ ] Upload first image
- [ ] **Expected**: Privacy warning modal appears
- [ ] **Expected**: Modal blocks upload until accepted
- [ ] **Expected**: Modal shows 4 warnings:
  1. 🚨 Don't upload sensitive information
  2. 🔒 EXIF metadata automatically stripped
  3. 👁️ AI can read text in images
  4. 💾 Images stored locally
- [ ] Read all warnings
- [ ] Click "Cancel"
- [ ] **Expected**: Modal closes, image not attached
- [ ] Upload again
- [ ] **Expected**: Modal appears again (not remembered)

#### Accept Without "Don't Show Again"

- [ ] Privacy modal appears
- [ ] Leave "Don't show this again" unchecked
- [ ] Click "I Understand"
- [ ] **Expected**: Modal closes, image processes
- [ ] Upload another image
- [ ] **Expected**: Modal appears again

#### Accept With "Don't Show Again"

- [ ] Privacy modal appears
- [ ] Check "Don't show this again" checkbox
- [ ] Click "I Understand"
- [ ] **Expected**: Modal closes, image processes
- [ ] **Expected**: localStorage key set: `cc-image-privacy-accepted = true`
- [ ] Upload another image
- [ ] **Expected**: No modal, image processes immediately
- [ ] Refresh page, upload image
- [ ] **Expected**: Still no modal (preference persisted)

### EXIF Stripping

- [ ] Take photo with GPS-enabled phone (or use image with EXIF data)
- [ ] Upload to Code Companion
- [ ] Download processed image from lightbox
- [ ] Check EXIF data using exiftool or online viewer
- [ ] **Expected**: All EXIF metadata removed (GPS, camera info, timestamps)

### Script Injection Prevention

- [ ] Attempt to upload malicious image with embedded script (if possible)
- [ ] **Expected**: Canvas re-encoding destroys any executable code
- [ ] **Expected**: No script execution in browser
- [ ] **Expected**: Console shows no security warnings

---

## Phase 9.1: ReviewPanel Image Support

### Upload Methods (Review Mode)

#### File Picker

- [ ] Open Review mode
- [ ] Switch to "Upload File" tab
- [ ] Click "Choose File"
- [ ] Select code file (.js) and image file (.png) together
- [ ] **Expected**: Code file loads as text
- [ ] **Expected**: Image attaches as thumbnail below tabs
- [ ] **Expected**: Processing indicator shows for image

#### Drag-and-Drop

- [ ] Open Review mode, "Upload File" tab
- [ ] Drag single image into drop zone
- [ ] **Expected**: Image processes and attaches as thumbnail
- [ ] Drag code file (.py)
- [ ] **Expected**: Code loads as text, replaces previous code

### Review with Images

#### Submit Review

- [ ] Paste code snippet in "Paste Code" tab
- [ ] Upload screenshot showing bug
- [ ] Select vision model (llava:latest)
- [ ] Click "Run Code Review"
- [ ] **Expected**: Loading animation appears
- [ ] **Expected**: Review includes image analysis
- [ ] **Expected**: Report card or fallback review displays

#### Report Card with Images

- [ ] Submit code + image for review
- [ ] **Expected**: Review considers visual context
- [ ] **Expected**: Findings may reference screenshot details
- [ ] Click "Deep Dive" on a finding
- [ ] **Expected**: Deep dive conversation has access to image context

#### Multiple Images

- [ ] Upload 3 images (different bug screenshots)
- [ ] Paste code
- [ ] Run review
- [ ] **Expected**: All 3 images sent to API
- [ ] **Expected**: Review considers all visual evidence

### Image Management (Review Mode)

- [ ] Upload 4 images
- [ ] **Expected**: Thumbnails display below tabs
- [ ] **Expected**: Shows count: "Attached Images (4)"
- [ ] Click thumbnail
- [ ] **Expected**: Lightbox opens
- [ ] Remove single image
- [ ] **Expected**: Count updates to (3)
- [ ] Click "Clear All"
- [ ] **Expected**: All images removed
- [ ] Click "Review Another"
- [ ] **Expected**: Images cleared, back to input phase

---

## Phase 9.2: SecurityPanel Image Support

### Upload Methods (Security Mode)

#### Single File Upload

- [ ] Open Security mode
- [ ] Upload single image (vulnerability screenshot)
- [ ] **Expected**: Image attaches as thumbnail
- [ ] Upload single code file
- [ ] **Expected**: Code loads as text

#### Multiple Files Upload (Mixed)

- [ ] Select 3 code files + 2 images together
- [ ] **Expected**: Code files combine with `── File: name ──` separators
- [ ] **Expected**: Images attach as separate thumbnails
- [ ] **Expected**: Filename shows: "3 text files"
- [ ] **Expected**: 2 image thumbnails display

#### Drag-and-Drop Single File

- [ ] Drag single image
- [ ] **Expected**: Image attaches as thumbnail
- [ ] Drag single code file
- [ ] **Expected**: Code loads as text

#### Drag-and-Drop Folder

- [ ] Drag folder containing code files and images
- [ ] **Expected**: Only code files scanned (recursive)
- [ ] **Expected**: Images ignored (intentional)
- [ ] **Expected**: Shows: "folder-name (15 files)"
- [ ] **Expected**: No image thumbnails (correct behavior)

### Security Scan with Images

#### Single File + Image

- [ ] Paste vulnerable code
- [ ] Upload screenshot of error message
- [ ] Select vision model
- [ ] Click "Scan for Vulnerabilities"
- [ ] **Expected**: Security report includes image analysis
- [ ] **Expected**: OWASP categories reference visual evidence

#### Multiple Files + Images

- [ ] Upload 5 code files + 3 error screenshots
- [ ] Run security scan
- [ ] **Expected**: All code files combined for scanning
- [ ] **Expected**: All 3 images sent to API
- [ ] **Expected**: Report considers both code and visual context

#### Remediation with Images

- [ ] Complete security scan with images
- [ ] Click "Remediate" button
- [ ] **Expected**: Remediation dialog appears
- [ ] **Expected**: AI generates fixes considering visual context
- [ ] **Expected**: Download zip includes original + remediated code

### Folder Scan Behavior

- [ ] Scan folder with images inside
- [ ] **Expected**: Images NOT included (correct)
- [ ] **Expected**: Only text files (.js, .py, etc.) scanned
- [ ] **Expected**: No image thumbnails appear
- [ ] **Reasoning**: Intentional design for performance and relevance

---

## Edge Cases & Stress Tests

### Rapid Sequential Uploads

- [ ] Upload 10 images as fast as possible
- [ ] **Expected**: All process successfully
- [ ] **Expected**: Processing count increments/decrements correctly
- [ ] **Expected**: No race conditions
- [ ] **Expected**: All thumbnails appear in order

### Large Image Auto-Resize

- [ ] Upload 5000x5000px image
- [ ] **Expected**: Image auto-resizes to 2048px max dimension
- [ ] **Expected**: Quality preserved (multi-step downscaling)
- [ ] **Expected**: Thumbnail generated correctly
- [ ] Download from lightbox, check dimensions
- [ ] **Expected**: Max dimension ≤ 2048px

### GIF First Frame

- [ ] Upload animated GIF
- [ ] **Expected**: Console warning: "GIF detected - only first frame will be analyzed"
- [ ] Send to vision model
- [ ] **Expected**: AI analyzes only first frame (expected behavior)

### Browser Compatibility

- [ ] Test in Chrome
  - [ ] All features work
- [ ] Test in Firefox
  - [ ] All features work
- [ ] Test in Safari
  - [ ] All features work (especially clipboard paste)
- [ ] Test in Edge
  - [ ] All features work

### Mobile/Touch (If Applicable)

- [ ] Test on mobile browser
- [ ] **Expected**: File picker works
- [ ] **Expected**: Can take photo with camera (if implemented)
- [ ] **Expected**: Drag-drop may not work (browser limitation)

---

## Performance Tests

### Processing Speed

- [ ] Upload 1MB image
- [ ] **Expected**: Processes in < 2 seconds
- [ ] Upload 10MB image
- [ ] **Expected**: Processes in < 5 seconds
- [ ] Upload 5 images concurrently
- [ ] **Expected**: All complete within reasonable time (< 30s)

### Memory Usage

- [ ] Open DevTools → Memory tab
- [ ] Take heap snapshot
- [ ] Upload 10 large images
- [ ] Take another heap snapshot
- [ ] **Expected**: Reasonable memory increase (< 500MB for 10 images)
- [ ] Clear all images
- [ ] Force garbage collection (if possible)
- [ ] **Expected**: Memory released

### UI Responsiveness

- [ ] Upload large image (10MB)
- [ ] While processing, try scrolling, typing, clicking
- [ ] **Expected**: UI remains responsive
- [ ] **Expected**: No freezing or stuttering

---

## Regression Tests

### Text-Only Functionality

- [ ] Send message without images
- [ ] **Expected**: Works exactly as before
- [ ] **Expected**: No image-related UI elements appear
- [ ] **Expected**: No console errors

### Old Conversations

- [ ] Load conversation created before image support
- [ ] **Expected**: Loads correctly
- [ ] **Expected**: No errors about missing image fields
- [ ] **Expected**: Backwards compatible

### Settings Persistence

- [ ] Change image settings (max size, quality)
- [ ] Close settings
- [ ] Refresh page
- [ ] Open settings
- [ ] **Expected**: Settings persisted

---

## Final Verification

### Build & Deployment

- [ ] Run `npm run build`
- [ ] **Expected**: No errors
- [ ] **Expected**: Only expected warnings (chunk size)
- [ ] Test production build
- [ ] **Expected**: All features work in production mode

### Console Checks

- [ ] Review browser console for entire test session
- [ ] **Expected**: No unexpected errors
- [ ] **Expected**: Only intentional warnings (GIF, large files)
- [ ] **Expected**: No security warnings
- [ ] **Expected**: No CSP violations

### Documentation Review

- [ ] README mentions image support
- [ ] CLAUDE.md documents image feature
- [ ] Settings panel has help text
- [ ] Privacy warning is clear and accurate

---

## Test Summary

**Total Tests**: ~150
**Tests Passed**: **\_** / 150
**Tests Failed**: **\_** / 150
**Critical Issues**: **\_**
**Minor Issues**: **\_**
**Notes**:

---

---

---

**Tester Signature**: **\*\***\_\_\_**\*\*** **Date**: **\*\***\_\_\_**\*\***

---

## Known Limitations (Not Bugs)

1. No processing queue - images process concurrently
2. No object URL cleanup - minor memory impact
3. GIF only analyzes first frame
4. Folder scans exclude images (SecurityPanel - intentional)
5. FileBrowser has no image preview (deferred feature)
