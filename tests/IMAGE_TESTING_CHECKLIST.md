# Image Support Testing Checklist

Comprehensive manual testing checklist for Code Companion's image upload and vision model integration feature.

**Test Date**: ___________
**Tester**: ___________
**Build Version**: ___________
**Ollama Version**: ___________
**Vision Models Installed**: ___________

---

## 📋 Pre-Test Setup

- [ ] Ollama is running (`ollama list` shows available models)
- [ ] At least one vision model installed (llava, bakllava, or minicpm-v)
- [ ] Code Companion server is running
- [ ] Browser developer console is open for error monitoring
- [ ] Test image files prepared in `tests/fixtures/` directory

---

## 🖼️ File Format Support

### PNG Files
- [ ] Small PNG (100KB, simple graphic)
- [ ] Large PNG (10MB, screenshot)
- [ ] Transparent PNG (verify background handling in thumbnails)
- [ ] PNG with EXIF metadata (verify stripped after processing)

### JPEG Files
- [ ] JPEG photo (camera image)
- [ ] JPEG screenshot (UI capture)
- [ ] Mobile JPEG with EXIF rotation (verify auto-rotation)
- [ ] High-resolution JPEG (4000x3000px)

### GIF Files
- [ ] Static GIF (single frame)
- [ ] Animated GIF (verify first-frame warning in console)
- [ ] Transparent GIF

### Unsupported Formats (Should Reject)
- [ ] HEIC file (error: "Unsupported format")
- [ ] BMP file (error: "Unsupported format")
- [ ] SVG file (error: "Unsupported format")
- [ ] WEBP file (error: "Unsupported format")
- [ ] TIFF file (error: "Unsupported format")

---

## 📐 Image Dimensions

- [ ] Small image (100x100px) - should process normally
- [ ] Medium image (1920x1080px) - should process normally
- [ ] Large image (4000x4000px) - should resize to 2048px threshold
- [ ] Oversized image (10000x10000px) - should reject with dimension error
- [ ] Portrait orientation (1080x1920px) - aspect ratio preserved
- [ ] Landscape orientation (1920x1080px) - aspect ratio preserved
- [ ] Square image (2000x2000px) - aspect ratio preserved

---

## 📤 Upload Methods

### File Picker
- [ ] Click attach button → select single image → uploads successfully
- [ ] Select multiple images at once (Cmd/Ctrl+Click) → all attach
- [ ] Cancel file picker → no error

### Drag and Drop
- [ ] Drag single image into chat textarea → uploads successfully
- [ ] Drag multiple images at once → all attach
- [ ] Drag mix of images and text files → images process, text loads as code
- [ ] Drag into Review mode → attaches to review panel
- [ ] Drag into Security mode → attaches to security panel

### Clipboard Paste
- [ ] Take screenshot (Cmd+Shift+4 / Win+Shift+S) → paste into textarea → uploads
- [ ] Copy image from browser → paste into textarea → uploads
- [ ] Copy image file from Finder/Explorer → paste → uploads
- [ ] Paste in Chat mode
- [ ] Paste in Review mode
- [ ] Paste in Security mode

### File Browser Integration
- [ ] Open File Browser → navigate to image file → click "Load into Form" (Chat mode)
- [ ] Same test for Review mode → image attaches to ReviewPanel
- [ ] Same test for Security mode → image attaches to SecurityPanel

---

## 🔢 Image Quantity Limits

- [ ] Upload 1 image → processes successfully
- [ ] Upload 5 images → all process successfully
- [ ] Upload 10 images → all process successfully (at limit)
- [ ] Upload 11 images → system enforces limit (rejects 11th or shows warning)
- [ ] Upload 20 images in rapid succession → queue manages gracefully

---

## 📊 File Size Limits

