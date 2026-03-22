# 🚀 Quick Start: Full Testing Session

**Estimated Time**: 2-3 hours
**Testing Tracker**: `tests/TESTING_SESSION_TRACKER.md`
**Server**: https://localhost:8900 ✅ RUNNING

---

## Step 1: Install Required Tools (5 min)

```bash
# Install exiftool (REQUIRED for EXIF security test)
brew install exiftool

# Verify installation
exiftool -ver

# ImageMagick already installed ✅
```

---

## Step 2: Generate Test Fixtures (10 min)

```bash
# Create fixtures directory
mkdir -p tests/fixtures/images
cd tests/fixtures/images

# Generate basic test images
magick -size 500x500 xc:white small-png.png
magick -size 3000x3000 gradient:blue-red -quality 100 large-png.png
magick -size 800x800 xc:none -fill 'rgba(255,0,0,0.5)' -draw 'circle 400,400 400,100' transparent-png.png

# CRITICAL: Photo with EXIF (for security test)
magick -size 2000x1500 gradient:blue-red photo.jpg
exiftool -GPSLatitude="37.7749 N" -GPSLongitude="122.4194 W" -DateTimeOriginal="2024:03:15 10:30:00" -Make="Apple" -Model="iPhone 12" photo.jpg

# Other images
magick -size 1920x1080 gradient:gray-white screenshot.jpg
magick -size 4000x3000 gradient:red-blue high-res.jpg
magick -size 400x400 xc:yellow static.gif
magick -size 400x400 xc:red xc:green xc:blue -delay 50 animated.gif

# Failure test images
magick -size 10000x10000 xc:white oversized.png
magick -size 6000x6000 gradient:blue-red -quality 100 huge-file.jpg

# Unsupported formats
magick -size 400x400 xc:blue test.bmp

# Corrupted file (truncate a valid image)
head -c 500 small-png.png > corrupted.png

# For SVG, HEIC, WEBP - download or use existing files
echo '<svg><script>alert("XSS")</script></svg>' > test.svg

# List generated files
ls -lh
```

---

## Step 3: Open Testing Session (2 min)

```bash
# Open the session tracker in your editor
code tests/TESTING_SESSION_TRACKER.md

# Or with another editor:
# open tests/TESTING_SESSION_TRACKER.md
```

---

## Step 4: Start Testing! (2-3 hours)

### Testing Workflow

1. **Open Browser**
   - URL: https://localhost:8900
   - Accept SSL certificate warning
   - Open DevTools Console (F12) - leave open throughout

2. **Follow Phase-by-Phase**
   - Work through `TESTING_SESSION_TRACKER.md`
   - Check each box as you complete tests
   - Record results (PASS/FAIL/NOTES) in the tables
   - Document any bugs in the Bugs Found section

3. **Critical Tests First** (30 min)
   - Phase 6: EXIF Metadata Stripping (BLOCKER)
   - Phase 4: Vision Model Warning
   - Phase 8: Error Handling

4. **Remaining Phases** (1.5-2 hours)
   - Work through in order: Phase 1 → Phase 9
   - Take breaks as needed
   - Document everything

---

## 🚨 CRITICAL: EXIF Security Test

**THIS IS THE #1 BLOCKER - MUST PASS**

### Steps:
1. Upload `photo.jpg` (with GPS EXIF) to chat
2. Send message to llava model
3. **Wait for response**
4. Right-click image in chat history → Save Image As
5. Save to Downloads folder
6. Run verification:

```bash
cd ~/Downloads

# Check GPS (MUST BE EMPTY)
exiftool downloaded_image.jpg | grep -i GPS
# Expected: No output

# Check dates (MUST BE EMPTY)
exiftool downloaded_image.jpg | grep -i Date
# Expected: No output

# Check camera (MUST BE EMPTY)
exiftool downloaded_image.jpg | grep -i -E "Camera|Make|Model"
# Expected: No output

# Full dump (should be minimal)
exiftool downloaded_image.jpg
# Expected: Only basic image metadata (dimensions, file size, etc.)
```

