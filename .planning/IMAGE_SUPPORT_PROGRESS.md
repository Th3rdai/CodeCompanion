# Image Support Implementation Progress

**Last Updated**: 2026-03-17
**Status**: Phase 0 Complete, Phase 1+ In Progress

## ✅ COMPLETED

### Phase 0: Foundation & Utilities ✅ COMPLETE
**Completed by**: Session 1 (2026-03-17)
**Documentation**: `.planning/phase0.md`

- ✅ **lib/image-processor.js** - Full utility module with all functions (370 lines)
- ✅ **src/components/ImageThumbnail.jsx** - Thumbnail component with metadata (120 lines)
- ✅ **src/components/ImageLightbox.jsx** - Full-screen viewer with zoom/gallery (280 lines)
- ✅ **Zero new dependencies** - Uses built-in Canvas API + existing lucide-react
- ✅ **All security measures** - EXIF stripping, validation, sanitization
- ✅ **All accessibility features** - ARIA labels, keyboard nav, focus trap

---

## 🚧 IN PROGRESS - PARALLEL WORK STREAMS

### STREAM A: Backend Integration (Phases 1)
**Assigned to**: Session A
**Files to modify**:
- `lib/ollama-client.js` - Add images parameter to chatStream/chatComplete
- `server.js` - Update `/api/chat`, `/api/review`, `/api/pentest` endpoints
- `lib/config.js` - Add imageSupport config section

**Tasks**:
1. ✅ Task 1.1: Update Ollama Client (lib/ollama-client.js:10)
   - Add optional `images = []` parameter to chatStream() and chatComplete()
   - Transform messages to include images array
   - Increase timeout to 300s when images present
   - Images must be base64 WITHOUT data URI prefix

2. ✅ Task 1.2: Update Chat API Endpoint (server.js:341)
   - Accept `images` array in request body
   - Validate images array (max 10 images)
   - Inject vision-specific prompt when images present
   - Pass images to Ollama client
   - Add structured logging for image count

3. ✅ Task 1.3: Update Review/Pentest Endpoints
   - `/api/review` (server.js:616) - Support code screenshots
   - `/api/pentest` (server.js:738) - Support vulnerability screenshots
   - Apply same pattern: accept images, validate, pass to Ollama

4. ✅ Task 1.4: Add Image Config Defaults (lib/config.js:26)
   - Add imageSupport object to defaults:
     ```javascript
     imageSupport: {
       enabled: true,
       maxSizeMB: 25,
       maxDimensionPx: 8192,
       compressionQuality: 0.9,
       maxImagesPerMessage: 10,
       resizeThreshold: 2048,
       warnOnFirstUpload: true
     }
     ```

---

### STREAM B: Frontend Upload & Display (Phases 2-3)
**Assigned to**: Session B
**Files to modify**:
- `src/App.jsx` - File upload, attachment state, message display
- `lib/history.js` - Conversation history with images

**Tasks**:
1. ✅ Task 2.1: Update Attachment State Structure (App.jsx)
   - Extend attachedFiles schema to support images
   - Add fields: isImage, thumbnail, size, dimensions, format, hash
   - Maintain backwards compatibility (optional fields)

2. ✅ Task 2.2: Update File Upload Handler (App.jsx:591-614)
   - Import image-processor functions
   - Detect image files (file.type.startsWith('image/'))
   - Validate with validateImage()
   - Process with processImage()
   - Check duplicates by hash
   - Add to attachedFiles with full metadata
   - Show processing state (spinner, progress)

3. ✅ Task 2.3: Add Clipboard Paste Support (App.jsx)
   - New handlePasteImage() function
   - Detect image in clipboard (item.type.startsWith('image/'))
   - Process same as file upload
   - Attach to textarea onPaste event

4. ✅ Task 2.4: Update Attachment Display UI (App.jsx)
   - Import ImageThumbnail component
   - Render images vs text files differently
   - Horizontal scrolling row for 4+ attachments
   - Individual remove buttons (not just "Clear All")

5. ✅ Task 2.5: Update Message Sending Logic (App.jsx handleSendMessage)
   - Separate text vs image attachments
   - Build message with images array
   - Send images to /api/chat
   - Clear attachments after send (keep thumbnails)

6. ✅ Task 2.6: Display Images in Chat History (App.jsx)
   - Update message rendering to show images
   - Reconstruct data URI for display (add prefix back)
   - Grid layout for multiple images
   - Click to open lightbox

7. ✅ Task 2.7: Update Conversation History Storage (lib/history.js)
   - Add optional images[] field to message schema
   - Save to file system (NOT localStorage)
   - Warn if conversation >5MB
   - Backwards compatibility for loading old conversations

---

### STREAM C: Vision Model Detection & UI (Phase 4)
**Assigned to**: Either Session (Quick win)
**Files to modify**:
- Backend: Model list endpoint or startup
- `src/components/SettingsPanel.jsx` - Model selector with badges

**Tasks**:
1. ✅ Task 4.1: Detect Vision Models (Backend)
   - Tag models with supportsVision based on family field
   - Vision families: llava, bakllava, minicpm-v
   - Send enriched models to frontend

2. ✅ Task 4.2: Model Dropdown Vision Badges (SettingsPanel.jsx)
   - Show 👁️ icon for vision models
   - Sort vision models to top when images attached
   - Empty state when no vision models installed

3. ✅ Task 4.3: Real-Time Vision Model Validation (App.jsx)
   - Detect invalid state (images + non-vision model)
   - Show warning banner
   - Disable send button when invalid
   - "Switch to vision model" quick action
   - "Remove images" quick action