- [ ] 1KB image → processes successfully
- [ ] 1MB image → processes successfully
- [ ] 5MB image → processes successfully
- [ ] 10MB image → processes successfully
- [ ] 24MB image → processes successfully (under 25MB limit)
- [ ] 26MB image → rejects with "File too large: 26.0MB. Max: 25MB"
- [ ] 50MB image → rejects with size error

---

## 🎨 UI/UX - Thumbnails & Display

### Thumbnail Display
- [ ] Thumbnail appears after processing (128x128px)
- [ ] Format badge shows correct type (PNG/JPG/GIF)
- [ ] File size shown accurately (e.g., "2.3 MB")
- [ ] Image dimensions shown (e.g., "1920x1080")
- [ ] Multiple thumbnails display in horizontal row with scrolling
- [ ] Thumbnail aspect ratio preserved (no stretching)

### Thumbnail Interactions
- [ ] Click thumbnail → lightbox opens
- [ ] Hover over thumbnail → shows metadata tooltip
- [ ] Remove button (X) → removes individual image
- [ ] "Clear All" button → removes all attached images

### Processing Indicators
- [ ] Processing spinner shows while image processes
- [ ] Processing count shows: "Processing 3 images..." (when multiple)
- [ ] Progress indicator updates as each image completes
- [ ] No UI freezing during processing

### Dark Mode
- [ ] Thumbnails have visible borders in dark mode
- [ ] Lightbox background is dark (90% opacity)
- [ ] Image visibility good in both light and dark modes

---

## 🔍 Lightbox Viewer

