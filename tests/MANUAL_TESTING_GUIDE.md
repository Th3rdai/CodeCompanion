# Manual Testing Guide - Image Support Feature

**Priority-Based Testing Plan for Code Companion v1.5.0**

---

## 🎯 Quick Start (30 Minutes - Critical Tests Only)

If you only have 30 minutes, run these **8 critical blocker tests**:

### Setup (5 minutes)

1. Start Ollama: `ollama serve`
2. Install vision model: `ollama pull llava`
3. Start Code Companion: `npm start`
4. Open browser console (F12) to monitor errors
5. Prepare test image with EXIF data (see Appendix A)

### Critical Tests (25 minutes)

#### Test 1: EXIF Metadata Stripping (SECURITY CRITICAL) ⏱️ 5 min

```
1. Upload photo.jpg (with GPS EXIF data) to chat
2. Send message to llava model
3. Download image from chat history (right-click → Save Image)
4. Run: exiftool downloaded.jpg
5. ✅ PASS: No GPS coordinates, timestamps, or camera info
6. ❌ FAIL: Any EXIF data present → BLOCKER, DO NOT RELEASE
```

#### Test 2: Basic Upload Flow ⏱️ 3 min

```
1. Drag screenshot.jpg into chat textarea
2. Verify thumbnail appears (128x128px, shows size/dimensions)
3. Type "What's in this image?" → Click Send
4. Verify AI response references the image
5. ✅ PASS: Flow works end-to-end
```

#### Test 3: Vision Model Warning ⏱️ 3 min

```
1. Select non-vision model (e.g., llama3.2)
2. Drag image into chat
3. ✅ Yellow warning banner appears: "⚠️ Current model doesn't support images"
4. ✅ Send button is disabled
5. Click "Switch to vision model" button
6. ✅ Warning disappears, llava selected
7. ✅ Send button enabled
```

#### Test 4: Clipboard Paste ⏱️ 2 min

```
macOS: Cmd+Shift+4 → capture area → Cmd+V in chat
Windows: Win+Shift+S → capture area → Ctrl+V in chat
✅ PASS: Screenshot appears as thumbnail
```

#### Test 5: Unsupported Format Errors ⏱️ 3 min

```
1. Try uploading test.svg file
2. ✅ Error message: "Unsupported format: image/svg+xml. Only PNG, JPEG, GIF allowed."
3. Try uploading test.heic
4. ✅ Error message shows for HEIC
5. ✅ App doesn't crash, can upload valid image after
```

#### Test 6: File Size Limit ⏱️ 2 min

```
1. Upload 24MB image → ✅ Processes successfully
2. Upload 30MB image → ✅ Error: "File too large: 30.0MB. Max: 25MB"
3. ✅ App doesn't crash
```

#### Test 7: Lightbox Viewer ⏱️ 3 min

```
1. Click thumbnail → ✅ Lightbox opens fullscreen
2. Click + button → ✅ Zooms in (shows "150%")
3. Click - button → ✅ Zooms out
4. Drag image when zoomed → ✅ Pans
5. Press ESC → ✅ Closes lightbox
6. Click download → ✅ Saves original image
```

#### Test 8: Settings Persistence ⏱️ 4 min

```
1. Open Settings → General → Image Support section
2. Change max size to 10MB
3. Change max images to 5
4. Change quality to 75%
5. Refresh page (Cmd+R / Ctrl+R)
6. ✅ Settings panel shows: 10MB, 5 images, 75%
7. Upload 11MB image → ✅ Rejected: "File too large: 11.0MB. Max: 10MB"
8. Attach 6 images → ✅ Error: "Maximum 5 images per message"
```

---

## 📊 Full Test Suite (2-3 Hours)

Follow `tests/IMAGE_TESTING_CHECKLIST.md` for comprehensive testing (~150 test cases).

### Recommended Order:

**Phase 1: Basics** (30 min)

- File formats (PNG, JPEG, GIF valid | HEIC, SVG, WEBP rejected)
- Upload methods (file picker, drag-drop, paste)
- Quantity limits (1, 5, 10, 11 images)
- Size limits (1KB, 5MB, 25MB, 30MB)

**Phase 2: UI/UX** (30 min)

- Thumbnails (display, format badges, size/dimension labels)
- Lightbox (zoom, pan, navigate, download)
- Processing indicators ("Processing 3 images...")
- Dark mode appearance

