# Image Support Testing Session

**Date**: 2026-03-17
**Tester**: James Avila
**Build Version**: v1.5.0
**Server**: https://localhost:8900
**Status**: 🟡 IN PROGRESS

---

## 📋 Pre-Test Setup Checklist

### Environment
- [ ] Ollama running (`ollama list` shows models)
- [ ] Vision model installed (`ollama list | grep llava`)
- [ ] Code Companion running at https://localhost:8900
- [ ] Browser DevTools console open (F12)
- [ ] exiftool installed (`brew install exiftool`)

### Test Fixtures Prepared
- [ ] Small PNG (100KB)
- [ ] Large PNG (10MB)
- [ ] Transparent PNG
- [ ] JPEG photo with EXIF
- [ ] Screenshot JPEG
- [ ] High-res JPEG (4000x3000)
- [ ] Static GIF
- [ ] Animated GIF
- [ ] Oversized PNG (10000x10000 - should fail)
- [ ] Huge file (50MB - should fail)
- [ ] Unsupported: HEIC, SVG, WEBP, BMP

**Fixture Generation Commands**:
```bash
cd tests/fixtures/images

# Small PNG
convert -size 500x500 xc:white small-png.png

# Large PNG
convert -size 3000x3000 gradient:blue-red -quality 100 large-png.png

# Transparent PNG
convert -size 800x800 xc:none -fill 'rgba(255,0,0,0.5)' -draw 'circle 400,400 400,100' transparent-png.png

# JPEG with EXIF (CRITICAL for security test)
convert -size 2000x1500 gradient:blue-red photo.jpg
exiftool -GPSLatitude="37.7749 N" -GPSLongitude="122.4194 W" -DateTimeOriginal="2024:03:15 10:30:00" photo.jpg

# Screenshot JPEG
convert -size 1920x1080 gradient:gray-white screenshot.jpg

# High-res JPEG
convert -size 4000x3000 gradient:red-blue high-res.jpg

# GIFs
convert -size 400x400 xc:yellow static.gif
convert -size 400x400 xc:red xc:green xc:blue -delay 50 animated.gif

# Oversized (should fail)
convert -size 10000x10000 xc:white oversized.png

# Huge file (should fail)
convert -size 6000x6000 gradient:blue-red -quality 100 huge-file.jpg

# Unsupported formats
convert -size 400x400 xc:blue test.bmp
# For SVG, HEIC, WEBP - download samples or use existing files
```

---

## 🧪 Phase 1: File Format Support (30 min)

### PNG Files
| Test | File | Expected Result | Status | Notes |
|------|------|----------------|--------|-------|
| Small PNG | small-png.png (100KB) | ✅ Uploads successfully | ⬜ | |
| Large PNG | large-png.png (10MB) | ✅ Uploads successfully | ⬜ | |
| Transparent PNG | transparent-png.png | ✅ Transparency preserved in thumbnail | ⬜ | |

### JPEG Files
| Test | File | Expected Result | Status | Notes |
|------|------|----------------|--------|-------|
| Standard JPEG | screenshot.jpg | ✅ Uploads successfully | ⬜ | |
| JPEG with EXIF | photo.jpg | ✅ Uploads, EXIF stripped | ⬜ | **VERIFY AFTER** |
| High-res JPEG | high-res.jpg (4000x3000) | ✅ Auto-resized to 2048px | ⬜ | |

### GIF Files
| Test | File | Expected Result | Status | Notes |
|------|------|----------------|--------|-------|
| Static GIF | static.gif | ✅ Uploads successfully | ⬜ | |
| Animated GIF | animated.gif | ✅ Uploads, console warning | ⬜ | Check console for warning |

### Unsupported Formats (Should Reject)
| Test | File | Expected Error | Status | Notes |
|------|------|---------------|--------|-------|
| HEIC | test.heic | "Unsupported format: image/heic" | ⬜ | |
| SVG | test.svg | "Unsupported format: image/svg+xml" | ⬜ | Security: XSS prevention |
| WEBP | test.webp | "Unsupported format: image/webp" | ⬜ | |
| BMP | test.bmp | "Unsupported format: image/bmp" | ⬜ | |

**Phase 1 Result**: ⬜ PASS | ⬜ FAIL | ⬜ PARTIAL

---

## 🧪 Phase 2: Upload Methods (20 min)

### File Picker
| Test | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| Single file | Click attach → select 1 image | ✅ Thumbnail appears | ⬜ | |
| Multiple files | Cmd+Click select 3 images | ✅ All 3 thumbnails appear | ⬜ | |
| Cancel picker | Click attach → Cancel | ✅ No error, no attachment | ⬜ | |