### Results:
- ✅ **PASS**: No GPS/Date/Camera info → Safe to release
- ❌ **FAIL**: Any EXIF data present → **BLOCKER - DO NOT RELEASE**

---

## 📋 Testing Phases Overview

| Phase | Focus | Est. Time | Priority |
|-------|-------|-----------|----------|
| **Phase 1** | File Formats | 30 min | High |
| **Phase 2** | Upload Methods | 20 min | High |
| **Phase 3** | UI/UX | 20 min | Medium |
| **Phase 4** | Vision Models | 20 min | Critical |
| **Phase 5** | Mode Integration | 30 min | High |
| **Phase 6** | Security | 30 min | **CRITICAL** |
| **Phase 7** | Performance | 20 min | Medium |
| **Phase 8** | Error Handling | 20 min | High |
| **Phase 9** | Settings | 20 min | Medium |

**Total**: ~3 hours

---

## 💡 Testing Tips

### General
- **Keep DevTools console open** - watch for errors
- **Test in order** - each phase builds on previous
- **Take screenshots** - of bugs for documentation
- **Record actual times** - helps improve estimates

### Browser
- **Use Chrome** for primary testing
- **Test Firefox** if time permits (cross-browser)
- **Clear cache** between major test groups (Cmd+Shift+Del)

### When You Find a Bug
1. Note the exact steps to reproduce
2. Add to Bugs Found table in tracker
3. Assign severity (Critical/High/Medium/Low)
4. Screenshot if visual issue
5. Continue testing (don't stop for non-blockers)

### Performance Tests
- **Close other apps** - free up memory
- **Use Activity Monitor** (macOS) or Task Manager (Windows)
- **Record actual times** - note if slower than expected

---

## ✅ After Testing

### Complete the Summary
1. Count total passed/failed phases
2. List all critical bugs
3. Make recommendation (PASS/FAIL/PARTIAL)
4. Sign off in tracker

### Report Results
```bash
# View your completed tracker
cat tests/TESTING_SESSION_TRACKER.md

# If bugs found, optionally create GitHub issues
# (Or just note them for now)
```

### Next Steps Based on Results

**If ALL CRITICAL TESTS PASS**:
- ✅ Ready for production release
- Create release tag: `git tag v1.5.0`
- Update announcement docs

**If MINOR BUGS FOUND**:
- ✅ Ready for beta release
- Document known issues
- Plan fixes for v1.5.2

**If CRITICAL BUGS FOUND**:
- ❌ Cannot release
- Fix blockers first
- Re-test critical areas
- Then proceed to release

---

## 🆘 Need Help?

### Common Issues

**"Can't upload image"**
- Check console for errors
- Verify file format (PNG/JPEG/GIF only)
- Verify size (<25MB default)
- Try a different image

**"Lightbox won't open"**
- Check console for JavaScript errors
- Try refreshing page
- Verify thumbnail rendered correctly

**"Vision model warning doesn't appear"**
- Verify image actually attached (check thumbnails)
- Verify model is non-vision (llama3.2, not llava)
- Try switching model then back

**"EXIF test failed - data still present"**
- 🚨 **THIS IS A BLOCKER**
- Verify you downloaded the RIGHT image (from chat, not original)
- Re-test with fresh upload
- If still fails → DO NOT RELEASE, investigate code

### Reference Documents
- **Full Checklist**: `tests/IMAGE_TESTING_CHECKLIST.md` (150 tests)
- **Manual Guide**: `tests/MANUAL_TESTING_GUIDE.md` (detailed instructions)
- **Code Verification**: `tests/TEST_VERIFICATION_REPORT.md` (implementation review)
- **Session Tracker**: `tests/TESTING_SESSION_TRACKER.md` (THIS FILE)

---

## 🎯 Ready to Start?

1. ✅ Install exiftool: `brew install exiftool`
2. ✅ Generate test fixtures (10 min)
3. ✅ Open session tracker in editor
4. ✅ Start with Phase 1 in browser
5. ✅ Work through each phase systematically
6. ✅ Complete summary at end

**Browser**: https://localhost:8900
**Tracker**: tests/TESTING_SESSION_TRACKER.md

**Good luck! Take your time and document everything thoroughly.**
