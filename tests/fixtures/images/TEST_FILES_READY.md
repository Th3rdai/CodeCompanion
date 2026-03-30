# ✅ Test Fixtures Ready

**Location**: `/Users/james/AI_Dev/AIApp-CodeCompanion/tests/fixtures/images`
**Generated**: 2026-03-17
**Total Files**: 14

---

## 📁 Available Test Files

### ✅ Valid Images (Should Upload Successfully)

| File                    | Type | Size  | Purpose                      |
| ----------------------- | ---- | ----- | ---------------------------- |
| **small-png.png**       | PNG  | 406B  | Basic PNG upload             |
| **large-png.png**       | PNG  | 63KB  | Large PNG handling           |
| **transparent-png.png** | PNG  | 6.6KB | Transparency preservation    |
| **screenshot.jpg**      | JPEG | 41KB  | Standard screenshot          |
| **photo.jpg**           | JPEG | 68KB  | **EXIF test (CRITICAL)**     |
| **high-res.jpg**        | JPEG | 202KB | Auto-resize test (4000x3000) |
| **static.gif**          | GIF  | 630B  | Static GIF support           |
| **animated.gif**        | GIF  | 1.8KB | Animated GIF warning         |

### ❌ Invalid/Failure Images (Should Reject)

| File              | Type | Size               | Expected Error                                       |
| ----------------- | ---- | ------------------ | ---------------------------------------------------- |
| **oversized.png** | PNG  | 32KB (10000x10000) | "Image too large: 10000x10000px. Max: 8192px"        |
| **huge-file.jpg** | JPEG | 1.3MB (6000x6000)  | May pass or resize (under 25MB limit)                |
| **corrupted.png** | PNG  | 406B (truncated)   | "Invalid or corrupted image file"                    |
| **test.bmp**      | BMP  | 469KB              | "Unsupported format: image/bmp"                      |
| **test.svg**      | SVG  | 99B                | "Unsupported format: image/svg+xml" (XSS protection) |

### 🔒 CRITICAL: EXIF Test File

**photo.jpg** contains GPS and camera EXIF data:

- **GPS Coordinates**: 37°46'29.64"N, 122°25'9.84"W (San Francisco)
- **Date/Time**: 2024:03:15 10:30:00
- **Camera**: Apple iPhone 12

**After uploading to Code Companion and downloading from chat history, ALL this data MUST be removed.**

---

## 🧪 EXIF Security Test Procedure

### Step 1: Upload photo.jpg

1. Open Code Companion: https://localhost:8900
2. Select vision model (llava)
3. Upload `tests/fixtures/images/photo.jpg`
4. Send message: "What's in this image?"
5. Wait for response

### Step 2: Download Processed Image

1. Find the image in chat history
2. Right-click image → "Save Image As"
3. Save to Downloads folder as `downloaded_photo.jpg`

### Step 3: Verify EXIF Stripped

```bash
cd ~/Downloads

# Check GPS (MUST BE EMPTY)
exiftool downloaded_photo.jpg | grep -i GPS
# Expected: No output

# Check dates (MUST BE EMPTY)
exiftool downloaded_photo.jpg | grep -i Date
# Expected: Only "File Modification Date" (from save), no "Date/Time Original"

# Check camera (MUST BE EMPTY)
exiftool downloaded_photo.jpg | grep -i -E "Make|Model|Camera"
# Expected: No output

# Full EXIF dump (should be minimal)
exiftool downloaded_photo.jpg
# Expected: Only basic metadata (dimensions, file size), NO GPS/camera/timestamps
```

### Results:

- ✅ **PASS**: No GPS/Date/Camera info → Safe to release
- ❌ **FAIL**: Any personal EXIF data present → **BLOCKER - DO NOT RELEASE**

---

## 📋 Quick File Access

Open the fixtures directory in Finder:

```bash
open tests/fixtures/images
```

Or navigate in terminal:

```bash
cd tests/fixtures/images
ls -lh
```

---

## 🚀 Next Steps

1. **Open Testing Tracker**:

   ```bash
   code tests/TESTING_SESSION_TRACKER.md
   ```

2. **Open Code Companion**:
   - URL: https://localhost:8900
   - Accept SSL certificate warning

3. **Start Phase 1**:
   - Upload each valid image (PNG, JPEG, GIF)
   - Try uploading invalid images (BMP, SVG)
   - Check boxes in TESTING_SESSION_TRACKER.md

4. **Priority: Phase 6 (EXIF Test)**:
   - This is the CRITICAL security test
   - Upload photo.jpg, download, verify EXIF stripped
   - Do this early!

---

**All test fixtures are ready. You can now begin manual testing!**
