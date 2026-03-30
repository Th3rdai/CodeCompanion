# Test Fixture Images

This directory should contain test images for manual testing of the image upload feature.

## Required Test Files

Generate or download these test images for comprehensive manual testing:

### Valid Images (Should Upload Successfully)

1. **small-png.png** (100KB)
   - Simple graphic or icon
   - Test: Basic PNG upload

2. **large-png.png** (10MB)
   - Large screenshot or high-res image
   - Test: Large file handling

3. **transparent-png.png** (<5MB)
   - PNG with alpha channel/transparency
   - Test: Transparency preservation in thumbnails

4. **photo.jpg** (2-5MB)
   - Camera photo with EXIF metadata (GPS, timestamps)
   - Test: EXIF stripping verification
   - **Important**: After upload, download and verify EXIF removed with: `exiftool photo.jpg`

5. **screenshot.jpg** (1-3MB)
   - UI screenshot or desktop capture
   - Test: Standard JPEG processing

6. **mobile-rotated.jpg** (<5MB)
   - Mobile photo with EXIF orientation data
   - Test: Auto-rotation based on EXIF

7. **high-res.jpg** (4000x3000px, ~8MB)
   - High-resolution image
   - Test: Auto-resize to 2048px threshold

8. **static.gif** (<1MB)
   - Single-frame GIF
   - Test: GIF format support

9. **animated.gif** (<5MB)
   - Multi-frame animated GIF
   - Test: First-frame extraction, console warning

### Invalid Images (Should Reject with Clear Errors)

10. **oversized.png** (10000x10000px)
    - Create with: `convert -size 10000x10000 xc:white oversized.png`
    - Expected error: "Image too large: 10000x10000px. Max: 8192px"

11. **huge-file.jpg** (50MB+)
    - Large file exceeding 25MB default limit
    - Expected error: "File too large: 50.0MB. Max: 25MB"

12. **corrupted.png**
    - Intentionally broken PNG file
    - Create by truncating a valid PNG: `head -c 500 valid.png > corrupted.png`
    - Expected error: "Invalid or corrupted image file"

### Unsupported Formats (Should Reject)

13. **test.heic** (Apple HEIC format)
    - Expected error: "Unsupported format: image/heic. Only PNG, JPEG, GIF allowed."

14. **test.svg** (SVG file - security risk)
    - Expected error: "Unsupported format: image/svg+xml. Only PNG, JPEG, GIF allowed."

15. **test.webp** (WebP format)
    - Expected error: "Unsupported format: image/webp. Only PNG, JPEG, GIF allowed."

16. **test.bmp** (Bitmap format)
    - Expected error: "Unsupported format: image/bmp. Only PNG, JPEG, GIF allowed."

17. **test.tiff** (TIFF format)
    - Expected error: "Unsupported format: image/tiff. Only PNG, JPEG, GIF allowed."

## Quick Setup

### Using ImageMagick (macOS/Linux)

```bash
# Install ImageMagick
brew install imagemagick  # macOS
# or: sudo apt-get install imagemagick  # Linux

# Generate test images
cd tests/fixtures/images

# Small PNG (white square, 100KB)
convert -size 500x500 xc:white -quality 100 small-png.png

# Large PNG (gradient, ~10MB)
convert -size 3000x3000 gradient:blue-red -quality 100 large-png.png

# Transparent PNG
convert -size 800x800 xc:none -fill 'rgba(255,0,0,0.5)' -draw 'circle 400,400 400,100' transparent-png.png

# JPEG screenshot simulation
convert -size 1920x1080 gradient:gray-white screenshot.jpg

# High-res JPEG
convert -size 4000x3000 gradient:red-blue -quality 90 high-res.jpg

# Static GIF
convert -size 400x400 xc:yellow static.gif

# Animated GIF (3 frames)
convert -size 400x400 xc:red xc:green xc:blue -delay 50 animated.gif

# Oversized (will fail upload - dimensions too large)
convert -size 10000x10000 xc:white oversized.png

# Huge file (will fail upload - file too large)
convert -size 6000x6000 gradient:blue-red -quality 100 huge-file.jpg

# Corrupted PNG (truncate valid file)
head -c 500 small-png.png > corrupted.png

# Unsupported formats
convert -size 400x400 xc:blue test.bmp
# For HEIC, SVG, WEBP, TIFF - find sample files online or convert
```

### Download Sample Images

Alternatively, download free test images from:

- **Unsplash**: https://unsplash.com (free high-res photos)
- **Pixabay**: https://pixabay.com (free images, no attribution)
- **Sample Files**: https://file-examples.com (various formats)

### Adding EXIF Metadata

To test EXIF stripping, add GPS data to a JPEG:

```bash
# Install exiftool
brew install exiftool  # macOS

# Add fake GPS coordinates to photo.jpg
exiftool -GPSLatitude="37.7749 N" -GPSLongitude="122.4194 W" -DateTimeOriginal="2024:03:15 10:30:00" photo.jpg

# Verify EXIF added
exiftool photo.jpg | grep GPS

# After uploading through Code Companion:
# 1. Download the processed image
# 2. Check EXIF removed: exiftool downloaded.jpg | grep GPS
# 3. Should return nothing (EXIF stripped)
```

## Manual Testing Workflow

1. **Prepare fixtures**: Generate or download all 17 test images
2. **Start Code Companion**: Ensure Ollama + vision model (llava) running
3. **Follow checklist**: Work through `tests/IMAGE_TESTING_CHECKLIST.md`
4. **Document results**: Mark passed/failed, note any bugs
5. **EXIF verification**: Critical security test - verify GPS/timestamps removed

## Automated Testing

Unit tests use generated base64 test data (no fixtures needed).

Integration tests require:

- Server running (`npm start`)
- Ollama running with llava model
- Run: `node tests/integration/api-with-images.test.js`

E2E tests (Playwright) require:

- Full app running
- Test fixtures in this directory
- Run: `npx playwright test tests/e2e/image-upload.spec.js`

## Security Testing Notes

**Critical Security Tests** (manual verification required):

1. **EXIF Stripping**:
   - Upload `photo.jpg` with GPS EXIF
   - Download processed image from chat history
   - Run: `exiftool downloaded.jpg`
   - Verify: No GPS, timestamps, or camera info present

2. **SVG Rejection**:
   - Try uploading `test.svg`
   - Verify: Rejected at MIME type check
   - Verify: Error message shows before processing

3. **Path Traversal**:
   - Try uploading file named: `../../../etc/passwd.png`
   - Verify: Filename sanitized to safe characters

4. **XSS Prevention**:
   - SVG with embedded `<script>` tags
   - Should be rejected at MIME validation

All security measures are implemented in `lib/image-processor.js` and `src/lib/image-processor.js`.