### Opening & Closing
- [ ] Click thumbnail → lightbox opens with full-size image
- [ ] Click outside image → lightbox closes
- [ ] Click X button → lightbox closes
- [ ] Press ESC key → lightbox closes
- [ ] Click inside image → stays open (doesn't close)

### Zoom Controls
- [ ] Click "+" button → zooms in (up to 500%)
- [ ] Click "-" button → zooms out (down to 50%)
- [ ] Scroll wheel → zooms in/out
- [ ] Zoom level displays correctly (e.g., "150%")
- [ ] Reset button → returns to 100% zoom

### Pan & Navigation
- [ ] When zoomed >100% → can drag to pan
- [ ] When multiple images → left/right arrows appear
- [ ] Click right arrow → shows next image
- [ ] Click left arrow → shows previous image
- [ ] Keyboard arrow keys → navigate between images

### Download
- [ ] Click download button → saves original image (not resized version)
- [ ] Filename matches original upload

---

## 🤖 Vision Model Integration

### Model Detection
- [ ] Model dropdown shows 👁️ badge for vision models (llava, bakllava, minicpm-v)
- [ ] Non-vision models don't have 👁️ badge
- [ ] Vision models sorted to top when images attached

### Model Selection Warnings
- [ ] Attach image with non-vision model selected → warning banner appears
- [ ] Warning message: "⚠️ Current model doesn't support images"
- [ ] Send button is disabled while warning active
- [ ] Click "Switch to vision model" → auto-selects first vision model
- [ ] Click "Remove images" → clears all images and hides warning
- [ ] Select vision model manually → warning disappears

### Empty State (No Vision Models)
- [ ] With no vision models installed → empty state shows in Settings
- [ ] Empty state message: "No Vision Models Installed"
- [ ] Shows install command: `ollama pull llava`
- [ ] Link to Ollama vision models documentation

---

## 💬 Chat Mode Integration

### Sending Messages with Images
- [ ] Attach image → type message → click Send → message sent with image
- [ ] Multiple images in one message → all sent to AI
- [ ] AI response references the image(s)
- [ ] Images cleared from attachments after sending

### Message History Display
- [ ] Sent message shows image(s) in 2-column grid below text
- [ ] Images persist in history after page reload
- [ ] Images load when switching conversations
- [ ] Click image in history → opens lightbox
- [ ] Scroll through conversation with many images → performs well

### Conversation Persistence
- [ ] Send message with images → refresh page → images still in history
- [ ] Load saved conversation with images → images display correctly
- [ ] Export conversation → images included (or referenced)
- [ ] Delete conversation → images removed from storage

---

## 🔍 Review Mode Integration

### Image Attachment
- [ ] Paste code + attach screenshot → both sent to review
- [ ] Drag code file + image → code loads, image attaches
- [ ] File Browser → Load code file, then attach image separately

### Review Generation
- [ ] Click "Get Review" with images → review references visual context
- [ ] AI analyzes code + screenshot together
- [ ] Report includes image-aware suggestions

### Deep Dive Mode
- [ ] Images persist during Deep Dive conversation
- [ ] Follow-up questions can reference the attached images

### New Review
- [ ] Click "New Review" → clears both code and images
- [ ] Attach new images for next review

---

## 🔒 Security Mode Integration

### Image Attachment
- [ ] Attach vulnerability screenshot → shows in attached images
- [ ] Paste code + screenshot → both available for scan
- [ ] Multiple screenshots of different OWASP categories

### Security Scan
- [ ] Click "Security Scan" with images → scan includes visual analysis
- [ ] Report references screenshots (e.g., "XSS shown in your screenshot")
- [ ] Findings correlate code with visual evidence

### Remediation
- [ ] Click "Remediate" after scan with images → generates fixed code
- [ ] Download remediation zip → check if images included (optional feature)
- [ ] Remediation report references original screenshots

---

## ⚡ Performance Testing

### Single Large Image
- [ ] Upload 15MB image → processes in <5 seconds
- [ ] UI remains responsive during processing
- [ ] No browser "Page Unresponsive" warning

### Multiple Images (Bulk Upload)
- [ ] Upload 10 images at once (5MB each)
- [ ] Processing queue shows "Processing 3 images..." (max 3 concurrent)
- [ ] All 10 images complete within reasonable time (~12 seconds)
- [ ] UI stays responsive throughout

### Memory Management
- [ ] Upload 20 images across multiple messages
- [ ] No memory leaks (check DevTools Memory tab)
- [ ] Browser memory usage stays reasonable (<1GB)
- [ ] Page doesn't slow down after many images

### Queue Management
- [ ] Upload 15 images rapidly → queue manages in batches of 3
- [ ] Processing count never exceeds 3 simultaneous operations
- [ ] Failed image doesn't block others in queue
- [ ] Can still interact with UI while queue processes

---

## 🔐 Security Testing

### EXIF Data Stripping
- [ ] Upload photo with GPS EXIF data
- [ ] Download processed image from history
- [ ] Verify EXIF data removed (use exiftool or similar)
- [ ] GPS coordinates no longer present
- [ ] Timestamp metadata removed

### Privacy Warning Modal
- [ ] First image upload → privacy warning modal appears
- [ ] Modal lists 4 warnings (sensitive info, EXIF, AI text reading, storage)
- [ ] Click "I Understand" → modal closes
- [ ] Check "Don't show again" → second upload doesn't show modal
- [ ] localStorage key `cc-image-privacy-accepted` set to `true`

### Path Traversal Prevention
- [ ] Cannot upload file with malicious path: `../../../etc/passwd`
- [ ] Filename sanitized to safe characters only
- [ ] No directory traversal in saved files

### Malicious Data URI
- [ ] Attempt to paste malicious data URI → rejected or sanitized
- [ ] XSS attempt via SVG (should be blocked at MIME check)
- [ ] Invalid base64 in data URI → rejected

---

## ❌ Error Handling

### File Validation Errors
- [ ] Upload unsupported format → clear error: "Unsupported format: image/webp. Only PNG, JPEG, GIF allowed."
- [ ] Upload oversized file → clear error: "File too large: 30.0MB. Max: 25MB"
- [ ] Upload oversized dimensions → error: "Image too large: 10000x10000px. Max: 8192px"

### Processing Errors
- [ ] Upload corrupted image → error toast: "Invalid or corrupted image file"
- [ ] Extremely large image (memory issue) → error: "Out of memory. Try smaller images or fewer at once."
- [ ] Canvas error → error: "Failed to process image (browser error)"

### Network Errors
- [ ] Stop Ollama → send message with images → error: "Cannot connect to Ollama. Please check that Ollama is running."
- [ ] Use non-vision model → error: "Vision inference failed. [model] may not support images."
- [ ] Request timeout (very large image) → error: "Request timed out. Vision models can take longer - try fewer images."

### API Errors
- [ ] Context window exceeded → error: "Context window exceeded. Try reducing message history or images."
- [ ] Too many images (>10) → error: "Maximum 10 images per message"

### Error Recovery
- [ ] Error doesn't crash the app
- [ ] Can remove failed image and retry
- [ ] Other attached images not affected by one failure
- [ ] Error toast dismisses after a few seconds

---

## 🌍 Cross-Platform Testing

### macOS
- [ ] Chrome - all features work
- [ ] Safari - all features work (especially Canvas API)
- [ ] Firefox - all features work
- [ ] Paste from screenshot tool (Cmd+Shift+4) works

### Windows
- [ ] Chrome - all features work
- [ ] Edge - all features work
- [ ] Firefox - all features work
- [ ] Paste from Snipping Tool (Win+Shift+S) works

### Linux
- [ ] Chrome - all features work
- [ ] Firefox - all features work
- [ ] Paste from screenshot tools works

### Electron Build
- [ ] macOS Electron build - all features work
- [ ] Windows Electron build - all features work
- [ ] File paths handled correctly
- [ ] Native file picker works

### Mobile (Optional)
- [ ] iOS Safari - basic upload works
- [ ] Android Chrome - basic upload works
- [ ] Touch interactions (tap thumbnail, etc.) work

---

## ⚙️ Settings Panel

### Image Support Settings
- [ ] Settings → General → "Image Support" section visible
- [ ] Toggle "Enable Image Upload" → disables upload buttons
- [ ] Max Image Size slider (1-50 MB) → updates config
- [ ] Max Images Per Message input (1-20) → enforces limit
- [ ] Image Quality slider (50%-100%) → affects compression
- [ ] All settings persist after page reload

### Vision Models Display
- [ ] "Available Vision Models" section shows installed models
- [ ] Each vision model listed with 👁️ icon
- [ ] Empty state when no vision models → shows install command
- [ ] Link to Ollama docs works

### Settings Persistence
- [ ] Change settings → refresh page → settings retained
- [ ] Settings stored in `.cc-config.json`
- [ ] Default settings restored if config file deleted

---

## 🎓 Welcome Tour / Onboarding

- [ ] First-time user → welcome tour includes image upload step
- [ ] Tour highlights attach button
- [ ] Tour shows how to paste screenshots
- [ ] Tour mentions need for vision models
- [ ] Tour shows example: `ollama pull llava`
- [ ] Can skip tour without errors

---

## 🔄 Backwards Compatibility

### Old Conversations (Pre-Image Support)
- [ ] Load conversation saved before image feature → loads correctly
- [ ] No errors when `images` field missing from messages
- [ ] Old conversations still functional

### Config Migration
- [ ] Old config file without `imageSupport` section → merges defaults
- [ ] No errors on first load after upgrade
- [ ] New settings available immediately

---

## 🧪 Edge Cases

### Duplicate Images
- [ ] Upload same image twice → warning: "screenshot.png appears to be a duplicate. Attach anyway?"
- [ ] Click "OK" → both copies attach
- [ ] Click "Cancel" → second copy not attached
- [ ] Duplicate detection based on MD5 hash of first 10KB

### Mixed Attachments
- [ ] Attach 3 images + 2 text files → both types display correctly
- [ ] Remove individual items → correct item removed
- [ ] Clear all → both images and text files cleared

### Rapid Actions
- [ ] Upload image → immediately click Send → doesn't cause error
- [ ] Upload → remove → upload again rapidly → no errors
- [ ] Switch modes while images processing → processes complete correctly

### Very Long Sessions
- [ ] Keep app open for 1+ hour with images → no memory leaks
- [ ] Send 50+ messages with images → performance stays good
- [ ] Conversation history loads quickly even with many images

### Network Interruptions
- [ ] Upload image → disconnect network → upload fails gracefully
- [ ] Reconnect → retry → succeeds
- [ ] Partial upload doesn't leave corrupted state

---

## 📝 Documentation Verification

### README.md
- [ ] Image support section exists
- [ ] Lists supported formats correctly
- [ ] Shows install command for vision models
- [ ] Explains 3 upload methods (drag, paste, picker)

### CLAUDE.md
- [ ] Tech stack mentions Canvas API
- [ ] Vision models listed (llava, bakllava, minicpm-v)
- [ ] Image support noted for all 15 modes

### docs/IMAGES.md (if exists)
- [ ] Comprehensive guide present
- [ ] Covers installation, upload, troubleshooting
- [ ] Privacy & security section
- [ ] API reference for developers

---

## ✅ Success Criteria Summary

### Must Pass (Blockers)
- [ ] All supported formats (PNG, JPEG, GIF) upload successfully
- [ ] Vision model detection works correctly
- [ ] Chat mode displays images in history
- [ ] Review mode accepts images
- [ ] Security mode accepts images
- [ ] Privacy warning shows on first upload
- [ ] EXIF data stripped from all images
- [ ] No XSS vulnerabilities
- [ ] Performance acceptable (no freezing)
- [ ] Works on macOS, Windows, Linux (major browsers)

### Should Pass (Important)
- [ ] Lightbox viewer fully functional
- [ ] Processing queue manages 10+ images
- [ ] Settings panel controls work
- [ ] Error messages clear and helpful
- [ ] Backwards compatible with old conversations

### Nice to Have (Optional)
- [ ] Welcome tour updated
- [ ] Mobile browsers support basic upload
- [ ] Duplicate detection works
- [ ] Remediation includes screenshots

---

## 🐛 Bugs Found

| # | Description | Severity | Steps to Reproduce | Status |
|---|-------------|----------|-------------------|--------|
| 1 |             |          |                   |        |
| 2 |             |          |                   |        |
| 3 |             |          |                   |        |

**Severity Levels**: Critical (blocks release) | High (major feature broken) | Medium (minor issue) | Low (cosmetic)

---

## 📊 Test Results Summary

**Total Test Cases**: ~150
**Passed**: _____ / _____
**Failed**: _____ / _____
**Blocked**: _____ / _____
**Skipped**: _____ / _____

**Overall Status**: ⬜ PASS | ⬜ FAIL | ⬜ NEEDS WORK

**Recommended Actions**:
- [ ] Ready for production release
- [ ] Needs bug fixes (see list above)
- [ ] Needs additional testing
- [ ] Needs design/UX improvements

**Tester Sign-Off**: _________________________
**Date**: _________________________

---

## 📎 Test Fixtures Needed

Prepare these test files in `tests/fixtures/images/`:

1. `small-png.png` (100KB, simple graphic)
2. `large-png.png` (10MB, screenshot)
3. `transparent-png.png` (PNG with alpha channel)
4. `photo.jpg` (Camera image with EXIF)
5. `screenshot.jpg` (UI screenshot)
6. `mobile-rotated.jpg` (EXIF orientation data)
7. `high-res.jpg` (4000x3000px)
8. `static.gif` (Single frame)
9. `animated.gif` (Multiple frames)
10. `oversized.png` (10000x10000px - should fail)
11. `huge-file.jpg` (50MB - should fail)
12. `corrupted.png` (Intentionally broken file)
13. `test.heic` (Unsupported format)
14. `test.svg` (Unsupported format)
15. `test.webp` (Unsupported format)