### Drag & Drop
| Test | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| Single image | Drag 1 image to textarea | ✅ Thumbnail appears | ⬜ | |
| Multiple images | Drag 5 images at once | ✅ All 5 appear | ⬜ | |
| Mixed files | Drag 2 images + 1 .txt file | ✅ Images process, text loads | ⬜ | |

### Clipboard Paste
| Test | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| Screenshot paste | Cmd+Shift+4 → Cmd+V | ✅ Screenshot appears | ⬜ | macOS |
| Copy image from browser | Copy image → Cmd+V | ✅ Image appears | ⬜ | |
| Copy file from Finder | Copy .jpg → Cmd+V | ✅ Image appears | ⬜ | |

**Phase 2 Result**: ⬜ PASS | ⬜ FAIL | ⬜ PARTIAL

---

## 🧪 Phase 3: UI/UX Components (20 min)

### Thumbnail Display
| Test | Expected Behavior | Status | Notes |
|------|------------------|--------|-------|
| Thumbnail size | 128x128px | ⬜ | |
| Format badge | Shows PNG/JPG/GIF | ⬜ | |
| File size label | Shows "2.3 MB" | ⬜ | |
| Dimensions label | Shows "1920x1080" | ⬜ | |
| Aspect ratio | Preserved (no stretching) | ⬜ | |
| Multiple thumbnails | Horizontal scroll row | ⬜ | |
| Remove button | X button removes individual | ⬜ | |
| Clear All button | Removes all images | ⬜ | |

### Lightbox Viewer
| Test | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| Open lightbox | Click thumbnail | ✅ Fullscreen viewer opens | ⬜ | |
| Close - click outside | Click backdrop | ✅ Closes | ⬜ | |
| Close - ESC key | Press ESC | ✅ Closes | ⬜ | |
| Close - X button | Click X | ✅ Closes | ⬜ | |
| Zoom in | Click + button | ✅ Zooms to 150%, 200%, etc. | ⬜ | |
| Zoom out | Click - button | ✅ Zooms to 75%, 50% | ⬜ | |
| Zoom display | - | ✅ Shows "150%" | ⬜ | |
| Pan (zoomed) | Drag when >100% | ✅ Pans image | ⬜ | |
| Navigate gallery | Click arrows (multi-image) | ✅ Shows next/prev | ⬜ | |
| Keyboard nav | Arrow keys | ✅ Navigate images | ⬜ | |
| Download | Click download button | ✅ Saves original image | ⬜ | |

### Processing Indicators
| Test | Expected Behavior | Status | Notes |
|------|------------------|--------|-------|
| Processing spinner | Shows during processing | ⬜ | |
| Processing count | "Processing 3 images..." | ⬜ | Upload 3+ images |
| UI responsiveness | No freezing during processing | ⬜ | |

### Dark Mode
| Test | Expected Behavior | Status | Notes |
|------|------------------|--------|-------|
| Thumbnail borders | Visible in dark mode | ⬜ | |
| Lightbox background | Dark (90% opacity) | ⬜ | |
| Image visibility | Good contrast | ⬜ | |

**Phase 3 Result**: ⬜ PASS | ⬜ FAIL | ⬜ PARTIAL

---

## 🧪 Phase 4: Vision Model Integration (20 min)

### Model Detection
| Test | Expected Behavior | Status | Notes |
|------|------------------|--------|-------|
| Vision models have 👁️ badge | llava, bakllava, etc. | ⬜ | Check dropdown |
| Non-vision models no badge | llama3.2, etc. | ⬜ | |
| Vision models sorted to top | When images attached | ⬜ | |

### Warning Banner
| Test | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| Trigger warning | Select llama3.2 + upload image | ✅ Yellow banner appears | ⬜ | |
| Warning message | - | ⚠️ "Current model doesn't support images" | ⬜ | |
| Send button disabled | - | ✅ Cannot send while warning active | ⬜ | |
| Switch button | Click "Switch to vision model" | ✅ Selects llava, warning disappears | ⬜ | |
| Remove images button | Click "Remove images" | ✅ Clears images, warning disappears | ⬜ | |
| Manual selection | Select llava manually | ✅ Warning disappears | ⬜ | |

### Settings - Vision Models List
| Test | Expected Behavior | Status | Notes |
|------|------------------|--------|-------|
| Available models shown | Lists all vision models with 👁️ | ⬜ | Settings → General |
| Empty state | "No vision models installed" + install command | ⬜ | Uninstall llava to test |

**Phase 4 Result**: ⬜ PASS | ⬜ FAIL | ⬜ PARTIAL

---

## 🧪 Phase 5: Mode Integration (30 min)