**Phase 3: Mode Integration** (30 min)

- Chat mode (send, history, persistence)
- Review mode (attach, generate review, deep dive)
- Security mode (attach, scan, remediation)

**Phase 4: Vision Models** (20 min)

- Model detection (👁️ badges)
- Warning banner (non-vision model + image)
- Empty state ("No vision models installed")
- Settings vision model list

**Phase 5: Performance** (20 min)

- Single large image (15MB)
- Bulk upload (10 images simultaneously)
- UI responsiveness during processing
- Memory usage (DevTools Memory tab)

**Phase 6: Security** (30 min)

- EXIF stripping (GPS, timestamps)
- Privacy warning modal (first upload)
- Path traversal prevention
- SVG/XSS rejection

**Phase 7: Edge Cases** (20 min)

- Duplicate detection (upload same image twice)
- Mixed attachments (images + text files)
- Rapid actions (upload → remove → upload)
- Network interruptions (disconnect during upload)

---

## 🔧 Test Environment Setup

### Prerequisites

```bash
# 1. Ollama running
ollama serve

# 2. Vision model installed
ollama pull llava

# 3. Code Companion running
npm start

# 4. Browser
# Open: http://localhost:3000
# Open DevTools Console (F12)
```

### Test Fixtures

```bash
# Generate test images (requires ImageMagick)
cd tests/fixtures/images

# Small PNG (100KB)
convert -size 500x500 xc:white small-png.png

# Large PNG (10MB)
convert -size 3000x3000 gradient:blue-red -quality 100 large-png.png

# High-res JPEG (4000x3000)
convert -size 4000x3000 gradient:red-blue -quality 90 high-res.jpg

# Oversized (should fail)
convert -size 10000x10000 xc:white oversized.png

# Huge file (should fail)
convert -size 6000x6000 gradient:blue-red -quality 100 huge-file.jpg

# Add EXIF to photo (for EXIF stripping test)
exiftool -GPSLatitude="37.7749 N" -GPSLongitude="122.4194 W" photo.jpg
```

**Or download samples**:

- Unsplash: https://unsplash.com (free photos)
- Sample Files: https://file-examples.com

---

## 📋 Test Checklist Template

Copy this for each test session:

```
## Test Session

**Date**: ___________
**Tester**: ___________
**Build**: v1.5.0
**Ollama**: ___________
**Vision Model**: llava / bakllava / minicpm-v

### Critical Tests (Must Pass)

- [ ] EXIF stripping verified (NO GPS/timestamps in downloaded image)
- [ ] Drag-and-drop works (macOS + Windows)
- [ ] Clipboard paste works (screenshots)
- [ ] Vision model warning shows (non-vision model + image)
- [ ] Unsupported formats rejected (SVG, HEIC, WEBP)
- [ ] File size limits enforced (30MB rejected, 24MB accepted)
- [ ] Lightbox viewer functional (zoom, pan, download)
- [ ] Settings persist after refresh

### Bugs Found

| # | Description | Severity | Reproduce | Status |
|---|-------------|----------|-----------|--------|
| 1 |             | Critical/High/Medium/Low |    |        |

### Overall Status

⬜ PASS - Ready for release
⬜ FAIL - Blockers found
⬜ NEEDS WORK - Minor issues

**Sign-Off**: _____________________
```

---

## 🚨 Known Issues & Limitations

### Expected Behavior (Not Bugs)

1. **GIF Animations**: Only first frame analyzed
   - Status: ✅ Expected (Ollama limitation)
   - Console warning: "GIF detected - only first frame will be analyzed"

2. **Folder Scans in Security Mode**: Exclude images
   - Status: ✅ Intentional (performance + relevance)
   - Only single file/drag-drop supports images

3. **Review/Security Mode Clipboard Paste**: Not implemented
   - Status: ⏸️ Deferred (low priority)
   - Use drag-drop or file picker instead

4. **File Browser Image Preview**: Not implemented
   - Status: ⏸️ Deferred (Phase 9.3 - low priority UX)
   - Direct upload/paste works fine

5. **Chunk Size Warnings in Build**: Expected
   - Status: ✅ Normal (Mermaid + 3D libraries are large)
   - Not a blocker

### Potential Issues to Watch For

1. **Safari on macOS**: Canvas API compatibility
   - Test thoroughly - Safari has stricter Canvas limits
   - If >5000px fails, expected on older Safari