---

### STREAM D: Settings & Polish (Phases 5-6)
**Assigned to**: Either Session
**Files to modify**:
- `src/components/SettingsPanel.jsx` - Image settings UI

**Tasks**:
1. ✅ Task 5.1: Add Image Settings UI (SettingsPanel.jsx)
   - New "Image Support (Beta)" section in General tab
   - Toggle: Enable Image Upload
   - Slider: Max Image Size (1-50 MB)
   - Number: Max Images Per Message (1-20)
   - Slider: Image Quality (50%-100%)
   - List: Available Vision Models

---

### STREAM E: Additional Upload Points (Phase 9)
**Assigned to**: Either Session (After Streams A+B complete)
**Files to modify**:
- `src/components/ReviewPanel.jsx`
- `src/components/SecurityPanel.jsx`
- `src/components/FileBrowser.jsx`

**Tasks**:
1. ✅ Task 9.1: Review Panel Image Support
   - Import image-processor utilities
   - Apply same file upload logic
   - Send to /api/review with images array

2. ✅ Task 9.2: Security Panel Image Support
   - Apply same pattern to all drop zones
   - Send to /api/pentest with images array

3. ✅ Task 9.3: File Browser Image Support
   - Detect image files in tree
   - Show thumbnail icon
   - "Send to Chat" handles images properly

---

### STREAM F: Testing & Documentation (Phase 10-11)
**Assigned to**: After Streams A-E complete
**New files to create**:
- `tests/unit/image-processor.test.js`
- `tests/integration/chat-with-images.test.js`
- `tests/e2e/image-upload.spec.js`
- `tests/IMAGE_TESTING_CHECKLIST.md`
- `docs/IMAGES.md`

**Tasks**:
1. ⬜ Task 10.1: Unit Tests
2. ⬜ Task 10.2: Integration Tests
3. ⬜ Task 10.3: E2E Tests (Playwright)
4. ⬜ Task 10.4: Manual Testing Checklist
5. ⬜ Task 10.5: Documentation Updates (README, CLAUDE.md, new IMAGES.md)
6. ⬜ Task 11.1: Welcome Tour Update
7. ⬜ Task 11.2: Settings Empty State
8. ⬜ Task 11.3: Release Preparation (version bump, CHANGELOG.md)

---

## 🎯 RECOMMENDED WORK SPLIT

### Session A (Backend-focused):
1. Start with **STREAM A** (Backend Integration) - Required for everything else
2. Then **STREAM C** (Vision Model Detection) - Quick win
3. Help with **STREAM E** (Additional Upload Points) if time

### Session B (Frontend-focused):
1. Start with **STREAM B** (Frontend Upload & Display) - Core user experience
2. Then **STREAM D** (Settings & Polish) - Quick win
3. Help with **STREAM E** (Additional Upload Points) if time

### Either Session Can Do:
- **STREAM F** (Testing & Documentation) - After core features complete

---

## 🔄 COORDINATION POINTS

**Dependencies**:
- STREAM B depends on STREAM A (needs backend endpoints ready)
- STREAM E depends on STREAM A + STREAM B (needs core flow working)
- STREAM F depends on all others (testing needs features complete)

**Communication**:
- Update this file when you complete a task (✅)
- Mark task as "🚧 In Progress" when starting
- Add notes if you encounter blockers
- Commit frequently with clear messages

**Testing Strategy**:
- Test each stream independently first
- Integration test after both A+B complete
- E2E test after all streams complete

---

## 📋 CURRENT STATUS

| Stream | Status | Progress | Blocker |
|--------|--------|----------|---------|
| A: Backend | 🚧 Ready to start | 0/4 tasks | None |
| B: Frontend | 🚧 Ready to start | 0/7 tasks | Needs Stream A endpoints |
| C: Vision Models | 🚧 Ready to start | 0/3 tasks | None |
| D: Settings | 🚧 Ready to start | 0/1 tasks | None |
| E: Upload Points | ⏸️ Waiting | 0/3 tasks | Needs A+B |
| F: Testing | ⏸️ Waiting | 0/8 tasks | Needs A-E |

---

## 🚀 QUICK START

**Session A** - Run this:
```bash
# Start with backend
# 1. Update lib/ollama-client.js (Task 1.1)
# 2. Update server.js /api/chat (Task 1.2)
# 3. Update server.js /api/review, /api/pentest (Task 1.3)
# 4. Update lib/config.js defaults (Task 1.4)
```

**Session B** - Run this:
```bash
# Start with frontend (after Session A completes backend)
# 1. Update App.jsx attachment state (Task 2.1)
# 2. Update App.jsx file upload handler (Task 2.2)
# 3. Add clipboard paste support (Task 2.3)
# 4. Update attachment display UI (Task 2.4)
# 5. Update message sending logic (Task 2.5)
# 6. Display images in chat history (Task 2.6)
# 7. Update lib/history.js (Task 2.7)
```

---

## 💡 NOTES

- **Critical**: Images to Ollama = base64 WITHOUT prefix
- **Critical**: Images for display = data URI WITH prefix
- **Security**: All images re-encoded through canvas (strips EXIF, destroys scripts)
- **Performance**: Processing queue max 3 concurrent
- **Storage**: File system only (NOT localStorage - too small)
- **Backwards Compatible**: All new fields are optional

---

**Next Update**: Mark tasks as ✅ or 🚧 as you work through them.
