# Phase 8: Security Hardening - Integration Notes

**Status**: Privacy warning modal ready for integration
**Agent**: Agent-Foundation
**Date**: 2026-03-17

---

## Completed

✅ **ImagePrivacyWarning component** created at `src/components/ImagePrivacyWarning.jsx`
✅ **CSP configuration** verified in `server.js` (already allows `data:` and `blob:` URIs)
✅ **EXIF stripping** verified in `lib/image-processor.js` (automatic via canvas re-encoding)

---

## Integration Required in App.jsx

**Note**: Phase 2 agent is actively modifying App.jsx. These changes should be integrated after Phase 2 completes to avoid conflicts.

### Step 1: Import Component (Already Done ✅)

```javascript
// Line ~38
import ImagePrivacyWarning from "./components/ImagePrivacyWarning";
```

### Step 2: Add State Variable

```javascript
// Around line ~174, after showOllamaSetup
const [showImagePrivacyWarning, setShowImagePrivacyWarning] = useState(false);
```

### Step 3: Add Helper Function

```javascript
// Add after other helper functions (around line ~610+)
function checkAndShowImagePrivacyWarning() {
  const hasSeenWarning =
    localStorage.getItem("cc-image-privacy-accepted") === "true";
  if (!hasSeenWarning) {
    setShowImagePrivacyWarning(true);
    return true; // Showed warning, upload should wait
  }
  return false; // No warning needed, proceed with upload
}
```

### Step 4: Trigger in Upload Logic

```javascript
// In handleFileUpload() or wherever Phase 2 processes images
// Before processing first image:

if (isImage) {
  // Check if this is first image upload
  const shouldWait = checkAndShowImagePrivacyWarning();
  if (shouldWait) {
    // Store the file for processing after user accepts warning
    // Or just return and let user re-upload
    return;
  }

  // Proceed with image processing...
  const processed = await processImage(file, config.imageSupport);
  // ... rest of upload logic
}
```

### Step 5: Render Modal

```javascript
// At the end of App component, around line ~1540+
// Add before closing </div>:

{
  showImagePrivacyWarning && (
    <ImagePrivacyWarning
      onClose={() => setShowImagePrivacyWarning(false)}
      onAccept={() => {
        // User accepted, can proceed with uploads
        // Phase 2 logic can retry queued uploads here if needed
      }}
    />
  );
}
```

---

## Alternative Simple Integration

If the upload queueing is complex, here's a simpler approach:

**Trigger on first upload attempt**:

```javascript
useEffect(() => {
  const hasImages = attachedFiles.some((f) => f.type === "image" || f.isImage);
  const hasSeenWarning =
    localStorage.getItem("cc-image-privacy-accepted") === "true";

  if (hasImages && !hasSeenWarning) {
    setShowImagePrivacyWarning(true);
  }
}, [attachedFiles]);
```

This shows the warning whenever images are attached and user hasn't seen it before. User can still upload (warning is informational, not blocking).

---

## Component API

### ImagePrivacyWarning Props

```typescript
{
  onClose: () => void;      // Called when user clicks Cancel or ESC
  onAccept?: () => void;    // Called when user clicks "I Understand"
}
```

### localStorage Key

- `cc-image-privacy-accepted: 'true'` - Set when user checks "Don't show again" and clicks accept

---

## Testing Checklist

After integration:

- [ ] Upload first image → Privacy warning should appear
- [ ] Click "I Understand" → Warning closes, upload proceeds
- [ ] Check "Don't show again" + click accept → Warning never shows again
- [ ] Click "Cancel" → Warning closes, no localStorage set
- [ ] Press ESC → Warning closes
- [ ] Upload subsequent images → No warning (if accepted with checkbox)
- [ ] Clear localStorage → Warning shows again on next upload

---

## Current Status

**Phase 8 Tasks**:

- ✅ EXIF stripping (done in Phase 0)
- ✅ CSP configuration (already correct)
- ✅ Privacy warning component (created)
- ⏸️ Integration into App.jsx (waiting for Phase 2 to complete)

**Recommendation**: Phase 2 agent can integrate during their work, or Agent-Foundation can integrate after Phase 2 is complete.

---

**Last Updated**: 2026-03-17
**Integration Priority**: After Phase 2 completes