2. **Mobile Browsers**: Limited support
   - Basic upload should work
   - Lightbox may not be optimized for touch
   - Not primary use case

3. **Very Old Browsers**: No support
   - Requires ES6, Canvas API, Crypto.subtle
   - Chrome 60+, Firefox 55+, Safari 11+

---

## 🛠️ Debugging Tips

### Console Errors to Ignore

```
"[esbuild css minify] 'file' is not a known CSS property"
→ Known warning, safe to ignore

"Some chunks are larger than 500 kB"
→ Expected (Mermaid.js, 3D libraries), not a blocker
```

### Expected Console Logs

```
"GIF detected - only first frame will be analyzed"
→ Normal for animated GIFs

"Conversation file size: 6.2MB"
→ Warning when conversation >5MB (normal for many images)
```

### How to Debug Common Issues

**Image Won't Upload**:

1. Check console for errors
2. Verify file format (PNG/JPEG/GIF only)
3. Verify file size (<25MB default)
4. Check browser Canvas API support

**Lightbox Won't Open**:

1. Check if click event fires (console log)
2. Verify thumbnail rendered correctly
3. Check for JavaScript errors in console

**Vision Model Warning Doesn't Appear**:

1. Verify image actually attached (check attachedFiles state)
2. Verify model is non-vision (not llava/bakllava/minicpm-v)
3. Check showVisionWarning state in React DevTools

**EXIF Not Stripped**:

1. Verify image processed (not original file saved)
2. Check Canvas re-encoding happened
3. Test with `exiftool` to confirm
4. **CRITICAL**: If EXIF present, DO NOT RELEASE

---

## ✅ Sign-Off Criteria

### Before Beta Release

- ✅ All 8 critical tests pass
- ✅ EXIF stripping verified with exiftool
- ✅ Tested on 2 platforms (macOS + Windows)
- ✅ Tested on 3 browsers (Chrome, Firefox, Safari/Edge)
- ✅ No console errors during normal use
- ✅ Build succeeds with no errors

### Before Production Release

- ✅ All above +
- ✅ Full 150-test checklist completed
- ✅ Beta user feedback incorporated
- ✅ Performance benchmarks met (<5s per image)
- ✅ Security audit passed
- ✅ Documentation reviewed
- ✅ Release notes finalized

---

## 📞 Support

**Found a Bug?**

1. Check "Known Issues" section above
2. Search existing GitHub issues
3. Create new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser + OS version
   - Console errors (if any)

**Questions?**

- See `docs/IMAGES.md` for comprehensive guide
- See `tests/IMAGE_TESTING_CHECKLIST.md` for full test list
- See `tests/TEST_VERIFICATION_REPORT.md` for code analysis

---

## 📚 Appendix

### Appendix A: Creating EXIF Test Image

```bash
# Install exiftool (macOS)
brew install exiftool

# Take a photo or download sample JPEG
# Add fake GPS + timestamp EXIF data
exiftool -GPSLatitude="37.7749 N" \
         -GPSLongitude="122.4194 W" \
         -DateTimeOriginal="2024:03:15 10:30:00" \
         -Make="Apple" \
         -Model="iPhone 12" \
         photo.jpg

# Verify EXIF added
exiftool photo.jpg | grep -E "GPS|Date|Camera"

# Expected output:
# GPS Position : 37 deg 46' 29.64" N, 122 deg 25' 9.84" W
# Date/Time Original : 2024:03:15 10:30:00
# Camera Model Name : iPhone 12
```

### Appendix B: Quick Browser Testing

**Chrome** (Primary):

- Dev environment: Use daily
- Full feature support expected

**Firefox** (Secondary):

- Test all critical features
- Canvas API may differ slightly

**Safari** (macOS only):

- Test Canvas API limits
- May have stricter memory limits

**Edge** (Windows only):

- Chromium-based, should match Chrome
- Test for Windows-specific issues

### Appendix C: Performance Benchmarks

**Expected Processing Times**:

- 1MB image: ~1 second
- 5MB image: ~2-3 seconds
- 15MB image: ~4-5 seconds
- 10 images (5MB each): ~12 seconds with queue

**If Slower**:

- Check CPU usage (other apps)
- Check browser throttling (DevTools Performance tab)
- Verify queue working (max 3 concurrent)

---

**Last Updated**: 2026-03-17
**Version**: 1.0