### Chat Mode
| Test | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| Send with images | Attach image + message → Send | ✅ Message sent, AI references image | ✅ DONE | Already tested |
| Multiple images | Attach 3 images + Send | ✅ All sent, AI sees all | ⬜ | |
| History display | - | ✅ Images in 2-column grid | ⬜ | Check chat history |
| Click image in history | Click image | ✅ Lightbox opens | ⬜ | |
| Persist after reload | Refresh page | ✅ Images still in history | ⬜ | |

### Review Mode
| Test | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| Attach code + image | Paste code, attach screenshot | ✅ Both visible | ⬜ | |
| Generate review | Click "Get Review" | ✅ Review references image | ⬜ | |
| Deep Dive | Click Deep Dive | ✅ Images persist | ⬜ | |
| New Review | Click "New Review" | ✅ Clears code + images | ⬜ | |

### Security Mode
| Test | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| Attach code + screenshot | Paste code, attach image | ✅ Both visible | ⬜ | |
| Security Scan | Click "Security Scan" | ✅ Scan includes visual context | ⬜ | |
| Remediate | Click "Remediate" | ✅ Generates fixes | ⬜ | |

**Phase 5 Result**: ⬜ PASS | ⬜ FAIL | ⬜ PARTIAL

---

## 🧪 Phase 6: Security Testing (30 min) 🔒 CRITICAL

### EXIF Metadata Stripping (BLOCKER TEST)
| Test | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| Upload photo with EXIF | Upload photo.jpg (with GPS) | ✅ Uploads successfully | ⬜ | |
| Download processed image | Right-click image in history → Save | ✅ Downloads | ⬜ | |
| **VERIFY EXIF REMOVED** | `exiftool downloaded.jpg \| grep GPS` | ❌ NO OUTPUT (GPS stripped) | ⬜ | **CRITICAL** |
| Verify timestamps removed | `exiftool downloaded.jpg \| grep Date` | ❌ NO OUTPUT | ⬜ | **CRITICAL** |
| Verify camera info removed | `exiftool downloaded.jpg \| grep Camera` | ❌ NO OUTPUT | ⬜ | **CRITICAL** |

**EXIF Test Commands**:
```bash
# After downloading image from chat history:
cd ~/Downloads

# Check for GPS data (MUST BE EMPTY)
exiftool downloaded_image.jpg | grep -i GPS

# Check for timestamps (MUST BE EMPTY)
exiftool downloaded_image.jpg | grep -i Date

# Check for camera info (MUST BE EMPTY)
exiftool downloaded_image.jpg | grep -i -E "Camera|Make|Model"

# Full EXIF dump (should be minimal - only basic image info)
exiftool downloaded_image.jpg
```

### Privacy Warning Modal
| Test | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| First upload triggers modal | Upload first image (fresh browser) | ✅ Privacy warning modal appears | ⬜ | Clear localStorage first |
| Modal has 4 warnings | - | ✅ Sensitive info, EXIF, AI text, storage | ⬜ | |
| "I Understand" closes modal | Click button | ✅ Modal closes, can upload | ⬜ | |
| "Don't show again" works | Check box + click | ✅ Future uploads skip modal | ⬜ | |
| localStorage flag set | - | `cc-image-privacy-accepted` = true | ⬜ | Check DevTools Application tab |

### Format Validation (XSS Prevention)
| Test | File | Expected Behavior | Status | Notes |
|------|------|------------------|--------|-------|
| SVG rejection | test.svg | ❌ Rejected before processing | ⬜ | **XSS PROTECTION** |
| Error message | - | "Unsupported format: image/svg+xml" | ⬜ | |
| No processing | - | Image never loaded into canvas | ⬜ | |

**Phase 6 Result**: ⬜ PASS | ⬜ FAIL | ⬜ PARTIAL
**BLOCKER**: If EXIF not stripped → ⚠️ DO NOT RELEASE

---

## 🧪 Phase 7: Performance Testing (20 min)

### Single Large Image
| Test | File Size | Expected Time | Status | Actual Time | Notes |
|------|-----------|--------------|--------|-------------|-------|
| 5MB image | 5MB | < 3 seconds | ⬜ | | |
| 15MB image | 15MB | < 5 seconds | ⬜ | | |
| UI responsive | - | No freezing | ⬜ | | |

### Bulk Upload (10 Images)
| Test | Action | Expected Behavior | Status | Notes |
|------|--------|------------------|--------|-------|
| Upload 10 images | Drag 10 x 5MB images | ✅ All process | ⬜ | |
| Processing queue | - | "Processing 3 images..." (max 3 concurrent) | ⬜ | |
| Total time | - | ~12 seconds | ⬜ | Record actual time: ____ |
| UI responsive | - | Can still interact with UI | ⬜ | |
| No browser warning | - | No "Page Unresponsive" | ⬜ | |

### Memory Management
| Test | Action | Expected Behavior | Status | Notes |
|------|--------|------------------|--------|-------|
| Upload 20 images | Across multiple messages | No memory leaks | ⬜ | Check DevTools Memory |
| Browser memory | - | Stays < 1GB | ⬜ | Performance → Memory |
| No slowdown | - | Page stays responsive | ⬜ | |

**Phase 7 Result**: ⬜ PASS | ⬜ FAIL | ⬜ PARTIAL

---

## 🧪 Phase 8: Error Handling (20 min)

### File Validation Errors
| Test | File/Action | Expected Error | Status | Notes |
|------|-------------|---------------|--------|-------|
| Oversized file | huge-file.jpg (50MB) | "File too large: 50.0MB. Max: 25MB" | ⬜ | |
| Oversized dimensions | oversized.png (10000x10000) | "Image too large: 10000x10000px. Max: 8192px" | ⬜ | |
| Corrupted image | corrupted.png | "Invalid or corrupted image file" | ⬜ | |

### Runtime Errors
| Test | Action | Expected Error | Status | Notes |
|------|--------|---------------|--------|-------|
| Too many images | Upload 11 images | "Maximum 10 images per message" | ⬜ | |
| Non-vision model error | Send image with llama3.2 | Warning prevents send OR clear error | ⬜ | |

### Error Recovery
| Test | Action | Expected Behavior | Status | Notes |
|------|--------|------------------|--------|-------|
| Error doesn't crash | Trigger any error | ✅ App still works | ⬜ | |
| Can retry | Remove failed image, upload valid | ✅ Works | ⬜ | |
| Other images unaffected | 1 fails out of 5 | ✅ Other 4 process | ⬜ | |

**Phase 8 Result**: ⬜ PASS | ⬜ FAIL | ⬜ PARTIAL

---

## 🧪 Phase 9: Settings & Persistence (20 min)

### Settings Panel
| Test | Action | Expected Behavior | Status | Notes |
|------|--------|------------------|--------|-------|
| Image Support section visible | Settings → General | ✅ Section appears | ⬜ | |
| Max size slider | Change to 10MB | ✅ Updates | ⬜ | |
| Max images input | Change to 5 | ✅ Updates | ⬜ | |
| Quality slider | Change to 75% | ✅ Updates | ⬜ | |
| Enable/disable toggle | Toggle off | ✅ Disables uploads | ⬜ | |

### Settings Persistence
| Test | Action | Expected Behavior | Status | Notes |
|------|--------|------------------|--------|-------|
| Change settings | Set: 10MB, 5 images, 75% | - | ⬜ | |
| Refresh page | Cmd+R | ✅ Settings retained | ⬜ | |
| Test enforcement | Upload 11MB image | ❌ Rejected: "Max: 10MB" | ⬜ | |
| Test count limit | Upload 6 images | ❌ Rejected at 6th | ⬜ | |
| Config file updated | Check `.cc-config.json` | ✅ Contains new values | ⬜ | |

**Phase 9 Result**: ⬜ PASS | ⬜ FAIL | ⬜ PARTIAL

---

## 🐛 Bugs Found

| # | Description | Severity | Steps to Reproduce | Expected | Actual | Status |
|---|-------------|----------|-------------------|----------|--------|--------|
| 1 | | Critical/High/Medium/Low | | | | Open/Fixed |
| 2 | | | | | | |
| 3 | | | | | | |

**Severity Definitions**:
- **Critical**: Blocks release (security, crashes, data loss)
- **High**: Major feature broken, bad UX
- **Medium**: Minor feature issue, workaround exists
- **Low**: Cosmetic, edge case

---

## 📊 Test Results Summary

### Overall Progress
- **Total Test Categories**: 9
- **Categories Passed**: ____ / 9
- **Categories Failed**: ____ / 9
- **Categories Partial**: ____ / 9

### Critical Tests (Must Pass)
- [ ] EXIF metadata stripping verified (NO GPS/timestamps/camera info)
- [ ] Vision model warning functional
- [ ] All supported formats upload successfully
- [ ] Privacy warning shows on first upload
- [ ] No XSS vulnerabilities (SVG rejected)
- [ ] Performance acceptable (no UI freezing)
- [ ] Error messages clear and helpful
- [ ] Settings persist after refresh

### Overall Status
⬜ **PASS** - Ready for production release
⬜ **FAIL** - Blockers found, cannot release
⬜ **PARTIAL** - Minor issues, can release with known limitations

---

## ✅ Sign-Off

**Testing Duration**: _____ hours
**Critical Bugs Found**: _____
**Non-Critical Bugs Found**: _____

**Recommendation**:
⬜ Ready for production release
⬜ Ready for beta release
⬜ Needs bug fixes before release
⬜ Needs additional testing

**Tester Signature**: _____________________
**Date**: _____________________

---

## 📝 Notes & Observations

(Add any additional notes, observations, or recommendations here)
